/* Nhập file: nhận dạng loại, tìm dòng tiêu đề, ánh xạ cột, đọc giá trị, phân loại mới / trùng / cập nhật / chồng lấn / lỗi; ghi nhận và lưu lịch sử. */
(function (root) {
  'use strict';
  var K = root.TTSK, SC = root.TTSS, D = root.TTSD, I = {};
  var TOTAL_SET = { 'tong': 1, 'tong cong': 1, 'total': 1, 'grand total': 1, 'cong': 1, 'sum': 1, 'tong so': 1, 'tat ca': 1 };
  // nhận cả dạng “Tổng 239 kết quả” / “Total 12 results” (báo cáo tùy chỉnh của Ads Manager)
  var TOTAL = new Proxy(TOTAL_SET, { get: function (t, k) { return typeof k === 'string' && (t[k] || /^(tong|total)( cong)? \d+ (ket qua|results?|dong|rows?)$/.test(k)) ? 1 : undefined; } });
  var COVERAGE = { ads_campaign: 1, ads_account_cost: 1, affiliate_period: 1, video_daily: 1, shop_daily: 1 };
  var uploads = {}, pendings = {};
  function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

  I.addUpload = function (fileName, buf) {
    return Promise.all([K.readSheets(fileName, buf), K.sha256(buf)]).then(function (r) {
      if (!r[0].length) throw new Error('File không có sheet dữ liệu nào.');
      var up = { id: uid(), fileName: fileName, size: buf.byteLength, hash: r[1], sheets: r[0] };
      uploads[up.id] = up; return up;
    });
  };

  function matchHeader(ds, row) {
    var map = {}, used = {}, score = 0;
    // lượt 1: khớp nguyên tên cột kể cả phần trong ngoặc (vd “Chi phí (liên kết)” khác “Chi phí”); lượt 2: bỏ phần trong ngoặc
    [false, true].forEach(function (drop) {
      for (var c = 0; c < row.length; c++) {
        if (map[c] != null) continue;
        var h = K.norm(row[c], drop); if (!h) continue;
        if (!drop && h === K.norm(row[c])) continue; // tên cột không có ngoặc → để lượt 2 xử lý theo thứ tự cột
        for (var i = 0; i < ds.fields.length; i++) { var f = ds.fields[i]; if (used[f.key]) continue; if (f.normSyn[h]) { map[c] = f.key; used[f.key] = 1; if (!f.pii) score++; break; } }
      }
    });
    return { map: map, score: score, sig: ds.signature.every(function (k) { return used[k]; }) };
  }
  function detect(sh, forceDs) {
    var best = null, bs = -1, bsig = false, lim = Math.min(40, sh.rows.length);
    for (var r = 0; r < lim; r++) {
      if (!sh.rows[r].length) continue;
      SC.all.forEach(function (ds) {
        if (forceDs && ds.key !== forceDs) return;
        var m = matchHeader(ds, sh.rows[r]);
        if ((m.sig && !bsig) || (m.sig === bsig && m.score > bs)) { best = { ds: ds, header: r, map: m.map }; bs = m.score; bsig = m.sig; }
      });
    }
    if (!bsig && !forceDs) return null;
    return best;
  }
  function headerSig(row) { return row.map(function (x) { return K.norm(x); }).join('|'); }
  function sameVal(a, b) { if (a == null && b == null) return true; if (a == null || b == null) return false; return String(a) === String(b); }
  function sameRec(r, p) {
    if (r.from !== p.from || r.to !== p.to || r.shop !== p.shop) return false;
    var keys = Object.keys(p.v).concat(Object.keys(r.v));
    for (var i = 0; i < keys.length; i++) if (!sameVal(r.v[keys[i]], p.v[keys[i]])) return false;
    return true;
  }
  function overlap(f1, t1, f2, t2) { return f1 <= t2 && f2 <= t1; }
  function payMethod(raw) {
    var n = K.norm(raw); if (!n || n === 'n a' || n === 'na') return null;
    if (n.indexOf('so du') >= 0 || n.indexOf('balance') >= 0) return 'Số dư';
    if (n.indexOf('the tin dung') >= 0 || n.indexOf('the ghi no') >= 0 || n.indexOf('card') >= 0) return 'Thẻ';
    if (n.indexOf('chuyen khoan') >= 0 || n.indexOf('bank') >= 0) return 'Chuyển khoản';
    return 'Khác';
  }

  I.classify = function (ds, recs) {
    var table = D.tables[ds.key], groups = null;
    if (COVERAGE[ds.key]) {
      groups = {};
      table.forEach(function (r) { if (!r.active) return; var g = r.shop + '|' + r.scope; (groups[g] = groups[g] || []).push(r); });
    }
    recs.forEach(function (p) {
      var ex = table.get(p.k); p.conflicts = null;
      if (ex && ex.active) { p.cls = sameRec(ex, p) ? 'dup' : 'update'; return; }
      p.cls = 'new';
      if (!groups || !p.from) return;
      (groups[p.shop + '|' + p.scope] || []).forEach(function (r) {
        if (r.k === p.k) return;
        var clash = r.ent === p.ent || r.ent === '' || p.ent === '';
        if (clash && overlap(r.from, r.to, p.from, p.to)) (p.conflicts = p.conflicts || []).push(r.k);
      });
      if (p.conflicts) p.cls = 'conflict';
    });
  };

  /* req: {uploadId, shopId, newShop, scope, from, to, sheet, dataset, headerRow, mapping, saveTemplate, category} */
  I.preview = function (req) {
    var up = uploads[req.uploadId]; if (!up) throw new Error('Phiên tải file đã hết hạn. Vui lòng chọn lại file.');
    var notes = [], warns = [], forceDs = req.dataset || null, ds = null, headerRow = -1, map = null, sheetIdx = req.sheet != null ? req.sheet : -1;
    if (sheetIdx < 0 || sheetIdx >= up.sheets.length) {
      var bsc = -1;
      up.sheets.forEach(function (s, i) { var d = detect(s, forceDs), sc = d ? 1000 + Object.keys(d.map).length : 0; if (sc > bsc) { bsc = sc; sheetIdx = i; } });
    }
    var sh = up.sheets[sheetIdx];
    if (req.mapping) {
      ds = SC.get(forceDs); if (!ds) throw new Error('Ánh xạ thủ công cần chọn loại dữ liệu.');
      headerRow = req.headerRow || 0; map = {};
      Object.keys(req.mapping).forEach(function (c) { var fk = req.mapping[c]; if (fk && ds.F[fk]) map[c] = fk; });
      if (headerRow < sh.rows.length) { var auto = matchHeader(ds, sh.rows[headerRow]).map; Object.keys(auto).forEach(function (c) { if (map[c] == null && ds.F[auto[c]].pii) map[c] = auto[c]; }); }
    } else {
      (D.settings.templates || []).some(function (t) {
        if (t.headerRow < sh.rows.length && headerSig(sh.rows[t.headerRow]) === t.sig && (!forceDs || forceDs === t.dataset)) {
          ds = SC.get(t.dataset); headerRow = t.headerRow; map = {}; Object.keys(t.mapping).forEach(function (c) { map[c] = t.mapping[c]; });
          notes.push('Đã áp dụng mẫu ánh xạ cột đã lưu cho loại file này.'); return true;
        }
      });
      if (!ds) { var dt = detect(sh, forceDs); if (dt) { ds = dt.ds; headerRow = dt.header; map = dt.map; } }
    }
    var res = { fileName: up.fileName, hash: up.hash, size: up.size, sheet: sheetIdx, sheets: up.sheets.map(function (s, i) { return { index: i, name: s.name, rows: s.rows.length }; }),
      rawTop: sh.rows.slice(0, 12).map(function (r) { return r.map(function (x) { x = x == null ? '' : String(x); return x.length > 80 ? x.slice(0, 80) + '…' : x; }); }) };
    if (!ds) { res.recognized = false; res.message = 'Chưa nhận dạng được loại file. Chọn loại dữ liệu, dòng tiêu đề và ánh xạ từng cột (Chưa đủ dữ liệu để tự xử lý).'; return res; }
    res.recognized = true; res.dataset = ds.key; res.datasetLabel = ds.label; res.datasetDesc = ds.desc; res.headerRow = headerRow;
    var hdr = sh.rows[headerRow] || [], cols = [], seen = {};
    for (var c = 0; c < hdr.length; c++) {
      var fk = map[c]; if ((hdr[c] == null || hdr[c] === '') && !fk) continue;
      var st = !fk ? 'unused' : ds.F[fk].pii ? 'pii' : seen[fk] ? 'dup' : 'mapped';
      if (st === 'dup') delete map[c]; else if (st === 'mapped') seen[fk] = 1;
      cols.push({ col: c, header: hdr[c], field: fk || null, fieldLabel: fk ? ds.F[fk].label : null, status: st });
    }
    res.columns = cols;
    var mapped = {}; Object.keys(map).forEach(function (c) { mapped[map[c]] = 1; });
    var missReq = ds.fields.filter(function (x) { return x.required && !mapped[x.key]; });
    res.missingRequired = missReq.map(function (x) { return x.label; });
    res.missingOptional = ds.fields.filter(function (x) { return !x.required && !x.pii && x.missing && !mapped[x.key]; }).map(function (x) { return x.label + ': ' + x.missing; });

    var shopId = req.shopId === '__new' ? '' : (req.shopId || ''), newShop = (req.newShop || '').trim(), shopCol = !!mapped.shop_name;
    if (!shopId && newShop) shopId = D.findShop(newShop) || ('NEW:' + newShop);
    if (!shopId && !shopCol) { res.needShop = true; res.message = 'File không ghi tên shop. Chọn shop (hoặc tạo shop mới) trước khi nhập.'; return res; }
    var scope = ds.hasScope ? ((req.scope || '').trim() || 'Tất cả kênh') : '';

    var fileP = null, pSrc = null;
    for (var r0 = 0; r0 < headerRow && r0 < sh.rows.length; r0++) { var fp = K.findPeriod(sh.rows[r0].join(' ')); if (fp) { fileP = fp; pSrc = 'dòng ' + (r0 + 1) + ' của file'; break; } }
    if (!fileP) { fileP = K.findPeriod(up.fileName); if (fileP) pSrc = 'tên file'; }
    var dayLevel = !!(ds.dateField && mapped[ds.dateField]), per = fileP;
    if (req.from && req.to) {
      if (req.from > req.to) throw new Error('Kỳ dữ liệu không hợp lệ: ngày bắt đầu sau ngày kết thúc.');
      if (fileP && (fileP.from !== req.from || fileP.to !== req.to) && !dayLevel) warns.push('Kỳ bạn nhập (' + req.from + ' → ' + req.to + ') khác kỳ ghi trong ' + pSrc + ' (' + fileP.from + ' → ' + fileP.to + '). Ứng dụng dùng kỳ bạn nhập.');
      if (!dayLevel) { per = { from: req.from, to: req.to }; pSrc = 'người dùng nhập'; }
    }
    res.fileFrom = fileP ? fileP.from : null; res.fileTo = fileP ? fileP.to : null; res.dayLevel = dayLevel;
    if (!dayLevel && !per) { res.needPeriod = true; res.message = ds.key === 'invoice' ? 'File hóa đơn không ghi ngày hóa đơn. Nhập kỳ (tháng) của hóa đơn để đối chiếu theo kỳ.' : 'Chưa đủ dữ liệu: file không ghi kỳ dữ liệu (từ ngày – đến ngày). Nhập kỳ của file rồi xem trước lại.'; return res; }
    if (missReq.length) { res.blocked = true; res.message = 'Chưa đủ dữ liệu: thiếu cột bắt buộc ' + missReq.map(function (x) { return '“' + x.label + '”'; }).join(', ') + '. Ánh xạ thủ công hoặc xuất lại file có đủ cột.'; return res; }

    var colOf = {}; Object.keys(map).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) { if (colOf[map[c]] == null) colOf[map[c]] = c; });
    Object.keys(map).forEach(function (c) { if (colOf[map[c]] !== +c) delete map[c]; });
    var orders = {};
    ds.fields.forEach(function (x) {
      if ((x.type === 'Date' || x.type === 'DateTime') && colOf[x.key] != null) {
        var c2 = colOf[x.key], io = K.inferOrder(sh.rows.slice(headerRow + 1).map(function (r) { return r[c2]; }));
        orders[x.key] = io.order;
        if (io.amb) warns.push('Cột “' + hdr[c2] + '”: ngày dạng a/b/yyyy không phân biệt được ngày/tháng; hiểu theo kiểu Việt Nam (ngày/tháng/năm). Kiểm tra lại bảng xem trước.');
      }
    });
    var negate = false;
    if (ds.fields.some(function (x) { return x.negate; }) && colOf.amount != null) {
      var neg = 0, pos = 0;
      for (var rr = headerRow + 1; rr < sh.rows.length; rr++) { var nv = K.num(sh.rows[rr][colOf.amount], true); if (nv) { if (nv.v < 0) neg++; else if (nv.v > 0) pos++; } }
      negate = neg > pos; if (negate) notes.push('File ghi chi phí là số âm → đổi dấu thành số dương (chi phí) khi lưu.');
    }
    function parseNum(r, c, raw, fd) {
      if (sh.isNum(r, c) && isFinite(Number(raw))) return { v: Number(raw), pct: false };
      return K.num(raw, fd.type === 'Money' || fd.type === 'Int');
    }
    var today = K.today(), recs = [], errors = [], skipBlank = 0, skipDesc = 0, skipTotal = 0, nErr = 0, totals = {}, firstRow = {}, occ = {}, newShops = [], minD = null, maxD = null, currencies = {}, sci = 0;
    var addFields = ds.stored.filter(function (x) { return (x.type === 'Money' || x.type === 'Int') && !x.nonAdd; });
    // file GMV Max xuất từ Seller Center không có cột loại chiến dịch → lấy theo tên file
    var ctypeFromName = null;
    if (ds.key === 'ads_campaign' && !mapped.campaign_type) {
      if (/^live campaign data/i.test(up.fileName)) ctypeFromName = 'LIVE GMV Max'; else if (/^product campaign data/i.test(up.fileName)) ctypeFromName = 'Product GMV Max';
      if (ctypeFromName) notes.push('Loại chiến dịch lấy theo tên file: ' + ctypeFromName + '.');
    }
    // bảng "Tổng giá trị" phía trên dòng tiêu đề (vd Phân tích shop)
    for (var tr = 1; tr < headerRow && tr < sh.rows.length; tr++) {
      var trow = sh.rows[tr]; if (!trow.length) continue;
      var lab = K.norm(trow[0]); if (!(TOTAL[lab] || lab === 'tong gia tri' || lab === 'total value')) continue;
      var above = sh.rows[tr - 1], same = 0, cmp = 0;
      Object.keys(map).forEach(function (c) { if (+c === 0) return; cmp++; if (K.norm(above[c]) === K.norm(hdr[c])) same++; });
      if (!cmp || same * 10 < cmp * 8) continue;
      addFields.forEach(function (x) { var c3 = colOf[x.key]; if (c3 == null) return; var n3 = parseNum(tr, c3, trow[c3], x); if (n3) totals[x.key] = negate && x.negate ? -n3.v : n3.v; });
      break;
    }
    for (var r = headerRow + 1; r < sh.rows.length; r++) {
      var row = sh.rows[r], rowNo = r + 1;
      if (row.every(function (x) { return x == null || String(x).trim() === ''; })) { skipBlank++; continue; }
      var isTotal = ds.totalLabelFields.some(function (tf) { var c4 = colOf[tf]; return c4 != null && TOTAL[K.norm(row[c4])]; }) || (row.length && TOTAL[K.norm(row[0])]);
      if (isTotal) {
        skipTotal++;
        addFields.forEach(function (x) { var c5 = colOf[x.key]; if (c5 == null) return; var n5 = parseNum(r, c5, row[c5], x); if (n5) totals[x.key] = (totals[x.key] || 0) + (negate && x.negate ? -n5.v : n5.v); });
        continue;
      }
      var v = {}, rowErr = [], numOk = 0, numF = 0;
      Object.keys(map).forEach(function (c) {
        var fd = ds.F[map[c]], raw = row[c] == null ? '' : String(row[c]).trim();
        if (fd.pii) { if (fd.key === 'description' && ds.F.pay_method) v.pay_method = payMethod(raw); return; }
        if (!raw || raw === '-' || raw === '--') {
          if (fd.dashZero && raw) { v[fd.key] = 0; return; } // “-” trong báo cáo TikTok = không phát sinh
          if (fd.required) rowErr.push('thiếu “' + fd.label + '”'); return;
        }
        if (fd.type === 'Text') {
          if (sh.isNum(r, +c) && /e/i.test(raw) && isFinite(Number(raw))) { raw = BigInt(Math.round(Number(raw))).toString(); sci++; }
          v[fd.key] = raw;
        } else if (fd.type === 'Date' || fd.type === 'DateTime') {
          var dd = K.date(raw, orders[fd.key] || 'DMY');
          if (!dd) rowErr.push('“' + fd.label + '” = \'' + raw.slice(0, 40) + '\' không phải ngày hợp lệ'); else v[fd.key] = fd.type === 'Date' ? dd.date : dd.dt;
        } else {
          numF++;
          var n = parseNum(r, +c, raw, fd);
          if (!n) { rowErr.push('“' + fd.label + '” = \'' + raw.slice(0, 40) + '\' không phải số'); return; }
          numOk++;
          var val = n.v; if ((fd.type === 'Ratio' || fd.type === 'Num') && n.pct) val = val / 100;
          if (negate && fd.negate) val = -val;
          if (raw.indexOf('₫') >= 0) currencies.VND = 1;
          if (fd.type === 'Ratio' || fd.type === 'Num') val = Math.round(val * 1e10) / 1e10; // khử sai số dấu phẩy động của tỷ lệ
          v[fd.key] = val;
        }
      });
      if (r === headerRow + 1 && numF > 0 && numOk === 0) {
        var longTxt = row.filter(function (x) { x = String(x || '').trim(); return x.length > 12 && x.indexOf(' ') >= 0; }).length;
        if (longTxt * 2 >= row.filter(function (x) { return String(x || '').trim(); }).length) { skipDesc++; continue; }
      }
      if (colOf.currency != null && row[colOf.currency]) {
        var cur = String(row[colOf.currency]).trim().toUpperCase(); currencies[cur] = 1;
        if (cur !== 'VND' && cur !== '₫' && cur !== 'VNĐ') rowErr.push('tiền tệ “' + row[colOf.currency] + '” không phải VND (không quy đổi tỷ giá)');
      }
      if (dayLevel && !v[ds.dateField] && !rowErr.length) rowErr.push('thiếu “' + ds.F[ds.dateField].label + '”');
      if (rowErr.length) { nErr++; if (errors.length < 200) errors.push({ row: rowNo, msg: rowErr.join('; ') }); continue; }
      if (ctypeFromName && !v.campaign_type) v.campaign_type = ctypeFromName;
      var p = { row: rowNo, v: v, scope: scope };
      if (shopCol && v.shop_name) { var sid = D.findShop(v.shop_name); if (!sid) { sid = 'NEW:' + v.shop_name.trim(); } p.shop = sid; } else p.shop = shopId;
      if (p.shop.indexOf('NEW:') === 0 && newShops.indexOf(p.shop.slice(4)) < 0) newShops.push(p.shop.slice(4));
      if (dayLevel) {
        p.from = p.to = String(v[ds.dateField]).slice(0, 10);
        if (fileP && (p.from < fileP.from || p.from > fileP.to)) p.note = 'ngoài kỳ';
      } else { p.from = per.from; p.to = per.to; }
      if (!minD || p.from < minD) minD = p.from; if (!maxD || p.to > maxD) maxD = p.to;
      p.partial = p.to >= today;
      var kp = [ds.key, p.shop, p.scope];
      ds.keyFields.forEach(function (kf) { if (kf === ds.dateField) { if (dayLevel) kp.push(p.from); return; } kp.push(v[kf] != null ? String(v[kf]) : ''); });
      if (!dayLevel && !ds.noPeriodKey) kp.push('P:' + p.from + '~' + p.to);
      var key = kp.join('|');
      if (ds.allowDupKey) { occ[key] = (occ[key] || 0) + 1; if (occ[key] > 1) key += '#' + occ[key]; }
      else if (firstRow[key]) { nErr++; if (errors.length < 200) errors.push({ row: rowNo, msg: 'trùng khóa với dòng ' + firstRow[key] + ' trong cùng file (không cộng 2 lần)' }); continue; }
      firstRow[key] = rowNo; p.k = key;
      p.ent = ''; ds.entityFields.some(function (ef) { if (v[ef] != null) { p.ent = ef + ':' + v[ef]; return true; } });
      recs.push(p);
    }
    var checks = Object.keys(totals).map(function (fk) {
      var s = 0; recs.forEach(function (p) { if (typeof p.v[fk] === 'number') s += p.v[fk]; });
      var ok = Math.abs(s - totals[fk]) < 0.5;
      if (!ok) warns.push('Tổng cột “' + ds.F[fk].label + '” của các dòng (' + Math.round(s).toLocaleString('vi-VN') + ') KHÔNG khớp dòng Tổng trong file (' + Math.round(totals[fk]).toLocaleString('vi-VN') + ').');
      return { field: ds.F[fk].label, fileTotal: totals[fk], sumRows: s, ok: ok };
    });
    if (checks.length && checks.every(function (x) { return x.ok; })) notes.push('Tổng các dòng khớp với dòng “Tổng” trong file (' + checks.length + ' cột).');
    var fm = /(?:^|[^A-Za-z0-9])[Tt](\d{1,2})(?![0-9])/.exec(up.fileName.replace(/\.[^.]+$/, ''));
    if (fm && minD) {
      var mon = +fm[1], inside = false, d0 = new Date(minD + 'T00:00:00'), d1 = new Date(maxD + 'T00:00:00');
      for (var dd2 = new Date(d0.getFullYear(), d0.getMonth(), 1); dd2 <= d1; dd2.setMonth(dd2.getMonth() + 1)) if (dd2.getMonth() + 1 === mon) inside = true;
      if (mon >= 1 && mon <= 12 && !inside) { warns.unshift('TÊN FILE GHI “T' + mon + '” (THÁNG ' + mon + ') NHƯNG DỮ LIỆU TRONG FILE THUỘC KỲ ' + vn(minD) + ' – ' + vn(maxD) + '. Có thể file đã xuất nhầm kỳ – kiểm tra lại trước khi ghi nhận.'); res.periodMismatch = true; }
    }
    if (sci) warns.push(sci + ' ô mã (ID) bị Excel lưu dạng số khoa học → có thể mất chữ số cuối. Nên dùng file xuất gốc từ TikTok.');
    if (recs.some(function (p) { return p.note; })) warns.push(recs.filter(function (p) { return p.note; }).length + ' dòng có ngày nằm ngoài kỳ ghi ở đầu file.');
    if (!Object.keys(currencies).length && ds.fields.some(function (x) { return x.type === 'Money'; })) notes.push('File không ghi đơn vị tiền tệ; hiểu là VND.');
    if (recs.some(function (p) { return p.partial; })) warns.push('Có dữ liệu của ngày hôm nay hoặc kỳ chưa kết thúc → gắn nhãn “Ngày chưa kết thúc”.');

    I.classify(ds, recs);
    var cnt = function (c) { return recs.filter(function (p) { return p.cls === c; }).length; };
    var same = D.imports.filter(function (i) { return i.hash === up.hash && !i.rolledBack; });
    if (same.length) warns.push('File này (cùng nội dung) đã được nhập ở lần #' + same.map(function (i) { return i.id; }).join(', #') + '. Dòng giống hệt sẽ được bỏ qua, không cộng trùng.');
    var conflictInfo = [];
    if (cnt('conflict')) {
      var byImp = {}, table = D.tables[ds.key];
      recs.forEach(function (p) { if (p.cls !== 'conflict') return; p.conflicts.forEach(function (k) { var er = table.get(k); (byImp[er.imp] = byImp[er.imp] || {})[k] = er; }); });
      Object.keys(byImp).forEach(function (id) {
        var list = Object.keys(byImp[id]).map(function (k) { return byImp[id][k]; }), imp = D.imports.filter(function (i) { return i.id === +id; })[0];
        conflictInfo.push({ importId: +id, file: imp ? imp.fileName : '', records: list.length, from: list.reduce(function (a, x) { return !a || x.from < a ? x.from : a; }, null), to: list.reduce(function (a, x) { return !a || x.to > a ? x.to : a; }, null) });
      });
      warns.push('Có ' + cnt('conflict') + ' dòng có kỳ CHỒNG LẤN với dữ liệu đã nhập nhưng khác cấp/khác kỳ. Chọn “Thay thế dữ liệu cũ bị chồng lấn” hoặc bỏ qua các dòng này.');
    }
    var updates = recs.filter(function (p) { return p.cls === 'update'; }).slice(0, 15).map(function (p) {
      var er = D.tables[ds.key].get(p.k), diffs = [];
      ds.stored.forEach(function (x) { if (!sameVal(er.v[x.key], p.v[x.key])) diffs.push({ field: x.label, old: er.v[x.key], 'new': p.v[x.key] }); });
      return { row: p.row, key: p.k.split('|').slice(2).filter(Boolean).join(' | '), importId: er.imp, diffs: diffs };
    });
    var shown = ds.stored.filter(function (x) { return mapped[x.key]; });
    var level = ds.key === 'ads_campaign' ? ((mapped.campaign_id || mapped.campaign_name) ? 'Chiến dịch' : 'Shop') + ' × ' + (dayLevel ? 'ngày' : 'kỳ')
      : ds.key === 'orders' ? 'Dòng SKU trong đơn hàng (tổng hợp theo ngày tạo đơn)' : ds.key === 'ads_account_cost' ? 'Tài khoản quảng cáo × kỳ'
        : ds.key === 'settlement' ? 'Mã đơn/điều chỉnh × ngày quyết toán' : ds.key === 'invoice' ? 'Dòng hóa đơn × kỳ hóa đơn' : ds.key === 'ads_topup' ? 'Giao dịch'
          : (ds.hasScope ? 'Shop × phạm vi × ' : 'Shop × ') + (dayLevel ? 'ngày' : 'kỳ');
    Object.assign(res, { level: level, shopId: shopId, scope: scope, periodFrom: minD, periodTo: maxD, periodSource: dayLevel ? 'cột “' + ds.F[ds.dateField].label + '” trên từng dòng' : pSrc,
      counts: { rowsRead: recs.length + nErr, 'new': cnt('new'), dup: cnt('dup'), update: cnt('update'), conflict: cnt('conflict'), error: nErr, skipBlank: skipBlank, skipTotal: skipTotal, skipDesc: skipDesc },
      errors: errors, updates: updates, conflicts: conflictInfo, checks: checks, notes: notes, warnings: warns, newShops: newShops,
      sampleFields: shown.map(function (x) { return x.label; }), sampleTypes: shown.map(function (x) { return x.type; }),
      sample: recs.slice(0, 15).map(function (p) { return { row: p.row, cls: p.cls, shop: p.shop.indexOf('NEW:') === 0 ? p.shop.slice(4) : D.shopName(p.shop), from: p.from, to: p.to, values: shown.map(function (x) { return p.v[x.key]; }) }; }),
      partialRows: recs.filter(function (p) { return p.partial; }).length, category: req.category || 'auto', negate: negate });
    var pend = { token: uid(), up: up, ds: ds, recs: recs, meta: res };
    if (req.mapping && req.saveTemplate) { var mm = {}; Object.keys(map).forEach(function (c) { mm[c] = map[c]; }); pend.template = { sig: headerSig(hdr), dataset: ds.key, headerRow: headerRow, mapping: mm }; }
    pendings[pend.token] = pend; res.token = pend.token;
    return res;
  };
  function vn(s) { return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4); }

  /* req: {token, replaceConflicts, note, user} */
  I.commit = function (req) {
    var pend = pendings[req.token]; if (!pend) return Promise.reject(new Error('Bản xem trước đã hết hạn. Bấm Xem trước lại.'));
    delete pendings[req.token];
    var ds = pend.ds, table = D.tables[ds.key], shopMap = {};
    pend.recs.forEach(function (p) { if (p.shop.indexOf('NEW:') === 0 && !shopMap[p.shop]) shopMap[p.shop] = D.addShop(p.shop.slice(4)); });
    pend.recs.forEach(function (p) { if (shopMap[p.shop]) { var old = p.shop; p.shop = shopMap[old]; p.k = p.k.replace('|' + old + '|', '|' + p.shop + '|'); } });
    I.classify(ds, pend.recs);
    var id = D.settings.nextImportId++, c = { 'new': 0, dup: 0, update: 0, conflict: 0, replaced: 0, skipped: 0 }, deact = {};
    pend.recs.forEach(function (p) {
      if (p.cls === 'dup') { c.dup++; return; }
      if (p.cls === 'conflict') {
        c.conflict++;
        if (!req.replaceConflicts) { c.skipped++; return; }
        p.conflicts.forEach(function (k) {
          if (deact[k]) return; var er = table.get(k); if (!er || !er.active) return;
          er.h = er.h || []; er.h.push(snap(er)); er.active = false; er.deact = id; er.imp = id; deact[k] = 1; c.replaced++;
        });
      }
      var ex = table.get(p.k);
      if (ex) { ex.h = ex.h || []; ex.h.push(snap(ex)); Object.assign(ex, { v: p.v, imp: id, row: p.row, active: true, deact: 0, partial: p.partial, from: p.from, to: p.to }); if (p.cls === 'update') c.update++; else c['new']++; }
      else { table.set(p.k, { k: p.k, shop: p.shop, scope: p.scope, from: p.from, to: p.to, ent: p.ent, imp: id, row: p.row, v: p.v, partial: p.partial, active: true, deact: 0 }); c['new']++; }
    });
    D.markDirty(ds.key);
    var m = pend.meta, shopId = m.shopId && shopMap[m.shopId] ? shopMap[m.shopId] : m.shopId;
    var entry = { id: id, time: K.nowStr(), user: req.user || '', fileName: pend.up.fileName, hash: pend.up.hash, size: pend.up.size, dataset: ds.key, datasetLabel: ds.label,
      shopId: shopId, shopName: shopId ? D.shopName(shopId) : '(theo cột Shop trong file)', scope: m.scope, from: m.periodFrom, to: m.periodTo, periodSource: m.periodSource, level: m.level,
      sheet: pend.up.sheets[m.sheet].name, headerRow: m.headerRow + 1, rowsRead: m.counts.rowsRead, 'new': c['new'], dup: c.dup, update: c.update, conflict: c.conflict, replaced: c.replaced,
      conflictSkipped: c.skipped, error: m.counts.error, skipTotal: m.counts.skipTotal, skipDesc: m.counts.skipDesc, skipBlank: m.counts.skipBlank, warnings: m.warnings, notes: m.notes,
      note: req.note || '', category: m.category, negate: m.negate, sender: req.sender || null,
      mapping: m.columns.filter(function (x) { return x.status !== 'unused'; }), errors: m.errors.slice(0, 50), rolledBack: false };
    D.imports.push(entry);
    if (pend.template) { D.settings.templates = D.settings.templates.filter(function (t) { return t.sig !== pend.template.sig; }); D.settings.templates.push(pend.template); }
    if (ds.hasScope && D.settings.scopes.indexOf(m.scope) < 0) D.settings.scopes.push(m.scope);
    return D.save().then(function () { return entry; });
  };
  function snap(r) { return { imp: r.imp, row: r.row, deact: r.deact, active: r.active, partial: r.partial, v: r.v, from: r.from, to: r.to }; }
  I.pending = function (t) { return pendings[t]; };

  root.TTSI = I;
})(typeof window !== 'undefined' ? window : self);
