import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  const [postImageSource, setPostImageSource] = useState<'url' | 'file'>('url');
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);

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
  const [isDuplicatingTx, setIsDuplicatingTx] = useState(false);
  const [originalTxDescription, setOriginalTxDescription] = useState('');
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'monthList' | 'weekList'>('month');
  const [calendarCatFilter, setCalendarCatFilter] = useState<string>('ALL');
  const [isEventCatModalOpen, setIsEventCatModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [viewingMember, setViewingMember] = useState<User | null>(null);
  const [viewingMemberSubTab, setViewingMemberSubTab] = useState<'info' | 'finances' | 'edit'>('info');
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // Estados de Escalas
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<any>(null);
  const [scaleFilter, setScaleFilter] = useState<'ALL' | 'MINE'>('ALL');
  const [scaleParticipants, setScaleParticipants] = useState<string[]>([]);

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
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [editingEvCatId, setEditingEvCatId] = useState<string | null>(null);
  const [evCatNameInput, setEvCatNameInput] = useState('');
  const [newEvCatNameInput, setNewEvCatNameInput] = useState('');

  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Estado de Submissão Global
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de Arquivos para Lançamentos
  const [txFiles, setTxFiles] = useState<File[]>([]);
  const [attachedUrls, setAttachedUrls] = useState<string[]>([]);
  const txFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    if (isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileDropdownOpen]);


  // Estados de Membros de Departamento
  const [isDeptMemberAddModalOpen, setIsDeptMemberAddModalOpen] = useState(false);
  const [deptMemberUserId, setDeptMemberUserId] = useState('');
  const [deptMemberRoles, setDeptMemberRoles] = useState<string[]>([]);

  // Estado do Menu Mobile e Sidebar Colapsável
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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

  useEffect(() => {
    if (editingTx) {
      setAttachedUrls(editingTx.attachmentUrls || []);
    } else {
      setAttachedUrls([]);
    }
    setTxFiles([]);
  }, [editingTx]);

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

      const processedCats = cats.map(c => {
        const uppercaseName = c.name.toUpperCase();
        const lowerName = c.name.toLowerCase();
        const expenseKeywords = ['aluguel', 'caesb', 'caeb', 'água', 'agua', 'luz', 'energia', 'internet', 'manutenção', 'manutencao'];

        let type = c.type;
        if ((!type || type === 'INCOME') && expenseKeywords.some(keyword => lowerName.includes(keyword))) {
          type = 'EXPENSE' as const;
        }

        return { ...c, name: uppercaseName, type };
      });

      const processedTxs = txs.map(t => ({
        ...t,
        category: t.category ? t.category.toUpperCase() : 'GERAL'
      }));

      setTransactions(processedTxs);
      setCategories(processedCats);
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
          phone2: p.phone2,

          addressNumber: p.address_number,
          country: p.country,
          categories: p.categories,
          cargos: p.cargos,
          avatarUrl: p.avatar_url,
          gender: p.gender,
          maritalStatus: p.marital_status,
          education: p.education,
          spouseName: p.spouse_name,
          conversionDate: p.conversion_date,
          baptismDate: p.baptism_date,
          isBaptized: p.is_baptized,
          notes: p.notes,
          neighborhood: p.neighborhood,
          city: p.city,
          state: p.state,
          cep: p.cep,
          createdAt: p.created_at,
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

  const uploadFile = async (file: File, bucket: string, folder: string = '') => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  };

  // --- Handlers de Ações ---

  const handleSaveChurchInfo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const logoFile = (e.currentTarget.elements.namedItem('logoFile') as HTMLInputElement)?.files?.[0];

    try {
      let logoUrl = churchInfo.logoUrl;
      if (logoFile) {
        logoUrl = await uploadFile(logoFile, 'avatars', 'church');
      }

      const newInfo: ChurchInfo = {
        name: formData.get('name') as string,
        logoUrl: logoUrl,
        address: formData.get('address') as string,
        phone: formData.get('phone') as string,
        email: formData.get('email') as string,
      };

      await updateChurchInfo(newInfo);
      alert('Informações atualizadas com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error(error);
      alert('Erro ao atualizar informações: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveTx = async (e: React.FormEvent<HTMLFormElement>, closeAfter: boolean = true) => {
    e.preventDefault();
    setIsSubmitting(true); // Feedback imediato

    const form = e.currentTarget;
    const formData = new FormData(form);

    const catName = formData.get('category') as string;
    const catId = categories.find(c => c.name === catName)?.id;

    if (!catId) {
      alert('Categoria inválida. Selecione uma da lista.');
      setIsSubmitting(false);
      return;
    }

    // Upload de Arquivos
    let fileUrls = [...attachedUrls];
    if (txFiles.length > 0) {
      for (const file of txFiles) {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
          let publicUrl = '';

          // Upload para bucket 'avatars' na pasta 'documents' (Bucket padrão geralmente funciona melhor)
          const path = `documents/${fileName}`;
          const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file);

          if (!uploadError) {
            const res = supabase.storage.from('avatars').getPublicUrl(path);
            publicUrl = res.data.publicUrl;
          } else {
            console.error('Erro upload:', uploadError);
            // Tenta root do bucket avatars como fallback
            const { error: err2 } = await supabase.storage.from('avatars').upload(fileName, file);
            if (!err2) {
              const res = supabase.storage.from('avatars').getPublicUrl(fileName);
              publicUrl = res.data.publicUrl;
            } else {
              alert(`Erro ao salvar anexo: ${uploadError.message}`);
            }
          }

          if (publicUrl) fileUrls.push(publicUrl);

        } catch (uploadEx) {
          console.error('Exceção no upload:', uploadEx);
        }
      }
    }

    const txData = {
      description: formData.get('description') as string,
      amount: parseFloat((formData.get('amount') as string).replace(/\./g, '').replace(',', '.')),
      type: formData.get('type') as 'INCOME' | 'EXPENSE',
      category_id: catId,
      date: formData.get('date') as string,
      member_name: (formData.get('member') as string) || null,
      is_paid: formData.get('is_paid') === 'true',
      notes: formData.get('notes') as string,
      // Tenta salvar anexos e outros campos. 
      // Se não existirem no banco, o saveWithRetry vai removê-los automaticamente.
      attachment_urls: fileUrls,
      payment_type: formData.get('payment_type') as string || '�anico', // Default se não tiver no form
      competence: formData.get('competence') as string || null,
    };

    // Função RECURSIVA para salvar e IGNORAR qualquer coluna que não exista no banco
    const saveWithRetry = async (data: any, attempt = 1): Promise<any> => {
      try {
        if (editingTx?.id) {
          const { error } = await supabase.from('transactions').update(data).eq('id', editingTx.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('transactions').insert([data]);
          if (error) throw error;
        }
      } catch (error: any) {
        // DETECTA QUALQUER COLUNA INEXISTENTE (Vários formatos de erro)
        const msg = error.message || '';

        // Regex 1: erro padrão do Postgres (column "xyz" does not exist)
        let match = msg.match(/column "(.+?)"/);

        // Regex 2: erro de Cache do Supabase (Could not find the 'xyz' column)
        if (!match) {
          match = msg.match(/Could not find the '(.+?)' column/);
        }

        const badColumn = match ? match[1] : null;

        if (badColumn && attempt < 15) {
          console.warn(`Banco desatualizado: Coluna '${badColumn}' não existe. Removendo e tentando alternativa...`);

          // Remove a coluna problemática
          const newData = { ...data };
          const badValue = newData[badColumn];
          delete newData[badColumn];

          // Tenta SIN�NIMOS (estratégia de adaptação de schema)
          if (badColumn === 'attachment_urls') newData['attachments'] = badValue;
          else if (badColumn === 'attachments') newData['files'] = badValue;
          else if (badColumn === 'files') newData['file_urls'] = badValue;

          if (badColumn === 'is_paid') newData['paid'] = badValue;
          else if (badColumn === 'paid') newData['status'] = badValue ? 'PAID' : 'PENDING';

          if (badColumn === 'payment_type') newData['payment_method'] = badValue;

          if (badColumn === 'competence') newData['ref_date'] = badValue;

          // Fix for notes not saving: try synonyms
          if (badColumn === 'notes') {
            newData['observation'] = badValue;
          }
          if (badColumn === 'observation') newData['obs'] = badValue;
          if (badColumn === 'obs') newData['memo'] = badValue;
          if (badColumn === 'memo') newData['comments'] = badValue;

          // FINAL FALLBACK: Append to description if no column exists
          if (badColumn === 'comments' && newData['description'] && badValue) {
            newData['description'] = `${newData['description']} | Obs: ${badValue}`;
          }

          // Tenta de novo com a estrutura ajustada
          return saveWithRetry(newData, attempt + 1);
        }

        throw error; // Se não for erro de coluna tratável, estoura o erro real
      }
    };

    try {
      await saveWithRetry(txData);

      if (closeAfter) {
        setIsTxModalOpen(false);
        setIsDuplicatingTx(false);
        setOriginalTxDescription('');
      } else {
        form.reset();
        setTxFiles([]);
        setAttachedUrls([]);
        setIsDuplicatingTx(false);
        setOriginalTxDescription('');
        // Mantém o tipo atual
        const currentType = txData.type;
        setEditingTx({
          type: currentType,
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          category: '',
          description: '',
          costCenter: ''
        } as Transaction);
      }
      fetchData();
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar transação no banco de dados: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCat = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const catData = {
      name: (formData.get('name') as string).toUpperCase(),
      color: formData.get('color') as string || 'indigo',
      type: formData.get('type') as 'INCOME' | 'EXPENSE',
      description: formData.get('description') as string || null,
    };

    try {
      setIsSubmitting(true);

      let success = false;
      let isPartial = false;

      // Tentativa 1: Salvar completo (assumindo que as colunas type e description existem)
      try {
        const { error } = editingCat
          ? await supabase.from('categories').update(catData).eq('id', editingCat.id)
          : await supabase.from('categories').insert([catData]);

        if (error) throw error;
        success = true;
      } catch (err: any) {
        console.warn('Erro ao salvar campos extras (pode ser esquema desatualizado):', err);

        // Se o erro for "Failed to fetch", geralmente é rede e não adianta tentar de novo
        if (err.message && err.message.includes('Failed to fetch')) {
          throw err;
        }

        // Tentativa 2: Fallback (apenas campos básicos garantidos)
        const basicData = { name: catData.name, color: catData.color };
        const { error: error2 } = editingCat
          ? await supabase.from('categories').update(basicData).eq('id', editingCat.id)
          : await supabase.from('categories').insert([basicData]);

        if (error2) throw error2; // Se falhar aqui, desiste
        success = true;
        isPartial = true;
      }

      if (success) {
        setIsCatModalOpen(false);
        setEditingCat(null);
        try {
          form.reset();
        } catch (resetErr) {
          console.warn('Form reset failed:', resetErr);
        }
        await fetchData();

        if (isPartial) {
          alert('Categoria salva, mas campos "Tipo" e "Descrição" foram ignorados pois o banco de dados precisa de atualização (colunas inexistentes).');
        } else {
          alert(editingCat ? 'Categoria atualizada!' : 'Categoria criada com sucesso!');
        }
      }
    } catch (error: any) {
      console.error('Erro ao salvar categoria:', error);
      alert('Erro fatal ao salvar categoria: ' + (error.message || 'Erro de conexão ou permissão'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const name = `${firstName} ${lastName}`.trim();
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
              cep: formData.get('cep') as string,
              city: formData.get('city') as string,
              neighborhood: formData.get('neighborhood') as string,
              state: formData.get('state') as string,
              birth_date: formData.get('birthDate') as string || null,
              gender: formData.get('gender') as string || null,
              marital_status: formData.get('maritalStatus') as string,
              education: formData.get('education') as string,
              spouse_name: formData.get('spouseName') as string,
              conversion_date: formData.get('conversionDate') as string || null,
              baptism_date: formData.get('baptismDate') as string || null,
              is_baptized: formData.get('isBaptized') === 'true',
              phone2: formData.get('phone2') as string,
              address_number: formData.get('addressNumber') as string,
              country: formData.get('country') as string,
              categories: formData.get('categories') as string,
              cargos: formData.get('cargos') as string,
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
      cep: formData.get('cep') as string,
      city: formData.get('city') as string,
      neighborhood: formData.get('neighborhood') as string,
      state: formData.get('state') as string,
      birth_date: formData.get('birthDate') as string || null,
      avatar_url: avatarUrl,
      gender: formData.get('gender') as string || null,
      marital_status: formData.get('maritalStatus') as string,
      education: formData.get('education') as string,
      spouse_name: formData.get('spouseName') as string,
      conversion_date: formData.get('conversionDate') as string || null,
      baptism_date: formData.get('baptismDate') as string || null,
      is_baptized: formData.get('isBaptized') === 'true',
      notes: formData.get('notes') as string,
      phone2: formData.get('phone2') as string,

      address_number: formData.get('addressNumber') as string,
      country: formData.get('country') as string,
      categories: formData.get('categories') as string,
      cargos: formData.get('cargos') as string,
    };

    // Função RECURSIVA para salvar Membro (ignorando colunas faltando)
    const saveMemberWithRetry = async (data: any, attempt = 1): Promise<any> => {
      try {
        const { error } = await supabase.from('profiles').upsert({ id: userId, ...data });
        if (error) throw error;
      } catch (error: any) {
        const msg = error.message || '';
        let match = msg.match(/column "(.+?)"/);
        if (!match) match = msg.match(/Could not find the '(.+?)' column/);

        const badColumn = match ? match[1] : null;

        if (badColumn && attempt < 15) {
          console.warn(`Membro - Coluna '${badColumn}' inexistente. Removendo...`);
          const newData = { ...data };
          delete newData[badColumn];
          return saveMemberWithRetry(newData, attempt + 1);
        }
        throw error;
      }
    };

    try {
      setIsSubmitting(true);
      if (userId) {
        await saveMemberWithRetry(memberData);
      } else {
        alert('Erro: ID do usuário não encontrado.');
        setIsSubmitting(false);
        return;
      }

      setIsMemberModalOpen(false);
      setTempAvatarFile(null);
      setAvatarPreview(null);
      setAvatarPos({ x: 0, y: 0 });
      setAvatarScale(1);
      setIsAvatarRemoved(false);

      await fetchData();
      alert(editingMember ? 'Membro atualizado!' : 'Membro criado!');

      // Se estava vendo este membro, atualiza a view
      if (viewingMember && viewingMember.id === userId) {
        // Recarrega os dados do membro atualizado
        const { data: updatedMember } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (updatedMember) {
          setViewingMember({ ...updatedMember, email }); // Mantém email original pois profiles pode não ter
          setViewingMemberSubTab('info');
        }
      }

    } catch (error: any) {
      console.error('Erro ao salvar membro:', error);
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };




  const handleSavePost = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    let imageUrl = (formData.get('imageUrl') as string) || (editingPost?.imageUrl) || 'https://picsum.photos/seed/church/800/400';

    if (postImageSource === 'file' && postImageFile) {
      try {
        const fileExt = postImageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `post-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars') // Using existing 'avatars' bucket
          .upload(filePath, postImageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      } catch (error) {
        console.error('Error uploading post image:', error);
        alert('Erro ao carregar imagem. Usando URL padrão.');
      }
    }

    const postData = {
      title: formData.get('title') as string,
      content: postContent,
      date: editingPost?.date || new Date().toISOString().split('T')[0],
      image_url: imageUrl,
      is_active: editingPost ? editingPost.isActive : true,
      author_id: user.id
    };

    try {
      setIsSubmitting(true);
      if (editingPost) {
        await supabase.from('posts').update(postData).eq('id', editingPost.id);
      } else {
        await supabase.from('posts').insert([postData]);
      }
      setIsPostModalOpen(false);
      setEditingPost(null);
      setPostContent('');
      setPostImageFile(null);
      setPostImagePreview(null);
      fetchData();
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar postagem: ' + error.message);
    } finally {
      setIsSubmitting(false);
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
      // Atualiza a senha e TAMB�0M limpa o flag must_change_password no metadata
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
      if (error.message && error.message.includes('New password should be different')) {
        alert('Por favor, escolha uma outra senha. Essa já foi usada.');
      } else {
        alert('Erro ao alterar senha: ' + error.message);
      }
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
      setIsSubmitting(true);
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
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar evento: ' + error.message);
    } finally {
      setIsSubmitting(false);
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

  const handleArchiveMember = async () => {
    if (!viewingMember) return;
    // Confirm logic
    if (confirm(`Deseja realmente arquivar o membro ${viewingMember.name}?`)) {
      // Future implementation: await supabase.from('profiles').update({ is_active: false }).eq('id', viewingMember.id);
      alert('Funcionalidade de arquivamento será disponibilizada na próxima atualização do banco de dados (coluna is_active necessária).');
    }
  };

  const handlePrintMember = () => {
    window.print();
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
    setIsSubmitting(true);

    try {
      let bannerUrl = deptBannerUrl;
      let iconUrl = deptIcon;

      // Se as cores forem Base64 (upload local temporário), subir para o Storage
      if (deptBannerUrl.startsWith('data:')) {
        const res = await fetch(deptBannerUrl);
        const blob = await res.blob();
        bannerUrl = await uploadFile(new File([blob], 'banner.jpg', { type: 'image/jpeg' }), 'avatars', 'depts');
      }

      if (deptIcon.startsWith('data:')) {
        const res = await fetch(deptIcon);
        const blob = await res.blob();
        iconUrl = await uploadFile(new File([blob], 'icon.jpg', { type: 'image/jpeg' }), 'avatars', 'depts');
      }

      let deptId = selectedDept?.id;

      if (deptId) {
        const { error } = await supabase.from('departments').update({
          name: deptName,
          description: deptDescription,
          banner_url: bannerUrl,
          icon: iconUrl
        }).eq('id', deptId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('departments').insert([{
          name: deptName,
          description: deptDescription,
          banner_url: bannerUrl,
          icon: iconUrl,
          is_active: true
        }]).select().single();
        if (error) throw error;
        deptId = data.id;
      }

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
    } finally {
      setIsSubmitting(false);
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
    if (confirm('Deseja realmente excluir esta categoria? Eventos vinculados a ela ficarão sem categoria.')) {
      try {
        const { error } = await supabase.from('event_categories').delete().eq('id', id);
        if (error) throw error;
        if (calendarCatFilter === id) setCalendarCatFilter('ALL');
        fetchData();
      } catch (error: any) {
        alert('Erro ao excluir categoria: ' + error.message);
      }
    }
  };

  const handleDeletePost = async (id: string) => {
    if (confirm('Deseja realmente excluir este post?')) {
      await supabase.from('posts').delete().eq('id', id);
      fetchData();
    }
  };

  const handleSaveScale = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const meta = {
        type: editingScale.type,
        participants: scaleParticipants
      };
      const description = JSON.stringify(meta);
      const title = editingScale.title.startsWith('[ESCALA] ') ? editingScale.title : `[ESCALA] ${editingScale.title}`;

      const payload = {
        title,
        description, // JSON stored here
        location: editingScale.location,
        start_date: editingScale.date, // Start Date in DB
        end_date: editingScale.date,   // End Date in DB (same day for now)
        start_time: editingScale.startTime,
        end_time: editingScale.endTime,
        is_all_day: false
      };

      if (editingScale.id) {
        await supabase.from('events').update(payload).eq('id', editingScale.id);
      } else {
        await supabase.from('events').insert([payload]);
      }
      await fetchData();
      setIsScaleModalOpen(false);
    } catch (error: any) {
      alert('Erro ao salvar escala: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCat = async (id: string) => {
    if (confirm('Deseja realmente excluir esta categoria? Transações vinculadas poderão ficar sem categoria.')) {
      try {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
        fetchData();
      } catch (error: any) {
        alert('Erro ao excluir categoria: ' + error.message);
      }
    }
  };

  // --- Lógica de Filtros e Stats ---

  const globalStats = useMemo(() => {
    const today = new Date();
    const currentMonthStr = String(today.getMonth() + 1).padStart(2, '0');
    const currentYearStr = String(today.getFullYear());
    const prefix = `${currentYearStr}-${currentMonthStr}`;

    const monthTxs = transactions.filter(t => t.date.startsWith(prefix));

    const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((acc, c) => acc + c.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, c) => acc + c.amount, 0);

    return {
      income: monthTxs.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0),
      expense: monthTxs.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0),
      balance: totalIncome - totalExpense
    };
  }, [transactions]);

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

  const SidebarItem = ({ icon, label, id, roles, isLogout }: { icon: React.ReactNode, label: string, id: any, roles?: UserRole[], isLogout?: boolean }) => {
    if (roles && !roles.includes(user.role)) return null;

    const isActive = activeTab === id;

    return (
      <button
        onClick={isLogout ? onLogout : () => setActiveTab(id)}
        className={`relative flex items-center transition-all duration-300 group py-3.5 mx-3 rounded-2xl mb-1
          ${isSidebarCollapsed ? 'justify-center px-0 mx-2' : 'px-5 gap-4'}
          ${isActive
            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-900/30 ring-1 ring-white/10'
            : isLogout
              ? 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 mt-auto'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }
        `}
      >
        <div className={`transition-all duration-300 flex-shrink-0 ${isActive ? 'scale-110 text-indigo-100' : 'group-hover:scale-110'} [&_svg]:w-6 [&_svg]:h-6`}>
          {icon}
        </div>
        <span className={`text-[14px] font-bold tracking-wide whitespace-nowrap overflow-hidden transition-all duration-500 ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          {label}
        </span>
        {isActive && !isSidebarCollapsed && (
          <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex print:bg-white text-slate-900 overflow-x-hidden">
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        @media print {
          @page {
            margin: 5mm;
          }
          body * {
            visibility: hidden;
          }
          .printable-modal, .printable-modal * {
            visibility: visible;
          }
          .printable-modal {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            overflow: visible !important;
            margin: 0;
            padding: 0;
            background: white;
            z-index: 9999;
          }
          /* Hide buttons and overlays in print */
          .print-hide, .print\:hidden {
            display: none !important;
          }
        }
      `}</style>
      {/* Sidebar */}
      <aside className={`transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'w-24' : 'w-80'} bg-[#0f172a] flex flex-col hidden lg:flex print:hidden relative overflow-hidden group/sidebar shadow-2xl flex-shrink-0`}>
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-500/10 via-indigo-500/5 to-transparent pointer-events-none"></div>

        <div className={`p-6 border-b border-slate-800/50 flex items-center justify-center relative z-10 transition-all duration-500`}>
          <div className="shrink-0 group-hover/sidebar:scale-105 transition-transform duration-300 flex justify-center">
            <img src={churchInfo.logoUrl || '/logo.png'} className={`object-contain transition-all duration-500 ${isSidebarCollapsed ? 'w-10 h-10' : 'h-14 w-auto max-w-[220px]'}`} alt="Logo" />
          </div>

          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center border-4 border-[#0f172a] shadow-lg transition-all duration-300 opacity-0 group-hover/sidebar:opacity-100 z-50 hover:scale-110 active:scale-95`}
          >
            <svg className={`w-4 h-4 transition-transform duration-500 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <nav className="flex-grow pt-8 overflow-y-auto relative z-10 scrollbar-hide space-y-1 px-2">
          <SidebarItem id="overview" label="Início" icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} />
          <SidebarItem id="finances" label="Financeiro" roles={[UserRole.ADMIN, UserRole.TREASURER]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <SidebarItem id="posts" label="Conteúdo" roles={[UserRole.ADMIN, UserRole.READER]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 20H5a2 2-0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2zM7 8h5m-5 4h10" /></svg>} />
          <SidebarItem id="my_data" label="Dados" roles={[UserRole.READER]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
          <SidebarItem id="members" label="Membros" roles={[UserRole.ADMIN]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
          <SidebarItem id="reports" label="Relatórios" roles={[UserRole.ADMIN, UserRole.TREASURER]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
          <SidebarItem id="agenda" label="Agenda" icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />

          <SidebarItem id="settings" label="Configurações" roles={[UserRole.ADMIN]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />

          <div className="pt-4 mt-4 border-t border-slate-800/50">
            <SidebarItem id="logout" label="Sair do Painel" isLogout icon={
              <svg className="w-6 h-6 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            } />
          </div>
        </nav>

      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-[80%] max-w-[320px] bg-[#0f172a] flex flex-col z-50 lg:hidden transform transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none"></div>

        <div className="p-6 border-b border-slate-800 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-white/10 p-2 rounded-xl border border-white/5 shrink-0">
              <img src={churchInfo.logoUrl || '/logo.png'} className="w-8 h-8 object-contain" alt="Logo" />
            </div>
            <span className="font-black text-lg text-white tracking-tighter truncate">{churchInfo.name}</span>
          </div>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-2 hover:bg-slate-800 rounded-xl transition border border-slate-800 text-slate-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="flex-grow pt-4 overflow-y-auto relative z-10 scrollbar-hide">
          <div onClick={() => setIsMobileSidebarOpen(false)}>
            <SidebarItem id="overview" label="Início" icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} />
            <SidebarItem id="finances" label="Financeiro" roles={[UserRole.ADMIN, UserRole.TREASURER]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <SidebarItem id="posts" label="Conteúdo" roles={[UserRole.ADMIN, UserRole.READER]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2zM7 8h5m-5 4h10" /></svg>} />
            <SidebarItem id="members" label="Membros" roles={[UserRole.ADMIN]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
            <SidebarItem id="reports" label="Relatórios" roles={[UserRole.ADMIN, UserRole.TREASURER]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
            <SidebarItem id="agenda" label="Agenda" icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
            <SidebarItem id="departamentos" label="Departamentos" roles={[UserRole.ADMIN]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
            <SidebarItem id="settings" label="Configurações" roles={[UserRole.ADMIN]} icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />

            <div className="pt-4 mt-4 border-t border-slate-800/50">
              <SidebarItem id="logout" label="Sair do Painel" isLogout icon={
                <svg className="w-6 h-6 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              } />
            </div>
          </div>
        </nav>
      </aside>

      <main className="flex-grow flex flex-col min-w-0 min-h-screen bg-slate-50 print:p-0">
        <header className="h-16 md:h-24 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-10 flex items-center justify-between sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-4">
            {/* Hamburger Menu Button - Mobile Only */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition border border-slate-100"
            >
              <svg className="w-7 h-7 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-lg md:text-2xl font-black text-slate-900">{tabTitles[activeTab]}</h2>
          </div>
          <div className="relative" ref={profileDropdownRef}>
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-4 p-2 pl-4 rounded-2xl hover:bg-slate-50 transition-all duration-300 group"
            >
              <div className="text-right hidden sm:block">
                <p className="font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition">{user.name}</p>
                <p className="text-[10px] text-slate-900 font-black uppercase tracking-widest opacity-60">{user.role}</p>
              </div>
              <div className="relative">
                <img src={user.avatarUrl || `https://i.pravatar.cc/100?u=${user.id}`} className="w-12 h-12 rounded-full border-2 border-indigo-100 shadow-sm group-hover:border-indigo-300 transition-all duration-300" alt="avatar" />
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-slate-100 group-hover:rotate-180 transition-transform duration-500">
                  <svg className="w-3 h-3 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </button>

            {isProfileDropdownOpen && (
              <div className="absolute right-0 mt-4 w-64 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/20 p-3 z-50 animate-in fade-in zoom-in duration-200">
                <div className="px-5 py-4 mb-2 border-b border-slate-50">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Atalho Rápido</p>
                </div>
                {user.role !== UserRole.READER && (
                  <button
                    onClick={() => {
                      setEditingMember(user);
                      setIsMemberModalOpen(true);
                      setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-slate-900 hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-300 group"
                  >
                    <div className="bg-slate-100 p-2 rounded-xl group-hover:bg-indigo-100 transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </div>
                    <span className="font-black text-[10px] uppercase tracking-[0.15em]">Editar Perfil</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsChangePasswordModalOpen(true);
                    setIsProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-slate-900 hover:bg-orange-50 hover:text-orange-600 transition-all duration-300 group"
                >
                  <div className="bg-slate-100 p-2 rounded-xl group-hover:bg-orange-100 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <span className="font-black text-[10px] uppercase tracking-[0.15em]">Alterar Senha</span>
                </button>
                <div className="h-2"></div>
                <button
                  onClick={() => {
                    onLogout();
                    setIsProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-rose-600 hover:bg-rose-50 transition-all duration-300 group"
                >
                  <div className="bg-rose-50 p-2 rounded-xl group-hover:bg-rose-100 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </div>
                  <span className="font-black text-[10px] uppercase tracking-[0.15em]">Sair</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="p-4 pb-24 md:p-10 print:p-0">
          {activeTab === 'overview' && (
            <div className="space-y-8 md:space-y-10 animate-slide-up">
              {/* Demographics Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Membros Totais', value: demographics.total, icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, bg: 'bg-indigo-50', text: 'text-indigo-600' },
                  { label: 'Público Masculino', value: `${demographics.menPercent}%`, icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>, bg: 'bg-sky-50', text: 'text-sky-600' },
                  { label: 'Público Feminino', value: `${demographics.womenPercent}%`, icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>, bg: 'bg-rose-50', text: 'text-rose-600' }
                ].map((card, i) => (
                  <div key={i} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`${card.bg} ${card.text} p-4 rounded-2xl transition-transform group-hover:scale-110 duration-300`}>
                        {card.icon}
                      </div>
                      <div className="h-1 w-12 bg-slate-100 rounded-full"></div>
                    </div>
                    <h5 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">{card.value}</h5>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em]">{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Grid com Financeiro e Agenda */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                {/* Coluna Esquerda - Financeiro */}
                <div className="lg:col-span-7 space-y-6 md:space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Entradas do Mês</p>
                      <p className="text-4xl font-black text-emerald-600 tracking-tighter">{formatCurrency(globalStats.income)}</p>
                      <div className="absolute -right-4 -bottom-4 bg-emerald-50 w-24 h-24 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500"></div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Saídas do Mês</p>
                      <p className="text-4xl font-black text-rose-600 tracking-tighter">{formatCurrency(globalStats.expense)}</p>
                      <div className="absolute -right-4 -bottom-4 bg-rose-50 w-24 h-24 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                    </div>
                  </div>
                  <div className="bg-[#4f46e5] px-8 py-7 rounded-[32px] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-200 animate-pulse"></div>
                        <p className="text-indigo-100 font-bold text-[9px] uppercase tracking-[0.2em]">Saldo Disponível em Caixa</p>
                      </div>
                      <p className="text-4xl md:text-5xl font-black tracking-tighter">{formatCurrency(globalStats.balance)}</p>
                    </div>
                  </div>

                  {/* Gráfico de Pizza */}
                  <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[32px] shadow-sm border border-slate-100">
                    <h4 className="text-slate-900 font-bold mb-6 text-lg md:text-base">Receitas vs Despesas</h4>
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
                  <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[32px] border border-slate-100 shadow-sm lg:sticky lg:top-24">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-sky-100 p-2 rounded-xl text-sky-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <h3 className="text-xl md:text-xl font-black text-slate-800 tracking-tight">Agenda do Mês</h3>
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
                            <div key={event.id} onClick={() => { setEditingEvent(event); setIsEventModalOpen(true); }} className="bg-white p-3 md:p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-300 group cursor-pointer">
                              <div className="flex gap-4 md:gap-5">
                                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-2 min-w-[55px] md:min-w-[65px] border border-slate-100 relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: eventCat?.color || '#6366f1' }}></div>
                                  <span className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter">{day}</span>
                                  <span className="text-[10px] md:text-[9px] font-black text-indigo-500 uppercase">{month}</span>
                                </div>
                                <div className="flex-grow">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition text-lg md:text-sm">{event.title}</h4>
                                    {eventCat && (
                                      <div
                                        className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                                        style={{ backgroundColor: eventCat.color }}
                                      ></div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 mt-2 text-base md:text-[10px] text-slate-500">
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
              <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-pink-100 p-3 rounded-xl text-pink-600">
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.464 15.05a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0z" /></svg>
                  </div>
                  <h3 className="text-2xl md:text-xl font-black text-slate-800 tracking-tight">Aniversariantes do Mês</h3>
                </div>
                {birthdayMembers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {birthdayMembers.map(m => (
                      <div key={m.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3 hover:shadow-md transition">
                        <img src={m.avatarUrl || `https://i.pravatar.cc/100?u=${m.id}`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="Membro" />
                        <div>
                          <p className="font-bold text-slate-900 leading-tight text-sm md:text-sm">{m.name}</p>
                          <p className="text-[9px] text-indigo-600 font-black uppercase mt-0.5">Dia {m.birthDate!.split('-')[2]}</p>
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
            <div className="space-y-8 animate-slide-up">
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
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 -ml-20 text-[10px] font-black text-slate-900 uppercase tracking-widest">Pesquisar</span>
                        <input
                          type="text"
                          placeholder="Ex: Nome, descrição..."
                          className="w-64 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={txSearchTerm}
                          onChange={(e) => setTxSearchTerm(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-2">
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

                  {/* Transactions Table & Mobile Cards */}
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                    {/* Desktop View Table */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4 w-10 text-center uppercase tracking-widest">
                              <input type="checkbox" className="rounded border-slate-300 text-indigo-600" />
                            </th>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Descrição</th>
                            <th className="px-6 py-4 text-center">Total</th>
                            <th className="px-6 py-4 text-left">QUEM</th>
                            <th className="px-6 py-4">Categoria</th>
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
                                <div className="font-bold text-slate-700 text-xs tracking-tight uppercase">{t.description.split(' | Obs: ')[0]}</div>
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
                              <td className="px-6 py-4 text-left text-slate-500 text-[10px] font-black uppercase">{t.member || ''}</td>
                              <td className="px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-tight">{t.category}</td>
                              <td className="px-6 py-4">
                                <div className="flex justify-center gap-3 transition">
                                  <button onClick={() => {
                                    const parts = t.description.split(' | Obs: ');
                                    const realDesc = parts[0];
                                    const realNotes = parts.length > 1 ? parts.slice(1).join(' | Obs: ') : (t.notes || '');
                                    setEditingTx({ ...t, description: realDesc, notes: realNotes });
                                    setIsTxModalOpen(true);
                                  }} className="p-1.5 text-slate-400 hover:text-indigo-600 transition" title="Editar"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                  <button onClick={() => {
                                    const parts = t.description.split(' | Obs: ');
                                    const cleanDesc = parts[0];
                                    const realNotes = parts.length > 1 ? parts.slice(1).join(' | Obs: ') : (t.notes || '');

                                    setOriginalTxDescription(cleanDesc);
                                    setIsDuplicatingTx(true);
                                    const newDescription = cleanDesc.includes(' - Cópia') ? cleanDesc : cleanDesc + ' - Cópia';
                                    setEditingTx({ ...t, id: undefined, description: newDescription, notes: realNotes });
                                    setIsTxModalOpen(true);
                                  }} className="p-1.5 text-slate-400 hover:text-indigo-600 transition" title="Duplicar"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg></button>
                                  <button onClick={() => handleDeleteTx(t.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition" title="Excluir"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden divide-y divide-slate-100">
                      {filteredTransactions.map(t => (
                        <div key={t.id} className="p-4 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{t.date.split('-').reverse().join('/')}</p>
                              <h4 className="font-bold text-slate-800 text-sm leading-tight uppercase">{t.description.split(' | Obs: ')[0]}</h4>
                            </div>
                            <div className={`font-black text-sm ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {t.type === 'INCOME' ? '' : '-'}{formatCurrency(t.amount)}
                            </div>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-black uppercase tracking-widest">{t.category}</span>
                            <div className="flex gap-4">
                              <button onClick={() => {
                                const parts = t.description.split(' | Obs: ');
                                const realDesc = parts[0];
                                const realNotes = parts.length > 1 ? parts.slice(1).join(' | Obs: ') : (t.notes || '');
                                setEditingTx({ ...t, description: realDesc, notes: realNotes });
                                setIsTxModalOpen(true);
                              }} className="text-indigo-600 font-black text-[10px] uppercase">Editar</button>
                              <button onClick={() => {
                                setOriginalTxDescription(t.description);
                                setIsDuplicatingTx(true);
                                const newDescription = t.description.includes(' - Cópia') ? t.description : t.description + ' - Cópia';
                                setEditingTx({ ...t, id: undefined, description: newDescription });
                                setIsTxModalOpen(true);
                              }} className="text-indigo-600 font-black text-[10px] uppercase">Duplicar</button>
                              <button onClick={() => handleDeleteTx(t.id)} className="text-red-500 font-black text-[10px] uppercase">Excluir</button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {filteredTransactions.length === 0 && (
                        <div className="p-10 text-center text-slate-400 italic">Nenhuma transação encontrada.</div>
                      )}
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
                        <h4 className="text-white font-black uppercase text-sm tracking-widest">Receitas ({categories.filter(c => (c.type || 'INCOME') === 'INCOME').length})</h4>
                      </div>
                      <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <form onSubmit={handleSaveCat} className="flex gap-2">
                          <input type="hidden" name="type" value="INCOME" />
                          <input
                            required
                            name="name"
                            placeholder="+ Nova Receita (Dizimo, Oferta...)"
                            className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none font-bold text-[11px] placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500"
                          />
                          <button type="submit" className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-emerald-600 transition shadow-sm">
                            Criar
                          </button>
                        </form>
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
                            {categories.filter(c => (c.type || 'INCOME') === 'INCOME').map(cat => (
                              <tr key={cat.id} className="hover:bg-slate-50 transition group">
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full bg-${cat.color}-500 flex-shrink-0 animate-pulse`}></div>
                                    <div className="font-bold text-slate-700 text-xs tracking-tight">{cat.name}</div>
                                  </div>
                                  {cat.description && <div className="text-[10px] text-slate-400">{cat.description}</div>}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button onClick={() => { setEditingCat(cat); setIsCatModalOpen(true); }} className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition">Editar</button>
                                    <button onClick={() => handleDeleteCat(cat.id)} className="border border-rose-200 text-rose-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 transition">Remover</button>
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
                        <h4 className="text-white font-black uppercase text-sm tracking-widest">Despesas ({categories.filter(c => (c.type || 'EXPENSE') === 'EXPENSE').length})</h4>
                      </div>
                      <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <form onSubmit={handleSaveCat} className="flex gap-2">
                          <input type="hidden" name="type" value="EXPENSE" />
                          <input
                            required
                            name="name"
                            placeholder="+ Nova Despesa (Aluguel, Luz...)"
                            className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none font-bold text-[11px] placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500"
                          />
                          <button type="submit" className="bg-rose-500 text-white px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-rose-600 transition shadow-sm">
                            Criar
                          </button>
                        </form>
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
                            {categories.filter(c => (c.type || 'EXPENSE') === 'EXPENSE').map(cat => (
                              <tr key={cat.id} className="hover:bg-slate-50 transition group">
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full bg-${cat.color}-500 flex-shrink-0 animate-pulse`}></div>
                                    <div className="font-bold text-slate-700 text-xs tracking-tight">{cat.name}</div>
                                  </div>
                                  {cat.description && <div className="text-[10px] text-slate-400">{cat.description}</div>}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button onClick={() => { setEditingCat(cat); setIsCatModalOpen(true); }} className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition">Editar</button>
                                    <button onClick={() => handleDeleteCat(cat.id)} className="border border-rose-200 text-rose-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 transition">Remover</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>


                </div>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-8 animate-slide-up">
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
                  <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Gerenciar Membros</h3>
                    <button onClick={() => { setEditingMember(null); setIsMemberModalOpen(true); }} className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition">+ Novo Cadastro</button>
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left min-w-[1000px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="px-8 py-5 w-20">Avatar</th>
                          <th className="px-8 py-5">Nome Completo</th>
                          <th className="px-8 py-5">Nascimento</th>
                          <th className="px-8 py-5">Idade</th>
                          <th className="px-8 py-5">Sexo</th>
                          <th className="px-8 py-5">Contato</th>
                          <th className="px-8 py-5">Cidade</th>
                          <th className="px-8 py-5 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allUsers.map((u, index) => (
                          <tr key={u.id} className={`transition group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/30 cursor-pointer`} onClick={() => setViewingMember(u)}>
                            <td className="px-8 py-4">
                              <img
                                src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                                className="w-11 h-11 rounded-full border-2 border-white shadow-sm object-cover"
                              />
                            </td>
                            <td className="px-8 py-4">
                              <div className="font-bold text-indigo-900 text-sm tracking-tight">{u.name}</div>
                              <div className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{u.email}</div>
                            </td>
                            <td className="px-8 py-4 text-slate-500 text-xs font-bold whitespace-nowrap">
                              {u.birthDate ? u.birthDate.split('-').reverse().join('/') : '-'}
                            </td>
                            <td className="px-8 py-4 text-slate-500 text-xs font-bold">
                              {u.birthDate ? calculateAge(u.birthDate) : '-'}
                            </td>
                            <td className="px-8 py-4 text-slate-500 text-[10px] font-black uppercase">
                              {u.gender === 'M' ? 'Masculino' : u.gender === 'F' ? 'Feminino' : '-'}
                            </td>
                            <td className="px-8 py-4 text-slate-500 text-xs font-medium">
                              {u.phone || '-'}
                            </td>
                            <td className="px-8 py-4 text-slate-500 text-xs font-medium">
                              {u.city || '-'}
                            </td>
                            <td className="px-8 py-4 text-center">
                              <div className="flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => {
                                  setViewingMember(u);
                                  setEditingMember(u);
                                  setViewingMemberSubTab('edit');
                                  setAvatarPreview(null);
                                  setTempAvatarFile(null);
                                  setIsAvatarRemoved(false);
                                }} className="text-indigo-600 font-black text-[10px] uppercase hover:underline">Editar</button>
                                <button onClick={() => handleDeleteMember(u.id)} className="text-red-600 font-black text-[10px] uppercase hover:underline">Remover</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="lg:hidden divide-y divide-slate-100">
                    {allUsers.map(u => (
                      <div key={u.id} className="p-4 flex items-center gap-4">
                        <img
                          src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                          className="w-12 h-12 rounded-full border border-slate-100 shadow-sm"
                        />
                        <div className="flex-grow min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{u.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-500">{u.role}</span>
                            <span className="text-[10px] text-slate-300">⬢</span>
                            <span className="text-[10px] text-slate-500 truncate">{u.email}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button onClick={() => {
                            setViewingMember(u);
                            setEditingMember(u);
                            setViewingMemberSubTab('edit');
                            setAvatarPreview(null);
                            setTempAvatarFile(null);
                            setIsAvatarRemoved(false);
                          }} className="text-indigo-600 font-black text-[9px] uppercase">Editar</button>
                          <button onClick={() => handleDeleteMember(u.id)} className="text-red-500 font-black text-[9px] uppercase">Remover</button>
                        </div>
                      </div>
                    ))}
                    {allUsers.length === 0 && (
                      <div className="p-10 text-center text-slate-400 italic font-medium">Nenhum membro cadastrado.</div>
                    )}
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
                <div className="space-y-8 animate-slide-up">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {demographicsData.map((item, index) => (
                      <div key={index} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-lg transition group relative overflow-hidden cursor-pointer" onClick={() => setMemberSubTab('list')}>
                        <div className="absolute top-0 left-0 w-2 h-full transition-all group-hover:w-3" style={{ backgroundColor: item.color }}></div>
                        <div className="pl-4">
                          <div className="flex justify-between items-start mb-6">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full group-hover:bg-slate-100 transition">{item.range}</span>
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                            </div>
                          </div>
                          <h4 className="text-base font-bold text-slate-600 mb-1">{item.name}</h4>
                          <p className="text-4xl font-black text-slate-900 group-hover:scale-105 origin-left transition duration-300">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}


            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8 animate-slide-up">
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 print:hidden">
                <div className="flex justify-between items-center mb-10"><h3 className="text-xl font-black text-slate-900 tracking-tight">Filtros Avançados</h3><button onClick={() => window.print()} className="bg-indigo-600 text-white px-8 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Imprimir Relatório</button></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Data Inicial</label><input type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-black font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={reportFilters.startDate} onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })} /></div>
                  <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Data Final</label><input type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-black font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={reportFilters.endDate} onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })} /></div>
                  <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Fluxo</label><select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-black font-bold outline-none" value={reportFilters.type} onChange={(e) => setReportFilters({ ...reportFilters, type: e.target.value })}><option value="ALL">Todos os Fluxos</option><option value="INCOME">Entradas (+)</option><option value="EXPENSE">Saídas (-)</option></select></div>
                  <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Categoria</label><select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-black font-bold outline-none" value={reportFilters.category} onChange={(e) => setReportFilters({ ...reportFilters, category: e.target.value })}><option value="ALL">Todas</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                  <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Membro</label><select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-black font-bold outline-none" value={reportFilters.member} onChange={(e) => setReportFilters({ ...reportFilters, member: e.target.value })}><option value="ALL">Todos</option>{Array.from(new Set(transactions.map(t => t.member).filter(Boolean))).map(m => <option key={m} value={m}>{m}</option>)}</select></div>
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
            <div className="space-y-8 animate-slide-up">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Conteúdo Web</h3>
                {user.role !== UserRole.READER && (
                  <button onClick={() => { setEditingPost(null); setPostImageFile(null); setPostImagePreview(null); setPostImageSource('url'); setIsPostModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition">+ Novo Conteúdo</button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map(post => (
                  <div key={post.id} className={`bg-white rounded-[40px] overflow-hidden shadow-sm border border-slate-100 group flex flex-col transition-all ${!post.isActive ? 'opacity-50 grayscale' : ''}`}>
                    <img src={post.imageUrl} className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105" alt={post.title} />
                    <div className="p-8 flex-grow">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{post.date}</span>
                        {!post.isActive && <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">Inativo</span>}
                      </div>
                      <h4 className="font-black text-slate-900 text-lg mb-2 leading-tight">{post.title}</h4>
                      <p className="text-slate-500 text-sm line-clamp-2 mb-8 leading-relaxed font-medium">
                        {post.content.replace(/<[^>]*>/g, '')}
                      </p>
                      {user.role !== UserRole.READER && (
                        <div className="flex gap-4 pt-6 border-t border-slate-50">
                          <button onClick={() => { setEditingPost(post); setPostImageFile(null); setPostImagePreview(null); setPostImageSource('url'); setIsPostModalOpen(true); }} className="text-indigo-600 font-black text-[10px] uppercase hover:underline">Editar</button>
                          <button onClick={() => togglePostVisibility(post.id)} className={`${post.isActive ? 'text-orange-500' : 'text-emerald-500'} font-black text-[10px] uppercase hover:underline`}>{post.isActive ? 'Ocultar' : 'Exibir'}</button>
                          <button onClick={() => handleDeletePost(post.id)} className="text-red-500 font-black text-[10px] uppercase hover:underline">Excluir</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'my_data' && ((() => {
            const viewingMember = user; return (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 lg:p-10 animate-in fade-in duration-300 printable-modal print:items-start print:pt-0 print:p-0">
                <div className="bg-[#f8f9fc] w-full max-w-6xl h-full rounded-[40px] shadow-2xl flex flex-col overflow-hidden print:overflow-visible print:h-auto print:rounded-none print:shadow-none px-4">
                  {/* Profile Header */}
                  <div className={`bg-white px-10 py-8 border-b border-slate-100 flex items-center gap-8 relative shrink-0 ${viewingMemberSubTab === 'finances' ? 'print:hidden' : ''}`}>
                    <div className={`w-36 h-36 rounded-3xl overflow-hidden border-4 border-white shadow-xl shrink-0 relative group ${viewingMemberSubTab === 'edit' ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (viewingMemberSubTab === 'edit') {
                          const fileInput = document.getElementById('viewingMemberAvatarInput') as HTMLInputElement;
                          fileInput?.click();
                        }
                      }}>
                      {viewingMemberSubTab === 'edit' ? (
                        <>
                          {(!isAvatarRemoved && (avatarPreview || editingMember?.avatarUrl)) ? (
                            <img
                              src={avatarPreview || editingMember?.avatarUrl}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-slate-50 flex items-center justify-center text-slate-300">
                              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center flex-col gap-2">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            <span className="text-white text-[9px] font-black uppercase tracking-widest text-center px-2">Alterar Foto</span>
                          </div>
                          {(!isAvatarRemoved && (avatarPreview || editingMember?.avatarUrl)) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsAvatarRemoved(true);
                                setAvatarPreview(null);
                                setTempAvatarFile(null);
                              }}
                              className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-lg shadow-lg hover:bg-rose-600 transition"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </>
                      ) : (
                        <img src={viewingMember.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingMember.name)}&background=random`} className="w-full h-full object-cover" />
                      )}
                      <input
                        id="viewingMemberAvatarInput"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setTempAvatarFile(file);
                            setAvatarPreview(URL.createObjectURL(file));
                            setIsAvatarRemoved(false);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-grow">
                      <h2 className="text-3xl font-black text-slate-800 tracking-tight">{viewingMember.name}</h2>
                      <div className="flex flex-wrap gap-4 mt-3">
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> {viewingMember.city || 'Cidade não inf.'}</span>
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {viewingMember.phone || 'Sem telefone'}</span>
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> {viewingMember.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`flex gap-2 print:hidden ${['finances', 'edit'].includes(viewingMemberSubTab) ? 'hidden' : ''}`}>
                        {/* <button onClick={handleArchiveMember} className="bg-rose-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 transition hover:bg-rose-600">Arquivar</button> */}
                        <button onClick={handlePrintMember} className="bg-[#004a7c] text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 flex items-center gap-2 hover:bg-[#003a63] transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          Imprimir
                        </button>
                      </div>
                      <button onClick={() => setActiveTab('overview')} className="p-3 text-slate-400 hover:text-slate-600 transition print:hidden"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                  </div>

                  {/* Internal Tabs */}
                  <div className={`bg-white px-10 border-b border-slate-100 flex gap-8 shrink-0 print:hidden ${viewingMemberSubTab === 'finances' ? 'print:hidden' : ''}`}>
                    <button onClick={() => setViewingMemberSubTab('info')} className={`py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${viewingMemberSubTab === 'info' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Informações</button>
                    <button onClick={() => setViewingMemberSubTab('finances')} className={`py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${viewingMemberSubTab === 'finances' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Financeiro</button>
                    {user.role !== UserRole.READER && (
                      <button onClick={() => {
                        setEditingMember(viewingMember);
                        setViewingMemberSubTab('edit');
                        setAvatarPreview(null);
                        setTempAvatarFile(null);
                        setIsAvatarRemoved(false);
                      }} className={`py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${viewingMemberSubTab === 'edit' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Editar</button>
                    )}
                  </div>

                  {/* Profile Content Area */}
                  <div className="flex-grow overflow-y-auto p-10 bg-[#f8f9fc] print:bg-white print:p-0 print:overflow-visible print:h-auto">
                    {viewingMemberSubTab === 'info' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up">
                        <div className="space-y-8">
                          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Dados Pessoais</h4>
                            </div>
                            <div className="space-y-4">
                              <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Nome Completo</span> <span className="text-xs font-bold text-slate-700">{viewingMember.name}</span></div>
                              <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Nascimento</span> <span className="text-xs font-bold text-slate-700">{viewingMember.birthDate ? `${viewingMember.birthDate.split('-').reverse().join('/')} (${calculateAge(viewingMember.birthDate)} anos)` : '-'}</span></div>
                              <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Gênero</span> <span className="text-xs font-bold text-slate-700">{viewingMember.gender === 'M' ? 'Masculino' : viewingMember.gender === 'F' ? 'Feminino' : '-'}</span></div>
                              <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Escolaridade</span> <span className="text-xs font-bold text-slate-700">{viewingMember.education || '-'}</span></div>
                              <div className="flex justify-between pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Estado Civil</span> <span className="text-xs font-bold text-slate-700">{viewingMember.maritalStatus || '-'}</span></div>
                            </div>
                          </div>

                          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Outras Informações</h4>
                            </div>
                            <div className="space-y-4">
                              <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Cônjuge</span> <span className="text-xs font-bold text-slate-700">{viewingMember.spouseName || '-'}</span></div>
                              <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Conversão</span> <span className="text-xs font-bold text-slate-700">{viewingMember.conversionDate ? viewingMember.conversionDate.split('-').reverse().join('/') : '-'}</span></div>
                              <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Batizado</span> <span className="text-xs font-bold text-slate-700">{viewingMember.isBaptized ? 'Sim' : 'Não'}</span></div>
                              <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Batismo</span> <span className="text-xs font-bold text-slate-700">{viewingMember.baptismDate ? viewingMember.baptismDate.split('-').reverse().join('/') : '-'}</span></div>
                              <div className="flex justify-between pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Cadastrado em</span> <span className="text-xs font-bold text-slate-700">{viewingMember.createdAt ? new Date(viewingMember.createdAt).toLocaleDateString('pt-BR') : '-'}</span></div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-1.5 h-6 bg-sky-500 rounded-full"></div>
                              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Contatos & Endereço</h4>
                            </div>
                            <div className="space-y-4">
                              <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">E-mail</span> <span className="text-xs font-bold text-slate-700">{viewingMember.email}</span></div>
                              <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Telefone</span> <span className="text-xs font-bold text-slate-700">{viewingMember.phone || '-'}</span></div>
                              <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Localização</div>
                                <div className="text-xs font-bold text-slate-600 leading-relaxed">
                                  {viewingMember.address || 'Sem endereço'}<br />
                                  {viewingMember.neighborhood && `${viewingMember.neighborhood}, `}{viewingMember.city && `${viewingMember.city} - ${viewingMember.state || ''}`}<br />
                                  {viewingMember.cep && `CEP: ${viewingMember.cep}`}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-1.5 h-6 bg-slate-800 rounded-full"></div>
                              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Anotações</h4>
                            </div>
                            <p className="text-xs font-medium text-slate-500 italic leading-relaxed">
                              {viewingMember.notes || 'Nenhuma observação interna registrada.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {viewingMemberSubTab === 'finances' && (
                      <div className="space-y-6 animate-slide-up">
                        {/* Finance Toolbar */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{transactions.filter(t => t.member === viewingMember.name).length} lançamentos</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Action Buttons */}


                            {/* Export Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const memberTxs = transactions.filter(t => t.member === viewingMember.name);
                                  const csvContent = "data:text/csv;charset=utf-8,"
                                    + "Data,Nome,Descrição,Categoria,Tipo,Valor,Status\n"
                                    + memberTxs.map(t => `${t.date},${t.member},${t.description},${t.category},${t.type},${t.amount},${t.isPaid ? 'Pago' : 'Pendente'}`).join("\n");
                                  const encodedUri = encodeURI(csvContent);
                                  const link = document.createElement("a");
                                  link.setAttribute("href", encodedUri);
                                  link.setAttribute("download", `extrato_${viewingMember.name.replace(/\s+/g, '_').toLowerCase()}.csv`);
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                className="bg-slate-800 text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-700 transition"
                                title="Exportar CSV"
                              >
                                CSV
                              </button>
                              <button
                                onClick={() => {
                                  const memberTxs = transactions.filter(t => t.member === viewingMember.name);
                                  const total = memberTxs.reduce((acc, t) => t.type === 'INCOME' ? acc + t.amount : acc - t.amount, 0);

                                  let html = `
                                 <html>
                                   <head>
                                     <meta charset="utf-8">
                                     <style>body{font-family:sans-serif;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:8px;} th{background-color:#f2f2f2;}</style>
                                   </head>
                                   <body>
                                     <h3>Extrato: ${viewingMember.name}</h3>
                                     <table>
                                       <thead><tr><th>Data</th><th>Nome</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th></tr></thead>
                                       <tbody>
                                         ${memberTxs.map(t => `<tr><td>${t.date}</td><td>${t.member}</td><td>${t.description}</td><td>${t.category}</td><td>${t.type === 'INCOME' ? 'Receita' : 'Despesa'}</td><td>${t.type === 'EXPENSE' ? '-' : ''}${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
                                         <tr>
                                           <td colspan="5" style="text-align:right;font-weight:bold;">Saldo Total</td>
                                           <td style="font-weight:bold;color:${total >= 0 ? 'green' : 'red'}">${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                         </tr>
                                       </tbody>
                                     </table>
                                   </body>
                                 </html>
                               `;
                                  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `extrato_${viewingMember.name.replace(/\s+/g, '_').toLowerCase()}.xls`;
                                  a.click();
                                }}
                                className="bg-[#1D6F42] text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#155232] transition"
                                title="Exportar Excel"
                              >
                                Excel
                              </button>
                              <button
                                onClick={() => {
                                  const style = document.createElement('style');
                                  style.innerHTML = `@media print { @page { size: landscape; margin: 10mm; } }`;
                                  document.head.appendChild(style);
                                  window.print();
                                  setTimeout(() => { if (document.head.contains(style)) document.head.removeChild(style); }, 2000);
                                }}
                                className="bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-300 transition"
                                title="Imprimir / Salvar PDF"
                              >
                                PDF/Print
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden print:shadow-none print:border-none print:rounded-none">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-8 py-5 flex items-center gap-2">
                                  Data
                                  <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                                </th>
                                <th className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                    Nome
                                    <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                                  </div>
                                </th>
                                <th className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                    Descrição
                                    <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                                  </div>
                                </th>
                                <th className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                    Categoria
                                    <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                                  </div>
                                </th>
                                <th className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                    Arquivos
                                    <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                                  </div>
                                </th>
                                <th className="px-8 py-5 text-right flex items-center justify-end gap-2">
                                  Total
                                  <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {transactions.filter(t => t.member === viewingMember.name).map(t => (
                                <tr key={t.id} className="hover:bg-slate-50 transition group">
                                  <td className="px-8 py-5 text-[11px] font-bold text-slate-500">{t.date.split('-').reverse().join('/')}</td>
                                  <td className="px-8 py-5 text-[11px] font-bold text-slate-700">{t.member}</td>
                                  <td className="px-8 py-5 text-[11px] font-bold text-slate-700">{t.description}</td>
                                  <td className="px-8 py-5 text-[11px] font-bold text-slate-500">{t.category}</td>
                                  <td className="px-8 py-5">
                                    {t.attachmentUrls && t.attachmentUrls.length > 0 ? (
                                      <a href={t.attachmentUrls[0]} target="_blank" rel="noopener noreferrer" className="inline-block hover:scale-110 transition-transform" title="Ver anexo">
                                        <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.414a6 6 0 108.486 8.486L20.5 13" /></svg>
                                      </a>
                                    ) : (
                                      <span title="Sem anexo">
                                        <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-8 py-5 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                      <span className={`text-[11px] font-black ${t.type === 'INCOME' ? 'text-slate-700' : 'text-rose-500'}`}>
                                        {t.type === 'EXPENSE' && '- '}{formatCurrency(t.amount)}
                                      </span>
                                      <div className="w-4 h-4 bg-emerald-500 rounded flex items-center justify-center">
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200">
                              {/* Total Calculation Row */}
                              {(() => {
                                const memberTxs = transactions.filter(t => t.member === viewingMember.name);
                                const totalIncome = memberTxs.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
                                const totalExpense = memberTxs.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
                                const balance = totalIncome - totalExpense;

                                return (
                                  <tr>
                                    <td colSpan={5} className="px-8 py-5 text-right font-black text-xs text-slate-500 uppercase tracking-widest">Saldo Total</td>
                                    <td className="px-8 py-5 text-right">
                                      <span className={`text-xl font-black ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(balance)}</span>
                                    </td>
                                  </tr>
                                );
                              })()}
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {viewingMemberSubTab === 'edit' && (
                      <div className="animate-slide-up pb-10">
                        <form onSubmit={handleSaveMember} className="space-y-10">


                          {/* Wide Form Layout (2 columns) */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {/* Left Column */}
                            <div className="space-y-10">
                              {/* Dados pessoais Card */}
                              <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2">
                                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Dados pessoais</h4>
                                </div>
                                <div className="p-8 space-y-6">
                                  <div className="grid grid-cols-2 gap-6">
                                    <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Nome</label><input required name="firstName" defaultValue={editingMember?.name?.split(' ')[0]} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Sobrenome</label><input required name="lastName" defaultValue={editingMember?.name?.split(' ').slice(1).join(' ')} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Senha</label>
                                    <div className="relative">
                                      <input name="password" type="password" placeholder="Para não alterar, deixe em branco" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" />
                                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-6">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Data de nascimento</label>
                                      <div className="relative group">
                                        <input type="date" name="birthDate" defaultValue={editingMember?.birthDate} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Sexo</label>
                                      <div className="flex gap-4 py-2">
                                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="gender" value="M" defaultChecked={editingMember?.gender === 'M'} className="w-4 h-4 text-teal-600" /><span className="text-xs font-bold text-slate-700">Masculino</span></label>
                                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="gender" value="F" defaultChecked={editingMember?.gender === 'F'} className="w-4 h-4 text-teal-600" /><span className="text-xs font-bold text-slate-700">Feminino</span></label>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-6">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Escolaridade</label>
                                      <select name="education" defaultValue={editingMember?.education} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700">
                                        <option value="">Selecione...</option>
                                        <option value="Ensino Fundamental">Ensino Fundamental</option>
                                        <option value="Ensino Médio">Ensino Médio</option>
                                        <option value="Ensino Superior - Cursando">Ensino Superior - Cursando</option>
                                        <option value="Ensino Superior - Completo">Ensino Superior - Completo</option>
                                        <option value="Pós-Graduação">Pós-Graduação</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Estado civil</label>
                                      <select name="maritalStatus" defaultValue={editingMember?.maritalStatus} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700">
                                        <option value="">Selecione...</option>
                                        <option value="Solteiro(a)">Solteiro(a)</option>
                                        <option value="Casado(a)">Casado(a)</option>
                                        <option value="Divorciado(a)">Divorciado(a)</option>
                                        <option value="Viúvo(a)">Viúvo(a)</option>
                                        <option value="União Estável">União Estável</option>
                                      </select>
                                    </div>
                                  </div>


                                  <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Nome do Cônjuge</label><input name="spouseName" defaultValue={editingMember?.spouseName} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" /></div>
                                </div>
                              </div>

                              {/* Outras informações Card */}
                              <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                                  <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                  <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Outras informações</h4>
                                </div>
                                <div className="p-8 space-y-6">
                                  <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Categorias</label><input name="categories" defaultValue={editingMember?.categories} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" /></div>
                                  <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Cargos</label><input name="cargos" defaultValue={editingMember?.cargos} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" /></div>
                                  <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Data de conversão</label><input type="date" name="conversionDate" defaultValue={editingMember?.conversionDate} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" /></div>
                                  <div className="grid grid-cols-2 gap-6">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Batizado</label>
                                      <div className="flex gap-4 py-2">
                                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="isBaptized" value="true" defaultChecked={editingMember?.isBaptized === true} className="w-4 h-4 text-teal-600" /><span className="text-xs font-bold text-slate-700">Sim</span></label>
                                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="isBaptized" value="false" defaultChecked={editingMember?.isBaptized === false} className="w-4 h-4 text-teal-600" /><span className="text-xs font-bold text-slate-700">Não</span></label>
                                      </div>
                                    </div>
                                    <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Data de batismo</label><input type="date" name="baptismDate" defaultValue={editingMember?.baptismDate} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" /></div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-10">
                              {/* Contatos Card */}
                              <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                                  <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                  <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Contatos</h4>
                                </div>
                                <div className="p-8 space-y-6">
                                  <div className="grid grid-cols-2 gap-6">
                                    <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Telefone 1</label><input name="phone" placeholder="+556199369261" defaultValue={editingMember?.phone} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Telefone 2</label><input name="phone2" defaultValue={editingMember?.phone2} placeholder="(00) 00000-0000" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                  </div>
                                  <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">E-mail</label><input required name="email" type="email" defaultValue={editingMember?.email} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                  <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Nível de Acesso</label><select name="role" defaultValue={editingMember?.role || UserRole.READER} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500"><option value={UserRole.ADMIN}>Administrador</option><option value={UserRole.TREASURER}>Tesoureiro</option><option value={UserRole.READER}>Membro Comum</option></select></div>
                                </div>
                              </div>

                              {/* Endereço Card */}
                              <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                                  <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                  <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Endereço</h4>
                                </div>
                                <div className="p-8 space-y-6">
                                  <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Endereço</label><input name="address" defaultValue={editingMember?.address} placeholder="Rua, Conjunto..." className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                  <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Número</label><input name="addressNumber" defaultValue={editingMember?.addressNumber} placeholder="Ex: 6g 38" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                  <div className="grid grid-cols-2 gap-6">
                                    <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Bairro</label><input name="neighborhood" defaultValue={editingMember?.neighborhood} placeholder="Ex: Jardim Roriz" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">CEP</label><input name="cep" defaultValue={editingMember?.cep} placeholder="73340-607" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-6">
                                    <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">País</label><select name="country" defaultValue={editingMember?.country || 'Brazil'} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700"><option value="Brazil">Brazil</option></select></div>
                                    <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Estado</label><input name="state" defaultValue={editingMember?.state} placeholder="Distrito Federal" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                  </div>
                                  <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Cidade</label><input name="city" defaultValue={editingMember?.city} placeholder="Brasília" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                </div>
                              </div>

                              {/* Anotações Card */}
                              <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                                  <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Anotações</h4>
                                </div>
                                <div className="p-8">
                                  <textarea name="notes" defaultValue={editingMember?.notes} rows={8} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 resize-none focus:border-teal-500" placeholder="Digite suas anotações aqui..." />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <button type="button" onClick={() => setViewingMemberSubTab('info')} className="flex-1 px-4 py-4 border border-slate-200 rounded-[24px] font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition">Descartar</button>
                            <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-4 rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition disabled:opacity-50">
                              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })())}
          {activeTab === 'agenda' && (
            <div className="animate-slide-up">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Calendar Main Area */}
                <div className="flex-grow bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
                  <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex gap-2 mr-2">
                        <button
                          onClick={() => {
                            const newDate = new Date(selectedCalendarDate);
                            if (calendarViewMode === 'weekList') {
                              newDate.setDate(newDate.getDate() - 7);
                            } else {
                              newDate.setMonth(newDate.getMonth() - 1);
                            }
                            setSelectedCalendarDate(newDate);
                          }}
                          className="bg-slate-900 text-white p-2.5 rounded-lg hover:bg-slate-800 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                          onClick={() => {
                            const newDate = new Date(selectedCalendarDate);
                            if (calendarViewMode === 'weekList') {
                              newDate.setDate(newDate.getDate() + 7);
                            } else {
                              newDate.setMonth(newDate.getMonth() + 1);
                            }
                            setSelectedCalendarDate(newDate);
                          }}
                          className="bg-slate-900 text-white p-2.5 rounded-lg hover:bg-slate-800 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <button
                          onClick={() => setSelectedCalendarDate(new Date())}
                          className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition"
                        >
                          Hoje
                        </button>
                      </div>

                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        {calendarViewMode === 'weekList' ? (
                          (() => {
                            const start = new Date(selectedCalendarDate);
                            start.setDate(start.getDate() - start.getDay());
                            const end = new Date(start);
                            end.setDate(end.getDate() + 6);
                            return `${start.getDate()} � ${end.getDate()} de ${start.toLocaleString('pt-BR', { month: 'short' })}. de ${start.getFullYear()}`;
                          })()
                        ) : (
                          <>
                            {selectedCalendarDate.toLocaleString('pt-BR', { month: 'long' })}
                            <span className="text-indigo-600 ml-1">{selectedCalendarDate.getFullYear()}</span>
                          </>
                        )}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 bg-slate-100 p-1.5 rounded-2xl">
                      <div className="flex items-center gap-1 bg-slate-900/5 p-1 rounded-xl">
                        <button
                          onClick={() => setCalendarViewMode('month')}
                          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${calendarViewMode === 'month' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                          Mês
                        </button>
                        <button
                          onClick={() => setCalendarViewMode('monthList')}
                          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${calendarViewMode === 'monthList' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                          Lista mensal
                        </button>
                        <button
                          onClick={() => setCalendarViewMode('weekList')}
                          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${calendarViewMode === 'weekList' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                          Lista semanal
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        <select
                          value={calendarCatFilter}
                          onChange={(e) => setCalendarCatFilter(e.target.value)}
                          className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer pr-4"
                        >
                          <option value="ALL">Todas Categorias</option>
                          {eventCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={() => { setEditingEvent(null); setIsEventModalOpen(true); }}
                      className="hidden sm:flex bg-sky-500 text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-sky-100 hover:bg-sky-600 transition transform active:scale-95 items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      Adicionar
                    </button>
                  </div>

                  <div className="flex-grow">
                    {/* Pre-filter events globally for the calendar view */}
                    {(() => {
                      const filteredEvents = events.filter(e => {
                        if (calendarCatFilter === 'ALL') return true;
                        // Use string conversion for robust comparison of IDs
                        return String(e.categoryId) === String(calendarCatFilter);
                      });

                      return (
                        <>
                          {calendarViewMode === 'month' && (
                            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-3xl overflow-hidden">
                              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                <div key={day} className="bg-slate-50 py-4 text-center">
                                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{day}</span>
                                </div>
                              ))}
                              {(() => {
                                const y = selectedCalendarDate.getFullYear();
                                const m = selectedCalendarDate.getMonth();
                                const daysInMonth = new Date(y, m + 1, 0).getDate();
                                const firstDayOfMonth = new Date(y, m, 1).getDay();
                                const days = [];

                                // Empty cells for first week
                                for (let i = 0; i < firstDayOfMonth; i++) {
                                  days.push(<div key={`empty-${i}`} className="bg-white/50 h-32 lg:h-40 p-4 border-slate-100"></div>);
                                }

                                // Month days
                                for (let d = 1; d <= daysInMonth; d++) {
                                  const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                  const dayEvents = filteredEvents.filter(e => e.startDate === dateStr);
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
                          )}

                          {(calendarViewMode === 'monthList' || calendarViewMode === 'weekList') && (
                            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                              {(() => {
                                let viewFilteredEvents = filteredEvents;

                                if (calendarViewMode === 'monthList') {
                                  viewFilteredEvents = viewFilteredEvents.filter(e => {
                                    const [y, m, d] = e.startDate.split('-').map(Number);
                                    return (m - 1) === selectedCalendarDate.getMonth() && y === selectedCalendarDate.getFullYear();
                                  });
                                } else {
                                  const startOfWeek = new Date(selectedCalendarDate);
                                  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                                  startOfWeek.setHours(0, 0, 0, 0);

                                  const endOfWeek = new Date(startOfWeek);
                                  endOfWeek.setDate(endOfWeek.getDate() + 6);
                                  endOfWeek.setHours(23, 59, 59, 999);

                                  viewFilteredEvents = viewFilteredEvents.filter(e => {
                                    const [y, m, d_val] = e.startDate.split('-').map(Number);
                                    const eventDate = new Date(y, m - 1, d_val);
                                    return eventDate >= startOfWeek && eventDate <= endOfWeek;
                                  });
                                }

                                // Group by day
                                const grouped: { [key: string]: typeof events } = {};
                                viewFilteredEvents.forEach(e => {
                                  if (!grouped[e.startDate]) grouped[e.startDate] = [];
                                  grouped[e.startDate].push(e);
                                });

                                const sortedDays = Object.keys(grouped).sort();

                                if (sortedDays.length === 0) {
                                  return (
                                    <div className="p-20 text-center bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                                      <p className="text-slate-400 font-bold italic">Nenhum evento agendado neste período.</p>
                                    </div>
                                  );
                                }

                                return sortedDays.map(dateStr => {
                                  const dayEvents = grouped[dateStr].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
                                  const [y, m, d_val] = dateStr.split('-').map(Number);
                                  const d = new Date(y, m - 1, d_val);
                                  const dayName = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                                  const dateReadable = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

                                  return (
                                    <div key={dateStr} className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                                      <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                                        <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">
                                          {dayName}, {dateReadable}
                                        </h5>
                                      </div>
                                      <div className="divide-y divide-slate-50 bg-white">
                                        {dayEvents.map(e => {
                                          const cat = eventCategories.find(c => c.id === e.categoryId);
                                          return (
                                            <div
                                              key={e.id}
                                              onClick={() => { setEditingEvent(e); setIsEventModalOpen(true); }}
                                              className="px-8 py-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer group"
                                            >
                                              <div className="flex items-center gap-6">
                                                <div className="w-24 text-[11px] font-bold text-slate-400">
                                                  {e.startTime ? `${e.startTime.substring(0, 5)}${e.endTime ? ` - ${e.endTime.substring(0, 5)}` : ''}` : 'Dia todo'}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || '#6366f1' }}></div>
                                                  <span className="text-sm font-bold text-slate-700 tracking-tight">{e.title}</span>
                                                </div>
                                              </div>
                                              <div className="opacity-0 group-hover:opacity-100 transition">
                                                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Sidebar Categories */}
                <div className="w-full lg:w-80 shrink-0 space-y-8">
                  <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h4 className="text-lg font-black text-slate-800 tracking-tight">Categorias</h4>
                    </div>

                    <div className="space-y-4">
                      {/* Add Category Section */}
                      <div className="space-y-3">
                        <input
                          value={newEvCatNameInput}
                          onChange={(e) => setNewEvCatNameInput(e.target.value)}
                          placeholder="Nova categoria..."
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#20b2aa] transition shadow-sm"
                        />
                        <button
                          onClick={async () => {
                            if (!newEvCatNameInput) return;
                            try {
                              const { error } = await supabase.from('event_categories').insert([{ name: newEvCatNameInput, color: '#6366f1' }]);
                              if (error) throw error;
                              setNewEvCatNameInput('');
                              fetchData();
                            } catch (error: any) {
                              alert('Erro ao adicionar categoria: ' + error.message);
                            }
                          }}
                          className="w-full bg-[#20b2aa] text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition shadow-md"
                        >
                          Adicionar Categoria
                        </button>
                      </div>

                      <div className="pt-4 space-y-2 border-t border-slate-50">
                        <button
                          onClick={() => setCalendarCatFilter('ALL')}
                          className={`w-full px-6 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-left transition-all border ${calendarCatFilter === 'ALL' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-900 border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                        >
                          Todas Categorias
                        </button>

                        {eventCategories.map(cat => (
                          <div key={cat.id} className="relative group flex items-center gap-2">
                            {editingEvCatId === cat.id ? (
                              <div className="flex-grow flex items-center gap-2">
                                <input
                                  autoFocus
                                  value={evCatNameInput}
                                  onChange={(e) => setEvCatNameInput(e.target.value)}
                                  className="flex-grow px-4 py-3 bg-white border border-[#20b2aa] rounded-xl text-[10px] font-black uppercase outline-none"
                                />
                                <button
                                  onClick={async () => {
                                    try {
                                      const { error } = await supabase.from('event_categories').update({ name: evCatNameInput }).eq('id', cat.id);
                                      if (error) throw error;
                                      setEditingEvCatId(null);
                                      fetchData();
                                    } catch (error: any) {
                                      alert('Erro ao atualizar: ' + error.message);
                                    }
                                  }}
                                  className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button
                                  onClick={() => setEditingEvCatId(null)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => setCalendarCatFilter(cat.id === calendarCatFilter ? 'ALL' : cat.id)}
                                  className={`flex-grow px-6 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-left transition-all border ${calendarCatFilter === cat.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-[1.02]' : 'bg-white text-slate-900 border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                                >
                                  {cat.name}
                                </button>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-all p-1 rounded-lg">
                                  <button
                                    onClick={() => {
                                      setEditingEvCatId(cat.id);
                                      setEvCatNameInput(cat.name);
                                    }}
                                    className={`p-1 px-2 transition ${calendarCatFilter === cat.id ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-indigo-600'}`}
                                    title="Editar"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEventCat(cat.id)}
                                    className={`p-1 px-2 transition ${calendarCatFilter === cat.id ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-rose-500'}`}
                                    title="Excluir"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
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
            <div className="space-y-8 animate-slide-up">
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
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-slide-up">
                  {/* Banner / Header */}
                  <div className="relative h-64 bg-slate-100 group">
                    {deptBannerUrl ? (
                      <img src={deptBannerUrl} className="w-full h-full object-cover" alt="Banner" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center gap-4">
                      <button
                        onClick={() => document.getElementById('deptBannerInput')?.click()}
                        className="bg-white text-slate-900 px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl opacity-0 group-hover:opacity-100 transition hover:bg-indigo-50"
                      >
                        Alterar Banner
                      </button>
                      {deptBannerUrl && (
                        <button
                          onClick={() => setDeptBannerUrl(null)}
                          className="bg-rose-500 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl opacity-0 group-hover:opacity-100 transition hover:bg-rose-600"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <input id="deptBannerInput" type="file" accept="image/*" onChange={handleDeptBannerUpload} className="hidden" />

                    {/* Icon Circle */}
                    <div className="absolute left-12 -bottom-16 w-32 h-32 bg-indigo-100 rounded-2xl border-8 border-white shadow-xl flex items-center justify-center text-indigo-600 group/icon overflow-hidden">
                      {deptIcon && deptIcon.length > 200 ? (
                        <img src={deptIcon} className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={deptIcon || 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'} /></svg>
                      )}

                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 opacity-0 group-hover/icon:opacity-100 transition">
                        <button
                          onClick={() => document.getElementById('deptIconInput')?.click()}
                          className="text-white hover:scale-110 transition"
                          title="Alterar Ícone"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                        {deptIcon && (
                          <button
                            onClick={() => setDeptIcon(null)}
                            className="bg-rose-500 text-white p-1.5 rounded-full hover:bg-rose-600 transition shadow-lg"
                            title="Remover Ícone"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <input id="deptIconInput" type="file" accept="image/*" onChange={handleDeptIconUpload} className="hidden" />
                  </div>

                  <div className="p-12 pt-24 space-y-12">
                    <div className="flex flex-col md:flex-row gap-8">
                      {/* Spacer for the absolute icon overlap on desktop */}
                      <div className="hidden md:block w-32 shrink-0"></div>
                      <div className="space-y-6 flex-1 max-w-4xl">
                        <div>
                          <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Nome do departamento</label>
                          <input
                            type="text"
                            value={deptName}
                            onChange={(e) => setDeptName(e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Sobre o departamento</label>
                          <textarea
                            rows={4}
                            value={deptDescription}
                            onChange={(e) => setDeptDescription(e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          ></textarea>
                        </div>
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
                <div className="flex flex-col lg:flex-row gap-8 animate-slide-up">
                  {/* Left Sidebar - Dept List */}
                  <div className="w-full lg:w-80 shrink-0 space-y-4">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Meus Departamentos</h4>
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
            <div className="animate-slide-up max-w-2xl">
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
                  <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Nome Institucional</label><input name="name" required defaultValue={churchInfo.name} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none text-black font-bold focus:ring-2 focus:ring-indigo-500" /></div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Logo Institucional (Anexo)</label>
                    <div className="flex items-center gap-6">
                      <div className="h-16 w-16 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center">
                        {churchInfo.logoUrl ? <img src={churchInfo.logoUrl} className="h-full w-full object-cover" /> : <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                      </div>
                      <input name="logoFile" type="file" accept="image/*" className="text-xs font-bold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    </div>
                  </div>

                  <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Endereço Sede</label><input name="address" defaultValue={churchInfo.address} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none text-black font-bold focus:ring-2 focus:ring-indigo-500" /></div>

                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Telefone</label><input name="phone" defaultValue={churchInfo.phone} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none text-black font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                    <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">E-mail Administrativo</label><input name="email" type="email" defaultValue={churchInfo.email} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none text-black font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                  </div>
                  <div className="pt-6"><button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black uppercase text-xs tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition transform active:scale-[0.98]">Salvar Configurações</button></div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main >

      {/* --- Modais --- */}

      {
        isTxModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-[#f8fafb] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
              {/* Modal Header */}
              <div className={`px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white`}>
                <h3 className={`text-xl font-bold tracking-tight ${editingTx?.type === 'EXPENSE' ? 'text-[#f43f5e]' : 'text-[#20b2aa]'}`}>
                  {isDuplicatingTx ? (
                    <>Criar {editingTx?.type === 'INCOME' ? 'receita' : 'despesa'} <span className="text-xs font-normal opacity-70 italic">( cópia de {originalTxDescription} )</span></>
                  ) : (
                    editingTx?.id ? (editingTx.type === 'INCOME' ? 'Editar receita' : 'Editar despesa') : (editingTx?.type === 'INCOME' ? 'Criar receita' : 'Criar despesa')
                  )}
                </h3>
                <button
                  onClick={() => {
                    setIsTxModalOpen(false);
                    setIsDuplicatingTx(false);
                    setOriginalTxDescription('');
                  }}
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
                    <label className="block text-sm font-bold text-slate-900">Data</label>
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
                    <label className="block text-sm font-bold text-slate-900">Descrição</label>
                    <input
                      required name="description"
                      defaultValue={editingTx?.description}
                      placeholder="Descrição da transação"
                      className={`w-full px-4 py-3.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-700 focus:ring-2 ${editingTx?.type === 'EXPENSE' ? 'focus:ring-rose-200' : 'focus:ring-[#20b2aa]/30'}`}
                    />
                  </div>

                  <div className="flex-1 min-w-[150px] space-y-2 text-right">
                    <label className="block text-sm font-bold text-slate-900 text-left">Valor</label>
                    <div className={`flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 ${editingTx?.type === 'EXPENSE' ? 'focus-within:ring-rose-200' : 'focus-within:ring-[#20b2aa]/30'}`}>
                      <span className="pl-4 text-slate-400 font-bold">R$</span>
                      <input
                        required name="amount" type="text" inputMode="decimal"
                        defaultValue={editingTx?.amount !== undefined ? editingTx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                        placeholder="0,00"
                        onKeyPress={(e) => {
                          if (!/[0-9,.]/.test(e.key)) e.preventDefault();
                        }}
                        className="w-full px-4 py-3 outline-none text-right font-black text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col items-center space-y-2 pb-1">
                    <label className="block text-sm font-bold text-slate-900">Pago?</label>
                    <label className="relative cursor-pointer">
                      <input type="checkbox" name="is_paid" value="true" defaultChecked={editingTx?.isPaid !== false} className="sr-only peer" />
                      <div className={`w-12 h-12 flex items-center justify-center rounded-full bg-slate-200 text-white transition-all shadow-inner peer-checked:bg-${editingTx?.type === 'EXPENSE' ? 'rose-500' : '[#20b2aa]'}`}>
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-900">{editingTx?.type === 'EXPENSE' ? 'Pago à' : 'Recebido de'}</label>
                    <select name="member" defaultValue={editingTx?.member || ''} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-600 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-right-4">
                      <option value="">Selecione</option>
                      {allUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-900">Categoria</label>
                    <select name="category" defaultValue={editingTx?.category} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-600">
                      <option value="">{categories.length === 0 ? 'Nenhuma categoria cadastrada' : 'Selecione'}</option>
                      {categories.filter(c => c.type === (editingTx?.type || 'INCOME')).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    {categories.filter(c => c.type === (editingTx?.type || 'INCOME')).length === 0 && (
                      <p className="text-[9px] text-rose-500 font-bold uppercase mt-1">Cadastre categorias na aba Configurações primeiro.</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-2">
                    <label className="block text-sm font-bold text-slate-900">Anotações</label>
                    <textarea name="notes" defaultValue={editingTx?.notes} rows={8} className={`w-full px-6 py-4 bg-white border border-slate-200 rounded-xl outline-none font-medium text-slate-700 resize-none shadow-sm focus:ring-2 ${editingTx?.type === 'EXPENSE' ? 'focus:ring-rose-200' : 'focus:ring-[#20b2aa]/30'}`} placeholder="Observações importantes..." />
                  </div>
                </div>

                {/* Files Section */}
                <div className="bg-white border border-slate-100 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-500">Arquivos {txFiles.length + attachedUrls.length}/5</div>
                    <button
                      type="button"
                      onClick={() => txFileInputRef.current?.click()}
                      className="bg-[#004a7c] text-white px-6 py-2 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-[#003a63] transition shadow-md"
                    >
                      Anexar arquivo (Máx. 10MB/arquivo)
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <input
                      type="file"
                      ref={txFileInputRef}
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (txFiles.length + attachedUrls.length + files.length > 5) {
                          alert('Limite de 5 arquivos por lançamento.');
                          return;
                        }
                        setTxFiles([...txFiles, ...files]);
                      }}
                    />
                  </div>

                  {(txFiles.length > 0 || attachedUrls.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {attachedUrls.map((url, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 hover:underline truncate max-w-[100px] flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            Ver Arquivo
                          </a>
                          <button type="button" onClick={() => setAttachedUrls(attachedUrls.filter((_, idx) => idx !== i))} className="text-rose-500 font-bold ml-2">�</button>
                        </div>
                      ))}
                      {txFiles.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                          <span className="text-[10px] font-bold text-indigo-600 truncate max-w-[100px]">{file.name}</span>
                          <button type="button" onClick={() => setTxFiles(txFiles.filter((_, idx) => idx !== i))} className="text-rose-500 font-bold ml-2">�</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>

              {/* Modal Footer */}
              <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsTxModalOpen(false);
                    setIsDuplicatingTx(false);
                    setOriginalTxDescription('');
                  }}
                  disabled={isSubmitting}
                  className="px-8 py-3.5 rounded-full font-bold text-sm text-slate-500 hover:bg-slate-50 transition active:scale-[0.98] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={(e: any) => {
                    const form = document.getElementById('txForm') as HTMLFormElement;
                    const event = new Event('submit', { cancelable: true }) as any;
                    handleSaveTx({ ...event, currentTarget: form, preventDefault: () => { } } as any, false);
                  }}
                  disabled={isSubmitting}
                  className="bg-[#004a7c] text-white px-8 py-3.5 rounded-full font-bold text-sm shadow-xl hover:bg-[#003a63] transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar e novo'}
                </button>
                <button
                  type="submit"
                  form="txForm"
                  disabled={isSubmitting}
                  className={`text-white px-8 py-3.5 rounded-full font-bold text-sm shadow-xl transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${editingTx?.type === 'EXPENSE' ? 'bg-[#f43f5e] hover:bg-[#1a8e88]' : 'bg-[#20b2aa] hover:bg-[#1a8e88]'}`}
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar e fechar'}
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
              <h3 className="text-xl font-black mb-8 text-slate-900 uppercase tracking-widest">{editingCat ? 'Editar Categoria' : 'Nova Categoria'}</h3>
              <form onSubmit={handleSaveCat} className="space-y-6">
                <input type="hidden" name="type" value={editingCat?.type || 'INCOME'} />
                <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Nome</label><input required name="name" placeholder="Ex: Manutenção..." defaultValue={editingCat?.name} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Descrição</label><input name="description" placeholder="Opcional" defaultValue={editingCat?.description} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Cor de Destaque</label><select name="color" defaultValue={editingCat?.color || 'indigo'} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold"><option value="indigo">Índigo</option><option value="emerald">Esmeralda</option><option value="rose">Rosa</option><option value="amber">�mbar</option><option value="blue">Azul</option><option value="teal">Teal</option></select></div>
                <div className="pt-4 flex gap-4"><button type="button" onClick={() => setIsCatModalOpen(false)} className="flex-1 px-4 py-4 border border-slate-200 rounded-[20px] font-black uppercase text-[10px] tracking-widest">Sair</button><button type="submit" className="flex-1 bg-slate-900 text-white rounded-[20px] font-black uppercase text-[10px] tracking-widest">{editingCat ? 'Salvar' : 'Criar'}</button></div>
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
                    <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">Início</label>
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
                    <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Dia inteiro</span>
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
                    <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Categoria</label>
                    <select name="categoryId" defaultValue={editingEvent?.categoryId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 outline-none">
                      <option value="">Nenhuma</option>
                      {eventCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Local</label>
                    <input name="location" defaultValue={editingEvent?.location} placeholder="Ex: Templo Principal" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                  </div>
                </div>

                <div className="flex flex-col h-64">
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Descrição</label>
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
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Nome</label>
                  <input required name="name" placeholder="Ex: Direção Culto..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Cor</label>
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
            <div className="bg-[#f3f4f6] w-full max-w-6xl rounded-[40px] shadow-2xl p-10 lg:p-14 overflow-y-auto max-h-[95vh]">
              <h3 className="text-3xl font-black mb-10 text-slate-800 tracking-tight">{editingMember ? 'Atualizar Perfil' : 'Cadastrar Membro'}</h3>
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
                        <span className="text-[10px] font-black text-slate-900 uppercase">Zoom</span>
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
                          � Remover Foto Atual
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Left Column */}
                  <div className="space-y-10">
                    {/* Dados pessoais Card */}
                    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Dados pessoais</h4>
                      </div>
                      <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Nome</label><input required name="firstName" defaultValue={editingMember?.name?.split(' ')[0]} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Sobrenome</label><input required name="lastName" defaultValue={editingMember?.name?.split(' ').slice(1).join(' ')} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                        </div>

                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Senha</label><div className="relative"><input name="password" type="password" placeholder={editingMember ? "Para não alterar, deixe em branco" : "Mínimo 6 caracteres"} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button></div></div>

                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Data de nascimento</label>
                            <div className="relative group">
                              <input type="date" name="birthDate" defaultValue={editingMember?.birthDate} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" />
                              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 opacity-0 group-hover:opacity-100 transition" onClick={(e) => { const input = (e.currentTarget.previousSibling as HTMLInputElement); input.value = ''; }}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Sexo</label>
                            <div className="flex gap-4 py-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="gender" value="M" defaultChecked={editingMember?.gender === 'M'} className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500" />
                                <span className="text-xs font-bold text-slate-700">Masculino</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="gender" value="F" defaultChecked={editingMember?.gender === 'F'} className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500" />
                                <span className="text-xs font-bold text-slate-700">Feminino</span>
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Escolaridade</label>
                            <select name="education" defaultValue={editingMember?.education} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700">
                              <option value="">Selecione...</option>
                              <option value="Ensino Fundamental">Ensino Fundamental</option>
                              <option value="Ensino Médio">Ensino Médio</option>
                              <option value="Ensino Superior - Cursando">Ensino Superior - Cursando</option>
                              <option value="Ensino Superior - Completo">Ensino Superior - Completo</option>
                              <option value="Pós-Graduação">Pós-Graduação</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Estado civil</label>
                            <select name="maritalStatus" defaultValue={editingMember?.maritalStatus} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700">
                              <option value="">Selecione...</option>
                              <option value="Solteiro(a)">Solteiro(a)</option>
                              <option value="Casado(a)">Casado(a)</option>
                              <option value="Divorciado(a)">Divorciado(a)</option>
                              <option value="Viúvo(a)">Viúvo(a)</option>
                              <option value="União Estável">União Estável</option>
                            </select>
                          </div>
                        </div>


                        <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Nome do Cônjuge</label><input name="spouseName" defaultValue={editingMember?.spouseName} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                      </div>
                    </div>

                    {/* Outras informações Card */}
                    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                        <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                        <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Outras informações</h4>
                      </div>
                      <div className="p-8 space-y-6">
                        <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Categorias</label><input name="categories" defaultValue={editingMember?.categories} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                        <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Cargos</label><input name="cargos" defaultValue={editingMember?.cargos} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                        <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Data de conversão</label><div className="relative group"><input type="date" name="conversionDate" defaultValue={editingMember?.conversionDate} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 opacity-0 group-hover:opacity-100 transition" onClick={(e) => { const input = (e.currentTarget.previousSibling as HTMLInputElement); input.value = ''; }}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></div>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Batizado</label>
                            <div className="flex gap-4 py-2">
                              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="isBaptized" value="true" defaultChecked={editingMember?.isBaptized === true} className="w-4 h-4 text-teal-600 focus:ring-teal-500" /><span className="text-xs font-bold text-slate-700">Sim</span></label>
                              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="isBaptized" value="false" defaultChecked={editingMember?.isBaptized === false} className="w-4 h-4 text-teal-600 focus:ring-teal-500" /><span className="text-xs font-bold text-slate-700">Não</span></label>
                            </div>
                          </div>
                          <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Data de batismo</label><div className="relative group"><input type="date" name="baptismDate" defaultValue={editingMember?.baptismDate} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 opacity-0 group-hover:opacity-100 transition" onClick={(e) => { const input = (e.currentTarget.previousSibling as HTMLInputElement); input.value = ''; }}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-10">
                    {/* Contatos Card */}
                    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                        <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Contatos</h4>
                      </div>
                      <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                          <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Telefone 1</label><input name="phone" placeholder="+556199369261" defaultValue={editingMember?.phone} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                          <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Telefone 2</label><input name="phone2" defaultValue={editingMember?.phone2} placeholder="(00) 00000-0000" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                        </div>
                        <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">E-mail</label><input required name="email" type="email" defaultValue={editingMember?.email} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                        <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Nível de Acesso</label><select name="role" defaultValue={editingMember?.role || UserRole.READER} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500"><option value={UserRole.ADMIN}>Administrador</option><option value={UserRole.TREASURER}>Tesoureiro</option><option value={UserRole.READER}>Membro Comum</option></select></div>
                      </div>
                    </div>

                    {/* Endereço Card */}
                    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                        <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Endereço</h4>
                      </div>
                      <div className="p-8 space-y-6">
                        <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Endereço</label><input name="address" defaultValue={editingMember?.address} placeholder="Rua, Conjunto..." className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                        <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Número</label><input name="addressNumber" defaultValue={editingMember?.addressNumber} placeholder="Ex: 6g 38" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                        <div className="grid grid-cols-2 gap-6">
                          <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Bairro</label><input name="neighborhood" defaultValue={editingMember?.neighborhood} placeholder="Ex: Jardim Roriz" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                          <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">CEP</label><input name="cep" defaultValue={editingMember?.cep} placeholder="73340-607" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">País</label><select name="country" defaultValue={editingMember?.country || 'Brazil'} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm"><option value="Brazil">Brazil</option></select></div>
                          <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Estado</label><input name="state" defaultValue={editingMember?.state} placeholder="Distrito Federal" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                        </div>
                        <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Cidade</label><input name="city" defaultValue={editingMember?.city} placeholder="Brasília" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" /></div>
                      </div>
                    </div>

                    {/* Anotações Card */}
                    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                        <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Anotações</h4>
                      </div>
                      <div className="p-8">
                        <textarea name="notes" defaultValue={editingMember?.notes} rows={8} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 resize-none focus:border-teal-500" placeholder="Digite suas anotações aqui..." />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-10 flex gap-4">
                  <button type="button" onClick={() => setIsMemberModalOpen(false)} className="flex-1 px-4 py-4 border border-slate-200 rounded-[24px] font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition">Cancelar</button>
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition transform active:scale-95">Salvar Cadastro</button>
                </div>
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

                <div className="space-y-4">
                  <div className="flex gap-4 p-1.5 bg-slate-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setPostImageSource('url')}
                      className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${postImageSource === 'url' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      URL da Imagem
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostImageSource('file')}
                      className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${postImageSource === 'file' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Carregar Arquivo
                    </button>
                  </div>

                  {postImageSource === 'url' ? (
                    <input name="imageUrl" placeholder="Cole a URL da imagem aqui" defaultValue={editingPost?.imageUrl} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold text-sm" />
                  ) : (
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPostImageFile(file);
                            setPostImagePreview(URL.createObjectURL(file));
                          }
                        }}
                        className="hidden"
                        id="post-image-upload"
                      />
                      <label
                        htmlFor="post-image-upload"
                        className="flex flex-col items-center justify-center w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] cursor-pointer hover:bg-slate-100 transition group-hover:border-indigo-300 overflow-hidden"
                      >
                        {postImagePreview ? (
                          <img src={postImagePreview} className="w-full h-full object-cover" alt="Preview" />
                        ) : (
                          <>
                            <svg className="w-8 h-8 text-slate-300 mb-2 group-hover:text-indigo-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Selecionar Imagem</span>
                          </>
                        )}
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex flex-col h-80">
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Conteúdo</label>
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
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-4 rounded-[20px] font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-50">
                    {isSubmitting ? 'Processando...' : 'Publicar'}
                  </button>
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
                <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Nova Senha</label><input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Confirmar</label><input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
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
        )
      }

      {
        isDeptMemberAddModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10">
              <h3 className="text-xl font-black mb-8 text-slate-900 uppercase tracking-widest text-center">Adicionar Participante</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Membro</label>
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
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Funções no Departamento</label>
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
        )
      }

      {
        viewingMember && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 lg:p-10 animate-in fade-in duration-300 printable-modal print:items-start print:pt-0 print:p-0">
            <div className="bg-[#f8f9fc] w-full max-w-6xl h-full rounded-[40px] shadow-2xl flex flex-col overflow-hidden print:overflow-visible print:h-auto print:rounded-none print:shadow-none px-4">
              {/* Profile Header */}
              <div className={`bg-white px-10 py-8 border-b border-slate-100 flex items-center gap-8 relative shrink-0 ${viewingMemberSubTab === 'finances' ? 'print:hidden' : ''}`}>
                <div className={`w-36 h-36 rounded-3xl overflow-hidden border-4 border-white shadow-xl shrink-0 relative group ${viewingMemberSubTab === 'edit' ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (viewingMemberSubTab === 'edit') {
                      const fileInput = document.getElementById('viewingMemberAvatarInput') as HTMLInputElement;
                      fileInput?.click();
                    }
                  }}>
                  {viewingMemberSubTab === 'edit' ? (
                    <>
                      {(!isAvatarRemoved && (avatarPreview || editingMember?.avatarUrl)) ? (
                        <img
                          src={avatarPreview || editingMember?.avatarUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-slate-50 flex items-center justify-center text-slate-300">
                          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center flex-col gap-2">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="text-white text-[9px] font-black uppercase tracking-widest text-center px-2">Alterar Foto</span>
                      </div>
                      {(!isAvatarRemoved && (avatarPreview || editingMember?.avatarUrl)) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAvatarRemoved(true);
                            setAvatarPreview(null);
                            setTempAvatarFile(null);
                          }}
                          className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-lg shadow-lg hover:bg-rose-600 transition"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </>
                  ) : (
                    <img src={viewingMember.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingMember.name)}&background=random`} className="w-full h-full object-cover" />
                  )}
                  <input
                    id="viewingMemberAvatarInput"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setTempAvatarFile(file);
                        setAvatarPreview(URL.createObjectURL(file));
                        setIsAvatarRemoved(false);
                      }
                    }}
                  />
                </div>
                <div className="flex-grow">
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">{viewingMember.name}</h2>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> {viewingMember.city || 'Cidade não inf.'}</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {viewingMember.phone || 'Sem telefone'}</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> {viewingMember.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`flex gap-2 print:hidden ${['finances', 'edit'].includes(viewingMemberSubTab) ? 'hidden' : ''}`}>
                    {/* <button onClick={handleArchiveMember} className="bg-rose-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 transition hover:bg-rose-600">Arquivar</button> */}
                    <button onClick={handlePrintMember} className="bg-[#004a7c] text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 flex items-center gap-2 hover:bg-[#003a63] transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Imprimir
                    </button>
                  </div>
                  <button onClick={() => setViewingMember(null)} className="p-3 text-slate-400 hover:text-slate-600 transition print:hidden"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              </div>

              {/* Internal Tabs */}
              <div className={`bg-white px-10 border-b border-slate-100 flex gap-8 shrink-0 print:hidden ${viewingMemberSubTab === 'finances' ? 'print:hidden' : ''}`}>
                <button onClick={() => setViewingMemberSubTab('info')} className={`py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${viewingMemberSubTab === 'info' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Informações</button>
                <button onClick={() => setViewingMemberSubTab('finances')} className={`py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${viewingMemberSubTab === 'finances' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Financeiro</button>
                <button onClick={() => {
                  setEditingMember(viewingMember);
                  setViewingMemberSubTab('edit');
                  setAvatarPreview(null);
                  setTempAvatarFile(null);
                  setIsAvatarRemoved(false);
                }} className={`py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${viewingMemberSubTab === 'edit' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Editar</button>
              </div>

              {/* Profile Content Area */}
              <div className="flex-grow overflow-y-auto p-10 bg-[#f8f9fc] print:bg-white print:p-0 print:overflow-visible print:h-auto">
                {viewingMemberSubTab === 'info' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up">
                    <div className="space-y-8">
                      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Dados Pessoais</h4>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Nome Completo</span> <span className="text-xs font-bold text-slate-700">{viewingMember.name}</span></div>
                          <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Nascimento</span> <span className="text-xs font-bold text-slate-700">{viewingMember.birthDate ? `${viewingMember.birthDate.split('-').reverse().join('/')} (${calculateAge(viewingMember.birthDate)} anos)` : '-'}</span></div>
                          <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Gênero</span> <span className="text-xs font-bold text-slate-700">{viewingMember.gender === 'M' ? 'Masculino' : viewingMember.gender === 'F' ? 'Feminino' : '-'}</span></div>
                          <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Escolaridade</span> <span className="text-xs font-bold text-slate-700">{viewingMember.education || '-'}</span></div>
                          <div className="flex justify-between pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Estado Civil</span> <span className="text-xs font-bold text-slate-700">{viewingMember.maritalStatus || '-'}</span></div>
                        </div>
                      </div>

                      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Outras Informações</h4>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Cônjuge</span> <span className="text-xs font-bold text-slate-700">{viewingMember.spouseName || '-'}</span></div>
                          <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Conversão</span> <span className="text-xs font-bold text-slate-700">{viewingMember.conversionDate ? viewingMember.conversionDate.split('-').reverse().join('/') : '-'}</span></div>
                          <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Batizado</span> <span className="text-xs font-bold text-slate-700">{viewingMember.isBaptized ? 'Sim' : 'Não'}</span></div>
                          <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Batismo</span> <span className="text-xs font-bold text-slate-700">{viewingMember.baptismDate ? viewingMember.baptismDate.split('-').reverse().join('/') : '-'}</span></div>
                          <div className="flex justify-between pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Cadastrado em</span> <span className="text-xs font-bold text-slate-700">{viewingMember.createdAt ? new Date(viewingMember.createdAt).toLocaleDateString('pt-BR') : '-'}</span></div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-1.5 h-6 bg-sky-500 rounded-full"></div>
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Contatos & Endereço</h4>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">E-mail</span> <span className="text-xs font-bold text-slate-700">{viewingMember.email}</span></div>
                          <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase">Telefone</span> <span className="text-xs font-bold text-slate-700">{viewingMember.phone || '-'}</span></div>
                          <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Localização</div>
                            <div className="text-xs font-bold text-slate-600 leading-relaxed">
                              {viewingMember.address || 'Sem endereço'}<br />
                              {viewingMember.neighborhood && `${viewingMember.neighborhood}, `}{viewingMember.city && `${viewingMember.city} - ${viewingMember.state || ''}`}<br />
                              {viewingMember.cep && `CEP: ${viewingMember.cep}`}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-1.5 h-6 bg-slate-800 rounded-full"></div>
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Anotações</h4>
                        </div>
                        <p className="text-xs font-medium text-slate-500 italic leading-relaxed">
                          {viewingMember.notes || 'Nenhuma observação interna registrada.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {viewingMemberSubTab === 'finances' && (
                  <div className="space-y-6 animate-slide-up">
                    {/* Finance Toolbar */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{transactions.filter(t => t.member === viewingMember.name).length} lançamentos</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Action Buttons */}
                        <button
                          onClick={() => {
                            setEditingTx({ type: 'INCOME', amount: 0, date: new Date().toISOString().split('T')[0], category: '', description: '', member: viewingMember.name } as Transaction);
                            setIsTxModalOpen(true);
                          }}
                          className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-emerald-600 transition flex items-center gap-2"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                          Receita
                        </button>
                        <button
                          onClick={() => {
                            setEditingTx({ type: 'EXPENSE', amount: 0, date: new Date().toISOString().split('T')[0], category: '', description: '', member: viewingMember.name } as Transaction);
                            setIsTxModalOpen(true);
                          }}
                          className="bg-rose-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-rose-600 transition flex items-center gap-2"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                          Despesa
                        </button>

                        <div className="w-px h-6 bg-slate-200 mx-2"></div>

                        {/* Export Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const memberTxs = transactions.filter(t => t.member === viewingMember.name);
                              const csvContent = "data:text/csv;charset=utf-8,"
                                + "Data,Nome,Descrição,Categoria,Tipo,Valor,Status\n"
                                + memberTxs.map(t => `${t.date},${t.member},${t.description},${t.category},${t.type},${t.amount},${t.isPaid ? 'Pago' : 'Pendente'}`).join("\n");
                              const encodedUri = encodeURI(csvContent);
                              const link = document.createElement("a");
                              link.setAttribute("href", encodedUri);
                              link.setAttribute("download", `extrato_${viewingMember.name.replace(/\s+/g, '_').toLowerCase()}.csv`);
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="bg-slate-800 text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-700 transition"
                            title="Exportar CSV"
                          >
                            CSV
                          </button>
                          <button
                            onClick={() => {
                              const memberTxs = transactions.filter(t => t.member === viewingMember.name);
                              const total = memberTxs.reduce((acc, t) => t.type === 'INCOME' ? acc + t.amount : acc - t.amount, 0);

                              let html = `
                                 <html>
                                   <head>
                                     <meta charset="utf-8">
                                     <style>body{font-family:sans-serif;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:8px;} th{background-color:#f2f2f2;}</style>
                                   </head>
                                   <body>
                                     <h3>Extrato: ${viewingMember.name}</h3>
                                     <table>
                                       <thead><tr><th>Data</th><th>Nome</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th></tr></thead>
                                       <tbody>
                                         ${memberTxs.map(t => `<tr><td>${t.date}</td><td>${t.member}</td><td>${t.description}</td><td>${t.category}</td><td>${t.type === 'INCOME' ? 'Receita' : 'Despesa'}</td><td>${t.type === 'EXPENSE' ? '-' : ''}${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
                                         <tr>
                                           <td colspan="5" style="text-align:right;font-weight:bold;">Saldo Total</td>
                                           <td style="font-weight:bold;color:${total >= 0 ? 'green' : 'red'}">${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                         </tr>
                                       </tbody>
                                     </table>
                                   </body>
                                 </html>
                               `;
                              const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `extrato_${viewingMember.name.replace(/\s+/g, '_').toLowerCase()}.xls`;
                              a.click();
                            }}
                            className="bg-[#1D6F42] text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#155232] transition"
                            title="Exportar Excel"
                          >
                            Excel
                          </button>
                          <button
                            onClick={() => {
                              const style = document.createElement('style');
                              style.innerHTML = `@media print { @page { size: landscape; margin: 10mm; } }`;
                              document.head.appendChild(style);
                              window.print();
                              setTimeout(() => { if (document.head.contains(style)) document.head.removeChild(style); }, 2000);
                            }}
                            className="bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-300 transition"
                            title="Imprimir / Salvar PDF"
                          >
                            PDF/Print
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden print:shadow-none print:border-none print:rounded-none">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-8 py-5 flex items-center gap-2">
                              Data
                              <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                            </th>
                            <th className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                Nome
                                <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                              </div>
                            </th>
                            <th className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                Descrição
                                <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                              </div>
                            </th>
                            <th className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                Categoria
                                <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                              </div>
                            </th>
                            <th className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                Arquivos
                                <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                              </div>
                            </th>
                            <th className="px-8 py-5 text-right flex items-center justify-end gap-2">
                              Total
                              <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15l-3.17 3.17z" /></svg>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {transactions.filter(t => t.member === viewingMember.name).map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 transition group">
                              <td className="px-8 py-5 text-[11px] font-bold text-slate-500">{t.date.split('-').reverse().join('/')}</td>
                              <td className="px-8 py-5 text-[11px] font-bold text-slate-700">{t.member}</td>
                              <td className="px-8 py-5 text-[11px] font-bold text-slate-700">{t.description}</td>
                              <td className="px-8 py-5 text-[11px] font-bold text-slate-500">{t.category}</td>
                              <td className="px-8 py-5">
                                {t.attachmentUrls && t.attachmentUrls.length > 0 ? (
                                  <a href={t.attachmentUrls[0]} target="_blank" rel="noopener noreferrer" className="inline-block hover:scale-110 transition-transform" title="Ver anexo">
                                    <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.414a6 6 0 108.486 8.486L20.5 13" /></svg>
                                  </a>
                                ) : (
                                  <span title="Sem anexo">
                                    <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                  </span>
                                )}
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <span className={`text-[11px] font-black ${t.type === 'INCOME' ? 'text-slate-700' : 'text-rose-500'}`}>
                                    {t.type === 'EXPENSE' && '- '}{formatCurrency(t.amount)}
                                  </span>
                                  <div className="w-4 h-4 bg-emerald-500 rounded flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200">
                          {/* Total Calculation Row */}
                          {(() => {
                            const memberTxs = transactions.filter(t => t.member === viewingMember.name);
                            const totalIncome = memberTxs.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
                            const totalExpense = memberTxs.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
                            const balance = totalIncome - totalExpense;

                            return (
                              <tr>
                                <td colSpan={5} className="px-8 py-5 text-right font-black text-xs text-slate-500 uppercase tracking-widest">Saldo Total</td>
                                <td className="px-8 py-5 text-right">
                                  <span className={`text-xl font-black ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(balance)}</span>
                                </td>
                              </tr>
                            );
                          })()}
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {viewingMemberSubTab === 'edit' && (
                  <div className="animate-slide-up pb-10">
                    <form onSubmit={handleSaveMember} className="space-y-10">


                      {/* Wide Form Layout (2 columns) */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Left Column */}
                        <div className="space-y-10">
                          {/* Dados pessoais Card */}
                          <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2">
                              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Dados pessoais</h4>
                            </div>
                            <div className="p-8 space-y-6">
                              <div className="grid grid-cols-2 gap-6">
                                <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Nome</label><input required name="firstName" defaultValue={editingMember?.name?.split(' ')[0]} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Sobrenome</label><input required name="lastName" defaultValue={editingMember?.name?.split(' ').slice(1).join(' ')} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Senha</label>
                                <div className="relative">
                                  <input name="password" type="password" placeholder="Para não alterar, deixe em branco" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500 shadow-sm" />
                                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Data de nascimento</label>
                                  <div className="relative group">
                                    <input type="date" name="birthDate" defaultValue={editingMember?.birthDate} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Sexo</label>
                                  <div className="flex gap-4 py-2">
                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="gender" value="M" defaultChecked={editingMember?.gender === 'M'} className="w-4 h-4 text-teal-600" /><span className="text-xs font-bold text-slate-700">Masculino</span></label>
                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="gender" value="F" defaultChecked={editingMember?.gender === 'F'} className="w-4 h-4 text-teal-600" /><span className="text-xs font-bold text-slate-700">Feminino</span></label>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Escolaridade</label>
                                  <select name="education" defaultValue={editingMember?.education} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700">
                                    <option value="">Selecione...</option>
                                    <option value="Ensino Fundamental">Ensino Fundamental</option>
                                    <option value="Ensino Médio">Ensino Médio</option>
                                    <option value="Ensino Superior - Cursando">Ensino Superior - Cursando</option>
                                    <option value="Ensino Superior - Completo">Ensino Superior - Completo</option>
                                    <option value="Pós-Graduação">Pós-Graduação</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Estado civil</label>
                                  <select name="maritalStatus" defaultValue={editingMember?.maritalStatus} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700">
                                    <option value="">Selecione...</option>
                                    <option value="Solteiro(a)">Solteiro(a)</option>
                                    <option value="Casado(a)">Casado(a)</option>
                                    <option value="Divorciado(a)">Divorciado(a)</option>
                                    <option value="Viúvo(a)">Viúvo(a)</option>
                                    <option value="União Estável">União Estável</option>
                                  </select>
                                </div>
                              </div>


                              <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Nome do Cônjuge</label><input name="spouseName" defaultValue={editingMember?.spouseName} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" /></div>
                            </div>
                          </div>

                          {/* Outras informações Card */}
                          <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                              <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                              <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Outras informações</h4>
                            </div>
                            <div className="p-8 space-y-6">
                              <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Categorias</label><input name="categories" defaultValue={editingMember?.categories} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" /></div>
                              <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Cargos</label><input name="cargos" defaultValue={editingMember?.cargos} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" /></div>
                              <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Data de conversão</label><input type="date" name="conversionDate" defaultValue={editingMember?.conversionDate} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" /></div>
                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Batizado</label>
                                  <div className="flex gap-4 py-2">
                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="isBaptized" value="true" defaultChecked={editingMember?.isBaptized === true} className="w-4 h-4 text-teal-600" /><span className="text-xs font-bold text-slate-700">Sim</span></label>
                                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="isBaptized" value="false" defaultChecked={editingMember?.isBaptized === false} className="w-4 h-4 text-teal-600" /><span className="text-xs font-bold text-slate-700">Não</span></label>
                                  </div>
                                </div>
                                <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Data de batismo</label><input type="date" name="baptismDate" defaultValue={editingMember?.baptismDate} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700" /></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-10">
                          {/* Contatos Card */}
                          <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                              <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                              <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Contatos</h4>
                            </div>
                            <div className="p-8 space-y-6">
                              <div className="grid grid-cols-2 gap-6">
                                <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Telefone 1</label><input name="phone" placeholder="+556199369261" defaultValue={editingMember?.phone} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Telefone 2</label><input name="phone2" defaultValue={editingMember?.phone2} placeholder="(00) 00000-0000" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                              </div>
                              <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">E-mail</label><input required name="email" type="email" defaultValue={editingMember?.email} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                              <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Nível de Acesso</label><select name="role" defaultValue={editingMember?.role || UserRole.READER} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500"><option value={UserRole.ADMIN}>Administrador</option><option value={UserRole.TREASURER}>Tesoureiro</option><option value={UserRole.READER}>Membro Comum</option></select></div>
                            </div>
                          </div>

                          {/* Endereço Card */}
                          <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                              <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                              <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Endereço</h4>
                            </div>
                            <div className="p-8 space-y-6">
                              <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Endereço</label><input name="address" defaultValue={editingMember?.address} placeholder="Rua, Conjunto..." className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                              <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Número</label><input name="addressNumber" defaultValue={editingMember?.addressNumber} placeholder="Ex: 6g 38" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                              <div className="grid grid-cols-2 gap-6">
                                <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Bairro</label><input name="neighborhood" defaultValue={editingMember?.neighborhood} placeholder="Ex: Jardim Roriz" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                                <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">CEP</label><input name="cep" defaultValue={editingMember?.cep} placeholder="73340-607" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                              </div>
                              <div className="grid grid-cols-2 gap-6">
                                <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">País</label><select name="country" defaultValue={editingMember?.country || 'Brazil'} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700"><option value="Brazil">Brazil</option></select></div>
                                <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Estado</label><input name="state" defaultValue={editingMember?.state} placeholder="Distrito Federal" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                              </div>
                              <div><label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Cidade</label><input name="city" defaultValue={editingMember?.city} placeholder="Brasília" className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 focus:border-teal-500" /></div>
                            </div>
                          </div>

                          {/* Anotações Card */}
                          <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-8 py-4 border-b border-indigo-50 flex items-center gap-2 bg-slate-50/50">
                              <svg className="w-5 h-5 text-[#004a7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              <h4 className="text-sm font-black text-[#004a7c] uppercase tracking-tight">Anotações</h4>
                            </div>
                            <div className="p-8">
                              <textarea name="notes" defaultValue={editingMember?.notes} rows={8} className="w-full px-4 py-3 bg-white border border-teal-500/30 rounded-lg outline-none font-bold text-slate-700 resize-none focus:border-teal-500" placeholder="Digite suas anotações aqui..." />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button type="button" onClick={() => setViewingMemberSubTab('info')} className="flex-1 px-4 py-4 border border-slate-200 rounded-[24px] font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition">Descartar</button>
                        <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-4 rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition disabled:opacity-50">
                          {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {
        isScaleModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
              <div className="bg-slate-50 p-6 flex items-center justify-between border-b border-slate-100">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Editor de escala</h3>
                <button onClick={() => setIsScaleModalOpen(false)} className="hover:bg-slate-200 p-2 rounded-full transition">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSaveScale} className="p-8 space-y-6 overflow-y-auto">
                <div>
                  <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Título</label>
                  <input required value={editingScale?.title || ''} onChange={e => setEditingScale({ ...editingScale, title: e.target.value })} placeholder="Ex: Escala de orações" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-700 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Local</label>
                  <input required value={editingScale?.location || ''} onChange={e => setEditingScale({ ...editingScale, location: e.target.value })} placeholder="Ex: Templo central" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-700 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Descrição</label>
                  <textarea rows={3} value={editingScale?.description || ''} onChange={e => setEditingScale({ ...editingScale, description: e.target.value })} placeholder="Ex: escala para o dia ..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-700 focus:border-indigo-500 resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Tipo da escala</label>
                    <select value={editingScale?.type || 'Dia'} onChange={e => setEditingScale({ ...editingScale, type: e.target.value })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-700">
                      <option value="Dia">Dia</option>
                      <option value="Noite">Noite</option>
                      <option value="Evento">Evento</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Data</label>
                    <input type="date" required value={editingScale?.date || ''} onChange={e => setEditingScale({ ...editingScale, date: e.target.value })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-700" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Início</label>
                    <input type="time" required value={editingScale?.startTime || ''} onChange={e => setEditingScale({ ...editingScale, startTime: e.target.value })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-800 uppercase mb-2">Fim</label>
                    <input type="time" required value={editingScale?.endTime || ''} onChange={e => setEditingScale({ ...editingScale, endTime: e.target.value })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-700" />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-[10px] font-bold text-slate-800 uppercase">Participantes</label>
                    <select onChange={e => {
                      if (e.target.value && !scaleParticipants.includes(e.target.value)) {
                        setScaleParticipants([...scaleParticipants, e.target.value]);
                      }
                    }} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-bold w-48">
                      <option value="">+ Adicionar</option>
                      {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    {scaleParticipants.length === 0 && <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-bold">*Sem participantes</div>}
                    {scaleParticipants.map(uid => {
                      const u = allUsers.find(user => user.id === uid);
                      if (!u) return null;
                      return (
                        <div key={uid} className="flex items-center justify-between bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                          <div className="flex items-center gap-3">
                            <img src={u.avatarUrl || `https://ui-avatars.com/api/?name=${u.name}`} className="w-8 h-8 rounded-full" />
                            <span className="text-sm font-bold text-indigo-900">{u.name}</span>
                          </div>
                          <button type="button" onClick={() => setScaleParticipants(scaleParticipants.filter(p => p !== uid))} className="text-indigo-400 hover:text-rose-500 font-bold p-1">Remover</button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsScaleModalOpen(false)} className="flex-1 py-4 border border-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition">Cancelar</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Floating Action Button - Mobile Only */}
      {
        ['overview', 'finances', 'members', 'agenda'].includes(activeTab) && (
          <div className="lg:hidden fixed bottom-32 right-8 z-40">
            {activeTab === 'members' && user.role === UserRole.ADMIN && (
              <button
                onClick={() => { setEditingMember(null); setIsMemberModalOpen(true); }}
                className="bg-indigo-600 text-white w-16 h-16 rounded-full shadow-[0_15px_30px_rgba(79,70,229,0.4)] flex items-center justify-center hover:bg-indigo-700 transition-all duration-300 active:scale-90"
                title="Novo Membro"
              >
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </button>
            )}
            {(activeTab === 'overview' || activeTab === 'finances') && (user.role === UserRole.ADMIN || user.role === UserRole.TREASURER) && (
              <button
                onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                className="bg-indigo-600 text-white w-16 h-16 rounded-full shadow-[0_15px_30px_rgba(79,70,229,0.4)] flex items-center justify-center hover:bg-indigo-700 transition-all duration-300 active:scale-90"
                title="Nova Transação"
              >
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            )}
            {activeTab === 'agenda' && (
              <button
                onClick={() => { setEditingEvent(null); setIsEventModalOpen(true); }}
                className="bg-indigo-600 text-white w-16 h-16 rounded-full shadow-[0_15px_30px_rgba(79,70,229,0.4)] flex items-center justify-center hover:bg-indigo-700 transition-all duration-300 active:scale-90"
                title="Novo Evento"
              >
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            )}
          </div>
        )
      }

      <nav className="lg:hidden fixed bottom-6 left-4 right-4 bg-white/95 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[32px] z-40 print:hidden safe-area-bottom px-2 h-24">
        <div className="grid grid-cols-5 h-full items-center">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative ${activeTab === 'overview' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {activeTab === 'overview' && <div className="absolute -top-1 w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>}
            <svg className={`w-8 h-8 ${activeTab === 'overview' ? 'scale-110' : 'scale-100'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[11px] font-black uppercase tracking-[0.05em]">Início</span>
          </button>

          {(user.role === UserRole.ADMIN || user.role === UserRole.TREASURER) && (
            <button
              onClick={() => setActiveTab('finances')}
              className={`flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative ${activeTab === 'finances' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {activeTab === 'finances' && <div className="absolute -top-1 w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>}
              <svg className={`w-8 h-8 ${activeTab === 'finances' ? 'scale-110' : 'scale-100'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[11px] font-black uppercase tracking-[0.05em]">Finanças</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative ${activeTab === 'agenda' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {activeTab === 'agenda' && <div className="absolute -top-1 w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>}
            <svg className={`w-8 h-8 ${activeTab === 'agenda' ? 'scale-110' : 'scale-100'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[11px] font-black uppercase tracking-[0.05em]">Agenda</span>
          </button>

          {user.role === UserRole.ADMIN && (
            <button
              onClick={() => setActiveTab('members')}
              className={`flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative ${activeTab === 'members' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {activeTab === 'members' && <div className="absolute -top-1 w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>}
              <svg className={`w-8 h-8 ${activeTab === 'members' ? 'scale-110' : 'scale-100'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-[11px] font-black uppercase tracking-[0.05em]">Membros</span>
            </button>
          )}

          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-all duration-300"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[11px] font-black uppercase tracking-[0.05em]">Menu</span>
          </button>
        </div>
      </nav>

    </div >
  );
};
