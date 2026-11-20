-- ============================================================
-- 客户登记表 · 免登录测试版
-- 在 Supabase Dashboard → SQL Editor 里整体粘贴执行一次即可
-- ============================================================

-- 模糊搜索用的扩展
create extension if not exists pg_trgm;

-- 主表
create table if not exists public.customers (
  id           uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(company_name) between 1 and 120),
  product      text check (char_length(product)  <= 200),
  kp           text check (char_length(kp)       <= 80),
  website      text check (char_length(website)  <= 200),
  address      text check (char_length(address)  <= 300),
  created_at   timestamptz not null default now()
);

create index if not exists customers_created_at_idx
  on public.customers (created_at desc);

create index if not exists customers_company_trgm_idx
  on public.customers using gin (company_name gin_trgm_ops);

-- ------------------------------------------------------------
-- 权限：免登录版本 —— 任何人可「提交」和「查看」，但不能改、不能删
-- anon key 会暴露在前端，所以这里刻意不给 update / delete 策略
-- ------------------------------------------------------------
alter table public.customers enable row level security;

drop policy if exists "anon can insert" on public.customers;
create policy "anon can insert"
  on public.customers
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon can read" on public.customers;
create policy "anon can read"
  on public.customers
  for select
  to anon, authenticated
  using (true);

-- ------------------------------------------------------------
-- 表权限（关键）
-- 新版 Supabase 项目建表后不会自动给 anon / authenticated 授权，
-- 必须显式 GRANT；这里只给「读」和「写」，不给 update / delete
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert on public.customers to anon, authenticated;

-- 自检：应能看到 2 行（anon can insert / anon can read）
-- select policyname, cmd, roles from pg_policies where tablename = 'customers';
