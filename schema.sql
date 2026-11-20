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

-- 自检：下面这句应该返回 0 行（证明没有开放修改权限）
-- select * from pg_policies where tablename = 'customers';
