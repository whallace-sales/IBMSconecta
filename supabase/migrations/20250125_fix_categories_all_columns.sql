-- Script de Correção Completa para Tabela Categories

-- 1. Adicionar coluna 'type' se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'type') THEN
        ALTER TABLE public.categories ADD COLUMN type text DEFAULT 'INCOME';
        ALTER TABLE public.categories ADD CONSTRAINT categories_type_check CHECK (type IN ('INCOME', 'EXPENSE'));
    END IF;
END $$;

-- 2. Adicionar coluna 'description' se não existir
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS description text;

-- 3. Adicionar coluna 'color' se não existir
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS color text DEFAULT 'indigo';

-- 4. Tentar recarregar o cache do PostgREST (API)
NOTIFY pgrst, 'reload schema';
