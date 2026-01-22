
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Transaction, Category, Post, ChurchInfo } from '../types';
import { INITIAL_CHURCH_INFO } from '../constants';
import { Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { supabase } from '../supabaseClient';
import { getTransactions, getCategories, getPosts, getProfile, getChurchInfo, updateChurchInfo } from '../services/api';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'finances' | 'posts' | 'members' | 'reports' | 'settings'>('overview');
  const [financeSubTab, setFinanceSubTab] = useState<'transactions' | 'categories'>('transactions');
  const [memberSubTab, setMemberSubTab] = useState<'list' | 'birthdays'>('list');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  const monthsList = [
    { id: 0, name: 'Jan' }, { id: 1, name: 'Fev' }, { id: 2, name: 'Mar' },
    { id: 3, name: 'Abr' }, { id: 4, name: 'Mai' }, { id: 5, name: 'Jun' },
    { id: 6, name: 'Jul' }, { id: 7, name: 'Ago' }, { id: 8, name: 'Set' },
    { id: 9, name: 'Out' }, { id: 10, name: 'Nov' }, { id: 11, name: 'Dez' }
  ];

  const tabTitles = {
    overview: 'Visão Geral',
    finances: 'Financeiro',
    posts: 'Conteúdo',
    members: 'Membros',
    reports: 'Relatórios',
    settings: 'Configurações'
  };

  // Estados de Dados
  const [churchInfo, setChurchInfo] = useState<ChurchInfo>(INITIAL_CHURCH_INFO);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  // Estados de Modais
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
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

  const fetchData = async () => {
    try {
      const [txs, cats, psts] = await Promise.all([
        getTransactions(),
        getCategories(),
        getPosts()
      ]);

      setTransactions(txs);
      setCategories(cats);
      setPosts(psts);

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

  const handleSaveTx = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Find category ID based on name (simple lookup)
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
    };

    try {
      if (editingTx) {
        await supabase.from('transactions').update(txData).eq('id', editingTx.id);
      } else {
        await supabase.from('transactions').insert([txData]);
      }
      setIsTxModalOpen(false);
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
      color: formData.get('color') as string,
    };
    try {
      if (editingCat) {
        await supabase.from('categories').update(catData).eq('id', editingCat.id);
      } else {
        await supabase.from('categories').insert([catData]);
      }
      setIsCatModalOpen(false);
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
      content: formData.get('content') as string,
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

  // --- Lógica de Filtros e Stats ---

  const globalStats = useMemo(() => ({
    income: transactions.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0),
    expense: transactions.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0),
  }), [transactions]);

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
          <SidebarItem id="settings" label="Configurações" roles={[UserRole.ADMIN]} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        </nav>
        <div className="p-8 border-t border-slate-100">
          <button onClick={onLogout} className="w-full text-red-500 hover:text-red-700 font-bold transition flex items-center justify-center gap-2">
            Sair do Painel
          </button>
        </div>
      </aside>

      <main className="flex-grow flex flex-col print:p-0">
        <header className="h-24 bg-white border-b border-slate-200 px-10 flex items-center justify-between sticky top-0 z-10 print:hidden">
          <h2 className="text-2xl font-black text-slate-900">{tabTitles[activeTab]}</h2>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-bold text-slate-900 leading-tight">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{user.role}</p>
            </div>
            <img src={user.avatarUrl || `https://i.pravatar.cc/100?u=${user.id}`} className="w-12 h-12 rounded-full border-2 border-indigo-100" alt="avatar" />
          </div>
        </header>

        <div className="p-10 print:p-0">
          {activeTab === 'overview' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col">
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
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Total Entradas</p>
                    <p className="text-3xl font-black text-emerald-600">{formatCurrency(globalStats.income)}</p>
                  </div>
                  <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Total Saídas</p>
                    <p className="text-3xl font-black text-red-600">{formatCurrency(globalStats.expense)}</p>
                  </div>
                  <div className="bg-indigo-600 p-8 rounded-[32px] text-white md:col-span-2 shadow-lg">
                    <p className="text-indigo-200 font-bold text-[10px] uppercase tracking-widest mb-1">Saldo em Caixa</p>
                    <p className="text-5xl font-black">{formatCurrency(globalStats.income - globalStats.expense)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
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
                <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100">
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-black text-slate-900 uppercase text-sm tracking-widest">Movimentações</h3>
                    <button onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition">+ Novo Lançamento</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest"><th className="px-8 py-5">Data</th><th className="px-8 py-5">Descrição</th><th className="px-8 py-5">Categoria</th><th className="px-8 py-5 text-right">Valor</th><th className="px-8 py-5 text-center">Ações</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transactions.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50 transition group">
                            <td className="px-8 py-6 text-slate-500 text-xs font-bold">{t.date.split('-').reverse().join('/')}</td>
                            <td className="px-8 py-6">
                              <div className="font-bold text-slate-700">{t.description}</div>
                              {t.member && <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Membro: {t.member}</div>}
                            </td>
                            <td className="px-8 py-6"><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-tighter">{t.category}</span></td>
                            <td className={`px-8 py-6 text-right font-black ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</td>
                            <td className="px-8 py-6 text-center">
                              <div className="flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={() => { setEditingTx(t); setIsTxModalOpen(true); }} className="text-indigo-600 font-black text-[10px] uppercase hover:underline">Editar</button>
                                <button onClick={() => handleDeleteTx(t.id)} className="text-red-500 font-black text-[10px] uppercase hover:underline">Remover</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {categories.map(cat => (
                    <div key={cat.id} className="bg-white p-8 rounded-[32px] border border-slate-100 flex items-center justify-between group shadow-sm hover:border-indigo-200 transition">
                      <span className="font-black text-slate-800 uppercase text-xs tracking-widest">{cat.name}</span>
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full bg-${cat.color}-500 shadow-lg`}></div>
                        <button onClick={() => { if (confirm('Excluir categoria?')) setCategories(categories.filter(c => c.id !== cat.id)); }} className="text-red-400 opacity-0 group-hover:opacity-100 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setEditingCat(null); setIsCatModalOpen(true); }} className="border-2 border-dashed border-slate-200 rounded-[32px] p-8 text-slate-400 font-black text-xs uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 transition">+ Adicionar Categoria</button>
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
              </div>

              {memberSubTab === 'list' ? (
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
              ) : (
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
                      <p className="text-slate-500 text-sm line-clamp-2 mb-8 leading-relaxed font-medium">{post.content}</p>
                      <div className="flex gap-4 pt-6 border-t border-slate-50">
                        <button onClick={() => { setEditingPost(post); setIsPostModalOpen(true); }} className="text-indigo-600 font-black text-[10px] uppercase hover:underline">Editar</button>
                        <button onClick={() => togglePostVisibility(post.id)} className={`${post.isActive ? 'text-orange-500' : 'text-emerald-500'} font-black text-[10px] uppercase hover:underline`}>{post.isActive ? 'Ocultar' : 'Exibir'}</button>
                        <button onClick={() => { if (confirm('Excluir permanentemente?')) setPosts(posts.filter(p => p.id !== post.id)); }} className="text-red-500 font-black text-[10px] uppercase hover:underline">Excluir</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-10">
            <h3 className="text-2xl font-black mb-8 text-slate-900 tracking-tight">{editingTx ? 'Editar Registro' : 'Novo Registro'}</h3>
            <form onSubmit={handleSaveTx} className="space-y-5">
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">O que aconteceu?</label><input required name="description" placeholder="Ex: Pagamento da Conta de Luz..." defaultValue={editingTx?.description} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Responsável (Opcional)</label><input name="member" placeholder="Nome da pessoa vinculada..." defaultValue={editingTx?.member} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor (R$)</label><input required name="amount" type="number" step="0.01" defaultValue={editingTx?.amount} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Data</label><input required name="date" type="date" defaultValue={editingTx?.date || new Date().toISOString().split('T')[0]} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Natureza</label><select name="type" defaultValue={editingTx?.type || 'INCOME'} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold"><option value="INCOME">Entrada (+)</option><option value="EXPENSE">Saída (-)</option></select></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categoria</label><select name="category" defaultValue={editingTx?.category} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold">{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              </div>
              <div className="pt-6 flex gap-4"><button type="button" onClick={() => setIsTxModalOpen(false)} className="flex-1 px-4 py-4 border border-slate-200 rounded-[20px] font-black uppercase text-[10px] tracking-widest">Descartar</button><button type="submit" className="flex-1 bg-indigo-600 text-white rounded-[20px] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100">Confirmar</button></div>
            </form>
          </div>
        </div>
      )}

      {isCatModalOpen && (
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
      )}

      {isMemberModalOpen && (
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
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nascimento</label><input type="date" name="birthDate" defaultValue={editingMember?.birthDate} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold" /></div>
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
      )}

      {isPostModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in"><div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-10"><h3 className="text-2xl font-black mb-8 text-slate-900 tracking-tight">Postagem</h3><form onSubmit={handleSavePost} className="space-y-6"><input required name="title" placeholder="Título da Publicação" defaultValue={editingPost?.title} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold" /><input name="imageUrl" placeholder="URL da Imagem de Destaque" defaultValue={editingPost?.imageUrl} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold" /><textarea required name="content" defaultValue={editingPost?.content} rows={6} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none font-bold resize-none" placeholder="Conteúdo da mensagem..."></textarea><div className="pt-4 flex gap-4"><button type="button" onClick={() => setIsPostModalOpen(false)} className="flex-1 px-4 py-4 border border-slate-200 rounded-[20px] font-black uppercase text-[10px] tracking-widest">Voltar</button><button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-[20px] font-black uppercase text-[10px] tracking-widest shadow-xl">Publicar</button></div></form></div></div>
      )}
      {isChangePasswordModalOpen && (
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
    </div>
  );
};
