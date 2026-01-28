
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
            <div className="aspect-[2/1] overflow-hidden rounded-3xl mb-6 shadow-lg relative">
              <img src={post.imageUrl} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" alt={post.title} />
              {post.isFavorite && (
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-md">
                  <svg className="w-6 h-6 text-yellow-500 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium text-indigo-600">
                <span>{post.date?.split('-').reverse().join('/')}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span>Por {post.author}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight group-hover:text-indigo-600 transition tracking-tight">{post.title}</h2>
              <p className="text-gray-600 text-base md:text-lg leading-relaxed line-clamp-3 md:line-clamp-4 whitespace-pre-line">
                {(() => {
                  const content = post.content
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<\/p>/gi, '\n')
                    .replace(/<\/div>/gi, '\n')
                    .replace(/<\/li>/gi, '\n')
                    .replace(/&nbsp;/g, ' ');

                  if (typeof window !== 'undefined') {
                    const doc = new DOMParser().parseFromString(content, 'text/html');
                    return doc.body.textContent || "";
                  }
                  return content.replace(/<[^>]*>/g, '');
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
