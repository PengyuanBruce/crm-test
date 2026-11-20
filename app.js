/* 客户登记 · 免登录测试版
   数据流：表单 → supabase.from('customers').insert() → 重新查询列表
   搜索：服务端过滤（PostgREST ilike），不是前端过滤 */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.APP_CONFIG || {};
  var url = String(cfg.SUPABASE_URL || '').trim();
  var key = String(cfg.SUPABASE_ANON_KEY || '').trim();

  var db = null;
  var state = { page: 0, pageSize: 20, total: 0, keyword: '', field: 'all', loading: false };

  /* ---------- 初始化 ---------- */
  var banner = $('config-error');
  var notConfigured =
    !url || !key || url.indexOf('YOUR-PROJECT') !== -1 || key.indexOf('YOUR-ANON') !== -1;

  if (notConfigured) {
    banner.hidden = false;
    banner.textContent = '还没配置 Supabase：打开 config.js，把 Project URL 和 anon key 填进去，保存后刷新本页。';
    $('btn-submit').disabled = true;
  } else if (!window.supabase || !window.supabase.createClient) {
    banner.hidden = false;
    banner.textContent = 'supabase-js 没加载成功，检查网络或 CDN 是否被拦截。';
    $('btn-submit').disabled = true;
  } else {
    db = window.supabase.createClient(url, key);
    load();
  }

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

  // PostgREST 的 or() 用逗号和括号做语法分隔，关键词里出现这些字符会炸
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

  var reqSeq = 0;

  function load() {
    if (!db) return;
    var seq = ++reqSeq;          // 只认最后一次请求，避免边打边搜时结果乱序
    setStatus('加载中…');

    buildQuery().then(function (res) {
      if (seq !== reqSeq) return;

      if (res.error) {
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

    // 空串统一存 null，搜索时不会被空值干扰
    Object.keys(payload).forEach(function (k) {
      if (payload[k] === '') payload[k] = null;
    });

    btnSubmit.disabled = true;
    setFormMsg('保存中…');

    db.from('customers').insert(payload).select().then(function (res) {
      btnSubmit.disabled = false;

      if (res.error) {
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
