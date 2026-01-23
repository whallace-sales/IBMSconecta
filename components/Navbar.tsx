
import React from 'react';
import { User } from '../types';

interface NavbarProps {
  isLoggedIn: boolean;
  onNavigate: (view: 'home' | 'blog' | 'login' | 'dashboard' | 'post-detail', postId?: string) => void;
  user: User | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isLoggedIn, onNavigate, user, onLogout }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="bg-transparent">
              <img src="/logo.png" className="h-14 w-auto object-contain" alt="Logo IBMS" />
            </div>
            <span className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter">IBMS</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-10">
            <button onClick={() => onNavigate('home')} className="text-gray-600 hover:text-indigo-600 font-bold text-lg transition">Início</button>
            <button onClick={() => onNavigate('blog')} className="text-gray-600 hover:text-indigo-600 font-bold text-lg transition">Postagens</button>
            {isLoggedIn ? (
              <div className="flex items-center gap-6">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="bg-indigo-50 text-indigo-700 px-6 py-3 rounded-2xl font-black text-lg hover:bg-indigo-100 transition"
                >
                  Dashboard
                </button>
                <button
                  onClick={onLogout}
                  className="text-gray-500 hover:text-red-600 font-bold text-lg transition"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
              >
                Acessar Portal
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-3 rounded-2xl bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-200"
            >
              {isOpen ? (
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-white border-b border-slate-100 animate-in slide-in-from-top duration-300">
          <div className="px-6 py-8 space-y-4">
            <button
              onClick={() => { onNavigate('home'); setIsOpen(false); }}
              className="w-full text-left px-6 py-5 rounded-2xl text-2xl font-black text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              Início
            </button>
            <button
              onClick={() => { onNavigate('blog'); setIsOpen(false); }}
              className="w-full text-left px-6 py-5 rounded-2xl text-2xl font-black text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              Postagens
            </button>
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => { onNavigate('dashboard'); setIsOpen(false); }}
                  className="w-full text-left px-6 py-5 rounded-2xl text-2xl font-black bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => { onLogout(); setIsOpen(false); }}
                  className="w-full text-left px-6 py-5 rounded-2xl text-2xl font-black text-red-500 hover:bg-red-50 transition-all"
                >
                  Sair
                </button>
              </>
            ) : (
              <button
                onClick={() => { onNavigate('login'); setIsOpen(false); }}
                className="w-full text-left px-6 py-5 rounded-2xl text-2xl font-black bg-indigo-600 text-white shadow-lg shadow-indigo-100"
              >
                Acessar Portal
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
