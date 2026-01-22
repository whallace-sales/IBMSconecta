
import { supabase } from '../supabaseClient';
import { User, UserRole, Post, Transaction, Category } from '../types';

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
        category: t.categories?.name || 'Geral', // Simplificação
        date: t.date,
        member: t.member_name
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
import { ChurchInfo } from '../types';

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
