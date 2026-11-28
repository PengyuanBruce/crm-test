/* ============================================================
   唯一需要改的文件
   Supabase Dashboard → Settings → API Keys
   - Project URL      → 填到 SUPABASE_URL
   - publishable key  → 填到 SUPABASE_ANON_KEY（等同于旧的 anon 公开密钥）
   ⚠️ 绝不要用 secret / service_role key，它能绕过所有权限

   LOGIN_EMAIL：唯一账号的邮箱
   - 填了 → 登录页只显示密码框，账号自动带入
   - 留空 → 登录页显示账号 + 密码两个框
   账号本身要在 Supabase → Authentication → Users 里创建
   ============================================================ */

window.APP_CONFIG = {
  SUPABASE_URL: 'https://udoocaewtofzwvfanpsa.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_fr_Lru6JxrgxUs6hQ8BzzA_D93maR5D',
  LOGIN_EMAIL: ''
};
