
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
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    getPosts().then(posts => {
      setLatestPosts(posts.slice(0, 3));
    });
    getEvents().then(events => {
      // Filter only public and future events
      const today = new Date().toISOString().split('T')[0];
      const publicEvents = events
        .filter(e => !e.isPrivate && e.startDate >= today && !e.title.startsWith('[ESCALA]'))
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

          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">Uma Família para Pertencer</h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200">Vivendo o evangelho de Cristo, servindo à comunidade e transformando vidas através do amor e da fé.</p>
          <div className="flex flex-col gap-4 justify-center items-center">
            <button
              onClick={() => onNavigate('blog')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full text-lg font-bold transition transform hover:scale-105 w-full sm:w-auto"
            >
              Nossas Atividades
            </button>
            <button
              onClick={() => onNavigate('login')}
              className="text-white/80 hover:text-white text-sm font-semibold hover:underline mt-2 sm:hidden"
            >
              🔒 Acesso Restrito
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
                <div key={post.id} className="bg-white rounded-[2rem] overflow-hidden shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full border border-slate-100 group">
                  <img src={post.imageUrl} className="w-full h-48 object-cover" alt={post.title} />
                  <div className="p-6 flex-grow">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{post.date?.split('-').reverse().join('/')}</span>
                    <h3 className="text-xl font-bold mt-2 mb-3 text-gray-900 line-clamp-1">{post.title}</h3>
                    <p className="text-gray-600 line-clamp-2 text-sm leading-relaxed mb-4">
                      {(() => {
                        if (typeof window !== 'undefined') {
                          const doc = new DOMParser().parseFromString(post.content, 'text/html');
                          return doc.body.textContent || "";
                        }
                        return post.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
                      })()}
                    </p>
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
                  <div key={event.id} onClick={() => setSelectedEvent(event)} className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100 group cursor-pointer">
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
      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-indigo-600 p-6 text-white relative">
              <button
                onClick={() => setSelectedEvent(null)}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition p-2 hover:bg-white/10 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <div className="flex flex-col items-center text-center mt-2">
                {(() => {
                  const [y, m, d] = selectedEvent.startDate.split('-').map(Number);
                  const dateObj = new Date(y, m - 1, d);
                  const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                  return (
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center mb-4 border border-white/20 shadow-inner">
                      <span className="text-xs font-bold uppercase tracking-widest text-indigo-50">{monthName}</span>
                      <span className="text-3xl font-black text-white">{d}</span>
                    </div>
                  );
                })()}
                <h3 className="text-2xl font-bold leading-tight mb-2">{selectedEvent.title}</h3>
                <p className="text-indigo-100 font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {selectedEvent.startTime ? selectedEvent.startTime.substring(0, 5) : 'Dia todo'}
                  {selectedEvent.endTime ? ` - ${selectedEvent.endTime.substring(0, 5)}` : ''}
                </p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {selectedEvent.location && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-1">Localização</h4>
                    <p className="text-gray-600">{selectedEvent.location}</p>
                  </div>
                </div>
              )}

              {selectedEvent.description && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-1">Detalhes</h4>
                    <div
                      className="text-gray-600 text-sm leading-relaxed [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5"
                      dangerouslySetInnerHTML={{ __html: selectedEvent.description }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-4 rounded-xl transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
