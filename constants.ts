
import { UserRole, Post, Transaction, User, Category, ChurchInfo } from './types';

export const INITIAL_CHURCH_INFO: ChurchInfo = {
  name: 'IgrejaConecta',
  logoUrl: '', // String vazia usará o ícone padrão
  address: 'Rua da Fé, 123 - Centro',
  phone: '(11) 99999-9999',
  email: 'contato@igrejaconecta.com.br'
};

export const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: 'Dízimos', color: 'indigo' },
  { id: '2', name: 'Ofertas', color: 'emerald' },
  { id: '3', name: 'Infraestrutura', color: 'amber' },
  { id: '4', name: 'Utilidades', color: 'blue' },
  { id: '5', name: 'Manutenção', color: 'rose' },
  { id: '6', name: 'Missões', color: 'teal' },
];

export const MOCK_POSTS: Post[] = [
  {
    id: '1',
    title: 'Grande Culto de Celebração',
    content: 'Junte-se a nós neste domingo para uma manhã de louvor e adoração inesquecível. Estaremos celebrando as bênçãos do último mês.',
    author: 'Pr. Silva',
    date: '2024-05-20',
    imageUrl: 'https://picsum.photos/seed/church1/800/400'
  },
  {
    id: '2',
    title: 'Ação Social no Bairro',
    content: 'Nossa equipe de missões estará realizando uma distribuição de cestas básicas e atendimento comunitário no próximo sábado.',
    author: 'Miss. Ana',
    date: '2024-05-22',
    imageUrl: 'https://picsum.photos/seed/charity/800/400'
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 't1', description: 'Dízimos Mensais', amount: 15400.00, type: 'INCOME', category: 'Dízimos', date: '2024-05-01', member: 'João Silva' },
  { id: 't2', description: 'Oferta de Missões', amount: 2300.50, type: 'INCOME', category: 'Ofertas', date: '2024-05-05', member: 'Maria Oliveira' },
  { id: 't3', description: 'Aluguel do Templo', amount: 4500.00, type: 'EXPENSE', category: 'Infraestrutura', date: '2024-05-10' },
];

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Administrador Geral', email: 'admin@igreja.com', role: UserRole.ADMIN, birthDate: '1985-05-15' },
  { id: '2', name: 'Tesoureiro Principal', email: 'financas@igreja.com', role: UserRole.TREASURER, birthDate: '1990-06-20' },
  { id: '3', name: 'Membro Leitor', email: 'leitor@igreja.com', role: UserRole.READER, birthDate: '1995-12-10' },
];
