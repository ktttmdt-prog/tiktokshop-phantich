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
    if (ctx.shop.n) h += '<h3>Toàn shop (Phân tích shop)</h3>' + shopTiles(ctx) + src('Nguồn: Shop Analytics · số liệu thực có ' + cov(ctx.shop.coverage) + ' · chi tiết ở trang Doanh số & khách hàng.');
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

  // ---------- CÂY CHỈ SỐ: doanh số tăng/giảm ở đâu, cần bù bao nhiêu ----------
  function chg(a, b) { return a > 0 && b != null ? b / a - 1 : null; }
  function chgCell(a, b, ratio) {
    if (a == null || b == null || !isFinite(a) || !isFinite(b)) return '—';
    if (ratio) { var d = (b - a) * 100; return '<span class="' + (d < 0 ? 'neg' : 'pos') + '">' + (d >= 0 ? '+' : '') + num(d, 2) + ' điểm</span>'; }
    var c = chg(a, b); return c == null ? '—' : '<span class="' + (c < 0 ? 'neg' : 'pos') + '">' + (c >= 0 ? '+' : '') + M.fmtPct(c, 1) + '</span>';
  }
  function sMoney(x) { return x == null || !isFinite(x) ? '—' : (Math.abs(x) >= 1e9 ? num(x / 1e9, 2) + ' tỷ' : Math.abs(x) >= 1e6 ? num(x / 1e6, 1) + ' triệu' : money(x)); }
  function signMoney(x) { return x == null || !isFinite(x) ? '—' : '<span class="' + (x < 0 ? 'neg' : 'pos') + '">' + (x >= 0 ? '+' : '−') + sMoney(Math.abs(x)) + '</span>'; }
  V.growth = function (host, ctx) {
    var gr = M.growth(ctx.cube, ctx.f, 20000), c = gr.cur, p = gr.prev, h = filterLine(ctx);
    if (!gr.hasCur) { host.innerHTML = h + nodata('Kỳ lọc chưa có file Phân tích shop (Shop Analytics_Key metrics) – cây chỉ số cần số liệu theo ngày của shop.'); return; }
    var per = 'Kỳ này ' + M.fmtPeriod(c.from, c.to) + ' (' + c.days + ' ngày có số liệu) so với kỳ trước ' + M.fmtPeriod(gr.prevFrom, gr.prevTo) + ' (' + p.days + ' ngày). Số đếm tính bình quân ngày để so sánh được cả khi tháng chưa hết.';
    h += '<p class="note">' + per + '</p>';
    // 1. Kết luận
    var out = [];
    if (gr.hasPrev) {
      out.push('GMV bình quân ngày ' + sMoney(c.gmvD) + ', kỳ trước ' + sMoney(p.gmvD) + ' (' + chgCell(p.gmvD, c.gmvD) + ').');
      if (gr.funnel) {
        var big = gr.funnel.slice().sort(function (x, y) { return Math.abs(y.impact) - Math.abs(x.impact); })[0];
        out.push('Nhân tố ảnh hưởng lớn nhất: <b>' + esc(big.label.toLowerCase()) + '</b> (' + chgCell(big.a, big.b) + '), làm GMV/ngày ' + (big.impact < 0 ? 'giảm ' : 'tăng ') + sMoney(Math.abs(big.impact)) + '.');
        var conv = gr.funnel.filter(function (x) { return x.key === 'c2o'; })[0];
        if (conv && big.key === 'impr' && conv.impact > 0) out.push('Tỷ lệ nhấp thành đơn vẫn tăng – khách đã vào xem vẫn mua; cần tập trung đưa thêm người tới (nội dung, LIVE, quảng cáo, nhà sáng tạo).');
      }
      var negCh = (gr.channels || []).filter(function (x) { return x.delta < 0; }).slice(0, 2);
      if (negCh.length && gr.gmvDelta < 0) out.push('Kênh giảm nhiều nhất: ' + negCh.map(function (x) { return esc(x.label) + ' ' + signMoney(x.delta) + '/ngày' + (x.share != null ? ' (' + M.fmtPct(x.share, 0) + ' mức giảm)' : ''); }).join('; ') + '.');
    } else out.push('Chưa có số liệu kỳ trước (' + M.fmtPeriod(gr.prevFrom, gr.prevTo) + ') để so sánh.');
    var hs = (ctx.cube.health || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
    if (hs) {
      var warn = [];
      if (hs.late != null && hs.late > M.healthTargets.late) warn.push('gửi hàng muộn ' + M.fmtPct(hs.late, 2) + ' (mục tiêu ≤ ' + M.fmtPct(M.healthTargets.late, 0) + ')');
      if (hs.chat != null && hs.chat < M.healthTargets.chat) warn.push('hài lòng qua chat ' + M.fmtPct(hs.chat, 2) + ' (mục tiêu ≥ ' + M.fmtPct(M.healthTargets.chat, 0) + ')');
      if (hs.frozen > 0) warn.push(hs.frozen + ' sản phẩm bị đóng băng');
      if (warn.length) out.push('Tình trạng tài khoản ngày ' + M.fmtDate(hs.date) + ': ' + warn.join('; ') + ' – rủi ro bị giảm hiển thị.');
    }
    h += '<h3>Kết luận</h3><ul class="comments">' + out.map(function (t) { return '<li class="cm-info"><span class="cm-ic" aria-hidden="true">i</span><span>' + t + '</span></li>'; }).join('') + '</ul>';

    // 2. Phễu bán hàng
    h += '<h3>1. Phễu bán hàng toàn shop (bình quân ngày)</h3>';
    h += '<div class="f">GMV = Lượt hiển thị sản phẩm × Tỷ lệ nhấp × Tỷ lệ nhấp thành đơn × Giá trị đơn bình quân</div>';
    var fr = [];
    var fRow = function (label, a, b, ratio, impact, fmt) { fr.push([label, fmt(a), fmt(b), chgCell(a, b, ratio), impact == null ? '' : signMoney(impact)]); };
    var imp = {}; (gr.funnel || []).forEach(function (x) { imp[x.key] = x.impact; });
    fRow('<b>GMV / ngày</b>', p.gmvD, c.gmvD, false, gr.hasPrev ? c.gmvD - p.gmvD : null, sMoney);
    fRow('Lượt hiển thị sản phẩm / ngày', p.imprD, c.imprD, false, imp.impr, function (x) { return num(x, 0); });
    fRow('Tỷ lệ nhấp (nhấp ÷ hiển thị)', p.ctr, c.ctr, true, imp.ctr, function (x) { return M.fmtPct(x, 2); });
    fRow('Tỷ lệ nhấp thành đơn', p.c2o, c.c2o, true, imp.c2o, function (x) { return M.fmtPct(x, 2); });
    fRow('Giá trị đơn bình quân', p.aov, c.aov, false, imp.aov, money);
    fRow('Khách vào shop / ngày <span class="muted small">(tham khảo)</span>', p.visitorsD, c.visitorsD, false, null, function (x) { return num(x, 0); });
    fRow('Khách thành đơn <span class="muted small">(tham khảo)</span>', p.v2o, c.v2o, true, null, function (x) { return M.fmtPct(x, 2); });
    h += tbl(['Chỉ số', { t: 'Kỳ trước', num: true }, { t: 'Kỳ này', num: true }, { t: 'Thay đổi', num: true }, { t: 'Ảnh hưởng tới GMV/ngày', num: true }], fr);
    if (gr.hasPrev && !gr.funnel) h += '<p class="note">Thiếu một trong các chỉ số (hiển thị, nhấp, đơn) ở một kỳ nên chưa tách được ảnh hưởng.</p>';
    h += src('Ảnh hưởng tách theo phương pháp logarit (LMDI): cộng các dòng ảnh hưởng đúng bằng chênh lệch GMV/ngày. Nguồn: Shop Analytics.');

    // 3. Kênh
    if (gr.channels) {
      h += '<h3>2. GMV theo kênh (bình quân ngày)</h3>' + tbl(['Kênh', { t: 'Kỳ trước', num: true }, { t: 'Kỳ này', num: true }, { t: 'Chênh lệch/ngày', num: true }, { t: 'Phần của tổng thay đổi', num: true }],
        gr.channels.map(function (x) { return [esc(x.label), sMoney(x.a), sMoney(x.b), signMoney(x.delta), x.share == null ? '—' : M.fmtPct(x.share, 0)]; }));
    }

    // 4. Video
    h += '<h3>3. Video</h3>';
    if (c.video) {
      var vr = [['Lượt xem video / ngày', num(p.video && p.video.vvD, 0), num(c.video.vvD, 0), chgCell(p.video && p.video.vvD, c.video.vvD)],
        ['Lượt nhấp sản phẩm / 1.000 lượt xem', num(p.video && p.video.clicksPerView * 1000, 1), num(c.video.clicksPerView * 1000, 1), chgCell(p.video && p.video.clicksPerView, c.video.clicksPerView)],
        ['GMV / lượt nhấp', money(p.video && p.video.gmvPerClick), money(c.video.gmvPerClick), chgCell(p.video && p.video.gmvPerClick, c.video.gmvPerClick)],
        ['GMV / 1.000 lượt xem', money(p.video && p.video.gmvPerView * 1000), money(c.video.gmvPerView * 1000), chgCell(p.video && p.video.gmvPerView, c.video.gmvPerView)],
        ['<b>GMV video / ngày</b>', sMoney(p.video && p.video.gmvD), sMoney(c.video.gmvD), chgCell(p.video && p.video.gmvD, c.video.gmvD)]];
      h += tbl(['Chỉ số (Video performance, tất cả kênh)', { t: 'Kỳ trước', num: true }, { t: 'Kỳ này', num: true }, { t: 'Thay đổi', num: true }], vr);
      if (gr.videoFunnel) h += '<p class="note">Ảnh hưởng tới GMV video/ngày: ' + gr.videoFunnel.map(function (x) { return esc(x.label.toLowerCase()) + ' ' + signMoney(x.impact); }).join('; ') + '.</p>';
    } else h += nodata('Chưa có file Video performance trong kỳ lọc.');
    var vl = c.vl;
    if (vl.n) {
      var vlp = p.vl;
      h += '<h4>Danh sách video (từng video)</h4>' + tbl(['Chỉ số', { t: 'Kỳ trước', num: true }, { t: 'Kỳ này', num: true }], [
        ['Số video có phát sinh lượt xem', vlp.n ? num(vlp.videos) : '—', num(vl.videos)],
        ['Video mới đăng trong kỳ', vlp.n ? num(vlp.newVideos) : '—', num(vl.newVideos) + (vl.newPerDay != null ? ' <span class="muted small">(' + num(vl.newPerDay, 1) + '/ngày)</span>' : '')],
        ['Trung vị lượt xem / video', vlp.n ? num(vlp.medianVV, 0) : '—', num(vl.medianVV, 0)],
        ['Trung vị lượt xem / video mới', vlp.n ? num(vlp.medianVVNew, 0) : '—', num(vl.medianVVNew, 0)],
        ['Video có GMV', vlp.n ? num(vlp.withGmv) : '—', num(vl.withGmv) + ' (' + M.fmtPct(vl.videos ? vl.withGmv / vl.videos : null, 0) + ')'],
        ['10% video tốt nhất chiếm', vlp.n ? M.fmtPct(vlp.top10Share, 0) : '—', M.fmtPct(vl.top10Share, 0) + ' GMV video'],
        ['GMV / 1.000 lượt xem', vlp.n ? money(vlp.gpm) : '—', money(vl.gpm)]]);
      h += tbl(['Nhóm lượt xem', { t: 'Số video', num: true }, { t: 'Lượt xem', num: true }, { t: 'GMV', num: true }], vl.buckets.map(function (b) { return [b.label, num(b.videos), num(b.vv), money(b.gmv)]; }));
      h += '<h4>Theo kênh đăng (10 kênh GMV cao nhất)</h4>' + tbl(['Kênh', 'Phạm vi', { t: 'Video', num: true }, { t: 'Video mới', num: true }, { t: 'Lượt xem', num: true }, { t: 'GMV', num: true }, { t: 'GMV/1.000 lượt xem', num: true }],
        vl.byAccount.slice(0, 10).map(function (a) { return [esc(a.account), esc(a.scope || ''), num(a.videos), num(a.newVideos), num(a.vv), money(a.gmv), money(a.gpm)]; }));
      h += src('Nguồn: danh sách video ' + cov(vl.coverage) + (vl.excluded.length ? ' · ' + vl.excluded.length + ' dòng thuộc kỳ chỉ trùng một phần với kỳ lọc không được tính' : ''));
    } else h += nodata('Chưa có danh sách từng video trong kỳ lọc – cần để đếm số video và lượt xem trên mỗi video. Xuất ở Số liệu phân tích → Phân tích LIVE & video → Video → Chi tiết → Xuất.');

    // 5. LIVE
    h += '<h3>4. LIVE</h3>';
    var ll = c.ll, lp = p.ll;
    if (ll.n) {
      var lr = function (label, a, b, fmt, ratio) { return [label, lp.n ? fmt(a) : '—', fmt(b), lp.n ? chgCell(a, b, ratio) : '—']; };
      h += tbl(['Chỉ số (danh sách phiên LIVE)', { t: 'Kỳ trước', num: true }, { t: 'Kỳ này', num: true }, { t: 'Thay đổi', num: true }], [
        lr('Số phiên / ngày', lp.nDays ? lp.sessions / lp.nDays : null, ll.sessions / ll.nDays, function (x) { return num(x, 1); }),
        lr('Giờ LIVE / ngày', lp.nDays ? lp.hours / lp.nDays : null, ll.hours / ll.nDays, function (x) { return num(x, 1); }),
        lr('Giờ / phiên', lp.hoursPerSession, ll.hoursPerSession, function (x) { return num(x, 2); }),
        lr('Người xem / giờ', lp.viewersPerHour, ll.viewersPerHour, function (x) { return num(x, 0); }),
        lr('Lượt hiển thị sản phẩm / giờ', lp.imprPerHour, ll.imprPerHour, function (x) { return num(x, 0); }),
        lr('CTR (nhấp ÷ hiển thị)', lp.ctr, ll.ctr, function (x) { return M.fmtPct(x, 2); }, true),
        lr('Nhấp thành đơn', lp.cvr, ll.cvr, function (x) { return M.fmtPct(x, 2); }, true),
        lr('Giá trị đơn', lp.aov, ll.aov, money),
        lr('<b>GMV / giờ LIVE</b>', lp.gmvPerHour, ll.gmvPerHour, money),
        lr('GMV / phiên', lp.gmvPerSession, ll.gmvPerSession, money)]);
      if (gr.liveFunnel) h += '<p class="note">Ảnh hưởng tới GMV LIVE/ngày: ' + gr.liveFunnel.map(function (x) { return esc(x.label.toLowerCase()) + ' ' + signMoney(x.impact); }).join('; ') + '.</p>';
      h += '<h4>Theo khung giờ bắt đầu</h4>' + tbl(['Khung giờ', { t: 'Phiên', num: true }, { t: 'Giờ LIVE', num: true }, { t: 'GMV', num: true }, { t: 'GMV / giờ', num: true }, { t: 'Người xem / giờ', num: true }],
        ll.bySlot.filter(function (s) { return s.sessions; }).map(function (s) { return [s.label, num(s.sessions), num(s.hours, 1), money(s.gmv), money(s.gmvPerHour), num(s.viewersPerHour, 0)]; }));
      h += '<h4>Theo tài khoản LIVE</h4>' + tbl(['Tài khoản', { t: 'Phiên', num: true }, { t: 'Giờ', num: true }, { t: 'GMV', num: true }, { t: 'GMV / giờ', num: true }, { t: 'CTR', num: true }, { t: 'Nhấp thành đơn', num: true }],
        ll.byAccount.slice(0, 10).map(function (a) { return [esc(a.account), num(a.sessions), num(a.hours, 1), money(a.gmv), money(a.gmvPerHour), M.fmtPct(a.ctr, 2), M.fmtPct(a.cvr, 2)]; }));
      h += src('Nguồn: danh sách phiên LIVE ' + cov(ll.coverage) + ' · giờ LIVE cộng tất cả tài khoản, các phiên chạy song song được cộng dồn; phiên rất dài (trên 6 giờ) kéo giờ/phiên bình quân lên.');
    } else h += nodata('Chưa có danh sách từng phiên LIVE trong kỳ lọc – cần để biết LIVE giảm do ít giờ hơn hay do mỗi giờ ít người xem/ít đơn hơn. Xuất ở Số liệu phân tích → Phân tích LIVE & video → LIVE → Chi tiết → Xuất.');

    // 6. Liên kết
    var ac = ctx.cube._aff || [];
    var affRows = function (a, b) { return ac.filter(function (r) { return (!ctx.f.shop || r.shop === ctx.f.shop) && r.from >= a && r.to <= b; }); };
    var ra = affRows(c.from, c.to), rb = affRows(gr.prevFrom, gr.prevTo);
    if (ra.length) {
      var sum = function (rs, k) { var s = 0; rs.forEach(function (r) { if (typeof r[k] === 'number') s += r[k]; }); return s; };
      var fullMonth = function (r) { var e = r.to.split('-').map(Number); return r.from.slice(8) === '01' && r.from.slice(0, 7) === r.to.slice(0, 7) && e[2] === new Date(Date.UTC(e[0], e[1], 0)).getUTCDate(); };
      var aggr = function (rs) {
        var o = { gmv: sum(rs, 'gmv'), videos: sum(rs, 'videos'), lives: sum(rs, 'lives'), creators: sum(rs, 'creators'), days: 0, full: rs.every(fullMonth) };
        rs.forEach(function (r) { o.days += Math.round((Date.parse(r.to) - Date.parse(r.from)) / 864e5) + 1; });
        o.perContent = (o.videos + o.lives) > 0 ? o.gmv / (o.videos + o.lives) : null;
        o.gmvD = o.days ? o.gmv / o.days : null; o.contentD = o.days ? (o.videos + o.lives) / o.days : null; return o;
      };
      var A = aggr(ra), B = aggr(rb), hasB = rb.length > 0, crOk = A.full && (!hasB || B.full);
      h += '<h3>5. Liên kết (nhà sáng tạo)</h3>' + tbl(['Chỉ số', { t: 'Kỳ trước', num: true }, { t: 'Kỳ này', num: true }, { t: 'Thay đổi', num: true }], [
        ['GMV nhờ nhà sáng tạo / ngày', hasB ? sMoney(B.gmvD) : '—', sMoney(A.gmvD), hasB ? chgCell(B.gmvD, A.gmvD) : '—'],
        ['Video + buổi LIVE liên kết / ngày', hasB ? num(B.contentD, 0) : '—', num(A.contentD, 0), hasB ? chgCell(B.contentD, A.contentD) : '—'],
        ['GMV trên mỗi nội dung', hasB ? money(B.perContent) : '—', money(A.perContent), hasB ? chgCell(B.perContent, A.perContent) : '—'],
        ['Nhà sáng tạo có hoạt động', crOk && hasB ? num(B.creators) : '—', crOk ? num(A.creators) : '—', crOk && hasB ? chgCell(B.creators, A.creators) : '—']]);
      h += src('Nguồn: Liên kết – chỉ số cốt lõi (chỉ tính các kỳ nằm trọn trong kỳ lọc, quy về bình quân ngày).' + (crOk ? '' : ' Số nhà sáng tạo chỉ so được khi cả hai kỳ là file trọn tháng: file xuất khi tháng chưa hết, TikTok tự chuyển nhiều cột sang “trung bình mỗi ngày”.'));
    }

    // 7. Định mức quy đổi
    var nm = gr.norm;
    h += '<h3>6. Định mức quy đổi – mất bao nhiêu thì cần bù bao nhiêu</h3>';
    h += '<div class="form-row"><label>Số lượng<input id="grAmt" type="text" inputmode="numeric" value="20.000"></label><label>Đơn vị<select id="grUnit">' +
      '<option value="visitors">khách vào shop / ngày</option><option value="vv">lượt xem video / ngày</option><option value="vclicks">lượt nhấp sản phẩm từ video / ngày</option><option value="gmv">đồng GMV / ngày</option></select></label></div><div id="grOut"></div>';
    h += '<p class="note">Định mức lấy theo kỳ lọc (thiếu thì lấy kỳ trước): lượt xem mỗi video = ' + num(nm.vvPerVideo, 0) + ' (' + esc(nm.vvPerVideoSrc) + '); GMV/1.000 lượt xem = ' + money(nm.gmvPerView && nm.gmvPerView * 1000) +
      '; lượt nhấp/1.000 lượt xem = ' + num(nm.clicksPerView && nm.clicksPerView * 1000, 1) + '; khách thành đơn = ' + M.fmtPct(nm.v2o, 2) + '; giá trị đơn = ' + money(nm.aov) + '; GMV/giờ LIVE = ' + (nm.gmvPerHour ? money(nm.gmvPerHour) : 'chưa có (cần danh sách LIVE)') + '.</p>';

    // 8. Tình trạng tài khoản
    var hl = (ctx.cube.health || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h += '<h3>7. Tình trạng tài khoản shop</h3>';
    if (hl.length) {
      var okb = function (ok) { return ok == null ? '' : ok ? badge({ cls: 'good', icon: '✓', label: 'Đạt' }) : badge({ cls: 'bad', icon: '✗', label: 'Không đạt' }); };
      h += tbl(['Ngày ghi nhận', { t: 'Điểm', num: true }, { t: 'Gửi hàng muộn', num: true }, '', { t: 'Hài lòng qua chat', num: true }, '', { t: 'Vi phạm trong tháng', num: true }, { t: 'SP bị đóng băng', num: true }, 'Ghi chú'],
        hl.slice(0, 6).map(function (x) { return [M.fmtDate(x.date), num(x.score), M.fmtPct(x.late, 2), okb(x.late == null ? null : x.late <= M.healthTargets.late), M.fmtPct(x.chat, 2), okb(x.chat == null ? null : x.chat >= M.healthTargets.chat), num(x.violations), num(x.frozen), esc(x.note || '')]; }));
      h += src('Nguồn: Seller Center → Tình trạng tài khoản → Điểm tình trạng tài khoản (ghi nhận thủ công ở trang Cài đặt & chia sẻ). Mục tiêu theo TikTok: gửi hàng muộn ≤ 4%, hài lòng qua chat ≥ 70%.');
    } else h += nodata('Chưa ghi nhận tình trạng tài khoản. Vào Chia sẻ, sao lưu & cài đặt → “Tình trạng tài khoản shop” để nhập điểm, tỷ lệ gửi hàng muộn, hài lòng qua chat, số vi phạm.');
    host.innerHTML = h;

    // máy tính quy đổi
    var amt = host.querySelector('#grAmt'), unit = host.querySelector('#grUnit'), outEl = host.querySelector('#grOut');
    var calc = function () {
      var x = M.parseNum ? M.parseNum(amt.value) : Number(String(amt.value).replace(/\./g, '').replace(',', '.'));
      if (!isFinite(x) || x <= 0) { outEl.innerHTML = ''; return; }
      var u = unit.value, gmv = null, views = null, clicks = null, orders = null;
      if (u === 'visitors') { orders = nm.v2o ? x * nm.v2o : null; gmv = orders != null && nm.aov ? orders * nm.aov : null; views = gmv != null && nm.gmvPerView ? gmv / nm.gmvPerView : null; }
      else if (u === 'vv') { views = x; gmv = nm.gmvPerView ? x * nm.gmvPerView : null; clicks = nm.clicksPerView ? x * nm.clicksPerView : null; }
      else if (u === 'vclicks') { clicks = x; gmv = nm.gmvPerClick ? x * nm.gmvPerClick : null; views = nm.clicksPerView ? x / nm.clicksPerView : null; }
      else { gmv = x; views = nm.gmvPerView ? x / nm.gmvPerView : null; }
      var videos = views != null && nm.vvPerVideo ? views / nm.vvPerVideo : null, hours = gmv != null && nm.gmvPerHour ? gmv / nm.gmvPerHour : null;
      var rows = [];
      if (orders != null) rows.push(['Đơn hàng tương đương / ngày', num(orders, 0)]);
      rows.push(['GMV tương đương / ngày', gmv == null ? '—' : sMoney(gmv)]);
      if (clicks != null && u !== 'vclicks') rows.push(['Lượt nhấp sản phẩm từ video', num(clicks, 0)]);
      rows.push(['Bù bằng video: lượt xem cần thêm / ngày', views == null ? '—' : num(views, 0)]);
      rows.push(['Bù bằng video: số video cần thêm / ngày', videos == null ? '—' : num(videos, 1) + ' <span class="muted small">(≈ ' + num(videos * 30, 0) + ' video/tháng)</span>']);
      rows.push(['Bù bằng LIVE: số giờ LIVE cần thêm / ngày', hours == null ? '—' : num(hours, 1) + ' giờ']);
      outEl.innerHTML = tbl(['Quy đổi', { t: 'Kết quả', num: true }], rows);
    };
    if (amt && unit) { amt.addEventListener('input', calc); unit.addEventListener('change', calc); calc(); }
  };

  // ---------- BẢN TIN ĐIỀU HÀNH (chủ đầu tư): tiền đi đâu, vì sao tăng/giảm, cần quyết gì ----------
  /* Màu theo khoản (cố định trong mọi biểu đồ của bản tin): còn lại = xanh; hoàn tiền = cam; phí sàn & khuyến mãi = xanh ngọc;
     hoa hồng nhà sáng tạo = vàng; quảng cáo & booking = hồng; giá vốn = xanh lá; dòng tổng = xám. Thứ tự khối đúng thứ tự bảng màu đã kiểm tra mù màu. */
  var BR = { remain: 1, refund: 2, platform: 3, creator: 4, ads: 5, cogs: 6 };
  var BR_INK = { remain: '#fff', refund: '#fff', platform: '#fff', creator: '#0b0b0b', ads: '#fff', cogs: '#fff' };
  function brCol(k) { return k === 'total' ? 'var(--neutral-mark)' : 'var(--series-' + BR[k] + ')'; }
  function pts(a, b) { return a == null || b == null ? null : (b - a) * 100; }
  function brTrend(a, b) { var c = chg(a, b); return c == null ? '' : (c >= 0 ? 'tăng ' : 'giảm ') + num(Math.abs(c) * 100, 1) + '%'; }
  function brDelta(x, upGood, kind) { // kind: pct = % thay đổi; pts = điểm %; d100 = đồng trên 100 đồng
    if (x == null || !isFinite(x)) return '';
    var mag = kind === 'pct' ? Math.abs(x) * 100 : Math.abs(x), flat = mag < 0.05;
    var lab = (x >= 0 ? '+' : '−') + num(mag, 1) + (kind === 'pct' ? '%' : kind === 'pts' ? ' điểm' : ' đồng');
    return badge({ cls: flat ? 'na' : (x > 0) === upGood ? 'good' : 'bad', icon: flat ? '=' : x > 0 ? '▲' : '▼', label: flat ? 'Không đổi' : lab });
  }
  function brTile(label, value, delta, sub) {
    return '<div class="tile br-tile"><div class="tile-label">' + esc(label) + '</div><div class="tile-value">' + value + '</div>' +
      (delta ? '<div class="br-delta">' + delta + ' <span class="muted small">so với kỳ trước</span></div>' : '') + (sub ? '<div class="tile-sub">' + sub + '</div>' : '') + '</div>';
  }
  function brSec(title, lead) { return '<section class="br-sec"><h3>' + esc(title) + '</h3>' + (lead ? '<p class="br-lead">' + lead + '</p>' : ''); }
  function shortCov(c) { return c ? M.fmtDayMonth(c.from) + '–' + M.fmtDayMonth(c.to) : ''; }
  function p100(x) { return x == null || !isFinite(x) ? '—' : (x < 0 ? '−' : '') + num(Math.abs(x), 1); }
  function sgnMoney(x) { return x == null ? '—' : (x < 0 ? '−' : '') + money(Math.abs(x)); }
  function pctOrDash(x, d) { return x == null || !isFinite(x) ? '—' : M.fmtPct(x, d == null ? 1 : d); }

  /* Các dòng của báo cáo kết quả (dùng chung cho bảng, thác nước và thanh 100 đồng) */
  function brRows(pl) {
    if (!pl) return [];
    var r = [];
    if (pl.gross) { r.push({ id: 'gross', label: 'Tiền hàng khách đặt', note: 'đơn đã quyết toán, sau giảm giá của shop', val: pl.gross, kind: 'total' });
      r.push({ id: 'refund', label: 'Hoàn tiền cho khách', val: pl.refund, kind: 'step', col: 'refund' }); }
    r.push({ id: 'net', label: 'Doanh thu thuần', note: 'tiền hàng sau hoàn tiền', val: pl.net, kind: 'total' });
    r.push({ id: 'platform', label: 'Phí sàn TikTok', note: 'hoa hồng sàn, phí giao dịch, xử lý đơn, SFR, vận chuyển', val: pl.platform, kind: 'step', col: 'platform' });
    if (pl.promo) r.push({ id: 'promo', label: 'Phí chương trình khuyến mãi', note: 'Voucher Xtra, Flash Sale, ưu đãi LIVE…', val: pl.promo, kind: 'step', col: 'platform' });
    if (pl.otherFees) r.push({ id: 'otherFees', label: 'Phí khác của sàn', note: 'dòng phí chưa phân nhóm', val: pl.otherFees, kind: 'step', col: 'platform' });
    if (pl.adj) r.push({ id: 'adj', label: 'Bồi thường, điều chỉnh của sàn', val: pl.adj, kind: 'step', col: 'platform' });
    r.push({ id: 'creator', label: 'Hoa hồng nhà sáng tạo', note: 'KOL/KOC bán hộ qua liên kết', val: pl.creator, kind: 'step', col: 'creator' });
    if (pl.adsStl) r.push({ id: 'adsStl', label: 'Quảng cáo trừ thẳng vào tiền hàng', val: pl.adsStl, kind: 'step', col: 'ads' });
    r.push({ id: 'afterPlatform', label: 'Doanh thu sau phí sàn', val: pl.afterPlatform, kind: 'total' });
    r.push({ id: 'adCost', label: 'Quảng cáo TikTok', note: pl.adSrc === 'acct' ? 'tài khoản quảng cáo, gồm thuế nhà cung cấp tự thu' : pl.adSrc === 'campaign' ? 'tạm theo báo cáo chiến dịch, chưa gồm thuế' : 'chưa có dữ liệu', val: pl.adCost, kind: 'step', col: 'ads' });
    if (pl.bookingN) r.push({ id: 'booking', label: 'Booking nhà sáng tạo', note: 'danh sách nội bộ, ' + num(pl.bookingN) + ' lần', val: pl.booking, kind: 'step', col: 'ads' });
    r.push({ id: 'beforeCogs', label: 'Còn lại trước giá vốn', val: pl.beforeCogs, kind: 'total' });
    r.push({ id: 'cogs', label: 'Giá vốn hàng bán', note: pl.cogsMethod === 'actual' ? 'theo sổ kế toán' : pl.cogsMethod === 'rate' ? 'ước tính ' + M.fmtPct(pl.cogsRate, 1) + ' doanh thu thuần' : 'kế toán chưa nhập', val: pl.cogs, kind: 'step', col: 'cogs' });
    r.push({ id: 'contribution', label: 'Lãi đóng góp kênh TikTok', note: 'phần còn lại để trả chi phí chung và tạo lợi nhuận', val: pl.contribution, kind: 'result' });
    if (pl.opex != null) {
      r.push({ id: 'opex', label: 'Chi phí vận hành kênh', note: 'nhân sự, studio… theo sổ kế toán', val: pl.opex, kind: 'step', col: 'cogs' });
      r.push({ id: 'afterOpex', label: 'Lãi kênh sau chi phí trực tiếp', val: pl.afterOpex, kind: 'result' });
    }
    return r;
  }
  function brTable(pl, pv) {
    var rows = brRows(pl), pvRows = {}, max = 0, run = 0, broken = false;
    brRows(pv).forEach(function (x) { pvRows[x.id] = x.val; });
    rows.forEach(function (x) { if (x.val != null && Math.abs(x.val) > max) max = Math.abs(x.val); });
    var out = rows.map(function (x) {
      var bar = '';
      if (x.val == null) broken = true;
      if (!broken && max > 0) {
        var a, b, col;
        if (x.kind === 'step') { a = run; b = run + x.val; run = b; col = brCol(x.col); } else { a = 0; b = x.val; run = x.val; col = x.kind === 'result' ? brCol('remain') : brCol('total'); }
        var lo = Math.max(0, Math.min(a, b)), hi = Math.max(0, Math.max(a, b));
        bar = '<div class="wf-track" aria-hidden="true"><div class="wf-bar" style="left:' + (lo / max * 100).toFixed(2) + '%;width:' + Math.max(0.4, (hi - lo) / max * 100).toFixed(2) + '%;background:' + col + '"></div></div>';
      }
      var cur = M.per100(pl, x.val), prev = pv ? M.per100(pv, pvRows[x.id]) : null;
      var sign = x.kind === 'step' ? (x.val != null && x.val > 0 ? '+ ' : '− ') : x.kind === 'result' || x.id === 'net' || x.id === 'afterPlatform' || x.id === 'beforeCogs' ? '= ' : '';
      var label = '<span class="br-sign">' + sign + '</span>' + (x.kind === 'step' ? '<span class="sw-inline" style="background:' + brCol(x.col) + '"></span>' : '') + esc(x.label) + (x.note ? '<div class="tile-sub">' + esc(x.note) + '</div>' : '');
      return { cls: x.kind === 'step' ? 'br-step' : x.kind === 'result' ? 'br-result' : 'br-total',
        cells: [label, x.val == null ? '<span class="muted">' + M.NODATA + '</span>' : sgnMoney(x.val), x.id === 'gross' ? '100' : p100(cur), pv ? (x.id === 'gross' ? '100' : p100(prev)) : '—',
          x.id === 'gross' || cur == null || prev == null ? '' : brDelta(cur - prev, true, 'd100'), bar] };
    });
    var memo = [];
    if (pl.taxWithheld) memo.push([pl.taxWithheld < 0 ? 'Thuế do sàn khấu trừ thay' : 'Thuế sàn hoàn lại (khoản đã khấu trừ trước đây)', sgnMoney(pl.taxWithheld), 'không phải chi phí kinh doanh; theo dõi để đối chiếu với cơ quan thuế']);
    memo.push(['Tiền sàn đã trả về tài khoản', money(pl.settlement), '= doanh thu sau phí sàn' + (pl.taxWithheld < 0 ? ' − thuế khấu trừ thay' : pl.taxWithheld > 0 ? ' + thuế sàn hoàn lại' : '') + (pl.cashCheck === 0 ? ' · khớp' : ' · lệch ' + money(pl.cashCheck))]);
    return tbl(['Chỉ tiêu', { t: 'Số tiền (đ)', num: true }, { t: 'Trên 100 đồng', num: true }, { t: 'Kỳ trước', num: true }, { t: 'Thay đổi', num: true }, 'Minh họa'], out, { cls: 'br-pl' }) +
      '<div class="br-memo">' + memo.map(function (m) { return '<div><span>' + esc(m[0]) + '</span><strong>' + m[1] + '</strong><span class="muted small">' + esc(m[2]) + '</span></div>'; }).join('') + '</div>';
  }
  function brParts(pl) {
    var remain = pl.contribution != null ? pl.contribution : pl.beforeCogs != null ? pl.beforeCogs : pl.afterPlatform;
    var parts = [{ k: 'remain', label: pl.contribution != null ? 'Còn lại (lãi đóng góp)' : pl.beforeCogs != null ? 'Còn lại, chưa trừ giá vốn' : 'Còn lại sau phí sàn', value: remain }];
    if (pl.gross) parts.push({ k: 'refund', label: 'Hoàn tiền cho khách', value: -pl.refund });
    parts.push({ k: 'platform', label: 'Phí sàn và khuyến mãi', value: -(pl.platform + pl.promo + pl.otherFees + pl.adj) });
    parts.push({ k: 'creator', label: 'Hoa hồng nhà sáng tạo', value: -pl.creator });
    if (pl.adCost != null || pl.adsStl) parts.push({ k: 'ads', label: 'Quảng cáo và booking', value: -((pl.adCost || 0) + pl.adsStl + pl.booking) });
    if (pl.cogs != null && pl.contribution != null) parts.push({ k: 'cogs', label: 'Giá vốn hàng bán' + (pl.cogsMethod === 'rate' ? ' (ước tính)' : ''), value: -pl.cogs });
    return { remain: remain, parts: parts };
  }

  V.brief = function (host, ctx) {
    var b = M.brief(ctx), pl = b.pl, pv = b.plPrev, gr = b.gr, c = gr.cur, p = gr.prev, f = ctx.f, sp = ctx.shop;
    var h = '<div class="brief">';
    // 0. Đầu bản tin + độ phủ số liệu
    var chip = function (label, val, ok) { return '<span class="chip' + (ok ? '' : ' miss') + '">' + esc(label) + ': <b>' + val + '</b></span>'; };
    h += '<header class="brief-head"><div><div class="eyebrow">Bản tin điều hành · kênh TikTok Shop</div><h2>Kỳ ' + M.fmtPeriod(f.from, f.to) + '</h2><div class="small muted">' + esc(ctx.shopLabel) + ' · so với kỳ trước ' + M.fmtPeriod(b.prevFrom, b.prevTo) + '</div></div>' +
      '<div class="chips" aria-label="Độ phủ số liệu">' + chip('Doanh số', sp.n ? shortCov(sp.coverage) : 'chưa có', sp.n) + chip('Quyết toán', pl ? shortCov(pl.coverage) : 'chưa có', !!pl) +
      chip('Quảng cáo', pl && pl.adCov ? shortCov(pl.adCov) : 'chưa có', !!(pl && pl.adSrc === 'acct')) +
      chip('Giá vốn', !pl ? '—' : pl.cogsMethod === 'actual' ? 'theo sổ' : pl.cogsMethod === 'rate' ? 'ước tính' : 'chưa nhập', !!(pl && pl.cogsMethod === 'actual')) +
      chip('Tình trạng shop', b.health ? M.fmtDayMonth(b.health.date) : 'chưa có', !!b.health) + '</div></header>';
    if (b.warn.length) h += '<div class="br-warn">' + b.warn.map(function (w) { return '<div><span aria-hidden="true">!</span> ' + esc(w) + '</div>'; }).join('') + '</div>';

    // 1. Tóm tắt 3 dòng
    var sm = [];
    if (gr.hasCur) sm.push('Doanh số đặt hàng bình quân <b>' + sMoney(c.gmvD) + '/ngày</b>' + (gr.hasPrev ? ', ' + brTrend(p.gmvD, c.gmvD) + ' so với kỳ trước (' + sMoney(p.gmvD) + '/ngày).' : '.'));
    var bp = pl ? brParts(pl) : null;
    if (pl && bp.remain != null) {
      var same = pv && (pl.contribution != null ? pv.contribution : pl.beforeCogs != null ? pv.beforeCogs : pv.afterPlatform);
      sm.push('Trên 100 đồng tiền hàng khách đặt, công ty còn lại <b>' + p100(M.per100(pl, bp.remain)) + ' đồng</b> ' +
        (pl.contribution != null ? 'sau hoàn tiền, phí sàn, quảng cáo và giá vốn' + (pl.cogsMethod === 'rate' ? ' (giá vốn ước tính)' : '') : pl.beforeCogs != null ? 'sau hoàn tiền, phí sàn và quảng cáo, chưa trừ giá vốn' : 'sau hoàn tiền và phí sàn') +
        (same != null ? ' (kỳ trước ' + p100(M.per100(pv, same)) + ' đồng)' : '') + '.');
    }
    if (gr.funnel && gr.hasPrev) {
      var big = gr.funnel.slice().sort(function (x, y) { return Math.abs(y.impact) - Math.abs(x.impact); })[0];
      sm.push('Yếu tố tác động lớn nhất tới doanh số: <b>' + esc(M.BRIEF_FACTOR[big.key].toLowerCase()) + '</b> ' + brTrend(big.a, big.b) + ', tương đương ' + signMoney(big.impact) + '/ngày.');
    }
    if (sm.length) h += '<ul class="br-summary">' + sm.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';

    // 2. 100 đồng đi đâu
    if (pl) {
      var rem100 = M.per100(pl, bp.remain), prevRem = pv ? M.per100(pv, pl.contribution != null ? pv.contribution : pl.beforeCogs != null ? pv.beforeCogs : pv.afterPlatform) : null;
      h += '<section class="story"><div class="story-lead">Khách đặt <b>100 đồng</b> tiền hàng, công ty còn lại</div><div class="story-hero">' + p100(rem100) + ' <small>đồng</small></div>' +
        '<div class="story-sub">' + esc(bp.parts[0].label.toLowerCase()) + (prevRem != null ? ' · kỳ trước ' + p100(prevRem) + ' đồng ' + brDelta(rem100 - prevRem, true, 'd100') : '') + '</div>' +
        (bp.remain >= 0 ? '<div data-chart="br-seg"></div>' : '<p class="note">Các khoản chi lớn hơn tiền hàng: phần còn lại âm, không vẽ được dạng chia phần. Xem bảng kết quả bên dưới.</p>') +
        '<p class="small muted">Cơ sở: tiền hàng của các đơn TikTok đã quyết toán từ ' + M.fmtPeriod(pl.coverage.from, pl.coverage.to) + ' (' + money(pl.base) + '). Rê chuột hoặc chạm vào từng khối để xem số tiền.</p></section>';
    }

    // 3. Chỉ số chính
    var tiles = [];
    if (sp.n) tiles.push(brTile('Doanh số đặt hàng (GMV)', sMoney(sp.gmv), gr.hasPrev ? brDelta(chg(p.gmvD, c.gmvD), true, 'pct') : '', 'bình quân ' + sMoney(c.gmvD) + '/ngày · gồm cả đơn sẽ hủy, hoàn'));
    if (pl) {
      var nd = function (q) { return q.days ? q.net / q.days : null; };
      tiles.push(brTile('Doanh thu thuần', sMoney(pl.net), pv ? brDelta(chg(nd(pv), nd(pl)), true, 'pct') : '', 'sau hoàn tiền · ' + sMoney(nd(pl)) + '/ngày quyết toán'));
      tiles.push(brTile('Tiền sàn đã trả về', sMoney(pl.settlement), pv ? brDelta(pts(pv.keepRate, pl.keepRate), true, 'pts') : '', pctOrDash(pl.keepRate) + ' doanh thu thuần'));
      tiles.push(brTile('Phí sàn, khuyến mãi, hoa hồng', sMoney(-pl.fees), pv ? brDelta(pts(pv.feeRate, pl.feeRate), false, 'pts') : '', pctOrDash(pl.feeRate) + ' doanh thu thuần'));
      tiles.push(brTile('Quảng cáo và booking', pl.adCost == null ? M.NODATA : sMoney(-(pl.adCost + pl.booking)), pv && pl.adRate != null ? brDelta(pts(pv.adRate, pl.adRate), false, 'pts') : '', pl.adRate == null ? 'cần file Chi phí của Business Center' : pctOrDash(pl.adRate) + ' doanh thu thuần'));
      tiles.push(brTile('Lãi đóng góp', pl.contribution == null ? (pl.adCost == null ? M.NODATA : 'Chưa có giá vốn') : sgnMoney(pl.contribution), pv && pl.margin != null && pv.margin != null ? brDelta(pts(pv.margin, pl.margin), true, 'pts') : '',
        pl.contribution == null ? (pl.beforeCogs != null ? 'trước giá vốn còn ' + sMoney(pl.beforeCogs) + ' (' + pctOrDash(pl.marginBefore) + ')' : '') : 'biên ' + pctOrDash(pl.margin) + ' doanh thu thuần' + (pl.cogsMethod === 'rate' ? ' · giá vốn ước tính' : '')));
    }
    if (tiles.length) h += brSec('Các con số chính', 'Mũi tên xanh là biến động tốt cho công ty, đỏ là biến động xấu (với chi phí: tăng là xấu).') + '<div class="tiles br-tiles">' + tiles.join('') + '</div></section>';

    // 4. Báo cáo kết quả kinh doanh (kế toán quản trị)
    if (pl) {
      h += brSec('Kết quả kinh doanh kênh TikTok', 'Đi từ tiền hàng khách đặt đến lãi đóng góp. Cột “Trên 100 đồng” giúp so sánh giữa các kỳ có độ dài khác nhau; thanh minh họa cho thấy mỗi khoản lấy đi bao nhiêu.') +
        '<div class="legend"><span><b class="sw" style="background:' + brCol('total') + '"></b>Dòng tổng</span><span><b class="sw" style="background:' + brCol('refund') + '"></b>Hoàn tiền</span><span><b class="sw" style="background:' + brCol('platform') + '"></b>Phí sàn, khuyến mãi</span><span><b class="sw" style="background:' + brCol('creator') + '"></b>Hoa hồng nhà sáng tạo</span><span><b class="sw" style="background:' + brCol('ads') + '"></b>Quảng cáo, booking</span><span><b class="sw" style="background:' + brCol('cogs') + '"></b>Giá vốn, vận hành</span><span><b class="sw" style="background:' + brCol('remain') + '"></b>Lãi</span></div>' +
        brTable(pl, pv) + src('Doanh thu và phí theo ngày quyết toán (tiền đã về), không theo ngày đặt đơn. Kỳ trước: ' + (pv ? M.fmtPeriod(pv.coverage.from, pv.coverage.to) : 'chưa có báo cáo quyết toán') + '.') + '</section>';
    } else h += nodata('Chưa có báo cáo quyết toán trong kỳ lọc – nhập file income_….xlsx (Tài chính → Giao dịch → Đã quyết toán → Xuất) để lập kết quả kinh doanh.');

    // 5. Doanh số tăng/giảm vì đâu
    if (gr.hasCur && gr.hasPrev && gr.funnel) {
      h += brSec('Doanh số tăng hay giảm vì đâu', 'Doanh số mỗi ngày = lượt hiển thị sản phẩm × tỷ lệ bấm vào × tỷ lệ chốt đơn × giá trị mỗi đơn. Doanh số/ngày thay đổi <b>' + signMoney(gr.gmvDelta) + '</b>; các thanh dưới đây tách phần thay đổi đó theo từng yếu tố (cộng lại đúng bằng tổng).') +
        '<div data-chart="br-funnel"></div>';
      if (gr.channels) h += '<h4>Theo kênh bán (doanh số/ngày)</h4><div data-chart="br-ch"></div>';
      h += src('Nguồn: Phân tích shop, kỳ này ' + cov(sp.coverage) + ', kỳ trước ' + M.fmtPeriod(gr.prevFrom, gr.prevTo) + ' · tách theo phương pháp logarit (LMDI).') + '</section>';
    } else if (gr.hasCur) h += brSec('Doanh số tăng hay giảm vì đâu') + '<p class="note">Chưa có Phân tích shop của kỳ trước (' + M.fmtPeriod(gr.prevFrom, gr.prevTo) + ') để so sánh.</p></section>';

    // 6. Nội dung và kênh bán
    if (sp.n) {
      // danh sách video / LIVE phủ dưới 7 ngày thì chưa đủ để so sánh giữa các kỳ (một ngày lẻ dao động rất mạnh)
      var vl = c.vl, pvl = p.vl, ll = c.ll, pll = p.ll, ct = [], vOk = vl.nDays >= 7 && pvl.nDays >= 7, lOk = ll.nDays >= 7 && pll.nDays >= 7;
      var few = function (n) { return 'danh sách mới có ' + num(n) + ' ngày – chưa đủ 7 ngày để so sánh'; };
      if (vl.n) {
        ct.push(brTile('Video mới đăng / ngày', num(vl.newPerDay, 1), vOk ? brDelta(chg(pvl.newPerDay, vl.newPerDay), true, 'pct') : '', vl.nDays >= 7 ? num(vl.newVideos) + ' video mới trong ' + num(vl.nDays) + ' ngày' : few(vl.nDays)));
        ct.push(brTile('Lượt xem trung vị mỗi video mới', num(vl.medianVVNew, 0), vOk ? brDelta(chg(pvl.medianVVNew, vl.medianVVNew), true, 'pct') : '', 'định mức quy chế 20.000 lượt/video'));
        ct.push(brTile('Doanh số trên 1.000 lượt xem video', money(vl.gpm), vOk ? brDelta(chg(pvl.gpm, vl.gpm), true, 'pct') : '', num(vl.withGmv) + '/' + num(vl.videos) + ' video có doanh số'));
      }
      if (ll.n) {
        ct.push(brTile('Giờ LIVE / ngày', num(ll.hours / ll.nDays, 1), lOk ? brDelta(chg(pll.hours / pll.nDays, ll.hours / ll.nDays), true, 'pct') : '', ll.nDays >= 7 ? num(ll.sessions) + ' phiên · ' + num(ll.nDays) + ' ngày có LIVE' : few(ll.nDays)));
        ct.push(brTile('Doanh số mỗi giờ LIVE', sMoney(ll.gmvPerHour), lOk ? brDelta(chg(pll.gmvPerHour, ll.gmvPerHour), true, 'pct') : '', num(ll.viewersPerHour, 0) + ' người xem/giờ'));
      }
      h += brSec('Nội dung và kênh bán', 'Cơ cấu doanh số theo kênh trong kỳ và năng suất của đội nội dung: mỗi video, mỗi giờ LIVE mang về bao nhiêu.') + '<div data-chart="br-mix"></div>';
      if (ct.length) h += '<div class="tiles br-tiles">' + ct.join('') + '</div>';
      else h += '<p class="note">Chưa có danh sách từng video / từng phiên LIVE trong kỳ để tính năng suất nội dung.</p>';
      var worstF = gr.funnel ? gr.funnel.slice().sort(function (x, y) { return x.impact - y.impact; })[0] : null;
      if (b.gap && worstF && worstF.key !== 'impr' && worstF.impact < 0) {
        var imprF = gr.funnel.filter(function (x) { return x.key === 'impr'; })[0];
        h += '<div class="br-gap"><strong>Doanh số giảm ' + sMoney(b.gap.gmv) + '/ngày chủ yếu do ' + esc(M.BRIEF_FACTOR[worstF.key].toLowerCase()) + ' (' + brTrend(worstF.a, worstF.b) + ')</strong>' +
          (imprF && imprF.impact > 0 ? ', trong khi lượt hiển thị sản phẩm vẫn ' + brTrend(imprF.a, imprF.b) : '') + '. Tăng thêm video hay giờ LIVE không bù được phần này nếu khách vào xem vẫn không mua; cần xử lý ' +
          { ctr: 'hình ảnh, tiêu đề, giá hiển thị và đoạn mở đầu nội dung', c2o: 'giá bán, khuyến mãi, đánh giá sản phẩm, hết hàng và tình trạng tài khoản', aov: 'combo, quà tặng và ngưỡng miễn phí vận chuyển' }[worstF.key] + ' trước.</div>';
      } else if (b.gap && (b.gap.videos || b.gap.hours)) {
        var nm = b.gap.norm;
        h += '<div class="br-gap"><strong>Muốn lấy lại ' + sMoney(b.gap.gmv) + ' doanh số/ngày đã giảm</strong>, theo hiệu suất hiện tại cần thêm khoảng ' +
          (b.gap.videos ? '<b>' + num(b.gap.videos, 0) + ' video mới mỗi ngày</b> (' + num(nm.vvPerVideo, 0) + ' lượt xem/video, ' + money(nm.gmvPerView * 1000) + ' trên 1.000 lượt xem)' : '') + (b.gap.videos && b.gap.hours ? ' hoặc ' : '') +
          (b.gap.hours ? '<b>' + num(b.gap.hours, 1) + ' giờ LIVE mỗi ngày</b> (' + sMoney(nm.gmvPerHour) + '/giờ)' : '') + '. Đây là quy đổi theo bình quân để định lượng, không phải dự báo.</div>';
      }
      h += '</section>';
    }

    // 7. Chất lượng doanh thu và vận hành
    var hs = b.health, hp = b.healthPrev, q = [], okB = function (ok) { return ok == null ? '' : ok ? badge({ cls: 'good', icon: '✓', label: 'Đạt' }) : badge({ cls: 'bad', icon: '✗', label: 'Không đạt' }); };
    var o1 = b.ord, o0 = b.ordPrev;
    if (pl) q.push(['Hoàn tiền / tiền hàng (quyết toán)', pv ? pctOrDash(pv.refundRate) : '—', pctOrDash(pl.refundRate), '', pv ? brDelta(pts(pv.refundRate, pl.refundRate), false, 'pts') : '']);
    if (o1.cancelRateCount != null) q.push(['Đơn bị hủy / tổng đơn', o0.cancelRateCount != null ? pctOrDash(o0.cancelRateCount) : '—', pctOrDash(o1.cancelRateCount), '', o0.cancelRateCount != null ? brDelta(pts(o0.cancelRateCount, o1.cancelRateCount), false, 'pts') : '']);
    if (ctx.ads.n && ctx.ads.roas != null) { var offT = ctx.official != null ? ctx.official : ctx.thresholds[0]; q.push(['ROAS quảng cáo (báo cáo chiến dịch, ' + shortCov(ctx.ads.coverage) + ')', '—', num(ctx.ads.roas, 2), '≥ ' + tf(offT), okB(ctx.ads.roas >= offT)]); }
    if (hs) {
      if (hs.late != null) q.push(['Gửi hàng muộn', hp && hp !== hs && hp.late != null ? pctOrDash(hp.late, 2) : '—', pctOrDash(hs.late, 2), '≤ 4%', okB(hs.late <= M.healthTargets.late)]);
      if (hs.chat != null) q.push(['Hài lòng qua chat', hp && hp !== hs && hp.chat != null ? pctOrDash(hp.chat, 2) : '—', pctOrDash(hs.chat, 2), '≥ 70%', okB(hs.chat >= M.healthTargets.chat)]);
      if (hs.score != null) q.push(['Điểm tình trạng tài khoản', hp && hp !== hs && hp.score != null ? num(hp.score) : '—', num(hs.score), '', '']);
      if (hs.violations != null) q.push(['Vi phạm trong tháng', hp && hp !== hs && hp.violations != null ? num(hp.violations) : '—', num(hs.violations), '', '']);
      if (hs.frozen != null) q.push(['Sản phẩm bị đóng băng', hp && hp !== hs && hp.frozen != null ? num(hp.frozen) : '—', num(hs.frozen), '0', okB(!(hs.frozen > 0))]);
    }
    if (q.length) h += brSec('Chất lượng doanh thu và vận hành', 'Các chỉ số làm doanh thu “rò rỉ” sau khi đã bán và các chỉ số TikTok dùng để quyết định có tiếp tục đẩy hiển thị cho shop hay không.') +
      tbl(['Chỉ số', { t: 'Kỳ trước', num: true }, { t: 'Kỳ này', num: true }, { t: 'Yêu cầu', num: true }, 'Đánh giá'], q) +
      src((hs ? 'Tình trạng tài khoản ghi nhận ngày ' + M.fmtDate(hs.date) + ' (Seller Center → Tình trạng tài khoản). ' : '') + 'Hủy đơn theo file Đơn hàng; hoàn tiền theo báo cáo quyết toán.') + '</section>';

    // 8. Xu hướng theo tháng
    if (b.months.length > 1) h += brSec('Xu hướng doanh số theo tháng', 'Doanh số đặt hàng bình quân mỗi ngày (chia cho số ngày có số liệu để so được tháng chưa hết). Cột xanh là tháng trong kỳ đang xem.') +
      '<div class="chart" data-chart="br-trend"></div><div class="legend"><span><b class="sw" style="background:var(--series-1)"></b>Tháng trong kỳ xem</span><span><b class="sw" style="background:var(--neutral-mark)"></b>Tháng khác</span><span>Cột nhạt: tháng chưa đủ ngày số liệu</span></div></section>';

    // 9. Việc cần quyết định
    if (b.decisions.length) h += brSec('Việc cần quyết định') + '<ol class="br-dec">' + b.decisions.map(function (d) {
      var ic = d.k === 'bad' ? '✗' : d.k === 'warn' ? '!' : 'i';
      return '<li class="cm-' + d.k + '"><span class="cm-ic" aria-hidden="true">' + ic + '</span><span>' + esc(d.t) + '</span></li>';
    }).join('') + '</ol></section>';

    // 10. Cách đọc và đối chiếu
    var chk = [];
    if (pl) {
      var ok0 = function (x) { return x == null ? '<span class="muted">không kiểm được</span>' : x === 0 ? badge({ cls: 'good', icon: '✓', label: 'Khớp' }) : badge({ cls: 'bad', icon: '✗', label: 'Lệch ' + money(x) }); };
      chk.push(['Tiền hàng − hoàn tiền = doanh thu thuần', ok0(pl.revDiff)]);
      chk.push(['Tổng các dòng phí = tổng phí trên báo cáo quyết toán', ok0(pl.feeLinesDiff)]);
      chk.push(['Doanh thu thuần + phí + điều chỉnh = tiền sàn trả về', ok0(pl.calcDiff)]);
      chk.push(['Doanh thu sau phí sàn − thuế khấu trừ thay = tiền sàn trả về', ok0(pl.cashCheck)]);
    }
    h += '<details class="card br-notes"><summary><strong>Cách đọc số liệu và đối chiếu</strong></summary>' +
      '<dl class="br-gloss"><dt>Doanh số đặt hàng (GMV)</dt><dd>Giá trị đơn khách đặt theo Phân tích shop, gồm cả đơn sau đó bị hủy hoặc hoàn. Dùng để đo sức bán, không phải doanh thu kế toán.</dd>' +
      '<dt>Doanh thu thuần</dt><dd>Tiền hàng của đơn đã quyết toán trừ phần hoàn cho khách, theo báo cáo quyết toán của TikTok.</dd>' +
      '<dt>Lãi đóng góp</dt><dd>Doanh thu thuần trừ phí sàn, hoa hồng, quảng cáo, booking và giá vốn. Đây là phần kênh TikTok đóng góp để trả chi phí chung của công ty; chưa phải lợi nhuận kế toán.</dd>' +
      '<dt>Điểm</dt><dd>Chênh lệch giữa hai tỷ lệ phần trăm (vd. từ 20% lên 22% là tăng 2 điểm).</dd>' +
      '<dt>Lệch thời điểm</dt><dd>Quảng cáo ghi nhận theo ngày chạy, doanh thu theo ngày TikTok quyết toán (thường sau ngày giao hàng 7–14 ngày), nên tỷ lệ quảng cáo/doanh thu của từng tháng có độ trễ.</dd>' +
      '<dt>Phần mềm quản lý bán hàng</dt><dd>Mục “lời/lỗ” trên các phần mềm quản lý đơn chỉ đúng khi đã khai giá vốn cho từng SKU; nếu giá vốn để 0 thì “lời” bằng doanh thu sau phí sàn.</dd></dl>' +
      (chk.length ? '<h4>Đối chiếu nội bộ</h4>' + tbl(['Phép kiểm', 'Kết quả'], chk) : '') +
      '<h4>Nguồn số liệu</h4>' + tbl(['Nguồn', 'Kỳ có số liệu', 'Dùng cho'], [
        ['Phân tích shop (Seller Center)', sp.n ? cov(sp.coverage) : M.NODATA, 'doanh số, phễu bán hàng, kênh bán, xu hướng'],
        ['Báo cáo quyết toán (income_….xlsx, sheet Báo cáo)', pl ? cov(pl.coverage) : M.NODATA, 'doanh thu, hoàn tiền, từng loại phí, tiền về'],
        ['Chi phí tài khoản quảng cáo (Business Center)', pl && pl.adSrc === 'acct' ? cov(pl.adCov) : M.NODATA, 'chi phí quảng cáo gồm thuế nhà cung cấp tự thu'],
        ['Booking nhà sáng tạo (danh sách nội bộ)', pl && pl.bookingN ? num(pl.bookingN) + ' lần' : 'không có', 'phí booking'],
        ['Giá vốn, chi phí kênh (kế toán nhập)', pl && pl.mgmt.coverage ? cov(pl.mgmt.coverage) : pl && pl.cogsMethod === 'rate' ? 'tỷ lệ ước tính ' + M.fmtPct(pl.cogsRate, 1) : 'chưa nhập', 'giá vốn hàng bán, chi phí vận hành kênh'],
        ['Danh sách video / phiên LIVE', (c.vl.n ? 'video ' + cov(c.vl.coverage) : '') + (c.vl.n && c.ll.n ? '; ' : '') + (c.ll.n ? 'LIVE ' + cov(c.ll.coverage) : '') || 'chưa có', 'năng suất nội dung'],
        ['Tình trạng tài khoản (ghi nhận thủ công)', hs ? M.fmtDate(hs.date) : 'chưa có', 'gửi hàng muộn, hài lòng chat, vi phạm']]) + '</details>';
    h += '</div>';
    host.innerHTML = h;

    // vẽ biểu đồ
    var se = host.querySelector('[data-chart="br-seg"]');
    if (se) C.segbar(se, { title: 'Khách đặt 100 đồng tiền hàng đi đâu', fmt: money, shareName: 'trên 100 đồng:', pct: function (x) { return num(x * 100, x * 100 < 9.95 ? 1 : 0) + ' đ'; },
      parts: bp.parts.map(function (x) { return { label: x.label, value: x.value, color: brCol(x.k), ink: BR_INK[x.k] }; }) });
    var fe = host.querySelector('[data-chart="br-funnel"]');
    if (fe) {
      var fmts = { impr: function (x) { return num(x, 0); }, ctr: function (x) { return M.fmtPct(x, 2); }, c2o: function (x) { return M.fmtPct(x, 2); }, aov: money };
      C.divbars(fe, { title: 'Ảnh hưởng của từng yếu tố tới doanh số mỗi ngày', items: gr.funnel.map(function (x) { return { label: M.BRIEF_FACTOR[x.key], sub: fmts[x.key](x.a) + ' → ' + fmts[x.key](x.b) + ' (' + brTrend(x.a, x.b) + ')', value: x.impact, valueText: (x.impact >= 0 ? '+' : '−') + sMoney(Math.abs(x.impact)) + '/ngày' }; }), negLabel: 'Làm doanh số giảm', posLabel: 'Làm doanh số tăng' });
    }
    var che = host.querySelector('[data-chart="br-ch"]');
    if (che) C.divbars(che, { title: 'Thay đổi doanh số mỗi ngày theo kênh', items: gr.channels.map(function (x) { return { label: x.label, sub: sMoney(x.a) + ' → ' + sMoney(x.b) + '/ngày', value: x.delta, valueText: (x.delta >= 0 ? '+' : '−') + sMoney(Math.abs(x.delta)) + '/ngày' }; }), negLabel: 'Giảm', posLabel: 'Tăng' });
    var me = host.querySelector('[data-chart="br-mix"]');
    if (me) C.hbars(me, { color: 'var(--series-1)', items: sp.channels.slice().sort(function (x, y) { return y.value - x.value; }).map(function (x) { return { label: x.label, value: x.value, valueText: sMoney(x.value) + ' · ' + pctOrDash(x.share, 0) }; }) });
    var te = host.querySelector('[data-chart="br-trend"]');
    if (te) C.columns(te, { name: 'Doanh số/ngày', x: b.months.map(function (m) { return m.month; }), values: b.months.map(function (m) { return m.gmvD; }),
      colors: b.months.map(function (m) { return m.inPeriod ? 'var(--series-1)' : 'var(--neutral-mark)'; }), yFmt: M.fmtCompact, tipFmt: sMoney, height: 210,
      xFmt: function (m) { return m.substr(5, 2) + '/' + m.substr(2, 2); }, tipTitle: function (m) { return 'Tháng ' + m.substr(5, 2) + '/' + m.substr(0, 4); },
      flags: b.months.map(function (m) { return !m.full; }), flagNote: 'Tháng chưa đủ ngày số liệu',
      extra: function (i) { var m = b.months[i]; return [{ name: 'doanh số cả tháng', value: sMoney(m.gmv) }, { name: 'ngày có số liệu', value: num(m.nDays) }]; } });
  };

  // ================= KHUNG TRANG BÁO CÁO DÙNG CHUNG =================
  /* Mỗi trang: câu hỏi trang trả lời → kết luận → thẻ chỉ số (kỳ này, kỳ trước, chênh lệch) → các khối đánh số → bảng dài thu gọn → thuật ngữ.
     Quy ước so sánh (báo cáo quản trị): số tiền, số lượng so theo bình quân ngày để kỳ dài ngắn khác nhau vẫn so được; tỷ lệ so bằng điểm %;
     mũi tên xanh = biến động tốt cho công ty, đỏ = xấu, xám = chỉ để theo dõi (vd chi phí quảng cáo tăng chưa chắc là xấu). */
  V.GLOSSARY = [
    ['GMV', 'Doanh số đặt hàng: tổng giá trị đơn khách đặt, gồm cả đơn sau đó hủy hoặc hoàn. Đo sức bán, chưa phải doanh thu kế toán.'],
    ['ROAS', 'Doanh thu quảng cáo mang về trên mỗi 1 đồng chi quảng cáo (doanh thu gộp ÷ chi phí). ROAS 12 nghĩa là chi 1 đồng, quảng cáo ghi nhận 12 đồng doanh số.'],
    ['CIR', 'Chi phí quảng cáo trên doanh thu quảng cáo (chi phí ÷ doanh thu gộp). Càng thấp càng tốt; CIR = 1 ÷ ROAS.'],
    ['AOV', 'Giá trị bình quân mỗi đơn hàng (doanh số ÷ số đơn).'],
    ['CTR', 'Tỷ lệ bấm: số lượt bấm vào sản phẩm ÷ số lượt sản phẩm được hiển thị.'],
    ['Đơn SKU', 'Số dòng sản phẩm trong đơn: một đơn có 2 sản phẩm khác nhau tính 2 đơn SKU.'],
    ['GMV Max', 'Quảng cáo tự động của TikTok Shop, tối ưu theo doanh số.'],
    ['LIVE', 'Phiên bán hàng phát trực tiếp.'],
    ['KOL', 'Nhà sáng tạo nội dung (KOL/KOC) đăng video, LIVE bán hộ sản phẩm.'],
    ['Liên kết', 'Bán hàng qua nhà sáng tạo (affiliate): nhà sáng tạo gắn sản phẩm vào nội dung của họ và nhận hoa hồng trên đơn.'],
    ['quyết toán', 'TikTok chốt tiền một đơn sau khi giao thành công, trừ phí rồi chuyển tiền về số dư shop.'],
    ['Doanh thu thuần', 'Tiền hàng của đơn đã quyết toán trừ phần hoàn cho khách.'],
    ['Lãi đóng góp', 'Doanh thu thuần trừ phí sàn, hoa hồng, quảng cáo, booking và giá vốn: phần kênh đóng góp để trả chi phí chung.'],
    ['điểm', 'Chênh lệch giữa hai tỷ lệ phần trăm: từ 20% lên 22% là tăng 2 điểm.'],
    ['Booking', 'Khoản thuê nhà sáng tạo làm video/LIVE, trả ngoài TikTok.'],
    ['Hoàn tiền', 'Tiền trả lại khách khi trả hàng, khiếu nại hoặc hủy sau thanh toán.'],
    ['Chốt đơn', 'Tỷ lệ người đã bấm vào sản phẩm rồi đặt mua.'],
    ['Lượt hiển thị', 'Số lần sản phẩm xuất hiện trước mắt người xem (trong video, LIVE, tìm kiếm, gian hàng).']
  ];
  function lcFirst(s) { s = String(s || ''); return /^[A-ZĐ]{2,}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1); }
  function ucFirst(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function prevF(ctx) { var p = M.prevPeriod(ctx.f.from, ctx.f.to); return { from: p.from, to: p.to, shop: ctx.f.shop, ent: ctx.f.ent }; }
  function covDays(c) { return c ? M.daysBetween(c.from, c.to) : 0; }
  function adsDays(s) { return s.byDay && s.byDay.length ? s.byDay.length : covDays(s.coverage); }
  function kDelta(k) {
    if (k.prevGap) return null;
    if (k.cur == null || k.prev == null || !isFinite(k.cur) || !isFinite(k.prev)) return null;
    if (k.kind === 'none') return null;
    if (k.kind === 'pct') return { x: (k.cur - k.prev) * 100, kind: 'pts' };
    var a = k.prev, b = k.cur;
    if (k.kind === 'flow') { if (!(k.prevDays > 0 && k.curDays > 0)) return null; a = a / k.prevDays; b = b / k.curDays; }
    return a > 0 ? { x: b / a - 1, kind: 'pct' } : null;
  }
  function kTile(k) {
    var d = kDelta(k), bd = '';
    if (d) bd = k.neutral ? badge({ cls: 'na', icon: d.x > 0 ? '▲' : d.x < 0 ? '▼' : '=', label: (d.x >= 0 ? '+' : '−') + num(Math.abs(d.kind === 'pct' ? d.x * 100 : d.x), 1) + (d.kind === 'pct' ? '%' : ' điểm') }) : brDelta(d.x, k.upGood !== false, d.kind);
    return '<div class="kp"><div class="kp-l">' + esc(k.label) + '</div><div class="kp-v">' + (k.cur == null || !isFinite(k.cur) ? '<span class="muted">' + M.NODATA + '</span>' : k.fmt(k.cur)) + '</div>' +
      '<div class="kp-d">' + bd + (d && k.kind === 'flow' ? ' <span class="kp-n">theo bình quân ngày</span>' : '') + '</div>' +
      '<div class="kp-p">Kỳ trước: ' + (k.prevGap ? '<span class="warn-t">' + esc(k.prevGap) + '</span>' : k.prev == null || !isFinite(k.prev) ? '—' : k.fmt(k.prev)) + '</div>' + (k.sub ? '<div class="kp-s">' + k.sub + '</div>' : '') + '</div>';
  }
  var fRoas = function (x) { return num(x, 2); }, fPct1 = function (x) { return M.fmtPct(x, 1); }, fPct2 = function (x) { return M.fmtPct(x, 2); }, fInt = function (x) { return num(x, 0); };
  var SPECS = {};
  SPECS.overview = function (ctx) {
    var s = ctx.ads, p = M.ads(ctx.cube, prevF(ctx)), th = ctx.thresholds, ref = ctx.official != null ? ctx.official : th[0];
    var t = ctx.targets.filter(function (x) { return x.t === ref; })[0];
    var msg = !s.n ? 'Kỳ này chưa có báo cáo quảng cáo nên chưa tính được ROAS.' : 'ROAS cả kỳ <b>' + num(s.roas, 2) + '</b> – ' + (s.roas >= ref ? 'đạt' : 'chưa đạt') + ' mốc ' + tf(ref) + (ctx.official == null ? ' (mốc tham khảo, chưa chọn mốc chính thức)' : '') +
      (t && t.shortfall > 0 ? '; với mức chi hiện tại còn thiếu <b>' + sMoney(t.shortfall) + '</b> doanh thu để đạt mốc' : '') + '.';
    // báo cáo chiến dịch chỉ đo được phần chi phí có báo cáo: so với chi phí thực tế trong file Cost
    var acC = ctx.rec.acct, acP = M.reconcile(ctx.cube, prevF(ctx), null).acct;
    var covC = s.n && acC.n && acC.amount > 0 ? s.cost / acC.amount : null, covP = p.n && acP.n && acP.amount > 0 ? p.cost / acP.amount : null;
    if (covC != null && covC < 0.8) msg += ' Lưu ý: báo cáo chiến dịch mới phủ <b>' + M.fmtPct(Math.min(1, covC), 0) + '</b> chi phí quảng cáo thực tế (file Cost ' + sMoney(acC.amount) + '), ROAS chỉ phản ánh phần chi phí này.';
    var gapP = covP != null && covP < 0.8 ? 'báo cáo chiến dịch chỉ phủ ' + M.fmtPct(Math.min(1, covP), 0) + ' chi phí' : (!p.n ? 'chưa có báo cáo' : null);
    var out = { prevCover: adsDays(p), title: 'Quảng cáo – hiệu quả ROAS', question: 'Tiền quảng cáo có mang về đủ doanh thu theo mục tiêu không?', message: msg, kpis: [
      { label: 'Chi phí quảng cáo', cur: s.n ? s.cost : null, prev: p.n ? p.cost : null, kind: 'flow', curDays: adsDays(s), prevDays: adsDays(p), fmt: sMoney, neutral: true },
      { label: 'Doanh thu gộp từ quảng cáo', cur: s.n ? s.rev : null, prev: p.n ? p.rev : null, kind: 'flow', curDays: adsDays(s), prevDays: adsDays(p), fmt: sMoney },
      { label: 'ROAS', cur: s.roas, prev: p.roas, kind: 'ratio', fmt: fRoas, sub: 'mốc ' + tf(ref) },
      { label: 'CIR (chi phí ÷ doanh thu)', cur: s.cir, prev: p.cir, kind: 'pct', upGood: false, fmt: fPct1 },
      { label: 'Chi phí trên mỗi đơn SKU', cur: s.cpo, prev: p.cpo, kind: 'ratio', upGood: false, fmt: money }] };
    if (gapP) out.kpis.forEach(function (k) { k.prevGap = gapP; k.ownPrev = 1; });
    out.covNote = covC != null && covC < 0.8 ? ' Báo cáo chiến dịch phủ ' + M.fmtPct(Math.min(1, covC), 0) + ' chi phí thực tế.' : '';
    return out;
  };
  SPECS.roas = function (ctx) {
    var o = SPECS.overview(ctx), s = ctx.ads, th = ctx.thresholds;
    o.title = 'Chiến dịch quảng cáo'; o.question = 'Chiến dịch nào đang kéo ROAS xuống và thiếu bao nhiêu doanh thu?';
    if (s.n && s.hasCampaign) {
      var rk = M.ranking(s, th, ctx.rankIndex), nC = s.byCampaign.filter(function (c) { return c.ent && c.cost > 0; }).length;
      o.message = (rk.length ? '<b>' + rk.length + '/' + nC + '</b> chiến dịch có chi phí đang dưới mốc ROAS ' + tf(th[ctx.rankIndex]) + '; thiếu nhiều nhất là <b>' + esc(rk[0].name) + '</b> (' + sMoney(rk[0].short[ctx.rankIndex]) + ').' : 'Mọi chiến dịch có chi phí đều đạt mốc ROAS ' + tf(th[ctx.rankIndex]) + '.') + (o.covNote || '');
    }
    return o;
  };
  SPECS.shop = function (ctx) {
    var sp = ctx.shop, p = M.shop(ctx.cube, prevF(ctx)), d1 = sp.byDay.length, d0 = p.byDay.length;
    var top = sp.channels.slice().sort(function (a, b) { return b.value - a.value; })[0];
    var conv = function (x) { return x.visitors > 0 ? x.orders / x.visitors : null; };
    var msg = !sp.n ? 'Kỳ này chưa có file Phân tích shop.' : 'Doanh số đặt hàng <b>' + sMoney(sp.gmv) + '</b> (' + sMoney(sp.gmv / d1) + '/ngày)' + (p.n ? ', ' + brTrend(p.gmv / d0, sp.gmv / d1) + ' so với kỳ trước' : '') +
      (top && top.value > 0 ? '; kênh lớn nhất là ' + esc(lcFirst(top.label)) + ' (' + M.fmtPct(top.share, 0) + ')' : '') + '.';
    return { prevCover: d0, title: 'Doanh số và khách hàng', question: 'Shop bán được bao nhiêu, qua kênh nào, xu hướng ra sao?', message: msg, kpis: [
      { label: 'Doanh số đặt hàng (GMV)', cur: sp.n ? sp.gmv : null, prev: p.n ? p.gmv : null, kind: 'flow', curDays: d1, prevDays: d0, fmt: sMoney },
      { label: 'Số đơn hàng', cur: sp.n ? sp.orders : null, prev: p.n ? p.orders : null, kind: 'flow', curDays: d1, prevDays: d0, fmt: fInt },
      { label: 'Giá trị mỗi đơn (AOV)', cur: sp.aov, prev: p.aov, kind: 'ratio', fmt: money },
      { label: 'Khách vào shop', cur: sp.n && sp.visitors ? sp.visitors : null, prev: p.n && p.visitors ? p.visitors : null, kind: 'flow', curDays: d1, prevDays: d0, fmt: fInt },
      { label: 'Tỷ lệ khách thành đơn', cur: conv(sp), prev: conv(p), kind: 'pct', fmt: fPct2 }] };
  };
  SPECS.growth = function (ctx) {
    var gr = M.growth(ctx.cube, ctx.f, 20000), c = gr.cur, p = gr.prev, msg;
    if (!gr.hasCur) msg = 'Kỳ này chưa có file Phân tích shop.';
    else if (!gr.funnel) msg = 'Chưa đủ số liệu hai kỳ để tách nguyên nhân tăng/giảm.';
    else {
      var big = gr.funnel.slice().sort(function (x, y) { return Math.abs(y.impact) - Math.abs(x.impact); })[0];
      msg = 'Doanh số/ngày ' + brTrend(p.gmvD, c.gmvD) + '; yếu tố tác động lớn nhất là <b>' + esc(M.BRIEF_FACTOR[big.key].toLowerCase()) + '</b> (' + brTrend(big.a, big.b) + ', ' + signMoney(big.impact) + '/ngày).';
    }
    return { prevCover: p.days, title: 'Nguồn tăng trưởng (cây chỉ số)', question: 'Doanh số tăng hay giảm do đâu, cần bao nhiêu nội dung để bù?', message: msg, kpis: [
      { label: 'Doanh số mỗi ngày', cur: c.gmvD, prev: p.gmvD, kind: 'ratio', fmt: sMoney },
      { label: 'Lượt hiển thị sản phẩm / ngày', cur: c.imprD, prev: p.imprD, kind: 'ratio', fmt: fInt },
      { label: 'Tỷ lệ bấm vào sản phẩm (CTR)', cur: c.ctr, prev: p.ctr, kind: 'pct', fmt: fPct2 },
      { label: 'Tỷ lệ chốt đơn', cur: c.c2o, prev: p.c2o, kind: 'pct', fmt: fPct2 },
      { label: 'Giá trị mỗi đơn', cur: c.aov, prev: p.aov, kind: 'ratio', fmt: money }] };
  };
  SPECS.content = function (ctx) {
    var cube = ctx.cube, pf = prevF(ctx), vl = M.videoList(cube, ctx.f), pvl = M.videoList(cube, pf), ll = M.liveList(cube, ctx.f), pll = M.liveList(cube, pf), aff = ctx.aff, paff = M.affiliate(cube, pf);
    var vOk = vl.nDays >= 7 && pvl.nDays >= 7, lOk = ll.nDays >= 7 && pll.nDays >= 7, parts = [];
    if (vl.n) parts.push('Video: ' + num(vl.newPerDay, 1) + ' video mới/ngày, trung vị ' + num(vl.medianVVNew, 0) + ' lượt xem mỗi video mới (định mức 20.000)');
    if (ll.n) parts.push('LIVE: ' + num(ll.hours / ll.nDays, 1) + ' giờ/ngày, ' + sMoney(ll.gmvPerHour) + ' mỗi giờ');
    if (aff.n) parts.push('nhà sáng tạo liên kết mang về ' + sMoney(aff.gmv));
    return { title: 'Nội dung và nhà sáng tạo', question: 'Video, LIVE và nhà sáng tạo đóng góp bao nhiêu, năng suất ra sao?', message: parts.length ? ucFirst(parts.join('; ')) + '.' : 'Kỳ này chưa có danh sách video, phiên LIVE hay số liệu liên kết.', kpis: [
      { label: 'Video mới đăng / ngày', cur: vl.n ? vl.newPerDay : null, prev: vOk ? pvl.newPerDay : null, kind: 'ratio', fmt: function (x) { return num(x, 1); } },
      { label: 'Lượt xem trung vị / video mới', cur: vl.n ? vl.medianVVNew : null, prev: vOk ? pvl.medianVVNew : null, kind: 'ratio', fmt: fInt, sub: 'định mức 20.000' },
      { label: 'Doanh số / 1.000 lượt xem video', cur: vl.n ? vl.gpm : null, prev: vOk ? pvl.gpm : null, kind: 'ratio', fmt: money },
      { label: 'Giờ LIVE / ngày', cur: ll.n ? ll.hours / ll.nDays : null, prev: lOk ? pll.hours / pll.nDays : null, kind: 'ratio', fmt: function (x) { return num(x, 1); } },
      { label: 'Doanh số / giờ LIVE', cur: ll.n ? ll.gmvPerHour : null, prev: lOk ? pll.gmvPerHour : null, kind: 'ratio', fmt: sMoney },
      { label: 'Doanh số qua nhà sáng tạo', cur: aff.n ? aff.gmv : null, prev: paff.n ? paff.gmv : null, kind: 'flow', curDays: covDays(aff.coverage), prevDays: covDays(paff.coverage), fmt: sMoney }] };
  };
  SPECS.adsctl = function (ctx) {
    var ac = ctx.ac, pf = prevF(ctx), prc = M.reconcile(ctx.cube, pf, null), sp = ctx.shop, psp = M.shop(ctx.cube, pf), tp = ctx.rec.topup;
    var msg = ac.costFile == null ? 'Kỳ này chưa có file Chi phí (Cost) của Business Center.' : 'Chi phí quảng cáo theo file Cost <b>' + sMoney(ac.costFile) + '</b>' +
      (ac.costToGmv != null ? ', bằng ' + M.fmtPct(ac.costToGmv, 1) + ' doanh số toàn shop' : '') + (ac.uncoveredShare != null ? '; ' + M.fmtPct(ac.uncoveredShare, 0) + ' chi phí chưa có báo cáo chiến dịch để đo hiệu quả' : '') + '.';
    var pCost = prc.acct.n ? prc.acct.amount : null;
    return { prevCover: covDays(prc.acct.coverage), title: 'Kiểm soát chi phí quảng cáo', question: 'Tiền quảng cáo đã chi có khớp giữa các nguồn và có báo cáo hiệu quả đi kèm không?', message: msg, kpis: [
      { label: 'Chi phí theo file Cost', cur: ac.costFile, prev: pCost, kind: 'flow', curDays: covDays(ac.costFileCov), prevDays: covDays(prc.acct.coverage), fmt: sMoney, neutral: true },
      { label: 'Chi phí quảng cáo / doanh số', cur: ac.costToGmv, prev: pCost != null && psp.gmv > 0 ? pCost / psp.gmv : null, kind: 'pct', upGood: false, fmt: fPct1 },
      { label: 'Chi phí có báo cáo chiến dịch', cur: ac.uncoveredShare != null ? 1 - ac.uncoveredShare : null, prev: null, kind: 'pct', fmt: function (x) { return M.fmtPct(x, 0); } },
      { label: 'ROAS theo báo cáo chiến dịch', cur: ac.roasCamp, prev: null, kind: 'ratio', fmt: fRoas },
      { label: 'Tiền thực trả TikTok (nạp + thẻ)', cur: tp.n ? tp.cashOut : null, prev: prc.topup.n ? prc.topup.cashOut : null, kind: 'none', fmt: sMoney, sub: 'nạp tiền theo đợt nên không so theo ngày' }] };
  };
  SPECS.acc = function (ctx) {
    var sr = ctx.stlr, pf = prevF(ctx), psr = M.settlementReport(ctx.cube, pf), o = ctx.orders, po = M.orders(ctx.cube, pf), t = sr.t || {}, pt = psr.t || {};
    var ok = sr.n && sr.calcDiff === 0 && sr.feeLinesDiff === 0 && (sr.revDiff == null || sr.revDiff === 0);
    var msg = !sr.n ? 'Kỳ này chưa có báo cáo quyết toán của TikTok.' : 'TikTok đã trả về <b>' + sMoney(t.settlement_total) + '</b>, bằng ' + M.fmtPct(sr.keepRate, 1) + ' tiền hàng; phí sàn và hoa hồng chiếm ' + M.fmtPct(sr.feeRate, 1) + ' doanh thu thuần; các phép đối chiếu nội bộ ' + (ok ? '<b>khớp</b>' : '<b>có chênh lệch</b> (xem mục C)') + '.';
    var d1 = covDays(sr.coverage), d0 = covDays(psr.coverage);
    return { prevCover: d0, title: 'Tài chính và đối chiếu', question: 'Doanh thu, phí sàn, tiền về có khớp giữa các nguồn không?', message: msg, kpis: [
      { label: 'Doanh thu thuần (quyết toán)', cur: sr.n ? t.revenue_total : null, prev: psr.n ? pt.revenue_total : null, kind: 'flow', curDays: d1, prevDays: d0, fmt: sMoney },
      { label: 'Tiền TikTok trả về', cur: sr.n ? t.settlement_total : null, prev: psr.n ? pt.settlement_total : null, kind: 'flow', curDays: d1, prevDays: d0, fmt: sMoney },
      { label: 'Phí sàn và hoa hồng / doanh thu thuần', cur: sr.feeRate, prev: psr.feeRate, kind: 'pct', upGood: false, fmt: fPct1 },
      { label: 'Hoàn tiền / tiền hàng', cur: sr.refundRate, prev: psr.refundRate, kind: 'pct', upGood: false, fmt: fPct1 },
      { label: 'Đơn bị hủy / tổng đơn', cur: o.cancelRateCount, prev: po.cancelRateCount, kind: 'pct', upGood: false, fmt: fPct1 }] };
  };
  V.SPECS = SPECS;

  /* Gắn khung trang cho nội dung đã vẽ trong host (chạy sau khi tab vẽ xong; không tính lại số liệu của tab) */
  V.decorate = function (host, ctx, tab) {
    if (!host || !ctx) return;
    var spec = null;
    try { spec = SPECS[tab] ? SPECS[tab](ctx) : null; } catch (e) { spec = null; if (window.console) console.error(e); }
    var f = ctx.f, pf = prevF(ctx);
    if (spec && spec.prevCover != null) {
      // kỳ trước thiếu quá 20% số ngày → không so sánh (tránh kết luận sai vì nguồn kỳ trước không đầy đủ)
      var plen = M.daysBetween(pf.from, pf.to);
      if (plen > 0 && spec.prevCover / plen < 0.8) spec.kpis.forEach(function (k) { if (!k.ownPrev) k.prevGap = spec.prevCover ? 'thiếu số liệu (' + spec.prevCover + '/' + plen + ' ngày)' : 'chưa có số liệu'; });
    }
    if (spec) {
      var fl = host.querySelector(':scope > .filterline'); if (fl) fl.remove();
      var head = document.createElement('header'); head.className = 'rp-head';
      head.innerHTML = '<div class="rp-top"><div><div class="rp-eyebrow">' + esc(spec.title) + ' · ' + esc(ctx.shopLabel) + (ctx.campLabel ? ' · ' + esc(ctx.campLabel) : '') + '</div>' +
        '<h2 class="rp-title">' + esc(spec.question) + '</h2>' +
        '<div class="rp-period">Kỳ này <b>' + M.fmtPeriod(f.from, f.to) + '</b> · so với kỳ trước ' + M.fmtPeriod(pf.from, pf.to) + '</div></div>' +
        '<button type="button" class="secondary rp-toggle">Mở tất cả bảng chi tiết</button></div>' +
        '<p class="rp-msg"><span class="rp-msg-k">Kết luận</span> ' + spec.message + '</p>' +
        (spec.kpis && spec.kpis.length ? '<div class="kps">' + spec.kpis.map(kTile).join('') + '</div><div class="rp-legend">Mũi tên xanh: tốt cho công ty · đỏ: xấu · xám: chỉ để theo dõi. Số tiền, số lượng so theo bình quân ngày; tỷ lệ so bằng điểm %.</div>' : '');
      host.insertBefore(head, host.firstChild);
      // chia nội dung thành các khối theo tiêu đề h3, đánh số
      var kids = Array.prototype.slice.call(host.childNodes).filter(function (n) { return n !== head; });
      var cur = null, n = 0, intro = null;
      kids.forEach(function (node) {
        if (node.nodeType === 1 && node.tagName === 'H3') {
          cur = document.createElement('section'); cur.className = 'rp-sec'; n++;
          var hd = document.createElement('div'); hd.className = 'rp-sec-head';
          var txt = node.textContent.trim(), lettered = /^([A-Z]\d*|\d+)[.)]\s/.test(txt);
          hd.innerHTML = (lettered ? '' : '<span class="rp-num">' + n + '</span>') + '<h3>' + node.innerHTML + '</h3>';
          cur.appendChild(hd); host.insertBefore(cur, node); node.remove(); return;
        }
        if (cur) cur.appendChild(node);
        else { if (!intro) { intro = document.createElement('section'); intro.className = 'rp-sec rp-intro'; host.insertBefore(intro, node); } intro.appendChild(node); }
      });
      // khối tóm tắt cũ trùng với thẻ chỉ số mới thì bỏ
      if (intro && spec.kpis && spec.kpis.length) Array.prototype.forEach.call(intro.querySelectorAll(':scope > .hero'), function (x) { x.remove(); });
      if (intro && !intro.textContent.trim() && !intro.querySelector('svg,input,table')) intro.remove();
      else if (intro && intro.querySelector('.tiles, .hero, table')) { var ih = document.createElement('div'); ih.className = 'rp-sec-head'; ih.innerHTML = '<h3>Tổng hợp số liệu kỳ này</h3>'; intro.insertBefore(ih, intro.firstChild); }
      // bảng dài: bảng đầu tiên của mỗi khối luôn hiện (trừ khi rất dài); các bảng phụ dài thu gọn, bấm để xem
      Array.prototype.slice.call(host.querySelectorAll('.rp-sec .tbl-wrap')).forEach(function (w) {
        if (w.closest('details') || w.closest('.manual')) return;
        var sec = w.closest('.rp-sec'), first = sec && sec.querySelector('.tbl-wrap') === w;
        var rows = w.querySelectorAll('tbody tr').length; if (rows <= (first ? 40 : 12)) return;
        var d = document.createElement('details'); d.className = 'more';
        d.innerHTML = '<summary>Xem bảng chi tiết · ' + num(rows) + ' dòng</summary>';
        w.parentNode.insertBefore(d, w); d.appendChild(w);
      });
      var tg = head.querySelector('.rp-toggle'), all = host.querySelectorAll('details.more');
      if (!all.length) tg.remove();
      else tg.addEventListener('click', function () { var open = tg.getAttribute('data-open') !== '1'; Array.prototype.forEach.call(host.querySelectorAll('details.more'), function (x) { x.open = open; }); tg.setAttribute('data-open', open ? '1' : '0'); tg.textContent = open ? 'Thu gọn bảng chi tiết' : 'Mở tất cả bảng chi tiết'; });
    }
    // thuật ngữ xuất hiện trên trang
    var text = host.textContent || '', used = V.GLOSSARY.filter(function (g) { return text.indexOf(g[0]) >= 0; });
    if (used.length) {
      var gl = document.createElement('details'); gl.className = 'card rp-gloss';
      gl.innerHTML = '<summary><strong>Giải thích thuật ngữ trên trang</strong> <span class="muted small">(' + used.length + ' thuật ngữ)</span></summary><dl>' + used.map(function (g) { return '<dt>' + esc(g[0]) + '</dt><dd>' + esc(g[1]) + '</dd>'; }).join('') + '</dl>';
      host.appendChild(gl);
    }
  };
  if (typeof window !== 'undefined' && !V._printHook) {
    V._printHook = 1;
    window.addEventListener('beforeprint', function () { Array.prototype.forEach.call(document.querySelectorAll('details.more, details.rp-gloss, details.br-notes'), function (d) { d.open = true; }); });
  }

  root.TTSV = V;
})(window);
