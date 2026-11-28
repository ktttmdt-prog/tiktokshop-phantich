/* Kho dữ liệu trên chính máy người dùng (IndexedDB của trình duyệt) – không gửi đi đâu.
   Bản ghi giữ lịch sử để hủy lần nhập; sao lưu/khôi phục ra file .ttsbak (nén gzip). */
(function (root) {
  'use strict';
  var K = root.TTSK, SC = root.TTSS;
  var DBN = 'tiktokshop-phantich', ST = 'kv';
  var D = { tables: {}, imports: [], settings: {}, version: 0, dirty: {} };
  SC.all.forEach(function (d) { D.tables[d.key] = new Map(); });

  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(ST, mode), s = t.objectStore(ST), out = fn(s);
        t.oncomplete = function () { db.close(); res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { db.close(); rej(t.error); };
      });
    });
  }
  function getAll() {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(ST, 'readonly'), s = t.objectStore(ST), out = {}, c = s.openCursor();
        c.onsuccess = function () { var cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
        t.oncomplete = function () { db.close(); res(out); }; t.onerror = function () { db.close(); rej(t.error); };
      });
    });
  }
  function ensureSettings() {
    var s = D.settings;
    if (!Array.isArray(s.shops)) s.shops = [];
    if (!Array.isArray(s.thresholds)) s.thresholds = [12, 13];
    if (!('official' in s)) s.official = null;
    if (!Array.isArray(s.scopes)) s.scopes = ['Tất cả kênh'];
    if (!Array.isArray(s.templates)) s.templates = [];
    if (!s.nextImportId) s.nextImportId = 1;
    if (!s.nextShopId) s.nextShopId = 1;
  }

  D.load = function () {
    return getAll().then(function (all) {
      D.memoryOnly = false; D.settings = all.settings || {}; ensureSettings();
      D.imports = all.imports || [];
      SC.all.forEach(function (d) {
        var m = new Map(), parts = [all['ds:' + d.key] || []]; // bản cũ lưu cả bảng một khóa; bản mới chia phần 'ds:<bảng>#0000'…
        Object.keys(all).filter(function (k) { return k.indexOf('ds:' + d.key + '#') === 0; }).sort().forEach(function (k) { parts.push(all[k] || []); });
        parts.forEach(function (p) { p.forEach(function (r) { m.set(r.k, r); }); });
        D.tables[d.key] = m;
      });
      D.version++;
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    });
  };
  /* Kho trống chỉ trong bộ nhớ (chế độ nhân sự): không đọc, không ghi dữ liệu kế toán trên máy */
  D.loadEmpty = function () {
    D.settings = {}; ensureSettings(); D.imports = []; D.memoryOnly = true;
    SC.all.forEach(function (d) { D.tables[d.key] = new Map(); });
    return Promise.resolve();
  };
  D.markDirty = function (ds) { D.dirty[ds] = 1; };
  var CHUNK = 20000; // số bản ghi mỗi phần – tránh giới hạn kích thước một giá trị của IndexedDB khi bảng rất lớn
  function saveTable(k) {
    var rows = Array.from(D.tables[k].values());
    return tx('readwrite', function (s) {
      s.delete('ds:' + k);
      s.delete(IDBKeyRange.bound('ds:' + k + '#', 'ds:' + k + '#￿'));
      for (var i = 0, n = 0; i < rows.length; i += CHUNK, n++) s.put(rows.slice(i, i + CHUNK), 'ds:' + k + '#' + ('000' + n).slice(-4));
    });
  }
  D.save = function () {
    if (D.memoryOnly) { D.dirty = {}; return Promise.resolve(); }
    var keys = Object.keys(D.dirty); D.dirty = {};
    return keys.reduce(function (p, k) { return p.then(function () { return saveTable(k); }); }, Promise.resolve())
      .then(function () { return tx('readwrite', function (s) { s.put(D.settings, 'settings'); s.put(D.imports, 'imports'); }); })
      .then(function () { D.version++; });
  };
  D.saveMeta = function () { if (D.memoryOnly) return Promise.resolve(); return tx('readwrite', function (s) { s.put(D.settings, 'settings'); s.put(D.imports, 'imports'); }).then(function () { D.version++; }); };

  // ----- shop -----
  D.shopName = function (id) { var s = D.settings.shops.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; };
  D.findShop = function (name) { var n = K.norm(name, false); var s = D.settings.shops.filter(function (x) { return K.norm(x.name, false) === n; })[0]; return s ? s.id : null; };
  D.addShop = function (name) {
    name = (name || '').trim(); if (!name) throw new Error('Tên shop trống.');
    var ex = D.findShop(name); if (ex) return ex;
    var id = 'S' + D.settings.nextShopId++; D.settings.shops.push({ id: id, name: name }); return id;
  };

  // ----- hủy lần nhập -----
  D.rollback = function (id) {
    var imp = D.imports.filter(function (i) { return i.id === id; })[0];
    if (!imp) return Promise.reject(new Error('Không tìm thấy lần nhập #' + id));
    if (imp.rolledBack) return Promise.reject(new Error('Lần nhập #' + id + ' đã được hủy trước đó.'));
    var blockers = {};
    Object.keys(D.tables).forEach(function (k) { D.tables[k].forEach(function (r) { if (r.imp !== id && r.h && r.h.some(function (h) { return h.imp === id; })) blockers[r.imp] = 1; }); });
    var b = Object.keys(blockers);
    if (b.length) return Promise.reject(new Error('Không thể hủy lần nhập #' + id + ' vì dữ liệu của nó đã được lần nhập sau cập nhật: #' + b.join(', #') + '. Hãy hủy các lần nhập đó trước.'));
    var removed = 0, restored = 0;
    Object.keys(D.tables).forEach(function (k) {
      var del = [];
      D.tables[k].forEach(function (r) {
        if (r.imp !== id) return;
        D.markDirty(k);
        if (!r.h || !r.h.length) { del.push(r.k); removed++; }
        else { var h = r.h.pop(); ['imp', 'row', 'deact', 'active', 'partial', 'v', 'from', 'to'].forEach(function (f) { r[f] = h[f]; }); restored++; }
      });
      del.forEach(function (x) { D.tables[k].delete(x); });
    });
    imp.rolledBack = true; imp.rolledBackAt = K.nowStr(); imp.rollbackResult = 'Đã xóa ' + removed + ' bản ghi mới, khôi phục ' + restored + ' bản ghi về trạng thái trước.';
    return D.save();
  };

  // ----- sao lưu / khôi phục (file trên máy) -----
  D.backupBytes = function () {
    var o = { app: 'tiktokshop-phantich', ver: 1, time: K.nowStr(), settings: D.settings, imports: D.imports, tables: {} };
    Object.keys(D.tables).forEach(function (k) { o.tables[k] = Array.from(D.tables[k].values()); });
    return K.gzip(new TextEncoder().encode(JSON.stringify(o)));
  };
  D.restoreBytes = function (u8) {
    return K.gunzip(u8).then(function (raw) {
      var o = JSON.parse(new TextDecoder().decode(raw));
      if (o.app !== 'tiktokshop-phantich' || !o.settings || !o.imports) throw new Error('File sao lưu không hợp lệ.');
      D.settings = o.settings; ensureSettings(); D.imports = o.imports;
      SC.all.forEach(function (d) { var m = new Map(); (o.tables[d.key] || []).forEach(function (r) { m.set(r.k, r); }); D.tables[d.key] = m; D.dirty[d.key] = 1; });
      return D.save();
    });
  };
  D.wipe = function () { return tx('readwrite', function (s) { s.clear(); }).then(D.load); };
  D.stats = function () { var n = 0; Object.keys(D.tables).forEach(function (k) { n += D.tables[k].size; }); return { records: n, imports: D.imports.length }; };

  root.TTSD = D;
})(typeof window !== 'undefined' ? window : self);
