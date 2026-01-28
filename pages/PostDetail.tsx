
import React, { useEffect, useState } from 'react';
import { Post } from '../types';
import { getPost } from '../services/api';

interface PostDetailProps {
  postId: string;
  onBack: () => void;
}

export const PostDetail: React.FC<PostDetailProps> = ({ postId, onBack }) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPost(postId).then(data => {
      setPost(data);
      setLoading(false);
    });
  }, [postId]);

  if (loading) {
    return <div className="text-center py-20 text-slate-500">Carregando detalhes da postagem...</div>;
  }

  if (!post) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-800">Postagem não encontrada</h2>
        <button onClick={onBack} className="mt-4 text-indigo-600 hover:underline font-bold">Voltar para Postagens</button>
      </div>
    );
  }

  // Formatting date from YYYY-MM-DD to DD/MM/YYYY
  const formattedDate = post.date.split('-').reverse().join('/');
  // Mocking a time as the current data structure doesn't include it yet
  const postTime = "09:45";

  return (
    <div className="pb-12 md:py-12 px-4 md:px-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* Mobile Navigation Header */}
      <div className="md:hidden sticky top-0 z-10 bg-white/90 backdrop-blur-md -mx-4 px-4 py-4 mb-6 border-b border-indigo-50 flex items-center shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-indigo-600 font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform"
        >
          <div className="p-2 bg-indigo-50 rounded-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </div>
          Voltar para a lista
        </button>
      </div>

      {/* Desktop Navigation */}
      <button
        onClick={onBack}
        className="hidden md:flex items-center gap-2 text-indigo-600 font-bold mb-8 hover:translate-x-[-4px] transition-transform"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Voltar para a lista
      </button>

      <article className="space-y-6 md:space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3 text-xs md:text-sm font-medium text-indigo-600">
            <span className="bg-indigo-50 px-3 py-1 rounded-full font-bold">{formattedDate}</span>
            <span className="hidden md:block w-1 h-1 bg-indigo-200 rounded-full"></span>
            <span className="text-slate-500">Por {post.author}</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight">{post.title}</h1>
        </header>

        <div className="aspect-video md:aspect-[2/1] overflow-hidden rounded-2xl md:rounded-[32px] shadow-xl md:shadow-2xl">
          <img src={post.imageUrl} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" alt={post.title} />
        </div>

        <div
          className="prose prose-lg prose-indigo max-w-none text-slate-700 leading-relaxed space-y-4 md:space-y-6 text-lg md:text-xl post-content"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <footer className="pt-8 md:pt-12 border-t border-slate-100">
          <div className="bg-indigo-50 p-6 md:p-8 rounded-3xl md:rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <img
                src={post.authorAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=random`}
                className="w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-white shadow-sm object-cover shrink-0"
                alt={post.author}
              />
              <div className="flex-grow">
                <p className="font-bold text-slate-900 text-lg">Escrito por {post.author}</p>
                <p className="text-xs md:text-sm text-slate-500 leading-snug">Membro da Equipe de Comunicação da IBMS - Planaltina-DF</p>
              </div>
            </div>
            <div className="bg-white/60 px-6 py-3 rounded-2xl border border-indigo-100/50 flex flex-col items-center md:items-end w-full md:w-auto">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Publicado em</span>
              <span className="font-bold text-indigo-900">{formattedDate} às {postTime}</span>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
};
