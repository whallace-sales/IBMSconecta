
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
    <div className="py-12 px-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-indigo-600 font-bold mb-8 hover:translate-x-[-4px] transition-transform"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Voltar para a lista
      </button>

      <article className="space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3 text-sm font-medium text-indigo-600">
            <span>{formattedDate}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span>Por {post.author}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight">{post.title}</h1>
        </header>

        <div className="aspect-[2/1] overflow-hidden rounded-[32px] shadow-2xl">
          <img src={post.imageUrl} className="w-full h-full object-cover" alt={post.title} />
        </div>

        <div
          className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-6 text-xl post-content"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <footer className="pt-12 border-t border-gray-100">
          <div className="bg-indigo-50 p-8 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img
                src={post.authorAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=random`}
                className="w-16 h-16 rounded-full border-4 border-white shadow-sm object-cover"
                alt={post.author}
              />
              <div>
                <p className="font-bold text-gray-900">Escrito por {post.author}</p>
                <p className="text-sm text-gray-500">Membro da Equipe de Comunicação da IBMS - Planaltina-DF</p>
              </div>
            </div>
            <div className="bg-white/50 px-6 py-3 rounded-2xl border border-indigo-100 flex flex-col items-center md:items-end">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Publicado em</span>
              <span className="font-black text-indigo-900">{formattedDate} às {postTime}</span>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
};
