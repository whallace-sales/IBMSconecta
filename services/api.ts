
import { supabase } from '../supabaseClient';
import { User, UserRole, Post, Transaction, Category, CalendarEvent, EventCategory, ChurchInfo, Department, DepartmentRole, DepartmentMember } from '../types';

// --- Auth & Profile ---
export const getProfile = async (userId: string): Promise<User | null> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }

    return {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as UserRole,
        birthDate: data.birth_date,
        address: data.address,
        phone: data.phone,
        avatarUrl: data.avatar_url,
    };
};

// --- Posts ---
export const getPosts = async (): Promise<Post[]> => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(name, avatar_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching posts:', error);
        return [];
    }

    return data.map((post: any) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        author: post.profiles?.name || 'Equipe Igreja',
        authorAvatarUrl: post.profiles?.avatar_url,
        date: post.date,
        imageUrl: post.image_url,
        isActive: post.is_active
    }));
};

export const getPost = async (id: string): Promise<Post | null> => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(name, avatar_url)')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching post:', error);
        return null;
    }

    return {
        id: data.id,
        title: data.title,
        content: data.content,
        author: data.profiles?.name || 'Equipe Igreja',
        authorAvatarUrl: data.profiles?.avatar_url,
        date: data.date,
        imageUrl: data.image_url,
        isActive: data.is_active
    };
};

// --- Transactions ---
export const getTransactions = async (): Promise<Transaction[]> => {
    const { data, error } = await supabase
        .from('transactions')
        .select(`
      *,
      categories (name, color)
    `)
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }

    return data.map((t: any) => ({
        id: t.id,
        description: t.description,
        amount: Number(t.amount),
        type: t.type,
        category: t.categories?.name || 'Geral',
        date: t.date,
        member: t.member_name,
        isPaid: t.is_paid,
        account: t.account,
        costCenter: t.cost_center,
        paymentType: t.payment_type,
        docNumber: t.doc_number,
        competence: t.competence,
        notes: t.notes
    }));
};

export const createTransaction = async (transaction: Omit<Transaction, 'id' | 'category'> & { categoryId: string }) => {
    const { data, error } = await supabase
        .from('transactions')
        .insert([{
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            category_id: transaction.categoryId,
            date: transaction.date,
            member_name: transaction.member
        }])
        .select();

    if (error) throw error;
    return data;
};

// --- Categories ---
export const getCategories = async (): Promise<Category[]> => {
    const { data, error } = await supabase
        .from('categories')
        .select('*');

    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }

    return data;
};

// --- Church Info ---

export const getChurchInfo = async (): Promise<ChurchInfo | null> => {
    const { data, error } = await supabase
        .from('church_settings')
        .select('*')
        .limit(1)
        .single();

    if (error) {
        if (error.code !== 'PGRST116') { // PGRST116 = 0 rows returned
            console.error('Error fetching church info:', error);
        }
        return null;
    }

    return {
        name: data.name,
        logoUrl: data.logo_url,
        address: data.address,
        phone: data.phone,
        email: data.email
    };
};

export const updateChurchInfo = async (info: ChurchInfo) => {
    // Attempt to get existing to determine insert vs update
    const { data: existing } = await supabase
        .from('church_settings')
        .select('id')
        .limit(1)
        .single();

    const payload = {
        name: info.name,
        logo_url: info.logoUrl,
        address: info.address,
        phone: info.phone,
        email: info.email,
        updated_at: new Date().toISOString()
    };

    if (existing) {
        const { error } = await supabase
            .from('church_settings')
            .update(payload)
            .eq('id', existing.id);

        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('church_settings')
            .insert([payload]);
        if (error) throw error;
    }
};

export const getEvents = async (): Promise<CalendarEvent[]> => {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });

    if (error) {
        console.error('Error fetching events:', error);
        return [];
    }

    return data.map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startDate: e.start_date,
        startTime: e.start_time,
        endDate: e.end_date,
        endTime: e.end_time,
        isAllDay: e.is_all_day,
        location: e.location,
        categoryId: e.category_id,
        isPrivate: e.is_private,
        repeat: e.repeat
    }));
};

export const getEventCategories = async (): Promise<EventCategory[]> => {
    const { data, error } = await supabase
        .from('event_categories')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching event categories:', error);
        return [];
    }

    return data;
};

// --- Departments ---

export const getDepartments = async (): Promise<Department[]> => {
    const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching departments:', error);
        return [];
    }

    return data.map((d: any) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        bannerUrl: d.banner_url,
        icon: d.icon,
        isActive: d.is_active,
        createdAt: d.created_at
    }));
};

export const getDepartmentRoles = async (departmentId: string): Promise<DepartmentRole[]> => {
    const { data, error } = await supabase
        .from('department_roles')
        .select('*')
        .eq('department_id', departmentId)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching department roles:', error);
        return [];
    }

    return data;
};

export const getDepartmentMembers = async (departmentId: string): Promise<DepartmentMember[]> => {
    const { data, error } = await supabase
        .from('department_members')
        .select(`
            *,
            profiles (*)
        `)
        .eq('department_id', departmentId);

    if (error) {
        console.error('Error fetching department members:', error);
        return [];
    }

    return data.map((m: any) => ({
        id: m.id,
        departmentId: m.department_id,
        userId: m.user_id,
        roles: m.roles,
        user: {
            id: m.profiles.id,
            name: m.profiles.name,
            email: m.profiles.email,
            role: m.profiles.role,
            avatarUrl: m.profiles.avatar_url
        }
    }));
};
