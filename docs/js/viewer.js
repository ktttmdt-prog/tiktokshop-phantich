/* Xem báo cáo (chế độ Lãnh đạo): dùng trong ứng dụng và trong file báo cáo .html gửi qua Zalo/email. Dữ liệu đã giải mã chỉ nằm trong bộ nhớ trình duyệt. */
(function (root) {
  'use strict';
  var M = root.TTSM, V = root.TTSV, esc = V.esc, W = {};
  var TABS = [['brief', 'Bản tin điều hành'], ['overview', 'Tổng quan'], ['shop', 'Hiệu quả shop'], ['growth', 'Cây chỉ số'], ['roas', 'ROAS & chiến dịch'], ['adsctl', 'Kiểm soát ads'], ['acc', 'Kiểm soát kế toán'], ['content', 'Video & Liên kết']];

  /* host: phần tử chứa; data: {meta, cube, f, remaining, rankIndex} */
  W.mount = function (host, data) {
    var cube = M.prepare(data.cube), LIM = { from: data.f.from, to: data.f.to };
    var S = { f: { from: data.f.from, to: data.f.to, shop: data.f.shop || '', ent: data.f.ent || '' }, tab: 'brief', remaining: data.remaining || 0, rankIndex: data.rankIndex || 0 };
    host.innerHTML = '<div class="banner ok">' + esc(data.meta.title) + ' · lập ngày ' + esc(data.meta.createdAt) + (data.meta.by ? ' · ' + esc(data.meta.by) : '') + '</div><nav class="tabs v-tabs" role="tablist"></nav><div class="filters v-filters"></div><div class="v-main"></div>';
    var tabsEl = host.querySelector('.v-tabs'), filEl = host.querySelector('.v-filters'), mainEl = host.querySelector('.v-main');
    function render() {
      tabsEl.innerHTML = TABS.map(function (t) { return '<button role="tab" data-vtab="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + '</button>'; }).join('');
      var f = S.f, camps = {};
      cube._ads.forEach(function (r) { if (r.ent && (!f.shop || r.shop === f.shop) && !(r.to < f.from || r.from > f.to)) camps[r.ent] = r.name; });
      var ck = Object.keys(camps);
      filEl.innerHTML = '<label>Từ <input type="date" data-vf="from" min="' + LIM.from + '" max="' + LIM.to + '" value="' + f.from + '"></label><label>Đến <input type="date" data-vf="to" min="' + LIM.from + '" max="' + LIM.to + '" value="' + f.to + '"></label>' +
        '<label>Shop <select data-vf="shop"><option value="">' + (cube.shops.length > 1 ? 'Tất cả shop (gộp)' : 'Tất cả') + '</option>' + cube.shops.map(function (s) { return '<option value="' + esc(s.id) + '"' + (f.shop === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
        '<label>Chiến dịch <select data-vf="ent"' + (ck.length ? '' : ' disabled') + '><option value="">' + (ck.length ? 'Tất cả chiến dịch' : 'Không có dữ liệu chiến dịch') + '</option>' + ck.map(function (k) { return '<option value="' + esc(k) + '"' + (f.ent === k ? ' selected' : '') + '>' + esc(camps[k]) + '</option>'; }).join('') + '</select></label>' +
        '<span class="hint">Kỳ dữ liệu trong báo cáo: ' + M.fmtPeriod(LIM.from, LIM.to) + '</span>';
      var ctx = V.compute(cube, S.f, { remaining: S.remaining, rankIndex: S.rankIndex });
      if (S.tab === 'brief') V.brief(mainEl, ctx); else if (S.tab === 'overview') V.overview(mainEl, ctx); else if (S.tab === 'shop') V.shop(mainEl, ctx); else if (S.tab === 'roas') V.roas(mainEl, ctx); else if (S.tab === 'adsctl') V.adsControl(mainEl, ctx); else if (S.tab === 'growth') V.growth(mainEl, ctx); else if (S.tab === 'acc') V.accounting(mainEl, ctx); else V.content(mainEl, ctx);
    }
    host.addEventListener('click', function (ev) { var b = ev.target.closest('[data-vtab]'); if (b) { S.tab = b.getAttribute('data-vtab'); render(); } });
    host.addEventListener('change', function (ev) {
      var t = ev.target, k = t.getAttribute('data-vf'), f = S.f;
      if (k === 'from' && t.value) { f.from = t.value < LIM.from ? LIM.from : t.value; if (f.from > f.to) f.to = f.from; }
      else if (k === 'to' && t.value) { f.to = t.value > LIM.to ? LIM.to : t.value; if (f.from > f.to) f.from = f.to; }
      else if (k === 'shop') f.shop = t.value; else if (k === 'ent') f.ent = t.value;
      else if (t.getAttribute('data-act') === 'remaining') S.remaining = Number(String(t.value).replace(/[^\d]/g, '')) || 0;
      else if (t.getAttribute('data-act') === 'rankIndex') S.rankIndex = Number(t.value) || 0;
      else return;
      render();
    });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (host.isConnected) render(); }, 250); });
    render();
  };

  /* Màn hình nhập mật khẩu → giải mã gói báo cáo → hiển thị */
  W.unlock = function (host, pkg, onOpened) {
    host.innerHTML = '<div class="card auth"><h2>Báo cáo TikTok Shop</h2><p class="small muted">' + esc(pkg.title || 'Báo cáo đã được mã hóa') + '</p><form class="v-form"><label>Mật khẩu xem báo cáo<input type="password" class="v-pw" autocomplete="current-password" required autofocus></label><button type="submit">Mở báo cáo</button><p class="err v-err"></p></form></div>';
    host.querySelector('.v-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var err = host.querySelector('.v-err'); err.textContent = 'Đang mở…';
      root.TTSZ.decryptWithPassword(pkg, host.querySelector('.v-pw').value).then(function (data) { err.textContent = ''; W.mount(host, data); if (onOpened) onOpened(data); }).catch(function (e) { err.textContent = e.message; });
    });
  };

  // Tự khởi động khi là file báo cáo độc lập (.html) có nhúng gói dữ liệu
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('tts-pkg'), host = document.getElementById('viewer');
    if (!el || !host) return;
    var pkg = JSON.parse(el.textContent);
    if (!(window.crypto && crypto.subtle)) { host.innerHTML = '<div class="nodata">Trình duyệt này chưa hỗ trợ giải mã. Mở trang ứng dụng → “Lãnh đạo – xem báo cáo” → chọn file này.</div>'; return; }
    W.unlock(host, pkg);
  });
  root.TTSViewer = W;
})(window);
