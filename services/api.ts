
import { supabase } from '../supabaseClient';
import { User, UserRole, Post, Transaction, Category, CalendarEvent, EventCategory, ChurchInfo, Department, DepartmentRole, DepartmentMember } from '../types';

// --- Auth & Profile ---
export const getProfile = async (userId: string): Promise<User | null> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        if (!data) return null;

        return {
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role as UserRole,
            birthDate: data.birth_date,
            address: data.address,
            cep: data.cep,
            city: data.city,
            neighborhood: data.neighborhood,
            state: data.state,
            maritalStatus: data.marital_status,
            education: data.education,
            spouseName: data.spouse_name,
            conversionDate: data.conversion_date,
            baptismDate: data.baptism_date,
            isBaptized: data.is_baptized,
            notes: data.notes,
            phone: data.phone,
            phone2: data.phone2,
            doc1: data.doc1,
            doc2: data.doc2,
            addressNumber: data.address_number,
            country: data.country,
            categories: data.categories,
            cargos: data.cargos,
            avatarUrl: data.avatar_url,
            gender: data.gender,
            createdAt: data.created_at,
        };
    } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
};

// --- Posts ---
export const getPosts = async (): Promise<Post[]> => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*, profiles(name, avatar_url)')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

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
    } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
};

export const getPost = async (id: string): Promise<Post | null> => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*, profiles(name, avatar_url)')
            .eq('id', id)
            .single();

        if (error) throw error;

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
    } catch (error) {
        console.error('Error fetching post:', error);
        return null;
    }
};

// --- Transactions ---
export const getTransactions = async (): Promise<Transaction[]> => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select(`
          *,
          categories (name, color)
        `)
            .order('date', { ascending: false });

        if (error) throw error;

        return data.map((t: any) => ({
            id: t.id,
            description: t.description,
            amount: Number(t.amount),
            type: t.type,
            category: t.categories?.name || 'GERAL',
            date: t.date,
            member: t.member_name,
            attachmentUrls: t.attachment_urls || t.attachments || t.files || [],
            isPaid: t.is_paid !== undefined ? t.is_paid : (t.paid !== undefined ? t.paid : t.status === 'PAID'),
            paymentType: t.payment_type || t.payment_method,
        }));
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }
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
            member_name: transaction.member,
            is_paid: transaction.isPaid,
            cost_center: transaction.costCenter,
            payment_type: transaction.paymentType,
            doc_number: transaction.docNumber,
            competence: transaction.competence,
            notes: transaction.notes
        }])
        .select();

    if (error) throw error;
    return data;
};

// --- Categories ---
export const getCategories = async (): Promise<Category[]> => {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
};

// --- Church Info ---

export const getChurchInfo = async (): Promise<ChurchInfo | null> => {
    try {
        const { data, error } = await supabase
            .from('church_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') throw error;
            return null;
        }

        return {
            name: data.name,
            logoUrl: data.logo_url,
            address: data.address,
            phone: data.phone,
            email: data.email
        };
    } catch (error) {
        console.error('Error fetching church info:', error);
        return null;
    }
};

export const updateChurchInfo = async (info: ChurchInfo) => {
    try {
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
    } catch (error) {
        console.error('Error updating church info:', error);
        throw error;
    }
};

export const getEvents = async (): Promise<CalendarEvent[]> => {
    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('start_date', { ascending: true });

        if (error) throw error;

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
    } catch (error) {
        console.error('Error fetching events:', error);
        return [];
    }
};

export const getEventCategories = async (): Promise<EventCategory[]> => {
    try {
        const { data, error } = await supabase
            .from('event_categories')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching event categories:', error);
        return [];
    }
};

// --- Departments ---

export const getDepartments = async (): Promise<Department[]> => {
    try {
        const { data, error } = await supabase
            .from('departments')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        return data.map((d: any) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            bannerUrl: d.banner_url,
            icon: d.icon,
            isActive: d.is_active,
            createdAt: d.created_at
        }));
    } catch (error) {
        console.error('Error fetching departments:', error);
        return [];
    }
};

export const getDepartmentRoles = async (departmentId: string): Promise<DepartmentRole[]> => {
    try {
        const { data, error } = await supabase
            .from('department_roles')
            .select('*')
            .eq('department_id', departmentId)
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching department roles:', error);
        return [];
    }
};

export const getDepartmentMembers = async (departmentId: string): Promise<DepartmentMember[]> => {
    try {
        const { data, error } = await supabase
            .from('department_members')
            .select(`
                *,
                profiles (*)
            `)
            .eq('department_id', departmentId);

        if (error) throw error;

        return data.map((m: any) => ({
            id: m.id,
            departmentId: m.department_id,
            userId: m.user_id,
            roles: m.roles,
            user: m.profiles ? {
                id: m.profiles.id,
                name: m.profiles.name,
                email: m.profiles.email,
                role: m.profiles.role,
                avatarUrl: m.profiles.avatar_url
            } : undefined
        }));
    } catch (error) {
        console.error('Error fetching department members:', error);
        return [];
    }
};
