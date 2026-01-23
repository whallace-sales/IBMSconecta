
import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PublicBlog } from './pages/PublicBlog';
import { PostDetail } from './pages/PostDetail';
import { supabase } from './supabaseClient';
import { getProfile, getChurchInfo } from './services/api';
import { ChurchInfo } from './types';
import { INITIAL_CHURCH_INFO } from './constants';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'home' | 'blog' | 'login' | 'dashboard' | 'post-detail'>('home');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [churchInfo, setChurchInfo] = useState<ChurchInfo>(INITIAL_CHURCH_INFO);

  // Fetch Church Info
  useEffect(() => {
    getChurchInfo().then(data => {
      if (data) setChurchInfo(data);
    });
  }, []);

  // Supabase Auth Listener
  useEffect(() => {
    // Helper to handle session user
    const handleSession = async (session: any) => {
      if (session?.user) {
        let profile = await getProfile(session.user.id);
        const mustChangePassword = session.user.user_metadata?.must_change_password === true;

        if (profile) {
          profile = { ...profile, mustChangePassword };
        } else {
          console.warn('Profile not found, using Auth data as fallback');
          profile = {
            id: session.user.id,
            name: session.user.user_metadata?.name || 'Usuário',
            email: session.user.email || '',
            role: (session.user.user_metadata?.role as UserRole) || UserRole.READER,
            mustChangePassword
          } as User;
        }

        setUser(profile);
        if (view === 'login') setView('dashboard');
      } else {
        setUser(null);
        // Only redirect if effectively logging out from protected area
        if (view === 'dashboard') setView('home');
      }
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, [view]); // Added view dependency to properly handle redirects

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
    setUser(null);
    setView('home');
    window.location.reload(); // Garante limpeza total do estado
  };

  const navigateTo = (newView: 'home' | 'blog' | 'login' | 'dashboard' | 'post-detail', postId?: string) => {
    if (postId) setSelectedPostId(postId);
    setView(newView);
    window.scrollTo(0, 0);
  };

  const renderView = () => {
    switch (view) {
      case 'home':
        return <Home onNavigate={navigateTo} churchInfo={churchInfo} />;
      case 'blog':
        return <PublicBlog onNavigate={navigateTo} />;
      case 'post-detail':
        return selectedPostId ? (
          <PostDetail postId={selectedPostId} onBack={() => setView('blog')} />
        ) : (
          <Home onNavigate={navigateTo} />
        );
      case 'login':
        return <Login onLogin={() => setView('dashboard')} onBack={() => setView('home')} churchInfo={churchInfo} />;
      case 'dashboard':
        return user ? (
          <Dashboard user={user} onLogout={handleLogout} />
        ) : (
          <Home onNavigate={navigateTo} />
        );
      default:
        return <Home onNavigate={navigateTo} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {view !== 'dashboard' && view !== 'login' && (
        <Navbar
          isLoggedIn={!!user}
          onNavigate={navigateTo}
          user={user}
          onLogout={handleLogout}
          churchInfo={churchInfo}
        />
      )}
      <main className="flex-grow">
        {renderView()}
      </main>

      {view !== 'dashboard' && view !== 'login' && (
        <footer className="bg-slate-900 text-white py-20 px-6 border-t border-slate-800">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-white p-2.5 rounded-2xl shadow-xl shadow-indigo-500/20">
                  <img src={churchInfo.logoUrl || '/logo.png'} className="h-12 w-auto object-contain" alt="Logo" />
                </div>
                <h3 className="text-2xl font-black tracking-tighter text-white">{churchInfo.name}</h3>
              </div>
              <p className="text-slate-400 font-medium leading-relaxed">
                Levando a palavra e conectando corações em todos os lugares através da fé e do amor.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 mb-8">Navegação</h4>
              <ul className="space-y-4">
                <li>
                  <button onClick={() => setView('home')} className="group flex items-center gap-3 text-slate-400 hover:text-white transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-all"></div>
                    Início
                  </button>
                </li>
                <li>
                  <button onClick={() => setView('blog')} className="group flex items-center gap-3 text-slate-400 hover:text-white transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-all"></div>
                    Postagens
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 mb-8">Administrativo</h4>
              <ul className="space-y-4">
                <li>
                  <button onClick={() => setView('login')} className="group flex items-center gap-3 text-indigo-400 hover:text-indigo-300 font-bold transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    Acesso ao Sistema
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 mb-8">Contato</h4>
              <div className="space-y-4 text-slate-400">
                <p className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {churchInfo.address}
                </p>
                <p className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  {churchInfo.email}
                </p>
                <p className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1c-8.284 0-15-6.716-15-15V5z" /></svg>
                  {churchInfo.phone}
                </p>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs font-bold uppercase tracking-widest">
            <p>© 2026 {churchInfo.name} - Todos os direitos reservados.</p>
            <p>Desenvolvido por <span className="text-white">Renovo Tech</span></p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;
