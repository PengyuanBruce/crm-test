-- ============================================================
-- 加登录后必须执行的迁移：把数据权限从 anon 收紧为 authenticated
-- 在 Supabase SQL Editor 里整体粘贴执行一次
-- ============================================================

-- 1. 删掉匿名访问策略
drop policy if exists "anon can insert" on public.customers;
drop policy if exists "anon can read"   on public.customers;

-- 2. 收回匿名角色的表权限（关键：这一步之后未登录的人彻底读不到数据）
revoke select, insert, update, delete on public.customers from anon;

-- 3. 只给已登录用户授权
grant select, insert, update, delete on public.customers to authenticated;

-- 4. 登录后才有权限的策略
drop policy if exists "auth can read"   on public.customers;
drop policy if exists "auth can insert" on public.customers;
drop policy if exists "auth can update" on public.customers;
drop policy if exists "auth can delete" on public.customers;

create policy "auth can read"
  on public.customers for select
  to authenticated using (true);

create policy "auth can insert"
  on public.customers for insert
  to authenticated with check (true);

create policy "auth can update"
  on public.customers for update
  to authenticated using (true) with check (true);

create policy "auth can delete"
  on public.customers for delete
  to authenticated using (true);

-- 自检：应只看到 4 条 auth can * ，roles 里不应再出现 anon
-- select policyname, cmd, roles from pg_policies where tablename = 'customers';
