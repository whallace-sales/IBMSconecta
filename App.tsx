
import React, { useState, useEffect } from 'react';
import { User } from './types';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PublicBlog } from './pages/PublicBlog';
import { PostDetail } from './pages/PostDetail';
import { supabase } from './supabaseClient';
import { getProfile } from './services/api';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'home' | 'blog' | 'login' | 'dashboard' | 'post-detail'>('home');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Supabase Auth Listener
  useEffect(() => {
    // Helper to handle session user
    const handleSession = async (session: any) => {
      if (session?.user) {
        let profile = await getProfile(session.user.id);

        // Fallback: If profile doesn't exist yet (trigger delay or error), create temp user from Auth
        if (!profile) {
          console.warn('Profile not found, using Auth data as fallback');
          profile = {
            id: session.user.id,
            name: session.user.user_metadata?.name || 'Usuário',
            email: session.user.email || '',
            role: session.user.user_metadata?.role || 'LEITOR',
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
    await supabase.auth.signOut();
    // Vew redirection handled by listener
  };

  const navigateTo = (newView: 'home' | 'blog' | 'login' | 'dashboard' | 'post-detail', postId?: string) => {
    if (postId) setSelectedPostId(postId);
    setView(newView);
    window.scrollTo(0, 0);
  };

  const renderView = () => {
    switch (view) {
      case 'home':
        return <Home onNavigate={navigateTo} />;
      case 'blog':
        return <PublicBlog onNavigate={navigateTo} />;
      case 'post-detail':
        return selectedPostId ? (
          <PostDetail postId={selectedPostId} onBack={() => setView('blog')} />
        ) : (
          <Home onNavigate={navigateTo} />
        );
      case 'login':
        return <Login onLogin={() => setView('dashboard')} onBack={() => setView('home')} />;
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
        />
      )}
      <main className="flex-grow">
        {renderView()}
      </main>

      {view !== 'dashboard' && view !== 'login' && (
        <footer className="bg-slate-900 text-white py-12 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">IgrejaConecta</h3>
              <p className="text-slate-400">Levando a palavra e conectando corações em todos os lugares.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Links Rápidos</h4>
              <ul className="space-y-2 text-slate-400">
                <li><button onClick={() => setView('home')}>Início</button></li>
                <li><button onClick={() => setView('blog')}>Postagens</button></li>
                <li><button onClick={() => setView('login')}>Área do Administrador</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contato</h4>
              <p className="text-slate-400">Rua da Fé, 123 - Centro</p>
              <p className="text-slate-400">contato@igrejaconecta.com.br</p>
            </div>
          </div>
          <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
            © 2026 Renovo Tech - Sistema Igrejaconecta. Todos os direitos reservados.
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;
