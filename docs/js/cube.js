/* Tổng hợp dữ liệu (cube) cho báo cáo: chỉ số tổng hợp, không có thông tin khách hàng. */
(function (root) {
  'use strict';
  var K = root.TTSK, SC = root.TTSS, D = root.TTSD, Q = {};
  function n(x) { return typeof x === 'number' ? x : 0; }
  function nv(x) { return typeof x === 'number' ? x : null; }
  function active(ds) { return Array.from(D.tables[ds].values()).filter(function (r) { return r.active; }).sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; }); }

  Q.invoiceCategory = function (imported, invNo, taxType, desc, exp) {
    if (imported && imported !== 'auto') return imported;
    var all = K.norm((taxType || '') + ' ' + (desc || '') + ' ' + (exp || ''));
    if (/^VNTT/i.test(invNo || '') || all.indexOf('advertis') >= 0 || all.indexOf('quang cao') >= 0 || all.indexOf(' ads') >= 0 || all.indexOf('ads') === 0 || all.indexOf('gmv max') >= 0) return 'ads';
    if (all.indexOf('creator') >= 0 || all.indexOf('hoa hong') >= 0 || all.indexOf('affiliate') >= 0) return 'creator';
    return 'platform';
  };
  /* Nhóm giao dịch Ads theo Loại giao dịch phụ: nạp tiền / thanh toán hóa đơn / chuyển nội bộ / tín dụng / khuyến mãi */
  Q.topupClass = function (type, sub, mt) {
    var s = K.norm(sub), t = K.norm(type), m = K.norm(mt);
    if (/them so du|add balance|top up|recharge/.test(s)) return 'topup';
    if (/thanh toan hoa don|bill payment|pay bill|invoice payment/.test(s)) return 'billpay';
    if (/tang so du|giam so du|transfer|increase balance|decrease balance/.test(s)) return (/tin dung|credit/.test(m) && m.indexOf('quang cao') < 0) ? 'credit' : 'transfer';
    if (t.indexOf('khuyen mai') >= 0 || m.indexOf('tin dung quang cao') >= 0 || t.indexOf('promotion') >= 0 || s.indexOf('da xuat') >= 0) return 'promo';
    if (s.indexOf('hoan') >= 0 || s.indexOf('refund') >= 0) return 'refund';
    return 'other';
  };
  Q.topupOk = function (status) { var s = K.norm(status); return !/khong thanh cong|that bai|fail|(^| )huy( |$)|cancel/.test(s); };

  /* Đơn hàng theo shop × ngày tạo đơn: mỗi đơn tính 1 lần, giá trị cấp đơn không nhân theo dòng SKU.
     a: 0 orders,1 skuLines,2 qty,3 orderAmt,4 skuAmt,5 cancelOrders,6 cancelAmt,7 retOrders,8 refundAmt,9 unpaidOrders,10 unpaidAmt,
        11 unknownOrders,12 multiSku,13 partial,14 hasStatus,15 hasOrderAmt,16 hasRefund,17 hasSkuAmt,18 amtInconsistent,19 skuAmtCancelled,20 unknownAmt */
  Q.orderDaily = function (keep) {
    var today = K.today(), orders = new Map(), agg = new Map();
    D.tables.orders.forEach(function (r) { if (!r.active || (keep && !keep(r))) return; var k = r.shop + '|' + r.v.order_id; if (!orders.has(k)) orders.set(k, []); orders.get(k).push(r); });
    orders.forEach(function (lines) {
      var f = lines[0], ak = f.shop + '|' + f.from, a = agg.get(ak);
      if (!a) { a = { shop: f.shop, date: f.from, a: new Array(21).fill(0) }; agg.set(ak, a); }
      var A = a.a; A[0]++; A[1] += lines.length; if (lines.length > 1) A[12]++;
      var anyS = false, allC = true, ret = false, unpaid = false, oa = null, orf = null, inc = false;
      lines.forEach(function (l) {
        var v = l.v; A[2] += n(v.quantity);
        if (typeof v.subtotal_after === 'number') { A[4] += v.subtotal_after; A[17] = 1; }
        var s = K.norm(v.status || ''), sub = K.norm(v.substatus || ''), crt = K.norm(v.cancel_return_type || '');
        if (s) anyS = true;
        // “huy” phải là một từ riêng: “van chuyen” (vận chuyển) cũng chứa chuỗi “huy”
        if (!(/(^| )huy( |$)/.test(s) || s.indexOf('cancel') >= 0)) allC = false;
        if (/return|refund|tra hang|hoan tien/.test(crt) || /return|refund|tra hang|hoan tien/.test(sub) || n(v.return_qty) > 0) ret = true;
        if (/unpaid|chua thanh toan|cho thanh toan|awaiting payment/.test(s)) unpaid = true;
        if (typeof v.order_amount === 'number') { if (oa != null && oa !== v.order_amount) inc = true; oa = oa == null ? v.order_amount : Math.max(oa, v.order_amount); }
        if (typeof v.order_refund === 'number') orf = orf == null ? v.order_refund : Math.max(orf, v.order_refund);
        if (l.partial || l.from >= today) A[13] = 1;
      });
      if (oa != null) { A[3] += oa; A[15] = 1; }
      if (inc) A[18]++; if (orf != null) A[16] = 1;
      if (!anyS) { A[11]++; A[20] += oa || 0; return; }
      A[14] = 1;
      if (allC) { A[5]++; A[6] += oa || 0; lines.forEach(function (l) { A[19] += n(l.v.subtotal_after); }); }
      else if (unpaid) { A[9]++; A[10] += oa || 0; }
      else if (ret || (orf || 0) > 0) { A[7]++; A[8] += orf || 0; }
    });
    return Array.from(agg.values()).sort(function (x, y) { return x.date < y.date ? -1 : 1; });
  };

  Q.build = function () {
    var today = K.today(), o = { generatedAt: K.nowStr(), today: today, shops: D.settings.shops, thresholds: D.settings.thresholds, official: D.settings.official };
    var impCat = {}; D.imports.forEach(function (i) { impCat[i.id] = i.category; });
    var part = function (r) { return (r.partial || r.to >= today) ? 1 : 0; };
    o.ads = { cols: ['shop', 'from', 'to', 'ent', 'name', 'cost', 'rev', 'sku', 'partial', 'imp', 'roiFile', 'account', 'ctype', 'affCost', 'totalCost'],
      rows: active('ads_campaign').map(function (r) { return [r.shop, r.from, r.to, r.ent, r.v.campaign_name || r.v.campaign_id || '(Toàn shop – không có chiến dịch)', n(r.v.cost), n(r.v.revenue), nv(r.v.sku_orders), part(r), r.imp, nv(r.v.roi_file), r.v.account_name || null, r.v.campaign_type || null, nv(r.v.aff_cost), nv(r.v.total_cost)]; }) };
    o.booking = { cols: ['shop', 'date', 'creator', 'ctype', 'fee', 'gmv', 'orders', 'partial', 'imp'],
      rows: active('booking').map(function (r) { return [r.shop, r.from, r.v.creator, r.v.content_type || null, n(r.v.fee), nv(r.v.gmv), nv(r.v.orders), part(r), r.imp]; }) };
    o.market = (D.settings.market || []).slice();
    o.gmvMaxAccount = D.settings.gmvMaxAccount || '';
    o.acct = { cols: ['shop', 'from', 'to', 'accountId', 'accountName', 'type', 'cash', 'credit', 'adCredit', 'amount', 'tax', 'imp', 'partial'],
      rows: active('ads_account_cost').map(function (r) { var v = r.v; return [r.shop, r.from, r.to, v.account_id, v.account_name, v.cost_type, nv(v.cash), nv(v.credit), nv(v.ad_credit), n(v.amount), nv(v.tax), r.imp, part(r)]; }) };
    o.topup = { cols: ['shop', 'date', 'time', 'accountId', 'accountName', 'type', 'subtype', 'status', 'moneyType', 'amount', 'voucher', 'imp', 'cls', 'pay', 'ok'],
      rows: active('ads_topup').map(function (r) { var v = r.v; return [r.shop, r.from, v.time, v.account_id, v.account_name, v.tx_type, v.tx_subtype, v.status, v.money_type, n(v.amount), v.voucher_no, r.imp, Q.topupClass(v.tx_type, v.tx_subtype, v.money_type), v.pay_method || null, Q.topupOk(v.status) ? 1 : 0]; }) };
    var inv = new Map();
    active('invoice').forEach(function (r) {
      var v = r.v, cat = Q.invoiceCategory(impCat[r.imp], v.invoice_no, v.tax_type, v.description, v.expense_type);
      var k = [r.shop, r.from, r.to, cat, v.tax_type, v.expense_type, v.description].join('|'), a = inv.get(k);
      if (!a) { a = [r.shop, r.from, r.to, cat, v.tax_type || null, v.expense_type || null, v.description || null, 0, 0, 0, 0, 0, 0, 0]; inv.set(k, a); }
      a[7]++; a[8] += n(v.amount); if (typeof v.tax === 'number') { a[9] += v.tax; a[13]++; } a[10] += n(v.net); a[11] += n(v.pit); a[12] += n(v.payable);
    });
    o.inv = { cols: ['shop', 'from', 'to', 'category', 'taxType', 'expenseType', 'description', 'count', 'amount', 'tax', 'net', 'pit', 'payable', 'taxRows'], rows: Array.from(inv.values()) };
    o.ord = { cols: ['shop', 'date', 'orders', 'skuLines', 'qty', 'orderAmt', 'skuAmt', 'cancelOrders', 'cancelAmt', 'retOrders', 'refundAmt', 'unpaidOrders', 'unpaidAmt', 'unknownOrders', 'multiSku', 'partial', 'hasStatus', 'hasOrderAmt', 'hasRefund', 'hasSkuAmt', 'amtInconsistent', 'skuAmtCancelled', 'unknownAmt'],
      rows: Q.orderDaily().map(function (x) { return [x.shop, x.date].concat(x.a); }) };
    var stl = new Map();
    active('settlement').forEach(function (r) {
      var type = r.v.type || '', k = r.shop + '|' + r.from + '|' + type, a = stl.get(k);
      if (!a) { a = [r.shop, r.from, type, 0, 0, 0, 0, 0, 0]; stl.set(k, a); }
      a[3]++; a[4] += n(r.v.settlement_amount);
      if (typeof r.v.revenue === 'number') { a[5] += r.v.revenue; a[7] = 1; } if (typeof r.v.fees === 'number') { a[6] += r.v.fees; a[8] = 1; }
    });
    o.stl = { cols: ['shop', 'date', 'type', 'count', 'amount', 'revenue', 'fees', 'hasRevenue', 'hasFees'], rows: Array.from(stl.values()) };
    var stlrKeys = SC.get('settlement_report').fields.filter(function (x) { return x.type === 'Money'; }).map(function (x) { return x.key; });
    o.stlr = { cols: ['shop', 'from', 'to', 'partial', 'imp'].concat(stlrKeys),
      rows: active('settlement_report').map(function (r) { return [r.shop, r.from, r.to, part(r), r.imp].concat(stlrKeys.map(function (k) { return nv(r.v[k]); })); }) };
    o.vid = { cols: ['shop', 'scope', 'date', 'gmv', 'gmvDirect', 'gmvIndirect', 'vv', 'sku', 'skuDirect', 'skuIndirect', 'impr', 'clicks', 'viewers', 'partial', 'imp'],
      rows: active('video_daily').map(function (r) { var v = r.v; return [r.shop, r.scope, r.from, nv(v.gmv_total), nv(v.gmv_direct), nv(v.gmv_indirect), nv(v.vv), nv(v.sku_orders), nv(v.sku_direct), nv(v.sku_indirect), nv(v.impressions), nv(v.clicks), nv(v.product_viewers), part(r), r.imp]; }) };
    o.aff = { cols: ['shop', 'from', 'to', 'gmv', 'items', 'refund', 'itemsRefunded', 'commission', 'videos', 'lives', 'samples', 'creators', 'ctr', 'ctor', 'aov', 'partial', 'imp'],
      rows: active('affiliate_period').map(function (r) { var v = r.v; return [r.shop, r.from, r.to, nv(v.gmv), nv(v.items_sold), nv(v.refund), nv(v.items_refunded), nv(v.commission), nv(v.videos), nv(v.lives), nv(v.samples_shipped), nv(v.creators), nv(v.ctr), nv(v.ctor), nv(v.aov), part(r), r.imp]; }) };
    var sk = ['gmv', 'orders', 'sku_orders', 'items_sold', 'refund', 'total_revenue', 'page_views', 'impressions', 'clicks', 'gmv_creator_live', 'gmv_seller_live', 'gmv_product_card', 'gmv_creator_video', 'gmv_seller_video', 'visitors'];
    o.shop = { cols: ['shop', 'date', 'gmv', 'orders', 'sku', 'items', 'refund', 'totalRevenue', 'pageViews', 'impr', 'clicks', 'chCreatorLive', 'chSellerLive', 'chProductCard', 'chCreatorVideo', 'chSellerVideo', 'visitors', 'partial', 'imp'],
      rows: active('shop_daily').map(function (r) { return [r.shop, r.from].concat(sk.map(function (k) { return nv(r.v[k]); })).concat([part(r), r.imp]); }) };
    // từng video theo kỳ (không lưu tên sản phẩm, nội dung video chỉ giữ 80 ký tự đầu)
    o.vlist = { cols: ['shop', 'scope', 'from', 'to', 'videoId', 'creator', 'title', 'publish', 'vv', 'impr', 'clicks', 'sku', 'items', 'gmv', 'likes', 'comments', 'shares', 'followers', 'partial', 'imp'],
      rows: active('video_list').map(function (r) { var v = r.v; return [r.shop, r.scope, r.from, r.to, v.video_id, v.creator || v.creator_id || '', (v.title || '').slice(0, 80), v.publish_time || null, n(v.vv), n(v.impressions), n(v.clicks), n(v.sku_orders), n(v.items), n(v.gmv), n(v.likes), n(v.comments), n(v.shares), n(v.followers), part(r), r.imp]; }) };
    // từng phiên LIVE
    o.llist = { cols: ['shop', 'scope', 'date', 'start', 'account', 'dur', 'gmv', 'gmvDirect', 'orders', 'items', 'buyers', 'viewers', 'views', 'avgWatch', 'impr', 'clicks', 'comments', 'likes', 'shares', 'followers', 'partial', 'imp'],
      rows: active('live_list').map(function (r) { var v = r.v; return [r.shop, r.scope, r.from, v.start_time, v.handle || v.creator || v.creator_id || '', n(v.duration), n(v.gmv), nv(v.gmv_direct), n(v.orders), n(v.items), n(v.buyers), n(v.viewers), n(v.views), nv(v.avg_watch), n(v.impressions), n(v.clicks), n(v.comments), n(v.likes), n(v.shares), n(v.followers), part(r), r.imp]; }) };
    o.health = (D.settings.health || []).slice();
    o.imports = D.imports.map(function (i) { return { id: i.id, time: i.time, user: i.user, fileName: i.fileName, dataset: i.dataset, datasetLabel: i.datasetLabel, shopName: i.shopName, scope: i.scope, from: i.from, to: i.to, 'new': i['new'], dup: i.dup, update: i.update, conflict: i.conflict, replaced: i.replaced, error: i.error, rolledBack: i.rolledBack }; });
    return o;
  };

  /* Bản ghi chi tiết (cho kế toán truy ngược) */
  Q.detail = function (dsKey, from, to, shop, q) {
    var ds = SC.get(dsKey), file = {}; D.imports.forEach(function (i) { file[i.id] = i.fileName; });
    var nq = q ? K.norm(q, false) : '';
    var list = Array.from(D.tables[dsKey].values()).filter(function (r) {
      return r.active && (!shop || r.shop === shop) && (!from || r.to >= from) && (!to || r.from <= to) &&
        (!nq || Object.keys(r.v).some(function (k) { return typeof r.v[k] === 'string' && K.norm(r.v[k], false).indexOf(nq) >= 0; }));
    }).sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : (a.imp - b.imp) || (a.row - b.row); });
    var cols = ['Shop', 'Phạm vi', 'Từ ngày', 'Đến ngày'].concat(ds.stored.map(function (x) { return x.label; })).concat(['Lần nhập #', 'File nguồn', 'Dòng trong file', 'Ngày chưa kết thúc']);
    var types = ['Text', 'Text', 'Date', 'Date'].concat(ds.stored.map(function (x) { return x.type; })).concat(['Int', 'Text', 'Int', 'Text']);
    var rows = list.map(function (r) { return [D.shopName(r.shop), r.scope, r.from, r.to].concat(ds.stored.map(function (x) { return r.v[x.key] == null ? null : r.v[x.key]; })).concat([r.imp, file[r.imp] || '', r.row, r.partial ? 'Có' : '']); });
    return { dataset: dsKey, label: ds.label, total: list.length, cols: cols, types: types, rows: rows };
  };

  root.TTSQ = Q;
})(typeof window !== 'undefined' ? window : self);
