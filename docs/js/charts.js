/* Biểu đồ SVG tối giản, chạy offline. Một trục Y cho mỗi biểu đồ (không dùng biểu đồ hai trục).
   Đường 2px, cột ≤ 24px bo 4px đầu, lưới mảnh, tooltip khi rê chuột / chạm. */
(function (root) {
  'use strict';
  var C = {}, NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, cls, anchor) {
    var t = el('text', { x: x, y: y, 'class': cls || 'viz-axis', 'text-anchor': anchor || 'start' }, parent);
    t.textContent = s; return t;
  }
  function nice(max, n) {
    if (!(max > 0)) return { max: 1, step: 0.25 };
    var raw = max / (n || 4), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), m = raw / p;
    var step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
    return { max: Math.ceil(max / step) * step, step: step };
  }
  var tip;
  function tipEl() { if (!tip) { tip = document.createElement('div'); tip.className = 'viz-tip'; tip.setAttribute('role', 'status'); document.body.appendChild(tip); } return tip; }
  function showTip(evX, evY, title, rows, note) {
    var t = tipEl(); t.innerHTML = '';
    var h = document.createElement('div'); h.className = 'viz-tip-title'; h.textContent = title; t.appendChild(h);
    rows.forEach(function (r) {
      var row = document.createElement('div'); row.className = 'viz-tip-row';
      var key = document.createElement('span'); key.className = 'viz-tip-key'; if (r.color) key.style.background = r.color; row.appendChild(key);
      var v = document.createElement('strong'); v.textContent = r.value; row.appendChild(v);
      var n = document.createElement('span'); n.className = 'viz-tip-name'; n.textContent = r.name; row.appendChild(n);
      t.appendChild(row);
    });
    if (note) { var nn = document.createElement('div'); nn.className = 'viz-tip-note'; nn.textContent = note; t.appendChild(nn); }
    t.style.display = 'block';
    var w = t.offsetWidth, hh = t.offsetHeight, vw = document.documentElement.clientWidth;
    var x = evX + 14, y = evY - hh - 12;
    if (x + w > vw - 8) x = evX - w - 14;
    if (x < 8) x = 8;
    if (y < 8) y = evY + 18;
    t.style.left = (x + window.pageXOffset) + 'px'; t.style.top = (y + window.pageYOffset) + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  C.hideTip = hideTip;

  /* Biểu đồ đường: opt = { x:[ngày], series:[{name,color,values[]}], refs:[{y,label}], yFmt, xFmt, height, flags:[bool] (ngày chưa kết thúc), title } */
  C.line = function (host, opt) {
    host.innerHTML = '';
    var W = Math.max(280, host.clientWidth || 600), H = opt.height || 220;
    var ml = 46, mr = opt.refs && opt.refs.length ? 58 : 16, mt = 12, mb = 26;
    var n = opt.x.length;
    var vmax = 0;
    opt.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null && v > vmax) vmax = v; }); });
    (opt.refs || []).forEach(function (r) { if (r.y > vmax) vmax = r.y; });
    var nk = nice(vmax * 1.08, 4);
    var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opt.title || 'Biểu đồ' }, host);
    var pw = W - ml - mr, ph = H - mt - mb;
    var X = function (i) { return ml + (n <= 1 ? pw / 2 : i * pw / (n - 1)); };
    var Y = function (v) { return mt + ph - v / nk.max * ph; };
    for (var v = 0; v <= nk.max + 1e-9; v += nk.step) {
      el('line', { x1: ml, x2: ml + pw, y1: Y(v), y2: Y(v), 'class': v === 0 ? 'viz-base' : 'viz-grid' }, svg);
      txt(svg, ml - 6, Y(v) + 4, opt.yFmt ? opt.yFmt(v) : v, 'viz-axis', 'end');
    }
    var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 70))));
    for (var i = 0; i < n; i += every) txt(svg, X(i), H - 8, (opt.xFmt ? opt.xFmt(opt.x[i]) : opt.x[i]) + (opt.flags && opt.flags[i] ? '*' : ''), 'viz-axis', 'middle');
    var lastLabelY = null;
    (opt.refs || []).slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (r) {
      el('line', { x1: ml, x2: ml + pw, y1: Y(r.y), y2: Y(r.y), 'class': 'viz-ref' }, svg);
      var ly = Y(r.y) + 4;
      if (lastLabelY != null && lastLabelY - ly < 12) ly = lastLabelY - 12; // tránh chồng nhãn khi các mốc gần nhau
      txt(svg, ml + pw + 6, ly, r.label, 'viz-ref-label'); lastLabelY = ly;
    });
    opt.series.forEach(function (s) {
      var d = '', pen = false;
      s.values.forEach(function (v, i) {
        if (v == null) { pen = false; return; }
        d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true;
      });
      if (d) el('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      // điểm lẻ (không nối được) vẫn hiện
      s.values.forEach(function (v, i) {
        var prev = i > 0 ? s.values[i - 1] : null, next = i < n - 1 ? s.values[i + 1] : null;
        if (v != null && prev == null && next == null) el('circle', { cx: X(i), cy: Y(v), r: 4, fill: s.color, 'class': 'viz-ring' }, svg);
      });
      for (var j = n - 1; j >= 0; j--) if (s.values[j] != null) { el('circle', { cx: X(j), cy: Y(s.values[j]), r: 4, fill: s.color, 'class': 'viz-ring' }, svg); break; }
    });
    var cross = el('line', { x1: 0, x2: 0, y1: mt, y2: mt + ph, 'class': 'viz-cross', visibility: 'hidden' }, svg);
    var dots = opt.series.map(function (s) { return el('circle', { r: 4, fill: s.color, 'class': 'viz-ring', visibility: 'hidden' }, svg); });
    var hit = el('rect', { x: ml - 10, y: mt, width: pw + 20, height: ph, fill: 'transparent', tabindex: 0, 'aria-label': 'Rê chuột hoặc chạm để xem số liệu' }, svg);
    function at(i, cx, cy) {
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
      opt.series.forEach(function (s, k) {
        var v = s.values[i];
        if (v == null) dots[k].setAttribute('visibility', 'hidden');
        else { dots[k].setAttribute('cx', X(i)); dots[k].setAttribute('cy', Y(v)); dots[k].setAttribute('visibility', 'visible'); }
      });
      var rows = opt.series.map(function (s) { return { name: s.name, color: s.color, value: s.values[i] == null ? '—' : (opt.tipFmt || opt.yFmt || String)(s.values[i]) }; });
      if (opt.extra) rows = rows.concat(opt.extra(i));
      showTip(cx, cy, opt.tipTitle ? opt.tipTitle(opt.x[i]) : opt.x[i], rows, opt.flags && opt.flags[i] ? 'Ngày chưa kết thúc' : null);
    }
    function move(ev) {
      var r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * (W / r.width);
      var i = n <= 1 ? 0 : Math.round((px - ml) / (pw / (n - 1)));
      i = Math.max(0, Math.min(n - 1, i));
      at(i, ev.clientX, ev.clientY);
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', function () { cross.setAttribute('visibility', 'hidden'); dots.forEach(function (d) { d.setAttribute('visibility', 'hidden'); }); hideTip(); });
    var ki = n - 1;
    hit.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowLeft') ki = Math.max(0, ki - 1); else if (ev.key === 'ArrowRight') ki = Math.min(n - 1, ki + 1); else return;
      var r = svg.getBoundingClientRect(); at(ki, r.left + X(ki) * r.width / W, r.top + mt); ev.preventDefault();
    });
    hit.addEventListener('blur', hideTip);
  };

  /* Biểu đồ cột một chuỗi: opt = { x:[], values:[], color, yFmt, xFmt, tipFmt, flags:[], height, name } */
  C.columns = function (host, opt) {
    host.innerHTML = '';
    var W = Math.max(280, host.clientWidth || 600), H = opt.height || 200;
    var ml = 52, mr = 12, mt = 12, mb = 26, n = opt.x.length;
    var vmax = 0; opt.values.forEach(function (v) { if (v != null && v > vmax) vmax = v; });
    var nk = nice(vmax * 1.05, 4);
    var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opt.title || 'Biểu đồ cột' }, host);
    var pw = W - ml - mr, ph = H - mt - mb;
    var Y = function (v) { return mt + ph - v / nk.max * ph; };
    for (var v = 0; v <= nk.max + 1e-9; v += nk.step) {
      el('line', { x1: ml, x2: ml + pw, y1: Y(v), y2: Y(v), 'class': v === 0 ? 'viz-base' : 'viz-grid' }, svg);
      txt(svg, ml - 6, Y(v) + 4, opt.yFmt ? opt.yFmt(v) : v, 'viz-axis', 'end');
    }
    var band = pw / Math.max(1, n), bw = Math.max(2, Math.min(24, band - 2));
    var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 70))));
    opt.x.forEach(function (x, i) {
      var cx = ml + band * i + band / 2, val = opt.values[i];
      if (i % every === 0) txt(svg, cx, H - 8, (opt.xFmt ? opt.xFmt(x) : x) + (opt.flags && opt.flags[i] ? '*' : ''), 'viz-axis', 'middle');
      if (val == null || val <= 0) return;
      var y = Y(val), h = mt + ph - y, r = Math.min(4, bw / 2, h);
      var x0 = cx - bw / 2;
      var d = 'M' + x0 + ' ' + (mt + ph) + 'V' + (y + r) + 'Q' + x0 + ' ' + y + ' ' + (x0 + r) + ' ' + y + 'H' + (x0 + bw - r) + 'Q' + (x0 + bw) + ' ' + y + ' ' + (x0 + bw) + ' ' + (y + r) + 'V' + (mt + ph) + 'Z';
      var bar = el('path', { d: d, fill: opt.color, 'class': 'viz-bar' + (opt.flags && opt.flags[i] ? ' viz-partial' : '') }, svg);
      var hit = el('rect', { x: ml + band * i, y: mt, width: band, height: ph, fill: 'transparent', tabindex: -1 }, svg);
      var show = function (ev) {
        bar.classList.add('viz-hover');
        showTip(ev.clientX, ev.clientY, opt.tipTitle ? opt.tipTitle(x) : x, [{ name: opt.name || '', color: opt.color, value: (opt.tipFmt || opt.yFmt || String)(val) }].concat(opt.extra ? opt.extra(i) : []), opt.flags && opt.flags[i] ? 'Ngày chưa kết thúc' : null);
      };
      hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show);
      hit.addEventListener('pointerleave', function () { bar.classList.remove('viz-hover'); hideTip(); });
    });
  };

  /* Thanh ngang xếp hạng (HTML): items = [{label, value, valueText, sub}] */
  C.hbars = function (host, opt) {
    host.innerHTML = '';
    var max = 0; opt.items.forEach(function (it) { if (it.value > max) max = it.value; });
    var wrap = document.createElement('div'); wrap.className = 'hbars';
    opt.items.forEach(function (it) {
      var row = document.createElement('div'); row.className = 'hbar-row'; row.tabIndex = 0;
      var lab = document.createElement('div'); lab.className = 'hbar-label';
      var nm = document.createElement('div'); nm.className = 'hbar-name'; nm.textContent = it.label; lab.appendChild(nm);
      if (it.sub) { var sb = document.createElement('div'); sb.className = 'hbar-sub'; sb.textContent = it.sub; lab.appendChild(sb); }
      var track = document.createElement('div'); track.className = 'hbar-track';
      var bar = document.createElement('div'); bar.className = 'hbar-bar'; bar.style.width = (max > 0 ? Math.max(1, it.value / max * 100) : 0) + '%'; bar.style.background = opt.color;
      track.appendChild(bar);
      var val = document.createElement('div'); val.className = 'hbar-val'; val.textContent = it.valueText;
      track.appendChild(val);
      row.appendChild(lab); row.appendChild(track);
      wrap.appendChild(row);
    });
    host.appendChild(wrap);
  };

  /* Thanh chia đoạn (một tổng chia thành ≤ 6 phần): parts = [{label, value, color, ink}] – nhãn % đặt trong khối nếu vừa,
     chú giải theo đúng thứ tự khối; rê chuột / chạm / Tab để xem tên, số tiền, tỷ trọng. */
  C.segbar = function (host, opt) {
    host.innerHTML = '';
    var total = 0; opt.parts.forEach(function (p) { if (p.value > 0) total += p.value; });
    var bar = document.createElement('div'); bar.className = 'segbar'; bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', opt.title + ': ' + opt.parts.map(function (p) { return p.label + ' ' + opt.fmt(p.value) + ' (' + opt.pct(total > 0 ? p.value / total : 0) + ')'; }).join('; '));
    var blocks = [];
    opt.parts.forEach(function (p) {
      if (!(p.value > 0) || !(total > 0)) return;
      var b = document.createElement('div'); b.className = 'seg'; b.tabIndex = 0;
      b.style.flexGrow = p.value; b.style.background = p.color; b.style.color = p.ink || '#fff';
      var lab = document.createElement('span'); lab.textContent = opt.pct(p.value / total); b.appendChild(lab);
      var show = function (ev) {
        var r = b.getBoundingClientRect();
        showTip(ev && ev.clientX != null ? ev.clientX : r.left + r.width / 2, ev && ev.clientY != null ? ev.clientY : r.top, p.label, [{ name: 'tỷ trọng ' + opt.pct(p.value / total), color: p.color, value: opt.fmt(p.value) }]);
      };
      b.addEventListener('pointermove', show); b.addEventListener('pointerdown', show); b.addEventListener('focus', function () { show(null); });
      b.addEventListener('pointerleave', hideTip); b.addEventListener('blur', hideTip);
      bar.appendChild(b); blocks.push(b);
    });
    host.appendChild(bar);
    // khối quá hẹp không in nhãn (giá trị vẫn có trong bảng và tooltip)
    blocks.forEach(function (b) { var s = b.firstChild; if (s.offsetWidth + 12 > b.clientWidth) s.style.visibility = 'hidden'; });
    var lg = document.createElement('div'); lg.className = 'legend';
    opt.parts.forEach(function (p) {
      var it = document.createElement('span'); var sw = document.createElement('b'); sw.className = 'sw'; sw.style.background = p.color; it.appendChild(sw);
      it.appendChild(document.createTextNode(p.label)); lg.appendChild(it);
    });
    host.appendChild(lg);
  };

  root.TTSC = C;
})(window);
