-- ============================================================
-- 新增两个字段：跟进销售、情况备注
-- 在 Supabase SQL Editor 里整体粘贴执行一次（可重复执行，不会报错）
-- ============================================================

alter table public.customers
  add column if not exists sales_owner text
    check (char_length(sales_owner) <= 80),
  add column if not exists note text
    check (char_length(note) <= 2000);

-- 说明：
-- 1. 表权限是按表授予的，新列自动继承，不需要再 grant
-- 2. 表里已有的老数据，这两个字段为 null，页面会显示「—」和「暂无」
-- 3. 备注的修改走 update 权限，登录后即可用

-- 自检：应能看到 sales_owner 和 note 两行
-- select column_name, data_type, character_maximum_length
-- from information_schema.columns
-- where table_name = 'customers' order by ordinal_position;
