import React, { useState } from 'react';

interface HelpCenterProps {
    onTalkToSupport?: () => void;
}

const HelpCenter: React.FC<HelpCenterProps> = ({ onTalkToSupport }) => {
    const [isOpen, setIsOpen] = useState(false);

    const tutorialVideos = [
        {
            id: 'tutorial-1',
            title: 'Visão Geral do Sistema',
            duration: '5:20',
            thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop',
            youtubeId: 'dQw4w9WgXcQ', // Placeholder
        },
        {
            id: 'tutorial-2',
            title: 'Gestão Financeira e Livro Caixa',
            duration: '8:45',
            thumbnail: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=800&auto=format&fit=crop',
            youtubeId: 'dQw4w9WgXcQ',
        },
        {
            id: 'tutorial-3',
            title: 'Cadastro de Membros e Departamentos',
            duration: '6:15',
            thumbnail: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop',
            youtubeId: 'dQw4w9WgXcQ',
        }
    ];

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-8 right-8 z-[60] group flex items-center gap-3 bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white p-4 pr-6 rounded-full shadow-[0_10px_30px_rgba(79,70,229,0.3)] transition-all duration-500 hover:scale-105 active:scale-95 border border-indigo-50"
                title="Centro de Ajuda"
            >
                <div className="bg-indigo-600 group-hover:bg-white text-white group-hover:text-indigo-600 w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500 shadow-md">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <span className="font-black text-[11px] uppercase tracking-widest">Suporte & Ajuda</span>
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-300">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Content */}
                    <div className="relative bg-white w-full max-w-5xl h-fit max-h-[90vh] rounded-[48px] shadow-2xl flex flex-col lg:flex-row overflow-hidden border border-white/20">
                        {/* Sidebar */}
                        <div className="lg:w-80 bg-slate-50 p-8 flex flex-col gap-8 shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Ajuda & <br /><span className="text-indigo-600">Treinamento</span></h3>
                                <p className="text-slate-400 font-medium text-xs mt-3 leading-relaxed">Aprenda a dominar o sistema em poucos minutos com nossos tutoriais.</p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button className="flex items-center gap-3 w-full p-4 rounded-3xl bg-white shadow-sm border border-slate-100 text-left group hover:border-indigo-200 transition">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Vídeos Tutoriais</span>
                                </button>
                                <button className="flex items-center gap-3 w-full p-4 rounded-3xl bg-transparent border border-transparent text-left group hover:bg-white hover:shadow-sm hover:border-slate-100 transition">
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-amber-50 group-hover:text-amber-600 transition">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900">Perguntas Frequentes</span>
                                </button>
                            </div>

                            <div className="mt-auto pt-8 border-t border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Ainda com dúvidas?</p>
                                <button
                                    onClick={() => {
                                        const message = "Olá! Preciso de ajuda com o sistema Igreja Conecta.";
                                        window.open(`https://wa.me/556199369261?text=${encodeURIComponent(message)}`, '_blank');
                                    }}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white p-5 rounded-3xl shadow-xl shadow-emerald-50 transition-all duration-300 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 group"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                    Falar com Suporte
                                </button>
                            </div>
                        </div>

                        {/* Main Area */}
                        <div className="flex-grow p-8 lg:p-12 overflow-y-auto">
                            <div className="flex items-center justify-between mb-10">
                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Vídeos Tutoriais</h4>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 text-slate-300 hover:text-slate-900 transition"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {tutorialVideos.map((video) => (
                                    <div key={video.id} className="group relative">
                                        <div className="relative aspect-video rounded-[32px] overflow-hidden shadow-lg border border-slate-100 group-hover:shadow-2xl group-hover:shadow-indigo-100 transition-all duration-500">
                                            <img
                                                src={video.thumbnail}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                alt={video.title}
                                            />
                                            <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/20 transition-colors duration-500" />

                                            {/* Play Button */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <button
                                                    onClick={() => window.open(`https://www.youtube.com/watch?v=${video.youtubeId}`, '_blank')}
                                                    className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform duration-500 border border-white/30"
                                                >
                                                    <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                                </button>
                                            </div>

                                            {/* Duration Badge */}
                                            <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-white">
                                                {video.duration}
                                            </div>
                                        </div>

                                        <div className="mt-5 px-4">
                                            <h5 className="font-black text-slate-800 text-sm tracking-tight leading-snug group-hover:text-indigo-600 transition-colors">{video.title}</h5>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vídeo Aula</span>
                                                <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                <button
                                                    onClick={() => window.open(`https://www.youtube.com/watch?v=${video.youtubeId}`, '_blank')}
                                                    className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                                                >
                                                    Assistir Completo
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Empty State / Coming Soon */}
                                <div className="md:col-span-2 bg-indigo-50/50 border-2 border-dashed border-indigo-100 rounded-[32px] p-12 flex flex-col items-center justify-center text-center group hover:bg-white hover:border-indigo-300 transition-all duration-500">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-400 shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                    </div>
                                    <h6 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Base de Conhecimento</h6>
                                    <p className="text-slate-400 font-medium text-xs mt-2">Estamos preparando mais de 20 novos guias práticos para você.</p>
                                    <button className="mt-6 text-[10px] font-black text-indigo-600 uppercase tracking-widest py-2 px-6 rounded-full border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">Ver Documentação</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default HelpCenter;
