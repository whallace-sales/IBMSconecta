
import React from 'react';
import { User, ChurchInfo } from '../types';

interface NavbarProps {
  isLoggedIn: boolean;
  onNavigate: (view: 'home' | 'blog' | 'login' | 'dashboard' | 'post-detail', postId?: string) => void;
  user: User | null;
  onLogout: () => void;
  churchInfo: ChurchInfo;
}

export const Navbar: React.FC<NavbarProps> = ({ isLoggedIn, onNavigate, user, onLogout, churchInfo }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onNavigate('home')}>
            <div className="bg-transparent transition-transform duration-300 group-hover:scale-105">
              <img src={churchInfo.logoUrl || '/logo.png'} className="h-16 w-auto object-contain" alt="Logo" />
            </div>
            <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter group-hover:text-indigo-600 transition-colors">{churchInfo.name}</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-10">
            <button onClick={() => onNavigate('home')} className="text-gray-600 hover:text-indigo-600 font-bold text-lg transition flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              Início
            </button>
            <button onClick={() => onNavigate('blog')} className="text-gray-600 hover:text-indigo-600 font-bold text-lg transition flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2zM7 8h5m-5 4h10" /></svg>
              Postagens
            </button>
            {isLoggedIn ? (
              <div className="flex items-center gap-6">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="bg-indigo-50 text-indigo-700 px-6 py-3 rounded-2xl font-black text-lg hover:bg-indigo-100 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Acesso ao Sistema
                </button>
                <button
                  onClick={onLogout}
                  className="text-gray-500 hover:text-red-600 font-bold text-lg transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3 3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Sair
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
              >
                Acessar Sistema
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
              className="w-full text-left px-6 py-5 rounded-2xl text-2xl font-black text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-3"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              Início
            </button>
            <button
              onClick={() => { onNavigate('blog'); setIsOpen(false); }}
              className="w-full text-left px-6 py-5 rounded-2xl text-2xl font-black text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-3"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2zM7 8h5m-5 4h10" /></svg>
              Postagens
            </button>
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => { onNavigate('dashboard'); setIsOpen(false); }}
                  className="w-full text-left px-6 py-5 rounded-2xl text-2xl font-black bg-indigo-600 text-white shadow-lg shadow-indigo-100 flex items-center gap-3"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Acesso ao Sistema
                </button>
                <button
                  onClick={() => { onLogout(); setIsOpen(false); }}
                  className="w-full text-left px-6 py-5 rounded-2xl text-2xl font-black text-red-500 hover:bg-red-50 transition-all flex items-center gap-3"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3 3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Sair
                </button>
              </>
            ) : (
              <button
                onClick={() => { onNavigate('login'); setIsOpen(false); }}
                className="w-full text-left px-6 py-5 rounded-2xl text-2xl font-black bg-indigo-600 text-white shadow-lg shadow-indigo-100"
              >
                Acessar Sistema
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
