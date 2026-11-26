/* Hiển thị báo cáo: Tổng quan (Ban giám đốc), ROAS & chiến dịch, Kiểm soát kế toán, Video & Liên kết.
   Dùng chung cho ứng dụng và file báo cáo HTML xuất (offline). */
(function (root) {
  'use strict';
  var M = root.TTSM, C = root.TTSC, V = {};
  var CAT = { ads: 'Quảng cáo (TikTok Ads)', platform: 'Phí dịch vụ / phí sàn TikTok Shop', creator: 'Hoa hồng nhà sáng tạo (affiliate)', other: 'Khác' };
  V.CAT = CAT;
  var TOPCLS = { topup: 'Nạp tiền', billpay: 'Thanh toán hóa đơn', transfer: 'Chuyển số dư nội bộ', credit: 'Tăng/giảm số dư tín dụng', promo: 'Khuyến mãi', refund: 'Hoàn tiền', other: 'Khác' };
  var SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];
  var SERIES_INK = ['#fff', '#fff', '#fff', '#0b0b0b', '#fff'];

  function esc(s) { return s == null ? '' : String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  V.esc = esc;
  function money(x) { return M.fmtMoney(x); }
  function num(x, d) { return M.fmtNum(x, d); }
  function badge(b) { return '<span class="badge ' + b.cls + '"><span aria-hidden="true">' + b.icon + '</span> ' + esc(b.label) + '</span>'; }
  function tf(t) { return M.fmtNum(t, t % 1 ? 1 : 0); }
  function tile(label, value, sub, extraCls) {
    return '<div class="tile ' + (extraCls || '') + '"><div class="tile-label">' + esc(label) + '</div><div class="tile-value">' + value + '</div>' + (sub ? '<div class="tile-sub">' + sub + '</div>' : '') + '</div>';
  }
  function tbl(head, rows, opts) {
    opts = opts || {};
    var h = '<div class="tbl-wrap"><table class="tbl' + (opts.cls ? ' ' + opts.cls : '') + '"><thead><tr>' + head.map(function (c) {
      var n = typeof c === 'object' ? c : { t: c };
      return '<th' + (n.num ? ' class="num"' : '') + '>' + esc(n.t) + '</th>';
    }).join('') + '</tr></thead><tbody>';
    if (!rows.length) h += '<tr><td colspan="' + head.length + '" class="empty">' + esc(opts.empty || M.NODATA) + '</td></tr>';
    rows.forEach(function (r) {
      h += '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + (r.cells || r).map(function (c, i) {
        var n = typeof head[i] === 'object' && head[i].num;
        return '<td' + (n ? ' class="num"' : '') + '>' + (c == null ? '' : c) + '</td>';
      }).join('') + '</tr>';
    });
    if (opts.foot) h += '</tbody><tfoot><tr>' + opts.foot.map(function (c, i) { var n = typeof head[i] === 'object' && head[i].num; return '<td' + (n ? ' class="num"' : '') + '>' + (c == null ? '' : c) + '</td>'; }).join('') + '</tr></tfoot>';
    else h += '</tbody>';
    return h + '</table></div>';
  }
  function src(text) { return '<div class="src">' + text + '</div>'; }
  function cov(c) { return c ? M.fmtPeriod(c.from, c.to) : '—'; }
  function partialTag(on) { return on ? ' <span class="tag-partial" title="Số liệu trong ngày, còn thay đổi">Ngày chưa kết thúc</span>' : ''; }
  function roasCell(x, th) { return x == null ? '<span class="muted">' + M.UNDEF + '</span>' : M.fmtRoas(x, th); }
  function nodata(msg) { return '<div class="nodata"><strong>' + M.NODATA + '.</strong> ' + msg + '</div>'; }

  // ---------- Tính toàn bộ ngữ cảnh theo bộ lọc ----------
  V.compute = function (cube, f, o) {
    o = o || {};
    var th = cube.thresholds;
    var ctx = { cube: cube, f: f, thresholds: th, official: cube.official == null ? null : Number(cube.official), remaining: o.remaining || 0, rankIndex: Math.min(o.rankIndex || 0, Math.max(0, th.length - 1)) };
    ctx.shopLabel = f.shop ? M.shopName(cube, f.shop) : 'Tất cả shop';
    ctx.ads = M.ads(cube, f);
    ctx.campLabel = f.ent ? (ctx.ads.campaignsAll[f.ent] || f.ent) : '';
    ctx.targets = M.targets(ctx.ads, th, ctx.official, ctx.remaining);
    ctx.orders = M.orders(cube, f);
    ctx.stl = M.settlement(cube, f);
    ctx.stlr = M.settlementReport(cube, f);
    ctx.rec = M.reconcile(cube, f, ctx.ads);
    ctx.vid = M.video(cube, f);
    ctx.aff = M.affiliate(cube, f);
    ctx.shop = M.shop(cube, f);
    ctx.ac = M.adsControl(cube, f, ctx.ads, ctx.rec, ctx.shop, ctx.aff);
    ctx.comments = M.commentary(ctx);
    ctx.recs = M.recommend(ctx);
    return ctx;
  };

  function filterLine(ctx) {
    return '<div class="filterline">Kỳ lọc <strong>' + M.fmtPeriod(ctx.f.from, ctx.f.to) + '</strong> · ' + esc(ctx.shopLabel) + (ctx.campLabel ? ' · Chiến dịch: ' + esc(ctx.campLabel) : '') + '</div>';
  }

  function commentsHtml(ctx) {
    return '<ul class="comments">' + ctx.comments.map(function (c) {
      var ic = c.k === 'good' ? '▲' : c.k === 'bad' ? '▼' : c.k === 'warn' ? '!' : 'i';
      return '<li class="cm-' + c.k + '"><span class="cm-ic" aria-hidden="true">' + ic + '</span><span>' + esc(c.t) + '</span></li>';
    }).join('') + '</ul>';
  }

  function targetCards(ctx) {
    var s = ctx.ads;
    return '<div class="targets">' + ctx.targets.map(function (t) {
      var state = s.roas == null ? { cls: 'na', icon: '?', label: M.UNDEF } : t.reached ? { cls: 'good', icon: '▲', label: 'Đạt mốc ' + tf(t.t) } : { cls: 'bad', icon: '▼', label: 'Chưa đạt mốc ' + tf(t.t) };
      return '<div class="target-card"><div class="target-head">Mốc ROAS ' + tf(t.t) + (t.isOfficial ? ' <span class="tag-official">Mốc chính thức</span>' : ' <span class="muted small">(tham khảo)</span>') + '</div>' +
        '<div>' + badge(state) + '</div>' +
        '<div class="target-row"><span>Doanh thu còn thiếu tại mức chi hiện tại</span><strong>' + (t.shortfall == null ? M.UNDEF : money(t.shortfall)) + '</strong></div>' +
        '<div class="target-row"><span>Chênh lệch ROAS</span><strong>' + (t.gap == null ? M.UNDEF : (t.gap >= 0 ? '+' : '') + num(t.gap, 2)) + '</strong></div>' +
        (ctx.remaining > 0 ? '<div class="target-row"><span>ROAS cần đạt trên ' + money(ctx.remaining) + ' chi thêm</span><strong>' + (t.required == null ? M.UNDEF : t.required === 0 ? 'Đã đủ (0)' : num(t.required, 2)) + '</strong></div>' : '') +
        '</div>';
    }).join('') + '</div>' + (ctx.official == null ? '<p class="note">Chưa chọn mốc chính thức: các mốc trên chỉ để tham khảo, ứng dụng không kết luận đạt thưởng. Chọn mốc chính thức trong mục Cài đặt.</p>' : '');
  }

  function remainingInput(ctx) {
    return '<label class="inline-input">Ngân sách dự kiến còn chi trong kỳ (đ): <input type="text" inputmode="numeric" data-act="remaining" value="' + (ctx.remaining ? M.fmtNum(ctx.remaining) : '') + '" placeholder="vd 50.000.000"></label>';
  }

  function kpiTiles(ctx) {
    var s = ctx.ads, th = ctx.thresholds;
    return '<div class="tiles">' +
      tile('Chi phí quảng cáo', money(s.cost), 'Báo cáo quảng cáo') +
      tile('Doanh thu gộp (báo cáo quảng cáo)', money(s.rev), 'Do TikTok ghi nhận cho quảng cáo') +
      tile('Số đơn SKU', s.skuKnown ? num(s.sku) : M.NODATA, s.skuKnown ? 'Báo cáo quảng cáo' : 'Thiếu cột Số đơn SKU') +
      tile('Chi phí / đơn SKU', s.cpo == null ? (s.skuKnown ? M.UNDEF : M.NODATA) : money(s.cpo), 'Chi phí ÷ số đơn SKU') +
      tile('ROAS', roasCell(s.roas, th), 'Doanh thu gộp ÷ chi phí') +
      tile('CIR', M.fmtPct(s.cir), 'Chi phí ÷ doanh thu gộp') +
      '</div>';
  }

  // ---------- TỔNG QUAN (Ban giám đốc) ----------
  V.overview = function (host, ctx) {
    var s = ctx.ads, th = ctx.thresholds;
    var h = filterLine(ctx);
    if (!s.n) {
      h += nodata('Kỳ này chưa có báo cáo quảng cáo (chi phí + doanh thu gộp) nên chưa tính được ROAS. Vào mục <em>Nhập dữ liệu</em> để nhập file GMV Max / báo cáo chiến dịch.');
    } else {
      h += '<section class="hero"><div><div class="hero-label">ROAS cả kỳ</div><div class="hero-value">' + roasCell(s.roas, th) + '</div><div>' + badge(s.band) + partialTag(s.partial.length) + '</div></div>' +
        '<div class="hero-side"><div>CIR <strong>' + M.fmtPct(s.cir) + '</strong></div><div>Chi phí <strong>' + money(s.cost) + '</strong></div><div>Doanh thu gộp <strong>' + money(s.rev) + '</strong></div>' +
        '<div>Đơn SKU <strong>' + (s.skuKnown ? num(s.sku) : M.NODATA) + '</strong></div><div>Chi phí/đơn SKU <strong>' + (s.cpo == null ? (s.skuKnown ? M.UNDEF : M.NODATA) : money(s.cpo)) + '</strong></div></div></section>';
      h += src('Nguồn: báo cáo quảng cáo · số liệu thực có ' + cov(s.coverage) + ' · ' + (s.hasCampaign ? 'cấp chiến dịch' : 'cấp shop') + (s.byDay.length ? ' × ngày' : ' × kỳ') + ' · ROAS, CIR tính lại từ số tổng.');
      h += '<h3>Mục tiêu ROAS</h3>' + remainingInput(ctx) + targetCards(ctx);
    }
    if (ctx.shop.n) h += '<h3>Toàn shop (Phân tích shop)</h3>' + shopTiles(ctx) + src('Nguồn: Shop Analytics · số liệu thực có ' + cov(ctx.shop.coverage) + ' · chi tiết ở tab Hiệu quả shop.');
    h += '<h3>Nhận định chính</h3>' + commentsHtml(ctx);
    var recs = M.recommend(ctx);
    if (recs.length) h += '<h3>Kiến nghị</h3><ol class="recs">' + recs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    if (s.byDay.length > 1) h += '<h3>ROAS theo ngày</h3><div class="chart" data-chart="roas"></div>' + src('Đường mảnh nét đứt: các mốc ROAS. Dấu * = ngày chưa kết thúc.');
    if (s.hasCampaign) {
      var rk = M.ranking(s, th, ctx.rankIndex).slice(0, 5);
      h += '<h3>Chiến dịch cần xử lý trước (thiếu nhiều doanh thu nhất so với mốc ' + tf(th[ctx.rankIndex]) + ')</h3>';
      h += rk.length ? '<div data-chart="rank5"></div>' : '<p class="note">Không có chiến dịch nào dưới mốc ' + tf(th[ctx.rankIndex]) + '.</p>';
    }
    h += '<h3>Các chỉ tiêu doanh thu (khác nguồn – không cộng lẫn)</h3>' + threeRevenue(ctx);
    host.innerHTML = h;
    if (s.byDay.length > 1) drawRoasLine(host.querySelector('[data-chart="roas"]'), ctx);
    var r5 = host.querySelector('[data-chart="rank5"]');
    if (r5) drawRank(r5, M.ranking(s, th, ctx.rankIndex).slice(0, 5), ctx);
  };

  function drawRoasLine(el, ctx) {
    var s = ctx.ads, th = ctx.thresholds;
    C.line(el, {
      title: 'ROAS theo ngày', x: s.byDay.map(function (d) { return d.date; }),
      series: [{ name: 'ROAS', color: SERIES[0], values: s.byDay.map(function (d) { return d.roas; }) }],
      refs: th.map(function (t) { return { y: t, label: 'Mốc ' + tf(t) }; }),
      flags: s.byDay.map(function (d) { return !!d.partial; }),
      yFmt: function (v) { return M.fmtNum(v, v % 1 ? 1 : 0); }, tipFmt: function (v) { return M.fmtRoas(v, th); },
      xFmt: M.fmtDayMonth, tipTitle: M.fmtDate,
      extra: function (i) { var d = s.byDay[i]; return [{ name: 'Chi phí', value: money(d.cost) }, { name: 'Doanh thu gộp', value: money(d.rev) }]; }
    });
  }
  function drawRank(el, rk, ctx) {
    var ti = ctx.rankIndex, th = ctx.thresholds;
    C.hbars(el, {
      color: SERIES[0], items: rk.map(function (c) {
        return { label: c.name, value: c.short[ti], valueText: money(c.short[ti]), sub: 'Chi phí ' + money(c.cost) + ' · ROAS ' + M.fmtRoas(c.roas, th) + (c.partial ? ' · có ngày chưa kết thúc' : '') };
      })
    });
  }

  function threeRevenue(ctx) {
    var s = ctx.ads, o = ctx.orders, st = ctx.stl;
    var rows = [
      ['<strong>Doanh thu gộp theo báo cáo quảng cáo</strong>', s.n ? money(s.rev) : M.NODATA, 'Báo cáo quảng cáo (GMV Max / chiến dịch)', cov(s.coverage), s.n ? 'Doanh thu TikTok quy cho quảng cáo; chưa trừ hủy/hoàn' : 'Cần nhập báo cáo quảng cáo'],
      ['<strong>Doanh số sau hoàn/hủy</strong>', o.netSales != null ? money(o.netSales) : M.NODATA, 'File đơn hàng TikTok Shop', cov(o.coverage), o.n ? (o.netSales != null ? 'Số tiền đơn (mỗi đơn tính 1 lần) − đơn hủy − đơn chưa thanh toán − tiền hoàn; theo ngày tạo đơn' : (!o.hasStatus ? 'Thiếu cột trạng thái đơn' : !o.hasOrderAmt ? 'Thiếu cột Số tiền đơn hàng' : 'Thiếu cột Số tiền hoàn')) : 'Cần nhập file đơn hàng'],
      st.n || !(ctx.stlr && ctx.stlr.n) ? ['<strong>Tiền quyết toán</strong>', st.n ? money(st.amount) : M.NODATA, 'File tài chính (Thu nhập / Quyết toán)', cov(st.coverage), st.n ? 'Theo ngày quyết toán; đã trừ phí sàn' : 'Cần nhập file quyết toán']
        : ['<strong>Tiền quyết toán</strong>', money(ctx.stlr.t.settlement_total), 'File quyết toán – sheet Báo cáo', cov(ctx.stlr.coverage), 'Theo ngày quyết toán; đã trừ phí sàn ' + money(-ctx.stlr.t.fees_total) + ' và hoàn tiền ' + money(-ctx.stlr.t.refund_after)]
    ];
    var sp = ctx.shop;
    rows.push(['<strong>GMV toàn shop</strong> <span class="muted small">(tham khảo)</span>', sp && sp.n ? money(sp.gmv) : M.NODATA, 'Phân tích shop (Shop Analytics)', cov(sp && sp.coverage), sp && sp.n ? 'Mọi kênh, theo ngày đặt hàng; chưa trừ hủy/hoàn' + partialTag(sp.partial) : 'Cần nhập file Shop Analytics_Key metrics']);
    return tbl(['Chỉ tiêu', { t: 'Giá trị', num: true }, 'Nguồn', 'Kỳ dữ liệu thực có', 'Ghi chú'], rows);
  }

  function tieOut(diff, n, label) {
    if (diff == null) return [esc(label), '<span class="muted">' + M.NODATA + '</span>', ''];
    var ok = Math.abs(diff) <= Math.max(1, n);
    return [esc(label), ok ? badge({ cls: 'good', icon: '✓', label: 'Khớp' }) : badge({ cls: 'bad', icon: '✗', label: 'Lệch' }), diff === 0 ? '0 đ' : money(diff) + (ok ? ' (làm tròn)' : '')];
  }
  /* Quyết toán theo báo cáo tổng hợp của TikTok: doanh thu → hoàn → từng nhóm phí → điều chỉnh → tiền về */
  function settlementReportHtml(sr) {
    var t = sr.t, base = t.gross_after || 0;
    var pct = function (x) { return base > 0 && x ? M.fmtPct(Math.abs(x) / base, 1) : (x === 0 ? '0%' : '—'); };
    var h = '<h4>C1. Từ doanh thu bán hàng đến tiền TikTok chuyển về</h4>';
    h += '<div class="tiles">' +
      tile('Doanh thu hàng bán', money(t.gross_after), 'sau giảm giá của shop') +
      tile('Hoàn tiền cho khách', money(-t.refund_after), sr.refundRate == null ? '' : M.fmtPct(sr.refundRate, 1) + ' doanh thu hàng bán') +
      tile('Phí và hoa hồng TikTok trừ', money(-t.fees_total), base > 0 ? M.fmtPct(-t.fees_total / base, 1) + ' doanh thu hàng bán' + (sr.feeRate == null ? '' : ' (' + M.fmtPct(sr.feeRate, 1) + ' sau hoàn)') : '') +
      tile('Tiền quyết toán về shop', money(t.settlement_total), sr.keepRate == null ? '' : 'bằng ' + M.fmtPct(sr.keepRate, 1) + ' doanh thu hàng bán') + '</div>';
    var rows = [
      ['Doanh thu hàng bán (sau giảm giá của shop)', money(t.gross_after), base > 0 ? '100%' : '—', 'Tổng phụ sau giảm giá của người bán'],
      ['− Hoàn tiền cho khách', money(t.refund_after), pct(t.refund_after), 'Tiền hàng trả lại khách khi hoàn/trả'],
      ['<strong>= Doanh thu sau hoàn</strong>', '<strong>' + money(t.revenue_total) + '</strong>', pct(t.revenue_total), 'Tổng doanh thu']
    ];
    sr.groups.forEach(function (g) { if (g.amount) rows.push(['− ' + esc(g.label), money(g.amount), pct(g.amount), esc(g.hint)]); });
    rows.push(['<strong>= Tổng phí và hoa hồng</strong>', '<strong>' + money(t.fees_total) + '</strong>', pct(t.fees_total), sr.feeRate == null ? '' : M.fmtPct(sr.feeRate, 1) + ' doanh thu sau hoàn']);
    rows.push(['+ Điều chỉnh', money(t.adj_total), pct(t.adj_total), sr.adj.map(function (a) { return esc(a.label) + ' ' + money(a.amount); }).join('; ')]);
    rows.push(['<strong>= Tiền quyết toán</strong>', '<strong>' + money(t.settlement_total) + '</strong>', pct(t.settlement_total), 'Tiền TikTok chuyển vào số dư shop']);
    h += tbl(['Khoản', { t: 'Số tiền', num: true }, { t: 'Trên doanh thu hàng bán', num: true }, 'Ghi chú'], rows);
    if (sr.feeRate != null && sr.keepRate != null) h += '<p class="note">Cách đọc: cứ 100 đồng doanh thu hàng bán, khách hoàn lại ' + num(sr.refundRate * 100, 1) + ' đồng, TikTok giữ ' + num(-t.fees_total / base * 100, 1) + ' đồng phí và hoa hồng, shop nhận về ' + num(sr.keepRate * 100, 1) + ' đồng – chưa trừ giá vốn, quảng cáo và chi phí vận hành.</p>';
    var lines = [];
    sr.groups.forEach(function (g) { g.lines.forEach(function (l) { lines.push([esc(g.label), esc(l.label), money(l.amount), t.revenue_total > 0 ? M.fmtPct(Math.abs(l.amount) / t.revenue_total, 2) : '—']); }); });
    h += '<h4>Chi tiết từng loại phí</h4>' + tbl(['Nhóm', 'Loại phí', { t: 'Số tiền', num: true }, { t: 'Trên doanh thu sau hoàn', num: true }], lines);
    if (sr.byPeriod.length > 1) {
      h += '<h4>Theo kỳ báo cáo</h4>' + tbl(['Kỳ', { t: 'Doanh thu hàng bán', num: true }, { t: 'Hoàn tiền', num: true }, { t: 'Tỷ lệ hoàn', num: true }, { t: 'Tổng phí', num: true }, { t: 'Phí / DT sau hoàn', num: true }, { t: 'Điều chỉnh', num: true }, { t: 'Tiền quyết toán', num: true }],
        sr.byPeriod.map(function (p) { return [M.fmtPeriod(p.from, p.to) + partialTag(p.partial), money(p.t.gross_after), money(p.t.refund_after), p.refundRate == null ? '—' : M.fmtPct(p.refundRate, 1), money(p.t.fees_total), p.feeRate == null ? '—' : M.fmtPct(p.feeRate, 1), money(p.t.adj_total), money(p.t.settlement_total)]; }));
    }
    h += '<h4>Kiểm tra số liệu</h4>' + tbl(['Phép kiểm tra', 'Kết quả', { t: 'Chênh lệch', num: true }], [
      tieOut(sr.revDiff, sr.n, 'Doanh thu hàng bán + hoàn tiền = Tổng doanh thu'),
      tieOut(sr.feeLinesDiff, sr.n, 'Cộng từng loại phí = Tổng phí (lệch → có loại phí mới chưa tách nhóm)'),
      tieOut(sr.calcDiff, sr.n, 'Tổng doanh thu + Tổng phí + Điều chỉnh = Tiền quyết toán')]);
    h += src('Nguồn: sheet “Báo cáo” trong file quyết toán (income_….xlsx) · theo ngày quyết toán · kỳ ' + cov(sr.coverage) + partialTag(sr.partial) + (sr.excluded.length ? ' · ' + sr.excluded.length + ' báo cáo chỉ trùng một phần với kỳ lọc không được tính' : ''));
    return h;
  }

  // ---------- ROAS & CHIẾN DỊCH ----------
  V.roas = function (host, ctx) {
    var s = ctx.ads, th = ctx.thresholds;
    var h = filterLine(ctx);
    if (!s.n) { host.innerHTML = h + nodata('Chưa có báo cáo quảng cáo trong kỳ lọc.' + (s.excluded.length ? ' Có ' + s.excluded.length + ' dòng cấp kỳ chỉ trùng một phần với kỳ lọc – hãy chọn kỳ lọc bao trọn kỳ của file.' : '')); return; }
    h += kpiTiles(ctx);
    h += src('Nguồn: báo cáo quảng cáo · kỳ thực có ' + cov(s.coverage) + ' · ' + Object.keys(s.imports).length + ' lần nhập' + (s.partial.length ? ' · <span class="tag-partial">Ngày chưa kết thúc: ' + s.partial.map(M.fmtDate).join(', ') + '</span>' : ''));
    if (s.excluded.length) h += '<p class="warnline">! ' + s.excluded.length + ' dòng số liệu cấp kỳ chỉ trùng một phần với kỳ lọc nên KHÔNG được tính (không tự phân bổ theo ngày).</p>';
    h += '<h3>Mục tiêu và doanh thu còn thiếu</h3>' + remainingInput(ctx);
    var trs = ctx.targets.map(function (t) {
      return [tf(t.t) + (t.isOfficial ? ' <span class="tag-official">Chính thức</span>' : ''), s.roas == null ? M.UNDEF : badge(t.reached ? { cls: 'good', icon: '▲', label: 'Đạt' } : { cls: 'bad', icon: '▼', label: 'Chưa đạt' }),
        roasCell(s.roas, th), t.gap == null ? M.UNDEF : (t.gap >= 0 ? '+' : '') + num(t.gap, 2), t.shortfall == null ? M.UNDEF : money(t.shortfall),
        ctx.remaining > 0 ? (t.required == null ? M.UNDEF : t.required === 0 ? 'Đã đủ (0)' : num(t.required, 2)) : '<span class="muted">Nhập ngân sách còn chi</span>'];
    });
    h += tbl(['Mốc', 'Trạng thái', { t: 'ROAS thực tế', num: true }, { t: 'Chênh lệch', num: true }, { t: 'Doanh thu còn thiếu (mức chi hiện tại)', num: true }, { t: 'ROAS cần đạt trên khoản chi còn lại', num: true }], trs);
    h += '<p class="note">Doanh thu còn thiếu = MAX(0, mốc × chi phí Ads − doanh thu gộp). ROAS cần đạt trên khoản chi còn lại = (mốc × (chi phí hiện tại + ngân sách còn chi) − doanh thu gộp hiện tại) ÷ ngân sách còn chi.' + (ctx.official == null ? ' Chưa chọn mốc chính thức → không kết luận đạt thưởng.' : '') + '</p>';
    if (s.byDay.length > 1) {
      h += '<h3>ROAS theo ngày</h3><div class="chart" data-chart="roas"></div>';
      h += '<div class="grid2"><div><h3>Chi phí Ads theo ngày</h3><div class="chart" data-chart="cost"></div></div><div><h3>Doanh thu gộp theo ngày</h3><div class="chart" data-chart="rev"></div></div></div>';
    }
    // xếp hạng chiến dịch
    if (s.hasCampaign) {
      h += '<h3>Chiến dịch dưới mục tiêu – xếp theo doanh thu còn thiếu</h3><label class="inline-input">Xếp hạng theo mốc: <select data-act="rankIndex">' + th.map(function (t, i) { return '<option value="' + i + '"' + (i === ctx.rankIndex ? ' selected' : '') + '>ROAS ' + tf(t) + '</option>'; }).join('') + '</select></label>';
      var rk = M.ranking(s, th, ctx.rankIndex);
      if (rk.length) h += '<div data-chart="rank"></div>';
      var all = s.byCampaign.slice().sort(function (a, b) { return (b.short[ctx.rankIndex] || 0) - (a.short[ctx.rankIndex] || 0) || b.cost - a.cost; });
      var head = ['#', 'Chiến dịch', { t: 'Chi phí', num: true }, { t: 'Doanh thu gộp', num: true }, { t: 'Đơn SKU', num: true }, { t: 'ROAS', num: true }, 'Trạng thái'].concat(th.map(function (t) { return { t: 'Thiếu để đạt ' + tf(t), num: true }; }));
      h += tbl(head, all.map(function (c, i) {
        return { cls: c.short[ctx.rankIndex] > 0 ? 'row-bad' : '', cells: [i + 1, esc(c.name) + partialTag(c.partial) + (c.ent ? '' : ' <span class="muted small">(cấp shop)</span>'), money(c.cost), money(c.rev), c.skuMissing ? M.NODATA : num(c.sku), roasCell(c.roas, th), badge(c.band)].concat(c.short.map(function (x) { return x == null ? M.UNDEF : money(x); })) };
      }), { foot: ['', '<strong>Tổng (tính lại từ số tổng)</strong>', money(s.cost), money(s.rev), s.skuKnown ? num(s.sku) : M.NODATA, roasCell(s.roas, th), badge(s.band)].concat(ctx.targets.map(function (t) { return t.shortfall == null ? M.UNDEF : money(t.shortfall); })) });
      h += '<p class="note">Dòng tổng KHÔNG bằng tổng số thiếu của từng chiến dịch vì chiến dịch vượt mốc bù cho chiến dịch dưới mốc.</p>';
    } else h += '<p class="note">Dữ liệu chỉ có cấp shop – không xếp hạng chiến dịch và không tự phân bổ doanh thu xuống chiến dịch.</p>';
    if (s.byShop.length > 1) {
      h += '<h3>Theo shop</h3>' + tbl(['Shop', { t: 'Chi phí', num: true }, { t: 'Doanh thu gộp', num: true }, { t: 'Đơn SKU', num: true }, { t: 'Chi phí/đơn SKU', num: true }, { t: 'ROAS', num: true }, { t: 'CIR', num: true }, 'Trạng thái'],
        s.byShop.map(function (c) { return [esc(M.shopName(ctx.cube, c.shop)) + partialTag(c.partial), money(c.cost), money(c.rev), c.skuMissing ? M.NODATA : num(c.sku), c.cpo == null ? M.UNDEF : money(c.cpo), roasCell(c.roas, th), M.fmtPct(c.cir), badge(c.band)]; }),
        { foot: ['<strong>Gộp các shop</strong>', money(s.cost), money(s.rev), s.skuKnown ? num(s.sku) : M.NODATA, s.cpo == null ? M.UNDEF : money(s.cpo), roasCell(s.roas, th), M.fmtPct(s.cir), badge(s.band)] });
    }
    if (s.byDay.length) {
      h += '<h3>Theo ngày</h3>' + tbl(['Ngày', { t: 'Chi phí', num: true }, { t: 'Doanh thu gộp', num: true }, { t: 'Đơn SKU', num: true }, { t: 'Chi phí/đơn SKU', num: true }, { t: 'ROAS', num: true }, { t: 'CIR', num: true }, 'Trạng thái'],
        s.byDay.slice().reverse().map(function (d) { return [M.fmtDate(d.date) + partialTag(d.partial), money(d.cost), money(d.rev), d.skuMissing ? M.NODATA : num(d.sku), d.cpo == null ? M.UNDEF : money(d.cpo), roasCell(d.roas, th), M.fmtPct(d.cir), badge(M.band(d.roas, th))]; }));
    }
    if (s.periodLevel.length) h += '<p class="note">' + s.periodLevel.length + ' dòng số liệu cấp kỳ (không có ngày) được tính vào tổng nhưng không chia theo ngày.</p>';
    host.innerHTML = h;
    if (s.byDay.length > 1) {
      drawRoasLine(host.querySelector('[data-chart="roas"]'), ctx);
      C.columns(host.querySelector('[data-chart="cost"]'), { name: 'Chi phí Ads', x: s.byDay.map(function (d) { return d.date; }), values: s.byDay.map(function (d) { return d.cost; }), color: SERIES[0], yFmt: M.fmtCompact, tipFmt: money, xFmt: M.fmtDayMonth, tipTitle: M.fmtDate, flags: s.byDay.map(function (d) { return !!d.partial; }) });
      C.columns(host.querySelector('[data-chart="rev"]'), { name: 'Doanh thu gộp', x: s.byDay.map(function (d) { return d.date; }), values: s.byDay.map(function (d) { return d.rev; }), color: SERIES[0], yFmt: M.fmtCompact, tipFmt: money, xFmt: M.fmtDayMonth, tipTitle: M.fmtDate, flags: s.byDay.map(function (d) { return !!d.partial; }) });
    }
    var rkEl = host.querySelector('[data-chart="rank"]');
    if (rkEl) drawRank(rkEl, M.ranking(s, th, ctx.rankIndex).slice(0, 15), ctx);
  };

  // ---------- KIỂM SOÁT KẾ TOÁN ----------
  V.accounting = function (host, ctx) {
    var s = ctx.ads, o = ctx.orders, st = ctx.stl, rc = ctx.rec;
    var h = filterLine(ctx);
    if (ctx.f.ent) h += '<p class="warnline">! Bộ lọc chiến dịch chỉ áp dụng cho báo cáo quảng cáo. File đơn hàng, quyết toán, hóa đơn là dữ liệu cấp shop nên hiển thị cho cả shop.</p>';
    h += '<h3>A. Các chỉ tiêu doanh thu – trình bày riêng theo nguồn</h3>' + threeRevenue(ctx);

    h += '<h3>B. Đơn hàng (file đơn hàng)</h3>';
    if (!o.n) h += nodata('Kỳ này chưa có file đơn hàng. Cần nhập file xuất từ Seller Center → Đơn hàng (có cột Mã đơn, Trạng thái, Thời gian tạo, Số tiền đơn, Số tiền hoàn).');
    else {
      h += tbl(['Chỉ tiêu', { t: 'Giá trị', num: true }, 'Cách tính'], [
        ['Số đơn hàng duy nhất', num(o.orders), 'Đếm mã đơn khác nhau (theo ngày tạo đơn)'],
        ['Số đơn SKU (dòng SKU)', num(o.skuLines), 'Mỗi dòng SKU trong đơn = 1 đơn SKU'],
        ['Đơn có nhiều SKU', num(o.multiSku), 'Giá trị cấp đơn chỉ tính 1 lần cho các đơn này'],
        ['Số lượng sản phẩm', num(o.qty), 'Cộng cột Số lượng'],
        ['Giá trị đơn hàng (cấp đơn)', o.hasOrderAmt ? money(o.orderAmt) : M.NODATA, 'Cột Số tiền đơn hàng, mỗi đơn lấy 1 lần'],
        ['Giá trị hàng sau giảm giá (cấp SKU)', o.hasSkuAmt ? money(o.skuAmt) : M.NODATA, 'Cộng cột tạm tính SKU sau giảm giá của từng dòng'],
        ['Đơn hủy', o.hasStatus ? num(o.cancelOrders) + ' đơn · ' + money(o.cancelAmt) : M.NODATA, 'Trạng thái chứa “Hủy/Cancel” ở mọi dòng SKU'],
        ['Đơn hoàn/trả', o.hasStatus ? num(o.retOrders) + ' đơn · hoàn ' + (o.hasRefund ? money(o.refundAmt) : M.NODATA) : M.NODATA, 'Có loại trả hàng/hoàn tiền, SL trả > 0 hoặc tiền hoàn > 0'],
        ['Đơn chưa thanh toán', o.hasStatus ? num(o.unpaidOrders) + ' đơn · ' + money(o.unpaidAmt) : M.NODATA, 'Không tính vào doanh số'],
        ['Đơn không xác định trạng thái', num(o.unknownOrders), 'Loại khỏi mẫu số các tỷ lệ'],
        ['<strong>Tỷ lệ hủy theo số đơn</strong>', o.cancelRateCount != null ? M.fmtPct(o.cancelRateCount) : M.NODATA, 'Đơn hủy ÷ đơn có trạng thái (' + num(o.orders - o.unknownOrders) + ')'],
        ['<strong>Tỷ lệ hủy theo giá trị</strong>', o.cancelRateValue != null ? M.fmtPct(o.cancelRateValue) : M.NODATA, 'Giá trị đơn hủy ÷ giá trị đơn có trạng thái'],
        ['<strong>Tỷ lệ hoàn theo số đơn</strong>', o.returnRateCount != null ? M.fmtPct(o.returnRateCount) : M.NODATA, 'Đơn hoàn ÷ đơn không hủy, đã thanh toán' + (o.returnBaseCount != null ? ' (' + num(o.returnBaseCount) + ')' : '')],
        ['<strong>Tỷ lệ hoàn theo giá trị</strong>', o.returnRateValue != null ? M.fmtPct(o.returnRateValue) : M.NODATA, 'Tiền hoàn ÷ giá trị đơn không hủy, đã thanh toán'],
        ['<strong>Doanh số sau hoàn/hủy</strong>', o.netSales != null ? money(o.netSales) : M.NODATA, 'Giá trị đơn − đơn hủy − chưa thanh toán − không rõ trạng thái − tiền hoàn']
      ]);
      h += src('Nguồn: file đơn hàng · kỳ theo ngày tạo đơn ' + cov(o.coverage) + (o.partial ? ' · <span class="tag-partial">Ngày chưa kết thúc</span>' : '') + (o.amtInconsistent ? ' · ! ' + o.amtInconsistent + ' đơn có Số tiền đơn khác nhau giữa các dòng SKU (đã lấy giá trị lớn nhất, cần kiểm tra)' : ''));
    }

    var sp = ctx.shop;
    if (sp.n) {
      h += '<h4>B2. Đơn hàng theo Phân tích shop (số TikTok tổng hợp, cấp shop × ngày)</h4>' + tbl(['Chỉ tiêu', { t: 'Giá trị', num: true }, 'Ghi chú'], [
        ['Số đơn hàng (đơn duy nhất)', num(sp.orders), 'Cột “Đơn hàng”'],
        ['Số đơn hàng SKU', num(sp.sku), 'Cột “Đơn hàng SKU” – một đơn nhiều SKU được đếm nhiều lần'],
        ['Số SKU bình quân / đơn', num(sp.skuPerOrder, 2), 'Đơn hàng SKU ÷ Đơn hàng'],
        ['Số món bán ra', num(sp.items), ''],
        ['GMV toàn shop', money(sp.gmv), 'Chưa trừ hủy/hoàn'],
        ['Hoàn tiền', money(sp.refund), 'Ghi theo NGÀY PHÁT SINH HOÀN, không gắn với kỳ đặt đơn → KHÔNG dùng để tính tỷ lệ hoàn']
      ]);
      h += src('Nguồn: Shop Analytics · ' + cov(sp.coverage) + partialTag(sp.partial) + ' · Không có trạng thái đơn nên không tính tỷ lệ hủy/hoàn từ file này.');
    }

    h += '<h3>C. Tiền quyết toán (file tài chính)</h3>';
    var sr = ctx.stlr;
    if (sr && sr.n) h += settlementReportHtml(sr);
    else if (sr && sr.excluded.length) h += '<p class="warnline">! Có ' + sr.excluded.length + ' báo cáo quyết toán theo kỳ chỉ trùng một phần với kỳ lọc nên không được tính – chọn kỳ lọc bao trọn kỳ của báo cáo (thường là cả tháng).</p>';
    if (!st.n && !(sr && sr.n)) h += nodata('Kỳ này chưa có file quyết toán. Xuất từ Seller Center → Tài chính → Giao dịch → Đã quyết toán → Xem thêm → Xuất (file income_….xlsx), chọn đúng tháng, rồi nhập ở tab Nhập dữ liệu.');
    else if (st.n) {
      if (sr && sr.n) h += '<h4>C2. Quyết toán từng dòng (file chi tiết) theo loại</h4>';
      h += tbl(['Loại', { t: 'Số dòng', num: true }, { t: 'Tổng tiền quyết toán', num: true }, { t: 'Tổng doanh thu (file)', num: true }, { t: 'Tổng phí', num: true }],
        st.byType.map(function (b) { return [esc(b.type), num(b.count), money(b.amount), st.hasRevenue ? money(b.revenue) : M.NODATA, st.hasFees ? money(b.fees) : M.NODATA]; }),
        { foot: ['<strong>Cộng</strong>', num(st.count), money(st.amount), st.hasRevenue ? money(st.revenue) : M.NODATA, st.hasFees ? money(st.fees) : M.NODATA] });
      h += src('Nguồn: file tài chính · theo ngày quyết toán ' + cov(st.coverage));
    }

    h += '<h3>D. Đối chiếu chi phí quảng cáo</h3>';
    var recRows = [
      ['Dashboard – báo cáo quảng cáo', s.n ? money(rc.dash) : M.NODATA, '—', cov(s.coverage), '—'],
      ['File Cost theo tài khoản quảng cáo', rc.acct.n ? money(rc.acct.amount) : M.NODATA, rc.acct.n ? (rc.acct.hasTax ? money(rc.acct.tax) + ' (thuế ước tính)' : M.NODATA) : '—', cov(rc.acct.coverage), rc.acct.n && s.n ? diffTxt(rc.diffAcct, rc.dash) : '—'],
      ['Hóa đơn Ads (nhóm Quảng cáo)', rc.inv.n ? money(rc.inv.net) + ' trước thuế' : M.NODATA, rc.inv.n ? (rc.inv.hasTax ? money(rc.inv.tax) : 'File không có cột thuế') : '—', cov(rc.inv.coverage), rc.inv.n && s.n ? diffTxt(rc.diffInv, rc.dash) : '—'],
      ['Tiền thực trả TikTok Ads (nạp tiền + thanh toán hóa đơn bằng thẻ)', rc.topup.nAll ? money(rc.topup.cashOut) : M.NODATA, '—', cov(rc.topup.coverage), 'Dòng tiền, không phải chi phí kỳ – chỉ để tham khảo (xem mục F)']
    ];
    h += tbl(['Nguồn', { t: 'Chi phí (chưa thuế)', num: true }, { t: 'Thuế', num: true }, 'Kỳ', 'Chênh lệch so với dashboard'], recRows);
    h += '<p class="note">Chỉ so sánh khi kỳ các nguồn trùng nhau. File Cost không ghi kỳ – kỳ do người nhập khai báo. Số liệu cấp kỳ chỉ trùng một phần với kỳ lọc không được tính.' + (rc.acct.excluded.length ? ' (' + rc.acct.excluded.length + ' dòng file Cost bị loại vì trùng một phần kỳ lọc.)' : '') + '</p>';
    if (rc.acct.n) {
      h += '<h4>Chi phí theo tài khoản quảng cáo (file Cost)</h4>' + tbl(['Kỳ', 'Tài khoản', 'Loại', { t: 'Tiền mặt', num: true }, { t: 'Tín dụng', num: true }, { t: 'Tín dụng QC', num: true }, { t: 'Số tiền (chi phí)', num: true }, { t: 'Thuế ước tính', num: true }],
        rc.acct.rows.map(function (r) { return [M.fmtPeriod(r.from, r.to) + partialTag(r.partial), esc(r.accountName || '') + ' <span class="muted small">' + esc(r.accountId) + '</span>', esc(r.type || ''), money(r.cash), money(r.credit), money(r.adCredit), money(r.amount), r.tax == null ? M.NODATA : money(r.tax)]; }),
        { foot: ['<strong>Cộng</strong>', '', '', money(rc.acct.cash), money(rc.acct.credit), money(rc.acct.adCredit), money(rc.acct.amount), money(rc.acct.tax)] });
    }
    h += '<h3>E. Hóa đơn theo nhóm (thuế thể hiện riêng)</h3>';
    if (!rc.invByCat.length) h += nodata('Chưa có file chi tiết hóa đơn trong kỳ lọc.');
    else h += tbl(['Nhóm', { t: 'Số dòng', num: true }, { t: 'Tiền trước thuế', num: true }, { t: 'Tiền thuế', num: true }, { t: 'Tổng tiền hóa đơn', num: true }, { t: 'Thuế TNCN khấu trừ', num: true }],
      rc.invByCat.map(function (c) { return [esc(CAT[c.category] || c.category), num(c.count), money(c.net), c.taxRows ? money(c.tax) : M.NODATA, money(c.amount), money(c.pit)]; }));
    if (rc.topup.nAll) {
      var tp = rc.topup;
      h += '<h3>F. Giao dịch thanh toán TikTok Ads (file Transaction)</h3>' + tbl(['Nhóm giao dịch', { t: 'Số giao dịch', num: true }, { t: 'Số tiền', num: true }, 'Tính vào tiền thực trả?'], [
        ['Nạp tiền (Thêm số dư) thành công', num(tp.nTopup), money(tp.topup), '<span class="ok">Có</span>'],
        ['Thanh toán hóa đơn bằng thẻ / chuyển khoản', num(tp.nBillCard), money(tp.billCard), '<span class="ok">Có</span>'],
        ['Thanh toán hóa đơn trả từ SỐ DƯ', num(tp.nBillBalance), money(tp.billBalance), 'Không – tiền đã tính khi nạp'],
        ['Chuyển số dư nội bộ giữa các tài khoản (tăng/giảm)', num(tp.nTransfer), money(tp.transferNet) + ' (ròng)', 'Không – chỉ chuyển nội bộ'],
        ['Tăng/giảm số dư TÍN DỤNG (hạn mức trả sau)', num(tp.nCredit), money(tp.credit), 'Không – không phải tiền'],
        ['Tín dụng khuyến mãi TikTok cấp', num(tp.nPromo), money(tp.promo), 'Không – không phải tiền' + (rc.acct.n ? ' (file Cost: tín dụng QC ' + money(rc.acct.adCredit) + ')' : '')],
        ['Giao dịch không thành công', num(tp.nFailed), money(tp.failed), 'Không'],
        ['Khác', num(tp.nOther), money(tp.other), 'Không – cần kế toán xem']
      ].filter(function (r, i) { return i < 2 || r[1] !== '0'; }), { foot: ['<strong>Tiền thực trả TikTok Ads</strong>', num(tp.n), money(tp.cashOut), ''] });
      h += '<p class="note">Phân loại theo cột “Loại giao dịch phụ” và phương thức thanh toán (Thẻ / Số dư) suy ra từ cột Mô tả – số thẻ không được lưu. Cần kế toán xác nhận cách phân loại này với chính sách hạch toán của công ty.</p>';
      h += '<details><summary>Xem ' + tp.nAll + ' giao dịch</summary>' + tbl(['Thời gian', 'Tài khoản', 'Loại', 'Nhóm', 'Thanh toán', 'Chứng từ', 'Trạng thái', { t: 'Số tiền', num: true }],
        tp.rows.slice().reverse().map(function (r) { return [esc(r.time), esc(r.accountName || r.accountId || ''), esc((r.type || '') + (r.subtype ? ' – ' + r.subtype : '')), esc(TOPCLS[r.cls] || r.cls || ''), esc(r.pay || ''), esc(r.voucher || ''), esc(r.status || ''), money(r.amount)]; }), { cls: 'wide' }) + '</details>';
    }
    h += '<h3>G. Nguồn dữ liệu dùng trong kỳ</h3>' + sourcesTable(ctx);
    host.innerHTML = h;
  };
  function diffTxt(d, base) { if (d == null) return '—'; return (d > 0 ? '+' : '') + money(d) + (base > 0 ? ' (' + (d > 0 ? '+' : '') + M.fmtPct(d / base) + ')' : ''); }

  function sourcesTable(ctx) {
    var imps = (ctx.cube.imports || []).filter(function (i) { return !i.rolledBack && i.from && i.to && !(i.to < ctx.f.from || i.from > ctx.f.to); });
    return tbl(['#', 'Thời điểm nhập', 'Loại dữ liệu', 'Shop', 'Kỳ trong file', 'File', { t: 'Mới', num: true }, { t: 'Trùng', num: true }, { t: 'Cập nhật', num: true }],
      imps.slice().reverse().map(function (i) { return [i.id, esc(i.time), esc(i.datasetLabel), esc(i.shopName) + (i.scope ? ' · ' + esc(i.scope) : ''), M.fmtPeriod(i.from, i.to), esc(i.fileName), num(i['new']), num(i.dup), num(i.update)]; }), { empty: 'Không có lần nhập nào trong kỳ lọc', cls: 'wide' });
  }

  // ---------- HIỆU QUẢ SHOP (Phân tích shop) ----------
  function shopTiles(ctx) {
    var sp = ctx.shop;
    return '<div class="tiles">' +
      tile('GMV toàn shop', money(sp.gmv), 'Mọi kênh, chưa trừ hủy/hoàn') +
      tile('Đơn hàng', num(sp.orders), 'Đơn duy nhất') +
      tile('Đơn hàng SKU', num(sp.sku), num(sp.skuPerOrder, 2) + ' SKU/đơn') +
      tile('AOV', sp.aov == null ? M.UNDEF : money(sp.aov), 'GMV ÷ đơn hàng') +
      tile('Số món bán ra', num(sp.items), '') +
      tile('Hoàn tiền', money(sp.refund), 'Theo ngày phát sinh hoàn') +
      '</div>';
  }
  V.shop = function (host, ctx) {
    var sp = ctx.shop, s = ctx.ads;
    var h = filterLine(ctx);
    if (!sp.n) { host.innerHTML = h + nodata('Kỳ này chưa có file Phân tích shop. Xuất từ Seller Center → Phân tích → Chỉ số chính (file “Shop Analytics_Key metrics_…xlsx”) rồi nhập ở tab Nhập dữ liệu.'); return; }
    if (ctx.f.ent) h += '<p class="warnline">! Bộ lọc chiến dịch không áp dụng cho Phân tích shop (số liệu cấp shop).</p>';
    h += shopTiles(ctx);
    h += src('Nguồn: Shop Analytics · số liệu thực có ' + cov(sp.coverage) + ' (' + sp.byDay.length + ' ngày)' + partialTag(sp.partial) + ' · AOV, SKU/đơn, CTR tính lại từ số tổng.');
    h += '<p class="note">Khách hàng, khách truy cập, tỷ lệ chuyển đổi và các chỉ số “độc nhất” là số đếm duy nhất trong từng ngày – không cộng được qua nhiều ngày nên không hiển thị tổng (xem từng ngày ở Bảng chi tiết). Hoàn tiền ghi theo ngày phát sinh hoàn, không gắn với kỳ đặt đơn nên không dùng để tính tỷ lệ hoàn.</p>';
    if (s.n && sp.gmv > 0) h += '<p class="note">Tham khảo: doanh thu gộp theo báo cáo quảng cáo (' + money(s.rev) + ', kỳ ' + cov(s.coverage) + ') bằng ' + M.fmtPct(s.rev / sp.gmv, 1) + ' GMV toàn shop trong kỳ lọc. Hai nguồn quy kết khác nhau – không cộng/trừ lẫn.</p>';
    h += '<h3>Cơ cấu GMV theo kênh</h3><div data-chart="seg"></div>';
    h += tbl(['Kênh', { t: 'GMV', num: true }, { t: 'Tỷ trọng', num: true }],
      sp.channels.map(function (c) { return ['<span class="sw-inline" style="background:' + SERIES[c.slot] + '"></span>' + esc(c.label), money(c.value), M.fmtPct(c.share, 1)]; }),
      { foot: ['<strong>Cộng các kênh</strong>', money(sp.chSum), M.fmtPct(sp.gmv > 0 ? sp.chSum / sp.gmv : null, 1)] });
    if (Math.abs(sp.chOther) >= 1) h += '<p class="warnline">! Tổng các kênh lệch GMV toàn shop ' + money(sp.chOther) + ' (nguồn khác / làm tròn của TikTok).</p>';
    var byMonthChart = sp.byDay.length > 62;
    if (sp.byDay.length > 1) h += '<h3>GMV toàn shop theo ' + (byMonthChart ? 'tháng' : 'ngày') + '</h3><div class="chart" data-chart="gmv"></div>';
    if (sp.byMonth.length > 1) {
      h += '<h3>Theo tháng</h3>' + tbl(['Tháng', { t: 'Số ngày', num: true }, { t: 'GMV', num: true }, { t: 'Đơn hàng', num: true }, { t: 'Đơn SKU', num: true }, { t: 'SKU/đơn', num: true }, { t: 'AOV', num: true }, { t: 'Hoàn tiền', num: true }],
        sp.byMonth.map(function (m) { return [m.month.substr(5, 2) + '/' + m.month.substr(0, 4) + partialTag(m.partial), num(m.nDays), money(m.gmv), num(m.orders), num(m.sku), num(m.skuPerOrder, 2), m.aov == null ? M.UNDEF : money(m.aov), money(m.refund)]; }),
        { foot: ['<strong>Cộng</strong>', num(sp.byDay.length), money(sp.gmv), num(sp.orders), num(sp.sku), num(sp.skuPerOrder, 2), sp.aov == null ? M.UNDEF : money(sp.aov), money(sp.refund)] });
    }
    h += '<h3>Theo ngày</h3>' + tbl(['Ngày', { t: 'GMV', num: true }, { t: 'Đơn hàng', num: true }, { t: 'Đơn SKU', num: true }, { t: 'Số món', num: true }, { t: 'AOV', num: true }, { t: 'Hoàn tiền', num: true }],
      sp.byDay.slice().reverse().map(function (d) { return [M.fmtDate(d.date) + partialTag(d.partial), money(d.gmv), num(d.orders), num(d.sku), num(d.items), d.aov == null ? M.UNDEF : money(d.aov), money(d.refund)]; }));
    host.innerHTML = h;
    C.segbar(host.querySelector('[data-chart="seg"]'), {
      title: 'Cơ cấu GMV theo kênh', fmt: money, pct: function (x) { return M.fmtPct(x, 0); },
      parts: sp.channels.map(function (c) { return { label: c.label, value: c.value, color: SERIES[c.slot], ink: SERIES_INK[c.slot] }; })
    });
    var ge = host.querySelector('[data-chart="gmv"]');
    if (ge && byMonthChart) C.columns(ge, { name: 'GMV toàn shop', x: sp.byMonth.map(function (m) { return m.month; }), values: sp.byMonth.map(function (m) { return m.gmv; }), color: SERIES[0], yFmt: M.fmtCompact, tipFmt: money,
      xFmt: function (m) { return m.substr(5, 2) + '/' + m.substr(2, 2); }, tipTitle: function (m) { return 'Tháng ' + m.substr(5, 2) + '/' + m.substr(0, 4); }, flags: sp.byMonth.map(function (m) { return !!m.partial; }),
      extra: function (i) { var m = sp.byMonth[i]; return [{ name: 'đơn hàng', value: num(m.orders) }, { name: 'ngày có số liệu', value: num(m.nDays) }]; } });
    else if (ge) C.columns(ge, { name: 'GMV toàn shop', x: sp.byDay.map(function (d) { return d.date; }), values: sp.byDay.map(function (d) { return d.gmv; }), color: SERIES[0], yFmt: M.fmtCompact, tipFmt: money, xFmt: M.fmtDayMonth, tipTitle: M.fmtDate, flags: sp.byDay.map(function (d) { return !!d.partial; }),
      extra: function (i) { var d = sp.byDay[i]; return [{ name: 'đơn hàng', value: num(d.orders) }, { name: 'đơn SKU', value: num(d.sku) }]; } });
  };

  // ---------- VIDEO & LIÊN KẾT ----------
  V.content = function (host, ctx) {
    var v = ctx.vid, a = ctx.aff;
    var h = filterLine(ctx) + '<p class="note">Đây là số liệu kênh nội dung do TikTok ghi nhận (GMV video, GMV nhà sáng tạo). Không cộng vào doanh thu gộp quảng cáo và không dùng để tính ROAS.</p>';
    h += '<h3>Video theo phạm vi kênh</h3>';
    if (!v.n) h += nodata('Chưa có file Video performance trong kỳ lọc.');
    else {
      h += tbl(['Phạm vi', { t: 'Số ngày', num: true }, { t: 'GMV đến từ video', num: true }, { t: 'GMV video trực tiếp', num: true }, { t: 'GMV gián tiếp', num: true }, { t: 'Đơn SKU ghi nhận', num: true }, { t: 'Lượt xem (VV)', num: true }, { t: 'GPM (GMV/1.000 VV)', num: true }, { t: 'CTR sản phẩm', num: true }],
        v.scopes.map(function (s) { return [esc(s.scope) + partialTag(s.partial), num(s.nDays), money(s.gmv), money(s.gmvDirect), money(s.gmvIndirect), num(s.sku), num(s.vv), s.gpm == null ? M.UNDEF : money(s.gpm), M.fmtPct(s.ctr)]; }));
      h += src('Nguồn: Video performance · ' + cov(v.coverage) + ' · GPM, CTR tính lại từ số tổng.');
      if (v.coverage && v.coverage.from !== v.coverage.to) h += '<h3>GMV đến từ video theo ngày</h3><div class="legend">' + v.scopes.slice(0, 3).map(function (s, i) { return '<span><i style="background:' + SERIES[i] + '"></i>' + esc(s.scope) + '</span>'; }).join('') + '</div><div class="chart" data-chart="vid"></div>';
    }
    h += '<h3>Liên kết (Affiliate) theo kỳ</h3>';
    if (!a.n) h += nodata('Chưa có file Liên kết nằm trọn trong kỳ lọc.' + (a.excluded.length ? ' Có ' + a.excluded.length + ' kỳ chỉ trùng một phần với kỳ lọc (không tự chia nhỏ).' : ''));
    else {
      h += tbl(['Kỳ', { t: 'GMV nhờ nhà sáng tạo', num: true }, { t: 'Số món bán', num: true }, { t: 'Hoàn tiền', num: true }, { t: 'Hoa hồng ước tính', num: true }, { t: 'Hoa hồng/GMV', num: true }, { t: 'Video', num: true }, { t: 'LIVE', num: true }],
        a.rows.map(function (r) { return [M.fmtPeriod(r.from, r.to) + partialTag(r.partial), money(r.gmv), num(r.items), money(r.refund), money(r.commission), M.fmtPct(r.gmv > 0 ? r.commission / r.gmv : null), num(r.videos), num(r.lives)]; }),
        { foot: ['<strong>Cộng</strong>', money(a.gmv), num(a.items), money(a.refund), money(a.commission), M.fmtPct(a.commissionRate), num(a.videos), num(a.lives)] });
      h += src('Nguồn: Liên kết – chỉ số cốt lõi · số liệu cấp shop × kỳ (không chia theo ngày)' + (a.excluded.length ? ' · ' + a.excluded.length + ' kỳ chỉ trùng một phần với kỳ lọc bị loại' : ''));
    }
    host.innerHTML = h;
    var ve = host.querySelector('[data-chart="vid"]');
    if (ve) {
      var dates = {}; v.scopes.forEach(function (s) { s.series.forEach(function (d) { dates[d.date] = 1; }); });
      var xs = Object.keys(dates).sort();
      C.line(ve, {
        title: 'GMV đến từ video theo ngày', x: xs, xFmt: M.fmtDayMonth, tipTitle: M.fmtDate, yFmt: M.fmtCompact, tipFmt: money,
        series: v.scopes.slice(0, 3).map(function (s, i) { var m = {}; s.series.forEach(function (d) { m[d.date] = d.gmv; }); return { name: s.scope, color: SERIES[i], values: xs.map(function (x) { return m[x] == null ? null : m[x]; }) }; })
      });
    }
  };

  // ---------- KIỂM SOÁT ADS ----------
  function adsControlNotes(ctx) {
    var a = ctx.ac, th = ctx.thresholds, out = [];
    if (a.costFile != null && a.uncovered > 0) out.push({ k: 'bad', t: 'Có ' + money(a.uncovered) + ' chi phí quảng cáo (' + M.fmtPct(a.uncoveredShare, 1) + ' tổng chi phí theo Business Center) chưa có báo cáo chiến dịch đi kèm → phần chi phí này chưa đo được doanh thu, ROAS chỉ phản ánh phần còn lại.' });
    else if (a.costFile != null && a.campCost > 0) out.push({ k: 'good', t: 'Chi phí trong báo cáo chiến dịch khớp chi phí theo Business Center (không còn phần chưa có báo cáo).' });
    if (a.gmv.cost > 0) out.push({ k: a.gmv.roas >= th[0] ? 'good' : 'warn', t: 'GMV Max: chi phí ' + money(a.gmv.cost) + ', doanh thu gộp ' + money(a.gmv.rev) + ' → ROAS ' + M.fmtRoas(a.gmv.roas, th) + (a.gmv.roasAll != null ? '; riêng ' + a.gmv.roasAllScope + ', tính cả hoa hồng nhà sáng tạo gắn với quảng cáo (' + money(a.gmv.aff) + ') thì ROAS chỉ còn ' + M.fmtRoas(a.gmv.roasAll, th) : '') + '.' });
    if (a.reg.cost > 0) out.push({ k: a.reg.roas != null && a.reg.roas >= 1 ? 'info' : 'bad', t: 'Chiến dịch thường (ngoài GMV Max): chi ' + money(a.reg.cost) + ', doanh thu shop ghi nhận ' + money(a.reg.rev) + ' → ROAS ' + (a.reg.roas == null ? M.UNDEF : M.fmtNum(a.reg.roas, 2)) + '. Cần xác định mục tiêu của nhóm này (tăng nhận diện, kéo người xem LIVE) trước khi tiếp tục chi.' });
    if (a.ch && ctx.shop.gmv > 0) out.push({ k: 'info', t: 'Doanh số theo kênh: LIVE ' + M.fmtPct(a.ch.live / ctx.shop.gmv, 1) + ', video ' + M.fmtPct(a.ch.video / ctx.shop.gmv, 1) + ', thẻ sản phẩm ' + M.fmtPct(a.ch.card / ctx.shop.gmv, 1) + '; nhà sáng tạo mang lại ' + M.fmtPct(a.ch.creator / ctx.shop.gmv, 1) + ' GMV.' });
    if (a.costToGmv != null) out.push({ k: 'info', t: 'Chi phí quảng cáo bằng ' + M.fmtPct(a.costToGmv, 1) + ' GMV toàn shop' + (a.sameCostShop ? '' : ' (hai nguồn khác kỳ: chi phí ' + cov(a.costFileCov) + ', GMV ' + cov(ctx.shop.coverage) + ' – chỉ để tham khảo)') + '.' });
    if (a.trend && a.trend.first != null && a.trend.last != null) out.push({ k: a.trend.last > a.trend.first * 1.1 ? 'bad' : a.trend.last < a.trend.first * 0.9 ? 'good' : 'info', t: 'Chi phí quảng cáo bằng ' + M.fmtPct(a.trend.first, 1) + ' GMV trong 3 tháng đầu kỳ và ' + M.fmtPct(a.trend.last, 1) + ' trong 3 tháng gần nhất' + (a.trend.last > a.trend.first * 1.1 ? ' → mỗi đồng doanh số đang tốn nhiều tiền quảng cáo hơn trước.' : a.trend.last < a.trend.first * 0.9 ? ' → hiệu quả quảng cáo đang cải thiện.' : ' → tương đối ổn định.') });
    if (!a.booking.n) out.push({ k: 'warn', t: 'Chưa có danh sách booking nhà sáng tạo trong kỳ → chưa tính được chi phí và hiệu quả booking.' });
    if (a.market.length) { var m = a.market[0]; out.push({ k: 'info', t: 'Thị trường (ghi nhận ' + M.fmtDate(m.date) + '): hạng ' + m.rank + ' về GMV trong nhóm ngành' + (m.change ? ' (' + m.change + ')' : '') + (m.ace ? '; chỉ số ACE: ' + m.ace : '') + '.' }); }
    return '<ul class="comments">' + out.map(function (c) { var ic = c.k === 'good' ? '▲' : c.k === 'bad' ? '▼' : c.k === 'warn' ? '!' : 'i'; return '<li class="cm-' + c.k + '"><span class="cm-ic" aria-hidden="true">' + ic + '</span><span>' + esc(c.t) + '</span></li>'; }).join('') + '</ul>';
  }
  V.adsControl = function (host, ctx) {
    var a = ctx.ac, th = ctx.thresholds, sp = ctx.shop;
    var h = filterLine(ctx);
    h += '<div class="tiles">' +
      tile('Chi phí QC theo Business Center', a.costFile == null ? M.NODATA : money(a.costFile), a.costFile == null ? 'Cần file Cost' : 'File Cost · ' + cov(a.costFileCov)) +
      tile('Có báo cáo chiến dịch', money(a.campCost), a.costFile > 0 ? M.fmtPct(a.campCost / a.costFile, 1) + ' chi phí' : cov(a.campCov)) +
      tile('Chưa có báo cáo chiến dịch', a.uncovered == null ? M.NODATA : money(a.uncovered), a.uncoveredShare == null ? '' : M.fmtPct(a.uncoveredShare, 1) + ' chi phí – chưa đo được doanh thu', a.uncovered > 0 ? 'tile-bad' : '') +
      tile('ROAS GMV Max', a.gmv.cost > 0 ? M.fmtRoas(a.gmv.roas, th) : M.UNDEF, a.gmv.roasAll != null ? a.gmv.roasAllScope + ' gồm hoa hồng: ' + M.fmtRoas(a.gmv.roasAll, th) : '') +
      tile('Chi phí QC / GMV toàn shop', a.costToGmv == null ? M.NODATA : M.fmtPct(a.costToGmv, 1), a.costToGmv == null ? '' : (a.sameCostShop ? 'Cùng kỳ' : 'Khác kỳ – tham khảo')) +
      tile('Booking nhà sáng tạo', a.booking.n ? money(a.booking.fee) : M.NODATA, a.booking.n ? a.booking.n + ' lần booking' : 'Cần danh sách booking nội bộ') + '</div>';
    h += '<h3>Nhận định</h3>' + adsControlNotes(ctx);

    if (a.byMonth.length > 1) {
      var ym = function (m) { return 'T' + (+m.slice(5, 7)) + '/' + m.slice(0, 4); };
      h += '<h3>Chi phí quảng cáo so với doanh số theo tháng</h3><div class="chart" data-chart="acmon"></div>';
      h += tbl(['Tháng', { t: 'Chi phí QC (Business Center)', num: true }, { t: 'GMV toàn shop', num: true }, { t: 'Chi phí QC / GMV', num: true }, { t: 'Hoa hồng liên kết ước tính', num: true }, { t: 'Chiến dịch thường: chi', num: true }, { t: 'Chiến dịch thường: doanh thu', num: true }],
        a.byMonth.map(function (m) { return [ym(m.month) + partialTag(m.costPartial), m.cost == null ? '—' : money(m.cost), m.gmvDays ? money(m.gmv) + (m.gmvDays < 28 ? ' <span class="muted small">(' + m.gmvDays + ' ngày)</span>' : '') : '—', m.costToGmv == null ? '—' : M.fmtPct(m.costToGmv, 1), m.aff == null ? '—' : money(m.aff), m.regCost ? money(m.regCost) : '—', m.regCost ? money(m.regRev) : '—']; }));
      h += src('Chi phí QC theo file Cost từng tháng; GMV theo Phân tích shop; hoa hồng theo file Liên kết (chỉ có từ tháng 3 – TikTok giữ 269 ngày). Tỷ lệ chỉ tính khi cả hai nguồn có số của tháng; tháng chưa trọn chỉ để tham khảo.');
    }

    h += '<h3>A. Đối chiếu chi phí quảng cáo theo tài khoản</h3>';
    if (!a.byAccount.length) h += nodata('Chưa có file Cost hoặc báo cáo chiến dịch trong kỳ lọc.');
    else {
      h += tbl(['Tài khoản quảng cáo', { t: 'Chi phí (file Cost)', num: true }, { t: 'GMV Max', num: true }, { t: 'Chiến dịch thường', num: true }, { t: 'Chưa có báo cáo', num: true }, 'Ghi chú'],
        a.byAccount.map(function (x) {
          var note = x.file == null ? 'Có báo cáo chiến dịch nhưng không có trong file Cost (kiểm tra kỳ/BC)' : x.gap > 0.5 ? 'Thiếu báo cáo chiến dịch cho phần chênh lệch' : x.gap < -0.5 ? 'Báo cáo chiến dịch cao hơn file Cost (khác thời điểm xuất)' : 'Khớp';
          return { cls: x.gap > 0.5 ? 'row-bad' : '', cells: [esc(x.account) + (x.id ? '<div class="muted small">ID ' + esc(x.id) + '</div>' : ''), x.file == null ? '—' : money(x.file), money(x.gmv), money(x.other), x.gap == null ? '—' : money(Math.max(0, x.gap)), note] };
        }),
        { foot: ['<strong>Cộng</strong>', a.costFile == null ? '—' : money(a.costFile), money(a.gmv.cost), money(a.reg.cost), a.uncovered == null ? '—' : money(a.uncovered), ''] });
      h += src('Chi phí theo file Cost (Business Center) · ' + cov(a.costFileCov) + '. Báo cáo chiến dịch: GMV Max xuất từ Seller Center → Quảng cáo cửa hàng; chiến dịch thường xuất từ Ads Manager → Báo cáo tùy chỉnh · ' + cov(a.campCov) + '.' + (a.gmvAccountSet ? '' : ' File GMV Max không ghi tài khoản: khai báo tên tài khoản GMV Max ở mục Cài đặt để đối chiếu đúng dòng.'));
    }

    h += '<h3>B. Hiệu quả theo loại chiến dịch</h3>';
    if (!a.byType.length) h += nodata('Chưa có báo cáo chiến dịch (GMV Max / Ads Manager) trong kỳ lọc.');
    else {
      h += tbl(['Loại chiến dịch', { t: 'Chi phí', num: true }, { t: 'Doanh thu gộp', num: true }, { t: 'ROAS', num: true }, { t: 'Đơn SKU', num: true }, { t: 'Chi phí/đơn SKU', num: true }, { t: 'Hoa hồng liên kết gắn QC', num: true }, { t: 'ROAS gồm hoa hồng', num: true }],
        a.byType.map(function (x) { return [esc(x.type), money(x.cost), money(x.rev), roasCell(x.roas, th), num(x.sku), x.cpo == null ? M.UNDEF : money(x.cpo), x.affRows ? money(x.aff) : '—', x.roasAll == null ? '—' : M.fmtRoas(x.roasAll, th)]; }),
        { foot: ['<strong>Cộng</strong>', money(a.campCost), money(a.campRev), roasCell(a.roasCamp, th), '', '', '', ''] });
      h += src('ROAS = doanh thu gộp ÷ chi phí, tính lại từ số tổng. “ROAS gồm hoa hồng” = doanh thu gộp ÷ (chi phí quảng cáo + hoa hồng nhà sáng tạo trên các đơn do quảng cáo mang lại), theo cột “Chi phí (liên kết)” của TikTok.');
    }

    h += '<h3>C. Doanh số theo kênh nội dung (LIVE, video, thẻ sản phẩm)</h3>';
    if (!sp.n) h += nodata('Chưa có file Phân tích shop (Shop Analytics_Key metrics) trong kỳ lọc.');
    else {
      var g = sp.gmv, pc = function (x) { return g > 0 ? M.fmtPct(x / g, 1) : '—'; };
      h += '<div class="chart" data-chart="acseg"></div>';
      h += tbl(['Kênh', { t: 'Shop tự làm', num: true }, { t: 'Nhà sáng tạo', num: true }, { t: 'Cộng', num: true }, { t: 'Tỷ trọng GMV', num: true }],
        [['LIVE', money(sp.chSellerLive), money(sp.chCreatorLive), money(a.ch.live), pc(a.ch.live)],
          ['Video', money(sp.chSellerVideo), money(sp.chCreatorVideo), money(a.ch.video), pc(a.ch.video)],
          ['Thẻ sản phẩm', '—', '—', money(a.ch.card), pc(a.ch.card)]],
        { foot: ['<strong>Cộng</strong>', money(a.ch.seller), money(a.ch.creator), money(sp.gmv), '100%'] });
      h += src('Nguồn: Phân tích shop · ' + cov(sp.coverage) + partialTag(sp.partial) + ' · GMV chưa trừ hủy/hoàn. Doanh số GMV Max (' + money(a.gmv.rev) + ') là một phần của GMV toàn shop, không cộng thêm.');
    }

    h += '<h3>D. Nhà sáng tạo: liên kết và booking</h3>';
    var af = a.aff;
    h += tbl(['Chỉ tiêu', { t: 'Giá trị', num: true }, 'Nguồn'], [
      ['GMV qua liên kết (affiliate)', af.n ? money(af.gmv) : M.NODATA, 'Liên kết – chỉ số cốt lõi · ' + cov(af.coverage)],
      ['Hoa hồng ước tính', af.n ? money(af.commission) : M.NODATA, 'TikTok tính, trả qua quyết toán'],
      ['Hoa hồng / GMV liên kết', af.n ? M.fmtPct(af.commissionRate, 2) : M.NODATA, ''],
      ['Phí booking (trả ngoài TikTok)', a.booking.n ? money(a.booking.fee) : M.NODATA, a.booking.n ? 'Danh sách booking nội bộ · ' + cov(a.booking.coverage) : 'Nhập file danh sách booking (Ngày, Kênh, Hình thức, Phí booking, GMV)'],
      ['GMV ghi nhận từ booking', a.booking.gmvRows ? money(a.booking.gmv) : M.NODATA, ''],
      ['GMV ÷ phí booking', a.booking.roi == null ? M.NODATA : M.fmtNum(a.booking.roi, 2), '']]);
    if (a.booking.byCreator.length) h += tbl(['Kênh nhà sáng tạo', { t: 'Số lần', num: true }, { t: 'Phí booking', num: true }, { t: 'GMV ghi nhận', num: true }, { t: 'GMV ÷ phí', num: true }],
      a.booking.byCreator.map(function (x) { return [esc(x.creator), num(x.n), money(x.fee), x.gmvRows ? money(x.gmv) : '—', x.roi == null ? '—' : M.fmtNum(x.roi, 2)]; }));

    h += '<h3>E. So sánh với thị trường</h3>';
    if (!a.market.length) h += nodata('Chưa ghi nhận số liệu thị trường. Lấy “Bảng xếp hạng GMV” và chỉ số ACE ở Seller Center → Số liệu phân tích, nhập ở mục Cài đặt.');
    else {
      h += tbl(['Ngày ghi nhận', { t: 'Hạng GMV trong ngành', num: true }, 'Thay đổi', 'Chỉ số ACE so với shop cùng ngành', 'Ghi chú'],
        a.market.map(function (m) { return [M.fmtDate(m.date), esc(m.rank), esc(m.change || ''), esc(m.ace || ''), esc(m.note || '')]; }));
      h += src('Nguồn: Seller Center → Số liệu phân tích (Bảng xếp hạng GMV theo ngày; ACE = Danh mục sản phẩm, Nội dung, Tiếp cận). TikTok không công bố GMV của shop khác.');
    }
    host.innerHTML = h;
    var me = host.querySelector('[data-chart="acmon"]'), mr = a.byMonth.filter(function (m) { return m.costToGmv != null; });
    if (me && mr.length) C.columns(me, { name: 'Chi phí QC / GMV', x: mr.map(function (m) { return m.month; }), values: mr.map(function (m) { return m.costToGmv * 100; }), color: SERIES[0], height: 200,
      xFmt: function (m) { return 'T' + (+m.slice(5, 7)); }, yFmt: function (v) { return M.fmtNum(v, 0) + '%'; }, tipFmt: function (v) { return M.fmtNum(v, 1) + '%'; }, tipTitle: function (m) { return 'Tháng ' + (+m.slice(5, 7)) + '/' + m.slice(0, 4); },
      flags: mr.map(function (m) { return m.costPartial || m.gmvDays < 28; }),
      extra: function (i) { var m = mr[i]; return [{ name: 'chi phí QC', value: money(m.cost) }, { name: 'GMV', value: money(m.gmv) }]; } });
    var se = host.querySelector('[data-chart="acseg"]');
    if (se && sp.gmv > 0) C.segbar(se, { title: 'Cơ cấu GMV theo kênh', fmt: money, pct: function (x) { return M.fmtPct(x, 1); },
      parts: sp.channels.map(function (c) { return { label: c.label, value: c.value, color: SERIES[c.slot], ink: SERIES_INK[c.slot] }; }) });
  };

  // ---------- Dữ liệu cho Excel (theo bộ lọc) ----------
  V.excel = function (ctx, meta) {
    var s = ctx.ads, th = ctx.thresholds, o = ctx.orders, st = ctx.stl, rc = ctx.rec;
    var sub = ['Kỳ lọc: ' + M.fmtPeriod(ctx.f.from, ctx.f.to) + ' · ' + ctx.shopLabel + (ctx.campLabel ? ' · Chiến dịch: ' + ctx.campLabel : ''), 'Xuất lúc ' + (meta && meta.now || '') + ' · ROAS = Doanh thu gộp theo báo cáo quảng cáo ÷ Chi phí Ads; CIR = Chi phí Ads ÷ Doanh thu gộp; tính lại từ số tổng.'];
    var rnum = function (x) { return x == null ? M.UNDEF : x; };
    var sheets = [];
    var ov = { name: 'Tổng quan', title: 'BÁO CÁO TIKTOK SHOP – TỔNG QUAN', sub: sub, cols: [{ t: 'Chỉ tiêu', w: 46 }, { t: 'Giá trị', k: 'money', w: 22 }, { t: 'Ghi chú / nguồn', w: 70 }], rows: [] };
    ov.rows.push(['Chi phí quảng cáo', s.cost, 'Báo cáo quảng cáo, kỳ thực có ' + cov(s.coverage)]);
    ov.rows.push(['Doanh thu gộp theo báo cáo quảng cáo', s.rev, 'Báo cáo quảng cáo']);
    ov.rows.push(['Số đơn SKU', s.skuKnown ? s.sku : M.NODATA, 'Báo cáo quảng cáo']);
    ov.rows.push(['Chi phí / đơn SKU', s.cpo == null ? (s.skuKnown ? M.UNDEF : M.NODATA) : M.round(s.cpo, 0), 'Làm tròn đến đồng']);
    ov.rows.push(['ROAS', s.roas == null ? M.UNDEF : M.fmtRoas(s.roas, th), 'Doanh thu gộp ÷ chi phí (hiển thị 2 chữ số thập phân)']);
    ov.rows.push(['CIR', s.cir == null ? M.UNDEF : M.fmtPct(s.cir), 'Chi phí ÷ doanh thu gộp']);
    ov.rows.push(['Trạng thái ROAS', s.band.label, s.partial.length ? 'Có ngày chưa kết thúc: ' + s.partial.map(M.fmtDate).join(', ') : '']);
    ctx.targets.forEach(function (t) {
      ov.rows.push(['Doanh thu còn thiếu để đạt ROAS ' + tf(t.t) + (t.isOfficial ? ' (mốc chính thức)' : ''), rnum(t.shortfall), 'MAX(0, ' + tf(t.t) + ' × chi phí − doanh thu gộp)']);
      if (ctx.remaining > 0) ov.rows.push(['ROAS cần đạt trên ' + M.fmtMoney(ctx.remaining) + ' chi thêm để cả kỳ đạt ' + tf(t.t), t.required == null ? M.UNDEF : M.fmtNum(t.required, 2), '']);
    });
    ov.rows.push(['Mốc chính thức', ctx.official == null ? 'Chưa chọn – không kết luận đạt thưởng' : tf(ctx.official), '']);
    ov.rows.push(['', '', '']);
    ov.rows.push(['NHẬN ĐỊNH CHÍNH', '', '']);
    ctx.comments.forEach(function (c) { ov.rows.push(['', '', c.t]); });
    sheets.push(ov);
    sheets.push({ name: 'Theo ngày', title: 'Quảng cáo theo ngày', sub: sub, cols: [{ t: 'Ngày' }, { t: 'Chi phí', k: 'money' }, { t: 'Doanh thu gộp', k: 'money' }, { t: 'Đơn SKU', k: 'int' }, { t: 'Chi phí/đơn SKU', k: 'money' }, { t: 'ROAS', k: 'num2' }, { t: 'CIR', k: 'pct' }, { t: 'Trạng thái' }, { t: 'Ngày chưa kết thúc' }],
      rows: s.byDay.map(function (d) { return [M.fmtDate(d.date), d.cost, d.rev, d.skuMissing ? M.NODATA : d.sku, d.cpo == null ? M.UNDEF : M.round(d.cpo, 0), d.roas == null ? M.UNDEF : M.round(d.roas, 4), d.cir == null ? M.UNDEF : d.cir, M.band(d.roas, th).label, d.partial ? 'Có' : '']; }),
      notes: s.periodLevel.length ? [s.periodLevel.length + ' dòng cấp kỳ được tính vào tổng nhưng không chia theo ngày.'] : [] });
    sheets.push({ name: 'Theo chiến dịch', title: 'Chiến dịch – xếp theo doanh thu còn thiếu (mốc ' + tf(th[ctx.rankIndex] || 0) + ')', sub: sub,
      cols: [{ t: 'Chiến dịch' }, { t: 'ID / khóa' }, { t: 'Chi phí', k: 'money' }, { t: 'Doanh thu gộp', k: 'money' }, { t: 'Đơn SKU', k: 'int' }, { t: 'ROAS', k: 'num2' }, { t: 'Trạng thái' }].concat(th.map(function (t) { return { t: 'Thiếu để đạt ' + tf(t), k: 'money' }; })).concat([{ t: 'Ngày chưa kết thúc' }]),
      rows: s.byCampaign.slice().sort(function (a, b) { return (b.short[ctx.rankIndex] || 0) - (a.short[ctx.rankIndex] || 0); }).map(function (c) { return [c.name, c.ent || '(cấp shop)', c.cost, c.rev, c.skuMissing ? M.NODATA : c.sku, c.roas == null ? M.UNDEF : M.round(c.roas, 4), c.band.label].concat(c.short.map(rnum)).concat([c.partial ? 'Có' : '']); }) });
    sheets.push({ name: 'Theo shop', title: 'Quảng cáo theo shop', sub: sub, cols: [{ t: 'Shop' }, { t: 'Chi phí', k: 'money' }, { t: 'Doanh thu gộp', k: 'money' }, { t: 'Đơn SKU', k: 'int' }, { t: 'ROAS', k: 'num2' }, { t: 'CIR', k: 'pct' }],
      rows: s.byShop.map(function (c) { return [M.shopName(ctx.cube, c.shop), c.cost, c.rev, c.skuMissing ? M.NODATA : c.sku, c.roas == null ? M.UNDEF : M.round(c.roas, 4), c.cir == null ? M.UNDEF : c.cir]; }).concat([['GỘP (tính lại từ tổng)', s.cost, s.rev, s.skuKnown ? s.sku : M.NODATA, s.roas == null ? M.UNDEF : M.round(s.roas, 4), s.cir == null ? M.UNDEF : s.cir]]) });
    var kt = { name: 'Kiểm soát kế toán', title: 'Kiểm soát số liệu kế toán', sub: sub, cols: [{ t: 'Nhóm', w: 22 }, { t: 'Chỉ tiêu', w: 44 }, { t: 'Giá trị', k: 'money', w: 22 }, { t: 'Nguồn / kỳ / cách tính', w: 70 }], rows: [] };
    kt.rows.push(['Doanh thu', 'Doanh thu gộp theo báo cáo quảng cáo', s.n ? s.rev : M.NODATA, 'Báo cáo quảng cáo · ' + cov(s.coverage)]);
    kt.rows.push(['Doanh thu', 'Doanh số sau hoàn/hủy', o.netSales != null ? o.netSales : M.NODATA, 'File đơn hàng · ' + cov(o.coverage)]);
    kt.rows.push(['Doanh thu', 'Tiền quyết toán', st.n ? st.amount : M.NODATA, 'File tài chính · ' + cov(st.coverage)]);
    if (o.n) {
      kt.rows.push(['Đơn hàng', 'Số đơn hàng duy nhất', o.orders, 'Đếm mã đơn khác nhau']);
      kt.rows.push(['Đơn hàng', 'Số đơn SKU', o.skuLines, 'Số dòng SKU']);
      kt.rows.push(['Đơn hàng', 'Giá trị đơn hàng (mỗi đơn 1 lần)', o.hasOrderAmt ? o.orderAmt : M.NODATA, '']);
      kt.rows.push(['Đơn hàng', 'Đơn hủy (số đơn)', o.hasStatus ? o.cancelOrders : M.NODATA, '']);
      kt.rows.push(['Đơn hàng', 'Giá trị đơn hủy', o.hasStatus ? o.cancelAmt : M.NODATA, '']);
      kt.rows.push(['Đơn hàng', 'Tỷ lệ hủy theo số đơn', o.cancelRateCount != null ? M.fmtPct(o.cancelRateCount) : M.NODATA, 'Đơn hủy ÷ đơn có trạng thái']);
      kt.rows.push(['Đơn hàng', 'Tỷ lệ hủy theo giá trị', o.cancelRateValue != null ? M.fmtPct(o.cancelRateValue) : M.NODATA, '']);
      kt.rows.push(['Đơn hàng', 'Tỷ lệ hoàn theo số đơn', o.returnRateCount != null ? M.fmtPct(o.returnRateCount) : M.NODATA, 'Đơn hoàn ÷ đơn không hủy, đã thanh toán']);
      kt.rows.push(['Đơn hàng', 'Tỷ lệ hoàn theo giá trị', o.returnRateValue != null ? M.fmtPct(o.returnRateValue) : M.NODATA, '']);
    }
    kt.rows.push(['Đối chiếu Ads', 'Chi phí dashboard (báo cáo quảng cáo)', s.n ? rc.dash : M.NODATA, cov(s.coverage)]);
    kt.rows.push(['Đối chiếu Ads', 'Chi phí file Cost (chưa thuế)', rc.acct.n ? rc.acct.amount : M.NODATA, cov(rc.acct.coverage)]);
    kt.rows.push(['Đối chiếu Ads', 'Thuế ước tính (file Cost)', rc.acct.n && rc.acct.hasTax ? rc.acct.tax : M.NODATA, '']);
    kt.rows.push(['Đối chiếu Ads', 'Chênh lệch file Cost − dashboard', rc.diffAcct == null || !s.n ? '—' : rc.diffAcct, '']);
    kt.rows.push(['Đối chiếu Ads', 'Hóa đơn Ads – tiền trước thuế', rc.inv.n ? rc.inv.net : M.NODATA, cov(rc.inv.coverage)]);
    kt.rows.push(['Đối chiếu Ads', 'Hóa đơn Ads – tiền thuế', rc.inv.n && rc.inv.hasTax ? rc.inv.tax : M.NODATA, '']);
    if (rc.topup.nAll) {
      kt.rows.push(['Thanh toán Ads', 'Nạp tiền (Thêm số dư) thành công', rc.topup.topup, cov(rc.topup.coverage)]);
      kt.rows.push(['Thanh toán Ads', 'Thanh toán hóa đơn bằng thẻ / chuyển khoản', rc.topup.billCard, '']);
      kt.rows.push(['Thanh toán Ads', 'Tiền thực trả TikTok Ads (tham khảo)', rc.topup.cashOut, 'Nạp tiền + thanh toán hóa đơn không trả từ số dư']);
      kt.rows.push(['Thanh toán Ads', 'Thanh toán hóa đơn trả từ số dư (không tính)', rc.topup.billBalance, 'Đã tính khi nạp tiền']);
      kt.rows.push(['Thanh toán Ads', 'Chuyển số dư nội bộ – ròng (không tính)', rc.topup.transferNet, rc.topup.nTransfer + ' giao dịch']);
      kt.rows.push(['Thanh toán Ads', 'Tín dụng khuyến mãi (không tính)', rc.topup.promo, '']);
      kt.rows.push(['Thanh toán Ads', 'Giao dịch không thành công (không tính)', rc.topup.failed, rc.topup.nFailed + ' giao dịch']);
    }
    rc.invByCat.forEach(function (c) { kt.rows.push(['Hóa đơn', (CAT[c.category] || c.category) + ' – trước thuế / thuế / tổng', c.net, 'Thuế: ' + M.fmtMoney(c.tax) + ' · Tổng: ' + M.fmtMoney(c.amount) + ' · TNCN: ' + M.fmtMoney(c.pit)]); });
    sheets.push(kt);
    var sp = ctx.shop;
    if (sp.n) {
      var shRows = [['TỔNG KỲ LỌC', sp.byDay.length, sp.gmv, sp.orders, sp.sku, sp.skuPerOrder == null ? M.UNDEF : M.round(sp.skuPerOrder, 4), sp.items, sp.aov == null ? M.UNDEF : M.round(sp.aov, 0), sp.refund, sp.partial ? 'Có' : '']];
      sp.byMonth.forEach(function (m) { shRows.push(['Tháng ' + m.month.substr(5, 2) + '/' + m.month.substr(0, 4), m.nDays, m.gmv, m.orders, m.sku, m.skuPerOrder == null ? M.UNDEF : M.round(m.skuPerOrder, 4), m.items, m.aov == null ? M.UNDEF : M.round(m.aov, 0), m.refund, m.partial ? 'Có' : '']); });
      sp.byDay.forEach(function (d) { shRows.push([M.fmtDate(d.date), 1, d.gmv, d.orders, d.sku, d.orders > 0 ? M.round(d.sku / d.orders, 4) : M.UNDEF, d.items, d.aov == null ? M.UNDEF : M.round(d.aov, 0), d.refund, d.partial ? 'Có' : '']); });
      sheets.push({ name: 'Phân tích shop', title: 'Toàn shop – Phân tích shop (Shop Analytics)', sub: sub,
        cols: [{ t: 'Kỳ / ngày' }, { t: 'Số ngày', k: 'int' }, { t: 'GMV toàn shop', k: 'money' }, { t: 'Đơn hàng', k: 'int' }, { t: 'Đơn hàng SKU', k: 'int' }, { t: 'SKU/đơn', k: 'num2' }, { t: 'Số món bán ra', k: 'int' }, { t: 'AOV', k: 'money' }, { t: 'Hoàn tiền (theo ngày phát sinh hoàn)', k: 'money' }, { t: 'Ngày chưa kết thúc' }],
        rows: shRows,
        notes: ['GMV theo kênh: ' + sp.channels.map(function (c) { return c.label + ' ' + M.fmtMoney(c.value) + ' (' + M.fmtPct(c.share, 1) + ')'; }).join('; ') + '.',
          'Khách hàng, khách truy cập, tỷ lệ chuyển đổi là số duy nhất theo ngày – không cộng qua nhiều ngày. Hoàn tiền ghi theo ngày phát sinh hoàn – không dùng tính tỷ lệ hoàn.'] });
    }
    if (ctx.vid.n || ctx.aff.n) {
      sheets.push({ name: 'Video & Liên kết', title: 'Kênh nội dung (không dùng tính ROAS)', sub: sub, cols: [{ t: 'Nguồn' }, { t: 'Phạm vi / kỳ' }, { t: 'GMV', k: 'money' }, { t: 'Đơn SKU / số món', k: 'int' }, { t: 'Hoa hồng ước tính', k: 'money' }, { t: 'Lượt xem', k: 'int' }],
        rows: ctx.vid.scopes.map(function (v) { return ['Video', v.scope, v.gmv, v.sku, '', v.vv]; }).concat(ctx.aff.rows.map(function (r) { return ['Liên kết', M.fmtPeriod(r.from, r.to), r.gmv, r.items, r.commission, '']; })) });
    }
    sheets.push({ name: 'Nguồn dữ liệu', title: 'Các lần nhập dữ liệu', sub: sub, cols: [{ t: '#', k: 'int' }, { t: 'Thời điểm nhập' }, { t: 'Loại dữ liệu' }, { t: 'Shop' }, { t: 'Phạm vi' }, { t: 'Từ ngày' }, { t: 'Đến ngày' }, { t: 'File' }, { t: 'Mới', k: 'int' }, { t: 'Trùng', k: 'int' }, { t: 'Cập nhật', k: 'int' }, { t: 'Chồng lấn', k: 'int' }, { t: 'Lỗi', k: 'int' }, { t: 'Đã hủy' }],
      rows: (ctx.cube.imports || []).map(function (i) { return [i.id, i.time, i.datasetLabel, i.shopName, i.scope || '', M.fmtDate(i.from), M.fmtDate(i.to), i.fileName, i['new'], i.dup, i.update, i.conflict, i.error, i.rolledBack ? 'Đã hủy' : '']; }) });
    return sheets;
  };

  root.TTSV = V;
})(window);
