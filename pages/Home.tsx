
import React, { useEffect, useState } from 'react';
import { Post, ChurchInfo } from '../types';
import { getPosts } from '../services/api';

interface HomeProps {
  onNavigate: (view: 'home' | 'blog' | 'login' | 'dashboard' | 'post-detail', postId?: string) => void;
  churchInfo: ChurchInfo;
}

export const Home: React.FC<HomeProps> = ({ onNavigate, churchInfo }) => {
  const [latestPosts, setLatestPosts] = useState<Post[]>([]);

  useEffect(() => {
    getPosts().then(posts => {
      setLatestPosts(posts.slice(0, 3));
    });
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center text-white">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80"
            className="w-full h-full object-cover brightness-[0.4]"
            alt="Igreja interior"
          />
        </div>
        <div className="relative z-10 text-center px-4 max-w-3xl">
          <div className="flex justify-center mb-8">
            <div className="bg-white p-4 rounded-3xl shadow-2xl shadow-indigo-500/50 transform hover:scale-110 transition duration-500">
              <img src={churchInfo.logoUrl || '/logo.png'} className="h-24 w-auto object-contain" alt="Logo" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">Uma Família para Pertencer</h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200">Vivendo o evangelho de Cristo, servindo à comunidade e transformando vidas através do amor e da fé.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => onNavigate('blog')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full text-lg font-bold transition transform hover:scale-105"
            >
              Nossas Atividades
            </button>

          </div>
        </div>
      </section>

      {/* Featured Posts */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Últimas Notícias</h2>
            <p className="text-gray-600">Fique por dentro do que acontece em nossa comunidade.</p>
          </div>
          <button
            onClick={() => onNavigate('blog')}
            className="text-indigo-600 font-semibold hover:underline"
          >
            Ver tudo →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {latestPosts.map(post => (
            <div key={post.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition duration-300">
              <img src={post.imageUrl} className="w-full h-48 object-cover" alt={post.title} />
              <div className="p-6">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{post.date?.split('-').reverse().join('/')}</span>
                <h3 className="text-xl font-bold mt-2 mb-3 text-gray-900 line-clamp-1">{post.title}</h3>
                <p className="text-gray-600 line-clamp-2 text-sm leading-relaxed mb-4">{post.content}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Por {post.author}</span>
                  <button
                    onClick={() => onNavigate('post-detail', post.id)}
                    className="text-indigo-600 font-medium hover:text-indigo-800 text-sm"
                  >
                    Ler mais
                  </button>
                </div>
              </div>
            </div>
          ))}
          {latestPosts.length === 0 && (
            <div className="col-span-full text-center text-gray-400 py-10">
              Carregando novidades...
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
