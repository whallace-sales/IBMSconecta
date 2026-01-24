
import React, { useEffect, useState } from 'react';
import { Post, ChurchInfo, CalendarEvent } from '../types';
import { getPosts, getEvents } from '../services/api';

interface HomeProps {
  onNavigate: (view: 'home' | 'blog' | 'login' | 'dashboard' | 'post-detail', postId?: string) => void;
  churchInfo: ChurchInfo;
}

export const Home: React.FC<HomeProps> = ({ onNavigate, churchInfo }) => {
  const [latestPosts, setLatestPosts] = useState<Post[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    getPosts().then(posts => {
      setLatestPosts(posts.slice(0, 3));
    });
    getEvents().then(events => {
      // Filter only public and future events
      const today = new Date().toISOString().split('T')[0];
      const publicEvents = events
        .filter(e => !e.isPrivate && e.startDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 4);
      setUpcomingEvents(publicEvents);
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

      {/* Main Content: News & Events */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Featured Posts */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Últimas Notícias</h2>
                <p className="text-gray-600">Acompanhe as novidades da nossa igreja.</p>
              </div>
              <button onClick={() => onNavigate('blog')} className="text-indigo-600 font-semibold hover:underline">Ver tudo →</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {latestPosts.map(post => (
                <div key={post.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition duration-300 flex flex-col">
                  <img src={post.imageUrl} className="w-full h-48 object-cover" alt={post.title} />
                  <div className="p-6 flex-grow">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{post.date?.split('-').reverse().join('/')}</span>
                    <h3 className="text-xl font-bold mt-2 mb-3 text-gray-900 line-clamp-1">{post.title}</h3>
                    <p className="text-gray-600 line-clamp-2 text-sm leading-relaxed mb-4">{post.content.replace(/<[^>]*>/g, '')}</p>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                      <span className="text-sm text-gray-400">Por {post.author}</span>
                      <button onClick={() => onNavigate('post-detail', post.id)} className="text-indigo-600 font-medium hover:text-indigo-800 text-sm">Ler mais</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Events Sidebar */}
          <div>
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Agenda</h2>
              <p className="text-gray-600">Próximos eventos e reuniões.</p>
            </div>

            <div className="space-y-6">
              {upcomingEvents.map(event => {
                const [year, month, day] = event.startDate.split('-').map(Number);
                const dateObj = new Date(year, month - 1, day);
                const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

                return (
                  <div key={event.id} className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100 group">
                    <div className="bg-indigo-50 text-indigo-600 w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition duration-300">
                      <span className="text-xs font-bold uppercase">{monthName}</span>
                      <span className="text-xl font-black">{day}</span>
                    </div>
                    <div className="flex flex-col justify-center">
                      <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition">{event.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {event.startTime ? event.startTime.substring(0, 5) : 'Dia todo'}
                        {event.location && ` • ${event.location}`}
                      </p>
                    </div>
                  </div>
                );
              })}
              {upcomingEvents.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 text-sm italic">Nenhum evento público agendado.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
