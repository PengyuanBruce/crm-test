# 客户登记 · 免登录测试版

一个页面搞定：填表单 → 存 Supabase → 按公司名 / 产品 / 跟进销售 / 地址搜索。
纯静态文件，不需要服务器、不需要构建工具、不需要装 npm 包。

**线上地址**：https://pengyuanbruce.github.io/crm-test/
（GitHub Pages，推送 `main` 后约 1 分钟自动重新部署）

## 文件说明

| 文件 | 作用 | 要不要改 |
|---|---|---|
| `index.html` | 页面结构（表单 + 搜索 + 列表） | 不用 |
| `style.css` | 样式 | 一般不用 |
| `app.js` | 提交、查询、分页、搜索逻辑 | 不用 |
| `config.js` | **Supabase 地址和 key** | ✅ 只改这个 |
| `schema.sql` | 建表 + 权限 SQL | 粘到 Supabase 执行一次 |
| `migration-login.sql` | 加登录后收紧权限 | 粘到 SQL Editor 执行一次 |
| `migration-sales-note.sql` | 加「跟进销售」「情况备注」两列 | 粘到 SQL Editor 执行一次 |

## 四步跑起来

### 1. 建 Supabase 项目
[supabase.com](https://supabase.com) → New project → 区域选 **Singapore** 或 **Tokyo** → 记下数据库密码 → 等 2 分钟初始化完。

### 2. 建表
左侧 **SQL Editor** → New query → 把 `schema.sql` 全文粘进去 → Run。
看到 `Success. No rows returned` 就对了。

### 3. 填配置
左侧 **Settings → API**，复制两个值填进 `config.js`：

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://xxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...'
};
```

> 用 `anon public` 那个 key，**不要**用 `service_role`（后者能绕过所有权限，绝不可放前端）。

### 4. 打开页面
在本目录执行：

```powershell
python -m http.server 5173
```

浏览器访问 http://localhost:5173

> 不建议直接双击 `index.html`。`file://` 的源是 `null`，部分浏览器会拦跨域请求，会报 CORS 错误。

## 已经实现的行为

- 公司名必填，其余可选；空值存 `null` 而不是空串
- 提交成功后自动清空表单、跳到第一页并刷新列表
- 搜索是**服务端过滤**（PostgREST `ilike`），不是把全表拉到前端再筛，几千条也不卡
- 可搜字段：公司名 / 产品 / 跟进销售 / 地址；选「全部字段」时四个字段一起命中（情况备注不参与搜索）
- 搜索防抖 300ms；只认最后一次请求，边打边搜不会串结果
- 每页 20 条 + 上下页 + 总条数
- 官网字段自动补 `https://` 并新窗口打开

## 常见报错对照

| 报错信息 | 原因 | 处理 |
|---|---|---|
| `relation "public.customers" does not exist` | 没执行建表 SQL | 跑一遍 `schema.sql` |
| `column "sales_owner" does not exist` | 没执行加字段的迁移 | 跑 `migration-sales-note.sql` |
| `new row violates row-level security policy` | 开了 RLS 但没建策略 | `schema.sql` 里的 policy 部分没执行成功，重跑 |
| `Invalid API key` | key 抄漏、多了空格、或用了错的 key | 重新复制 anon public key |
| `Failed to fetch` / CORS | 用 `file://` 打开，或项目被暂停 | 用 `http.server` 打开；去 Dashboard 看项目是否 Active |
| 提交成功但列表没数据 | 策略只给了 insert 没给 select | 确认 `auth can read` 策略存在 |
| `Invalid login credentials` | 账号不存在或密码错 | 去 Authentication → Users 确认用户存在且密码正确 |
| `Email not confirmed` | 建用户时没勾 Auto Confirm | Dashboard → Users 里点该用户重新确认 |
| 登录成功但列表报 401 / permission denied | 没跑 `migration-login.sql`，`authenticated` 没权限 | 补跑迁移 SQL |
| 搜索输中文搜不到 | 关键词带逗号 `,` `(` `)` 会被过滤 | 换掉这些字符，或只输纯文字 |

## 登录（当前版本已启用）

页面现在需要登录才能看到任何数据。三件事：

### 1. 建唯一的那个账号
Supabase → **Authentication** → **Users** → **Add user** →

- Email：你的登录邮箱
- Password：自己设一个强密码
- 勾上 **Auto Confirm User**（否则会要求点邮件里的确认链接）
- Create user

### 2. 收紧数据库权限（关键）
SQL Editor 里跑 `migration-login.sql`。它做两件事：删掉匿名策略、收回 `anon` 的表权限，只给 `authenticated` 授权。

**不跑这一步等于没加登录**——页面虽然挡住了，但拿着公开的 publishable key 直接请求 API 仍能读全表。

### 3. （可选）让登录页只剩密码框
把账号邮箱填进 `config.js` 的 `LOGIN_EMAIL`：

```js
LOGIN_EMAIL: 'you@example.com'
```

填了之后账号自动带入，页面只显示密码输入框。留空则显示账号 + 密码两个框，效果一样。

### 登录相关的行为
- 登录状态存在浏览器 localStorage，关掉再开不用重登
- token 会自动续期；续期失败或权限被收回时，页面自动退回登录页并提示"登录已过期"
- 右上角「退出登录」
- 只有你要加多个账号时才需要在 Users 里继续加人；一个账号够用就一直只有一个

## 安全边界

现在数据是登录后才可读的，但仍有边界：

- 前端 `publishable key` 是公开的，**安全性完全依赖 `migration-login.sql` 里的 RLS 与 GRANT**，不是靠隐藏 key
- 账号只有一个，密码强度直接等于数据安全等级，别用 `123456`
- 忘记密码：Supabase 内置发信每小时只有几封且只适合测试，最省事的办法是去 Dashboard → Users 直接重设密码
- 仍然**不建议**存身份证号、合同原件、付款信息这类高敏数据

## 后续更新怎么发布

```bash
git add -A
git commit -m "说明这次改了什么"
git push
```

推送后 GitHub Pages 会自动重新构建，约 1 分钟生效。看构建状态：仓库 → Actions → pages build and deployment。

## 仓库为什么是 Public

GitHub Pages 免费版只支持**公开仓库**。这意味着：

- 页面源码（含 `config.js` 里的 anon key）任何人都能看到
- `anon key` 本来就是设计成公开的前端密钥，安全性靠数据库的 RLS 策略，不是靠隐藏它
- 但当前策略允许匿名 insert / select，所以**别人也能往你的表里写数据**
- 结论：这个仓库适合测试和演示，**不要放真实客户数据**

要私有仓库 + 在线访问，需要 GitHub Pro，或改用 Vercel / Cloudflare Pages 连私有仓库（国内访问 vercel 域名不稳定，Cloudflare 相对好些）。

## 下一步可以加（按性价比排序）

1. **删除按钮**（半小时，权限已给到 `authenticated`，加个按钮即可）
2. **CSV 导出 / 导入**（一小时，日常最有用）
3. **多账号 + 角色**（半天，需要 `profiles` 表区分管理员和只读）
4. 公司名重复提示（提交前查一次同名）
5. 忘记密码邮件（配 Resend SMTP 后可用）
