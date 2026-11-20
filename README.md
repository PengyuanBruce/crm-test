# 客户登记 · 免登录测试版

一个页面搞定：填表单 → 存 Supabase → 按公司名 / 产品 / 地址搜索。
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
- 搜索防抖 300ms；只认最后一次请求，边打边搜不会串结果
- 每页 20 条 + 上下页 + 总条数
- 官网字段自动补 `https://` 并新窗口打开

## 常见报错对照

| 报错信息 | 原因 | 处理 |
|---|---|---|
| `relation "public.customers" does not exist` | 没执行建表 SQL | 跑一遍 `schema.sql` |
| `new row violates row-level security policy` | 开了 RLS 但没建策略 | `schema.sql` 里的 policy 部分没执行成功，重跑 |
| `Invalid API key` | key 抄漏、多了空格、或用了错的 key | 重新复制 anon public key |
| `Failed to fetch` / CORS | 用 `file://` 打开，或项目被暂停 | 用 `http.server` 打开；去 Dashboard 看项目是否 Active |
| 提交成功但列表没数据 | 策略只给了 insert 没给 select | 确认 `anon can read` 策略存在 |
| 搜索输中文搜不到 | 关键词带逗号 `,` `(` `)` 会被过滤 | 换掉这些字符，或只输纯文字 |

## 这个版本的安全边界（务必知道）

免登录 = 任何拿到页面的人都能**读全表、写新行**。这是你要求的测试形态，但要知道代价：

- 前端 `anon key` 是公开的，别人可以直接对你的表刷数据
- 所以策略里**故意没给 update / delete**，最坏情况是被人塞垃圾行，不会被篡改或清空
- **不要放真实客户手机号、真实合同信息**。测试用公司名和公开官网足够
- 表格如果被刷爆，Dashboard → Table Editor 里逐条删，或者 `truncate table public.customers;`

正式版要做的三件事，都很小：
1. 打开 Supabase Auth，登录后才能写
2. 把策略从 `anon` 改成 `authenticated`
3. 加个删除按钮（限定登录用户）

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

1. **删除按钮**（半小时）
2. **CSV 导出 / 导入**（一小时，日常最有用）
3. **登录 + 5 人账号**（半天，从测试版过渡到正式版）
4. 公司名重复提示（提交前查一次同名）
5. 部署到 Cloudflare Pages，把目录直接拖上去就是线上地址
