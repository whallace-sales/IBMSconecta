
import React, { useEffect, useState } from 'react';
import { Post } from '../types';
import { getPosts } from '../services/api';

interface PublicBlogProps {
  onNavigate: (view: 'home' | 'blog' | 'login' | 'dashboard' | 'post-detail', postId?: string) => void;
}

export const PublicBlog: React.FC<PublicBlogProps> = ({ onNavigate }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPosts().then(data => {
      setPosts(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-slate-500">Carregando mensagens...</div>;
  }

  return (
    <div className="py-12 px-6 max-w-4xl mx-auto animate-in slide-in-from-bottom duration-500">
      <h1 className="text-4xl font-bold mb-2 text-gray-900">Comunicados e Mensagens</h1>
      <p className="text-gray-600 mb-12 border-b border-gray-200 pb-8">Acompanhe as últimas atualizações da nossa comunidade e mensagens pastorais.</p>

      <div className="space-y-16">
        {posts.map(post => (
          <article key={post.id} className="group">
            <div className="aspect-[2/1] overflow-hidden rounded-3xl mb-6 shadow-lg">
              <img src={post.imageUrl} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" alt={post.title} />
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium text-indigo-600">
                <span>{post.date?.split('-').reverse().join('/')}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span>Por {post.author}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight group-hover:text-indigo-600 transition tracking-tight">{post.title}</h2>
              <p className="text-gray-600 text-base md:text-lg leading-relaxed line-clamp-3 md:line-clamp-3">
                {(() => {
                  if (typeof window !== 'undefined') {
                    const doc = new DOMParser().parseFromString(post.content, 'text/html');
                    return doc.body.textContent || "";
                  }
                  return post.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
                })()}
              </p>
              <button
                onClick={() => onNavigate('post-detail', post.id)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-semibold transition"
              >
                Continuar lendo
              </button>
            </div>
          </article>
        ))}
        {posts.length === 0 && (
          <p className="text-gray-500 italic">Nenhuma mensagem publicada ainda.</p>
        )}
      </div>
    </div>
  );
};
