/* Essentials — metal price trend (copper / aluminium).
   Reads prices.json from the `prices` branch on GitHub (updated daily by
   .github/workflows/prices.yml), so price updates never redeploy the site.
   Markup: a slim <section class="price-bar" data-metal="copper" hidden> under the header shows today's
   price; its "View trend" button opens .price-panel holding <div class="price-trend" data-metal="copper">.
   The graph is drawn on first open (it needs a visible width). If the data can't load, the bar stays hidden. */
(function(){
  'use strict';
  // GitHub raw first: it refreshes within 5 minutes. jsDelivr can lag up to 12h, so it is only a backup.
  var SOURCES = [
    'https://raw.githubusercontent.com/essentials-in/my-essentials/prices/prices.json',
    'https://cdn.jsdelivr.net/gh/essentials-in/my-essentials@prices/prices.json'
  ];
  var RANGES = [['1M', 22], ['3M', 66], ['6M', 130], ['1Y', 260]]; // trading days
  var SVGNS = 'http://www.w3.org/2000/svg';

  var roots = document.querySelectorAll('.price-trend[data-metal]');
  if (roots.length && roots[0].getAttribute('data-src')) SOURCES.unshift(roots[0].getAttribute('data-src')); // testing override
  if (!roots.length) return;

  function getJSON(i){
    if (i >= SOURCES.length) return Promise.reject(new Error('no source'));
    return fetch(SOURCES[i], { cache: 'no-cache' })
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function(){ return getJSON(i + 1); });
  }

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(tag, attrs){
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function money(v){ return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function toDate(s){ var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function longDate(s){ return toDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function change(from, to){
    var diff = to - from, up = diff >= 0;
    return {
      up: up,
      text: (up ? '▲ ' : '▼ ') + money(Math.abs(diff)) + ' (' + (up ? '+' : '−') + Math.abs(diff / from * 100).toFixed(1) + '%)',
      word: up ? 'increase' : 'decline'
    };
  }

  getJSON(0).then(function(data){
    document.querySelectorAll('.price-bar[data-metal]').forEach(function(bar){
      var series = data[bar.getAttribute('data-metal')];
      if (!Array.isArray(series) || series.length < 2) return;
      var last = series[series.length - 1], prev = series[series.length - 2];

      var price = bar.querySelector('[data-pb="price"]');
      price.textContent = money(last[1]);
      price.appendChild(el('span', 'pb-unit', ' /kg'));
      var diff = last[1] - prev[1], up = diff >= 0;
      var ch = bar.querySelector('[data-pb="change"]');
      ch.textContent = (up ? '▲ ' : '▼ ') + Math.abs(diff / prev[1] * 100).toFixed(1) + '% today';
      ch.classList.add(up ? 'is-up' : 'is-down');

      var btn = bar.querySelector('.pb-toggle');
      var panel = bar.querySelector('.price-panel');
      var root = panel && panel.querySelector('.price-trend[data-metal]');
      var built = false;
      function setOpen(open){
        panel.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.firstChild.nodeValue = open ? 'Hide trend ' : 'View trend ';
        btn.lastChild.textContent = open ? '▴' : '▾';
        if (open && !built && root) { built = true; build(root, series, data.updated); }
      }
      if (btn && panel) {
        btn.addEventListener('click', function(){ setOpen(panel.hidden); });
        if (location.hash === '#' + panel.id) setOpen(true); // shared link straight to the trend
      }
      bar.hidden = false;
    });
  }).catch(function(){ /* stay hidden */ });

  function build(root, all, updated){
    var name = root.getAttribute('data-name') || 'Metal';
    var state = { range: '3M', sel: null, hover: null };
    var last = all[all.length - 1], prev = all[all.length - 2];

    // ---- static frame ----
    var head = el('div', 'pt-head');
    var titles = el('div');
    var h2 = el('h2', 'pt-title', name + ' market price'); h2.id = 'pt-' + root.getAttribute('data-metal');
    if (updated) {
      // "(last fetched: …)" with a tooltip that also opens on keyboard focus / tap
      var fetched = el('span', 'pt-fetched');
      var when = new Date(updated);
      var label = el('span', 'pt-fetched-label', '(last fetched: ' + (isNaN(when) ? updated : when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })) + ')');
      label.tabIndex = 0;
      var tipId = 'pt-fetch-tip-' + root.getAttribute('data-metal');
      label.setAttribute('aria-describedby', tipId);
      var ftip = el('span', 'pt-fetched-tip', 'Prices are updated every morning at 8 am.');
      ftip.id = tipId; ftip.setAttribute('role', 'tooltip');
      fetched.appendChild(label); fetched.appendChild(ftip);
      h2.appendChild(document.createTextNode(' '));
      h2.appendChild(fetched);
    }
    titles.appendChild(h2);
    titles.appendChild(el('p', 'pt-sub', 'International reference (LME) · ₹ per kg'));
    var pills = el('div', 'pt-pills'); pills.setAttribute('role', 'group'); pills.setAttribute('aria-label', 'Time range');
    RANGES.forEach(function(r){
      var b = el('button', 'pt-pill', r[0]); b.type = 'button';
      b.addEventListener('click', function(){ state.range = r[0]; state.hover = null; draw(); });
      pills.appendChild(b);
    });
    head.appendChild(titles); head.appendChild(pills);

    var hero = el('div', 'pt-hero');
    var price = el('span', 'pt-price', money(last[1]));
    price.appendChild(el('span', 'pt-unit', ' /kg'));
    var dc = change(prev[1], last[1]);
    var delta = el('span', 'pt-delta ' + (dc.up ? 'is-up' : 'is-down'), dc.text);
    delta.appendChild(el('span', 'pt-muted', ' vs previous day'));
    hero.appendChild(price); hero.appendChild(delta);
    var asOf = el('p', 'pt-asof', 'Price as of ' + longDate(last[0]));

    var plot = el('div', 'pt-plot');
    var svgEl = svg('svg', { 'aria-hidden': 'true', focusable: 'false' });
    var gGrid = svg('path', { class: 'pt-grid' });
    var gArea = svg('path', { class: 'pt-area' });
    var gLine = svg('path', { class: 'pt-line' });
    var gHover = svg('line', { class: 'pt-hairline' });
    var gSel = svg('line', { class: 'pt-selline' });
    [gGrid, gArea, gLine, gHover, gSel].forEach(function(n){ svgEl.appendChild(n); });
    var labels = el('div', 'pt-labels'); labels.setAttribute('aria-hidden', 'true');
    var endDot = el('span', 'pt-dot'); endDot.setAttribute('aria-hidden', 'true');
    var selDot = el('span', 'pt-dot pt-dot-sel'); selDot.setAttribute('aria-hidden', 'true');
    var tip = el('div', 'pt-tip'); tip.setAttribute('aria-hidden', 'true');
    var tipPrice = el('strong'); var tipDate = el('span');
    tip.appendChild(tipPrice); tip.appendChild(tipDate);
    var hit = el('div', 'pt-hit');
    hit.tabIndex = 0;
    hit.setAttribute('role', 'slider');
    hit.setAttribute('aria-label', name + ' price history. Use arrow keys to pick a date.');
    [svgEl, labels, endDot, selDot, tip, hit].forEach(function(n){ plot.appendChild(n); });

    var strip = el('div', 'pt-strip'); strip.setAttribute('aria-live', 'polite');

    var details = el('details', 'pt-table');
    details.appendChild(el('summary', null, 'View monthly prices as a table'));
    var table = el('table'); var thead = el('thead'); var tr = el('tr');
    tr.appendChild(el('th', null, 'Month')); tr.appendChild(el('th', null, 'Closing price (₹/kg)'));
    thead.appendChild(tr); table.appendChild(thead);
    var tbody = el('tbody');
    var months = {};
    all.forEach(function(r){ months[r[0].slice(0, 7)] = r; });
    Object.keys(months).sort().reverse().slice(0, 12).forEach(function(m){
      var row = el('tr');
      row.appendChild(el('td', null, toDate(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })));
      row.appendChild(el('td', null, money(months[m][1])));
      tbody.appendChild(row);
    });
    table.appendChild(tbody); details.appendChild(table);

    var foot = el('p', 'pt-foot', 'Indicative market price. Not an offer to buy or sell.');

    root.setAttribute('aria-labelledby', h2.id);
    [head, hero, asOf, plot, strip, details, foot].forEach(function(n){ root.appendChild(n); });

    // ---- drawing ----
    var view = { pts: [], start: 0, X: null };

    function draw(){
      var days = 66;
      RANGES.forEach(function(r){ if (r[0] === state.range) days = r[1]; });
      Array.prototype.forEach.call(pills.children, function(b){ b.setAttribute('aria-pressed', b.textContent === state.range ? 'true' : 'false'); });

      var start = Math.max(0, all.length - 1 - days);
      var pts = all.slice(start), n = pts.length;
      var W = plot.clientWidth || 600, H = plot.clientHeight || 240;
      var mobile = W < 520;
      var gutter = mobile ? 46 : 56, top = 22, bottom = H - 6, right = 6;
      var plotW = W - gutter - right, plotH = bottom - top;
      var lo = Infinity, hi = -Infinity;
      pts.forEach(function(p){ lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
      var span = hi - lo || hi * 0.02 || 1;
      var raw = span / 3, mag = Math.pow(10, Math.floor(Math.log10(raw)));
      var step = [1, 2, 2.5, 5, 10].map(function(m){ return m * mag; }).filter(function(v){ return v >= raw; })[0];
      var yLo = Math.floor((lo - span * 0.08) / step) * step;
      var yHi = Math.ceil((hi + span * 0.08) / step) * step;
      var X = function(i){ return gutter + (n === 1 ? plotW : i / (n - 1) * plotW); };
      var Y = function(v){ return top + (yHi - v) / (yHi - yLo) * plotH; };
      view = { pts: pts, start: start, X: X, Y: Y, W: W, H: H, n: n };

      svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var d = '';
      pts.forEach(function(p, i){ d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[1]).toFixed(1); });
      gLine.setAttribute('d', d);
      gArea.setAttribute('d', d + 'L' + X(n - 1).toFixed(1) + ' ' + bottom + 'L' + X(0).toFixed(1) + ' ' + bottom + 'Z');

      labels.textContent = '';
      var g = '';
      for (var v = yLo; v <= yHi + 1e-9; v += step) {
        var y = Y(v);
        g += 'M' + gutter + ' ' + y.toFixed(1) + 'H' + (W - right);
        var yl = el('span', 'pt-ylab', '₹' + Math.round(v).toLocaleString('en-IN'));
        yl.style.top = y + 'px';
        labels.appendChild(yl);
      }
      gGrid.setAttribute('d', g);
      var count = mobile ? 3 : 5;
      var fmt = days > 100 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' };
      for (var k = 0; k < count; k++) {
        var i = Math.round(k * (n - 1) / (count - 1));
        var xl = el('span', 'pt-xlab', toDate(pts[i][0]).toLocaleDateString('en-IN', fmt));
        xl.style.left = X(i) + 'px';
        xl.style.transform = 'translateX(' + (k === 0 ? '0' : k === count - 1 ? '-100%' : '-50%') + ')';
        labels.appendChild(xl);
      }
      place(endDot, X(n - 1), Y(last[1]));
      hit.setAttribute('aria-valuemin', '0');
      hit.setAttribute('aria-valuemax', String(n - 1));
      drawHover(); drawSel();
    }

    function place(node, x, y){ node.style.left = x + 'px'; node.style.top = y + 'px'; }

    function drawHover(){
      var i = state.hover;
      if (i == null || i >= view.n) { gHover.style.display = 'none'; tip.style.display = 'none'; return; }
      var p = view.pts[i], x = view.X(i);
      setLine(gHover, x);
      tipPrice.textContent = money(p[1]); tipDate.textContent = longDate(p[0]);
      tip.style.display = 'block';
      tip.style.left = x + 'px';
      var f = x / view.W;
      tip.style.transform = 'translateX(' + (f < 0.15 ? '0' : f > 0.85 ? '-100%' : '-50%') + ')';
    }

    function drawSel(){
      strip.textContent = '';
      var idx = state.sel == null ? -1 : state.sel - view.start;
      if (idx < 0 || idx >= view.n) {
        gSel.style.display = 'none'; selDot.style.display = 'none';
        hit.setAttribute('aria-valuenow', String(view.n - 1));
        hit.setAttribute('aria-valuetext', longDate(last[0]) + ', ' + money(last[1]));
        strip.appendChild(el('span', 'pt-muted', 'Tap any point on the graph to see that day\'s price and how it compares with today.'));
        return;
      }
      var p = view.pts[idx], c = change(p[1], last[1]);
      setLine(gSel, view.X(idx));
      selDot.style.display = 'block'; place(selDot, view.X(idx), view.Y(p[1]));
      hit.setAttribute('aria-valuenow', String(idx));
      hit.setAttribute('aria-valuetext', longDate(p[0]) + ', ' + money(p[1]) + ', ' + c.word + ' to today');

      var a = el('div', 'pt-cell');
      a.appendChild(el('span', 'pt-k', longDate(p[0])));
      var av = el('span', 'pt-v', money(p[1])); av.appendChild(el('span', 'pt-unit', ' /kg')); a.appendChild(av);
      var b = el('div', 'pt-cell pt-cell-right');
      b.appendChild(el('span', 'pt-k', 'Change to today'));
      var bv = el('span', 'pt-v ' + (c.up ? 'is-up' : 'is-down'), c.text + ' '); bv.appendChild(el('span', 'pt-word', c.word)); b.appendChild(bv);
      var clear = el('button', 'pt-clear', 'Clear'); clear.type = 'button'; clear.setAttribute('aria-label', 'Clear selected date');
      clear.addEventListener('click', function(){ state.sel = null; drawSel(); hit.focus(); });
      strip.appendChild(a); strip.appendChild(b); strip.appendChild(clear);
    }

    function setLine(line, x){
      line.style.display = 'inline';
      line.setAttribute('x1', x); line.setAttribute('x2', x);
      line.setAttribute('y1', 22); line.setAttribute('y2', view.H - 6);
    }

    function indexAt(e){
      var r = hit.getBoundingClientRect();
      var f = (e.clientX - r.left) / r.width;
      return Math.max(0, Math.min(view.n - 1, Math.round(f * (view.n - 1))));
    }
    hit.addEventListener('pointermove', function(e){ var i = indexAt(e); if (i !== state.hover) { state.hover = i; drawHover(); } });
    hit.addEventListener('pointerleave', function(){ state.hover = null; drawHover(); });
    hit.addEventListener('click', function(e){ state.sel = view.start + indexAt(e); drawSel(); });
    hit.addEventListener('keydown', function(e){
      var cur = state.sel == null ? view.n - 1 : state.sel - view.start, nx = null;
      if (e.key === 'ArrowLeft') nx = Math.max(0, cur - 1);
      else if (e.key === 'ArrowRight') nx = Math.min(view.n - 1, cur + 1);
      else if (e.key === 'Home') nx = 0;
      else if (e.key === 'End') nx = view.n - 1;
      if (nx == null) return;
      e.preventDefault(); state.sel = view.start + nx; state.hover = null; drawHover(); drawSel();
    });

    draw();
    if (window.ResizeObserver) {
      var lastW = plot.clientWidth;
      new ResizeObserver(function(){ if (plot.clientWidth !== lastW) { lastW = plot.clientWidth; draw(); } }).observe(plot);
    }
  }
})();
