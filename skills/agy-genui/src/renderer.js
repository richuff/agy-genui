/* agy-genui renderer — 组件渲染引擎
 * 本文件会被内联进生成的 widget HTML，在 <agent-embed> 沙箱中运行。
 * 只输出白名单组件，不使用 eval，不加载外部脚本。
 */
(function () {
  'use strict';

  /* ---------- 工具 ---------- */
  var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; }); }
  function fmtNum(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }
  function tpl(str, data) {
    return String(str == null ? '' : str).replace(/\{\{([\w.]+)\}\}/g, function (_, key) {
      var parts = key.split('.'), cur = data;
      for (var i = 0; i < parts.length; i++) { cur = cur == null ? undefined : cur[parts[i]]; }
      return cur == null ? '' : String(cur);
    });
  }
  function postAction(action) {
    if (!action) return;
    try { window.parent && window.parent.postMessage({ source: 'agy-genui', type: 'action', action: action }, '*'); } catch (e) {}
  }
  function sparkline(data, color) {
    if (!data || !data.length) return '';
    var max = Math.max.apply(null, data), min = Math.min.apply(null, data);
    var range = (max - min) || 1;
    var pts = data.map(function (v, i) {
      var x = (i / ((data.length - 1) || 1)) * 100;
      var y = 24 - ((v - min) / range) * 20 - 2;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none">' +
      '<polyline fill="none" stroke="' + (color || 'var(--agy-primary)') + '" stroke-width="2" points="' + pts + '"/></svg>';
  }

  /* ---------- 组件渲染器（白名单） ---------- */
  var R = {};

  R.stat = function (s) {
    var delta = '';
    if (s.delta != null) {
      var cls = s.deltaType === 'decrease' ? 'delta-neg' : (s.deltaType === 'increase' ? 'delta-pos' : '');
      delta = '<span class="delta ' + cls + '">' + esc(s.delta) + '</span>';
    }
    return '<div class="stat">' +
      (s.eyebrow ? '<div class="eyebrow">' + esc(s.eyebrow) + '</div>' : '') +
      '<div class="stat-value">' + esc(s.value) + ' ' + delta + '</div>' +
      (s.label ? '<div class="stat-label">' + esc(s.label) + '</div>' : '') +
      (s.sparkline ? sparkline(s.sparkline) : '') +
      '</div>';
  };

  R.table = function (s) {
    var cols = s.columns || [];
    var rows = Array.isArray(s.data) ? s.data.slice() : [];
    var filterable = s.filterable !== false;
    var sortable = s.sortable !== false;
    var pageSize = (s.pagination && s.pagination.pageSize) || 0;
    var state = { sortKey: null, sortDir: 1, filter: '', page: 0 };

    function cell(col, row) {
      var v = row[col.key];
      if (col.type === 'badge') {
        var tone = (col.mapping && col.mapping[v]) || 'gray';
        return '<span class="badge badge-' + esc(tone) + '">' + esc(v) + '</span>';
      }
      if (col.type === 'bar') {
        var pct = v > 1 ? v : (v || 0) * 100;
        return '<div class="cell-bar"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>';
      }
      if (col.type === 'sparkline') return sparkline(v);
      if (col.type === 'currency') return '$' + esc(v);
      if (col.type === 'number' && typeof v === 'number') return fmtNum(v);
      return esc(v);
    }

    function draw() {
      var data = rows.filter(function (r) {
        if (!state.filter) return true;
        return cols.some(function (c) { return String(r[c.key] == null ? '' : r[c.key]).toLowerCase().indexOf(state.filter) >= 0; });
      });
      if (state.sortKey) {
        data.sort(function (a, b) {
          var x = a[state.sortKey], y = b[state.sortKey];
          if (typeof x === 'number' && typeof y === 'number') return (x - y) * state.sortDir;
          return String(x).localeCompare(String(y)) * state.sortDir;
        });
      }
      var totalPages = pageSize ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;
      if (state.page >= totalPages) state.page = totalPages - 1;
      var view = pageSize ? data.slice(state.page * pageSize, (state.page + 1) * pageSize) : data;

      var head = cols.map(function (c) {
        var sk = (state.sortKey === c.key ? (state.sortDir === 1 ? ' sort-asc' : ' sort-desc') : '');
        return '<th class="' + (sortable && c.sortable !== false ? 'sortable' + sk : '') + '" data-sort="' + esc(c.key) + '">' + esc(c.title || c.key) + '</th>';
      }).join('');
      var body = view.map(function (r, i) {
        return '<tr>' + cols.map(function (c) { return '<td>' + cell(c, r) + '</td>'; }).join('') + '</tr>';
      }).join('') || '<tr><td colspan="' + cols.length + '" class="empty">无数据</td></tr>';

      var pager = '';
      if (pageSize && data.length > pageSize) {
        pager = '<div class="pager"><button data-page="prev"' + (state.page === 0 ? ' disabled' : '') + '>上一页</button>' +
          '<span>' + (state.page + 1) + ' / ' + totalPages + '</span>' +
          '<button data-page="next"' + (state.page >= totalPages - 1 ? ' disabled' : '') + '>下一页</button></div>';
      }

      var html = '<div class="table-wrap">' +
        (filterable ? '<div class="filter"><input class="filter-input" placeholder="筛选…" value="' + esc(state.filter) + '"></div>' : '') +
        '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>' + pager + '</div>';
      root.innerHTML = html;

      var fi = root.querySelector('.filter-input');
      if (fi) fi.addEventListener('input', function () { state.filter = fi.value.toLowerCase(); state.page = 0; draw(); });
      Array.prototype.forEach.call(root.querySelectorAll('th.sortable'), function (th) {
        th.addEventListener('click', function () {
          var k = th.getAttribute('data-sort');
          if (state.sortKey === k) state.sortDir = -state.sortDir; else { state.sortKey = k; state.sortDir = 1; }
          draw();
        });
      });
      var pb = root.querySelector('[data-page="prev"]'), nb = root.querySelector('[data-page="next"]');
      if (pb) pb.addEventListener('click', function () { state.page--; draw(); });
      if (nb) nb.addEventListener('click', function () { state.page++; draw(); });
    }

    var root = document.createElement('div');
    root.className = 'comp table-comp';
    draw();
    return root;
  };

  R.echart = function (s) {
    var box = document.createElement('div');
    box.className = 'comp chart-comp';
    var preset = (s.echart && s.echart.preset) || 'bar';
    var data = (s.echart && s.echart.data) || s.data || [];
    var xKey = (s.echart && s.echart.xKey) || 'name';
    var series = (s.echart && s.echart.series) || [{ key: 'value', name: '值', type: preset }];

    // 轻量 SVG 渲染（无需外部依赖，CSP 友好）—— 支持 bar / line / pie
    var max = 0;
    data.forEach(function (d) { series.forEach(function (se) { var v = Number(d[se.key]); if (v > max) max = v; }); });
    max = max || 1;
    var W = 600, H = 260, pad = 36;
    var buckets = data.slice(0, 20);
    var bw = buckets.length ? (W - pad * 2) / buckets.length : 0;
    var parts = [];

    if (preset === 'pie') {
      var total = data.reduce(function (a, d) { return a + (Number(d.value || d[s.valueKey || 'value']) || 0); }, 0) || 1;
      var cx = W / 2, cy = H / 2, r = 90, acc = -Math.PI / 2;
      var palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
      data.slice(0, 12).forEach(function (d, i) {
        var val = Number(d.value || d[s.valueKey || 'value']) || 0;
        var ang = (val / total) * Math.PI * 2;
        var x1 = cx + r * Math.cos(acc), y1 = cy + r * Math.sin(acc);
        acc += ang;
        var x2 = cx + r * Math.cos(acc), y2 = cy + r * Math.sin(acc);
        var large = ang > Math.PI ? 1 : 0;
        parts.push('<path d="M' + cx + ' ' + cy + ' L' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' Z" fill="' + palette[i % palette.length] + '" opacity="0.85"><title>' + esc(d[xKey]) + ': ' + val + '</title></path>');
      });
      box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-svg">' + parts.join('') + '</svg>';
      return box;
    }

    // bar / line
    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var gy = pad + (H - pad * 2) * g / 4;
      grid += '<line x1="' + pad + '" y1="' + gy + '" x2="' + (W - pad) + '" y2="' + gy + '" class="grid"/>';
      grid += '<text x="' + (pad - 6) + '" y="' + (gy + 4) + '" class="axis" text-anchor="end">' + fmtNum(max * (4 - g) / 4) + '</text>';
    }
    var colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    var bars = '';
    buckets.forEach(function (d, i) {
      var bx = pad + i * bw + bw * 0.15;
      var groupW = bw * 0.7;
      var subW = groupW / series.length;
      series.forEach(function (se, si) {
        var v = Number(d[se.key]) || 0;
        var bh = (v / max) * (H - pad * 2);
        var color = se.color || colors[si % colors.length];
        bars += '<rect x="' + (bx + si * subW).toFixed(1) + '" y="' + (H - pad - bh).toFixed(1) + '" width="' + (subW * 0.8).toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + color + '" opacity="0.85"><title>' + esc(se.name || se.key) + ': ' + v + '</title></rect>';
      });
      bars += '<text x="' + (pad + i * bw + bw / 2).toFixed(1) + '" y="' + (H - pad + 16) + '" class="axis" text-anchor="middle">' + esc(String(d[xKey]).slice(0, 8)) + '</text>';
    });
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-svg">' + grid + bars + '</svg>';
    return box;
  };

  R.plot = function (s) {
    var box = document.createElement('div');
    box.className = 'comp plot-comp';
    box.innerHTML = '<div class="hint">函数绘图：' + esc(s.title || 'Plot') + '（静态预览，参数见 DSL）</div>';
    // 安全说明：eval 在沙箱禁用，plot 仅渲染 DSL 提供的采样点；若有 samples 则画折线
    var samples = s.samples;
    if (Array.isArray(samples) && samples.length) {
      var max = Math.max.apply(null, samples), min = Math.min.apply(null, samples);
      var range = (max - min) || 1;
      var pts = samples.map(function (v, i) {
        return (i / ((samples.length - 1) || 1) * 100).toFixed(1) + ',' + (24 - ((v - min) / range) * 20 - 2).toFixed(1);
      }).join(' ');
      box.innerHTML += '<svg viewBox="0 0 100 24" preserveAspectRatio="none" class="plot-svg"><polyline fill="none" stroke="var(--agy-primary)" stroke-width="1" points="' + pts + '"/></svg>';
    }
    return box;
  };

  R.progress = function (s) {
    var v = Number(s.value) || 0, max = Number(s.max) || 100;
    var pct = Math.max(0, Math.min(100, v / max * 100));
    var ring = s.variant === 'ring';
    if (ring) {
      var C = 2 * Math.PI * 26;
      var off = C * (1 - pct / 100);
      return '<div class="comp progress ring">' +
        '<svg viewBox="0 0 64 64"><circle class="track" cx="32" cy="32" r="26"/>' +
        '<circle class="progress" cx="32" cy="32" r="26" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg>' +
        '<span class="ring-label">' + Math.round(pct) + '%</span>' +
        (s.label ? '<span class="progress-label">' + esc(s.label) + '</span>' : '') + '</div>';
    }
    return '<div class="comp progress">' +
      (s.label ? '<div class="progress-label">' + esc(s.label) + ' · ' + Math.round(pct) + '%</div>' : '') +
      '<div class="progress-track"><i style="width:' + pct.toFixed(1) + '%"></i></div></div>';
  };

  R.badge = function (s) {
    return '<span class="comp badge badge-' + esc(s.tone || 'info') + '">' + esc(s.label || s.text || '') + '</span>';
  };

  R.callout = function (s) {
    var tone = s.tone || 'info';
    return '<div class="comp callout callout-' + esc(tone) + '"><div class="callout-content">' + esc(s.text || s.content || '') + '</div></div>';
  };

  R.code = function (s) {
    return '<div class="comp code"><div class="code-head">' + esc(s.title || s.language || 'code') + '</div><pre><code>' + esc(s.code || s.content || '') + '</code></pre></div>';
  };

  R.diff = function (s) {
    function lines(code, cls) {
      return String(code || '').split('\n').map(function (l, i) {
        return '<div class="diff-line ' + cls + '"><span class="gutter">' + (i + 1) + '</span><span class="content">' + esc(l) + '</span></div>';
      }).join('');
    }
    return '<div class="comp diff"><div class="code-head">' + esc(s.title || 'Diff') + '</div>' +
      '<div class="diff-cols"><div class="diff-col"><div class="diff-h removed-h">− old</div>' + lines(s.oldCode, 'removed') + '</div>' +
      '<div class="diff-col"><div class="diff-h added-h">+ new</div>' + lines(s.newCode, 'added') + '</div></div></div>';
  };

  R.timeline = function (s) {
    var items = s.items || [];
    return '<div class="comp timeline">' + items.map(function (it) {
      return '<div class="tl-item"><div class="tl-dot"></div><div class="tl-body">' +
        (it.time ? '<div class="tl-time">' + esc(it.time) + '</div>' : '') +
        '<div class="tl-title">' + esc(it.title || '') + '</div>' +
        (it.desc ? '<div class="tl-desc">' + esc(it.desc) + '</div>' : '') + '</div></div>';
    }).join('') + '</div>';
  };

  R.tree = function (s) {
    function node(n, depth) {
      var hasKids = n.children && n.children.length;
      var open = n.open !== false;
      var h = '<div class="tree-node" style="padding-left:' + (depth * 16 + 8) + 'px">' +
        (hasKids ? '<span class="tree-caret">' + (open ? '▾' : '▸') + '</span>' : '<span class="tree-caret blank"></span>') +
        '<span class="tree-icon">' + (hasKids ? '📁' : '📄') + '</span><span class="tree-name">' + esc(n.name || '') + '</span></div>';
      if (hasKids && open) h += n.children.map(function (c) { return node(c, depth + 1); }).join('');
      return h;
    }
    var roots = s.nodes || s.items || [];
    return '<div class="comp tree">' + roots.map(function (n) { return node(n, 0); }).join('') + '</div>';
  };

  R.form = function (s) {
    var box = document.createElement('div');
    box.className = 'comp form';
    var fields = s.fields || [];
    box.innerHTML = (s.title ? '<div class="comp-title">' + esc(s.title) + '</div>' : '') +
      '<div class="form-body">' + fields.map(function (f) {
        var id = 'f_' + esc(f.key);
        var input;
        if (f.type === 'select') input = '<select id="' + id + '" data-key="' + esc(f.key) + '">' + (f.options || []).map(function (o) { return '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>'; }).join('') + '</select>';
        else if (f.type === 'textarea') input = '<textarea id="' + id + '" data-key="' + esc(f.key) + '" placeholder="' + esc(f.placeholder || '') + '"></textarea>';
        else if (f.type === 'checkbox') input = '<input type="checkbox" id="' + id + '" data-key="' + esc(f.key) + '">';
        else input = '<input type="' + (f.type === 'number' ? 'number' : 'text') + '" id="' + id + '" data-key="' + esc(f.key) + '" placeholder="' + esc(f.placeholder || '') + '">';
        return '<div class="form-field"><label for="' + id + '">' + esc(f.label || f.key) + '</label>' + input + '</div>';
      }).join('') + '</div><div class="form-actions"><button class="btn primary" data-submit>提交</button></div>';
    box.querySelector('[data-submit]').addEventListener('click', function () {
      var payload = {};
      Array.prototype.forEach.call(box.querySelectorAll('[data-key]'), function (el) {
        payload[el.getAttribute('data-key')] = el.type === 'checkbox' ? el.checked : el.value;
      });
      postAction({ type: 'form_submit', form: payload, action: s.submitAction || null });
      var note = box.querySelector('.form-note');
      if (!note) { note = document.createElement('div'); note.className = 'form-note'; box.appendChild(note); }
      note.textContent = '已提交（已回传给 Agent）';
    });
    return box;
  };

  R.quiz = function (s) {
    var box = document.createElement('div');
    box.className = 'comp quiz';
    var qs = s.questions || [];
    box.innerHTML = (s.title ? '<div class="comp-title">' + esc(s.title) + '</div>' : '') +
      qs.map(function (q, qi) {
        var opts = (q.options || []).map(function (o, oi) {
          return '<label class="quiz-opt"><input type="' + (q.type === 'multiple' ? 'checkbox' : 'radio') + '" name="q' + qi + '" data-q="' + qi + '" data-i="' + oi + '"><span>' + esc(o) + '</span></label>';
        }).join('');
        return '<div class="quiz-q" data-qi="' + qi + '"><div class="quiz-qt">' + (qi + 1) + '. ' + esc(q.question) + '</div><div class="quiz-opts">' + opts + '</div><div class="quiz-fb"></div></div>';
      }).join('') + '<div class="quiz-actions"><button class="btn primary" data-grade>提交答案</button><span class="quiz-score"></span></div>';
    box.querySelector('[data-grade]').addEventListener('click', function () {
      var correct = 0;
      qs.forEach(function (q, qi) {
        var picked = Array.prototype.filter.call(box.querySelectorAll('[data-q="' + qi + '"]:checked'), function (el) { return true; }).map(function (el) { return Number(el.getAttribute('data-i')); });
        var ans = Array.isArray(q.answer) ? q.answer : [q.answer];
        var ok = picked.length === ans.length && picked.every(function (p) { return ans.indexOf(p) >= 0; });
        if (ok) correct++;
        var qEl = box.querySelector('[data-qi="' + qi + '"]');
        var fb = qEl.querySelector('.quiz-fb');
        fb.textContent = ok ? '✓ 正确' : '✗ 错误' + (q.explanation ? ' — ' + q.explanation : '');
        fb.className = 'quiz-fb ' + (ok ? 'ok' : 'bad');
      });
      box.querySelector('.quiz-score').textContent = '得分：' + correct + ' / ' + qs.length;
      postAction({ type: 'quiz_submit', score: correct, total: qs.length });
    });
    return box;
  };

  R.tabs = function (s) {
    var box = document.createElement('div');
    box.className = 'comp tabs';
    var tabs = s.tabs || [];
    box.innerHTML = '<div class="tabs-list">' + tabs.map(function (t, i) {
      return '<button class="tab-btn' + (i === 0 ? ' active' : '') + '" data-i="' + i + '">' + esc(t.label) + '</button>';
    }).join('') + '</div><div class="tabs-body"></div>';
    var body = box.querySelector('.tabs-body');
    function show(i) {
      body.innerHTML = '';
      var content = tabs[i] && tabs[i].content;
      if (content) body.appendChild(render(content));
      Array.prototype.forEach.call(box.querySelectorAll('.tab-btn'), function (b, j) { b.classList.toggle('active', i === j); });
    }
    Array.prototype.forEach.call(box.querySelectorAll('.tab-btn'), function (b) {
      b.addEventListener('click', function () { show(Number(b.getAttribute('data-i'))); });
    });
    show(0);
    return box;
  };

  R.accordion = function (s) {
    var box = document.createElement('div');
    box.className = 'comp accordion';
    var items = s.items || [];
    box.innerHTML = items.map(function (it, i) {
      return '<div class="acc-item"><button class="acc-trigger" data-i="' + i + '">' + esc(it.title) + ' <span class="acc-caret">▾</span></button><div class="acc-body"></div></div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.acc-trigger'), function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.getAttribute('data-i'));
        var body = btn.nextElementSibling;
        var open = body.classList.toggle('open');
        if (open && !body.firstChild && items[i].content) body.appendChild(render(items[i].content));
      });
    });
    return box;
  };

  R.card = function (s) {
    var box = document.createElement('div');
    box.className = 'comp card';
    if (s.title) box.innerHTML = '<div class="comp-title">' + esc(s.title) + '</div>';
    var body = document.createElement('div');
    body.className = 'card-body';
    var content = s.content || (s.items ? { type: 'row', items: s.items } : null);
    if (content) body.appendChild(render(content));
    box.appendChild(body);
    return box;
  };

  R.row = function (s) {
    var box = document.createElement('div');
    box.className = 'comp row';
    (s.items || []).forEach(function (it) {
      var c = document.createElement('div');
      c.className = 'row-item';
      c.style.flex = s.grow ? '1 1 0' : '0 1 auto';
      c.appendChild(render(it));
      box.appendChild(c);
    });
    return box;
  };

  R.button = function (s) {
    var b = document.createElement('button');
    b.className = 'comp btn ' + (s.variant === 'primary' ? 'primary' : (s.variant || 'secondary'));
    b.textContent = s.label || '按钮';
    if (s.disabled) b.disabled = true;
    b.addEventListener('click', function () { postAction(s.action || { type: 'button_click', label: s.label }); });
    return b;
  };

  R.markdown = function (s) {
    // 极简 Markdown：仅处理换行与代码块，避免引入外部依赖
    var box = document.createElement('div');
    box.className = 'comp markdown';
    var text = String(s.content || s.text || '');
    box.innerHTML = '<pre class="md-text">' + esc(text) + '</pre>';
    return box;
  };

  R.image = function (s) {
    var box = document.createElement('div');
    box.className = 'comp image';
    box.innerHTML = '<img src="' + esc(s.src || '') + '" alt="' + esc(s.alt || '') + '" style="max-width:100%;border-radius:8px">';
    return box;
  };

  /* ---------- 流程图（分层车道布局，避免错位） ----------
   * DSL:
   * { type:"flow", title, lanes:[
   *     { name:"阶段一：路由判定",
   *       // 方式一：一串节点，自动用箭头连接
   *       steps:[ {k:"process",label:"拿到问题"}, {k:"decision",label:"turn_no > 1 ?"},
   *               {k:"process",label:"走深度思考",sub:"耗时 ≈ 0 ms"} ],
   *       branch:{ label:"纯内存 if 判断", to:{steps:[...]} }   // 可选分支
   *     }
   * ] }
   * 节点 k: process | decision | note | start | end
   */
  R.flow = function (s) {
    var box = document.createElement('div');
    box.className = 'comp flow';

    function nodeHtml(n) {
      var k = n.k || n.kind || 'process';
      var cls = 'flow-node flow-node--' + k;
      var inner = '<span class="flow-node-label">' + esc(n.label || n.text || '') + '</span>';
      if (n.sub) inner += '<span class="flow-node-sub">' + esc(n.sub) + '</span>';
      return '<div class="' + cls + '">' + inner + '</div>';
    }

    function stepsHtml(steps) {
      if (!Array.isArray(steps) || !steps.length) return '';
      var out = [];
      steps.forEach(function (n, i) {
        if (i > 0) {
          var prevLabel = n.edgeLabel || '';
          out.push('<div class="flow-arrow' + (prevLabel ? ' flow-arrow--labeled' : '') + '">' +
            (prevLabel ? '<span class="flow-arrow-label">' + esc(prevLabel) + '</span>' : '') +
            '<span class="flow-arrow-line"></span></div>');
        }
        out.push(nodeHtml(n));
      });
      return out.join('');
    }

    var lanes = s.lanes || [];
    var html = '';
    lanes.forEach(function (lane, li) {
      var laneTitle = lane.name ? '<div class="flow-lane-name">' + esc(lane.name) + '</div>' : '';
      var row = stepsHtml(lane.steps);
      html += '<div class="flow-lane" data-lane="' + li + '">' + laneTitle +
        '<div class="flow-track">' + row + '</div>';

      // 可选：主轨下方的分支行（如「纯内存 if 判断」走另一条路）
      if (lane.branch && lane.branch.steps) {
        html += '<div class="flow-branch">' +
          '<div class="flow-branch-head">' + esc(lane.branch.label || '分支') + '</div>' +
          '<div class="flow-track">' + stepsHtml(lane.branch.steps) + '</div>' +
          '</div>';
      }
      html += '</div>';
    });

    if (!html) html = '<div class="flow-empty">flow 缺少 lanes</div>';
    box.innerHTML = html;

    if (s.title) {
      var h = document.createElement('div');
      h.className = 'comp-title';
      h.textContent = s.title;
      box.insertBefore(h, box.firstChild);
    }
    return box;
  };

  /* ---------- 渲染入口 ---------- */
  function render(spec) {
    if (!spec || typeof spec !== 'object') return document.createTextNode('');
    var type = String(spec.type || '');
    var fn = R[type];
    if (!fn) {
      var d = document.createElement('div');
      d.className = 'comp unknown';
      d.textContent = '未知组件类型: ' + type;
      return d;
    }
    try {
      var out = fn(spec);
      // 组件渲染器既可返回 DOM 节点，也可返回 HTML 字符串；统一转成节点
      if (typeof out === 'string') {
        var box = document.createElement('div');
        box.innerHTML = out;
        var el = box.firstElementChild || box;
        // 字符串组件统一带 .comp，保证进入 widget-items 栅格时样式一致
        if (el.classList && !el.classList.contains('comp')) el.classList.add('comp');
        return el;
      }
      return out;
    }
    catch (e) {
      var er = document.createElement('div');
      er.className = 'comp error';
      er.textContent = '组件渲染失败 (' + type + '): ' + e.message;
      return er;
    }
  }

  window.AgyGenUIRender = {
    render: render,
    components: Object.keys(R),
    version: '1.0.0'
  };

  // 自动渲染：读取内联的 __AGY_SPEC__
  function boot() {
    var host = document.getElementById('agy-root');
    if (!host) return;
    var spec = window.__AGY_SPEC__;
    if (!spec) { host.innerHTML = '<div class="comp error">缺少 __AGY_SPEC__</div>'; return; }
    if (spec.title) {
      var h = document.createElement('div');
      h.className = 'widget-title';
      h.textContent = spec.title;
      host.appendChild(h);
    }
    if (spec.description) {
      var d = document.createElement('div');
      d.className = 'widget-desc';
      d.textContent = spec.description;
      host.appendChild(d);
    }
    var items = spec.items || (spec.type ? [spec] : []);
    if (!Array.isArray(items)) items = [items];
    var wrap = document.createElement('div');
    wrap.className = 'widget-items';
    items.forEach(function (it) { wrap.appendChild(render(it)); });
    host.appendChild(wrap);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
