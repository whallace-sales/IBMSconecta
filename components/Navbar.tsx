
import React from 'react';
import { User } from '../types';

interface NavbarProps {
  isLoggedIn: boolean;
  onNavigate: (view: 'home' | 'blog' | 'login' | 'dashboard' | 'post-detail', postId?: string) => void;
  user: User | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isLoggedIn, onNavigate, user, onLogout }) => {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="bg-indigo-600 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">IgrejaConecta</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <button onClick={() => onNavigate('home')} className="text-gray-600 hover:text-indigo-600 font-medium transition">Início</button>
            <button onClick={() => onNavigate('blog')} className="text-gray-600 hover:text-indigo-600 font-medium transition">Postagens</button>
            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => onNavigate('dashboard')}
                  className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full font-medium hover:bg-indigo-100 transition"
                >
                  Dashbord
                </button>
                <button 
                  onClick={onLogout}
                  className="text-gray-500 hover:text-red-600 transition"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button 
                onClick={() => onNavigate('login')}
                className="bg-indigo-600 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-700 transition shadow-md shadow-indigo-100"
              >
                Acessar Portal
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
