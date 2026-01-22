
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Transaction, Category, Post, ChurchInfo, CalendarEvent, EventCategory, Department, DepartmentRole, DepartmentMember } from '../types';
import { INITIAL_CHURCH_INFO } from '../constants';
import { Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { supabase } from '../supabaseClient';
import { getTransactions, getCategories, getPosts, getProfile, getChurchInfo, updateChurchInfo, getEvents, getEventCategories, getDepartments, getDepartmentRoles, getDepartmentMembers } from '../services/api';

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

// Auxiliar para recortar imagem via Canvas
const createCroppedImage = (imageSrc: string, scale: number, position: { x: number, y: number }): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 400; // Tamanho padrão do recorte circular
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      if (!ctx) return reject('No context');

      // Desenhar fundo branco/transparente
      ctx.clearRect(0, 0, size, size);

      // Calcular dimensões baseadas no zoom e posição
      // No preview: translate(pos.x, pos.y) scale(scale)
      // O preview tem 160px (40*4). O canvas tem 400px. Fator 2.5x.
      const factor = size / 160;

      const drawWidth = image.width * scale * (size / Math.min(image.width, image.height));
      const drawHeight = image.height * scale * (size / Math.min(image.width, image.height));

      // Centralizar e aplicar o offset do usuário
      const dx = (size - drawWidth) / 2 + (position.x * factor);
      const dy = (size - drawHeight) / 2 + (position.y * factor);

      ctx.drawImage(image, dx, dy, drawWidth, drawHeight);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject('Canvas is empty');
      }, 'image/jpeg', 0.9);
    };
    image.onerror = (err) => reject(err);
  });
};

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'finances' | 'posts' | 'members' | 'reports' | 'agenda' | 'departamentos' | 'settings'>('overview');
  const [financeSubTab, setFinanceSubTab] = useState<'transactions' | 'categories'>('transactions');
  const [memberSubTab, setMemberSubTab] = useState<'list' | 'birthdays' | 'stats'>('list');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [txResultsPerPage, setTxResultsPerPage] = useState(100);
  const [txFilterType, setTxFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [txFilterStatus, setTxFilterStatus] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [txFilterCategory, setTxFilterCategory] = useState<string>('ALL');
  const [txFilterStartDate, setTxFilterStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [txFilterEndDate, setTxFilterEndDate] = useState<string>(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  const monthsList = [
    { id: 0, name: 'Jan' }, { id: 1, name: 'Fev' }, { id: 2, name: 'Mar' },
    { id: 3, name: 'Abr' }, { id: 4, name: 'Mai' }, { id: 5, name: 'Jun' },
    { id: 6, name: 'Jul' }, { id: 7, name: 'Ago' }, { id: 8, name: 'Set' },
    { id: 9, name: 'Out' }, { id: 10, name: 'Nov' }, { id: 11, name: 'Dez' }
  ];

  const tabTitles = {
    overview: 'Visão Geral',
    finances: 'Gestão Financeira',
    posts: 'Comunicados & Mensagens',
    members: 'Gestão de Membros',
    reports: 'Relatórios & Stats',
    agenda: 'Agenda & Eventos',
    departamentos: 'Departamentos',
    settings: 'Configurações'
  };

  // Estados de Dados
  const [churchInfo, setChurchInfo] = useState<ChurchInfo>(INITIAL_CHURCH_INFO);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventCategories, setEventCategories] = useState<EventCategory[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [eventDescription, setEventDescription] = useState('');
  const [postContent, setPostContent] = useState('');

  // Estados de Departamentos
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [deptView, setDeptView] = useState<'list' | 'templates' | 'editor' | 'details'>('list');
  const [deptListFilter, setDeptListFilter] = useState<'active' | 'archived'>('active');
  const [deptSubTab, setDeptSubTab] = useState<'feed' | 'scales' | 'participants'>('participants');
  const [deptMembers, setDeptMembers] = useState<DepartmentMember[]>([]);
  const [deptRoles, setDeptRoles] = useState<DepartmentRole[]>([]);
  const [deptName, setDeptName] = useState('');
  const [deptDescription, setDeptDescription] = useState('');
  const [deptBannerUrl, setDeptBannerUrl] = useState('');
  const [deptIcon, setDeptIcon] = useState('');
  const [deptEditorRoles, setDeptEditorRoles] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');

  // Estados de Modais
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isEventCatModalOpen, setIsEventCatModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // Estados para Ajuste de Avatar
  const [tempAvatarFile, setTempAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarScale, setAvatarScale] = useState(1);
  const [avatarPos, setAvatarPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isAvatarRemoved, setIsAvatarRemoved] = useState(false);
  const avatarRef = React.useRef<HTMLImageElement>(null);

  // Estados de Senha
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Estados de Membros de Departamento
  const [isDeptMemberAddModalOpen, setIsDeptMemberAddModalOpen] = useState(false);
  const [deptMemberUserId, setDeptMemberUserId] = useState('');
  const [deptMemberRoles, setDeptMemberRoles] = useState<string[]>([]);

  // Filtros de Relatório
  const initialFilters = {
    startDate: '',
    endDate: '',
    type: 'ALL',
    category: 'ALL',
    member: 'ALL'
  };
  const [reportFilters, setReportFilters] = useState(initialFilters);

  // Formatação de Moeda
  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Forçar troca de senha se o metadado estiver presente
  useEffect(() => {
    if (user.mustChangePassword) {
      setIsChangePasswordModalOpen(true);
    }
  }, [user.mustChangePassword]);

  useEffect(() => {
    if (editingEvent) {
      setEventDescription(editingEvent.description || '');
    } else {
      setEventDescription('');
    }
  }, [editingEvent]);

  useEffect(() => {
    if (editingPost) {
      setPostContent(editingPost.content || '');
    } else {
      setPostContent('');
    }
  }, [editingPost]);

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link'],
      ['clean']
    ],
  };

  const birthdayCounts = useMemo(() => {
    const counts = Array(12).fill(0);
    allUsers.forEach(u => {
      if (u.birthDate) {
        const month = parseInt(u.birthDate.split('-')[1]) - 1;
        if (month >= 0 && month < 12) counts[month]++;
      }
    });
    return counts;
  }, [allUsers]);

  const selectedMonthMembers = useMemo(() => {
    return allUsers.filter(u => {
      if (!u.birthDate) return false;
      const month = parseInt(u.birthDate.split('-')[1]) - 1;
      return month === selectedMonth;
    }).sort((a, b) => {
      const dayA = parseInt(a.birthDate!.split('-')[2]);
      const dayB = parseInt(b.birthDate!.split('-')[2]);
      return dayA - dayB;
    });
  }, [allUsers, selectedMonth]);

  useEffect(() => {
    async function loadDeptDetails() {
      if (selectedDept) {
        try {
          const [roles, members] = await Promise.all([
            getDepartmentRoles(selectedDept.id),
            getDepartmentMembers(selectedDept.id)
          ]);
          setDeptRoles(roles);
          setDeptMembers(members);
        } catch (error) {
          console.error('Error loading dept details:', error);
        }
      }
    }
    loadDeptDetails();
  }, [selectedDept]);

  const demographicsData = useMemo(() => {
    const stats = { kids: 0, teens: 0, youth: 0, adults: 0, seniors: 0 };

    allUsers.forEach(u => {
      if (!u.birthDate) return;
      const age = calculateAge(u.birthDate);
      if (age <= 12) stats.kids++;
      else if (age <= 17) stats.teens++;
      else if (age <= 29) stats.youth++;
      else if (age <= 59) stats.adults++;
      else stats.seniors++;
    });

    return [
      { name: 'Crianças', value: stats.kids, color: '#4ADE80', range: '0-12 anos' },
      { name: 'Adolescentes', value: stats.teens, color: '#86EFAC', range: '13-17 anos' },
      { name: 'Jovens', value: stats.youth, color: '#F59E0B', range: '18-29 anos' },
      { name: 'Adultos', value: stats.adults, color: '#FCD34D', range: '30-59 anos' },
      { name: 'Idosos', value: stats.seniors, color: '#0EA5E9', range: '60+ anos' }
    ];
  }, [allUsers]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(txSearchTerm.toLowerCase()) ||
          (t.member && t.member.toLowerCase().includes(txSearchTerm.toLowerCase())) ||
          t.category.toLowerCase().includes(txSearchTerm.toLowerCase());

        const matchesType = txFilterType === 'ALL' || t.type === txFilterType;
        const matchesCategory = txFilterCategory === 'ALL' || t.category === txFilterCategory;
        const matchesDate = t.date >= txFilterStartDate && t.date <= txFilterEndDate;
        const matchesStatus = txFilterStatus === 'ALL' ||
          (txFilterStatus === 'PAID' ? t.isPaid === true : t.isPaid === false);

        return matchesSearch && matchesType && matchesCategory && matchesDate && matchesStatus;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by date descending
      .slice(0, txResultsPerPage);
  }, [transactions, txSearchTerm, txResultsPerPage, txFilterType, txFilterCategory, txFilterStartDate, txFilterEndDate, txFilterStatus]);

  const handleAddIncome = () => {
    setEditingTx({ type: 'INCOME', amount: 0, date: new Date().toISOString().split('T')[0], category: '', description: '' } as Transaction);
    setIsTxModalOpen(true);
  };

  const handleAddExpense = () => {
    setEditingTx({ type: 'EXPENSE', amount: 0, date: new Date().toISOString().split('T')[0], category: '', description: '' } as Transaction);
    setIsTxModalOpen(true);
  };

  const fetchData = async () => {
    try {
      const [txs, cats, psts, evs, evCats, depts] = await Promise.all([
        getTransactions(),
        getCategories(),
        getPosts(),
        getEvents(),
        getEventCategories(),
        getDepartments()
      ]);

      setTransactions(txs);
      setCategories(cats);
      setPosts(psts);
      setEvents(evs);
      setEventCategories(evCats);
      setDepartments(depts);

      const info = await getChurchInfo();
      if (info) setChurchInfo(info);

      // Carregar usuários/perfis para a aba de membros
      const { data: profiles } = await supabase.from('profiles').select('*');
      if (profiles) {
        const mappedUsers: User[] = profiles.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role as UserRole,
          birthDate: p.birth_date,
          address: p.address,
          phone: p.phone,
          avatarUrl: p.avatar_url,
          gender: p.gender,
        }));
        setAllUsers(mappedUsers);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };


  // --- Handlers de Upload de Imagem ---
  const handleFileUpload = (file: File, callback: (base64: string) => void) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) callback(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // --- Handlers de Ações ---

  const handleSaveChurchInfo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Upload logic logic here if needed, for now assuming URL or previously uploaded
    // To implement file upload properly, we'd need Supabase Storage.
    // For now, we keep the text logic, but if image was uploaded locally to base64, 
    // we might need to handle it. The current UI inputs "logoUrl" is implicit or text.
    // The previous code didn't handle file upload fully either (just text input for URL or file input that did nothing).

    // Let's assume text inputs for now for simplicity until Storage is set up.
    const newInfo: ChurchInfo = {
      name: formData.get('name') as string,
      logoUrl: churchInfo.logoUrl, // Maintain existing unless changed (logic requires storage)
      address: formData.get('address') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
    };

    try {
      await updateChurchInfo(newInfo);
      alert('Informações atualizadas com sucesso!');
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar informações.');
    }
  };

  const handleSaveTx = async (e: React.FormEvent<HTMLFormElement>, closeAfter: boolean = true) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const catName = formData.get('category') as string;
    const catId = categories.find(c => c.name === catName)?.id;

    if (!catId) {
      alert('Categoria inválida');
      return;
    }

    const txData = {
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      type: formData.get('type') as 'INCOME' | 'EXPENSE',
      category_id: catId,
      date: formData.get('date') as string,
      member_name: (formData.get('member') as string) || null,
      is_paid: formData.get('is_paid') === 'true',
      account: formData.get('account') as string,
      cost_center: formData.get('cost_center') as string,
      payment_type: formData.get('payment_type') as string,
      doc_number: formData.get('doc_number') as string,
      competence: formData.get('competence') as string || null,
      notes: formData.get('notes') as string,
    };

    try {
      if (editingTx?.id) {
        await supabase.from('transactions').update(txData).eq('id', editingTx.id);
      } else {
        await supabase.from('transactions').insert([txData]);
      }

      if (closeAfter) {
        setIsTxModalOpen(false);
      } else {
        // Clear form but keep type
        e.currentTarget.reset();
        const currentType = editingTx?.type || 'INCOME';
        setEditingTx({ type: currentType, amount: 0, date: new Date().toISOString().split('T')[0], category: '', description: '' } as Transaction);
      }
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar transação');
    }
  };

  const handleSaveCat = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const catData = {
      name: formData.get('name') as string,
      color: formData.get('color') as string || 'indigo',
      type: formData.get('type') as 'INCOME' | 'EXPENSE',
      description: formData.get('description') as string || null,
    };
    try {
      if (editingCat) {
        await supabase.from('categories').update(catData).eq('id', editingCat.id);
      } else {
        await supabase.from('categories').insert([catData]);
      }
      setIsCatModalOpen(false);
      setEditingCat(null);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar categoria');
    }
  };

  const handleSaveMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as UserRole;

    let avatarUrl = isAvatarRemoved ? null : editingMember?.avatarUrl;
    let userId = editingMember?.id;

    if (!editingMember) {
      // Criação de Novo Usuário (Sign Up)
      const password = formData.get('password') as string;
      if (!password || password.length < 6) {
        alert('Defina uma senha de pelo menos 6 caracteres.');
        return;
      }

      try {
        // Importar createClient dinamicamente para usar uma instância sem persistência de sessão
        const { createClient } = await import('@supabase/supabase-js');
        const tempClient = createClient(
          (import.meta as any).env.VITE_SUPABASE_URL,
          (import.meta as any).env.VITE_SUPABASE_ANON_KEY,
          { auth: { persistSession: false } }
        );

        const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role,
              must_change_password: true,
              phone: formData.get('phone') as string,
              address: formData.get('address') as string,
              birth_date: formData.get('birthDate') as string || null,
            }
          }
        });

        if (signUpError) throw signUpError;
        userId = signUpData.user?.id;
      } catch (error: any) {
        console.error('Erro ao criar conta:', error);
        alert('Erro ao criar conta: ' + error.message);
        return;
      }
    }

    // Lógica de Upload de Avatar (com Crop se houver novo arquivo)
    if (tempAvatarFile && !isAvatarRemoved) {
      try {
        const croppedFile = await createCroppedImage(avatarPreview!, avatarScale, avatarPos);
        const fileExt = tempAvatarFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `members/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, croppedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      } catch (error) {
        console.error('Error uploading avatar:', error);
        alert('Erro ao processar imagem.');
      }
    }

    const memberData: any = {
      name,
      email,
      role,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
      birth_date: formData.get('birthDate') as string || null,
      avatar_url: avatarUrl,
      gender: formData.get('gender') as string || null,
    };

    try {
      if (userId) {
        // Usar upsert em vez de update para evitar falha caso o trigger ainda não tenha criado o perfil
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            ...memberData
          });

        if (error) throw error;
      } else {
        alert('Erro: ID do usuário não encontrado.');
        return;
      }

      setIsMemberModalOpen(false);
      setTempAvatarFile(null);
      setAvatarPreview(null);
      setAvatarPos({ x: 0, y: 0 });
      setAvatarScale(1);
      setIsAvatarRemoved(false);
      fetchData();
      alert('Dados do membro salvos com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar membro:', error);
      alert('Erro ao salvar membro: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleSavePost = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const postData = {
      title: formData.get('title') as string,
      content: postContent,
      date: editingPost?.date || new Date().toISOString().split('T')[0],
      image_url: (formData.get('imageUrl') as string) || 'https://picsum.photos/seed/church/800/400',
      is_active: editingPost ? editingPost.isActive : true,
      author_id: user.id
    };

    try {
      if (editingPost) {
        await supabase.from('posts').update(postData).eq('id', editingPost.id);
      } else {
        await supabase.from('posts').insert([postData]);
      }
      setIsPostModalOpen(false);
      setEditingPost(null);
      setPostContent('');
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar postagem');
    }
  };

  const togglePostVisibility = async (id: string) => {
    const post = posts.find(p => p.id === id);
    if (!post) return;
    try {
      await supabase.from('posts').update({ is_active: !post.isActive }).eq('id', id);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('As senhas não coincidem!');
      return;
    }
    if (newPassword.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setPasswordLoading(true);
    try {
      // Atualiza a senha e TAMBÉM limpa o flag must_change_password no metadata
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false }
      });

      if (error) throw error;
      alert('Senha alterada com sucesso!');
      setIsChangePasswordModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');

      // Se for o admin logado, o App.tsx vai recarregar o perfil
      // mas podemos forçar um reload ou atualizar localmente se necessário
      window.location.reload();
    } catch (error: any) {
      alert('Erro ao alterar senha: ' + error.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleResetMemberPassword = async (email: string) => {
    if (!confirm(`Enviar link de redefinição de senha para ${email}?`)) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      alert('E-mail de redefinição enviado com sucesso!');
    } catch (error: any) {
      alert('Erro ao enviar e-mail: ' + error.message);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const eventData = {
      title: formData.get('title') as string,
      startDate: formData.get('startDate') as string,
      startTime: formData.get('startTime') as string || null,
      endDate: formData.get('endDate') as string,
      endTime: formData.get('endTime') as string || null,
      description: eventDescription,
      location: formData.get('location') as string,
      categoryId: formData.get('categoryId') as string,
      isPrivate: formData.get('isPrivate') === 'true',
      isAllDay: formData.get('isAllDay') === 'true',
      repeat: formData.get('repeat') as any,
    };

    try {
      const payload = {
        title: eventData.title,
        start_date: eventData.startDate,
        start_time: eventData.startTime,
        end_date: eventData.endDate,
        end_time: eventData.endTime,
        description: eventData.description,
        location: eventData.location,
        category_id: eventData.categoryId || null,
        is_private: eventData.isPrivate,
        is_all_day: eventData.isAllDay,
        repeat: eventData.repeat
      };

      if (editingEvent?.id) {
        await supabase.from('events').update(payload).eq('id', editingEvent.id);
      } else {
        await supabase.from('events').insert([{ ...payload, created_by: user.id }]);
      }
      setIsEventModalOpen(false);
      setEditingEvent(null);
      setEventDescription('');
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar evento');
    }
  };

  const handleSaveEventCat = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const catData = {
      name: formData.get('name') as string,
      color: formData.get('color') as string,
    };

    try {
      await supabase.from('event_categories').insert([catData]);
      setIsEventCatModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Erro ao criar categoria de evento');
    }
  };

  // Fix: Added handleDeleteTx to remove a transaction and update storage
  const handleDeleteTx = async (id: string) => {
    if (confirm('Deseja realmente excluir este lançamento?')) {
      await supabase.from('transactions').delete().eq('id', id);
      fetchData();
    }
  };

  // Fix: Added handleDeleteMember to remove a member and update storage
  const handleDeleteMember = async (id: string) => {
    alert('Remoção de membros desabilitada nesta versão.');
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm('Deseja realmente excluir este evento?')) {
      await supabase.from('events').delete().eq('id', id);
      setIsEventModalOpen(false);
      setEditingEvent(null);
      fetchData();
    }
  };

  const handleDeptBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setDeptBannerUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDeptIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setDeptIcon(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveDepartment = async () => {
    if (!deptName) return alert('Nome é obrigatório');

    try {
      let deptId = selectedDept?.id;

      if (deptId) {
        // Update
        const { error } = await supabase.from('departments').update({
          name: deptName,
          description: deptDescription,
          banner_url: deptBannerUrl,
          icon: deptIcon
        }).eq('id', deptId);
        if (error) throw error;
      } else {
        // Create
        const { data, error } = await supabase.from('departments').insert([{
          name: deptName,
          description: deptDescription,
          banner_url: deptBannerUrl,
          icon: deptIcon,
          is_active: true
        }]).select().single();
        if (error) throw error;
        deptId = data.id;
      }

      // Sync Roles
      if (deptId) {
        await supabase.from('department_roles').delete().eq('department_id', deptId);

        if (deptEditorRoles.length > 0) {
          const rolesToInsert = deptEditorRoles.map(role => ({
            department_id: deptId,
            name: role,
            is_active: true
          }));
          const { error: rolesErr } = await supabase.from('department_roles').insert(rolesToInsert);
          if (rolesErr) throw rolesErr;
        }
      }

      fetchData();
      setDeptView('list');
      setSelectedDept(null);
      setDeptName('');
      setDeptDescription('');
      setDeptBannerUrl('');
      setDeptIcon('');
      setDeptEditorRoles([]);
      alert('Departamento salvo com sucesso!');
    } catch (error: any) {
      alert('Erro ao salvar departamento: ' + error.message);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDept?.id) return;
    if (confirm('Deseja realmente excluir este departamento? Todos os vínculos de membros e cargos serão perdidos.')) {
      try {
        const { error } = await supabase.from('departments').delete().eq('id', selectedDept.id);
        if (error) throw error;

        fetchData();
        setDeptView('list');
        setSelectedDept(null);
        alert('Departamento excluído com sucesso!');
      } catch (error: any) {
        alert('Erro ao excluir departamento: ' + error.message);
      }
    }
  };

  const handleSaveDeptMember = async () => {
    if (!selectedDept?.id || !deptMemberUserId) return;

    try {
      const { error } = await supabase.from('department_members').upsert({
        department_id: selectedDept.id,
        user_id: deptMemberUserId,
        roles: deptMemberRoles
      });

      if (error) throw error;

      // Refresh
      const { data: members } = await supabase.from('department_members')
        .select('*')
        .eq('department_id', selectedDept.id);
      setDeptMembers(members || []);

      setIsDeptMemberAddModalOpen(false);
      setDeptMemberUserId('');
      setDeptMemberRoles([]);
    } catch (error: any) {
      alert('Erro ao adicionar participante: ' + error.message);
    }
  };

  const handleRemoveDeptMember = async (id: string) => {
    if (!confirm('Deseja realmente remover este participante?')) return;

    try {
      const { error } = await supabase.from('department_members').delete().eq('id', id);
      if (error) throw error;

      setDeptMembers(deptMembers.filter(m => m.id !== id));
    } catch (error: any) {
      alert('Erro ao remover participante: ' + error.message);
    }
  };

  const handleDeleteEventCat = async (id: string) => {
    if (confirm('Deseja realmente excluir esta categoria? Eventos vinculados ficarão sem categoria.')) {
      await supabase.from('event_categories').delete().eq('id', id);
      fetchData();
    }
  };

  const handleDeletePost = async (id: string) => {
    if (confirm('Deseja realmente excluir este post?')) {
      await supabase.from('posts').delete().eq('id', id);
      fetchData();
    }
  };

  // --- Lógica de Filtros e Stats ---

  const globalStats = useMemo(() => ({
    income: transactions.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0),
    expense: transactions.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0),
  }), [transactions]);

  const demographics = useMemo(() => {
    const total = allUsers.length;
    const men = allUsers.filter(u => u.gender === 'M').length;
    const women = allUsers.filter(u => u.gender === 'F').length;
    return {
      total,
      men,
      menPercent: total > 0 ? Math.round((men / total) * 100) : 0,
      women,
      womenPercent: total > 0 ? Math.round((women / total) * 100) : 0,
    };
  }, [allUsers]);

  const birthdayMembers = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    return allUsers.filter(u => {
      if (!u.birthDate) return false;
      const birthMonth = parseInt(u.birthDate.split('-')[1]);
      return birthMonth === currentMonth;
    }).sort((a, b) => {
      const dayA = parseInt(a.birthDate!.split('-')[2]);
      const dayB = parseInt(b.birthDate!.split('-')[2]);
      return dayA - dayB;
    });
  }, [allUsers]);

  const reportData = useMemo(() => {
    const filtered = transactions.filter(tx => {
      const dateMatch = (!reportFilters.startDate || tx.date >= reportFilters.startDate) &&
        (!reportFilters.endDate || tx.date <= reportFilters.endDate);
      const typeMatch = reportFilters.type === 'ALL' || tx.type === reportFilters.type;
      const catMatch = reportFilters.category === 'ALL' || tx.category === reportFilters.category;
      const memberMatch = reportFilters.member === 'ALL' || (tx.member && tx.member === reportFilters.member);
      return dateMatch && typeMatch && catMatch && memberMatch;
    });
    const inc = filtered.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
    const exp = filtered.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
    return { filtered, income: inc, expense: exp, balance: inc - exp };
  }, [transactions, reportFilters, categories]);

  const SidebarItem = ({ icon, label, id, roles }: { icon: React.ReactNode, label: string, id: any, roles?: UserRole[] }) => {
    if (roles && !roles.includes(user.role)) return null;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-4 px-6 py-4 transition-all duration-200 border-r-4 ${activeTab === id
          ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-bold'
          : 'border-transparent text-slate-500 hover:bg-slate-50'
          }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex print:bg-white">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col hidden lg:flex print:hidden">
        <div className="p-8 border-b border-slate-100 flex items-center gap-3">
          {churchInfo.logoUrl ? (
            <img src={churchInfo.logoUrl} className="w-10 h-10 rounded-xl object-cover border border-slate-100" alt="Logo" />
          ) : (
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
          )}
          <span className="font-bold text-xl text-slate-900 tracking-tight truncate">{churchInfo.name}</span>
        </div>
        <nav className="flex-grow pt-8 overflow-y-auto">
          <SidebarItem id="overview" label="Início" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} />
          <SidebarItem id="finances" label="Financeiro" roles={[UserRole.ADMIN, UserRole.TREASURER]} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <SidebarItem id="posts" label="Conteúdo" roles={[UserRole.ADMIN, UserRole.READER]} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2zM7 8h5m-5 4h10" /></svg>} />
          <SidebarItem id="members" label="Membros" roles={[UserRole.ADMIN]} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
          <SidebarItem id="reports" label="Relatórios" roles={[UserRole.ADMIN, UserRole.TREASURER]} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
          <SidebarItem id="agenda" label="Agenda" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
          <SidebarItem id="departamentos" label="Departamentos" roles={[UserRole.ADMIN]} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
          <SidebarItem id="settings" label="Configurações" roles={[UserRole.ADMIN]} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        </nav>
        <div className="p-8 border-t border-slate-100">
          <button onClick={onLogout} className="w-full text-red-500 hover:text-red-700 font-bold transition flex items-center justify-center gap-2">
            Sair do Painel
          </button>
        </div>
      </aside>

      <main className="flex-grow flex flex-col print:p-0">
        <header className="h-16 md:h-24 bg-white border-b border-slate-200 px-4 md:px-10 flex items-center justify-between sticky top-0 z-10 print:hidden">
          <h2 className="text-lg md:text-2xl font-black text-slate-900">{tabTitles[activeTab]}</h2>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-bold text-slate-900 leading-tight">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{user.role}</p>
            </div>
            <img src={user.avatarUrl || `https://i.pravatar.cc/100?u=${user.id}`} className="w-12 h-12 rounded-full border-2 border-indigo-100" alt="avatar" />
          </div>
        </header>

        <div className="p-4 md:p-10 print:p-0">
          {activeTab === 'overview' && (
            <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500">
              {/* Demographics Row */}
              <div className="bg-white p-4 md:p-5 rounded-2xl md:rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-around gap-4 md:gap-6">
                <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                  <div className="bg-teal-50 w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center text-teal-600">
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  </div>
                  <div>
                    <h5 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{demographics.total}</h5>
                    <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total de pessoas</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                  <div className="bg-sky-50 w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center text-sky-600">
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <div>
                    <h5 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{demographics.menPercent}% <span className="text-slate-400 text-xs font-medium">({demographics.men})</span></h5>
                    <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total de homens</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                  <div className="bg-pink-50 w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center text-pink-600">
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <div>
                    <h5 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{demographics.womenPercent}% <span className="text-slate-400 text-xs font-medium">({demographics.women})</span></h5>
                    <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total de mulheres</p>
                  </div>
                </div>
              </div>

              {/* Grid com Financeiro e Agenda */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                {/* Coluna Esquerda - Financeiro */}
                <div className="lg:col-span-7 space-y-6 md:space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[32px] border border-slate-100 shadow-sm">
                      <p className="text-slate-400 font-bold text-[9px] md:text-[10px] uppercase tracking-widest mb-1">Total Entradas</p>
                      <p className="text-2xl md:text-3xl font-black text-emerald-600">{formatCurrency(globalStats.income)}</p>
                    </div>
                    <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[32px] border border-slate-100 shadow-sm">
                      <p className="text-slate-400 font-bold text-[9px] md:text-[10px] uppercase tracking-widest mb-1">Total Saídas</p>
                      <p className="text-2xl md:text-3xl font-black text-red-600">{formatCurrency(globalStats.expense)}</p>
                    </div>
                  </div>
                  <div className="bg-indigo-600 p-6 md:p-8 rounded-2xl md:rounded-[32px] text-white shadow-lg">
                    <p className="text-indigo-200 font-bold text-[9px] md:text-[10px] uppercase tracking-widest mb-1">Saldo em Caixa</p>
                    <p className="text-3xl md:text-5xl font-black">{formatCurrency(globalStats.income - globalStats.expense)}</p>
                  </div>

                  {/* Gráfico de Pizza */}
                  <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[32px] shadow-sm border border-slate-100">
                    <h4 className="text-slate-900 font-bold mb-6">Receitas vs Despesas</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Entradas', value: globalStats.income, color: '#10B981' },
                              { name: 'Saídas', value: globalStats.expense, color: '#EF4444' }
                            ]}
                            innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value"
                          >
                            <Cell fill="#10B981" /><Cell fill="#EF4444" />
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Coluna Direita - Agenda do Mês */}
                <div className="lg:col-span-5">
                  <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[32px] border border-slate-100 shadow-sm lg:sticky lg:top-24">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-sky-100 p-2 rounded-xl text-sky-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">Agenda do Mês</h3>
                    </div>

                    <div className="space-y-3 max-h-[400px] md:max-h-[600px] overflow-y-auto">
                      {(() => {
                        const currentMonth = new Date().getMonth();
                        const currentYear = new Date().getFullYear();
                        const monthEvents = events.filter(e => {
                          const eventDate = new Date(e.startDate);
                          return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
                        }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

                        if (monthEvents.length === 0) {
                          return (
                            <div className="p-10 text-center bg-slate-50 rounded-2xl">
                              <p className="text-slate-400 italic font-medium">Nenhum evento agendado para este mês.</p>
                            </div>
                          );
                        }

                        return monthEvents.map(event => {
                          const eventCat = eventCategories.find(c => c.id === event.categoryId);
                          const eventDate = new Date(event.startDate);
                          const day = eventDate.getDate();
                          const month = eventDate.toLocaleDateString('pt-BR', { month: 'short' });

                          return (
                            <div key={event.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:shadow-md transition group">
                              <div className="flex gap-4">
                                <div className="flex flex-col items-center justify-center bg-white rounded-xl p-3 min-w-[60px] shadow-sm">
                                  <span className="text-2xl font-black text-slate-800">{day}</span>
                                  <span className="text-[9px] font-black text-slate-400 uppercase">{month}</span>
                                </div>
                                <div className="flex-grow">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition">{event.title}</h4>
                                    {eventCat && (
                                      <div
                                        className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                                        style={{ backgroundColor: eventCat.color }}
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                                    {event.startTime && (
                                      <span className="flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {event.startTime}
                                      </span>
                                    )}
                                    {event.location && (
                                      <span className="flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        {event.location}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Aniversariantes do Mês */}
              <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-pink-100 p-2 rounded-xl text-pink-600">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.464 15.05a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0z" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Aniversariantes do Mês</h3>
                </div>
                {birthdayMembers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {birthdayMembers.map(m => (
                      <div key={m.id} className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
                        <img src={m.avatarUrl || `https://i.pravatar.cc/100?u=${m.id}`} className="w-14 h-14 rounded-full border-2 border-white shadow-sm" alt="Membro" />
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{m.name}</p>
                          <p className="text-[10px] text-indigo-600 font-black uppercase mt-1 tracking-widest">Dia {m.birthDate!.split('-')[2]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic font-medium p-10 text-center bg-slate-50 rounded-3xl">Nenhum aniversário registrado para este mês.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'finances' && (
            <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
              <div className="flex gap-6 border-b border-slate-200">
                <button onClick={() => setFinanceSubTab('transactions')} className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition ${financeSubTab === 'transactions' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Livro Caixa</button>
                <button onClick={() => setFinanceSubTab('categories')} className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition ${financeSubTab === 'categories' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Categorias</button>
              </div>

              {financeSubTab === 'transactions' ? (
                <div className="space-y-6">
                  {/* Financial Header Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Resultados: {filteredTransactions.length} transações</h3>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={handleAddIncome} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-600 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Adicionar receita
                      </button>
                      <button onClick={handleAddExpense} className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-rose-600 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Adicionar despesa
                      </button>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <select
                        value={txResultsPerPage}
                        onChange={(e) => setTxResultsPerPage(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                      >
                        <option value={10}>10</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-xs text-slate-500 font-medium">resultados por página</span>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 -ml-20 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pesquisar</span>
                        <input
                          type="text"
                          placeholder="Ex: Nome, descrição..."
                          className="w-64 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={txSearchTerm}
                          onChange={(e) => setTxSearchTerm(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button className="p-2 text-slate-400 hover:text-indigo-600 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg></button>
                        <button className="p-2 text-slate-400 hover:text-indigo-600 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                        <button className="p-2 text-slate-400 hover:text-indigo-600 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg></button>
                      </div>
                    </div>
                  </div>
                  {/* Advanced Filters */}
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Date Period Filter */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="px-4 py-2 text-[11px] font-black text-slate-500 uppercase tracking-tight">Período:</div>
                      <input
                        type="date"
                        value={txFilterStartDate}
                        onChange={(e) => setTxFilterStartDate(e.target.value)}
                        className="px-2 py-2 text-xs font-bold text-slate-700 outline-none"
                      />
                      <span className="text-slate-300">-</span>
                      <input
                        type="date"
                        value={txFilterEndDate}
                        onChange={(e) => setTxFilterEndDate(e.target.value)}
                        className="px-2 py-2 text-xs font-bold text-slate-700 outline-none"
                      />
                      <div className="bg-indigo-700 p-2.5 text-white">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    </div>

                    {/* Type Filter */}
                    <select
                      value={txFilterType}
                      onChange={(e) => setTxFilterType(e.target.value as any)}
                      className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-500 uppercase tracking-widest outline-none shadow-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ALL">Tipo: Todos</option>
                      <option value="INCOME">Receitas</option>
                      <option value="EXPENSE">Despesas</option>
                    </select>

                    {/* Status Filter */}
                    <select
                      value={txFilterStatus}
                      onChange={(e) => setTxFilterStatus(e.target.value as any)}
                      className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-500 uppercase tracking-widest outline-none shadow-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ALL">Status</option>
                      <option value="PAID">Pago</option>
                      <option value="PENDING">Pendente</option>
                    </select>

                    {/* Category Filter */}
                    <select
                      value={txFilterCategory}
                      onChange={(e) => setTxFilterCategory(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-500 uppercase tracking-widest outline-none shadow-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ALL">Categorias: Todas</option>
                      {categories.sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>

                    {/* Clear Filters */}
                    {(txFilterType !== 'ALL' || txFilterStatus !== 'ALL' || txFilterCategory !== 'ALL' || txSearchTerm !== '') && (
                      <button
                        onClick={() => { setTxFilterType('ALL'); setTxFilterStatus('ALL'); setTxFilterCategory('ALL'); setTxSearchTerm(''); }}
                        className="text-[10px] font-black uppercase text-indigo-600 hover:underline"
                      >
                        Limpar Filtros
                      </button>
                    )}
                  </div>

                  {/* Transactions Table */}
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4 w-10 text-center uppercase tracking-widest">
                              <input type="checkbox" className="rounded border-slate-300 text-indigo-600" />
                            </th>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Descrição</th>
                            <th className="px-6 py-4 text-center">Total</th>
                            <th className="px-6 py-4 text-center">Contato</th>
                            <th className="px-6 py-4">Categoria</th>
                            <th className="px-6 py-4">Conta</th>
                            <th className="px-6 py-4 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredTransactions.map((t, index) => (
                            <tr key={t.id} className={`transition group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-indigo-50/30`}>
                              <td className="px-6 py-4 text-center">
                                <input type="checkbox" className="rounded border-slate-300 text-indigo-600" />
                              </td>
                              <td className="px-6 py-4 text-slate-500 text-xs font-bold leading-tight">{t.date.split('-').reverse().join('/')}</td>
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-700 text-xs tracking-tight">{t.description}</div>
                                <div className="text-[10px] text-slate-400 font-medium">{t.description.split('-')[1] || ''}</div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className={`flex items-center justify-center gap-2 font-black text-xs ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {t.type === 'INCOME' ? '' : '-'}{formatCurrency(t.amount)}
                                  {t.isPaid && (
                                    <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center text-slate-500 text-[10px] font-black uppercase">{t.member || ''}</td>
                              <td className="px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-tight">{t.category}</td>
                              <td className="px-6 py-4 text-slate-400 text-[10px] font-bold">Principal</td>
                              <td className="px-6 py-4">
                                <div className="flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition">
                                  <button onClick={() => window.print()} className="p-1.5 text-slate-400 hover:text-indigo-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg></button>
                                  <button onClick={() => { setEditingTx(t); setIsTxModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                  <button onClick={() => { setEditingTx({ ...t, id: Math.random().toString(36).substr(2, 9) }); setIsTxModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg></button>
                                  <button onClick={() => handleDeleteTx(t.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                  {/* Category Lists */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                    {/* Income Categories */}
                    <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm overflow-hidden h-fit">
                      <div className="bg-emerald-500 p-5 text-center">
                        <h4 className="text-white font-black uppercase text-sm tracking-widest">Receitas ({categories.filter(c => c.type === 'INCOME').length})</h4>
                      </div>
                      <div className="p-2">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-50">
                              <th className="px-4 py-3">Nome da categoria</th>
                              <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {categories.filter(c => c.type === 'INCOME').map(cat => (
                              <tr key={cat.id} className="hover:bg-slate-50 transition group">
                                <td className="px-4 py-4">
                                  <div className="font-black text-slate-700 text-xs tracking-tight">{cat.name}</div>
                                  {cat.description && <div className="text-[10px] text-slate-400">{cat.description}</div>}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingCat(cat)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition">Editar</button>
                                    <button onClick={() => { if (confirm('Remover?')) setCategories(categories.filter(c => c.id !== cat.id)); }} className="border border-rose-200 text-rose-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 transition">Remover</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Expense Categories */}
                    <div className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden h-fit">
                      <div className="bg-rose-500 p-5 text-center">
                        <h4 className="text-white font-black uppercase text-sm tracking-widest">Despesas ({categories.filter(c => c.type === 'EXPENSE').length})</h4>
                      </div>
                      <div className="p-2">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-50">
                              <th className="px-4 py-3">Nome da categoria</th>
                              <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {categories.filter(c => c.type === 'EXPENSE').map(cat => (
                              <tr key={cat.id} className="hover:bg-slate-50 transition group">
                                <td className="px-4 py-4">
                                  <div className="font-black text-slate-700 text-xs tracking-tight">{cat.name}</div>
                                  {cat.description && <div className="text-[10px] text-slate-400">{cat.description}</div>}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingCat(cat)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition">Editar</button>
                                    <button onClick={() => { if (confirm('Remover?')) setCategories(categories.filter(c => c.id !== cat.id)); }} className="border border-rose-200 text-rose-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 transition">Remover</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Creation Form Sidebar */}
                  <div className="w-full lg:w-80 space-y-4 sticky top-8">
                    <div className="bg-emerald-500 rounded-2xl p-4 text-white flex items-center gap-3 shadow-lg">
                      <div className="bg-white/20 p-2 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></div>
                      <span className="font-black uppercase text-xs tracking-widest">{editingCat ? 'Editar Categoria' : 'Criar categoria'}</span>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 space-y-6">
                      <form onSubmit={handleSaveCat} className="space-y-6">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome da categoria</label>
                          <input required name="name" defaultValue={editingCat?.name} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold text-xs" />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</label>
                          <textarea name="description" defaultValue={editingCat?.description} rows={4} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold text-xs resize-none" />
                        </div>
                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input type="radio" name="type" value="INCOME" defaultChecked={editingCat?.type !== 'EXPENSE'} className="hidden peer" />
                              <div className="w-4 h-4 rounded-full border-2 border-slate-200 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition shadow-sm"></div>
                              <span className="text-xs font-black text-slate-400 group-hover:text-slate-600 peer-checked:text-emerald-600 transition uppercase tracking-widest">Receitas</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input type="radio" name="type" value="EXPENSE" defaultChecked={editingCat?.type === 'EXPENSE'} className="hidden peer" />
                              <div className="w-4 h-4 rounded-full border-2 border-slate-200 peer-checked:border-rose-500 peer-checked:bg-rose-500 transition shadow-sm"></div>
                              <span className="text-xs font-black text-slate-400 group-hover:text-slate-600 peer-checked:text-rose-600 transition uppercase tracking-widest">Despesas</span>
                            </label>
                          </div>
                        </div>
                        <div className="pt-4 flex gap-3">
                          {editingCat && <button type="button" onClick={() => setEditingCat(null)} className="flex-1 px-4 py-4 border border-slate-200 rounded-[20px] font-black uppercase text-[10px] tracking-widest">Cancelar</button>}
                          <button type="submit" className="flex-1 bg-emerald-400 text-white py-4 rounded-[20px] font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-emerald-500 transition">
                            {editingCat ? 'Salvar' : 'Criar'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
              <div className="flex gap-6 border-b border-slate-200">
                <button
                  onClick={() => setMemberSubTab('list')}
                  className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition ${memberSubTab === 'list' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Lista Geral
                </button>
                <button
                  onClick={() => setMemberSubTab('birthdays')}
                  className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition ${memberSubTab === 'birthdays' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Aniversariantes
                </button>
                <button
                  onClick={() => setMemberSubTab('stats')}
                  className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition ${memberSubTab === 'stats' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Demografia
                </button>
              </div>

              {memberSubTab === 'list' && (
                <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Gerenciar Membros</h3>
                    <button onClick={() => { setEditingMember(null); setIsMemberModalOpen(true); }} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition">+ Novo Cadastro</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1000px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="px-8 py-5 w-20">Avatar</th>
                          <th className="px-8 py-5">Nome Completo</th>
                          <th className="px-8 py-5">E-mail</th>
                          <th className="px-8 py-5">Nascimento</th>
                          <th className="px-8 py-5">Telefone</th>
                          <th className="px-8 py-5 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allUsers.map((u, index) => (
                          <tr key={u.id} className={`transition group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/30`}>
                            <td className="px-8 py-4">
                              <img
                                src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                                className="w-11 h-11 rounded-full border-2 border-white shadow-sm object-cover"
                              />
                            </td>
                            <td className="px-8 py-4">
                              <div className="font-bold text-indigo-900 text-sm tracking-tight">{u.name}</div>
                              {u.role === UserRole.ADMIN && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Admin</span>}
                            </td>
                            <td className="px-8 py-4 text-slate-500 text-xs font-medium">{u.email}</td>
                            <td className="px-8 py-4 text-slate-500 text-xs font-bold tracking-tighter">
                              {u.birthDate ? u.birthDate.split('-').reverse().join('/') : '-'}
                            </td>
                            <td className="px-8 py-4 text-slate-500 text-xs font-medium">
                              {u.phone || '-'}
                            </td>
                            <td className="px-8 py-4 text-center">
                              <div className="flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={() => { setEditingMember(u); setIsMemberModalOpen(true); }} className="text-indigo-600 font-black text-[10px] uppercase hover:underline">Editar</button>
                                <button onClick={() => handleResetMemberPassword(u.email)} className="text-orange-500 font-black text-[10px] uppercase hover:underline">Resetar</button>
                                <button onClick={() => handleDeleteMember(u.id)} className="text-red-600 font-black text-[10px] uppercase hover:underline">Remover</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {memberSubTab === 'birthdays' && (
                <div className="space-y-8">
                  {/* Month Selector */}
                  <div className="flex flex-wrap gap-2 justify-center bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                    {monthsList.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMonth(m.id)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMonth === m.id
                          ? 'bg-indigo-600 text-white shadow-lg scale-110'
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                      >
                        {m.name} ({birthdayCounts[m.id]})
                      </button>
                    ))}
                  </div>

                  <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-100">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">
                        Aniversariantes de {monthsList[selectedMonth].name}
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-10 py-5 w-24">Dia</th>
                            <th className="px-10 py-5 w-32">Imagem</th>
                            <th className="px-10 py-5">Nome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedMonthMembers.map((u, index) => (
                            <tr key={u.id} className={`transition ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                              <td className="px-10 py-5 font-black text-slate-400 text-lg">
                                {u.birthDate!.split('-')[2]}
                              </td>
                              <td className="px-10 py-5">
                                <img
                                  src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                                  className="w-14 h-14 rounded-full border-4 border-white shadow-md object-cover"
                                />
                              </td>
                              <td className="px-10 py-5">
                                <div className="font-bold text-indigo-900 text-lg tracking-tight">{u.name}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                  {u.phone || 'Sem telefone'}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {selectedMonthMembers.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-10 py-20 text-center text-slate-400 font-medium italic">
                                Nenhum aniversariante encontrado para este mês.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {memberSubTab === 'stats' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
                    <div className="flex flex-col items-center">
                      <div className="h-[300px] w-full max-w-[500px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={demographicsData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {demographicsData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="flex flex-wrap justify-center gap-6 mt-4">
                        {demographicsData.map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="px-10 py-5">Tipo</th>
                          <th className="px-10 py-5 text-center">Pessoas</th>
                          <th className="px-10 py-5 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {demographicsData.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition group">
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-4">
                                <span className="font-bold text-slate-900 text-lg tracking-tight">{item.name}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{item.range}</span>
                              </div>
                            </td>
                            <td className="px-10 py-6 text-center">
                              <span className="text-xl font-black text-indigo-600">{item.value}</span>
                            </td>
                            <td className="px-10 py-6 text-center">
                              <button onClick={() => setMemberSubTab('list')} className="bg-indigo-50 text-indigo-700 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition">Ver Pessoas</button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-900/5">
                          <td className="px-10 py-6 font-black text-slate-900 text-lg uppercase tracking-tight">Total Geral</td>
                          <td className="px-10 py-6 text-center font-black text-2xl text-slate-900">{allUsers.length}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 print:hidden">
                <div className="flex justify-between items-center mb-10"><h3 className="text-xl font-black text-slate-900 tracking-tight">Filtros Avançados</h3><button onClick={() => window.print()} className="bg-indigo-600 text-white px-8 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Imprimir Relatório</button></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Data Inicial</label><input type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-black font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={reportFilters.startDate} onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })} /></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Data Final</label><input type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-black font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={reportFilters.endDate} onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })} /></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fluxo</label><select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-black font-bold outline-none" value={reportFilters.type} onChange={(e) => setReportFilters({ ...reportFilters, type: e.target.value })}><option value="ALL">Todos os Fluxos</option><option value="INCOME">Entradas (+)</option><option value="EXPENSE">Saídas (-)</option></select></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categoria</label><select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-black font-bold outline-none" value={reportFilters.category} onChange={(e) => setReportFilters({ ...reportFilters, category: e.target.value })}><option value="ALL">Todas</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Membro</label><select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-black font-bold outline-none" value={reportFilters.member} onChange={(e) => setReportFilters({ ...reportFilters, member: e.target.value })}><option value="ALL">Todos</option>{Array.from(new Set(transactions.map(t => t.member).filter(Boolean))).map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-10 rounded-[40px] border-l-8 border-emerald-500 shadow-sm"><p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Total Entradas</p><p className="text-4xl font-black text-emerald-600">{formatCurrency(reportData.income)}</p></div>
                <div className="bg-white p-10 rounded-[40px] border-l-8 border-rose-500 shadow-sm"><p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Total Saídas</p><p className="text-4xl font-black text-rose-600">{formatCurrency(reportData.expense)}</p></div>
                <div className={`p-10 rounded-[40px] border-l-8 shadow-sm ${reportData.balance >= 0 ? 'border-indigo-500 bg-white' : 'border-orange-500 bg-white'}`}><p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Balanço do Período</p><p className={`text-4xl font-black ${reportData.balance >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>{formatCurrency(reportData.balance)}</p></div>
              </div>
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center"><h3 className="text-2xl font-black text-slate-900 tracking-tight">Conteúdo Web</h3><button onClick={() => { setEditingPost(null); setIsPostModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition">+ Novo Conteúdo</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map(post => (
                  <div key={post.id} className={`bg-white rounded-[40px] overflow-hidden shadow-sm border border-slate-100 group flex flex-col transition-all ${!post.isActive ? 'opacity-50 grayscale' : ''}`}>
                    <img src={post.imageUrl} className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105" alt={post.title} />
                    <div className="p-8 flex-grow">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{post.date}</span>
                        {!post.isActive && <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">Inativo</span>}
                      </div>
                      <h4 className="font-black text-slate-900 text-lg mb-2 leading-tight">{post.title}</h4>
                      <p className="text-slate-500 text-sm line-clamp-2 mb-8 leading-relaxed font-medium">
                        {post.content.replace(/<[^>]*>/g, '')}
                      </p>
                      <div className="flex gap-4 pt-6 border-t border-slate-50">
                        <button onClick={() => { setEditingPost(post); setIsPostModalOpen(true); }} className="text-indigo-600 font-black text-[10px] uppercase hover:underline">Editar</button>
                        <button onClick={() => togglePostVisibility(post.id)} className={`${post.isActive ? 'text-orange-500' : 'text-emerald-500'} font-black text-[10px] uppercase hover:underline`}>{post.isActive ? 'Ocultar' : 'Exibir'}</button>
                        <button onClick={() => handleDeletePost(post.id)} className="text-red-500 font-black text-[10px] uppercase hover:underline">Excluir</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'agenda' && (
            <div className="animate-in fade-in slide-in-from-bottom duration-500">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Calendar Main Area */}
                <div className="flex-grow bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                        {selectedCalendarDate.toLocaleString('pt-BR', { month: 'long' })}
                        <span className="text-indigo-600 ml-2">{selectedCalendarDate.getFullYear()}</span>
                      </h3>
                      <div className="flex bg-slate-100 rounded-2xl p-1 shrink-0">
                        <button
                          onClick={() => setSelectedCalendarDate(new Date(selectedCalendarDate.setMonth(selectedCalendarDate.getMonth() - 1)))}
                          className="p-2 hover:bg-white rounded-xl transition text-slate-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                          onClick={() => setSelectedCalendarDate(new Date(selectedCalendarDate.setMonth(selectedCalendarDate.getMonth() + 1)))}
                          className="p-2 hover:bg-white rounded-xl transition text-slate-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                      <button
                        onClick={() => setSelectedCalendarDate(new Date())}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition"
                      >
                        Hoje
                      </button>
                    </div>
                    <button
                      onClick={() => { setEditingEvent(null); setIsEventModalOpen(true); }}
                      className="bg-sky-500 text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-sky-100 hover:bg-sky-600 transition transform active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      Adicionar
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-3xl overflow-hidden">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="bg-slate-50 py-4 text-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</span>
                      </div>
                    ))}
                    {(() => {
                      const daysInMonth = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth() + 1, 0).getDate();
                      const firstDayOfMonth = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), 1).getDay();
                      const days = [];

                      // Empty cells for first week
                      for (let i = 0; i < firstDayOfMonth; i++) {
                        days.push(<div key={`empty-${i}`} className="bg-white/50 h-32 lg:h-40 p-4"></div>);
                      }

                      // Month days
                      for (let d = 1; d <= daysInMonth; d++) {
                        const dateStr = `${selectedCalendarDate.getFullYear()}-${String(selectedCalendarDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const dayEvents = events.filter(e => e.startDate === dateStr);
                        const isToday = new Date().toISOString().split('T')[0] === dateStr;

                        days.push(
                          <div
                            key={d}
                            onClick={(e) => {
                              if (e.target === e.currentTarget) {
                                setEditingEvent({ startDate: dateStr, endDate: dateStr, isAllDay: false, isPrivate: false, title: '', repeat: 'NONE' } as any);
                                setIsEventModalOpen(true);
                              }
                            }}
                            className={`bg-white h-32 lg:h-40 p-4 hover:bg-slate-50 transition relative group border-t border-l border-slate-100 cursor-pointer ${isToday ? 'ring-2 ring-inset ring-indigo-500 z-10' : ''}`}
                          >
                            <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : 'text-slate-900'} mb-2 block`}>{d}</span>
                            <div className="space-y-1.5 overflow-y-auto max-h-[calc(100%-2rem)] scrollbar-hide">
                              {dayEvents.map(e => {
                                const cat = eventCategories.find(c => c.id === e.categoryId);
                                return (
                                  <div
                                    key={e.id}
                                    onClick={() => { setEditingEvent(e); setIsEventModalOpen(true); }}
                                    className="p-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight text-white cursor-pointer hover:brightness-90 transition truncate shadow-sm"
                                    style={{ backgroundColor: cat?.color || '#6366f1' }}
                                    title={e.title}
                                  >
                                    {e.startTime ? `${e.startTime.substring(0, 5)} ` : ''}{e.title}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      return days;
                    })()}
                  </div>
                </div>

                {/* Sidebar Categories */}
                <div className="w-full lg:w-80 shrink-0 space-y-8">
                  <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h4 className="text-lg font-black text-slate-800 tracking-tight">Categorias</h4>
                      <button
                        onClick={() => setIsEventCatModalOpen(true)}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                      >
                        Nova
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex gap-2 mb-6">
                        <input
                          placeholder="Nova categoria..."
                          className="flex-grow px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button className="bg-sky-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Add</button>
                      </div>

                      {eventCategories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{cat.name}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteEventCat(cat.id)}
                            className="p-1 opacity-0 group-hover:opacity-100 transition text-slate-300 hover:text-rose-500"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-indigo-600 rounded-[40px] p-8 text-white shadow-xl shadow-indigo-100 ring-4 ring-indigo-50">
                    <svg className="w-10 h-10 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <h5 className="font-bold text-lg mb-2">Dica da Agenda</h5>
                    <p className="text-indigo-100 text-sm leading-relaxed">Cadastre e organize as atividades no calendário para que todos da liderança fiquem sintonizados.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'departamentos' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {deptView === 'list' && (
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex gap-8">
                      <button
                        onClick={() => setDeptListFilter('active')}
                        className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition-all ${deptListFilter === 'active' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Ativos
                      </button>
                      <button
                        onClick={() => setDeptListFilter('archived')}
                        className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition-all ${deptListFilter === 'archived' ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Arquivados
                      </button>
                    </div>
                    <button
                      onClick={() => setDeptView('templates')}
                      className="bg-[#005187] text-white px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#00416d] transition"
                    >
                      <span>+</span> Adicionar
                    </button>
                  </div>

                  <div className="p-8">
                    {departments.filter(d => (deptListFilter === 'active' ? d.isActive : !d.isActive)).length === 0 ? (
                      <div className="p-20 flex flex-col items-center justify-center text-center">
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] p-16 w-full max-w-2xl">
                          <h4 className="text-xl font-black text-slate-400 mb-4 uppercase tracking-widest">
                            {deptListFilter === 'active' ? 'Nenhum departamento ativo' : 'Nenhum departamento arquivado'}
                          </h4>
                          {deptListFilter === 'active' && (
                            <button
                              onClick={() => setDeptView('templates')}
                              className="text-indigo-600 font-bold hover:underline"
                            >
                              Cadastrar departamento
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {departments.filter(d => (deptListFilter === 'active' ? d.isActive : !d.isActive)).map(dept => (
                          <div
                            key={dept.id}
                            onClick={() => {
                              setSelectedDept(dept);
                              setDeptName(dept.name);
                              setDeptDescription(dept.description || '');
                              setDeptBannerUrl(dept.bannerUrl || '');
                              setDeptIcon(dept.icon || '');
                              setDeptView('details');
                            }}
                            className="bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition cursor-pointer overflow-hidden group"
                          >
                            <div className="h-32 bg-slate-100 relative">
                              {dept.bannerUrl && <img src={dept.bannerUrl} className="w-full h-full object-cover" />}
                              <div className="absolute left-6 -bottom-6 w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                              </div>
                            </div>
                            <div className="pt-10 px-6 pb-6 mt-4">
                              <h4 className="text-lg font-black text-slate-800 tracking-tight">{dept.name}</h4>
                              <p className="text-slate-400 text-xs font-medium mt-1 truncate">{dept.description}</p>
                              <div className="mt-4 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">0 Participantes</span>
                                <div className="flex -space-x-2">
                                  {[1, 2, 3].map(i => (
                                    <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200"></div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {deptView === 'templates' && (
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-12 text-center">
                  <h3 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Criar novo departamento</h3>
                  <p className="text-slate-400 font-medium mb-12">Use um dos modelos prontos ou crie um novo.</p>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
                    {[
                      { id: 'louvor', name: 'Louvor', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3', description: 'Coordena a música e adoração nos cultos.', roles: ['Líder', 'Vocalista', 'Guitarrista', 'Baixista', 'Baterista', 'Tecladista', 'Sonoplasta'] },
                      { id: 'midia', name: 'Mídia e Comunicação', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', description: 'Gerencia redes sociais, gravações e comunicação visual.', roles: ['Diretor(a) de mídia e comunicação', 'Coordenador(a) de equipe', 'Operador(a) de luz', 'Operador(a) de projeção', 'Assistente de palco', 'Fotógrafo(a)', 'Cinegrafista', 'Editor(a) de vídeo', 'Designer gráfico', 'Social media / gestor(a) de redes', 'Operador(a) de transmissão', 'Roteirista / produtor(a) de conteúdo'] },
                      { id: 'diaconia', name: 'Diaconia', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', description: 'Serviço prático e assistência aos necessitados.', roles: ['Diretor(a)', 'Secretário(a)', 'Tesoureiro(a)', 'Diácono(isa)'] },
                      { id: 'ensino', name: 'Departamento de Ensino', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', description: 'Responsável pela formação bíblica e teológica.', roles: ['Diretor(a)', 'Vice-diretor(a)', 'Supervisor(a)', 'Coordenador(a)', 'Professor(a)', 'Auxiliar', 'Secretário(a)', 'Orientador(a)', 'Monitor(a)'] },
                      { id: 'pastoral', name: 'Departamento Pastoral e de Liderança', icon: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.99 7.99 0 0120 13a7.98 7.98 0 01-2.343 5.657z', description: 'Oferece cuidado espiritual e supervisão ministerial.', roles: ['Pastor(a) presidente', 'Pastor(a) auxiliar', 'Presbítero(a)', 'Diácono / diaconisa', 'Líder de ministério', 'Coordenador(a) de células / pequenos grupos', 'Conselheiro(a) espiritual', 'Mentor(a) ministerial', 'Assistente pastoral'] },
                      { id: 'acolhimento', name: 'Ministério de Acolhimento', icon: 'M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0V12m-3-1.5a3 3 0 00-6 0v1a7 7 0 007 7h2a7 7 0 007-7v-1a3 3 0 00-6 0V5', description: 'Recebe visitantes e novos membros com hospitalidade.', roles: ['Diretor(a)', 'Vice-diretor(a)', 'Coordenador(a) de equipe', 'Recepcionista', 'Acolhador(a)', 'Responsável por novos convertidos', 'Auxiliar de recepção'] },
                      { id: 'tesouraria', name: 'Tesouraria e Secretariado', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', description: 'Gerencia as finanças, documentos e registros administrativos.', roles: ['Tesoureiro(a)', 'Vice-tesoureiro(a)', 'Secretário(a)', 'Vice-secretário(a)', 'Auxiliar administrativo', 'Responsável por patrimônio e inventário', 'Responsável por documentação e arquivo', 'Assistente financeiro(a)'] },
                      { id: 'missoes', name: 'Missões', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9h18', description: 'Expansão do reino através da evangelização.', roles: ['Líder', 'Secretário(a)', 'Tesoureiro(a)'] },
                    ].map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => {
                          setDeptName(tpl.name);
                          setDeptDescription((tpl as any).description || '');
                          setDeptEditorRoles((tpl as any).roles || []);
                          setDeptBannerUrl('');
                          setDeptIcon(tpl.icon);
                          setSelectedDept({ name: tpl.name, isActive: true } as Department);
                          setDeptView('editor');
                        }}
                        className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition flex flex-col items-center gap-4 group"
                      >
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tpl.icon} /></svg>
                        </div>
                        <span className="font-black text-slate-800 uppercase tracking-widest text-xs">{tpl.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setDeptName('');
                        setDeptDescription('');
                        setDeptBannerUrl('');
                        setDeptIcon('');
                        setDeptEditorRoles([]);
                        setSelectedDept({ name: '', isActive: true } as Department);
                        setDeptView('editor');
                      }}
                      className="bg-[#4d0091] p-8 rounded-[32px] shadow-sm hover:shadow-xl transition flex flex-col items-center gap-4 group text-white"
                    >
                      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <span className="font-black uppercase tracking-widest text-xs">Novo</span>
                    </button>
                  </div>
                  <div className="mt-12">
                    <button onClick={() => setDeptView('list')} className="text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition">Cancelar</button>
                  </div>
                </div>
              )}

              {deptView === 'editor' && (
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-right duration-500">
                  {/* Banner / Header */}
                  <div className="relative h-64 bg-slate-100 group">
                    {deptBannerUrl ? (
                      <img src={deptBannerUrl} className="w-full h-full object-cover" alt="Banner" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                      <button
                        onClick={() => document.getElementById('deptBannerInput')?.click()}
                        className="bg-white text-slate-900 px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl opacity-0 group-hover:opacity-100 transition"
                      >
                        Alterar Banner
                      </button>
                    </div>
                    <input id="deptBannerInput" type="file" accept="image/*" onChange={handleDeptBannerUpload} className="hidden" />

                    {/* Icon Circle */}
                    <div className="absolute left-12 -bottom-16 w-32 h-32 bg-indigo-100 rounded-2xl border-8 border-white shadow-xl flex items-center justify-center text-indigo-600 relative group/icon overflow-hidden">
                      {deptIcon && deptIcon.length > 200 ? (
                        <img src={deptIcon} className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={deptIcon || 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'} /></svg>
                      )}
                      <button
                        onClick={() => document.getElementById('deptIconInput')?.click()}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/icon:opacity-100 transition text-white"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                    </div>
                    <input id="deptIconInput" type="file" accept="image/*" onChange={handleDeptIconUpload} className="hidden" />
                  </div>

                  <div className="p-12 pt-24 space-y-12">
                    <div className="space-y-6 max-w-4xl">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nome do departamento</label>
                        <input
                          type="text"
                          value={deptName}
                          onChange={(e) => setDeptName(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sobre o departamento</label>
                        <textarea
                          rows={4}
                          value={deptDescription}
                          onChange={(e) => setDeptDescription(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        ></textarea>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Participantes</h4>
                        </div>
                        <div className="border-2 border-dashed border-slate-100 rounded-xl p-8 text-center bg-slate-50/50">
                          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">O gerenciamento de membros é feito na aba de detalhes do departamento após salvar.</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Cargos/funções</h4>
                          <button
                            onClick={() => {
                              const name = prompt('Nome da nova função:');
                              if (name?.trim()) setDeptEditorRoles([...deptEditorRoles, name.trim()]);
                            }}
                            className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                          >
                            + Novo
                          </button>
                        </div>
                        <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100 flex flex-col">
                          <div className="bg-slate-200/50 px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Líder</div>
                          <div className="flex flex-col bg-white">
                            {deptEditorRoles.length === 0 ? (
                              <div className="p-4 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Nenhuma função definida</div>
                            ) : (
                              <div className="divide-y divide-slate-100">
                                {deptEditorRoles.map((role, idx) => (
                                  <div key={idx} className="px-4 py-3 bg-white border border-slate-100 flex items-center justify-between group hover:bg-slate-50 transition mb-1 last:mb-0 rounded-lg mx-1 mt-1">
                                    <span className="text-xs font-bold text-slate-700">{role}</span>
                                    <button
                                      onClick={() => setDeptEditorRoles(deptEditorRoles.filter((_, i) => i !== idx))}
                                      className="text-slate-300 hover:text-red-500 transition"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center gap-4 pt-8">
                      {selectedDept?.id && (
                        <button
                          onClick={handleDeleteDepartment}
                          className="text-rose-500 text-[10px] font-black uppercase tracking-widest hover:underline"
                        >
                          Excluir departamento
                        </button>
                      )}
                      <div className="flex-grow"></div>
                      <button
                        onClick={() => setDeptView('list')}
                        className="px-10 py-3 rounded-full border border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition"
                      >
                        Voltar
                      </button>
                      <button
                        onClick={handleSaveDepartment}
                        className="px-10 py-3 rounded-full bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-600 transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {deptView === 'details' && selectedDept && (
                <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
                  {/* Left Sidebar - Dept List */}
                  <div className="w-full lg:w-80 shrink-0 space-y-4">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meus Departamentos</h4>
                        <button onClick={() => setDeptView('templates')} className="text-indigo-600 font-black text-xs">+</button>
                      </div>
                      <div className="space-y-2">
                        {departments.map(d => (
                          <button
                            key={d.id}
                            onClick={() => setSelectedDept(d)}
                            className={`w-full text-left px-4 py-3 rounded-2xl transition flex items-center gap-3 ${selectedDept.id === d.id ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50 text-slate-600'}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedDept.id === d.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            </div>
                            <span className="text-xs font-bold truncate">{d.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Content */}
                  <div className="flex-grow space-y-8">
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="relative h-48 bg-slate-100">
                        {selectedDept.bannerUrl && <img src={selectedDept.bannerUrl} className="w-full h-full object-cover" />}
                        <div className="absolute left-12 -bottom-12 w-24 h-24 bg-indigo-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white">
                          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                      </div>

                      <div className="pt-16 px-12 pb-12">
                        <div className="flex items-start justify-between mb-8">
                          <div>
                            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{selectedDept.name}</h3>
                            <p className="text-slate-400 font-medium mt-2 max-w-2xl">{selectedDept.description}</p>
                          </div>
                          <button
                            onClick={() => setDeptView('editor')}
                            className="bg-slate-50 text-slate-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition"
                          >
                            Editar
                          </button>
                        </div>

                        <div className="flex gap-8 border-b border-slate-100 mb-8">
                          {[
                            { id: 'feed', label: 'Feed de novidades' },
                            { id: 'scales', label: 'Escalas' },
                            { id: 'participants', label: 'Participantes' },
                          ].map(tab => (
                            <button
                              key={tab.id}
                              onClick={() => setDeptSubTab(tab.id as any)}
                              className={`pb-4 px-2 text-[10px] font-black uppercase tracking-widest transition-all ${deptSubTab === tab.id ? 'text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        {deptSubTab === 'participants' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <h4 className="text-lg font-black text-slate-800 tracking-tight">Participantes <span className="text-slate-400 text-sm font-medium ml-2">({deptMembers.length})</span></h4>
                              <button
                                onClick={() => setIsDeptMemberAddModalOpen(true)}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100"
                              >
                                Adicionar
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {deptMembers.map(m => {
                                const profile = allUsers.find(u => u.id === m.userId);
                                return (
                                  <div key={m.id} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between group hover:bg-white hover:shadow-md transition border border-transparent hover:border-slate-100">
                                    <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-slate-400 font-black text-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                                        {profile?.avatarUrl ? <img src={profile.avatarUrl} className="w-full h-full object-cover rounded-xl" /> : profile?.name.charAt(0)}
                                      </div>
                                      <div>
                                        <h5 className="text-sm font-black text-slate-800 tracking-tight">{profile?.name}</h5>
                                        <div className="flex gap-1 mt-1">
                                          {m.roles.map(r => (
                                            <span key={r} className="text-[9px] font-black bg-white text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-slate-100">{r}</span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleRemoveDeptMember(m.id)}
                                      className="text-slate-400 opacity-0 group-hover:opacity-100 transition hover:text-red-500"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {deptSubTab === 'feed' && (
                          <div className="p-20 text-center">
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] p-16">
                              <h4 className="text-lg font-black text-slate-400 mb-2 uppercase tracking-widest">Nenhuma novidade</h4>
                              <p className="text-slate-400 text-sm font-medium">As postagens do departamento aparecerão aqui.</p>
                            </div>
                          </div>
                        )}

                        {deptSubTab === 'scales' && (
                          <div className="p-20 text-center">
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] p-16">
                              <h4 className="text-lg font-black text-slate-400 mb-2 uppercase tracking-widest">Nenhuma escala</h4>
                              <p className="text-slate-400 text-sm font-medium">As escalas de serviço aparecerão aqui.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && user.role === UserRole.ADMIN && (
            <div className="animate-in slide-in-from-right duration-500 max-w-2xl">
              <div className="bg-white p-12 rounded-[48px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4 mb-10">
                  <div className="bg-slate-900 p-3 rounded-2xl text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Dados Institucionais</h3>
                    <p className="text-slate-400 font-medium text-sm">Atualize os dados que aparecem no site público.</p>
                  </div>
                </div>

                <form onSubmit={handleSaveChurchInfo} className="space-y-6">
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nome Institucional</label><input name="name" required defaultValue={churchInfo.name} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none text-black font-bold focus:ring-2 focus:ring-indigo-500" /></div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Logo Institucional (Anexo)</label>
                    <div className="flex items-center gap-6">
                      <div className="h-16 w-16 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center">
                        {churchInfo.logoUrl ? <img src={churchInfo.logoUrl} className="h-full w-full object-cover" /> : <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                      </div>
                      <input name="logoFile" type="file" accept="image/*" className="text-xs font-bold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    </div>
                  </div>

                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Endereço Sede</label><input name="address" defaultValue={churchInfo.address} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none text-black font-bold focus:ring-2 focus:ring-indigo-500" /></div>

                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Telefone</label><input name="phone" defaultValue={churchInfo.phone} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none text-black font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">E-mail Administrativo</label><input name="email" type="email" defaultValue={churchInfo.email} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none text-black font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                  </div>
                  <div className="pt-6"><button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black uppercase text-xs tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition transform active:scale-[0.98]">Salvar Configurações</button></div>
                </form>

                <div className="mt-12 pt-12 border-t border-slate-100">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-orange-500 p-3 rounded-2xl text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Segurança</h3>
                      <p className="text-slate-400 font-medium text-sm">Altere sua senha de acesso ao painel.</p>
                    </div>
                  </div>
                  <button onClick={() => setIsChangePasswordModalOpen(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-800 transition">Alterar Minha Senha</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- Modais --- */}

      {isTxModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#f8fafb] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Modal Header */}
            <div className={`px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white`}>
              <h3 className={`text-xl font-bold tracking-tight ${editingTx?.type === 'EXPENSE' ? 'text-[#f43f5e]' : 'text-[#20b2aa]'}`}>
                {editingTx?.id ? (editingTx.type === 'INCOME' ? 'Editar receita' : 'Editar despesa') : (editingTx?.type === 'INCOME' ? 'Criar receita' : 'Criar despesa')}
              </h3>
              <button
                onClick={() => setIsTxModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Body */}
            <form id="txForm" onSubmit={(e) => handleSaveTx(e)} className="p-8 space-y-8 overflow-y-auto">
              <input type="hidden" name="type" value={editingTx?.type || 'INCOME'} />

              {/* Row 1: Data, Descricao, Valor, Pago */}
              <div className="flex flex-wrap gap-6 items-end">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <label className="block text-sm font-bold text-slate-600">Data</label>
                  <div className={`flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 ${editingTx?.type === 'EXPENSE' ? 'focus-within:ring-rose-200' : 'focus-within:ring-[#20b2aa]/30'}`}>
                    <input
                      required name="date" type="date"
                      defaultValue={editingTx?.date || new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 outline-none text-slate-700 font-medium"
                    />
                    <div className="bg-slate-100 p-3 border-l border-slate-200 text-slate-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                  </div>
                </div>

                <div className="flex-[2] min-w-[300px] space-y-2">
                  <label className="block text-sm font-bold text-slate-600">Descrição</label>
                  <input
                    required name="description"
                    defaultValue={editingTx?.description}
                    placeholder="Descrição da transação"
                    className={`w-full px-4 py-3.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-700 focus:ring-2 ${editingTx?.type === 'EXPENSE' ? 'focus:ring-rose-200' : 'focus:ring-[#20b2aa]/30'}`}
                  />
                </div>

                <div className="flex-1 min-w-[150px] space-y-2 text-right">
                  <label className="block text-sm font-bold text-slate-600 text-left">Valor</label>
                  <div className={`flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 ${editingTx?.type === 'EXPENSE' ? 'focus-within:ring-rose-200' : 'focus-within:ring-[#20b2aa]/30'}`}>
                    <span className="pl-4 text-slate-400 font-bold">R$</span>
                    <input
                      required name="amount" type="number" step="0.01"
                      defaultValue={editingTx?.amount}
                      className="w-full px-4 py-3 outline-none text-right font-black text-slate-700"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center space-y-2 pb-1">
                  <label className="block text-sm font-bold text-slate-600">Pago?</label>
                  <label className="relative cursor-pointer">
                    <input type="checkbox" name="is_paid" value="true" defaultChecked={editingTx?.isPaid !== false} className="sr-only peer" />
                    <div className={`w-12 h-12 flex items-center justify-center rounded-full bg-slate-200 text-white transition-all shadow-inner peer-checked:bg-${editingTx?.type === 'EXPENSE' ? 'rose-500' : '[#20b2aa]'}`}>
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  </label>
                </div>
              </div>

              {/* Row 2: Pagador/Recebedor, Categoria, Conta, Centro de Custo */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-600">{editingTx?.type === 'EXPENSE' ? 'Pago à' : 'Recebido de'}</label>
                  <select name="member" defaultValue={editingTx?.member} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-600">
                    <option value="">Selecione</option>
                    {allUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-600">Categoria</label>
                  <select name="category" defaultValue={editingTx?.category} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-600">
                    <option value="">Selecione</option>
                    {categories.filter(c => c.type === editingTx?.type).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-600">Conta</label>
                  <select name="account" defaultValue={editingTx?.account || 'Principal'} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-600">
                    <option value="Principal">Banco Sede - Principal</option>
                    <option value="Caixa Local">Caixa Local</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-600">Centro de custo</label>
                  <select name="cost_center" defaultValue={editingTx?.costCenter} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-600">
                    <option value="">Selecione</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Eventos">Eventos</option>
                    <option value="Infraestrutura">Infraestrutura</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Tipo Pgto, Doc Nr, Competencia + Annotacoes */}
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-600">Tipo de pagamento</label>
                    <select name="payment_type" defaultValue={editingTx?.paymentType || 'Único'} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-600">
                      <option value="Único">Único</option>
                      <option value="Parcelado">Parcelado</option>
                      <option value="Recorrente">Recorrente</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-600">Doc nº</label>
                    <input name="doc_number" defaultValue={editingTx?.docNumber} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-700" />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-600">Competência</label>
                    <div className="flex items-center bg-slate-100/50 border border-slate-200 rounded-lg overflow-hidden">
                      <input name="competence" type="month" defaultValue={editingTx?.competence ? editingTx.competence.substring(0, 7) : ''} className="w-full px-4 py-3 bg-transparent outline-none text-slate-600 font-medium" />
                      <div className="p-3 text-slate-400 border-l border-slate-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <label className="block text-sm font-bold text-slate-600">Anotações</label>
                  <textarea name="notes" defaultValue={editingTx?.notes} rows={8} className={`w-full px-6 py-4 bg-white border border-slate-200 rounded-xl outline-none font-medium text-slate-700 resize-none shadow-sm focus:ring-2 ${editingTx?.type === 'EXPENSE' ? 'focus:ring-rose-200' : 'focus:ring-[#20b2aa]/30'}`} placeholder="Observações importantes..." />
                </div>
              </div>

              {/* Files Section Mock */}
              <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="text-sm font-bold text-slate-500">Arquivos 0/5</div>
                </div>
                <button type="button" className="bg-[#004a7c] text-white px-6 py-2 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-[#003a63] transition shadow-md">
                  Anexar arquivo (Máx. 10MB/arquivo)
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-4">
              <button
                type="button"
                onClick={(e: any) => {
                  const form = document.getElementById('txForm') as HTMLFormElement;
                  const event = new Event('submit', { cancelable: true }) as any;
                  handleSaveTx({ ...event, currentTarget: form, preventDefault: () => { } } as any, false);
                }}
                className="bg-[#004a7c] text-white px-8 py-3.5 rounded-full font-bold text-sm shadow-xl hover:bg-[#003a63] transition active:scale-[0.98]"
              >
                Salvar e novo
              </button>
              <button
                type="submit"
                form="txForm"
                className={`text-white px-8 py-3.5 rounded-full font-bold text-sm shadow-xl transition active:scale-[0.98] ${editingTx?.type === 'EXPENSE' ? 'bg-[#f43f5e] hover:bg-[#e11d48]' : 'bg-[#20b2aa] hover:bg-[#1a8e88]'}`}
              >
                Salvar e fechar
              </button>
            </div>
          </div>
        </div>
      )
      }

      {
        isCatModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-10">
              <h3 className="text-xl font-black mb-8 text-slate-900 uppercase tracking-widest">Nova Categoria</h3>
              <form onSubmit={handleSaveCat} className="space-y-6">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nome</label><input required name="name" placeholder="Ex: Manutenção..." defaultValue={editingCat?.name} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cor de Destaque</label><select name="color" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold"><option value="indigo">Índigo</option><option value="emerald">Esmeralda</option><option value="rose">Rosa</option><option value="amber">Âmbar</option><option value="blue">Azul</option><option value="teal">Teal</option></select></div>
                <div className="pt-4 flex gap-4"><button type="button" onClick={() => setIsCatModalOpen(false)} className="flex-1 px-4 py-4 border border-slate-200 rounded-[20px] font-black uppercase text-[10px] tracking-widest">Sair</button><button type="submit" className="flex-1 bg-slate-900 text-white rounded-[20px] font-black uppercase text-[10px] tracking-widest">Criar</button></div>
              </form>
            </div>
          </div>
        )
      }

      {
        isEventModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in zoom-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="bg-sky-500 p-6 flex items-center justify-between text-white">
                <h3 className="text-xl font-black uppercase tracking-widest">Adicionar Evento</h3>
                <button onClick={() => setIsEventModalOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex-[3]">
                    <input
                      required name="title"
                      placeholder="Título do Evento"
                      defaultValue={editingEvent?.title}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none font-bold text-lg focus:border-sky-500 transition"
                    />
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-1 flex items-center">
                    <select name="isPrivate" defaultValue={editingEvent?.isPrivate ? 'true' : 'false'} className="bg-transparent px-3 py-2 w-full text-xs font-black uppercase tracking-widest text-slate-500 outline-none">
                      <option value="false">Público</option>
                      <option value="true">Privado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div className="lg:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Início</label>
                    <input type="date" name="startDate" required defaultValue={editingEvent?.startDate || new Date().toISOString().split('T')[0]} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none" />
                  </div>
                  <div>
                    <input type="time" name="startTime" defaultValue={editingEvent?.startTime || '19:30'} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none" />
                  </div>
                  <div>
                    <input type="time" name="endTime" defaultValue={editingEvent?.endTime || '21:00'} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none" />
                  </div>
                  <div>
                    <input type="date" name="endDate" required defaultValue={editingEvent?.endDate || new Date().toISOString().split('T')[0]} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none" />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="isAllDay" defaultChecked={editingEvent?.isAllDay} className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Dia inteiro</span>
                  </label>
                  <div className="flex-grow">
                    <select name="repeat" defaultValue={editingEvent?.repeat || 'NONE'} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 outline-none">
                      <option value="NONE">Não repetir</option>
                      <option value="DAILY">Diário</option>
                      <option value="WEEKLY">Semanal</option>
                      <option value="MONTHLY">Mensal</option>
                      <option value="YEARLY">Anual</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categoria</label>
                    <select name="categoryId" defaultValue={editingEvent?.categoryId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 outline-none">
                      <option value="">Nenhuma</option>
                      {eventCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Local</label>
                    <input name="location" defaultValue={editingEvent?.location} placeholder="Ex: Templo Principal" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                  </div>
                </div>

                <div className="flex flex-col h-64">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descrição</label>
                  <ReactQuill
                    theme="snow"
                    value={eventDescription}
                    onChange={setEventDescription}
                    modules={quillModules}
                    placeholder="Descreva os detalhes do evento..."
                    className="flex-grow rounded-2xl overflow-hidden border border-slate-200"
                  />
                </div>

                <div className="flex justify-between items-center pt-4">
                  {editingEvent && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(editingEvent.id)}
                      className="text-rose-500 text-[10px] font-black uppercase tracking-widest hover:underline"
                    >
                      Excluir Evento
                    </button>
                  )}
                  <div className="flex-grow"></div>
                  <button type="submit" className="bg-sky-400 text-white px-10 py-3 rounded-full font-black uppercase text-[10px] tracking-widest shadow-xl shadow-sky-100 hover:bg-sky-500 transition transform active:scale-95">
                    {editingEvent ? 'Atualizar' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        isEventCatModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-10">
              <h3 className="text-xl font-black mb-8 text-slate-900 uppercase tracking-widest text-center">Nova Categoria de Evento</h3>
              <form onSubmit={handleSaveEventCat} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nome</label>
                  <input required name="name" placeholder="Ex: Direção Culto..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cor</label>
                  <input type="color" name="color" defaultValue="#6366f1" className="w-full h-12 bg-white border border-slate-200 rounded-xl outline-none p-1 cursor-pointer" />
                </div>
                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setIsEventCatModalOpen(false)} className="flex-1 px-4 py-4 border border-slate-200 rounded-[20px] font-black uppercase text-[10px] tracking-widest">Sair</button>
                  <button type="submit" className="flex-1 bg-sky-500 text-white rounded-[20px] font-black uppercase text-[10px] tracking-widest">Criar</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        isMemberModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl p-10 overflow-y-auto max-h-[90vh]">
              <h3 className="text-2xl font-black mb-8 text-slate-900 tracking-tight">{editingMember ? 'Atualizar Perfil' : 'Cadastrar Membro'}</h3>
              <form onSubmit={handleSaveMember} className="space-y-5">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative h-40 w-40 bg-slate-100 rounded-full border-4 border-white shadow-xl overflow-hidden mb-6 group cursor-move select-none"
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                    onMouseMove={(e) => {
                      if (!isDragging) return;
                      setAvatarPos(prev => ({
                        x: prev.x + e.movementX,
                        y: prev.y + e.movementY
                      }));
                    }}>

                    {(!isAvatarRemoved && (avatarPreview || editingMember?.avatarUrl)) ? (
                      <img
                        ref={avatarRef}
                        src={avatarPreview || editingMember?.avatarUrl}
                        className="absolute max-w-none shadow-inner"
                        style={{
                          transform: `translate(${avatarPos.x}px, ${avatarPos.y}px) scale(${avatarScale})`,
                          top: '50%',
                          left: '50%',
                          marginTop: '-50%',
                          marginLeft: '-50%',
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        draggable={false}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-300">
                        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
                      <span className="text-white text-[10px] font-black uppercase tracking-widest">Arraste para ajustar</span>
                    </div>
                  </div>

                  <div className="w-full max-w-xs space-y-4">
                    {(avatarPreview || editingMember?.avatarUrl) && !isAvatarRemoved && (
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Zoom</span>
                        <input
                          type="range" min="1" max="3" step="0.1"
                          value={avatarScale}
                          onChange={(e) => setAvatarScale(parseFloat(e.target.value))}
                          className="flex-grow accent-indigo-600"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      <input
                        name="avatarFile" type="file" accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setTempAvatarFile(file);
                            setAvatarPreview(URL.createObjectURL(file));
                            setAvatarPos({ x: 0, y: 0 });
                            setAvatarScale(1);
                            setIsAvatarRemoved(false);
                          }
                        }}
                        className="text-xs text-slate-400 file:bg-slate-900 file:text-white file:px-6 file:py-2 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:cursor-pointer w-full"
                      />

                      {(avatarPreview || editingMember?.avatarUrl) && !isAvatarRemoved && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAvatarRemoved(true);
                            setTempAvatarFile(null);
                            setAvatarPreview(null);
                          }}
                          className="text-red-500 text-[10px] font-black uppercase tracking-widest hover:underline text-left px-2"
                        >
                          × Remover Foto Atual
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nome Completo</label><input required name="name" defaultValue={editingMember?.name} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nascimento</label><input type="date" name="birthDate" defaultValue={editingMember?.birthDate} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold" /></div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gênero</label>
                      <select name="gender" defaultValue={editingMember?.gender} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold">
                        <option value="">Selecione...</option>
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                        <option value="OTHER">Outro</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">E-mail</label><input required name="email" type="email" defaultValue={editingMember?.email} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold" /></div>
                {!editingMember && (
                  <div className="bg-indigo-50 p-6 rounded-[24px] border border-indigo-100">
                    <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Senha Temporária</label>
                    <input required name="password" type="password" placeholder="Mínimo 6 caracteres" className="w-full px-6 py-4 bg-white border border-indigo-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" />
                    <p className="mt-2 text-[9px] text-indigo-400 font-bold uppercase tracking-tighter">O usuário poderá alterar esta senha no primeiro login.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Telefone</label><input name="phone" placeholder="(00) 00000-0000" defaultValue={editingMember?.phone} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold" /></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nível de Acesso</label><select name="role" defaultValue={editingMember?.role || UserRole.READER} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold"><option value={UserRole.ADMIN}>Administrador</option><option value={UserRole.TREASURER}>Tesoureiro</option><option value={UserRole.READER}>Membro Comum</option></select></div>
                </div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Endereço</label><input name="address" placeholder="Rua, Número, Bairro..." defaultValue={editingMember?.address} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold" /></div>
                <div className="pt-6 flex gap-4"><button type="button" onClick={() => setIsMemberModalOpen(false)} className="flex-1 px-4 py-4 border border-slate-200 rounded-[20px] font-black uppercase text-[10px] tracking-widest">Fechar</button><button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-[20px] font-black uppercase text-[10px] tracking-widest shadow-xl">Salvar Cadastro</button></div>
              </form>
            </div>
          </div>
        )
      }

      {
        isPostModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-10">
              <h3 className="text-2xl font-black mb-8 text-slate-900 tracking-tight">{editingPost ? 'Editar Publicação' : 'Nova Publicação'}</h3>
              <form onSubmit={handleSavePost} className="space-y-6">
                <input required name="title" placeholder="Título da Publicação" defaultValue={editingPost?.title} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold" />
                <input name="imageUrl" placeholder="URL da Imagem de Destaque" defaultValue={editingPost?.imageUrl} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold" />

                <div className="flex flex-col h-80">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Conteúdo</label>
                  <div className="flex-grow rounded-2xl overflow-hidden border border-slate-200">
                    <ReactQuill
                      theme="snow"
                      value={postContent}
                      onChange={setPostContent}
                      modules={quillModules}
                      placeholder="Escreva sua mensagem aqui..."
                      className="h-full flex flex-col"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setIsPostModalOpen(false)} className="flex-1 px-4 py-4 border border-slate-200 rounded-[20px] font-black uppercase text-[10px] tracking-widest">Voltar</button>
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-[20px] font-black uppercase text-[10px] tracking-widest shadow-xl">Publicar</button>
                </div>
              </form>
            </div>
          </div>
        )
      }
      {
        isChangePasswordModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-10">
              {user.mustChangePassword && (
                <div className="bg-orange-50 p-4 rounded-2xl mb-6 text-orange-700 text-xs font-bold uppercase tracking-tight text-center">
                  Troca de senha obrigatória no primeiro acesso
                </div>
              )}
              <h3 className="text-xl font-black mb-8 text-slate-900 uppercase tracking-widest text-center">Definir Senha</h3>
              <form onSubmit={handleUpdatePassword} className="space-y-6">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nova Senha</label><input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Confirmar</label><input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="pt-4 flex gap-4">
                  {!user.mustChangePassword ? (
                    <button type="button" onClick={() => setIsChangePasswordModalOpen(false)} className="flex-1 px-4 py-4 border border-slate-200 rounded-[20px] font-black uppercase text-[10px] tracking-widest">Sair</button>
                  ) : (
                    <button type="button" onClick={onLogout} className="flex-1 px-4 py-4 border border-red-100 text-red-500 rounded-[20px] font-black uppercase text-[10px] tracking-widest">Sair/Logoff</button>
                  )}
                  <button type="submit" disabled={passwordLoading} className="flex-1 bg-indigo-600 text-white rounded-[20px] font-black uppercase text-[10px] tracking-widest disabled:opacity-50">
                    {passwordLoading ? '...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {isDeptMemberAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10">
            <h3 className="text-xl font-black mb-8 text-slate-900 uppercase tracking-widest text-center">Adicionar Participante</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Membro</label>
                <select
                  value={deptMemberUserId}
                  onChange={(e) => setDeptMemberUserId(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold"
                >
                  <option value="">Selecione um membro...</option>
                  {allUsers.filter(u => !deptMembers.some(m => m.userId === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Funções no Departamento</label>
                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-[20px] border border-slate-200">
                  {deptRoles.length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-bold uppercase w-full text-center py-2">Nenhuma função cadastrada</p>
                  ) : (
                    deptRoles.map(role => (
                      <label key={role.id} className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-100 hover:border-indigo-200 transition">
                        <input
                          type="checkbox"
                          checked={deptMemberRoles.includes(role.name)}
                          onChange={(e) => {
                            if (e.target.checked) setDeptMemberRoles([...deptMemberRoles, role.name]);
                            else setDeptMemberRoles(deptMemberRoles.filter(r => r !== role.name));
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-700">{role.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  onClick={() => setIsDeptMemberAddModalOpen(false)}
                  className="flex-1 px-4 py-4 border border-slate-200 rounded-[20px] font-black uppercase text-[10px] tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveDeptMember}
                  disabled={!deptMemberUserId}
                  className="flex-1 bg-indigo-600 text-white rounded-[20px] font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
