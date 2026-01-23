
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
  cep?: string;
  city?: string;
  neighborhood?: string;
  state?: string;
  maritalStatus?: string;
  education?: string;
  spouseName?: string;
  conversionDate?: string;
  baptismDate?: string;
  isBaptized?: boolean;
  notes?: string;
  phone?: string;
  phone2?: string;
  doc1?: string;
  doc2?: string;
  addressNumber?: string;
  country?: string;
  categories?: string;
  cargos?: string;
  avatarUrl?: string;
  mustChangePassword?: boolean;
  gender?: 'M' | 'F' | 'OTHER';
  createdAt?: string;
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
  type: 'INCOME' | 'EXPENSE';
  description?: string;
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
  isPaid?: boolean;
  costCenter?: string;
  paymentType?: string;
  docNumber?: string;
  competence?: string;
  notes?: string;
  attachmentUrls?: string[];
}

export interface ChurchStats {
  totalMembers: number;
  monthlyIncome: number;
  monthlyExpense: number;
  activeMinistries: number;
}

export interface EventCategory {
  id: string;
  name: string;
  color: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  categoryId?: string;
  isPrivate: boolean;
  repeat?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  bannerUrl?: string;
  icon?: string;
  isActive: boolean;
  createdAt: string;
}

export interface DepartmentRole {
  id: string;
  departmentId: string;
  name: string;
}

export interface DepartmentMember {
  id: string;
  departmentId: string;
  userId: string;
  user?: User;
  roles: string[]; // List of role names or IDs
}
