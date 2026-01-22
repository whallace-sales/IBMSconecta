
export enum UserRole {
  ADMIN = 'ADMIN',
  TREASURER = 'TESOUREIRO',
  READER = 'LEITOR'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  isFirstAccess?: boolean;
  birthDate?: string;
  address?: string;
  phone?: string;
  avatarUrl?: string;
  mustChangePassword?: boolean;
}

export interface ChurchInfo {
  name: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  authorAvatarUrl?: string;
  date: string;
  imageUrl: string;
  isActive?: boolean;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  date: string;
  member?: string;
}

export interface ChurchStats {
  totalMembers: number;
  monthlyIncome: number;
  monthlyExpense: number;
  activeMinistries: number;
}
