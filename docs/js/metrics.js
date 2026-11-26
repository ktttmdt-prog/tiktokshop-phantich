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
    ['ads', 'acct', 'topup', 'inv', 'ord', 'stl', 'vid', 'aff', 'shop', 'booking'].forEach(function (k) { cube['_' + k] = M.table(cube[k] || { cols: [], rows: [] }); });
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
    var keys = ['gmv', 'orders', 'sku', 'items', 'refund', 'totalRevenue', 'pageViews', 'impr', 'clicks'].concat(M.CHANNELS.map(function (c) { return c.k; }));
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
    if (!o.n) out.push('Bổ sung file đơn hàng (có trạng thái, số tiền đơn, tiền hoàn) để tính tỷ lệ hủy/hoàn và doanh số sau hoàn/hủy.');
    if (!ctx.stl.n) out.push('Bổ sung file quyết toán để đối chiếu doanh thu với tiền TikTok thực chuyển về.');
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
