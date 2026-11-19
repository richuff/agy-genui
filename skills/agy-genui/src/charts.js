/* agy-genui charts — 图表引擎（零依赖 SVG，CSP 安全）
 *
 * 支持类型：line / area / bar / pie / donut / scatter / stackedBar / groupedBar
 * 交互（参考 agy-context 的做法）：
 *   - 悬停数据点/扇区 → 高亮该元素、其余淡化、显示浮动 tooltip
 *   - 图例悬停 → 高亮对应系列、其余淡化；点击 → 显示/隐藏该系列
 *   - 饼图/环形图悬停 → 扇区外扩、中心显示该项名称与占比
 *   - 十字准线（折线图）跟随鼠标
 *   - 数值标签、坐标轴刻度、网格线
 *
 * 本文件由 build.mjs 内联进 widget HTML，不加载任何外部资源。
 */
(function () {
  'use strict';

  var PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                 '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtNum(n) {
    n = Number(n) || 0;
    var a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    if (a > 0 && a < 1) return n.toFixed(2);
    return String(Math.round(n * 100) / 100);
  }

  /* ---------- 坐标轴刻度：取「好看」的步长 ---------- */
  function niceTicks(min, max, count) {
    count = count || 5;
    if (max === min) { max = min + 1; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = (span / count) / step;
    if (err >= 7.5) step *= 10;
    else if (err >= 3.5) step *= 5;
    else if (err >= 1.5) step *= 2;
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step * 0.5; v += step) {
      ticks.push(Math.round(v * 1e6) / 1e6);
    }
    return { lo: lo, hi: hi, ticks: ticks };
  }

  /* ---------- 悬浮提示（单例，跟随鼠标） ---------- */
  var tip = null;
  function getTip() {
    if (tip && tip.parentNode) return tip;
    tip = document.createElement('div');
    tip.className = 'agy-chart-tip';
    document.body.appendChild(tip);
    return tip;
  }
  function showTip(html, evt) {
    var t = getTip();
    t.innerHTML = html;
    t.classList.add('on');
    var pad = 12;
    var x = evt.clientX + pad;
    var y = evt.clientY + pad;
    var r = t.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
    t.style.left = Math.max(4, x) + 'px';
    t.style.top = Math.max(4, y) + 'px';
  }
  function hideTip() {
    if (tip) tip.classList.remove('on');
  }

  /* ==========================================================================
     主渲染入口
     ========================================================================== */
  function renderChart(spec) {
    var box = document.createElement('div');
    box.className = 'comp chart-comp';

    var cfg = spec.chart || spec.echart || {};
    var type = (cfg.preset || cfg.type || spec.preset || 'bar').toLowerCase();
    var data = cfg.data || spec.data || [];
    var xKey = cfg.xKey || 'name';
    var series = cfg.series || [{ key: 'value', name: spec.title || '值', type: type }];

    // 系列默认类型跟随主类型；_i 作为稳定索引供交互定位使用
    series = series.map(function (se, i) {
      return {
        _i: i,
        key: se.key || 'value',
        name: se.name || se.key || ('系列 ' + (i + 1)),
        type: (se.type || type).toLowerCase(),
        color: se.color || PALETTE[i % PALETTE.length],
        yAxisIndex: se.yAxisIndex || 0,
        hidden: false,
        smooth: !!se.smooth,
        points: se.points,
      };
    });

    if (!data.length) {
      box.innerHTML = '<div class="hint">图表暂无数据</div>';
      return box;
    }

    // 饼图 / 环形图走独立分支
    if (type === 'pie' || type === 'donut' || type === 'doughnut') {
      box.appendChild(renderPie(data, series, xKey, type === 'pie' ? 0 : 1, cfg));
      return box;
    }

    box.appendChild(renderCartesian(data, series, xKey, type, cfg));
    return box;
  }

  /* ==========================================================================
     直角坐标系：折线 / 面积 / 柱 / 散点 / 堆叠
     ========================================================================== */
  function renderCartesian(data, series, xKey, type, cfg) {
    var wrap = document.createElement('div');
    wrap.className = 'agy-chart';

    var isStacked = type === 'stackedbar' || cfg.stacked === true;
    var isScatter = type === 'scatter';
    var isArea = type === 'area';

    // 画布尺寸（viewBox 坐标，实际由 CSS 缩放）
    var W = 640, H = 300;
    var padL = 52, padR = 18, padT = 16, padB = 42;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;

    // ---- 计算值域 ----
    function valOf(d, se) { return Number(d[se.key]) || 0; }

    var maxV = -Infinity, minV = Infinity;
    var visible = series.filter(function (s) { return !s.hidden; });
    if (isStacked) {
      data.forEach(function (d) {
        var sum = visible.reduce(function (a, se) { return a + valOf(d, se); }, 0);
        if (sum > maxV) maxV = sum;
        if (0 < minV) minV = 0;
      });
      if (minV === Infinity) minV = 0;
    } else {
      visible.forEach(function (se) {
        data.forEach(function (d) {
          var v = valOf(d, se);
          if (v > maxV) maxV = v;
          if (v < minV) minV = v;
        });
      });
      if (maxV === -Infinity) { maxV = 1; minV = 0; }
      if (minV === Infinity) { minV = 0; }
    }
    if (minV > 0) minV = 0;              // 从 0 起，避免误导
    if (maxV === minV) maxV = minV + 1;

    var tk = niceTicks(minV, maxV, 5);
    var lo = Math.min(tk.lo, minV), hi = Math.max(tk.hi, maxV);

    function yOf(v) { return padT + plotH - ((v - lo) / (hi - lo)) * plotH; }
    function xOf(i) {
      var n = data.length;
      if (n === 1) return padL + plotW / 2;
      return padL + (i / (n - 1)) * plotW;
    }
    function xBand(i) {                     // 柱状图用带宽中心
      var n = data.length;
      var bw = plotW / n;
      return padL + i * bw + bw / 2;
    }

    // ---- 网格 + Y 轴刻度 ----
    var grid = '', yLabels = '';
    tk.ticks.forEach(function (t) {
      var y = yOf(t);
      if (y < padT - 1 || y > padT + plotH + 1) return;
      grid += '<line class="agy-grid-line" x1="' + padL + '" y1="' + y.toFixed(1) +
              '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"/>';
      yLabels += '<text class="agy-axis-text" x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) +
                 '" text-anchor="end">' + esc(fmtNum(t)) + '</text>';
    });

    // ---- X 轴标签（自动抽稀，避免拥挤） ----
    var xLabels = '';
    var maxLabels = Math.max(3, Math.floor(plotW / 56));
    var stepX = Math.ceil(data.length / maxLabels);
    data.forEach(function (d, i) {
      if (i % stepX !== 0 && i !== data.length - 1) return;
      var cx = (type === 'bar' || isStacked) ? xBand(i) : xOf(i);
      var label = String(d[xKey] == null ? '' : d[xKey]);
      if (label.length > 8) label = label.slice(0, 7) + '…';
      xLabels += '<text class="agy-axis-text" x="' + cx.toFixed(1) + '" y="' +
                 (padT + plotH + 20) + '" text-anchor="middle">' + esc(label) + '</text>';
    });

    // ---- 系列绘制 ----
    var shapes = '';
    var hitShapes = '';
    var defs = '';

    if (type === 'bar' || type === 'groupedbar') {
      // 分组柱状
      var n = data.length;
      var bandW = plotW / n;
      var groupW = bandW * 0.72;
      var subW = groupW / Math.max(1, visible.length);
      data.forEach(function (d, i) {
        var bx = padL + i * bandW + (bandW - groupW) / 2;
        visible.forEach(function (se, si) {
          var v = valOf(d, se);
          var y = yOf(v);
          var y0 = yOf(0);
          var h = Math.abs(y0 - y);
          var x = bx + si * subW;
          var w = Math.max(1, subW * 0.86);
          shapes += '<rect class="agy-bar" data-s="' + se._i + '" data-i="' + i + '"' +
                    ' x="' + x.toFixed(1) + '" y="' + Math.min(y, y0).toFixed(1) + '"' +
                    ' width="' + w.toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '"' +
                    ' rx="2" fill="' + se.color + '"/>';
          hitShapes += '<rect class="agy-hit" data-s="' + se._i + '" data-i="' + i + '"' +
                       ' x="' + (x - 1).toFixed(1) + '" y="' + padT + '"' +
                       ' width="' + (w + 2).toFixed(1) + '" height="' + plotH + '" fill="transparent"/>';
        });
      });
    } else if (isStacked) {
      var n2 = data.length;
      var bandW2 = plotW / n2;
      var bw2 = bandW2 * 0.68;
      data.forEach(function (d, i) {
        var x = padL + i * bandW2 + (bandW2 - bw2) / 2;
        var acc = 0;
        visible.forEach(function (se) {
          var v = valOf(d, se);
          var yTop = yOf(acc + v);
          var yBot = yOf(acc);
          var h = Math.abs(yBot - yTop);
          shapes += '<rect class="agy-bar" data-s="' + se._i + '" data-i="' + i + '"' +
                    ' x="' + x.toFixed(1) + '" y="' + Math.min(yTop, yBot).toFixed(1) + '"' +
                    ' width="' + bw2.toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '"' +
                    ' fill="' + se.color + '"/>';
          acc += v;
        });
        hitShapes += '<rect class="agy-hit" data-s="0" data-i="' + i + '"' +
                     ' x="' + x.toFixed(1) + '" y="' + padT + '" width="' + bw2.toFixed(1) +
                     '" height="' + plotH + '" fill="transparent"/>';
      });
    } else if (isScatter) {
      visible.forEach(function (se) {
        data.forEach(function (d, i) {
          var v = valOf(d, se);
          var cx = xOf(i), cy = yOf(v);
          shapes += '<circle class="agy-dot" data-s="' + se._i + '" data-i="' + i + '"' +
                    ' cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4.5"' +
                    ' fill="' + se.color + '" opacity="0.85"/>';
          hitShapes += '<circle class="agy-hit" data-s="' + se._i + '" data-i="' + i + '"' +
                       ' cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="12" fill="transparent"/>';
        });
      });
    } else {
      // line / area（area 叠加渐变填充）
      visible.forEach(function (se) {
        var pts = [];
        data.forEach(function (d, i) {
          pts.push([xOf(i), yOf(valOf(d, se))]);
        });
        var dPath = buildPath(pts, se.smooth);
        if (isArea || se.type === 'area') {
          var gid = 'agyGrad' + se._i + '_' + Math.random().toString(36).slice(2, 7);
          defs += '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
                  '<stop offset="0%" stop-color="' + se.color + '" stop-opacity="0.35"/>' +
                  '<stop offset="100%" stop-color="' + se.color + '" stop-opacity="0.02"/>' +
                  '</linearGradient>';
          var areaD = dPath + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + yOf(lo).toFixed(1) +
                      ' L' + pts[0][0].toFixed(1) + ' ' + yOf(lo).toFixed(1) + ' Z';
          shapes += '<path class="agy-area" data-s="' + se._i + '" d="' + areaD +
                    '" fill="url(#' + gid + ')"/>';
        }
        shapes += '<path class="agy-line" data-s="' + se._i + '" d="' + dPath +
                  '" fill="none" stroke="' + se.color + '" stroke-width="2"' +
                  ' stroke-linejoin="round" stroke-linecap="round"/>';
        if (se.points !== false) {
          pts.forEach(function (pt, i) {
            shapes += '<circle class="agy-dot" data-s="' + se._i + '" data-i="' + i + '"' +
                      ' cx="' + pt[0].toFixed(1) + '" cy="' + pt[1].toFixed(1) + '" r="3.2"' +
                      ' fill="#fff" stroke="' + se.color + '" stroke-width="2"/>';
          });
        }
        // 悬停命中区（整列）
        data.forEach(function (d, i) {
          var half = plotW / Math.max(1, data.length - 1) / 2;
          hitShapes += '<rect class="agy-hit" data-s="' + se._i + '" data-i="' + i + '"' +
                       ' x="' + Math.max(padL, xOf(i) - half).toFixed(1) + '" y="' + padT + '"' +
                       ' width="' + (half * 2).toFixed(1) + '" height="' + plotH + '" fill="transparent"/>';
        });
      });
    }

    // ---- 十字准线（折线/散点用） ----
    var cross = '';
    if (type === 'line' || type === 'area' || isScatter) {
      cross = '<line class="agy-cross" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + plotH) +
              '" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3"' +
              ' opacity="0" pointer-events="none"/>';
    }

    var svg =
      '<svg class="agy-chart-svg" viewBox="0 0 ' + W + ' ' + H + '"' +
      ' preserveAspectRatio="xMidYMid meet" role="img">' +
      (defs ? '<defs>' + defs + '</defs>' : '') +
      grid + yLabels + xLabels +
      shapes + cross +
      '<line class="agy-axis-line" x1="' + padL + '" y1="' + (padT + plotH) +
        '" x2="' + (W - padR) + '" y2="' + (padT + plotH) + '"/>' +
      '<g class="agy-hit-layer">' + hitShapes + '</g>' +
      '</svg>';

    wrap.innerHTML = svg;

    // ---- 图例 ----
    var legend = document.createElement('div');
    legend.className = 'agy-legend';
    series.forEach(function (se) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'agy-legend-item' + (se.hidden ? ' off' : '');
      item.setAttribute('data-s', se._i);
      item.innerHTML = '<span class="agy-legend-dot" style="background:' + se.color + '"></span>' +
                       '<span class="agy-legend-name">' + esc(se.name) + '</span>';
      legend.appendChild(item);
    });
    wrap.appendChild(legend);

    /* ---- 交互绑定 ---- */
    var svgEl = wrap.querySelector('svg');
    var crossEl = wrap.querySelector('.agy-cross');

    function seriesOf(idx) {
      return series.filter(function (s) { return s._i === Number(idx); })[0];
    }

    function highlight(sIdx, dIdx) {
      // 淡化非当前系列
      svgEl.querySelectorAll('.agy-line,.agy-area,.agy-bar,.agy-dot').forEach(function (el) {
        var same = sIdx == null || el.getAttribute('data-s') === String(sIdx);
        el.style.opacity = same ? '' : '0.22';
      });
      // 强调当前点
      svgEl.querySelectorAll('.agy-dot').forEach(function (el) {
        var hit = sIdx != null && el.getAttribute('data-s') === String(sIdx) &&
                  el.getAttribute('data-i') === String(dIdx);
        el.setAttribute('r', hit ? '5.5' : (el.classList.contains('agy-dot') ? '3.2' : '4.5'));
      });
    }

    function clearHighlight() {
      svgEl.querySelectorAll('.agy-line,.agy-area,.agy-bar,.agy-dot').forEach(function (el) {
        el.style.opacity = '';
      });
      if (crossEl) crossEl.setAttribute('opacity', '0');
    }

    svgEl.querySelectorAll('.agy-hit').forEach(function (hit) {
      hit.addEventListener('mouseenter', function (evt) {
        var sIdx = hit.getAttribute('data-s');
        var dIdx = Number(hit.getAttribute('data-i'));
        var d = data[dIdx];
        var se = seriesOf(sIdx);
        if (!d || !se) return;

        highlight(sIdx, dIdx);

        // 十字准线定位
        if (crossEl) {
          var cx = (type === 'bar' || isStacked) ? xBand(dIdx) : xOf(dIdx);
          crossEl.setAttribute('x1', cx.toFixed(1));
          crossEl.setAttribute('x2', cx.toFixed(1));
          crossEl.setAttribute('opacity', '0.45');
        }

        // 提示内容：标题 + 该点所有可见系列
        var rows = visible.map(function (s2) {
          var v = valOf(d, s2);
          var mark = s2._i === Number(sIdx) ? ' agy-tip-row-hi' : '';
          return '<div class="agy-tip-row' + mark + '">' +
                 '<span class="agy-tip-dot" style="background:' + s2.color + '"></span>' +
                 '<span class="agy-tip-name">' + esc(s2.name) + '</span>' +
                 '<span class="agy-tip-val">' + esc(fmtNum(v)) + '</span></div>';
        }).join('');

        showTip('<div class="agy-tip-title">' + esc(String(d[xKey])) + '</div>' + rows, evt);
      });

      hit.addEventListener('mousemove', function (evt) {
        if (tip && tip.classList.contains('on')) {
          // 复用最后一次内容，只更新位置
          showTip(tip.innerHTML, evt);
        }
      });

      hit.addEventListener('mouseleave', function () {
        clearHighlight();
        hideTip();
      });
    });

    // 图例：悬停高亮 / 点击切换系列显隐
    legend.querySelectorAll('.agy-legend-item').forEach(function (btn) {
      btn.addEventListener('mouseenter', function () {
        var s = btn.getAttribute('data-s');
        svgEl.querySelectorAll('.agy-line,.agy-area,.agy-bar,.agy-dot').forEach(function (el) {
          var same = el.getAttribute('data-s') === s;
          el.style.opacity = same ? '' : '0.2';
        });
      });
      btn.addEventListener('mouseleave', clearHighlight);
      btn.addEventListener('click', function () {
        var idx = Number(btn.getAttribute('data-s'));
        var se = series.filter(function (s) { return s._i === idx; })[0];
        if (!se) return;
        // 至少保留一个可见系列
        var othersVisible = series.filter(function (s) { return s._i !== idx && !s.hidden; });
        if (!se.hidden && othersVisible.length === 0) return;
        se.hidden = !se.hidden;
        btn.classList.toggle('off', se.hidden);
        rebuild();
      });
    });

    /* 重建图形（保持 series 状态，只重算值域与路径） */
    function rebuild() {
      var next = renderCartesian(data, series, xKey, type, cfg);
      // 同步图例开关状态到新节点
      if (wrap.parentNode) {
        wrap.parentNode.replaceChild(next, wrap);
        wrap = next;
      }
    }

    return wrap;
  }

  /* 构建折线路径 */
  function buildPath(pts, smooth) {
    if (!pts.length) return '';
    if (pts.length === 1) return 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    if (!smooth) {
      return pts.map(function (p, i) {
        return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }).join(' ');
    }
    // Catmull-Rom → bezier
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6;
      var c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6;
      var c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' +
           c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' +
           p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }

  /* ==========================================================================
     饼图 / 环形图
     ========================================================================== */
  function renderPie(data, series, xKey, innerRatio, cfg) {
    var wrap = document.createElement('div');
    wrap.className = 'agy-chart agy-pie-wrap';

    var W = 640, H = 300;
    var cx = W * 0.34, cy = H / 2;
    var rOuter = 104, rInner = innerRatio ? rOuter * 0.58 : 0;

    var se = series[0];
    var valKey = se ? se.key : 'value';
    var items = data.map(function (d, i) {
      return {
        label: String(d[xKey] == null ? '项目 ' + (i + 1) : d[xKey]),
        value: Number(d[valKey] != null ? d[valKey] : d.value) || 0,
        color: d.color || PALETTE[i % PALETTE.length],
      };
    }).filter(function (it) { return it.value > 0; });

    var total = items.reduce(function (a, b) { return a + b.value; }, 0) || 1;

    // 扇区
    var acc = -Math.PI / 2;
    var slices = '';
    items.forEach(function (it, i) {
      var ang = (it.value / total) * Math.PI * 2;
      var a0 = acc, a1 = acc + ang;
      acc = a1;
      slices += '<path class="agy-slice" data-i="' + i + '"' +
                ' d="' + arcPath(cx, cy, rOuter, rInner, a0, a1) + '"' +
                ' fill="' + it.color + '" opacity="0.9"' +
                ' data-a0="' + a0 + '" data-a1="' + a1 + '"' +
                ' data-cx="' + cx + '" data-cy="' + cy + '"' +
                ' data-r="' + rOuter + '" data-ri="' + rInner + '"/>';
    });

    // 中心文字（环形图）
    var center = '';
    if (rInner) {
      center = '<text class="agy-pie-total-v" x="' + cx + '" y="' + (cy - 2) +
               '" text-anchor="middle">' + esc(fmtNum(total)) + '</text>' +
               '<text class="agy-pie-total-l" x="' + cx + '" y="' + (cy + 16) +
               '" text-anchor="middle">总计</text>';
    }

    var svg = '<svg class="agy-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img">' +
              slices + center + '</svg>';
    wrap.innerHTML = svg;

    // ---- 右侧图例（带数值与占比） ----
    var legend = document.createElement('div');
    legend.className = 'agy-legend agy-legend-vert';
    items.forEach(function (it, i) {
      var pct = (it.value / total * 100).toFixed(1);
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'agy-legend-row';
      row.setAttribute('data-i', i);
      row.innerHTML =
        '<span class="agy-legend-dot" style="background:' + it.color + '"></span>' +
        '<span class="agy-legend-name">' + esc(it.label) + '</span>' +
        '<span class="agy-legend-val">' + esc(fmtNum(it.value)) + '</span>' +
        '<span class="agy-legend-pct">' + pct + '%</span>';
      legend.appendChild(row);
    });
    wrap.appendChild(legend);

    /* ---- 交互：扇区悬停外扩 + 中心数值 + 图例联动 ---- */
    var svgEl = wrap.querySelector('svg');

    function emphasize(i) {
      svgEl.querySelectorAll('.agy-slice').forEach(function (el) {
        var on = el.getAttribute('data-i') === String(i);
        el.setAttribute('opacity', i == null ? '0.9' : (on ? '1' : '0.35'));
        el.classList.toggle('agy-slice-hi', on);
      });
      legend.querySelectorAll('.agy-legend-row').forEach(function (el) {
        el.classList.toggle('on', el.getAttribute('data-i') === String(i));
      });
      // 中心显示当前项
      if (rInner) {
        var vv = svgEl.querySelector('.agy-pie-total-v');
        var ll = svgEl.querySelector('.agy-pie-total-l');
        if (vv && ll) {
          if (i == null) {
            vv.textContent = fmtNum(total);
            ll.textContent = '总计';
          } else {
            var it = items[i];
            vv.textContent = ((it.value / total) * 100).toFixed(1) + '%';
            ll.textContent = it.label;
          }
        }
      }
    }

    svgEl.querySelectorAll('.agy-slice').forEach(function (slice) {
      slice.addEventListener('mouseenter', function (evt) {
        var i = Number(slice.getAttribute('data-i'));
        emphasize(i);
        var it = items[i];
        var pct = (it.value / total * 100).toFixed(1);
        showTip('<div class="agy-tip-title">' + esc(it.label) + '</div>' +
                '<div class="agy-tip-row"><span class="agy-tip-dot" style="background:' +
                it.color + '"></span><span class="agy-tip-name">数值</span>' +
                '<span class="agy-tip-val">' + esc(fmtNum(it.value)) + '</span></div>' +
                '<div class="agy-tip-row"><span class="agy-tip-name" style="padding-left:13px">占比</span>' +
                '<span class="agy-tip-val">' + pct + '%</span></div>', evt);
      });
      slice.addEventListener('mousemove', function (evt) {
        if (tip && tip.classList.contains('on')) showTip(tip.innerHTML, evt);
      });
      slice.addEventListener('mouseleave', function () {
        emphasize(null);
        hideTip();
      });
    });

    legend.querySelectorAll('.agy-legend-row').forEach(function (row) {
      var i = Number(row.getAttribute('data-i'));
      row.addEventListener('mouseenter', function () { emphasize(i); });
      row.addEventListener('mouseleave', function () { emphasize(null); });
      row.addEventListener('click', function () {
        // 点击图例：把该扇区弹出（切换选中态）
        var on = row.classList.toggle('pinned');
        svgEl.querySelectorAll('.agy-slice').forEach(function (el) {
          if (el.getAttribute('data-i') === String(i)) {
            el.classList.toggle('agy-slice-pinned', on);
          }
        });
      });
    });

    return wrap;
  }

  /* 生成扇形/环形路径 */
  function arcPath(cx, cy, r, ri, a0, a1) {
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    if (!ri) {
      return 'M' + cx + ' ' + cy +
             ' L' + x0.toFixed(2) + ' ' + y0.toFixed(2) +
             ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) +
             ' Z';
    }
    var ix0 = cx + ri * Math.cos(a1), iy0 = cy + ri * Math.sin(a1);
    var ix1 = cx + ri * Math.cos(a0), iy1 = cy + ri * Math.sin(a0);
    return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) +
           ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) +
           ' L' + ix0.toFixed(2) + ' ' + iy0.toFixed(2) +
           ' A' + ri + ' ' + ri + ' 0 ' + large + ' 0 ' + ix1.toFixed(2) + ' ' + iy1.toFixed(2) +
           ' Z';
  }

  /* ---------- 导出 ---------- */
  window.AgyGenUICharts = {
    render: renderChart,
    palette: PALETTE,
    fmtNum: fmtNum,
  };
})();
