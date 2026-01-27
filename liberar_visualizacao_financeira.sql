-- Este script SQL deve ser executado no SQL Editor do seu projeto Supabase
-- para permitir que todos os usuários (incluindo Leitores) visualizem os dados financeiros.

-- 1. Habilitar leitura na tabela de transações para qualquer usuário logado
create policy "Permitir visualização de transações para todos"
on "public"."transactions"
for select
to authenticated
using (true);

-- 2. Habilitar leitura na tabela de categorias (para que o nome das categorias apareça)
create policy "Permitir visualização de categorias para todos"
on "public"."categories"
for select
to authenticated
using (true);

-- Observação: Se já existirem políticas restritivas, esta política adicional deve liberar o acesso
-- pois o Supabase combina as políticas do tipo PERMISSIVE com OR.
