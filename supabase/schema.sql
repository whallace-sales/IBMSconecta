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

