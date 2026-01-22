-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Profiles (Extends auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  name text,
  role text check (role in ('ADMIN', 'TESOUREIRO', 'LEITOR')) default 'LEITOR',
  birth_date date,
  address text,
  phone text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_admin_all" on public.profiles for all using (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'name', 
    coalesce(new.raw_user_meta_data->>'role', 'LEITOR')
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    role = excluded.role;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. Categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color text not null,
  type text check (type in ('INCOME', 'EXPENSE')) default 'INCOME' not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Categories
alter table public.categories enable row level security;

create policy "categories_select" on public.categories for select using (true);
create policy "categories_admin_all" on public.categories for all using (
  (auth.jwt() -> 'user_metadata' ->> 'role') in ('ADMIN', 'TESOUREIRO')
);

-- Initial Categories Seed
insert into public.categories (name, color) values
  ('Dízimos', 'indigo'),
  ('Ofertas', 'emerald'),
  ('Infraestrutura', 'amber'),
  ('Utilidades', 'blue'),
  ('Manutenção', 'rose'),
  ('Missões', 'teal')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 3. Posts (Blog)
-- -----------------------------------------------------------------------------
create table public.posts (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  content text not null,
  author_id uuid references public.profiles(id),
  date date default CURRENT_DATE,
  image_url text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Posts
alter table public.posts enable row level security;

create policy "posts_select" on public.posts for select using (true);
create policy "posts_admin_all" on public.posts for all using (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
);

-- -----------------------------------------------------------------------------
-- 4. Transactions
-- -----------------------------------------------------------------------------
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  description text not null,
  amount numeric(10,2) not null,
  type text check (type in ('INCOME', 'EXPENSE')) not null,
  category_id uuid references public.categories(id),
  date date default CURRENT_DATE,
  member_name text, 
  is_paid boolean default true,
  account text default 'Principal',
  cost_center text,
  payment_type text default 'Único',
  doc_number text,
  competence text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Transactions
alter table public.transactions enable row level security;

create policy "finance_admin_select" on public.transactions for select using (
  (auth.jwt() -> 'user_metadata' ->> 'role') in ('ADMIN', 'TESOUREIRO')
);
create policy "finance_admin_all" on public.transactions for all using (
  (auth.jwt() -> 'user_metadata' ->> 'role') in ('ADMIN', 'TESOUREIRO')
);


-- -----------------------------------------------------------------------------
-- 5. Church Settings
-- -----------------------------------------------------------------------------
create table public.church_settings (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  logo_url text,
  address text,
  phone text,
  email text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Settings
alter table public.church_settings enable row level security;

create policy "church_settings_select" on public.church_settings for select using (true);
create policy "church_settings_admin_all" on public.church_settings for all using (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
);

-- Initial Settings Seed
insert into public.church_settings (name, address, email) 
values ('Igreja Conecta', 'Rua da Fé, 123', 'contato@igreja.com')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 6. Event Categories
-- -----------------------------------------------------------------------------
create table public.event_categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.event_categories enable row level security;
create policy "event_categories_select" on public.event_categories for select using (true);
create policy "event_categories_admin_all" on public.event_categories for all using (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
);

-- Seed event categories
insert into public.event_categories (name, color) values
  ('Adolescentes', '#6366f1'),
  ('Café da manhã', '#f59e0b'),
  ('Direção Culto', '#10b981'),
  ('Escala Limpeza', '#6b7280'),
  ('Evangelismo', '#ec4899'),
  ('Louvor', '#8b5cf6'),
  ('Mulheres', '#f472b6'),
  ('Vigília', '#1e293b')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 7. Events (Agenda)
-- -----------------------------------------------------------------------------
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  start_date date not null,
  start_time time,
  end_date date not null,
  end_time time,
  is_all_day boolean default false,
  location text,
  category_id uuid references public.event_categories(id),
  is_private boolean default false,
  repeat text check (repeat in ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')) default 'NONE',
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.events enable row level security;
create policy "events_select" on public.events for select using (
  not is_private or (auth.uid() = created_by) or ((auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN')
);
create policy "events_admin_all" on public.events for all using (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
);

-- -----------------------------------------------------------------------------
-- 8. Departments
-- -----------------------------------------------------------------------------
create table public.departments (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  banner_url text,
  icon text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.departments enable row level security;
create policy "departments_select" on public.departments for select using (true);
create policy "departments_admin_all" on public.departments for all using (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
);

create table public.department_roles (
  id uuid default uuid_generate_v4() primary key,
  department_id uuid references public.departments(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.department_roles enable row level security;
create policy "department_roles_select" on public.department_roles for select using (true);
create policy "department_roles_admin_all" on public.department_roles for all using (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
);

create table public.department_members (
  id uuid default uuid_generate_v4() primary key,
  department_id uuid references public.departments(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  roles text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(department_id, user_id)
);

alter table public.department_members enable row level security;
create policy "department_members_select" on public.department_members for select using (true);
create policy "department_members_admin_all" on public.department_members for all using (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN'
);
