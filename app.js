/* 客户登记 · 带登录的测试版
   认证：Supabase Auth（邮箱 + 密码），前端只持有公开的 publishable key
   数据：登录后由 RLS 放出权限，未登录的匿名请求会被数据库拒绝 */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.APP_CONFIG || {};
  var url = String(cfg.SUPABASE_URL || '').trim();
  var key = String(cfg.SUPABASE_ANON_KEY || '').trim();
  var loginEmail = String(cfg.LOGIN_EMAIL || '').trim();

  var db = null;
  var state = { page: 0, pageSize: 20, total: 0, keyword: '', field: 'all' };
  var reqSeq = 0;

  /* ---------- 界面切换 ---------- */
  function showLogin() {
    $('app-screen').hidden = true;
    $('login-screen').hidden = false;
    $('btn-logout').hidden = true;
    $('list').innerHTML = '';
    $('status').textContent = '';
    $('count').textContent = '';
    $('page-info').textContent = '';
    state.page = 0;
    state.keyword = '';
    $('search-input').value = '';
  }

  function showApp() {
    $('login-screen').hidden = true;
    $('app-screen').hidden = false;
    $('btn-logout').hidden = false;
  }

  function setLoginMsg(text, kind) {
    var el = $('login-msg');
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }

  /* ---------- 初始化 ---------- */
  var banner = $('config-error');
  var notConfigured =
    !url || !key || url.indexOf('YOUR-PROJECT') !== -1 || key.indexOf('YOUR-ANON') !== -1;

  if (notConfigured) {
    banner.hidden = false;
    banner.textContent = '还没配置 Supabase：打开 config.js，把 Project URL 和 publishable key 填进去，保存后刷新本页。';
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    banner.hidden = false;
    banner.textContent = 'supabase-js 没加载成功，检查网络或 CDN 是否被拦截。';
    return;
  }

  db = window.supabase.createClient(url, key);

  // 配了固定账号就藏掉邮箱输入框
  if (loginEmail) {
    $('email-field').style.display = 'none';
    $('l-email').value = loginEmail;
  }

  db.auth.getSession().then(function (res) {
    var session = res && res.data && res.data.session;
    if (session) {
      showApp();
      load();
    } else {
      showLogin();
      $('l-password').focus();
    }
  }, function () {
    showLogin();
  });

  // 别的标签页退出时同步回登录页
  db.auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_OUT' || !session) {
      showLogin();
    }
  });

  /* ---------- 登录 / 退出 ---------- */
  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();

    var email = loginEmail || clean($('l-email').value, 120);
    var password = $('l-password').value || '';

    if (!email) { setLoginMsg('请输入账号', 'err'); return; }
    if (!password) { setLoginMsg('请输入密码', 'err'); $('l-password').focus(); return; }

    $('btn-login').disabled = true;
    setLoginMsg('登录中…');

    db.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      $('btn-login').disabled = false;

      if (res.error) {
        var m = res.error.message || '登录失败';
        if (/invalid login credentials/i.test(m)) m = '账号或密码错误';
        else if (/email not confirmed/i.test(m)) m = '账号未确认，去 Supabase → Authentication → Users 里确认该用户';
        setLoginMsg(m, 'err');
        $('l-password').select();
        return;
      }

      $('l-password').value = '';
      setLoginMsg('');
      showApp();
      load();
    }, function (err) {
      $('btn-login').disabled = false;
      setLoginMsg('网络错误：' + (err && err.message ? err.message : err), 'err');
    });
  });

  $('btn-logout').addEventListener('click', function () {
    db.auth.signOut().then(function () {
      showLogin();
      setLoginMsg('已退出登录');
    });
  });

  /* ---------- 工具 ---------- */
  function setStatus(text, kind) {
    var el = $('status');
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function setFormMsg(text, kind) {
    var el = $('form-msg');
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function clean(value, max) {
    var s = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
    return max ? s.slice(0, max) : s;
  }

  function sanitizeKeyword(q) {
    return String(q).replace(/[,()%"\\*]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function websiteHref(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    return 'https://' + s.replace(/^\/+/, '');
  }

  function metaRow(label, value, isLink) {
    var div = document.createElement('div');
    var b = document.createElement('b');
    b.textContent = label;
    div.appendChild(b);
    if (!value) {
      div.appendChild(document.createTextNode('—'));
      return div;
    }
    if (isLink) {
      var a = document.createElement('a');
      a.href = websiteHref(value);
      a.textContent = value;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      div.appendChild(a);
    } else {
      div.appendChild(document.createTextNode(value));
    }
    return div;
  }

  function itemEl(c) {
    var wrap = document.createElement('div');
    wrap.className = 'item';

    var top = document.createElement('div');
    top.className = 'item-top';

    var name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = c.company_name || '(未填公司名)';

    var time = document.createElement('div');
    time.className = 'item-time';
    time.textContent = fmtTime(c.created_at);

    top.appendChild(name);
    top.appendChild(time);
    wrap.appendChild(top);

    if (c.product) {
      var tag = document.createElement('div');
      tag.className = 'item-tag';
      tag.textContent = c.product;
      wrap.appendChild(tag);
    }

    var meta = document.createElement('div');
    meta.className = 'item-meta';
    meta.appendChild(metaRow('KP', c.kp, false));
    meta.appendChild(metaRow('官网', c.website, true));
    meta.appendChild(metaRow('地址', c.address, false));
    wrap.appendChild(meta);

    return wrap;
  }

  /* ---------- 查询 ---------- */
  function buildQuery() {
    var from = state.page * state.pageSize;
    var to = from + state.pageSize - 1;

    var q = db
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (state.keyword) {
      if (state.field === 'all') {
        q = q.or(
          'company_name.ilike.%' + state.keyword + '%,' +
          'product.ilike.%' + state.keyword + '%,' +
          'address.ilike.%' + state.keyword + '%'
        );
      } else {
        q = q.ilike(state.field, '%' + state.keyword + '%');
      }
    }
    return q;
  }

  function load() {
    if (!db) return;
    var seq = ++reqSeq;
    setStatus('加载中…');

    buildQuery().then(function (res) {
      if (seq !== reqSeq) return;

      if (res.error) {
        // 会话过期或权限被收回 → 回登录页
        if (/JWT|401|permission|not authorized/i.test(res.error.message || '')) {
          showLogin();
          setLoginMsg('登录已过期，请重新登录', 'err');
          return;
        }
        setStatus('查询失败：' + res.error.message, 'err');
        renderList([], true);
        return;
      }

      state.total = res.count == null ? (res.data || []).length : res.count;
      renderList(res.data || [], false);
      setStatus('');
    }, function (err) {
      if (seq !== reqSeq) return;
      setStatus('网络请求失败：' + (err && err.message ? err.message : err), 'err');
    });
  }

  /* ---------- 渲染 ---------- */
  function renderList(rows, isError) {
    var list = $('list');
    list.innerHTML = '';

    if (isError) {
      $('count').textContent = '';
      $('page-info').textContent = '';
      $('btn-prev').disabled = true;
      $('btn-next').disabled = true;
      return;
    }

    if (!rows.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = state.keyword ? '没有匹配「' + state.keyword + '」的客户' : '还没有数据，先在上面提交一条试试';
      list.appendChild(empty);
    } else {
      rows.forEach(function (c) { list.appendChild(itemEl(c)); });
    }

    var pages = Math.max(1, Math.ceil(state.total / state.pageSize));
    $('count').textContent = '共 ' + state.total + ' 条';
    $('page-info').textContent = '第 ' + (state.page + 1) + ' / ' + pages + ' 页';
    $('btn-prev').disabled = state.page <= 0;
    $('btn-next').disabled = state.page >= pages - 1;
  }

  /* ---------- 提交 ---------- */
  var form = $('customer-form');
  var btnSubmit = $('btn-submit');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!db) return;

    var companyEl = $('f-company');
    var company = clean(companyEl.value, 120);
    companyEl.setAttribute('aria-invalid', 'false');

    if (!company) {
      companyEl.setAttribute('aria-invalid', 'true');
      setFormMsg('公司名必填', 'err');
      companyEl.focus();
      return;
    }

    var payload = {
      company_name: company,
      product: clean($('f-product').value, 200),
      kp: clean($('f-kp').value, 80),
      website: clean($('f-website').value, 200),
      address: clean($('f-address').value, 300)
    };

    Object.keys(payload).forEach(function (k) {
      if (payload[k] === '') payload[k] = null;
    });

    btnSubmit.disabled = true;
    setFormMsg('保存中…');

    db.from('customers').insert(payload).select().then(function (res) {
      btnSubmit.disabled = false;

      if (res.error) {
        if (/JWT|401|permission|not authorized/i.test(res.error.message || '')) {
          showLogin();
          setLoginMsg('登录已过期，请重新登录', 'err');
          return;
        }
        setFormMsg('保存失败：' + res.error.message, 'err');
        return;
      }

      form.reset();
      setFormMsg('已保存：' + company, 'ok');
      companyEl.focus();
      state.page = 0;
      load();
      setTimeout(function () { setFormMsg(''); }, 4000);
    }, function (err) {
      btnSubmit.disabled = false;
      setFormMsg('网络错误：' + (err && err.message ? err.message : err), 'err');
    });
  });

  /* ---------- 搜索 ---------- */
  var timer = null;
  var searchInput = $('search-input');

  searchInput.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      state.keyword = sanitizeKeyword(searchInput.value);
      state.field = $('search-field').value;
      state.page = 0;
      load();
    }, 300);
  });

  $('search-field').addEventListener('change', function (e) {
    state.field = e.target.value;
    state.keyword = sanitizeKeyword(searchInput.value);
    state.page = 0;
    load();
  });

  /* ---------- 分页 / 刷新 ---------- */
  $('btn-prev').addEventListener('click', function () {
    if (state.page > 0) { state.page -= 1; load(); }
  });

  $('btn-next').addEventListener('click', function () {
    if (state.page < Math.ceil(state.total / state.pageSize) - 1) { state.page += 1; load(); }
  });

  $('btn-refresh').addEventListener('click', function () {
    state.page = 0;
    load();
  });
})();
