/* Báo cáo Excel đầy đủ theo bộ lọc: sheet dữ liệu chi tiết + tổng hợp bằng CÔNG THỨC (SUM/SUMIFS/IF/MAX) qua tên vùng;
   sheet "Tham số" có ô nhập mốc ROAS / ngân sách – sửa là Excel tự tính lại. */
(function (root) {
  'use strict';
  var K = root.TTSK, SC = root.TTSS, D = root.TTSD, Q = root.TTSQ, X = root.TTSX, S = X.S, R = {};
  var UNDEF = 'Không xác định', NODATA = 'Chưa đủ dữ liệu';
  function n(x) { return typeof x === 'number' ? x : 0; }
  function nv(x) { return typeof x === 'number' ? x : null; }
  function L(c) { return X.col(c); }
  function q(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
  function vn(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; }
  function fmt(t) { return t % 1 ? String(Math.round(t * 100) / 100) : String(t); }
  function ratio(a, b) { return b === 0 ? UNDEF : a / b; }
  function rnd0(x) { return Math.sign(x) * Math.round(Math.abs(x)); }
  function ratioF(num, den) { return 'IF(' + den + '=0,' + q(UNDEF) + ',' + num + '/' + den + ')'; }
  function statusF(x, k) {
    var inner = '"Từ "&MocROAS_' + k + '&" trở lên"';
    for (var i = k; i >= 1; i--) inner = 'IF(' + x + '<MocROAS_' + i + ',' + (i === 1 ? '"Dưới "&MocROAS_1' : '"Từ "&MocROAS_' + (i - 1) + '&" đến dưới "&MocROAS_' + i) + ',' + inner + ')';
    return 'IF(ISNUMBER(' + x + '),' + inner + ',' + q(UNDEF) + ')';
  }
  function statusV(roas, th) {
    if (typeof roas !== 'number') return UNDEF; var i = 0; while (i < th.length && roas >= th[i]) i++;
    if (!i) return 'Dưới ' + fmt(th[0]); if (i === th.length) return 'Từ ' + fmt(th[th.length - 1]) + ' trở lên';
    return 'Từ ' + fmt(th[i - 1]) + ' đến dưới ' + fmt(th[i]);
  }

  R.build = function (req) { // req: {from,to,shop,ent,remaining,rankIndex,comments}
    var c = { q: req, b: X.book(), today: K.today(), file: {}, shopIdx: {}, notes: [], meta: new Map(), th: D.settings.thresholds.slice().sort(function (a, b) { return a - b; }), official: D.settings.official };
    D.imports.forEach(function (i) { c.file[i.id] = i.fileName; });
    var thamSo = params(c), ads = adsSheets(c), shop = shopSheet(c), ord = orders(c);
    orderLines(c); settlement(c);
    var cost = costSheet(c), gd = txSheet(c), hd = invoices(c); video(c); affiliate(c);
    var dc = recon(c, ads, ord, cost, gd, hd, shop); sources(c);
    var tq = overview(c, ads, shop);
    var b = c.b, mv = function (s, i) { b.sheets.splice(b.sheets.indexOf(s), 1); b.sheets.splice(i, 0, s); };
    mv(tq, 0); mv(thamSo, 1); mv(dc, 2);
    return X.build(b);
  };

  function inside(c, ds) {
    return Array.from(D.tables[ds].values()).filter(function (r) { return r.active && (!c.q.shop || r.shop === c.q.shop) && r.from && r.from >= c.q.from && (r.to || r.from) <= c.q.to; });
  }
  function partialOverlap(c, ds) {
    return Array.from(D.tables[ds].values()).filter(function (r) { var t = r.to || r.from; return r.active && (!c.q.shop || r.shop === c.q.shop) && r.from && !(t < c.q.from || r.from > c.q.to) && !(r.from >= c.q.from && t <= c.q.to); });
  }
  function shopNo(c, s) { if (!c.shopIdx[s]) c.shopIdx[s] = Object.keys(c.shopIdx).length + 1; return c.shopIdx[s]; }
  function head(c, s, title, subs) {
    s.set(1, 0, title, S.Title);
    var r = 2; s.set(r++, 0, 'Kỳ lọc: ' + vn(c.q.from) + ' – ' + vn(c.q.to) + ' · ' + (c.q.shop ? 'Shop: ' + D.shopName(c.q.shop) : 'Tất cả shop'), S.Note);
    (subs || []).forEach(function (x) { s.set(r++, 0, x, S.Note); });
    return r + 1;
  }
  function header(s, row, cols, widths) { cols.forEach(function (t, i) { s.set(row, i, t, S.Header); if (widths && widths[i]) s.widths[i] = widths[i]; }); s.freeze = row; }
  function nameRange(c, s, n, col, a, b) { c.b.name(n, s.absRange(a, col, b)); }
  function nameCell(c, s, n, r, col) { c.b.name(n, s.abs(r, col)); }
  function sortBy(arr, fn) { return arr.sort(function (a, b) { var x = fn(a), y = fn(b); return x < y ? -1 : x > y ? 1 : 0; }); }

  function params(c) {
    var s = c.b.add('Tham số'); s.tab = 'FFFAB219';
    s.set(1, 0, 'Tham số báo cáo – sửa các ô màu vàng, mọi công thức trong file tự tính lại', S.Title);
    s.widths[0] = 58; s.widths[1] = 22; s.widths[2] = 60;
    var r = 3;
    [['Kỳ lọc', vn(c.q.from) + ' – ' + vn(c.q.to)], ['Shop', c.q.shop ? D.shopName(c.q.shop) : 'Tất cả shop (gộp)'], ['Chiến dịch', c.q.ent || 'Tất cả'], ['Thời điểm lập', K.nowStr()]].forEach(function (x) { s.set(r, 0, x[0], S.Bold); s.set(r++, 1, x[1], S.Text); });
    r++; s.set(r++, 0, 'Mốc ROAS (doanh thu gộp ÷ chi phí Ads)', S.Section);
    c.th.forEach(function (t, k) { s.set(r, 0, 'Mốc ROAS ' + (k + 1), S.Bold); s.set(r, 1, t, S.InNum2); nameCell(c, s, 'MocROAS_' + (k + 1), r, 1); s.set(r++, 2, k ? 'Mốc phải lớn hơn mốc trước' : 'Mốc thấp nhất', S.Note); });
    s.set(r, 0, 'Mốc chính thức để kết luận đạt thưởng (để trống = chưa chọn)', S.Bold); s.set(r, 1, c.official == null ? null : c.official, S.InNum2); nameCell(c, s, 'MocChinhThuc', r, 1); s.set(r++, 2, 'Để trống: không kết luận đạt/không đạt thưởng', S.Note);
    s.set(r, 0, 'Ngân sách dự kiến còn chi trong kỳ (đồng)', S.Bold); s.set(r, 1, c.q.remaining || 0, S.InMoney); nameCell(c, s, 'NganSachConChi', r, 1); s.set(r++, 2, 'Dùng tính ROAS cần đạt trên khoản chi còn lại', S.Note);
    r++;
    s.set(r++, 0, 'ROAS = Tổng doanh thu gộp theo báo cáo quảng cáo ÷ Tổng chi phí Ads; CIR = Tổng chi phí Ads ÷ Tổng doanh thu gộp; tính lại từ số tổng.', S.Note);
    s.set(r++, 0, 'Doanh thu còn thiếu = MAX(0, mốc × chi phí Ads − doanh thu gộp). Mẫu số bằng 0 → “Không xác định”.', S.Note);
    return s;
  }

  function adsSheets(c) {
    var info = { has: false, cost: 0, rev: 0, sku: 0, miss: 0 };
    var rows = sortBy(inside(c, 'ads_campaign').filter(function (r) { return !c.q.ent || r.ent === c.q.ent; }), function (r) { return r.from + '|' + r.ent + '|' + r.shop; });
    info.partial = partialOverlap(c, 'ads_campaign');
    if (!rows.length) return info;
    info.has = true;
    var camp = {}, cname = {}, cid = {};
    rows.forEach(function (r) { var k = r.shop + '|' + r.ent; if (!camp[k]) { var i = Object.keys(camp).length + 1; camp[k] = i; cname[i] = r.v.campaign_name || r.v.campaign_id || '(Toàn shop – không có chiến dịch)'; cid[i] = r.v.campaign_id || ''; } });
    var s = c.b.add('QC chi tiết');
    var hr = head(c, s, 'Báo cáo quảng cáo – dữ liệu chi tiết (nguồn cho các bảng tổng hợp)', ['Mỗi dòng là một dòng đã nhập từ file báo cáo quảng cáo. Cột ROAS/CIR là công thức.']);
    header(s, hr, ['STT', 'Shop', 'Mã shop', 'Từ ngày', 'Đến ngày', 'Mã CD', 'ID chiến dịch', 'Tên chiến dịch', 'Chi phí Ads', 'Doanh thu gộp', 'Đơn SKU', 'ROAS', 'CIR', 'Chi phí/đơn SKU', 'ROI ghi trong file', 'Ngày chưa kết thúc', 'Lần nhập #', 'File nguồn', 'Dòng trong file'], [6, 22, 8, 12, 12, 7, 20, 34, 16, 18, 10, 9, 9, 14, 10, 10, 9, 40, 9]);
    var r0 = hr + 1, row = r0;
    rows.forEach(function (r) {
      var cd = camp[r.shop + '|' + r.ent], cost = n(r.v.cost), rev = n(r.v.revenue), sku = nv(r.v.sku_orders);
      info.cost += cost; info.rev += rev; if (sku != null) info.sku += sku; else info.miss++;
      s.set(row, 0, row - r0 + 1, S.Int); s.set(row, 1, D.shopName(r.shop)); s.set(row, 2, shopNo(c, r.shop), S.Int); s.set(row, 3, r.from, S.Date); s.set(row, 4, r.to, S.Date);
      s.set(row, 5, cd, S.Int); s.set(row, 6, cid[cd]); s.set(row, 7, cname[cd]); s.set(row, 8, cost, S.Money); s.set(row, 9, rev, S.Money); s.set(row, 10, sku, S.Int);
      s.fx(row, 11, ratioF('J' + row, 'I' + row), ratio(rev, cost), S.Num2); s.fx(row, 12, ratioF('I' + row, 'J' + row), ratio(cost, rev), S.Pct);
      s.fx(row, 13, 'IF(K' + row + '="",' + q(NODATA) + ',IF(K' + row + '=0,' + q(UNDEF) + ',ROUND(I' + row + '/K' + row + ',0)))', sku == null ? NODATA : sku === 0 ? UNDEF : rnd0(cost / sku), S.Money);
      s.set(row, 14, nv(r.v.roi_file), S.Num2); s.set(row, 15, (r.partial || r.to >= c.today) ? 'Có' : ''); s.set(row, 16, r.imp, S.Int); s.set(row, 17, c.file[r.imp] || ''); s.set(row, 18, r.row, S.Int);
      row++;
    });
    var last = row - 1, tr = row;
    s.set(tr, 1, 'TỔNG (công thức)', S.TotText); [0, 2, 3, 4, 5, 6, 7].forEach(function (k) { s.set(tr, k, '', S.TotText); });
    s.fx(tr, 8, 'SUM(I' + r0 + ':I' + last + ')', info.cost, S.TotMoney); s.fx(tr, 9, 'SUM(J' + r0 + ':J' + last + ')', info.rev, S.TotMoney); s.fx(tr, 10, 'SUM(K' + r0 + ':K' + last + ')', info.sku, S.TotMoney);
    s.fx(tr, 11, ratioF('J' + tr, 'I' + tr), ratio(info.rev, info.cost), S.TotNum2); s.fx(tr, 12, ratioF('I' + tr, 'J' + tr), ratio(info.cost, info.rev), S.TotPct);
    s.fx(tr, 13, 'IF(COUNTBLANK(K' + r0 + ':K' + last + ')>0,' + q(NODATA) + ',IF(K' + tr + '=0,' + q(UNDEF) + ',ROUND(I' + tr + '/K' + tr + ',0)))', info.miss ? NODATA : info.sku === 0 ? UNDEF : rnd0(info.cost / info.sku), S.TotMoney);
    s.filter = 'A' + hr + ':' + L(18) + last;
    [['QC_MaShop', 2], ['QC_TuNgay', 3], ['QC_DenNgay', 4], ['QC_MaCD', 5], ['QC_ChiPhi', 8], ['QC_DoanhThu', 9], ['QC_DonSKU', 10]].forEach(function (x) { nameRange(c, s, x[0], x[1], r0, last); });
    nameCell(c, s, 'TongChiPhiQC', tr, 8); nameCell(c, s, 'TongDoanhThuQC', tr, 9); nameCell(c, s, 'TongDonSKU', tr, 10); nameCell(c, s, 'QC_ChiPhiTrenDon', tr, 13);
    if (info.partial.length) s.set(tr + 2, 0, '! ' + info.partial.length + ' dòng số liệu cấp kỳ chỉ trùng một phần với kỳ lọc nên KHÔNG đưa vào (không tự chia nhỏ).', S.Note);

    // theo ngày
    var days = Array.from(new Set(rows.filter(function (r) { return r.from === r.to; }).map(function (r) { return r.from; }))).sort();
    if (days.length) {
      var sd = c.b.add('QC theo ngày'), h2 = head(c, sd, 'Quảng cáo theo ngày (SUMIFS từ sheet QC chi tiết)');
      header(sd, h2, ['Ngày', 'Chi phí Ads', 'Doanh thu gộp', 'Đơn SKU', 'Chi phí/đơn SKU', 'ROAS', 'CIR', 'Trạng thái', 'Ngày chưa kết thúc'], [12, 16, 18, 10, 14, 9, 9, 22, 10]);
      var a0 = h2 + 1, rr = a0, tc = 0, tv = 0, ts = 0;
      days.forEach(function (d) {
        var dr = rows.filter(function (r) { return r.from === d && r.to === d; }), cost = 0, rev = 0, sku = 0; dr.forEach(function (r) { cost += n(r.v.cost); rev += n(r.v.revenue); sku += n(r.v.sku_orders); });
        tc += cost; tv += rev; ts += sku; var roas = ratio(rev, cost);
        sd.set(rr, 0, d, S.Date);
        sd.fx(rr, 1, 'SUMIFS(QC_ChiPhi,QC_TuNgay,$A' + rr + ',QC_DenNgay,$A' + rr + ')', cost, S.Money); sd.fx(rr, 2, 'SUMIFS(QC_DoanhThu,QC_TuNgay,$A' + rr + ',QC_DenNgay,$A' + rr + ')', rev, S.Money);
        sd.fx(rr, 3, 'SUMIFS(QC_DonSKU,QC_TuNgay,$A' + rr + ',QC_DenNgay,$A' + rr + ')', sku, S.Int);
        sd.fx(rr, 4, 'IF(D' + rr + '=0,' + q(UNDEF) + ',ROUND(B' + rr + '/D' + rr + ',0))', sku === 0 ? UNDEF : rnd0(cost / sku), S.Money);
        sd.fx(rr, 5, ratioF('C' + rr, 'B' + rr), roas, S.Num2); sd.fx(rr, 6, ratioF('B' + rr, 'C' + rr), ratio(cost, rev), S.Pct); sd.fx(rr, 7, statusF('F' + rr, c.th.length), statusV(roas, c.th));
        sd.set(rr, 8, (dr.some(function (r) { return r.partial; }) || d >= c.today) ? 'Có' : ''); rr++;
      });
      var dl = rr - 1, troas = ratio(tv, tc);
      sd.set(rr, 0, 'TỔNG', S.TotText); sd.fx(rr, 1, 'SUM(B' + a0 + ':B' + dl + ')', tc, S.TotMoney); sd.fx(rr, 2, 'SUM(C' + a0 + ':C' + dl + ')', tv, S.TotMoney); sd.fx(rr, 3, 'SUM(D' + a0 + ':D' + dl + ')', ts, S.TotMoney);
      sd.fx(rr, 4, 'IF(D' + rr + '=0,' + q(UNDEF) + ',ROUND(B' + rr + '/D' + rr + ',0))', ts === 0 ? UNDEF : rnd0(tc / ts), S.TotMoney); sd.fx(rr, 5, ratioF('C' + rr, 'B' + rr), troas, S.TotNum2);
      sd.fx(rr, 6, ratioF('B' + rr, 'C' + rr), ratio(tc, tv), S.TotPct); sd.fx(rr, 7, statusF('F' + rr, c.th.length), statusV(troas, c.th), S.TotText); sd.set(rr, 8, '', S.TotText);
      sd.filter = 'A' + h2 + ':I' + dl;
      if (rows.some(function (r) { return r.from !== r.to; })) sd.set(rr + 2, 0, 'Có dòng số liệu cấp kỳ (không có ngày) – tính trong QC chi tiết, không chia theo ngày.', S.Note);
    }
    // theo chiến dịch
    var sc = c.b.add('QC theo chiến dịch'), ti = Math.min(c.q.rankIndex || 0, c.th.length - 1);
    var h3 = head(c, sc, 'Chiến dịch – xếp theo doanh thu còn thiếu so với mốc ROAS ' + fmt(c.th[ti]), ['Chi phí/doanh thu = SUMIFS theo Mã CD. Dòng TỔNG ≠ tổng số thiếu từng chiến dịch (chiến dịch vượt mốc bù cho chiến dịch dưới mốc).']);
    header(sc, h3, ['Mã CD', 'ID chiến dịch', 'Tên chiến dịch', 'Shop', 'Chi phí Ads', 'Doanh thu gộp', 'Đơn SKU', 'ROAS', 'Trạng thái'].concat(c.th.map(function (t) { return 'Thiếu để đạt ROAS ' + fmt(t); })), [7, 20, 34, 20, 16, 18, 10, 9, 22, 18, 18, 18, 18]);
    var list = Object.keys(camp).map(function (k) {
      var cr = rows.filter(function (r) { return r.shop + '|' + r.ent === k; }), cost = 0, rev = 0, sku = 0; cr.forEach(function (r) { cost += n(r.v.cost); rev += n(r.v.revenue); sku += n(r.v.sku_orders); });
      return { idx: camp[k], shop: cr[0].shop, cost: cost, rev: rev, sku: sku, sh: cost > 0 ? Math.max(0, c.th[ti] * cost - rev) : -1 };
    }).sort(function (a, b) { return b.sh - a.sh || b.cost - a.cost; });
    var b0 = h3 + 1, r3 = b0;
    list.forEach(function (x) {
      var roas = ratio(x.rev, x.cost);
      sc.set(r3, 0, x.idx, S.Int); sc.set(r3, 1, cid[x.idx]); sc.set(r3, 2, cname[x.idx]); sc.set(r3, 3, D.shopName(x.shop));
      sc.fx(r3, 4, 'SUMIFS(QC_ChiPhi,QC_MaCD,$A' + r3 + ')', x.cost, S.Money); sc.fx(r3, 5, 'SUMIFS(QC_DoanhThu,QC_MaCD,$A' + r3 + ')', x.rev, S.Money); sc.fx(r3, 6, 'SUMIFS(QC_DonSKU,QC_MaCD,$A' + r3 + ')', x.sku, S.Int);
      sc.fx(r3, 7, ratioF('F' + r3, 'E' + r3), roas, S.Num2); sc.fx(r3, 8, statusF('H' + r3, c.th.length), statusV(roas, c.th));
      c.th.forEach(function (t, k) { sc.fx(r3, 9 + k, 'IF(E' + r3 + '=0,' + q(UNDEF) + ',MAX(0,ROUND(MocROAS_' + (k + 1) + '*E' + r3 + '-F' + r3 + ',0)))', x.cost === 0 ? UNDEF : Math.max(0, rnd0(t * x.cost - x.rev)), S.Money); });
      r3++;
    });
    var cl = r3 - 1, tro = ratio(info.rev, info.cost);
    [0, 1, 3].forEach(function (k) { sc.set(r3, k, '', S.TotText); }); sc.set(r3, 2, 'TỔNG (tính lại từ số tổng)', S.TotText);
    sc.fx(r3, 4, 'SUM(E' + b0 + ':E' + cl + ')', info.cost, S.TotMoney); sc.fx(r3, 5, 'SUM(F' + b0 + ':F' + cl + ')', info.rev, S.TotMoney); sc.fx(r3, 6, 'SUM(G' + b0 + ':G' + cl + ')', info.sku, S.TotMoney);
    sc.fx(r3, 7, ratioF('F' + r3, 'E' + r3), tro, S.TotNum2); sc.fx(r3, 8, statusF('H' + r3, c.th.length), statusV(tro, c.th), S.TotText);
    c.th.forEach(function (t, k) { sc.fx(r3, 9 + k, 'IF(E' + r3 + '=0,' + q(UNDEF) + ',MAX(0,ROUND(MocROAS_' + (k + 1) + '*E' + r3 + '-F' + r3 + ',0)))', info.cost === 0 ? UNDEF : Math.max(0, rnd0(t * info.cost - info.rev)), S.TotMoney); });
    sc.filter = 'A' + h3 + ':' + L(8 + c.th.length) + cl;
    // theo shop
    var shops = Array.from(new Set(rows.map(function (r) { return r.shop; })));
    if (shops.length > 1) {
      var ss = c.b.add('QC theo shop'), h4 = head(c, ss, 'Quảng cáo theo shop (SUMIFS theo Mã shop; dòng tổng tính lại từ số tổng)');
      header(ss, h4, ['Mã shop', 'Shop', 'Chi phí Ads', 'Doanh thu gộp', 'Đơn SKU', 'ROAS', 'CIR', 'Trạng thái'], [8, 26, 16, 18, 10, 9, 9, 22]);
      var e0 = h4 + 1, r4 = e0;
      shops.forEach(function (sh) {
        var cost = 0, rev = 0, sku = 0; rows.forEach(function (r) { if (r.shop === sh) { cost += n(r.v.cost); rev += n(r.v.revenue); sku += n(r.v.sku_orders); } });
        var roas = ratio(rev, cost);
        ss.set(r4, 0, shopNo(c, sh), S.Int); ss.set(r4, 1, D.shopName(sh));
        ss.fx(r4, 2, 'SUMIFS(QC_ChiPhi,QC_MaShop,$A' + r4 + ')', cost, S.Money); ss.fx(r4, 3, 'SUMIFS(QC_DoanhThu,QC_MaShop,$A' + r4 + ')', rev, S.Money); ss.fx(r4, 4, 'SUMIFS(QC_DonSKU,QC_MaShop,$A' + r4 + ')', sku, S.Int);
        ss.fx(r4, 5, ratioF('D' + r4, 'C' + r4), roas, S.Num2); ss.fx(r4, 6, ratioF('C' + r4, 'D' + r4), ratio(cost, rev), S.Pct); ss.fx(r4, 7, statusF('F' + r4, c.th.length), statusV(roas, c.th)); r4++;
      });
      var sl = r4 - 1;
      ss.set(r4, 0, '', S.TotText); ss.set(r4, 1, 'GỘP CÁC SHOP', S.TotText);
      ss.fx(r4, 2, 'SUM(C' + e0 + ':C' + sl + ')', info.cost, S.TotMoney); ss.fx(r4, 3, 'SUM(D' + e0 + ':D' + sl + ')', info.rev, S.TotMoney); ss.fx(r4, 4, 'SUM(E' + e0 + ':E' + sl + ')', info.sku, S.TotMoney);
      ss.fx(r4, 5, ratioF('D' + r4, 'C' + r4), tro, S.TotNum2); ss.fx(r4, 6, ratioF('C' + r4, 'D' + r4), ratio(info.cost, info.rev), S.TotPct); ss.fx(r4, 7, statusF('F' + r4, c.th.length), statusV(tro, c.th), S.TotText);
    }
    return info;
  }

  var CHK = ['gmv_creator_live', 'gmv_seller_live', 'gmv_product_card', 'gmv_creator_video', 'gmv_seller_video'];
  var CHL = ['LIVE của nhà sáng tạo', 'LIVE của tài khoản shop', 'Thẻ sản phẩm', 'Video của nhà sáng tạo', 'Video của tài khoản shop'];
  function shopSheet(c) {
    var info = { has: false, gmv: 0, orders: 0, sku: 0, refund: 0, ch: [0, 0, 0, 0, 0] };
    var rows = sortBy(inside(c, 'shop_daily'), function (r) { return r.from + '|' + r.shop; });
    if (!rows.length) return info;
    info.has = true;
    var s = c.b.add('Phân tích shop');
    var hr = head(c, s, 'Phân tích shop – chỉ số theo ngày (toàn shop, mọi kênh)', ['Cột có dấu * là số duy nhất / tỷ lệ theo ngày – không cộng qua nhiều ngày. Hoàn tiền ghi theo ngày phát sinh hoàn – không dùng tính tỷ lệ hoàn.']);
    header(s, hr, ['Ngày', 'Shop', 'GMV toàn shop', 'Đơn hàng', 'Đơn hàng SKU', 'SKU/đơn', 'Số món bán ra', 'AOV (GMV ÷ đơn)', 'Hoàn tiền', 'Tổng doanh thu (TikTok)', 'Lượt xem trang', 'Lượt hiển thị SP', 'Lượt nhấp SP', 'CTR SP']
      .concat(CHL.map(function (x) { return 'GMV ' + x; })).concat(['Khách hàng*', 'Khách truy cập*', 'Tỷ lệ chuyển đổi*', 'AOV TikTok*', 'Hiển thị SP độc nhất*', 'Nhấp độc nhất*', 'Ngày chưa kết thúc', 'Lần nhập #']),
      [12, 22, 18, 11, 12, 9, 12, 14, 16, 18, 13, 15, 13, 9, 18, 18, 18, 18, 18, 11, 12, 11, 12, 13, 12, 10, 9]);
    var r0 = hr + 1, row = r0, sums = {};
    var addCols = { 2: 'gmv', 3: 'orders', 4: 'sku_orders', 6: 'items_sold', 8: 'refund', 9: 'total_revenue', 10: 'page_views', 11: 'impressions', 12: 'clicks', 14: CHK[0], 15: CHK[1], 16: CHK[2], 17: CHK[3], 18: CHK[4] };
    rows.forEach(function (r) {
      var v = r.v; info.gmv += n(v.gmv); info.orders += n(v.orders); info.sku += n(v.sku_orders); info.refund += n(v.refund); CHK.forEach(function (k, i) { info.ch[i] += n(v[k]); });
      s.set(row, 0, r.from, S.Date); s.set(row, 1, D.shopName(r.shop));
      Object.keys(addCols).forEach(function (col) { s.set(row, +col, nv(v[addCols[col]]), S.Money); sums[col] = (sums[col] || 0) + n(v[addCols[col]]); });
      s.fx(row, 5, ratioF('E' + row, 'D' + row), n(v.orders) ? n(v.sku_orders) / v.orders : UNDEF, S.Num2);
      s.fx(row, 7, 'IF(D' + row + '=0,' + q(UNDEF) + ',ROUND(C' + row + '/D' + row + ',0))', n(v.orders) ? rnd0(n(v.gmv) / v.orders) : UNDEF, S.Money);
      s.fx(row, 13, ratioF('M' + row, 'L' + row), n(v.impressions) ? n(v.clicks) / v.impressions : UNDEF, S.Pct);
      s.set(row, 19, nv(v.customers), S.Int); s.set(row, 20, nv(v.visitors), S.Int); s.set(row, 21, nv(v.cvr), S.Pct); s.set(row, 22, nv(v.aov), S.Money); s.set(row, 23, nv(v.unique_impressions), S.Int); s.set(row, 24, nv(v.unique_clicks), S.Int);
      s.set(row, 25, (r.partial || r.from >= c.today) ? 'Có' : ''); s.set(row, 26, r.imp, S.Int); row++;
    });
    var last = row - 1, tr = row;
    s.set(tr, 0, 'TỔNG', S.TotText); s.set(tr, 1, '', S.TotText);
    Object.keys(addCols).forEach(function (col) { s.fx(tr, +col, 'SUM(' + L(+col) + r0 + ':' + L(+col) + last + ')', sums[col], S.TotMoney); });
    s.fx(tr, 5, ratioF('E' + tr, 'D' + tr), ratio(info.sku, info.orders), S.TotNum2);
    s.fx(tr, 7, 'IF(D' + tr + '=0,' + q(UNDEF) + ',ROUND(C' + tr + '/D' + tr + ',0))', info.orders ? rnd0(info.gmv / info.orders) : UNDEF, S.TotMoney);
    s.fx(tr, 13, ratioF('M' + tr, 'L' + tr), ratio(sums[12], sums[11]), S.TotPct);
    for (var k = 19; k <= 26; k++) s.set(tr, k, k === 19 ? 'không cộng' : '', S.TotText);
    s.filter = 'A' + hr + ':' + L(26) + last;
    nameCell(c, s, 'Shop_GMV', tr, 2); nameCell(c, s, 'Shop_Don', tr, 3); nameCell(c, s, 'Shop_DonSKU', tr, 4); nameCell(c, s, 'Shop_HoanTien', tr, 8);
    CHK.forEach(function (x, i) { nameCell(c, s, 'Shop_Kenh' + (i + 1), tr, 14 + i); });
    return info;
  }

  function orders(c) {
    var info = { has: false, T: new Array(21).fill(0) };
    var daily = Q.orderDaily(function (r) { return (!c.q.shop || r.shop === c.q.shop) && r.from >= c.q.from && r.from <= c.q.to; });
    if (!daily.length) return info;
    info.has = true;
    var s = c.b.add('Đơn hàng theo ngày');
    var hr = head(c, s, 'Đơn hàng theo ngày tạo đơn (mỗi đơn tính 1 lần, giá trị cấp đơn không nhân theo dòng SKU)', ['Doanh số sau hoàn/hủy = Giá trị đơn − giá trị đơn hủy − chưa thanh toán − không rõ trạng thái − tiền hoàn (công thức).']);
    header(s, hr, ['Ngày', 'Shop', 'Đơn hàng (duy nhất)', 'Đơn SKU (dòng)', 'Đơn nhiều SKU', 'Số lượng SP', 'Giá trị đơn', 'Giá trị SKU sau giảm', 'Đơn hủy', 'Giá trị đơn hủy', 'Đơn hoàn/trả', 'Tiền hoàn', 'Đơn chưa TT', 'Giá trị chưa TT', 'Đơn không rõ TT', 'Giá trị không rõ TT', 'Doanh số sau hoàn/hủy'], [12, 22, 12, 12, 11, 11, 16, 16, 9, 15, 10, 14, 10, 14, 10, 14, 18]);
    var map = [0, 1, 12, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20], r0 = hr + 1, row = r0, T = info.T;
    daily.forEach(function (x) {
      var a = x.a; for (var i = 0; i < 21; i++) if (i < 13 || i >= 18) T[i] += a[i];
      if (a[14]) info.hasStatus = true; if (a[15]) info.hasAmt = true; if (a[16]) info.hasRefund = true;
      s.set(row, 0, x.date, S.Date); s.set(row, 1, D.shopName(x.shop)); map.forEach(function (m, k) { s.set(row, 2 + k, a[m], S.Money); });
      s.fx(row, 16, 'G' + row + '-J' + row + '-N' + row + '-P' + row + '-L' + row, a[3] - a[6] - a[10] - a[20] - a[8], S.Money); row++;
    });
    var last = row - 1, tr = row;
    s.set(tr, 0, 'TỔNG', S.TotText); s.set(tr, 1, '', S.TotText);
    map.forEach(function (m, k) { s.fx(tr, 2 + k, 'SUM(' + L(2 + k) + r0 + ':' + L(2 + k) + last + ')', T[m], S.TotMoney); });
    s.fx(tr, 16, 'SUM(Q' + r0 + ':Q' + last + ')', T[3] - T[6] - T[10] - T[20] - T[8], S.TotMoney);
    s.filter = 'A' + hr + ':Q' + last;
    ['Ord_Don', 'Ord_DonSKU', 'Ord_NhieuSKU', 'Ord_SoLuong', 'Ord_GiaTri', 'Ord_GiaTriSKU', 'Ord_Huy', 'Ord_GiaTriHuy', 'Ord_Hoan', 'Ord_TienHoan', 'Ord_ChuaTT', 'Ord_GiaTriChuaTT', 'Ord_KhongRo', 'Ord_GiaTriKhongRo'].forEach(function (nm, k) { nameCell(c, s, nm, tr, 2 + k); });
    nameCell(c, s, 'Ord_DoanhSoSau', tr, 16);
    return info;
  }

  function detailSheet(c, dsKey, rows, name, title) {
    var ds = SC.get(dsKey), s = c.b.add(name);
    var hr = head(c, s, title, ['Nguồn: ' + ds.label + ' · ' + rows.length + ' dòng · cột “Lần nhập # / File / Dòng” để truy ngược file gốc.']);
    var fields = ds.stored.filter(function (f) { return rows.some(function (r) { return r.v[f.key] != null; }); });
    var cols = ['Shop'].concat(ds.hasScope ? ['Phạm vi'] : []).concat(['Từ ngày', 'Đến ngày']).concat(fields.map(function (f) { return f.label + (f.nonAdd ? '*' : ''); })).concat(['Lần nhập #', 'File nguồn', 'Dòng trong file']);
    header(s, hr, cols);
    var m = { first: hr + 1, colOf: {} }, row = hr + 1;
    rows.forEach(function (r) {
      var col = 0; s.set(row, col++, D.shopName(r.shop)); if (ds.hasScope) s.set(row, col++, r.scope);
      s.set(row, col++, r.from, S.Date); s.set(row, col++, r.to || r.from, S.Date);
      fields.forEach(function (f) {
        var v = r.v[f.key]; m.colOf[f.key] = col;
        var st = f.type === 'Money' || f.type === 'Int' ? S.Money : f.type === 'Num' ? S.Num2 : f.type === 'Ratio' ? S.Pct : f.type === 'Date' ? S.Date : f.type === 'DateTime' ? S.DateTime : S.Text;
        s.set(row, col++, v == null ? null : v, st);
      });
      s.set(row, col++, r.imp, S.Int); s.set(row, col++, c.file[r.imp] || ''); s.set(row, col++, r.row, S.Int); row++;
    });
    m.last = row - 1; m.total = row;
    s.set(row, 0, 'TỔNG (công thức)', S.TotText);
    fields.forEach(function (f) { if ((f.type === 'Money' || f.type === 'Int') && !f.nonAdd) { var cc = m.colOf[f.key], sum = 0; rows.forEach(function (r) { sum += n(r.v[f.key]); }); s.fx(row, cc, 'SUM(' + L(cc) + m.first + ':' + L(cc) + m.last + ')', sum, S.TotMoney); } });
    s.filter = 'A' + hr + ':' + L(cols.length - 1) + m.last;
    c.meta.set(s, m); return s;
  }
  function nameTotal(c, s, field, nm) { var m = c.meta.get(s); if (m && m.colOf[field] != null) nameCell(c, s, nm, m.total, m.colOf[field]); }
  function orderLines(c) {
    var rows = sortBy(inside(c, 'orders'), function (r) { return r.from + '|' + r.v.order_id + '|' + ('0000000' + r.row).slice(-7); });
    if (rows.length) detailSheet(c, 'orders', rows, 'Đơn hàng dòng SKU', 'Đơn hàng – từng dòng SKU (không có tên, SĐT, địa chỉ khách hàng)');
  }
  function settlement(c) {
    var rows = sortBy(inside(c, 'settlement'), function (r) { return r.from + '|' + ('0000000' + r.row).slice(-7); }); if (!rows.length) return;
    var s = detailSheet(c, 'settlement', rows, 'Quyết toán', 'Quyết toán / thu nhập – từng dòng (theo ngày quyết toán)');
    nameTotal(c, s, 'settlement_amount', 'Stl_Tong'); nameTotal(c, s, 'revenue', 'Stl_DoanhThu'); nameTotal(c, s, 'fees', 'Stl_Phi');
  }
  function costSheet(c) {
    var rows = sortBy(inside(c, 'ads_account_cost'), function (r) { return r.from + '|' + r.v.account_id; }), part = partialOverlap(c, 'ads_account_cost');
    if (!rows.length) { if (part.length) c.notes.push(part.length + ' dòng file Cost có kỳ chỉ trùng một phần với kỳ lọc nên không đưa vào.'); return false; }
    var s = detailSheet(c, 'ads_account_cost', rows, 'Chi phí TK quảng cáo', 'Chi phí quảng cáo theo tài khoản (file Cost) – số âm trong file đã đổi thành chi phí dương');
    nameTotal(c, s, 'amount', 'Cost_SoTien'); nameTotal(c, s, 'tax', 'Cost_Thue'); nameTotal(c, s, 'ad_credit', 'Cost_TinDungQC');
    if (part.length) s.set(c.meta.get(s).total + 2, 0, '! ' + part.length + ' dòng có kỳ chỉ trùng một phần với kỳ lọc nên không đưa vào.', S.Note);
    return true;
  }
  var TXL = { topup: 'Nạp tiền', billpay: 'Thanh toán hóa đơn', transfer: 'Chuyển số dư nội bộ', credit: 'Tăng/giảm số dư tín dụng', promo: 'Khuyến mãi', refund: 'Hoàn tiền', other: 'Khác' };
  function txSheet(c) {
    var rows = sortBy(inside(c, 'ads_topup'), function (r) { return r.v.time || ''; }); if (!rows.length) return false;
    var s = c.b.add('Giao dịch Ads');
    var hr = head(c, s, 'Giao dịch thanh toán TikTok Ads (file Transaction)', ['Nhóm & cột “Tính vào tiền thực trả” phân loại theo Loại giao dịch phụ + phương thức (Thẻ/Số dư). Số thẻ không được lưu. Kế toán xác nhận cách phân loại theo chính sách hạch toán.']);
    header(s, hr, ['Thời gian', 'Ngày', 'Tài khoản', 'ID tài khoản', 'Loại giao dịch', 'Loại phụ', 'Nhóm', 'Thanh toán', 'Trạng thái', 'Thành công (1/0)', 'Tính vào tiền thực trả (1/0)', 'Chứng từ', 'Loại tiền', 'Số tiền', 'Lần nhập #', 'File nguồn', 'Dòng'], [17, 12, 30, 21, 13, 18, 22, 11, 15, 10, 12, 20, 16, 16, 9, 40, 7]);
    var r0 = hr + 1, row = r0;
    rows.forEach(function (r) {
      var v = r.v, cls = Q.topupClass(v.tx_type, v.tx_subtype, v.money_type), ok = Q.topupOk(v.status), cash = ok && (cls === 'topup' || (cls === 'billpay' && v.pay_method !== 'Số dư'));
      s.set(row, 0, v.time, S.DateTime); s.set(row, 1, r.from, S.Date); s.set(row, 2, v.account_name); s.set(row, 3, v.account_id); s.set(row, 4, v.tx_type); s.set(row, 5, v.tx_subtype);
      s.set(row, 6, TXL[cls]); s.set(row, 7, v.pay_method || ''); s.set(row, 8, v.status); s.set(row, 9, ok ? 1 : 0, S.Int); s.set(row, 10, cash ? 1 : 0, S.Int);
      s.set(row, 11, v.voucher_no); s.set(row, 12, v.money_type); s.set(row, 13, n(v.amount), S.Money); s.set(row, 14, r.imp, S.Int); s.set(row, 15, c.file[r.imp] || ''); s.set(row, 16, r.row, S.Int); row++;
    });
    var last = row - 1;
    s.set(row, 0, 'TIỀN THỰC TRẢ (SUMIFS cột Tính vào tiền thực trả = 1)', S.TotText); s.fx(row, 13, 'SUMIFS(N' + r0 + ':N' + last + ',K' + r0 + ':K' + last + ',1)', null, S.TotMoney);
    s.filter = 'A' + hr + ':Q' + last;
    [['GD_Nhom', 6], ['GD_ThanhToan', 7], ['GD_ThanhCong', 9], ['GD_TinhTien', 10], ['GD_SoTien', 13]].forEach(function (x) { nameRange(c, s, x[0], x[1], r0, last); });
    return true;
  }
  var CAT = { ads: 'Quảng cáo (TikTok Ads)', platform: 'Phí dịch vụ / phí sàn TikTok Shop', creator: 'Hoa hồng nhà sáng tạo', other: 'Khác' };
  function invoices(c) {
    var rows = sortBy(inside(c, 'invoice'), function (r) { return r.from + '|' + r.v.invoice_no; }); if (!rows.length) return false;
    var cat = {}; D.imports.forEach(function (i) { cat[i.id] = i.category; });
    var s = c.b.add('Hóa đơn'), hr = head(c, s, 'Chi tiết hóa đơn TikTok (thuế thể hiện riêng)', ['Không lưu tên / MST / địa chỉ nhà sáng tạo.']);
    header(s, hr, ['Shop', 'Kỳ từ', 'Kỳ đến', 'Số hóa đơn', 'Bill ID', 'Loại thuế', 'Order ID', 'Diễn giải', 'Loại chi phí', 'Nhóm', 'Tổng tiền', 'Thuế suất', 'Tiền thuế', 'Tiền trước thuế', 'Thuế TNCN', 'Phải trả', 'Lần nhập #'], [20, 12, 12, 22, 20, 12, 20, 26, 16, 30, 16, 9, 14, 16, 13, 16, 9]);
    var r0 = hr + 1, row = r0;
    rows.forEach(function (r) {
      var v = r.v, k = Q.invoiceCategory(cat[r.imp], v.invoice_no, v.tax_type, v.description, v.expense_type);
      s.set(row, 0, D.shopName(r.shop)); s.set(row, 1, r.from, S.Date); s.set(row, 2, r.to, S.Date); s.set(row, 3, v.invoice_no); s.set(row, 4, v.bill_id); s.set(row, 5, v.tax_type); s.set(row, 6, v.order_id);
      s.set(row, 7, v.description); s.set(row, 8, v.expense_type); s.set(row, 9, CAT[k] || k); s.set(row, 10, nv(v.amount), S.Money); s.set(row, 11, nv(v.tax_rate), S.Pct); s.set(row, 12, nv(v.tax), S.Money);
      s.set(row, 13, nv(v.net), S.Money); s.set(row, 14, nv(v.pit), S.Money); s.set(row, 15, nv(v.payable), S.Money); s.set(row, 16, r.imp, S.Int); row++;
    });
    var last = row - 1; s.set(row, 0, 'TỔNG', S.TotText);
    [10, 12, 13, 14, 15].forEach(function (cc) { s.fx(row, cc, 'SUM(' + L(cc) + r0 + ':' + L(cc) + last + ')', null, S.TotMoney); });
    s.filter = 'A' + hr + ':Q' + last;
    [['HD_Nhom', 9], ['HD_TongTien', 10], ['HD_Thue', 12], ['HD_TruocThue', 13], ['HD_TNCN', 14]].forEach(function (x) { nameRange(c, s, x[0], x[1], r0, last); });
    return true;
  }
  function video(c) {
    var rows = sortBy(inside(c, 'video_daily'), function (r) { return r.scope + '|' + r.from; }); if (!rows.length) return;
    detailSheet(c, 'video_daily', rows, 'Video', 'Hiệu quả video theo ngày (kênh nội dung – không dùng tính ROAS)');
  }
  function affiliate(c) {
    var rows = sortBy(inside(c, 'affiliate_period'), function (r) { return r.from; }), part = partialOverlap(c, 'affiliate_period');
    if (!rows.length) { if (part.length) c.notes.push(part.length + ' kỳ Liên kết chỉ trùng một phần với kỳ lọc nên không đưa vào.'); return; }
    var s = detailSheet(c, 'affiliate_period', rows, 'Liên kết', 'Liên kết (affiliate) – chỉ số cốt lõi theo kỳ (chỉ kỳ nằm trọn trong kỳ lọc)');
    nameTotal(c, s, 'gmv', 'Aff_GMV'); nameTotal(c, s, 'commission', 'Aff_HoaHong');
  }

  function recon(c, ads, ord, cost, gd, hd, shop) {
    var s = c.b.add('Đối chiếu kế toán'); s.tab = 'FF1F4E79';
    s.set(1, 0, 'Kiểm soát số liệu kế toán (công thức tham chiếu các sheet dữ liệu)', S.Title);
    s.set(2, 0, 'Kỳ lọc: ' + vn(c.q.from) + ' – ' + vn(c.q.to) + ' · ' + (c.q.shop ? D.shopName(c.q.shop) : 'Tất cả shop'), S.Note);
    s.widths[0] = 58; s.widths[1] = 20; s.widths[2] = 70;
    var r = 4, has = function (x) { return c.b.has(x); }, T = ord.T;
    function sec(t) { r++; s.set(r++, 0, t, S.Section); s.set(r, 0, 'Chỉ tiêu', S.Header); s.set(r, 1, 'Giá trị', S.Header); s.set(r++, 2, 'Nguồn / cách tính', S.Header); }
    function line(label, f, cached, st, note) { s.set(r, 0, label); if (f == null) s.set(r, 1, cached, st); else s.fx(r, 1, f, cached, st); s.set(r, 2, note || ''); r++; }
    sec('A. Các chỉ tiêu doanh thu – khác nguồn, không cộng lẫn');
    line('Doanh thu gộp theo báo cáo quảng cáo', has('TongDoanhThuQC') ? 'TongDoanhThuQC' : null, has('TongDoanhThuQC') ? ads.rev : NODATA, S.Money, 'Sheet QC chi tiết – doanh thu TikTok quy cho quảng cáo, chưa trừ hủy/hoàn');
    var netOk = ord.has && ord.hasStatus && ord.hasAmt && ord.hasRefund;
    line('Doanh số sau hoàn/hủy (file đơn hàng)', netOk ? 'Ord_DoanhSoSau' : null, netOk ? T[3] - T[6] - T[10] - T[20] - T[8] : NODATA, S.Money, ord.has ? (netOk ? 'Sheet Đơn hàng theo ngày' : 'Thiếu cột trạng thái / số tiền đơn / số tiền hoàn') : 'Cần nhập file đơn hàng');
    line('Tiền quyết toán (file tài chính)', has('Stl_Tong') ? 'Stl_Tong' : null, has('Stl_Tong') ? null : NODATA, S.Money, has('Stl_Tong') ? 'Sheet Quyết toán – theo ngày quyết toán' : 'Cần nhập file quyết toán');
    line('GMV toàn shop (Phân tích shop – tham khảo)', shop.has ? 'Shop_GMV' : null, shop.has ? shop.gmv : NODATA, S.Money, shop.has ? 'Sheet Phân tích shop – mọi kênh, chưa trừ hủy/hoàn' : 'Cần nhập file Shop Analytics');
    sec('B. Đơn hàng');
    if (ord.has) {
      line('Số đơn hàng duy nhất', 'Ord_Don', T[0], S.Money, 'Đếm mã đơn khác nhau'); line('Số đơn SKU (dòng)', 'Ord_DonSKU', T[1], S.Money, 'Mỗi dòng SKU = 1 đơn SKU');
      if (ord.hasStatus) {
        line('Tỷ lệ hủy theo số đơn', 'IF(Ord_Don-Ord_KhongRo=0,' + q(UNDEF) + ',Ord_Huy/(Ord_Don-Ord_KhongRo))', ratio(T[5], T[0] - T[11]), S.Pct, 'Đơn hủy ÷ đơn có trạng thái');
        line('Tỷ lệ hủy theo giá trị', ord.hasAmt ? 'IF(Ord_GiaTri-Ord_GiaTriKhongRo=0,' + q(UNDEF) + ',Ord_GiaTriHuy/(Ord_GiaTri-Ord_GiaTriKhongRo))' : null, ord.hasAmt ? ratio(T[6], T[3] - T[20]) : NODATA, S.Pct, 'Giá trị đơn hủy ÷ giá trị đơn có trạng thái');
        line('Tỷ lệ hoàn theo số đơn', 'IF(Ord_Don-Ord_KhongRo-Ord_Huy-Ord_ChuaTT=0,' + q(UNDEF) + ',Ord_Hoan/(Ord_Don-Ord_KhongRo-Ord_Huy-Ord_ChuaTT))', ratio(T[7], T[0] - T[11] - T[5] - T[9]), S.Pct, 'Đơn hoàn ÷ đơn không hủy, đã thanh toán');
        line('Tỷ lệ hoàn theo giá trị', ord.hasAmt && ord.hasRefund ? 'IF(Ord_GiaTri-Ord_GiaTriKhongRo-Ord_GiaTriHuy-Ord_GiaTriChuaTT=0,' + q(UNDEF) + ',Ord_TienHoan/(Ord_GiaTri-Ord_GiaTriKhongRo-Ord_GiaTriHuy-Ord_GiaTriChuaTT))' : null,
          ord.hasAmt && ord.hasRefund ? ratio(T[8], T[3] - T[20] - T[6] - T[10]) : NODATA, S.Pct, 'Tiền hoàn ÷ giá trị đơn không hủy, đã thanh toán');
      } else line('Tỷ lệ hủy / hoàn', null, NODATA, S.Text, 'File đơn hàng không có cột trạng thái');
    } else line('Đơn hàng (file đơn hàng)', null, NODATA, S.Text, 'Cần nhập file đơn hàng');
    if (shop.has) {
      line('Đơn hàng – Phân tích shop', 'Shop_Don', shop.orders, S.Money, 'Số TikTok tổng hợp cấp shop × ngày'); line('Đơn hàng SKU – Phân tích shop', 'Shop_DonSKU', shop.sku, S.Money, 'Một đơn nhiều SKU được đếm nhiều lần');
      line('Hoàn tiền – Phân tích shop', 'Shop_HoanTien', shop.refund, S.Money, 'Theo ngày phát sinh hoàn – không dùng tính tỷ lệ hoàn');
    }
    sec('C. Đối chiếu chi phí quảng cáo');
    line('Chi phí Ads theo dashboard (báo cáo quảng cáo)', ads.has ? 'TongChiPhiQC' : null, ads.has ? ads.cost : NODATA, S.Money, 'Sheet QC chi tiết');
    line('Chi phí theo file Cost (chưa thuế)', cost ? 'Cost_SoTien' : null, cost ? null : NODATA, S.Money, 'Sheet Chi phí TK quảng cáo – kỳ do người nhập khai báo');
    line('Thuế ước tính (file Cost)', cost && has('Cost_Thue') ? 'Cost_Thue' : null, cost && has('Cost_Thue') ? null : NODATA, S.Money, 'Thể hiện riêng, không cộng vào chi phí');
    line('Chênh lệch file Cost − dashboard', ads.has && cost ? 'Cost_SoTien-TongChiPhiQC' : null, ads.has && cost ? null : '—', S.Money, 'Chỉ có ý nghĩa khi kỳ hai nguồn trùng nhau');
    line('Hóa đơn Ads – tiền trước thuế', hd ? 'SUMIFS(HD_TruocThue,HD_Nhom,' + q(CAT.ads) + ')' : null, hd ? null : NODATA, S.Money, 'Sheet Hóa đơn, nhóm Quảng cáo');
    line('Hóa đơn Ads – tiền thuế', hd ? 'SUMIFS(HD_Thue,HD_Nhom,' + q(CAT.ads) + ')' : null, hd ? null : NODATA, S.Money, '');
    if (hd) ['platform', 'creator'].forEach(function (k) { line('Hóa đơn ' + CAT[k] + ' – tổng tiền', 'SUMIFS(HD_TongTien,HD_Nhom,' + q(CAT[k]) + ')', null, S.Money, 'Thuế: xem cột Tiền thuế sheet Hóa đơn'); });
    sec('D. Giao dịch thanh toán TikTok Ads');
    if (gd) {
      line('Nạp tiền (Thêm số dư) thành công', 'SUMIFS(GD_SoTien,GD_Nhom,' + q('Nạp tiền') + ',GD_ThanhCong,1)', null, S.Money, 'Tính vào tiền thực trả');
      line('Thanh toán hóa đơn bằng thẻ / chuyển khoản', 'SUMIFS(GD_SoTien,GD_Nhom,' + q('Thanh toán hóa đơn') + ',GD_ThanhCong,1,GD_ThanhToan,"<>Số dư")', null, S.Money, 'Tính vào tiền thực trả');
      line('Thanh toán hóa đơn trả từ số dư', 'SUMIFS(GD_SoTien,GD_Nhom,' + q('Thanh toán hóa đơn') + ',GD_ThanhCong,1,GD_ThanhToan,' + q('Số dư') + ')', null, S.Money, 'Không tính – đã tính khi nạp');
      line('Chuyển số dư nội bộ (ròng)', 'SUMIFS(GD_SoTien,GD_Nhom,' + q('Chuyển số dư nội bộ') + ',GD_ThanhCong,1)', null, S.Money, 'Không tính – chuyển giữa các tài khoản');
      line('Tăng/giảm số dư tín dụng (hạn mức trả sau)', 'SUMIFS(GD_SoTien,GD_Nhom,' + q('Tăng/giảm số dư tín dụng') + ',GD_ThanhCong,1)', null, S.Money, 'Không tính – không phải tiền');
      line('Tín dụng khuyến mãi', 'SUMIFS(GD_SoTien,GD_Nhom,' + q('Khuyến mãi') + ',GD_ThanhCong,1)', null, S.Money, cost && has('Cost_TinDungQC') ? 'Đối chiếu: chi phí tín dụng QC trong file Cost' : 'Không tính');
      if (cost && has('Cost_TinDungQC')) line('Chi phí tín dụng quảng cáo (file Cost)', 'Cost_TinDungQC', null, S.Money, 'Nên bằng tín dụng khuyến mãi đã dùng');
      line('Giao dịch không thành công (số giao dịch)', 'COUNTIFS(GD_ThanhCong,0)', null, S.Money, 'Không tính');
      s.set(r, 0, 'TIỀN THỰC TRẢ TIKTOK ADS', S.TotText); s.fx(r, 1, 'SUMIFS(GD_SoTien,GD_TinhTien,1)', null, S.TotMoney); s.set(r, 2, 'Nạp tiền + thanh toán hóa đơn không trả từ số dư', S.TotText); r++;
    } else line('Giao dịch Ads', null, NODATA, S.Text, 'Cần nhập file Transaction');
    r++; c.notes.forEach(function (x) { s.set(r++, 0, '! ' + x, S.Note); });
    return s;
  }
  function sources(c) {
    var s = c.b.add('Nguồn dữ liệu'), hr = head(c, s, 'Các lần nhập dữ liệu có kỳ giao với kỳ lọc');
    header(s, hr, ['Lần nhập #', 'Thời điểm nhập', 'Người nhập / gửi', 'Loại dữ liệu', 'Shop', 'Phạm vi', 'Từ ngày', 'Đến ngày', 'File', 'Mã băm SHA-256', 'Mới', 'Trùng', 'Cập nhật', 'Chồng lấn', 'Thay thế', 'Lỗi', 'Đã hủy'], [9, 18, 18, 40, 22, 16, 12, 12, 44, 20, 8, 8, 9, 9, 9, 7, 8]);
    var row = hr + 1;
    D.imports.filter(function (i) { return i.from && !(i.to < c.q.from || i.from > c.q.to); }).forEach(function (i) {
      [i.id, i.time, i.sender || i.user || '', i.datasetLabel, i.shopName, i.scope, i.from, i.to, i.fileName, (i.hash || '').slice(0, 16), i['new'], i.dup, i.update, i.conflict, i.replaced, i.error, i.rolledBack ? 'Đã hủy' : '']
        .forEach(function (v, k) { s.set(row, k, v, k === 6 || k === 7 ? S.Date : typeof v === 'number' ? S.Int : S.Text); });
      row++;
    });
    if (row > hr + 1) s.filter = 'A' + hr + ':Q' + (row - 1);
  }
  function overview(c, ads, shop) {
    var s = c.b.add('Tổng quan'); s.tab = 'FF0CA30C'; s.widths[0] = 60; s.widths[1] = 22; s.widths[2] = 72;
    s.set(1, 0, 'BÁO CÁO TIKTOK SHOP – TỔNG QUAN', S.Title);
    s.set(2, 0, 'Kỳ: ' + vn(c.q.from) + ' – ' + vn(c.q.to) + ' · ' + (c.q.shop ? D.shopName(c.q.shop) : 'Tất cả shop (gộp)') + (c.q.ent ? ' · chiến dịch: ' + c.q.ent : '') + ' · lập lúc ' + K.nowStr(), S.Note);
    s.set(3, 0, 'Các ô giá trị là công thức tham chiếu sheet dữ liệu; sửa mốc ROAS / ngân sách ở sheet “Tham số” để tính lại.', S.Note);
    var r = 5;
    s.set(r, 0, 'Chỉ tiêu', S.Header); s.set(r, 1, 'Giá trị', S.Header); s.set(r++, 2, 'Công thức / nguồn', S.Header);
    function line(label, f, cached, st, note) { s.set(r, 0, label, S.Bold); if (f == null) s.set(r, 1, cached, st); else s.fx(r, 1, f, cached, st); s.set(r, 2, note || ''); r++; }
    if (ads.has) {
      var roas = ratio(ads.rev, ads.cost);
      line('Chi phí quảng cáo', 'TongChiPhiQC', ads.cost, S.Money, 'Tổng cột Chi phí Ads – sheet QC chi tiết');
      line('Doanh thu gộp theo báo cáo quảng cáo', 'TongDoanhThuQC', ads.rev, S.Money, 'Tổng cột Doanh thu gộp – sheet QC chi tiết');
      line('Số đơn SKU', 'IF(COUNTBLANK(QC_DonSKU)>0,' + q(NODATA) + ',TongDonSKU)', ads.miss ? NODATA : ads.sku, S.Money, 'Tổng cột Đơn SKU');
      line('Chi phí / đơn SKU', 'QC_ChiPhiTrenDon', ads.miss ? NODATA : ads.sku === 0 ? UNDEF : rnd0(ads.cost / ads.sku), S.Money, 'ROUND(chi phí ÷ đơn SKU, 0)');
      c.b.name('ROAS_Ky', s.abs(r, 1)); line('ROAS', ratioF('TongDoanhThuQC', 'TongChiPhiQC'), roas, S.Num2, 'Doanh thu gộp ÷ chi phí Ads (từ số tổng)');
      line('CIR', ratioF('TongChiPhiQC', 'TongDoanhThuQC'), ratio(ads.cost, ads.rev), S.Pct, 'Chi phí Ads ÷ doanh thu gộp');
      line('Trạng thái ROAS', statusF('ROAS_Ky', c.th.length), statusV(roas, c.th), S.Bold, 'Theo các mốc ở sheet Tham số');
      c.th.forEach(function (t, k) {
        var m = 'MocROAS_' + (k + 1);
        line('So với mốc ' + (k + 1) + ' (sheet Tham số)', 'IF(ISNUMBER(ROAS_Ky),IF(ROAS_Ky>=' + m + ',"Đạt mốc "&' + m + ',"Chưa đạt mốc "&' + m + '),' + q(UNDEF) + ')', typeof roas === 'number' ? (roas >= t ? 'Đạt mốc ' : 'Chưa đạt mốc ') + fmt(t) : UNDEF, S.Text, 'So sánh tham khảo nếu chưa chọn mốc chính thức');
        line('   Doanh thu còn thiếu để đạt mốc ' + (k + 1), 'IF(TongChiPhiQC=0,' + q(UNDEF) + ',MAX(0,ROUND(' + m + '*TongChiPhiQC-TongDoanhThuQC,0)))', ads.cost === 0 ? UNDEF : Math.max(0, rnd0(t * ads.cost - ads.rev)), S.Money, 'MAX(0, mốc × chi phí − doanh thu gộp)');
        line('   ROAS cần đạt trên ngân sách còn chi để đạt mốc ' + (k + 1), 'IF(NganSachConChi<=0,"Nhập ngân sách còn chi ở sheet Tham số",MAX(0,(' + m + '*(TongChiPhiQC+NganSachConChi)-TongDoanhThuQC)/NganSachConChi))',
          !(c.q.remaining > 0) ? 'Nhập ngân sách còn chi ở sheet Tham số' : Math.max(0, (t * (ads.cost + c.q.remaining) - ads.rev) / c.q.remaining), S.Num2, '(mốc × (chi phí + ngân sách còn chi) − doanh thu) ÷ ngân sách còn chi');
      });
      line('Kết luận theo mốc chính thức', 'IF(MocChinhThuc="","Chưa chọn mốc chính thức – không kết luận đạt thưởng",IF(ISNUMBER(ROAS_Ky),IF(ROAS_Ky>=MocChinhThuc,"ĐẠT mốc chính thức","CHƯA ĐẠT mốc chính thức"),' + q(UNDEF) + '))',
        c.official == null ? 'Chưa chọn mốc chính thức – không kết luận đạt thưởng' : typeof roas === 'number' ? (roas >= c.official ? 'ĐẠT mốc chính thức' : 'CHƯA ĐẠT mốc chính thức') : UNDEF, S.Bold, 'Mốc chính thức đặt ở sheet Tham số');
    } else line('ROAS / CIR / chi phí quảng cáo', null, NODATA, S.Text, 'Chưa có báo cáo quảng cáo (Chi phí + Doanh thu gộp) trong kỳ');
    if (shop.has) {
      r++; s.set(r, 0, 'Toàn shop (Phân tích shop)', S.Header); s.set(r, 1, 'Giá trị', S.Header); s.set(r++, 2, 'Công thức / nguồn', S.Header);
      line('GMV toàn shop', 'Shop_GMV', shop.gmv, S.Money, 'Chưa trừ hủy/hoàn'); line('Đơn hàng', 'Shop_Don', shop.orders, S.Money, 'Đơn duy nhất'); line('Đơn hàng SKU', 'Shop_DonSKU', shop.sku, S.Money, '');
      line('SKU / đơn', ratioF('Shop_DonSKU', 'Shop_Don'), ratio(shop.sku, shop.orders), S.Num2, 'Đơn hàng SKU ÷ Đơn hàng');
      line('AOV', 'IF(Shop_Don=0,' + q(UNDEF) + ',ROUND(Shop_GMV/Shop_Don,0))', shop.orders ? rnd0(shop.gmv / shop.orders) : UNDEF, S.Money, 'GMV ÷ đơn hàng');
      line('Hoàn tiền', 'Shop_HoanTien', shop.refund, S.Money, 'Theo ngày phát sinh hoàn');
      CHL.forEach(function (x, k) { line('   Tỷ trọng GMV – ' + x, ratioF('Shop_Kenh' + (k + 1), 'Shop_GMV'), ratio(shop.ch[k], shop.gmv), S.Pct, 'GMV kênh ÷ GMV toàn shop'); });
      if (ads.has) line('Doanh thu gộp QC / GMV toàn shop (tham khảo)', ratioF('TongDoanhThuQC', 'Shop_GMV'), ratio(ads.rev, shop.gmv), S.Pct, 'Hai nguồn quy kết khác nhau – không cộng/trừ lẫn');
    }
    if (c.q.comments && c.q.comments.length) { r++; s.set(r++, 0, 'Nhận định chính', S.Section); c.q.comments.forEach(function (t) { s.set(r++, 0, '• ' + t, S.Plain); }); }
    r++; s.set(r++, 0, 'Không chứa tên, số điện thoại, địa chỉ khách hàng (không được lưu khi nhập).', S.Note);
    return s;
  }

  /* Excel chi tiết một loại dữ liệu */
  R.detail = function (dsKey, from, to, shop, qq) {
    var d = Q.detail(dsKey, from, to, shop, qq), b = X.book(), s = b.add('Chi tiết');
    s.set(1, 0, 'Chi tiết: ' + d.label, S.Title);
    s.set(2, 0, 'Kỳ: ' + (from ? vn(from) : '…') + ' – ' + (to ? vn(to) : '…') + (shop ? ' · Shop: ' + D.shopName(shop) : ' · Tất cả shop') + ' · lập lúc ' + K.nowStr(), S.Note);
    var hr = 4; d.cols.forEach(function (t, i) { s.set(hr, i, t, S.Header); }); s.freeze = hr;
    var row = hr + 1;
    d.rows.forEach(function (rw) { rw.forEach(function (v, i) { var t = d.types[i]; s.set(row, i, v, t === 'Money' || t === 'Int' ? S.Money : t === 'Num' ? S.Num2 : t === 'Ratio' ? S.Pct : t === 'Date' ? S.Date : t === 'DateTime' ? S.DateTime : S.Text); }); row++; });
    if (d.rows.length) {
      s.set(row, 0, 'TỔNG (công thức)', S.TotText);
      d.cols.forEach(function (cn, i) { var t = d.types[i]; if ((t === 'Money' || t === 'Int') && cn.indexOf('Lần nhập') !== 0 && cn.indexOf('Dòng') !== 0) s.fx(row, i, 'SUM(' + L(i) + (hr + 1) + ':' + L(i) + (row - 1) + ')', null, S.TotMoney); });
      s.filter = 'A' + hr + ':' + L(d.cols.length - 1) + (row - 1);
    }
    return X.build(b);
  };

  root.TTSR = R;
})(typeof window !== 'undefined' ? window : self);
