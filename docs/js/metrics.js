/* Tính toán chỉ tiêu – dùng chung cho ứng dụng, báo cáo HTML xuất và trang kiểm thử.
   Nguyên tắc: mọi tỷ lệ (ROAS, CIR, chi phí/đơn) tính lại từ SỐ TỔNG sau khi gộp ngày/shop/chiến dịch.
   Mẫu số bằng 0 → "Không xác định". Không phân bổ số liệu cấp kỳ xuống ngày/chiến dịch. */
(function (root) {
  'use strict';
  var M = {};
  M.UNDEF = 'Không xác định';
  M.NODATA = 'Chưa đủ dữ liệu';

  // ---------- Làm tròn & định dạng kiểu Việt Nam ----------
  M.round = function (x, d) {
    if (x == null || !isFinite(x)) return x;
    var m = Math.pow(10, d || 0), s = x < 0 ? -1 : 1;
    return s * Math.round(Number((Math.abs(x) * m).toPrecision(15))) / m;
  };
  M.fmtNum = function (x, d) {
    if (x == null || !isFinite(x)) return '—';
    d = d || 0;
    var r = M.round(x, d), neg = r < 0;
    var p = Math.abs(r).toFixed(d).split('.');
    var s = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] ? ',' + p[1] : '');
    return (neg && r !== 0 ? '-' : '') + s;
  };
  M.fmtMoney = function (x) { return x == null || !isFinite(x) ? '—' : M.fmtNum(x, 0) + ' đ'; };
  M.fmtCompact = function (x) {
    if (x == null || !isFinite(x)) return '—';
    var a = Math.abs(x);
    if (a >= 1e9) return M.fmtNum(x / 1e9, a >= 1e10 ? 1 : 2) + ' tỷ';
    if (a >= 1e6) return M.fmtNum(x / 1e6, a >= 1e8 ? 0 : 1) + ' tr';
    if (a >= 1e3) return M.fmtNum(x / 1e3, 0) + ' N';
    return M.fmtNum(x, 0);
  };
  M.fmtPct = function (x, d) { return x == null || !isFinite(x) ? M.UNDEF : M.fmtNum(x * 100, d == null ? 2 : d) + '%'; };
  /* ROAS 2 chữ số thập phân; nếu làm tròn khiến số hiển thị "chạm" mốc trong khi thực tế còn dưới mốc → hiện thêm chữ số */
  M.fmtRoas = function (x, th) {
    if (x == null || !isFinite(x)) return M.UNDEF;
    var d = 2;
    (th || []).forEach(function (t) {
      while (d < 6 && x < t && M.round(x, d) >= t) d++;
    });
    return M.fmtNum(x, d);
  };
  M.fmtDate = function (s) { if (!s) return '—'; var p = s.substr(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; };
  M.fmtDayMonth = function (s) { if (!s) return ''; var p = s.substr(0, 10).split('-'); return p[2] + '/' + p[1]; };
  M.fmtPeriod = function (a, b) { return a === b ? M.fmtDate(a) : M.fmtDate(a) + ' – ' + M.fmtDate(b); };

  // ---------- Ngày ----------
  M.addDays = function (s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return M.iso(d); };
  M.iso = function (d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; };
  M.daysBetween = function (a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5) + 1; };

  // ---------- Công thức cốt lõi ----------
  M.roas = function (cost, rev) { return cost > 0 ? rev / cost : null; };
  M.cir = function (cost, rev) { return rev > 0 ? cost / rev : null; };
  M.cpo = function (cost, sku) { return sku > 0 ? cost / sku : null; };
  /* Doanh thu còn thiếu tại mức chi hiện tại = MAX(0, mục tiêu × chi phí − doanh thu) */
  M.shortfall = function (t, cost, rev) {
    if (!(cost > 0)) return null;
    return Math.max(0, M.round(t * cost - rev, 0));
  };
  /* ROAS cần đạt trên khoản chi còn lại để CẢ KỲ đạt mục tiêu:
     (mục tiêu × (chi hiện tại + chi còn lại) − doanh thu hiện tại) / chi còn lại */
  M.requiredRoas = function (t, cost, rev, remaining) {
    if (!(remaining > 0)) return null;
    var need = t * (cost + remaining) - rev;
    return need <= 0 ? 0 : need / remaining;
  };
  M.band = function (roas, th) {
    th = (th || []).slice().sort(function (a, b) { return a - b; });
    if (roas == null || !isFinite(roas)) return { i: -1, cls: 'na', label: M.UNDEF, icon: '?' };
    var i = 0; while (i < th.length && roas >= th[i]) i++;
    var n = th.length, f = function (t) { return M.fmtNum(t, t % 1 ? 1 : 0); };
    if (n === 0) return { i: 0, cls: 'na', label: 'Chưa cấu hình mốc', icon: '?' };
    if (i === 0) return { i: 0, cls: 'bad', label: 'Dưới ' + f(th[0]), icon: '▼' };
    if (i === n) return { i: n, cls: 'good', label: 'Từ ' + f(th[n - 1]) + ' trở lên', icon: '▲' };
    return { i: i, cls: 'warn', label: 'Từ ' + f(th[i - 1]) + ' đến dưới ' + f(th[i]), icon: '■' };
  };

  // ---------- Cube ----------
  M.table = function (sec) {
    if (!sec || !sec.rows) return [];
    var c = sec.cols;
    return sec.rows.map(function (r) { var o = {}; for (var i = 0; i < c.length; i++) o[c[i]] = r[i]; return o; });
  };
  M.prepare = function (cube) {
    ['ads', 'acct', 'topup', 'inv', 'ord', 'stl', 'stlr', 'vid', 'aff', 'shop', 'booking', 'vlist', 'llist'].forEach(function (k) { cube['_' + k] = M.table(cube[k] || { cols: [], rows: [] }); });
    cube._shopName = {};
    (cube.shops || []).forEach(function (s) { cube._shopName[s.id] = s.name; });
    cube.thresholds = (cube.thresholds || [12, 13]).map(Number).sort(function (a, b) { return a - b; });
    return cube;
  };
  M.shopName = function (cube, id) { return (cube._shopName && cube._shopName[id]) || id; };

  /* Bao phủ: dòng cấp ngày thuộc kỳ lọc thì tính; dòng cấp kỳ chỉ tính khi NẰM TRỌN trong kỳ lọc
     (không tự chia nhỏ số liệu cấp kỳ). */
  function incl(r, f, excluded) {
    var a = r.from, b = r.to || r.from;
    if (b < f.from || a > f.to) return false;
    if (a >= f.from && b <= f.to) return true;
    excluded.push(r); return false;
  }
  function byShop(f) { return function (r) { return !f.shop || r.shop === f.shop; }; }
  function sum(arr, k) { var s = 0; for (var i = 0; i < arr.length; i++) { var v = arr[i][k]; if (typeof v === 'number') s += v; } return s; }
  function range(arr, fk, tk) {
    var a = null, b = null;
    arr.forEach(function (r) { var x = r[fk], y = r[tk || fk]; if (a == null || x < a) a = x; if (b == null || y > b) b = y; });
    return a ? { from: a, to: b } : null;
  }
  M.range = range;

  // ---------- Quảng cáo ----------
  M.ads = function (cube, f) {
    var th = cube.thresholds, ex = [], inc = [];
    cube._ads.filter(byShop(f)).forEach(function (r) { if (incl(r, f, ex)) inc.push(r); });
    var campaignsAll = {};
    inc.forEach(function (r) { if (r.ent) campaignsAll[r.ent] = r.name; });
    if (f.ent) inc = inc.filter(function (r) { return r.ent === f.ent; });
    var s = { rows: inc, excluded: ex, campaignsAll: campaignsAll };
    s.n = inc.length;
    s.cost = sum(inc, 'cost'); s.rev = sum(inc, 'rev');
    s.skuMissingRows = inc.filter(function (r) { return r.sku == null && (r.cost > 0 || r.rev > 0); }).length;
    s.sku = sum(inc, 'sku');
    s.roas = M.roas(s.cost, s.rev); s.cir = M.cir(s.cost, s.rev);
    s.cpo = s.skuMissingRows > 0 ? null : M.cpo(s.cost, s.sku);
    s.skuKnown = s.skuMissingRows === 0 && inc.length > 0;
    s.band = M.band(s.roas, th);
    s.coverage = range(inc, 'from', 'to');
    s.partialDays = {}; inc.forEach(function (r) { if (r.partial) s.partialDays[r.to] = 1; });
    s.partial = Object.keys(s.partialDays).sort();
    s.hasCampaign = inc.some(function (r) { return !!r.ent; });
    s.hasShopLevel = inc.some(function (r) { return !r.ent; });
    s.periodLevel = inc.filter(function (r) { return r.from !== r.to; });
    s.imports = {}; inc.forEach(function (r) { s.imports[r.imp] = 1; });
    // theo ngày (chỉ dòng cấp ngày)
    var day = {};
    inc.forEach(function (r) {
      if (r.from !== r.to) return;
      var d = day[r.from] || (day[r.from] = { date: r.from, cost: 0, rev: 0, sku: 0, skuMissing: 0, partial: 0 });
      d.cost += r.cost; d.rev += r.rev; if (r.sku == null) d.skuMissing++; else d.sku += r.sku; if (r.partial) d.partial = 1;
    });
    s.byDay = Object.keys(day).sort().map(function (k) {
      var d = day[k]; d.roas = M.roas(d.cost, d.rev); d.cir = M.cir(d.cost, d.rev); d.cpo = d.skuMissing ? null : M.cpo(d.cost, d.sku); return d;
    });
    // theo chiến dịch
    var camp = {};
    inc.forEach(function (r) {
      var k = r.ent || '';
      var c = camp[k] || (camp[k] = { ent: k, name: r.name, cost: 0, rev: 0, sku: 0, skuMissing: 0, partial: 0, shops: {}, days: {} });
      c.cost += r.cost; c.rev += r.rev; if (r.sku == null) c.skuMissing++; else c.sku += r.sku; if (r.partial) c.partial = 1; c.shops[r.shop] = 1; c.days[r.from] = 1;
    });
    s.byCampaign = Object.keys(camp).map(function (k) {
      var c = camp[k];
      c.roas = M.roas(c.cost, c.rev); c.cir = M.cir(c.cost, c.rev); c.cpo = c.skuMissing ? null : M.cpo(c.cost, c.sku);
      c.band = M.band(c.roas, th);
      c.short = th.map(function (t) { return M.shortfall(t, c.cost, c.rev); });
      return c;
    });
    // theo shop
    var sh = {};
    inc.forEach(function (r) {
      var c = sh[r.shop] || (sh[r.shop] = { shop: r.shop, cost: 0, rev: 0, sku: 0, skuMissing: 0, partial: 0 });
      c.cost += r.cost; c.rev += r.rev; if (r.sku == null) c.skuMissing++; else c.sku += r.sku; if (r.partial) c.partial = 1;
    });
    s.byShop = Object.keys(sh).map(function (k) {
      var c = sh[k]; c.roas = M.roas(c.cost, c.rev); c.cir = M.cir(c.cost, c.rev); c.cpo = c.skuMissing ? null : M.cpo(c.cost, c.sku); c.band = M.band(c.roas, th); return c;
    });
    return s;
  };

  /* Mục tiêu: với mỗi mốc → đạt hay chưa, doanh thu còn thiếu, ROAS cần đạt trên ngân sách còn lại */
  M.targets = function (s, th, official, remaining) {
    return th.map(function (t) {
      var o = { t: t, isOfficial: official != null && Number(official) === t };
      o.reached = s.roas != null ? s.roas >= t : null;
      o.gap = s.roas != null ? s.roas - t : null;
      o.shortfall = M.shortfall(t, s.cost, s.rev);
      o.required = M.requiredRoas(t, s.cost, s.rev, remaining);
      o.remaining = remaining;
      return o;
    });
  };

  /* Xếp hạng chiến dịch dưới mục tiêu theo số tiền doanh thu còn thiếu (giảm dần) */
  M.ranking = function (s, th, tIndex) {
    return s.byCampaign.filter(function (c) { return c.ent && c.cost > 0 && c.short[tIndex] > 0; })
      .sort(function (a, b) { return b.short[tIndex] - a.short[tIndex] || b.cost - a.cost; });
  };

  // ---------- Đơn hàng ----------
  M.orders = function (cube, f) {
    var rows = cube._ord.filter(byShop(f)).filter(function (r) { return r.date >= f.from && r.date <= f.to; });
    var keys = ['orders', 'skuLines', 'qty', 'orderAmt', 'skuAmt', 'cancelOrders', 'cancelAmt', 'retOrders', 'refundAmt', 'unpaidOrders', 'unpaidAmt', 'unknownOrders', 'multiSku', 'amtInconsistent', 'skuAmtCancelled', 'unknownAmt'];
    var o = { n: rows.length, coverage: range(rows, 'date') };
    keys.forEach(function (k) { o[k] = sum(rows, k); });
    o.hasStatus = rows.some(function (r) { return r.hasStatus; });
    o.hasOrderAmt = rows.some(function (r) { return r.hasOrderAmt; });
    o.hasRefund = rows.some(function (r) { return r.hasRefund; });
    o.hasSkuAmt = rows.some(function (r) { return r.hasSkuAmt; });
    o.partial = rows.some(function (r) { return r.partial; });
    var known = o.orders - o.unknownOrders;
    var knownAmt = o.orderAmt - o.unknownAmt;
    if (o.hasStatus && known > 0) {
      o.cancelRateCount = o.cancelOrders / known;
      var delivBase = known - o.cancelOrders - o.unpaidOrders;
      o.returnRateCount = delivBase > 0 ? o.retOrders / delivBase : null;
      o.returnBaseCount = delivBase;
    }
    if (o.hasStatus && o.hasOrderAmt && knownAmt > 0) {
      o.cancelRateValue = o.cancelAmt / knownAmt;
      var base = knownAmt - o.cancelAmt - o.unpaidAmt;
      o.returnBaseValue = base;
      if (o.hasRefund) {
        o.returnRateValue = base > 0 ? o.refundAmt / base : null;
        o.netSales = base - o.refundAmt;
      }
    }
    return o;
  };

  // ---------- Quyết toán ----------
  M.settlement = function (cube, f) {
    var rows = cube._stl.filter(byShop(f)).filter(function (r) { return r.date >= f.from && r.date <= f.to; });
    var o = { n: rows.length, coverage: range(rows, 'date'), count: sum(rows, 'count'), amount: sum(rows, 'amount'), revenue: sum(rows, 'revenue'), fees: sum(rows, 'fees') };
    o.hasRevenue = rows.some(function (r) { return r.hasRevenue; }); o.hasFees = rows.some(function (r) { return r.hasFees; });
    var bt = {};
    rows.forEach(function (r) { var k = r.type || '(không ghi loại)'; var b = bt[k] || (bt[k] = { type: k, count: 0, amount: 0, revenue: 0, fees: 0 }); b.count += r.count; b.amount += r.amount; b.revenue += r.revenue; b.fees += r.fees; });
    o.byType = Object.keys(bt).map(function (k) { return bt[k]; });
    return o;
  };

  // ---------- Quyết toán theo báo cáo tổng hợp của TikTok (sheet “Báo cáo”): tách từng loại phí ----------
  M.STLR_GROUPS = [
    { key: 'platform', label: 'Phí sàn TikTok', hint: 'hoa hồng sàn, phí giao dịch, phí xử lý đơn, SFR, vận chuyển', keys: ['fee_commission', 'fee_txn', 'fee_processing', 'fee_sfr', 'fee_sfp', 'fee_shipping'] },
    { key: 'promo', label: 'Phí chương trình khuyến mãi', hint: 'Voucher Xtra, Flash Sale, ưu đãi LIVE…', keys: ['fee_voucher_xtra', 'fee_flash', 'fee_live_offer', 'fee_cashback', 'fee_eams', 'fee_paylater', 'fee_campaign'] },
    { key: 'creator', label: 'Hoa hồng nhà sáng tạo (liên kết)', hint: 'trả cho KOL/KOC bán hộ qua liên kết', keys: ['fee_aff', 'fee_aff_ads', 'fee_aff_partner', 'fee_aff_partner_ads', 'fee_aff_deposit', 'fee_aff_refund'] },
    { key: 'ads', label: 'Quảng cáo / dịch vụ trừ vào tiền hàng', hint: 'GMV Max, gói dịch vụ được quản lý', keys: ['fee_gmvmax_voucher', 'fee_gmvmax_voucher_tax', 'fee_gmvmax_ads', 'fee_managed_tax', 'fee_managed_order'] },
    { key: 'tax', label: 'Thuế do TikTok khấu trừ', hint: 'GTGT, TNCN khấu trừ thay', keys: ['vat_withheld', 'pit_withheld'] }
  ];
  M.STLR_LABEL = { fee_commission: 'Phí hoa hồng của TikTok Shop', fee_txn: 'Phí giao dịch', fee_processing: 'Phí xử lý đơn hàng', fee_sfr: 'Phí dịch vụ SFR', fee_sfp: 'Phí dịch vụ SFP',
    fee_shipping: 'Phí vận chuyển của người bán', fee_voucher_xtra: 'Phí dịch vụ Voucher Xtra', fee_flash: 'Phí dịch vụ Flash Sale', fee_live_offer: 'Phí ưu đãi đặc biệt trên LIVE',
    fee_cashback: 'Phí dịch vụ hoàn tiền thưởng', fee_eams: 'Phí chương trình EAMS', fee_paylater: 'Phí chương trình TikTok PayLater', fee_campaign: 'Phí nguồn lực chiến dịch',
    fee_aff: 'Hoa hồng liên kết', fee_aff_ads: 'Hoa hồng liên kết Quảng cáo cửa hàng', fee_aff_partner: 'Hoa hồng của đối tác liên kết', fee_aff_partner_ads: 'Hoa hồng QC cửa hàng của đối tác liên kết',
    fee_aff_deposit: 'Tiền cọc hoa hồng liên kết', fee_aff_refund: 'Hoàn hoa hồng liên kết', fee_gmvmax_voucher: 'Voucher GMV Max', fee_gmvmax_voucher_tax: 'Thuế bán hàng của voucher GMV Max',
    fee_gmvmax_ads: 'Phí quảng cáo GMV Max', fee_managed_tax: 'Gói dịch vụ được quản lý (thuế bán hàng)', fee_managed_order: 'Gói dịch vụ được quản lý (phí mỗi đơn)',
    vat_withheld: 'Thuế GTGT do TikTok Shop khấu trừ', pit_withheld: 'Thuế TNCN do TikTok Shop khấu trừ',
    adj_logistics: 'Bồi thường do vận chuyển – kho vận', adj_dissatisfied: 'Bồi thường do không hài lòng', adj_platform_comp: 'Bồi thường của nền tảng', adj_penalty: 'Tiền phạt của nền tảng',
    adj_seller_deduct: 'Các khoản giảm trừ do người bán chịu', adj_other: 'Điều chỉnh khác' };
  M.STLR_ADJ = ['adj_logistics', 'adj_dissatisfied', 'adj_platform_comp', 'adj_penalty', 'adj_seller_deduct', 'adj_other'];
  function stlrCalc(rows, keys) {
    var t = {}; keys.forEach(function (k) { t[k] = sum(rows, k); });
    var o = { t: t };
    o.groups = M.STLR_GROUPS.map(function (g) {
      var lines = g.keys.filter(function (k) { return t[k]; }).map(function (k) { return { key: k, label: M.STLR_LABEL[k] || k, amount: t[k] }; });
      return { key: g.key, label: g.label, hint: g.hint, amount: lines.reduce(function (a, b) { return a + b.amount; }, 0), lines: lines };
    });
    o.adj = M.STLR_ADJ.filter(function (k) { return t[k]; }).map(function (k) { return { key: k, label: M.STLR_LABEL[k], amount: t[k] }; });
    var feeSum = o.groups.reduce(function (a, g) { return a + g.amount; }, 0);
    o.feeLinesDiff = Math.round(feeSum - (t.fees_total || 0));
    o.calcDiff = Math.round((t.revenue_total || 0) + (t.fees_total || 0) + (t.adj_total || 0) - (t.settlement_total || 0));
    o.revDiff = (t.gross_after || t.refund_after) ? Math.round((t.gross_after || 0) + (t.refund_after || 0) - (t.revenue_total || 0)) : null;
    o.feeRate = t.revenue_total > 0 ? -t.fees_total / t.revenue_total : null;
    o.refundRate = t.gross_after > 0 ? -t.refund_after / t.gross_after : null;
    o.keepRate = t.gross_after > 0 ? t.settlement_total / t.gross_after : null;
    return o;
  }
  M.settlementReport = function (cube, f) {
    var ex = [], rows = (cube._stlr || []).filter(byShop(f)).filter(function (r) { return incl(r, f, ex); });
    var keys = cube.stlr && cube.stlr.cols ? cube.stlr.cols.slice(5) : [];
    var o = stlrCalc(rows, keys);
    o.n = rows.length; o.excluded = ex; o.coverage = range(rows, 'from', 'to'); o.partial = rows.some(function (r) { return r.partial; });
    o.byPeriod = rows.map(function (r) { var c = stlrCalc([r], keys); c.from = r.from; c.to = r.to; c.partial = r.partial; return c; });
    return o;
  };

  // ---------- Đối chiếu chi phí Ads ----------
  M.reconcile = function (cube, f, adsSum) {
    var o = {};
    var ex1 = [], acct = cube._acct.filter(byShop(f)).filter(function (r) { return incl(r, f, ex1); });
    o.acct = { n: acct.length, amount: sum(acct, 'amount'), tax: sum(acct, 'tax'), cash: sum(acct, 'cash'), credit: sum(acct, 'credit'), adCredit: sum(acct, 'adCredit'), hasTax: acct.some(function (r) { return r.tax != null; }), coverage: range(acct, 'from', 'to'), excluded: ex1, rows: acct };
    var ex2 = [], inv = cube._inv.filter(byShop(f)).filter(function (r) { return incl(r, f, ex2); });
    o.invAll = inv; o.invExcluded = ex2;
    var ads = inv.filter(function (r) { return r.category === 'ads'; });
    o.inv = { n: sum(ads, 'count'), amount: sum(ads, 'amount'), tax: sum(ads, 'tax'), net: sum(ads, 'net'), hasTax: sum(ads, 'taxRows') > 0, coverage: range(ads, 'from', 'to') };
    var cat = {};
    inv.forEach(function (r) { var c = cat[r.category] || (cat[r.category] = { category: r.category, count: 0, amount: 0, tax: 0, net: 0, pit: 0, payable: 0, taxRows: 0 }); ['count', 'amount', 'tax', 'net', 'pit', 'payable', 'taxRows'].forEach(function (k) { c[k] += r[k] || 0; }); });
    o.invByCat = Object.keys(cat).map(function (k) { return cat[k]; });
    var top = cube._topup.filter(byShop(f)).filter(function (r) { return r.date >= f.from && r.date <= f.to; });
    /* Phân loại giao dịch Ads (theo Loại giao dịch phụ + phương thức thanh toán):
       tiền thực trả TikTok = nạp tiền thành công + thanh toán hóa đơn KHÔNG trả từ số dư (tránh tính 2 lần);
       chuyển số dư nội bộ, khuyến mãi, giao dịch không thành công: không tính vào tiền trả. */
    var tp = { n: 0, nAll: top.length, coverage: range(top, 'date'), rows: top, topup: 0, nTopup: 0, billCard: 0, nBillCard: 0, billBalance: 0, nBillBalance: 0, promo: 0, nPromo: 0, transferNet: 0, nTransfer: 0, credit: 0, nCredit: 0, failed: 0, nFailed: 0, other: 0, nOther: 0 };
    top.forEach(function (r) {
      var cls = r.cls || 'other', a = r.amount || 0;
      if (r.ok === 0) { tp.failed += a; tp.nFailed++; return; }
      if (cls === 'topup') { tp.topup += a; tp.nTopup++; }
      else if (cls === 'billpay') { if (r.pay === 'Số dư') { tp.billBalance += a; tp.nBillBalance++; } else { tp.billCard += a; tp.nBillCard++; } }
      else if (cls === 'promo') { tp.promo += a; tp.nPromo++; }
      else if (cls === 'transfer') { tp.transferNet += a; tp.nTransfer++; }
      else if (cls === 'credit') { tp.credit += a; tp.nCredit++; }
      else { tp.other += a; tp.nOther++; }
    });
    tp.cashOut = tp.topup + tp.billCard;
    tp.n = tp.nTopup + tp.nBillCard;
    tp.amount = tp.cashOut;
    o.topup = tp;
    o.dash = adsSum ? adsSum.cost : 0;
    o.diffAcct = o.acct.n ? o.acct.amount - o.dash : null;
    o.diffInv = o.inv.n ? o.inv.net - o.dash : null;
    return o;
  };

  // ---------- Video & Liên kết ----------
  M.video = function (cube, f) {
    var rows = cube._vid.filter(byShop(f)).filter(function (r) { return r.date >= f.from && r.date <= f.to; });
    var sc = {};
    rows.forEach(function (r) {
      var k = r.scope || 'Tất cả kênh';
      var s = sc[k] || (sc[k] = { scope: k, gmv: 0, gmvDirect: 0, gmvIndirect: 0, vv: 0, sku: 0, skuDirect: 0, skuIndirect: 0, impr: 0, clicks: 0, days: {}, partial: 0, byDay: {} });
      ['gmv', 'gmvDirect', 'gmvIndirect', 'vv', 'sku', 'skuDirect', 'skuIndirect', 'impr', 'clicks'].forEach(function (x) { s[x] += r[x] || 0; });
      s.days[r.date] = 1; if (r.partial) s.partial = 1;
      var d = s.byDay[r.date] || (s.byDay[r.date] = { date: r.date, gmv: 0, sku: 0 });
      d.gmv += r.gmv || 0; d.sku += r.sku || 0;
    });
    var out = Object.keys(sc).sort().map(function (k) {
      var s = sc[k]; s.nDays = Object.keys(s.days).length; s.gpm = s.vv > 0 ? s.gmv / s.vv * 1000 : null; s.ctr = s.impr > 0 ? s.clicks / s.impr : null;
      s.series = Object.keys(s.byDay).sort().map(function (d) { return s.byDay[d]; });
      return s;
    });
    return { scopes: out, n: rows.length, coverage: range(rows, 'date') };
  };
  M.affiliate = function (cube, f) {
    var ex = [], rows = cube._aff.filter(byShop(f)).filter(function (r) { return incl(r, f, ex); });
    var o = { rows: rows, excluded: ex, n: rows.length };
    ['gmv', 'items', 'refund', 'itemsRefunded', 'commission', 'videos', 'lives', 'samples'].forEach(function (k) { o[k] = sum(rows, k); });
    o.commissionRate = o.gmv > 0 ? o.commission / o.gmv : null;
    o.refundRate = o.gmv > 0 ? o.refund / o.gmv : null;
    o.coverage = range(rows, 'from', 'to');
    return o;
  };

  // ---------- Kiểm soát ads: đối chiếu chi phí theo nguồn, hiệu quả theo loại chiến dịch, kênh nội dung, nhà sáng tạo, thị trường ----------
  M.isGmvMax = function (r) { return /gmv max/i.test(r.ctype || ''); };
  M.adsControl = function (cube, f, ads, rec, shop, aff) {
    var o = {}, gmvAcc = cube.gmvMaxAccount || '', rows = ads.rows;
    var typeOf = function (r) { return r.ctype || (r.account ? 'Chiến dịch thường' : 'Không rõ loại chiến dịch'); };
    var accOf = function (r) { return r.account || (M.isGmvMax(r) ? (gmvAcc || 'Tài khoản GMV Max (chưa khai báo tên)') : 'Không rõ tài khoản'); };
    o.costFile = rec.acct.n ? rec.acct.amount : null; o.costFileCov = rec.acct.coverage; o.costFileExcluded = rec.acct.excluded.length;
    o.campCov = ads.coverage;
    var t = {};
    rows.forEach(function (r) {
      var k = typeOf(r), a = t[k] || (t[k] = { type: k, gmvMax: M.isGmvMax(r), cost: 0, rev: 0, sku: 0, skuMissing: 0, aff: 0, affRows: 0, n: 0 });
      a.cost += r.cost || 0; a.rev += r.rev || 0; if (r.sku == null) a.skuMissing++; else a.sku += r.sku; if (typeof r.affCost === 'number') { a.aff += r.affCost; a.affRows++; } a.n++;
    });
    o.byType = Object.keys(t).map(function (k) {
      var a = t[k]; a.roas = M.roas(a.cost, a.rev); a.roasAll = a.affRows ? M.roas(a.cost + a.aff, a.rev) : null; a.cpo = a.skuMissing ? null : M.cpo(a.cost, a.sku); return a;
    }).sort(function (x, y) { return y.cost - x.cost; });
    o.campCost = sum(rows, 'cost'); o.campRev = sum(rows, 'rev'); o.roasCamp = M.roas(o.campCost, o.campRev);
    var g = o.byType.filter(function (a) { return a.gmvMax; });
    o.gmv = { cost: sum(g, 'cost'), rev: sum(g, 'rev'), aff: sum(g, 'aff'), affKnown: g.some(function (a) { return a.affRows > 0; }) };
    o.gmv.roas = M.roas(o.gmv.cost, o.gmv.rev);
    // chỉ tính trên loại chiến dịch có cột hoa hồng (file LIVE GMV Max không có cột này) – không trộn doanh thu thiếu chi phí hoa hồng
    var gA = g.filter(function (a) { return a.affRows > 0; });
    o.gmv.roasAll = gA.length ? M.roas(sum(gA, 'cost') + sum(gA, 'aff'), sum(gA, 'rev')) : null;
    o.gmv.roasAllScope = gA.map(function (a) { return a.type; }).join(', ');
    var reg = o.byType.filter(function (a) { return !a.gmvMax; });
    o.reg = { cost: sum(reg, 'cost'), rev: sum(reg, 'rev') }; o.reg.roas = M.roas(o.reg.cost, o.reg.rev);
    // đối chiếu theo tài khoản quảng cáo
    var acc = {};
    rec.acct.rows.forEach(function (r) { var k = r.accountName || r.accountId; var a = acc[k] || (acc[k] = { account: k, id: r.accountId, file: 0, gmv: 0, other: 0 }); a.file += r.amount || 0; });
    rows.forEach(function (r) { var k = accOf(r); var a = acc[k] || (acc[k] = { account: k, id: '', file: null, gmv: 0, other: 0 }); if (M.isGmvMax(r)) a.gmv += r.cost || 0; else a.other += r.cost || 0; });
    o.byAccount = Object.keys(acc).map(function (k) { var a = acc[k]; a.camp = a.gmv + a.other; a.gap = a.file == null ? null : a.file - a.camp; return a; })
      .sort(function (x, y) { return (y.file || 0) - (x.file || 0); });
    o.uncovered = o.costFile != null ? o.byAccount.reduce(function (s, a) { return s + (a.gap > 0 ? a.gap : 0); }, 0) : null;
    o.uncoveredShare = o.costFile > 0 ? o.uncovered / o.costFile : null;
    o.gmvAccountSet = !!gmvAcc;
    // doanh số theo kênh nội dung (Phân tích shop)
    o.shop = shop;
    if (shop.n) {
      o.ch = { live: shop.chSellerLive + shop.chCreatorLive, video: shop.chSellerVideo + shop.chCreatorVideo, card: shop.chProductCard,
        creator: shop.chCreatorLive + shop.chCreatorVideo, seller: shop.chSellerLive + shop.chSellerVideo };
    }
    // chi phí quảng cáo so với GMV toàn shop – chỉ khi hai nguồn cùng kỳ
    o.sameCostShop = !!(o.costFileCov && shop.coverage && o.costFileCov.from === shop.coverage.from && o.costFileCov.to === shop.coverage.to);
    o.costToGmv = o.costFile != null && shop.gmv > 0 ? o.costFile / shop.gmv : null;
    o.gmvRevShare = shop.gmv > 0 && o.gmv.rev > 0 ? o.gmv.rev / shop.gmv : null;
    // nhà sáng tạo: liên kết (TikTok) + booking (nội bộ)
    o.aff = aff;
    var bk = (cube._booking || []).filter(byShop(f)).filter(function (r) { return r.date >= f.from && r.date <= f.to; });
    var bc = {};
    bk.forEach(function (r) { var a = bc[r.creator] || (bc[r.creator] = { creator: r.creator, n: 0, fee: 0, gmv: 0, gmvRows: 0, orders: 0, types: {} }); a.n++; a.fee += r.fee || 0; if (typeof r.gmv === 'number') { a.gmv += r.gmv; a.gmvRows++; } a.orders += r.orders || 0; if (r.ctype) a.types[r.ctype] = 1; });
    o.booking = { n: bk.length, fee: sum(bk, 'fee'), gmv: sum(bk, 'gmv'), gmvRows: bk.filter(function (r) { return typeof r.gmv === 'number'; }).length, coverage: range(bk, 'date'),
      byCreator: Object.keys(bc).map(function (k) { var a = bc[k]; a.roi = a.gmvRows ? M.roas(a.fee, a.gmv) : null; return a; }).sort(function (x, y) { return y.fee - x.fee; }) };
    o.booking.roi = o.booking.gmvRows ? M.roas(o.booking.fee, o.booking.gmv) : null;
    o.market = (cube.market || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    // xu hướng theo tháng: chi phí QC (file Cost), GMV toàn shop, hoa hồng liên kết, chiến dịch thường
    var mon = {}, M0 = function (k) { return mon[k] || (mon[k] = { month: k, cost: null, costPartial: false, gmv: 0, gmvDays: 0, aff: null, regCost: 0, regRev: 0, gmvMaxCost: 0, gmvMaxRev: 0 }); };
    rec.acct.rows.forEach(function (r) { if (r.from.slice(0, 7) !== r.to.slice(0, 7)) return; var a = M0(r.from.slice(0, 7)); a.cost = (a.cost || 0) + (r.amount || 0); if (r.partial) a.costPartial = true; });
    (cube._shop || []).filter(byShop(f)).filter(function (r) { return r.date >= f.from && r.date <= f.to; }).forEach(function (r) { var a = M0(r.date.slice(0, 7)); a.gmv += r.gmv || 0; a.gmvDays++; });
    aff.rows.forEach(function (r) { if (r.from.slice(0, 7) !== r.to.slice(0, 7)) return; var a = M0(r.from.slice(0, 7)); a.aff = (a.aff || 0) + (r.commission || 0); });
    rows.forEach(function (r) { if (r.from !== r.to) return; var a = M0(r.from.slice(0, 7)); if (M.isGmvMax(r)) { a.gmvMaxCost += r.cost || 0; a.gmvMaxRev += r.rev || 0; } else { a.regCost += r.cost || 0; a.regRev += r.rev || 0; } });
    o.byMonth = Object.keys(mon).sort().map(function (k) { var a = mon[k]; a.costToGmv = a.cost != null && a.gmv > 0 ? a.cost / a.gmv : null; a.regRoas = M.roas(a.regCost, a.regRev); return a; });
    var withRatio = o.byMonth.filter(function (a) { return a.costToGmv != null; });
    if (withRatio.length >= 4) {
      var head = withRatio.slice(0, 3), tail = withRatio.slice(-3);
      var avg = function (l) { var c = 0, g = 0; l.forEach(function (a) { c += a.cost; g += a.gmv; }); return g > 0 ? c / g : null; };
      o.trend = { first: avg(head), last: avg(tail), firstLabel: head[0].month + '→' + head[head.length - 1].month, lastLabel: tail[0].month + '→' + tail[tail.length - 1].month };
    }
    return o;
  };

  // ---------- Phân tích shop (toàn shop, mọi kênh) ----------
  /* Kênh theo thứ tự cố định (màu đi theo kênh, không theo thứ hạng) */
  M.CHANNELS = [
    { k: 'chCreatorLive', label: 'LIVE của nhà sáng tạo' },
    { k: 'chSellerLive', label: 'LIVE của tài khoản shop' },
    { k: 'chProductCard', label: 'Thẻ sản phẩm' },
    { k: 'chCreatorVideo', label: 'Video của nhà sáng tạo' },
    { k: 'chSellerVideo', label: 'Video của tài khoản shop' }
  ];
  M.shop = function (cube, f) {
    var rows = (cube._shop || []).filter(byShop(f)).filter(function (r) { return r.date >= f.from && r.date <= f.to; });
    var keys = ['gmv', 'orders', 'sku', 'items', 'refund', 'totalRevenue', 'pageViews', 'impr', 'clicks', 'visitors'].concat(M.CHANNELS.map(function (c) { return c.k; }));
    var o = { n: rows.length, coverage: range(rows, 'date'), partial: rows.some(function (r) { return r.partial; }) };
    keys.forEach(function (k) { o[k] = sum(rows, k); });
    o.aov = o.orders > 0 ? o.gmv / o.orders : null;
    o.skuPerOrder = o.orders > 0 ? o.sku / o.orders : null;
    o.ctr = o.impr > 0 ? o.clicks / o.impr : null;
    o.chSum = 0;
    o.channels = M.CHANNELS.map(function (c, i) { o.chSum += o[c.k]; return { k: c.k, label: c.label, slot: i, value: o[c.k], share: o.gmv > 0 ? o[c.k] / o.gmv : null }; });
    o.chOther = o.gmv - o.chSum;
    var day = {}, mon = {};
    rows.forEach(function (r) {
      var d = day[r.date] || (day[r.date] = { date: r.date, gmv: 0, orders: 0, sku: 0, items: 0, refund: 0, partial: 0 });
      var m = mon[r.date.substr(0, 7)] || (mon[r.date.substr(0, 7)] = { month: r.date.substr(0, 7), gmv: 0, orders: 0, sku: 0, items: 0, refund: 0, days: {}, partial: 0 });
      ['gmv', 'orders', 'sku', 'items', 'refund'].forEach(function (k) { d[k] += r[k] || 0; m[k] += r[k] || 0; });
      if (r.partial) { d.partial = 1; m.partial = 1; }
      m.days[r.date] = 1;
    });
    o.byDay = Object.keys(day).sort().map(function (k) { var d = day[k]; d.aov = d.orders > 0 ? d.gmv / d.orders : null; return d; });
    o.byMonth = Object.keys(mon).sort().map(function (k) { var m = mon[k]; m.nDays = Object.keys(m.days).length; m.aov = m.orders > 0 ? m.gmv / m.orders : null; m.skuPerOrder = m.orders > 0 ? m.sku / m.orders : null; return m; });
    return o;
  };

  // ---------- Cây chỉ số: so với kỳ trước, phân rã nguyên nhân, năng suất video/LIVE ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdU(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymdU(d); }
  function monthEnd(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
  function dayCount(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5) + 1; }
  /* Kỳ so sánh: kỳ lọc bắt đầu ngày 1 → cùng số tháng liền trước; còn lại → cùng số ngày liền trước */
  M.prevPeriod = function (from, to) {
    var a = from.split('-').map(Number), b = to.split('-').map(Number);
    if (a[2] === 1) {
      var months = (b[0] - a[0]) * 12 + (b[1] - a[1]) + 1, pm = a[1] - months, py = a[0];
      while (pm < 1) { pm += 12; py--; }
      var em = pm + months - 1, ey = py; while (em > 12) { em -= 12; ey++; }
      return { from: py + '-' + pad(pm) + '-01', to: ey + '-' + pad(em) + '-' + pad(monthEnd(ey, em)) };
    }
    var n = dayCount(from, to);
    return { from: addDays(from, -n), to: addDays(from, -1) };
  };
  M.videoList = function (cube, f) {
    var ex = [], rows = (cube._vlist || []).filter(byShop(f)).filter(function (r) { return incl(r, f, ex); });
    var o = { n: rows.length, excluded: ex, coverage: range(rows, 'from', 'to'), scopes: {} };
    var per = {}; rows.forEach(function (r) { per[r.from + '~' + r.to] = 1; });
    o.nDays = 0; var seen = {}; Object.keys(per).forEach(function (k) { var p = k.split('~'); for (var d = p[0]; d <= p[1]; d = addDays(d, 1)) { if (!seen[d]) { seen[d] = 1; o.nDays++; } } });
    var ids = {}, newIds = {}, vvs = [], vvNew = [], cr = {};
    o.vv = 0; o.impr = 0; o.clicks = 0; o.gmv = 0; o.sku = 0; o.withGmv = 0;
    rows.forEach(function (r) {
      o.vv += r.vv; o.impr += r.impr; o.clicks += r.clicks; o.gmv += r.gmv; o.sku += r.sku;
      if (!ids[r.videoId]) { ids[r.videoId] = 1; vvs.push(r.vv); if (r.gmv > 0) o.withGmv++; }
      var isNew = r.publish && r.publish.slice(0, 10) >= r.from && r.publish.slice(0, 10) <= r.to;
      if (isNew && !newIds[r.videoId]) { newIds[r.videoId] = 1; vvNew.push(r.vv); }
      var c = cr[r.creator || '(không rõ)'] || (cr[r.creator || '(không rõ)'] = { account: r.creator || '(không rõ)', scope: r.scope, videos: 0, newVideos: 0, vv: 0, clicks: 0, gmv: 0 });
      c.videos++; if (isNew) c.newVideos++; c.vv += r.vv; c.clicks += r.clicks; c.gmv += r.gmv;
    });
    o.videos = vvs.length; o.newVideos = vvNew.length;
    o.medianVV = median(vvs); o.medianVVNew = median(vvNew);
    o.gpm = o.vv > 0 ? o.gmv / o.vv * 1000 : null; o.clicksPer1k = o.vv > 0 ? o.clicks / o.vv * 1000 : null;
    o.newPerDay = o.nDays ? o.newVideos / o.nDays : null;
    var g = rows.map(function (r) { return r.gmv; }).sort(function (x, y) { return y - x; }), top = Math.max(1, Math.ceil(g.length * 0.1)), topSum = 0;
    for (var i = 0; i < top && i < g.length; i++) topSum += g[i];
    o.top10Share = o.gmv > 0 ? topSum / o.gmv : null;
    var bk = [[0, 1000, 'Dưới 1.000'], [1000, 10000, '1.000 – 10.000'], [10000, 100000, '10.000 – 100.000'], [100000, 1e15, 'Từ 100.000']];
    o.buckets = bk.map(function (b) { var xs = rows.filter(function (r) { return r.vv >= b[0] && r.vv < b[1]; }); return { label: b[2], videos: xs.length, vv: sum(xs, 'vv'), gmv: sum(xs, 'gmv') }; });
    o.byAccount = Object.keys(cr).map(function (k) { var c = cr[k]; c.gpm = c.vv > 0 ? c.gmv / c.vv * 1000 : null; return c; }).sort(function (x, y) { return y.gmv - x.gmv; });
    return o;
  };
  var SLOTS = [[0, 6, '0h–6h'], [6, 9, '6h–9h'], [9, 12, '9h–12h'], [12, 14, '12h–14h'], [14, 17, '14h–17h'], [17, 19, '17h–19h'], [19, 21, '19h–21h'], [21, 24, '21h–24h']];
  M.liveList = function (cube, f) {
    var rows = (cube._llist || []).filter(byShop(f)).filter(function (r) { return r.date >= f.from && r.date <= f.to; });
    var o = { n: rows.length, coverage: range(rows, 'date'), sessions: rows.length };
    ['dur', 'gmv', 'orders', 'items', 'buyers', 'viewers', 'views', 'impr', 'clicks', 'comments', 'likes', 'followers'].forEach(function (k) { o[k] = sum(rows, k); });
    var days = {}; rows.forEach(function (r) { days[r.date] = 1; }); o.nDays = Object.keys(days).length;
    o.hours = o.dur / 60;
    o.hoursPerSession = o.sessions ? o.hours / o.sessions : null;
    o.gmvPerHour = o.hours > 0 ? o.gmv / o.hours : null; o.gmvPerSession = o.sessions ? o.gmv / o.sessions : null;
    o.viewersPerHour = o.hours > 0 ? o.viewers / o.hours : null; o.imprPerHour = o.hours > 0 ? o.impr / o.hours : null;
    o.ctr = o.impr > 0 ? o.clicks / o.impr : null; o.cvr = o.clicks > 0 ? o.orders / o.clicks : null; o.aov = o.orders > 0 ? o.gmv / o.orders : null;
    var ac = {};
    rows.forEach(function (r) { var a = ac[r.account] || (ac[r.account] = { account: r.account, sessions: 0, dur: 0, gmv: 0, viewers: 0, impr: 0, clicks: 0, orders: 0 }); a.sessions++; ['dur', 'gmv', 'viewers', 'impr', 'clicks', 'orders'].forEach(function (k) { a[k] += r[k] || 0; }); });
    o.byAccount = Object.keys(ac).map(function (k) { var a = ac[k]; a.hours = a.dur / 60; a.gmvPerHour = a.hours > 0 ? a.gmv / a.hours : null; a.ctr = a.impr > 0 ? a.clicks / a.impr : null; a.cvr = a.clicks > 0 ? a.orders / a.clicks : null; return a; }).sort(function (x, y) { return y.gmv - x.gmv; });
    o.bySlot = SLOTS.map(function (s) {
      var xs = rows.filter(function (r) { var h = +String(r.start || '').slice(11, 13); return h >= s[0] && h < s[1]; });
      var hrs = sum(xs, 'dur') / 60, g = sum(xs, 'gmv');
      return { label: s[2], sessions: xs.length, hours: hrs, gmv: g, gmvPerHour: hrs > 0 ? g / hrs : null, viewersPerHour: hrs > 0 ? sum(xs, 'viewers') / hrs : null };
    });
    return o;
  };
  /* Phân rã logarit (LMDI): đóng góp cộng được của từng nhân tố vào chênh lệch tích số */
  function lmdi(y0, y1, factors) {
    var ok = y0 > 0 && y1 > 0 && factors.every(function (x) { return x.a > 0 && x.b > 0; });
    if (!ok) return null;
    var L = y0 === y1 ? y0 : (y1 - y0) / Math.log(y1 / y0);
    return factors.map(function (x) { return { key: x.key, label: x.label, a: x.a, b: x.b, change: x.b / x.a - 1, impact: L * Math.log(x.b / x.a) }; });
  }
  function snap(cube, f) {
    var s = M.shop(cube, f), v = M.video(cube, f), aff = M.affiliate(cube, f), vl = M.videoList(cube, f), ll = M.liveList(cube, f);
    var d = s.byDay.length || 0, o = { from: f.from, to: f.to, days: d, shop: s, vl: vl, ll: ll, aff: aff };
    var per = function (x) { return d > 0 ? x / d : null; };
    o.gmvD = per(s.gmv); o.imprD = per(s.impr); o.clicksD = per(s.clicks); o.visitorsD = per(s.visitors); o.ordersD = per(s.orders);
    o.ctr = s.impr > 0 ? s.clicks / s.impr : null; o.c2o = s.clicks > 0 ? s.orders / s.clicks : null; o.v2o = s.visitors > 0 ? s.orders / s.visitors : null; o.aov = s.aov;
    o.ch = {}; s.channels.forEach(function (c) { o.ch[c.k] = per(c.value); });
    var vs = (v.scopes || []).filter(function (x) { return x.scope === 'Tất cả kênh'; })[0] || (v.scopes || [])[0] || null, vd = vs ? vs.nDays : 0;
    o.video = vs ? { days: vd, vvD: vd ? vs.vv / vd : null, gmvD: vd ? vs.gmv / vd : null, clicksD: vd ? vs.clicks / vd : null, gmvPerView: vs.vv > 0 ? vs.gmv / vs.vv : null, clicksPerView: vs.vv > 0 ? vs.clicks / vs.vv : null, gmvPerClick: vs.clicks > 0 ? vs.gmv / vs.clicks : null } : null;
    o.liveD = ll.nDays ? { hoursD: ll.hours / ll.nDays, sessionsD: ll.sessions / ll.nDays, gmvD: ll.gmv / ll.nDays } : null;
    return o;
  }
  M.growth = function (cube, f, norm) {
    var p = M.prevPeriod(f.from, f.to), cur = snap(cube, f), prev = snap(cube, { from: p.from, to: p.to, shop: f.shop, ent: '' });
    var o = { cur: cur, prev: prev, prevFrom: p.from, prevTo: p.to, hasCur: cur.days > 0, hasPrev: prev.days > 0 };
    if (o.hasCur && o.hasPrev) {
      o.funnel = lmdi(prev.gmvD, cur.gmvD, [{ key: 'impr', label: 'Lượt hiển thị sản phẩm / ngày', a: prev.imprD, b: cur.imprD }, { key: 'ctr', label: 'Tỷ lệ nhấp (nhấp ÷ hiển thị)', a: prev.ctr, b: cur.ctr },
        { key: 'c2o', label: 'Tỷ lệ nhấp thành đơn', a: prev.c2o, b: cur.c2o }, { key: 'aov', label: 'Giá trị đơn bình quân', a: prev.aov, b: cur.aov }]);
      o.gmvDelta = cur.gmvD - prev.gmvD;
      o.channels = M.CHANNELS.map(function (c) { var a = prev.ch[c.k] || 0, b = cur.ch[c.k] || 0; return { label: c.label, a: a, b: b, delta: b - a, share: o.gmvDelta ? (b - a) / o.gmvDelta : null }; }).sort(function (x, y) { return x.delta - y.delta; });
      if (cur.video && prev.video) o.videoFunnel = lmdi(prev.video.gmvD, cur.video.gmvD, [{ key: 'vv', label: 'Lượt xem video / ngày', a: prev.video.vvD, b: cur.video.vvD },
        { key: 'cpv', label: 'Lượt nhấp sản phẩm trên mỗi lượt xem', a: prev.video.clicksPerView, b: cur.video.clicksPerView }, { key: 'gpc', label: 'GMV trên mỗi lượt nhấp', a: prev.video.gmvPerClick, b: cur.video.gmvPerClick }]);
      var la = prev.ll, lb = cur.ll;
      if (la.n && lb.n) o.liveFunnel = lmdi(la.gmv / la.nDays, lb.gmv / lb.nDays, [{ key: 'h', label: 'Giờ LIVE / ngày', a: la.hours / la.nDays, b: lb.hours / lb.nDays },
        { key: 'iph', label: 'Lượt hiển thị sản phẩm / giờ', a: la.imprPerHour, b: lb.imprPerHour }, { key: 'ctr', label: 'CTR LIVE', a: la.ctr, b: lb.ctr },
        { key: 'cvr', label: 'Nhấp thành đơn (LIVE)', a: la.cvr, b: lb.cvr }, { key: 'aov', label: 'Giá trị đơn LIVE', a: la.aov, b: lb.aov }]);
    }
    // định mức quy đổi theo kỳ hiện tại (thiếu thì lấy kỳ trước)
    var pick = function (fn) { var x = fn(cur); return x != null && isFinite(x) && x > 0 ? x : (function () { var y = fn(prev); return y != null && isFinite(y) && y > 0 ? y : null; })(); };
    o.norm = {
      vvPerVideo: pick(function (s) { return s.vl.nDays >= 7 ? (s.vl.medianVVNew || s.vl.medianVV) : null; }) || norm || 20000,
      vvPerVideoSrc: ((cur.vl.nDays >= 7 && (cur.vl.medianVVNew || cur.vl.medianVV)) || (prev.vl.nDays >= 7 && (prev.vl.medianVVNew || prev.vl.medianVV))) ? 'trung vị lượt xem của video mới đăng trong danh sách video' : 'định mức sàn ' + M.fmtNum(norm || 20000) + ' lượt xem/video theo quy chế; danh sách video cần phủ từ 7 ngày để tính theo thực tế',
      gmvPerView: pick(function (s) { return s.video && s.video.gmvPerView; }), clicksPerView: pick(function (s) { return s.video && s.video.clicksPerView; }),
      gmvPerClick: pick(function (s) { return s.video && s.video.gmvPerClick; }), v2o: pick(function (s) { return s.v2o; }), aov: pick(function (s) { return s.aov; }),
      gmvPerHour: pick(function (s) { return s.ll.gmvPerHour; })
    };
    return o;
  };
  M.healthTargets = { late: 0.04, chat: 0.70 };

  // ---------- BẢN TIN ĐIỀU HÀNH: kết quả kinh doanh kênh TikTok theo kế toán quản trị ----------
  /* Giá vốn và chi phí vận hành kênh do kế toán nhập theo kỳ (lấy từ sổ sách). Chỉ dùng khoản nằm trọn trong kỳ lọc.
     Khoản nhập cho “toàn bộ shop” chỉ áp dụng khi xem tất cả shop (hoặc dữ liệu chỉ có một shop). */
  M.mgmtCosts = function (cube, f) {
    var mg = cube.mgmt || {}, ex = [], single = (cube.shops || []).length <= 1;
    var ent = (mg.entries || []).filter(function (e) {
      if (e.shop) { if (f.shop && e.shop !== f.shop) return false; } else if (f.shop && !single) return false;
      return incl(e, f, ex);
    });
    var has = function (k) { return ent.some(function (e) { return typeof e[k] === 'number'; }); };
    return { entries: ent, excluded: ex, cogs: has('cogs') ? sum(ent, 'cogs') : null, opex: has('opex') ? sum(ent, 'opex') : null,
      rate: typeof mg.cogsRate === 'number' && mg.cogsRate > 0 && mg.cogsRate < 1 ? mg.cogsRate : null, coverage: range(ent, 'from', 'to') };
  };
  function daysOf(a, b, into) { for (var d = a; d <= b; d = addDays(d, 1)) into[d] = 1; return into; }
  /* Báo cáo kết quả theo dòng tiền quyết toán: doanh số → hoàn tiền → doanh thu thuần → phí sàn → quảng cáo → giá vốn → lãi đóng góp.
     Số âm = khoản trừ. Thuế do sàn khấu trừ thay không phải chi phí kinh doanh: chỉ dùng để khớp với tiền sàn trả về. */
  function plCalc(cube, f, sr, acct, ads) {
    if (!sr || !sr.n) return null;
    var t = sr.t, g = {}, lines = {};
    sr.groups.forEach(function (x) { g[x.key] = x.amount; x.lines.forEach(function (l) { lines[l.key] = l.amount; }); });
    var p = { coverage: sr.coverage, partial: sr.partial, n: sr.n, lines: lines, calcDiff: sr.calcDiff, feeLinesDiff: sr.feeLinesDiff, revDiff: sr.revDiff };
    p.gross = t.gross_after || null; p.refund = t.refund_after || 0; p.net = t.revenue_total || 0;
    p.platform = g.platform || 0; p.promo = g.promo || 0; p.creator = g.creator || 0; p.adsStl = g.ads || 0; p.taxWithheld = g.tax || 0;
    p.otherFees = Math.round((t.fees_total || 0) - (p.platform + p.promo + p.creator + p.adsStl + p.taxWithheld));
    p.adj = t.adj_total || 0;
    p.fees = p.platform + p.promo + p.creator + p.adsStl + p.otherFees;
    p.afterPlatform = p.net + p.fees + p.adj;
    p.settlement = t.settlement_total || 0;
    p.cashCheck = Math.round(p.afterPlatform + p.taxWithheld - p.settlement);
    p.days = p.coverage ? dayCount(p.coverage.from, p.coverage.to) : 0;
    // quảng cáo: file Chi phí của Business Center (chi phí + thuế nhà cung cấp tự thu, không được khấu trừ) – thiếu thì lấy báo cáo chiến dịch
    if (acct && acct.n) { p.adCost = -(acct.amount + (acct.hasTax ? acct.tax : 0)); p.adTax = acct.hasTax ? acct.tax : null; p.adSrc = 'acct'; p.adCov = acct.coverage; }
    else if (ads && ads.n) { p.adCost = -ads.cost; p.adTax = null; p.adSrc = 'campaign'; p.adCov = ads.coverage; }
    else { p.adCost = null; p.adSrc = null; p.adCov = null; }
    var bk = (cube._booking || []).filter(function (r) { return (!f.shop || r.shop === f.shop) && r.date >= f.from && r.date <= f.to; });
    p.booking = bk.length ? -sum(bk, 'fee') : 0; p.bookingN = bk.length;
    // giá vốn: số thực tế phải phủ đủ mọi ngày của kỳ quyết toán; không đủ thì dùng tỷ lệ ước tính (nếu có)
    var mc = M.mgmtCosts(cube, f), need = {}, got = {};
    sr.byPeriod.forEach(function (x) { daysOf(x.from, x.to, need); });
    mc.entries.forEach(function (e) { if (typeof e.cogs === 'number') daysOf(e.from, e.to, got); });
    var missing = Object.keys(need).filter(function (d) { return !got[d]; }).sort();
    p.mgmt = mc; p.cogsMissing = missing;
    if (mc.cogs != null && !missing.length) { p.cogsMethod = 'actual'; p.cogs = -mc.cogs; }
    else if (mc.rate != null && p.net > 0) { p.cogsMethod = 'rate'; p.cogs = -Math.round(mc.rate * p.net); }
    else { p.cogsMethod = null; p.cogs = null; }
    p.cogsRate = mc.rate;
    p.opex = mc.opex != null && p.cogsMethod === 'actual' ? -mc.opex : null;
    p.beforeCogs = p.adCost == null ? null : p.afterPlatform + p.adCost + p.booking;
    p.contribution = p.beforeCogs != null && p.cogs != null ? p.beforeCogs + p.cogs : null;
    p.afterOpex = p.contribution != null && p.opex != null ? p.contribution + p.opex : null;
    p.base = p.gross || p.net;
    p.refundRate = p.gross ? -p.refund / p.gross : null;
    var r = function (x) { return p.net > 0 && x != null ? x / p.net : null; };
    p.feeRate = r(-p.fees); p.adRate = p.adCost == null ? null : r(-(p.adCost + p.booking)); p.margin = r(p.contribution); p.marginBefore = r(p.beforeCogs);
    p.keepRate = r(p.settlement);
    return p;
  }
  M.per100 = function (p, x) { return p && p.base > 0 && x != null ? x / p.base * 100 : null; };
  var BRIEF_FACTOR = { impr: 'Độ phủ – lượt hiển thị sản phẩm', ctr: 'Sức hút – tỷ lệ bấm vào sản phẩm', c2o: 'Chốt đơn – tỷ lệ bấm vào rồi mua', aov: 'Giá trị mỗi đơn' };
  M.BRIEF_FACTOR = BRIEF_FACTOR;
  M.brief = function (ctx) {
    var cube = ctx.cube, f = ctx.f, pp = M.prevPeriod(f.from, f.to), pf = { from: pp.from, to: pp.to, shop: f.shop, ent: '' };
    var o = { prevFrom: pp.from, prevTo: pp.to, gr: M.growth(cube, f, 20000) };
    o.pl = plCalc(cube, f, ctx.stlr, ctx.rec.acct, ctx.ads);
    var psr = M.settlementReport(cube, pf);
    o.plPrev = psr.n ? plCalc(cube, pf, psr, M.reconcile(cube, pf, null).acct, M.ads(cube, pf)) : null;
    o.ord = ctx.orders; o.ordPrev = M.orders(cube, pf);
    var hs = (cube.health || []).filter(function (x) { return x.date <= f.to; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    o.health = hs[0] || null; o.healthPrev = hs.filter(function (x) { return x.date <= pp.to; })[0] || null;
    // xu hướng theo tháng trên toàn bộ dữ liệu Phân tích shop
    var all = M.shop(cube, { from: '0000-01-01', to: '9999-12-31', shop: f.shop });
    o.months = all.byMonth.map(function (m) {
      var y = +m.month.substr(0, 4), mo = +m.month.substr(5, 2), len = monthEnd(y, mo);
      return { month: m.month, gmv: m.gmv, nDays: m.nDays, gmvD: m.nDays ? m.gmv / m.nDays : null, full: m.nDays >= len, inPeriod: m.month >= f.from.substr(0, 7) && m.month <= f.to.substr(0, 7) };
    });
    // quy đổi phần doanh số giảm ra số video / giờ LIVE theo hiệu suất hiện tại
    var gr = o.gr, nm = gr.norm;
    if (gr.hasCur && gr.hasPrev && gr.gmvDelta < 0) {
      var gap = -gr.gmvDelta;
      o.gap = { gmv: gap, videos: nm.gmvPerView && nm.vvPerVideo ? gap / nm.gmvPerView / nm.vvPerVideo : null, hours: nm.gmvPerHour ? gap / nm.gmvPerHour : null, norm: nm };
    }
    o.warn = briefWarnings(ctx, o);
    o.decisions = briefDecisions(ctx, o);
    return o;
  };
  function fmtD(s) { return M.fmtDate(s); }
  function vnMoney(x) { var a = Math.abs(x); return a >= 1e9 ? M.fmtNum(x / 1e9, 2) + ' tỷ' : a >= 1e6 ? M.fmtNum(x / 1e6, 1) + ' triệu' : M.fmtMoney(x); }
  M.vnMoney = vnMoney;
  function pp1(x) { return M.fmtNum(x * 100, 1) + '%'; }
  function briefWarnings(ctx, o) {
    var w = [], f = ctx.f, pl = o.pl, sp = ctx.shop;
    if (!sp.n) w.push('Kỳ lọc chưa có file Phân tích shop: chưa có doanh số đặt hàng, phễu bán hàng và cơ cấu kênh.');
    else if (sp.coverage && (sp.coverage.from > f.from || sp.coverage.to < f.to)) w.push('Phân tích shop mới có từ ' + fmtD(sp.coverage.from) + ' đến ' + fmtD(sp.coverage.to) + '.');
    if (!pl) w.push('Kỳ lọc chưa có báo cáo quyết toán của TikTok (income_….xlsx, sheet “Báo cáo”): chưa lập được kết quả kinh doanh.');
    else {
      if (pl.coverage.from > f.from || pl.coverage.to < f.to) w.push('Quyết toán mới có từ ' + fmtD(pl.coverage.from) + ' đến ' + fmtD(pl.coverage.to) + '.');
      if (pl.adSrc === 'acct' && pl.adCov && (pl.adCov.from !== pl.coverage.from || pl.adCov.to !== pl.coverage.to)) w.push('Chi phí quảng cáo tính từ ' + fmtD(pl.adCov.from) + ' đến ' + fmtD(pl.adCov.to) + ', kỳ quyết toán từ ' + fmtD(pl.coverage.from) + ' đến ' + fmtD(pl.coverage.to) + ': hai nguồn lệch ngày, tỷ lệ quảng cáo/doanh thu chỉ để tham khảo.');
      if (pl.adSrc === 'campaign') w.push('Chưa có file Chi phí của Business Center trong kỳ: chi phí quảng cáo tạm lấy theo báo cáo chiến dịch (chưa gồm thuế, có thể thiếu tài khoản).');
      if (!pl.adSrc) w.push('Chưa có chi phí quảng cáo trong kỳ: chưa tính được phần còn lại sau quảng cáo.');
      if (pl.cogsMethod === 'rate') w.push('Giá vốn đang tính theo tỷ lệ ước tính ' + pp1(pl.cogsRate) + ' doanh thu thuần' + (pl.cogsMissing.length && pl.mgmt.cogs != null ? ' (giá vốn thực tế đã nhập chưa phủ đủ kỳ quyết toán)' : '') + '.');
      if (pl.mgmt.excluded.length) w.push(pl.mgmt.excluded.length + ' khoản giá vốn/chi phí kênh chỉ trùng một phần với kỳ lọc nên không được tính.');
    }
    return w;
  }
  function briefDecisions(ctx, o) {
    var d = [], pl = o.pl, pv = o.plPrev, gr = o.gr, h = o.health;
    var chgTxt = function (x) { return (x >= 0 ? 'tăng ' : 'giảm ') + M.fmtNum(Math.abs(x) * 100, 1) + '%'; };
    if (pl && pl.contribution != null && pl.contribution < 0) d.push({ k: 'bad', t: 'Lãi đóng góp của kênh âm ' + vnMoney(-pl.contribution) + ': doanh thu sau phí sàn chưa đủ bù quảng cáo và giá vốn. Cần duyệt lại ngân sách quảng cáo và giá bán trước kỳ tới.' });
    if (gr.funnel && gr.gmvDelta < 0) {
      var worst = gr.funnel.slice().sort(function (a, b) { return a.impact - b.impact; })[0];
      if (worst && worst.impact < 0) {
        var act = { impr: 'cần thêm nguồn đưa người xem tới sản phẩm: số video, giờ LIVE, nhà sáng tạo, ngân sách quảng cáo',
          ctr: 'xem lại ảnh bìa, tiêu đề, giá hiển thị và đoạn mở đầu của video/LIVE', c2o: 'kiểm tra giá bán, khuyến mãi, đánh giá sản phẩm và tình trạng hết hàng',
          aov: 'xem lại combo, quà tặng và ngưỡng miễn phí vận chuyển' }[worst.key];
        var t = BRIEF_FACTOR[worst.key] + ' ' + chgTxt(worst.change) + ', làm doanh số giảm ' + vnMoney(-worst.impact) + '/ngày: ' + act + '.';
        if (worst.key === 'impr' && o.gap && (o.gap.videos || o.gap.hours)) t += ' Phần giảm tương đương ' + (o.gap.videos ? M.fmtNum(o.gap.videos, 0) + ' video mới/ngày' : '') + (o.gap.videos && o.gap.hours ? ' hoặc ' : '') + (o.gap.hours ? M.fmtNum(o.gap.hours, 1) + ' giờ LIVE/ngày' : '') + ' theo hiệu suất hiện tại.';
        d.push({ k: 'warn', t: t });
      }
    }
    if (pl && pv) {
      if (pl.refundRate != null && pv.refundRate != null && pl.refundRate - pv.refundRate >= 0.005) d.push({ k: 'warn', t: 'Hoàn tiền tăng từ ' + pp1(pv.refundRate) + ' lên ' + pp1(pl.refundRate) + ' tiền hàng: yêu cầu bộ phận vận hành báo cáo lý do hoàn theo nhóm sản phẩm và đơn vị vận chuyển.' });
      if (pl.feeRate != null && pv.feeRate != null && pl.feeRate - pv.feeRate >= 0.005) {
        var top = null;
        Object.keys(pl.lines).forEach(function (k) { if (k === 'vat_withheld' || k === 'pit_withheld') return; var a = pv.net > 0 ? -(pv.lines[k] || 0) / pv.net : 0, b = -(pl.lines[k] || 0) / pl.net; if (!top || b - a > top.d) top = { k: k, d: b - a }; });
        d.push({ k: 'warn', t: 'Phí sàn, khuyến mãi và hoa hồng tăng từ ' + pp1(pv.feeRate) + ' lên ' + pp1(pl.feeRate) + ' doanh thu thuần' + (top && top.d > 0 ? '; tăng nhiều nhất là ' + (M.STLR_LABEL[top.k] || top.k).toLowerCase() + ' (+' + M.fmtNum(top.d * 100, 1) + ' điểm)' : '') + '. Rà soát các chương trình đang đăng ký.' });
      }
      if (pl.adRate != null && pv.adRate != null && pl.adRate - pv.adRate >= 0.005 && gr.hasPrev && gr.gmvDelta < 0) d.push({ k: 'warn', t: 'Quảng cáo và booking tăng từ ' + pp1(pv.adRate) + ' lên ' + pp1(pl.adRate) + ' doanh thu thuần trong khi doanh số/ngày giảm: duyệt lại ngân sách theo hiệu quả từng tài khoản (trang Kiểm soát chi phí QC).' });
    }
    if (h) {
      if (h.late != null && h.late > M.healthTargets.late) d.push({ k: 'bad', t: 'Gửi hàng muộn ' + pp1(h.late) + ' (TikTok yêu cầu ≤ 4%, ghi nhận ' + fmtD(h.date) + '): rủi ro bị giảm hiển thị. Kho cần cam kết thời gian bàn giao vận chuyển.' });
      if (h.chat != null && h.chat < M.healthTargets.chat) d.push({ k: 'warn', t: 'Hài lòng qua chat ' + pp1(h.chat) + ' (yêu cầu ≥ 70%): bổ sung người trực chat giờ cao điểm và mẫu trả lời.' });
      if (h.frozen > 0) d.push({ k: 'bad', t: M.fmtNum(h.frozen) + ' sản phẩm đang bị đóng băng (ghi nhận ' + fmtD(h.date) + '): xử lý vi phạm để mở lại.' });
    }
    if (pl && pl.cogs == null) d.push({ k: 'info', t: 'Kế toán nhập giá vốn hàng bán của kỳ ' + fmtD(pl.coverage.from) + ' – ' + fmtD(pl.coverage.to) + ' (Cài đặt → Giá vốn và chi phí kênh) để chốt lãi đóng góp.' });
    var rank = { bad: 0, warn: 1, info: 2 };
    return d.map(function (x, i) { x.i = i; return x; }).sort(function (a, b) { return rank[a.k] - rank[b.k] || a.i - b.i; });
  }

  function shopComments(ctx, out) {
    var sp = ctx.shop;
    if (!sp || !sp.n) return;
    var top = sp.channels.slice().sort(function (a, b) { return b.value - a.value; })[0];
    out.push({ k: 'info', t: 'Toàn shop (Phân tích shop, số liệu thực có ' + M.fmtPeriod(sp.coverage.from, sp.coverage.to) + '): GMV ' + M.fmtMoney(sp.gmv) + ', ' + M.fmtNum(sp.orders) + ' đơn hàng / ' + M.fmtNum(sp.sku) + ' đơn SKU (' + M.fmtNum(sp.skuPerOrder, 2) + ' SKU/đơn), AOV ' + M.fmtMoney(sp.aov) + (top && top.value > 0 ? '; kênh GMV lớn nhất: ' + top.label + ' (' + M.fmtPct(top.share, 1) + ')' : '') + '.' });
    if (sp.partial) out.push({ k: 'warn', t: 'Số liệu Phân tích shop có ngày chưa kết thúc – còn thay đổi.' });
    if (ctx.ads && ctx.ads.n && sp.gmv > 0) out.push({ k: 'info', t: 'Doanh thu gộp theo báo cáo quảng cáo bằng ' + M.fmtPct(ctx.ads.rev / sp.gmv, 1) + ' GMV toàn shop trong cùng kỳ lọc (tham khảo – hai nguồn quy kết khác nhau, không cộng/trừ lẫn).' });
  }

  // ---------- Kiến nghị điều hành (theo quy tắc nghiệp vụ, có số liệu cụ thể) ----------
  M.recommend = function (ctx) {
    var s = ctx.ads, th = ctx.thresholds, out = [], sp = ctx.shop, o = ctx.orders, rc = ctx.rec, t0 = th[0];
    var tf = function (t) { return M.fmtNum(t, t % 1 ? 1 : 0); };
    if (!s.n) out.push('Bổ sung báo cáo GMV Max theo chiến dịch (cột Chi phí, Doanh thu gộp, Số đơn SKU) cho kỳ này để đo hiệu quả quảng cáo so với mốc ROAS.');
    else if (s.roas != null && th.length) {
      if (s.roas < t0) {
        var rk = M.ranking(s, th, 0), top = rk.slice(0, 3), topShort = top.reduce(function (a, c) { return a + c.short[0]; }, 0);
        if (top.length) out.push('Rà soát trước ' + top.length + ' chiến dịch thiếu doanh thu lớn nhất (' + top.map(function (c) { return '“' + c.name + '”'; }).join(', ') + '), tổng thiếu ' + M.fmtMoney(topShort) + ' so với mốc ' + tf(t0) + ': tạm dừng hoặc giảm ngân sách nhóm có ROAS thấp nhất, giữ ngân sách cho nhóm gần mốc.');
        out.push('Để đạt ROAS ' + tf(t0) + ' cả kỳ: hoặc tăng doanh thu gộp thêm ' + M.fmtMoney(M.shortfall(t0, s.cost, s.rev)) + ' với mức chi hiện tại, hoặc giữ doanh thu và đưa chi phí Ads về tối đa ' + M.fmtMoney(M.round(s.rev / t0, 0)) + ' (giảm ' + M.fmtMoney(s.cost - M.round(s.rev / t0, 0)) + ').');
      } else if (th.length > 1 && s.roas < th[th.length - 1]) out.push('ROAS đã qua mốc ' + tf(t0) + '; còn thiếu ' + M.fmtMoney(M.shortfall(th[th.length - 1], s.cost, s.rev)) + ' doanh thu gộp để đạt mốc ' + tf(th[th.length - 1]) + ' – ưu tiên mở rộng các chiến dịch có ROAS trên mốc.');
      else out.push('ROAS vượt các mốc mục tiêu – có thể cân nhắc tăng ngân sách có kiểm soát cho các chiến dịch có ROAS cao nhất, theo dõi ROAS theo ngày.');
      if (ctx.official == null) out.push('Chốt mốc ROAS chính thức làm căn cứ đánh giá thưởng; hiện báo cáo chỉ so sánh tham khảo.');
    }
    if (sp && sp.n) {
      var top1 = sp.channels.slice().sort(function (a, b) { return b.value - a.value; })[0];
      if (top1 && top1.share > 0.4) out.push('Doanh thu phụ thuộc lớn vào kênh “' + top1.label + '” (' + M.fmtPct(top1.share, 1) + ' GMV) – cần phương án dự phòng nếu kênh này giảm hiệu quả.');
      if (sp.gmv > 0 && sp.refund / sp.gmv > 0.15) out.push('Hoàn tiền ghi nhận bằng ' + M.fmtPct(sp.refund / sp.gmv, 1) + ' GMV cùng kỳ (theo ngày phát sinh hoàn) – đề nghị rà soát nguyên nhân hủy/hoàn theo sản phẩm.');
    }
    if (rc && rc.acct.n && s.n && rc.dash > 0 && Math.abs(rc.diffAcct) / rc.dash > 0.01) out.push('Chi phí theo file Cost lệch ' + M.fmtMoney(rc.diffAcct) + ' so với báo cáo quảng cáo – kiểm tra lại kỳ khai báo của file Cost và phạm vi tài khoản trước khi ghi sổ.');
    if (rc && rc.topup.nAll) out.push('Đối chiếu tiền thực trả TikTok Ads ' + M.fmtMoney(rc.topup.cashOut) + ' với sao kê thẻ/ngân hàng và hóa đơn VNTT tương ứng.');
    var sr = ctx.stlr;
    if (sr && sr.n && sr.feeRate != null) {
      var gTop = sr.groups.filter(function (g) { return g.amount < 0; }).sort(function (a, b) { return a.amount - b.amount; })[0];
      out.push('Phí và hoa hồng TikTok trừ vào tiền hàng bằng ' + M.fmtPct(sr.feeRate, 1) + ' doanh thu sau hoàn (' + M.fmtMoney(-sr.t.fees_total) + ', kỳ ' + M.fmtPeriod(sr.coverage.from, sr.coverage.to) + ')' + (gTop ? '; khoản lớn nhất là ' + gTop.label.toLowerCase() + ' ' + M.fmtMoney(-gTop.amount) : '') + ' – đưa tỷ lệ này vào giá vốn khi xét giá bán và chương trình khuyến mãi.');
      if (sr.refundRate != null && sr.refundRate > 0.15) out.push('Hoàn tiền cho khách theo quyết toán bằng ' + M.fmtPct(sr.refundRate, 1) + ' doanh thu hàng bán (' + M.fmtMoney(-sr.t.refund_after) + ') – đề nghị bộ phận vận hành báo cáo nguyên nhân hoàn theo sản phẩm.');
    }
    if (!o.n) out.push('Bổ sung file đơn hàng (có trạng thái, số tiền đơn, tiền hoàn) để tính tỷ lệ hủy/hoàn và doanh số sau hoàn/hủy.');
    if (!ctx.stl.n && !(ctx.stlr && ctx.stlr.n)) out.push('Bổ sung file quyết toán để đối chiếu doanh thu với tiền TikTok thực chuyển về.');
    return out;
  };

  // ---------- Nhận định chính (chạy offline) ----------
  M.commentary = function (ctx) {
    var s = ctx.ads, th = ctx.thresholds, out = [];
    var R = function (x) { return M.fmtRoas(x, th); };
    var scope = (ctx.shopLabel || 'Tất cả shop') + (ctx.campLabel ? ' · chiến dịch “' + ctx.campLabel + '”' : '');
    if (!s.n) {
      out.push({ k: 'warn', t: 'Chưa đủ dữ liệu: kỳ ' + M.fmtPeriod(ctx.f.from, ctx.f.to) + ' (' + scope + ') chưa có báo cáo quảng cáo có cột Chi phí và Doanh thu gộp nên chưa tính được ROAS/CIR. Cần nhập file báo cáo GMV Max / chiến dịch xuất từ TikTok.' });
      if (s.excluded.length) out.push({ k: 'info', t: s.excluded.length + ' dòng số liệu cấp kỳ chỉ trùng một phần với kỳ lọc nên không được tính (không tự chia nhỏ). Chọn kỳ lọc bao trọn kỳ của file.' });
      shopComments(ctx, out);
      return out;
    }
    var cov = s.coverage ? M.fmtPeriod(s.coverage.from, s.coverage.to) : '';
    out.push({ k: 'info', t: 'Kỳ ' + M.fmtPeriod(ctx.f.from, ctx.f.to) + ' (' + scope + '; số liệu thực có ' + cov + '): chi phí Ads ' + M.fmtMoney(s.cost) + ', doanh thu gộp theo báo cáo quảng cáo ' + M.fmtMoney(s.rev) + ' → ROAS ' + R(s.roas) + ', CIR ' + M.fmtPct(s.cir) + '.' });
    if (s.roas == null) out.push({ k: 'warn', t: 'Chi phí Ads bằng 0 → ROAS: Không xác định; doanh thu còn thiếu: Không xác định.' });
    ctx.targets.forEach(function (t) {
      if (s.roas == null) return;
      var name = 'mốc ' + M.fmtNum(t.t, t.t % 1 ? 1 : 0) + (t.isOfficial ? ' (mốc chính thức)' : '');
      if (t.reached) out.push({ k: 'good', t: 'So với ' + name + ': thực tế ' + R(s.roas) + ', cao hơn mục tiêu ' + M.fmtNum(t.gap, 2) + ' điểm; không thiếu doanh thu ở mức chi hiện tại.' });
      else {
        var line = 'So với ' + name + ': thực tế ' + R(s.roas) + ', thấp hơn mục tiêu ' + M.fmtNum(-t.gap, 2) + ' điểm; cần thêm ' + M.fmtMoney(t.shortfall) + ' doanh thu gộp ở mức chi hiện tại (= ' + M.fmtNum(t.t, t.t % 1 ? 1 : 0) + ' × ' + M.fmtMoney(s.cost) + ' − ' + M.fmtMoney(s.rev) + ').';
        if (t.required != null) line += ' Nếu chi thêm ' + M.fmtMoney(t.remaining) + ', phần chi còn lại cần ROAS ≥ ' + M.fmtNum(t.required, 2) + ' để cả kỳ đạt mốc.';
        out.push({ k: 'bad', t: line });
      }
    });
    if (ctx.official == null) out.push({ k: 'info', t: 'Chưa chốt mốc ROAS chính thức – các so sánh với mốc 12 và 13 mang tính tham khảo, KHÔNG kết luận đạt hay không đạt thưởng.' });
    else {
      var ot = ctx.targets.filter(function (t) { return t.isOfficial; })[0];
      if (ot && s.roas != null) out.push({ k: ot.reached ? 'good' : 'bad', t: 'Theo mốc chính thức ' + M.fmtNum(ot.t, 2) + ': ' + (ot.reached ? 'ĐẠT' : 'CHƯA ĐẠT') + ' (thực tế ' + R(s.roas) + (ot.reached ? '' : ', còn thiếu ' + M.fmtMoney(ot.shortfall)) + ')' + (s.partial.length ? ' – tạm tính vì có ngày chưa kết thúc.' : '.') });
    }
    if (s.skuKnown) out.push({ k: 'info', t: 'Số đơn SKU ' + M.fmtNum(s.sku) + ' → chi phí/đơn SKU ' + M.fmtMoney(s.cpo) + '.' });
    else out.push({ k: 'warn', t: 'Chi phí/đơn SKU: Chưa đủ dữ liệu (' + s.skuMissingRows + ' dòng báo cáo quảng cáo không có cột Số đơn SKU).' });
    if (s.hasCampaign && th.length) {
      var ti = ctx.rankIndex || 0, rk = M.ranking(s, th, ti);
      if (rk.length) {
        var c = rk[0];
        out.push({ k: 'bad', t: rk.length + ' chiến dịch dưới mốc ' + M.fmtNum(th[ti], 0) + '. Cần xử lý trước: “' + c.name + '” thiếu ' + M.fmtMoney(c.short[ti]) + ' (chi phí ' + M.fmtMoney(c.cost) + ', ROAS ' + R(c.roas) + ').' });
      } else out.push({ k: 'good', t: 'Không có chiến dịch nào dưới mốc ' + M.fmtNum(th[ti], 0) + '.' });
    } else if (s.n) out.push({ k: 'info', t: 'Dữ liệu quảng cáo chỉ có cấp shop – không xếp hạng chiến dịch (không tự phân bổ).' });
    if (s.byDay.length >= 2) {
      var best = s.byDay.filter(function (d) { return d.roas != null && !d.partial; }).sort(function (a, b) { return a.roas - b.roas; });
      if (best.length >= 2) out.push({ k: 'info', t: 'ROAS ngày thấp nhất ' + R(best[0].roas) + ' (' + M.fmtDate(best[0].date) + '), cao nhất ' + R(best[best.length - 1].roas) + ' (' + M.fmtDate(best[best.length - 1].date) + ').' });
    }
    if (s.partial.length) out.push({ k: 'warn', t: 'Ngày chưa kết thúc: ' + s.partial.map(M.fmtDate).join(', ') + ' – số liệu còn thay đổi, kết luận là tạm tính.' });
    if (s.excluded.length) out.push({ k: 'warn', t: s.excluded.length + ' dòng số liệu cấp kỳ chỉ trùng một phần với kỳ lọc nên không được tính.' });
    shopComments(ctx, out);
    var o = ctx.orders;
    if (o && o.n) {
      if (o.cancelRateCount != null) out.push({ k: 'info', t: 'Đơn hàng (file đơn hàng): ' + M.fmtNum(o.orders) + ' đơn duy nhất / ' + M.fmtNum(o.skuLines) + ' đơn SKU; tỷ lệ hủy theo số đơn ' + M.fmtPct(o.cancelRateCount) + (o.cancelRateValue != null ? ', theo giá trị ' + M.fmtPct(o.cancelRateValue) : '') + '.' });
      if (o.netSales != null) out.push({ k: 'info', t: 'Doanh số sau hoàn/hủy (file đơn hàng): ' + M.fmtMoney(o.netSales) + ' – khác doanh thu gộp theo báo cáo quảng cáo vì khác nguồn và cách ghi nhận; không cộng lẫn.' });
    }
    return out;
  };

  root.TTSM = M;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : this);
