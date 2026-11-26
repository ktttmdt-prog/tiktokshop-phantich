/* Lõi: chuẩn hóa chữ, đọc số/ngày kiểu Việt Nam, đọc file Excel (.xlsx) & CSV, nén/giải nén ZIP – chạy hoàn toàn trong trình duyệt. */
(function (root) {
  'use strict';
  var K = {};

  // ---------- Chuỗi ----------
  K.norm = function (s, dropParen) {
    if (s == null) return '';
    s = String(s).replace(/ /g, ' ').trim();
    if (dropParen !== false) s = s.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/đ/g, 'd');
    s = s.replace(/[^\p{L}\p{N}%#]/gu, ' ');
    return s.replace(/\s+/g, ' ').trim();
  };
  K.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  K.ymd = function (y, m, d) { return y + '-' + K.pad2(m) + '-' + K.pad2(d); };
  K.nowStr = function () { var d = new Date(); return K.ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()) + ' ' + K.pad2(d.getHours()) + ':' + K.pad2(d.getMinutes()) + ':' + K.pad2(d.getSeconds()); };
  K.today = function () { var d = new Date(); return K.ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); };

  // ---------- Số ----------
  var THOUS_DOT = /^\d{1,3}(\.\d{3})+$/, THOUS_COMMA = /^\d{1,3}(,\d{3})+$/;
  /* preferThousands: "1.234" hiểu là 1234 (tiền, số đếm); false: "1.12" là 1,12 (tỷ lệ) */
  K.num = function (raw, preferThousands) {
    if (raw == null) return null;
    if (typeof raw === 'number') return { v: raw, pct: false };
    var s = String(raw).trim().replace(/ /g, '').replace(/ /g, '');
    if (!s || s === '-' || s === '--' || s === '—' || /^n\/?a$/i.test(s) || s === '#N/A') return null;
    var neg = false, pct = false;
    if (s[0] === '(' && s[s.length - 1] === ')') { neg = true; s = s.slice(1, -1); }
    s = s.replace(/₫|VNĐ|VND|vnd|vnđ|đ|Đ/g, '');
    if (s[s.length - 1] === '%') { pct = true; s = s.slice(0, -1); }
    if (s[0] === '+') s = s.slice(1);
    if (s[0] === '-') { neg = !neg; s = s.slice(1); }
    if (!s) return null;
    if (/^\d+(\.\d+)?[eE][-+]?\d+$/.test(s)) { var e = Number(s); if (!isFinite(e)) return null; return { v: neg ? -e : e, pct: pct }; }
    var hasDot = s.indexOf('.') >= 0, hasComma = s.indexOf(',') >= 0, c;
    if (hasDot && hasComma) c = s.lastIndexOf('.') > s.lastIndexOf(',') ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
    else if (hasDot) {
      if (s.indexOf('.') !== s.lastIndexOf('.')) c = THOUS_DOT.test(s) ? s.replace(/\./g, '') : null;
      else c = (preferThousands && !pct && THOUS_DOT.test(s)) ? s.replace(/\./g, '') : s;
    } else if (hasComma) {
      if (s.indexOf(',') !== s.lastIndexOf(',')) c = THOUS_COMMA.test(s) ? s.replace(/,/g, '') : null;
      else c = (preferThousands && !pct && THOUS_COMMA.test(s)) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else c = s;
    if (c == null || !/^\d*\.?\d+$|^\d+\.$/.test(c)) return null;
    var v = Number(c); if (!isFinite(v)) return null;
    return { v: neg ? -v : v, pct: pct };
  };

  // ---------- Ngày ----------
  var RX_ISO = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(AM|PM|SA|CH)?\s*(?:Z|[+-]\d{2}:?\d{2}|\(?UTC[+-]?\d{0,2}(?::\d{2})?\)?)?$/i;
  var RX_DMY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(AM|PM|SA|CH)?$/i;
  function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  K.serialToStr = function (serial, d1904) {
    if (d1904) serial += 1462;
    var ms = Math.round((serial - 25569) * 86400) * 1000, d = new Date(ms);
    var s = K.ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds()) s += ' ' + K.pad2(d.getUTCHours()) + ':' + K.pad2(d.getUTCMinutes()) + ':' + K.pad2(d.getUTCSeconds());
    return s;
  };
  /* Trả về {date:'yyyy-mm-dd', dt:'yyyy-mm-dd HH:MM:SS'} hoặc null; order 'DMY' | 'MDY' */
  K.date = function (raw, order) {
    if (raw == null) return null;
    var s = String(raw).trim(); if (!s) return null;
    var m = RX_ISO.exec(s), y, mo, d, h = 0, mi = 0, se = 0, ap = null;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; if (m[4]) { h = +m[4]; mi = +m[5]; } if (m[6]) se = +m[6]; if (m[7]) ap = m[7].toUpperCase(); }
    else {
      m = RX_DMY.exec(s);
      if (!m) {
        var n = Number(s);
        if (isFinite(n) && n > 20000 && n < 80000) { var x = K.serialToStr(n); return { date: x.substr(0, 10), dt: x.length > 10 ? x : x + ' 00:00:00' }; }
        return null;
      }
      var a = +m[1], b = +m[2]; y = +m[3];
      if (order === 'MDY') { mo = a; d = b; } else { d = a; mo = b; }
      if (m[4]) { h = +m[4]; mi = +m[5]; } if (m[6]) se = +m[6]; if (m[7]) ap = m[7].toUpperCase();
    }
    if (ap === 'PM' || ap === 'CH') { if (h < 12) h += 12; } else if ((ap === 'AM' || ap === 'SA') && h === 12) h = 0;
    if (mo < 1 || mo > 12 || d < 1 || d > dim(y, mo) || h > 23 || mi > 59 || se > 59) return null;
    var ds = K.ymd(y, mo, d);
    return { date: ds, dt: ds + ' ' + K.pad2(h) + ':' + K.pad2(mi) + ':' + K.pad2(se) };
  };
  K.inferOrder = function (values) {
    var dmy = false, mdy = false, any = false;
    values.forEach(function (v) { if (!v) return; var m = RX_DMY.exec(String(v).trim()); if (!m) return; any = true; if (+m[1] > 12) dmy = true; if (+m[2] > 12) mdy = true; });
    if (dmy && !mdy) return { order: 'DMY', amb: false };
    if (mdy && !dmy) return { order: 'MDY', amb: false };
    return { order: 'DMY', amb: any && !(dmy || mdy) };
  };
  K.findPeriod = function (text) {
    if (!text) return null;
    var m = /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*(?:~|–|-|_|đến|to)\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/.exec(text), a, b;
    if (m && (a = K.date(m[1])) && (b = K.date(m[2])) && a.date <= b.date) return { from: a.date, to: b.date };
    m = /(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:~|–|-|đến|to)\s*(\d{1,2}\/\d{1,2}\/\d{4})/.exec(text);
    if (m && (a = K.date(m[1], 'DMY')) && (b = K.date(m[2], 'DMY')) && a.date <= b.date) return { from: a.date, to: b.date };
    m = /(?:^|\D)(20\d{2})(\d{2})(\d{2})\s*[-_~]\s*(20\d{2})(\d{2})(\d{2})(?!\d)/.exec(text);
    if (m) { a = K.date(m[1] + '-' + m[2] + '-' + m[3]); b = K.date(m[4] + '-' + m[5] + '-' + m[6]); if (a && b && a.date <= b.date) return { from: a.date, to: b.date }; }
    return null;
  };

  // ---------- Băm / mã hóa base64 ----------
  K.hex = function (buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); };
  K.sha256 = function (bytes) { return crypto.subtle.digest('SHA-256', bytes).then(K.hex); };
  K.b64 = function (u8) { var s = '', CH = 0x8000; for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); };
  K.unb64 = function (s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  K.b64u = function (u8) { return K.b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  K.unb64u = function (s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return K.unb64(s); };

  // ---------- Nén ----------
  function streamBytes(u8, ts) { return new Response(new Blob([u8]).stream().pipeThrough(ts)).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  K.inflateRaw = function (u8) { return streamBytes(u8, new DecompressionStream('deflate-raw')); };
  K.deflateRaw = function (u8) { return streamBytes(u8, new CompressionStream('deflate-raw')); };
  K.gzip = function (u8) { return streamBytes(u8, new CompressionStream('gzip')); };
  K.gunzip = function (u8) { return streamBytes(u8, new DecompressionStream('gzip')); };
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  K.crc32 = function (u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  // ---------- ZIP: đọc ----------
  K.unzip = function (buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('File không phải định dạng Excel .xlsx hợp lệ.');
    var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), entries = {};
    var td = new TextDecoder('utf-8');
    for (var e = 0; e < n; e++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lho = dv.getUint32(off + 42, true);
      var name = td.decode(u8.subarray(off + 46, off + 46 + nl)).replace(/\\/g, '/').replace(/^\//, '');
      entries[name.toLowerCase()] = { name: name, method: method, csize: csize, usize: dv.getUint32(off + 24, true), lho: lho };
      off += 46 + nl + xl + cl;
    }
    function entry(p) { return entries[p.replace(/^\//, '').toLowerCase()] || null; }
    function raw(en) { var lnl = dv.getUint16(en.lho + 26, true), lxl = dv.getUint16(en.lho + 28, true), start = en.lho + 30 + lnl + lxl; return u8.subarray(start, start + en.csize); }
    return {
      has: function (p) { return !!entry(p); },
      size: function (p) { var en = entry(p); return en ? en.usize : 0; },
      read: function (p) {
        var en = entry(p); if (!en) return Promise.resolve(null);
        var data = raw(en);
        return (en.method === 8 ? K.inflateRaw(data) : Promise.resolve(data.slice())).then(function (b) { return td.decode(b); });
      },
      // luồng byte đã giải nén – dùng cho sheet rất lớn (không giữ cả chuỗi XML trong bộ nhớ)
      stream: function (p) {
        var en = entry(p); if (!en) return null;
        var s = new Blob([raw(en)]).stream();
        return en.method === 8 ? s.pipeThrough(new DecompressionStream('deflate-raw')) : s;
      }
    };
  };

  // ---------- ZIP: ghi (nén deflate) ----------
  K.zip = function (files) { // files: [{name, data: Uint8Array|string}]
    var te = new TextEncoder();
    return Promise.all(files.map(function (f) {
      var raw = typeof f.data === 'string' ? te.encode(f.data) : f.data;
      return K.deflateRaw(raw).then(function (comp) { return { name: te.encode(f.name), raw: raw, comp: comp, crc: K.crc32(raw) }; });
    })).then(function (list) {
      var parts = [], central = [], off = 0;
      list.forEach(function (f) {
        var h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 8, true);
        h.setUint32(14, f.crc, true); h.setUint32(18, f.comp.length, true); h.setUint32(22, f.raw.length, true); h.setUint16(26, f.name.length, true);
        parts.push(new Uint8Array(h.buffer), f.name, f.comp);
        var c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 8, true);
        c.setUint32(16, f.crc, true); c.setUint32(20, f.comp.length, true); c.setUint32(24, f.raw.length, true); c.setUint16(28, f.name.length, true); c.setUint32(42, off, true);
        central.push(new Uint8Array(c.buffer), f.name);
        off += 30 + f.name.length + f.comp.length;
      });
      var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
      var e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054b50, true); e.setUint16(8, list.length, true); e.setUint16(10, list.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
      return K.concat(parts.concat(central, [new Uint8Array(e.buffer)]));
    });
  };
  K.concat = function (arrs) { var n = 0; arrs.forEach(function (a) { n += a.length; }); var o = new Uint8Array(n), p = 0; arrs.forEach(function (a) { o.set(a, p); p += a.length; }); return o; };

  // ---------- Đọc Excel ----------
  var DATE_FMT = { 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 27: 1, 28: 1, 29: 1, 30: 1, 31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 1, 45: 1, 46: 1, 47: 1, 50: 1, 51: 1, 52: 1, 53: 1, 54: 1, 55: 1, 56: 1, 57: 1, 58: 1 };
  function isDateCode(code) {
    if (!code) return false;
    var s = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '').replace(/[_*]./g, '').toLowerCase();
    if (s.indexOf('general') >= 0) return false;
    return /[ydh]/.test(s) || (/m/.test(s) && !/[0#]/.test(s));
  }
  function xml(txt) { return new DOMParser().parseFromString(txt, 'application/xml'); }
  function els(node, name) { return node.getElementsByTagNameNS('*', name); }
  function textOf(node) { // ghép các thẻ <t> không nằm trong <rPh>
    var out = '', ts = els(node, 't');
    for (var i = 0; i < ts.length; i++) { var p = ts[i].parentNode, skip = false; while (p && p !== node) { if (p.localName === 'rPh') { skip = true; break; } p = p.parentNode; } if (!skip) out += ts[i].textContent; }
    return out;
  }
  function colIndex(ref) { var c = 0, any = false; for (var i = 0; i < ref.length; i++) { var ch = ref.charCodeAt(i); if (ch >= 65 && ch <= 90) { c = c * 26 + ch - 64; any = true; } else if (ch >= 97 && ch <= 122) { c = c * 26 + ch - 96; any = true; } else break; } return any ? c - 1 : -1; }

  K.BIG_XML = 24 * 1024 * 1024; // sheet / bảng chuỗi lớn hơn mức này (sau giải nén) được đọc theo luồng
  K.HEAD_ROWS = 60;              // sheet lớn: đọc trước bấy nhiêu dòng để nhận dạng, phần còn lại đọc khi nhập
  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  function unesc(s) {
    return s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, function (m, e) {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
      return ENT[e];
    });
  }
  function textOfXml(x) { // như textOf nhưng trên chuỗi XML: ghép <t> ngoài <rPh>
    x = x.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    var out = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, m;
    while ((m = re.exec(x))) out += m[1];
    return unesc(out);
  }
  /* Đọc luồng XML, gọi onItem(chuỗi XML của từng phần tử <tag>…</tag>); onItem trả false để dừng sớm. */
  function scanStream(stream, tag, onItem) {
    var reader = stream.getReader(), dec = new TextDecoder('utf-8'), buf = '', stop = false;
    var re = new RegExp('<' + tag + '\\b[^>]*?(?:\\/>|>[\\s\\S]*?<\\/' + tag + '>)', 'g');
    function flush() {
      re.lastIndex = 0; var m, last = 0;
      while ((m = re.exec(buf))) { last = re.lastIndex; if (onItem(m[0]) === false) { stop = true; break; } }
      if (last) buf = buf.slice(last);
      else { var i = buf.lastIndexOf('<' + tag); if (i > 0) buf = buf.slice(i); }
    }
    function pump() {
      return reader.read().then(function (res) {
        if (res.done) { buf += dec.decode(); flush(); return; }
        buf += dec.decode(res.value, { stream: true }); flush();
        if (stop) { try { reader.cancel(); } catch (e) { /* bỏ qua */ } return; }
        return pump();
      });
    }
    return pump();
  }
  function readSstStream(z) {
    var sst = [];
    return scanStream(z.stream('xl/sharedStrings.xml'), 'si', function (x) { sst.push(textOfXml(x)); }).then(function () { return sst; });
  }
  var RX_C = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, RX_V = /<v>([\s\S]*?)<\/v>/, RX_R = /\br="([A-Za-z]+)\d*"/, RX_T = /\bt="([^"]*)"/, RX_S = /\bs="(\d+)"/, RX_ROWN = /^<row\b[^>]*?\br="(\d+)"/;
  /* Sheet lớn: đọc theo luồng. maxRows: dừng sau số dòng này; keep: {cột:1} – sau HEAD_ROWS dòng đầu chỉ giữ các cột này (null = giữ tất cả). */
  function streamRows(z, path, sst, xfDate, d1904, maxRows, keep) {
    var rows = [];
    return scanStream(z.stream(path), 'row', function (x) {
      var rm = RX_ROWN.exec(x), rn = rm ? +rm[1] : rows.length + 1;
      // một số file TikTok ghi mỗi ô thành một thẻ <row> riêng, cùng số dòng → gộp vào dòng trước
      var merge = !!rm && rows.length > 0 && rn === rows.length;
      if (!merge) while (rows.length < rn - 1) rows.push([]);
      var head = (merge ? rows.length - 1 : rows.length) < K.HEAD_ROWS, cur = merge ? rows[rows.length - 1] : [], next = 0, m;
      RX_C.lastIndex = 0;
      while ((m = RX_C.exec(x))) {
        var at = m[1], inner = m[2] || '', rr = RX_R.exec(at), col = rr ? colIndex(rr[1]) : next; if (col < 0) col = next;
        next = col + 1;
        if (!head && keep && !keep[col]) continue;
        var tm = RX_T.exec(at), t = tm ? tm[1] : null, sm = RX_S.exec(at), s = sm ? +sm[1] : 0, vm = RX_V.exec(inner), v = vm ? unesc(vm[1]) : null, val;
        var inl = inner.indexOf('<is') >= 0 ? textOfXml(inner) : null;
        if (t === 's') val = sst[+v] != null ? sst[+v] : '';
        else if (t === 'inlineStr') val = inl != null ? inl : (v || '');
        else if (t === 'str' || t === 'e') val = v != null ? v : (inl || '');
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'd') val = v || '';
        else {
          val = v || '';
          if (val !== '' && isFinite(Number(val))) {
            if (xfDate[s]) val = K.serialToStr(Number(val), d1904);
            else (cur.n || (cur.n = [])).push(col);
          }
        }
        if (head) while (cur.length < col) cur.push('');
        cur[col] = val;
      }
      while (cur.length && (cur[cur.length - 1] === '' || cur[cur.length - 1] == null)) cur.pop();
      if (!merge) rows.push(cur);
      return rows.length <= maxRows; // đọc thêm 1 dòng để dòng cuối được gộp đủ ô, rồi cắt bỏ
    }).then(function () {
      if (rows.length > maxRows) rows.length = maxRows;
      while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
      return rows;
    });
  }
  function lazySheet(z, name, path, sst, xfDate, d1904) {
    var sh = { name: name, rows: [], lazy: true, bytes: z.size(path), kept: null,
      isNum: function (r, c) { var row = sh.rows[r]; return !!(row && row.n && row.n.indexOf(c) >= 0); } };
    // keep: {cột:1} hoặc null (đọc đủ mọi cột)
    sh.load = function (keep) {
      return streamRows(z, path, sst, xfDate, d1904, Infinity, keep).then(function (rows) { sh.rows = rows; sh.lazy = false; sh.kept = keep; return sh; });
    };
    return streamRows(z, path, sst, xfDate, d1904, K.HEAD_ROWS, null).then(function (rows) { sh.rows = rows; return sh; });
  }
  /* Sheet báo cáo dạng dọc (nhãn bên trái – số bên phải, có dòng “Khoảng thời gian”), ví dụ sheet “Báo cáo” trong file quyết toán:
     chuyển thành bảng 1 dòng (tiêu đề = nhãn) để nhận dạng như các file dạng bảng. */
  function pivotReport(sh) {
    if (sh.rows.length < 6 || sh.rows.length > 400) return null;
    var labels = [], vals = [], per = null, nNum = 0;
    sh.rows.forEach(function (row, r) {
      var ne = []; for (var c = 0; c < row.length; c++) if (row[c] != null && String(row[c]).trim() !== '') ne.push(c);
      if (ne.length !== 2) return;
      var lab = String(row[ne[0]]).trim(), val = row[ne[1]];
      if (/^(khoang thoi gian|time period|period|statement period)$/.test(K.norm(lab))) per = String(val);
      if (sh.isNum(r, ne[1]) || (val !== '' && isFinite(Number(val)))) nNum++;
      labels.push(lab); vals.push(String(val));
    });
    if (!per || nNum < 5) return null;
    return { name: sh.name + ' (bảng tổng hợp)', pivot: true, rows: [['Khoảng thời gian: ' + per], labels, vals],
      isNum: function (r, c) { return r === 2 && vals[c] !== '' && isFinite(Number(vals[c])); } };
  }

  K.readXlsx = function (buf) {
    var z = K.unzip(buf), bigSst = z.size('xl/sharedStrings.xml') > K.BIG_XML;
    return Promise.all([z.read('xl/workbook.xml'), z.read('xl/_rels/workbook.xml.rels'), bigSst ? readSstStream(z) : z.read('xl/sharedStrings.xml'), z.read('xl/styles.xml')]).then(function (r) {
      if (!r[0]) throw new Error('File không phải Excel hợp lệ (thiếu xl/workbook.xml).');
      var wb = xml(r[0]), d1904 = false;
      var pr = els(wb, 'workbookPr')[0]; if (pr) { var a = pr.getAttribute('date1904'); d1904 = a === '1' || a === 'true'; }
      var rels = {};
      if (r[1]) { var rs = els(xml(r[1]), 'Relationship'); for (var i = 0; i < rs.length; i++) { var t = rs[i].getAttribute('Target').replace(/\\/g, '/'); rels[rs[i].getAttribute('Id')] = t[0] === '/' ? t.slice(1) : 'xl/' + t; } }
      var sst = [];
      if (bigSst) sst = r[2];
      else if (r[2]) { var si = els(xml(r[2]), 'si'); for (var j = 0; j < si.length; j++) sst.push(textOf(si[j])); }
      var xfDate = [];
      if (r[3]) {
        var st = xml(r[3]), custom = {}, nf = els(st, 'numFmt');
        for (var k = 0; k < nf.length; k++) custom[nf[k].getAttribute('numFmtId')] = nf[k].getAttribute('formatCode');
        var cx = els(st, 'cellXfs')[0];
        if (cx) { var xfs = els(cx, 'xf'); for (var q = 0; q < xfs.length; q++) { var id = +(xfs[q].getAttribute('numFmtId') || 0); xfDate.push(!!DATE_FMT[id] || isDateCode(custom[id])); } }
      }
      var sheets = [], sh = els(wb, 'sheet');
      for (var s2 = 0; s2 < sh.length; s2++) {
        var rid = null, at = sh[s2].attributes;
        for (var a2 = 0; a2 < at.length; a2++) if (at[a2].localName === 'id' && /relationships/.test(at[a2].namespaceURI || '')) rid = at[a2].value;
        if (rid && rels[rid]) sheets.push({ name: sh[s2].getAttribute('name'), path: rels[rid] });
      }
      return Promise.all(sheets.map(function (s) {
        if (!z.has(s.path)) return null;
        if (z.size(s.path) > K.BIG_XML) return lazySheet(z, s.name, s.path, sst, xfDate, d1904);
        return z.read(s.path).then(function (txt) { return txt == null ? null : parseSheet(s.name, txt, sst, xfDate, d1904); });
      })).then(function (list) {
        var out = [];
        list.filter(Boolean).forEach(function (sh) { out.push(sh); var pv = !sh.lazy && pivotReport(sh); if (pv) out.push(pv); });
        return out;
      });
    });
  };
  function parseSheet(name, txt, sst, xfDate, d1904) {
    var doc = xml(txt), rowsEl = els(doc, 'row'), rows = [], num = new Set();
    for (var i = 0; i < rowsEl.length; i++) {
      var re = rowsEl[i], rn = +(re.getAttribute('r') || 0);
      var merge = rn > 0 && rows.length > 0 && rn === rows.length; // nhiều thẻ <row> cùng số dòng → gộp
      if (rn && !merge) while (rows.length < rn - 1) rows.push([]);
      var cur = merge ? rows[rows.length - 1] : [], next = 0, cells = re.childNodes;
      for (var j = 0; j < cells.length; j++) {
        var c = cells[j]; if (c.nodeType !== 1 || c.localName !== 'c') continue;
        var ref = c.getAttribute('r'), col = ref ? colIndex(ref) : next; if (col < 0) col = next;
        var t = c.getAttribute('t'), s = +(c.getAttribute('s') || 0), v = null, inl = null;
        for (var k = 0; k < c.childNodes.length; k++) { var ch = c.childNodes[k]; if (ch.nodeType !== 1) continue; if (ch.localName === 'v') v = ch.textContent; else if (ch.localName === 'is') inl = textOf(ch); }
        var val;
        if (t === 's') val = sst[+v] != null ? sst[+v] : '';
        else if (t === 'inlineStr') val = inl != null ? inl : (v || '');
        else if (t === 'str' || t === 'e') val = v != null ? v : (inl || '');
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'd') val = v || '';
        else {
          val = v || '';
          if (val !== '' && isFinite(Number(val))) {
            if (xfDate[s]) val = K.serialToStr(Number(val), d1904);
            else num.add((merge ? rows.length - 1 : rows.length) + '|' + col);
          }
        }
        while (cur.length < col) cur.push('');
        cur[col] = val; next = col + 1;
      }
      while (cur.length && (cur[cur.length - 1] === '' || cur[cur.length - 1] == null)) cur.pop();
      if (!merge) rows.push(cur);
    }
    while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
    return { name: name, rows: rows, isNum: function (r, c) { return num.has(r + '|' + c); } };
  }

  // ---------- Đọc CSV ----------
  K.decodeText = function (u8) {
    if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(u8.subarray(3));
    if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8.subarray(2));
    if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8.subarray(2));
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { return new TextDecoder('windows-1258').decode(u8); }
  };
  K.readCsv = function (u8) {
    var text = K.decodeText(u8), nl = text.indexOf('\n'), first = nl > 0 ? text.slice(0, nl) : text, delim = ',', best = -1;
    [',', ';', '\t', '|'].forEach(function (d) { var c = 0, q = false; for (var i = 0; i < first.length; i++) { if (first[i] === '"') q = !q; else if (first[i] === d && !q) c++; } if (c > best) { best = c; delim = d; } });
    var rows = [], row = [], cell = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += ch; }
      else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\r') { }
      else if (ch === '\n') { row.push(cell); cell = ''; rows.push(row); row = []; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    rows = rows.map(function (r) { while (r.length && r[r.length - 1] === '') r.pop(); return r; });
    while (rows.length && !rows[rows.length - 1].length) rows.pop();
    return [{ name: 'CSV', rows: rows, isNum: function () { return false; } }];
  };
  K.readSheets = function (fileName, buf) {
    var u8 = new Uint8Array(buf), ext = (fileName.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xlsm' || (u8[0] === 0x50 && u8[1] === 0x4B)) return K.readXlsx(buf);
    if (ext === 'xls' && u8[0] === 0xD0 && u8[1] === 0xCF) return Promise.reject(new Error('File .xls (Excel 97-2003) chưa hỗ trợ. Mở bằng Excel và lưu lại dạng .xlsx hoặc .csv rồi nhập lại.'));
    return Promise.resolve(K.readCsv(u8));
  };

  root.TTSK = K;
})(typeof window !== 'undefined' ? window : self);
