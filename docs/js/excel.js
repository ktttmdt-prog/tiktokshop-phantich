/* Ghi file Excel .xlsx (công thức, tên vùng, định dạng) và mã hóa mật khẩu mở file chuẩn Office Agile (AES-256, SHA-512) – chạy trong trình duyệt. */
(function (root) {
  'use strict';
  var K = root.TTSK, X = {};
  X.S = { Text: 0, Header: 1, Money: 2, Int: 2, Num2: 3, Pct: 4, Title: 5, Note: 6, Plain: 7, Num4: 8, Date: 9, TotText: 10, TotMoney: 11, TotNum2: 12, TotPct: 13, InMoney: 14, InNum2: 15, Bold: 16, Section: 17, DateTime: 18 };
  X.col = function (i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  function esc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  X.book = function () {
    var b = { sheets: [], names: {} };
    b.add = function (name) {
      var s = { name: name, cells: {}, widths: {}, freeze: 0, filter: null, tab: null };
      s.set = function (r, c, v, st) { (s.cells[r] = s.cells[r] || {})[c] = { v: v === undefined ? null : v, s: st || 0 }; return s.cells[r][c]; };
      s.fx = function (r, c, f, cached, st) { var x = s.set(r, c, cached, st); x.f = f; return x; };
      s.abs = function (r, c) { return "'" + s.name.replace(/'/g, "''") + "'!$" + X.col(c) + '$' + r; };
      s.absRange = function (r1, c, r2) { return "'" + s.name.replace(/'/g, "''") + "'!$" + X.col(c) + '$' + r1 + ':$' + X.col(c) + '$' + Math.max(r1, r2); };
      b.sheets.push(s); return s;
    };
    b.name = function (n, ref) { b.names[n] = ref; };
    b.has = function (n) { return !!b.names[n]; };
    return b;
  };

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="5"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="#,##0.00"/><numFmt numFmtId="166" formatCode="#,##0.0000"/><numFmt numFmtId="167" formatCode="dd/mm/yyyy"/><numFmt numFmtId="168" formatCode="dd/mm/yyyy hh:mm"/></numFmts>' +
    '<fonts count="6"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FF1F4E79"/><name val="Arial"/></font>' +
    '<font><i/><sz val="10"/><color rgb="FF555555"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FF1F4E79"/><name val="Arial"/></font></fonts>' +
    '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF0EFEC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border/><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="19">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="10" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>' +
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="167" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="4" fillId="3" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="165" fontId="4" fillId="3" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="10" fontId="4" fillId="3" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="164" fontId="4" fillId="4" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="165" fontId="4" fillId="4" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="5" fillId="0" borderId="0" applyFont="1"/>' +
    '<xf numFmtId="168" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/></cellXfs></styleSheet>';

  /* giá trị ngày: chuỗi 'yyyy-mm-dd' hoặc 'yyyy-mm-dd HH:MM:SS' đặt kiểu Date/DateTime → đổi sang số sê-ri Excel */
  function serial(s) { var m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/.exec(s); if (!m) return null; return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 864e5 + 25569; }
  function cellXml(r, c, x) {
    var ref = X.col(c) + r, v = x.v, st = x.s;
    if (x.f != null) {
      var h = '<c r="' + ref + '" s="' + st + '"' + (typeof v === 'string' ? ' t="str"' : '') + '><f>' + esc(x.f) + '</f>';
      if (typeof v === 'string') h += '<v>' + esc(v) + '</v>'; else if (typeof v === 'number' && isFinite(v)) h += '<v>' + v + '</v>';
      return h + '</c>';
    }
    if (v == null || v === '') return '<c r="' + ref + '" s="' + st + '"/>';
    if ((st === 9 || st === 18) && typeof v === 'string') { var sv = serial(v); if (sv != null) return '<c r="' + ref + '" s="' + st + '"><v>' + sv + '</v></c>'; st = 0; }
    if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '" s="' + st + '"><v>' + v + '</v></c>';
    var s = String(v); if (s.length > 32000) s = s.slice(0, 32000);
    return '<c r="' + ref + '" s="' + st + '" t="inlineStr"><is><t xml:space="preserve">' + esc(s) + '</t></is></c>';
  }
  function sheetXml(s, sel) {
    var rows = Object.keys(s.cells).map(Number).sort(function (a, b) { return a - b; }), maxC = 0, h = [];
    rows.forEach(function (r) { Object.keys(s.cells[r]).forEach(function (c) { if (+c > maxC) maxC = +c; }); });
    h.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
    if (s.tab) h.push('<sheetPr><tabColor rgb="' + s.tab + '"/></sheetPr>');
    h.push('<sheetViews><sheetView workbookViewId="0"' + (sel ? ' tabSelected="1"' : '') + '>' + (s.freeze ? '<pane ySplit="' + s.freeze + '" topLeftCell="A' + (s.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>');
    for (var c = 0; c <= maxC; c++) {
      var w = s.widths[c];
      if (!w) { var len = 8; rows.forEach(function (r) { var x = s.cells[r][c]; if (!x || x.v == null || x.s === 5 || x.s === 6 || x.s === 7 || x.s === 17) return; var l = typeof x.v === 'number' ? 15 : String(x.v).length + 2; if (l > len) len = l; }); w = Math.min(48, Math.max(9, len)); }
      h.push('<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + w + '" customWidth="1"/>');
    }
    h.push('</cols><sheetData>');
    rows.forEach(function (r) { var cs = Object.keys(s.cells[r]).map(Number).sort(function (a, b) { return a - b; }); h.push('<row r="' + r + '">' + cs.map(function (c2) { return cellXml(r, c2, s.cells[r][c2]); }).join('') + '</row>'); });
    h.push('</sheetData>');
    if (s.filter) h.push('<autoFilter ref="' + s.filter + '"/>');
    h.push('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape"/></worksheet>');
    return h.join('');
  }
  X.build = function (b) {
    var used = {};
    b.sheets.forEach(function (s) {
      var n = (s.name || 'Sheet').replace(/[\[\]:*?\/\\]/g, '').slice(0, 31) || 'Sheet', base = n, k = 2;
      while (used[n.toLowerCase()]) { var suf = ' (' + k++ + ')'; n = base.slice(0, 31 - suf.length) + suf; }
      used[n.toLowerCase()] = 1; s.name = n;
    });
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      b.sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>';
    var names = Object.keys(b.names).sort(function (a, c) { return a.toLowerCase() < c.toLowerCase() ? -1 : 1; }).map(function (n) { return '<definedName name="' + esc(n) + '">' + esc(b.names[n]) + '</definedName>'; });
    b.sheets.forEach(function (s, i) { if (s.filter) { var p = s.filter.split(':'); var fx = function (r) { return r.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2'); }; names.push('<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">' + esc("'" + s.name.replace(/'/g, "''") + "'!" + fx(p[0]) + ':' + fx(p[1])) + '</definedName>'); } });
    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
      b.sheets.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>' + (names.length ? '<definedNames>' + names.join('') + '</definedNames>' : '') + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      b.sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (b.sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    var files = [{ name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: wb }, { name: 'xl/_rels/workbook.xml.rels', data: rels }, { name: 'xl/styles.xml', data: STYLES }];
    b.sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s, i === 0) }); });
    return K.zip(files);
  };

  // ---------- Mã hóa mật khẩu mở file (MS-OFFCRYPTO Agile) ----------
  var BK = { vin: [0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79], vval: [0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e], key: [0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6], hk: [0x5f, 0xb2, 0xad, 0x01, 0x0c, 0xb9, 0xe1, 0xf6], hv: [0xa0, 0x67, 0x7f, 0x02, 0xb2, 0x2c, 0x84, 0x33] };
  var SUB = crypto.subtle;
  function sha512() { return SUB.digest('SHA-512', K.concat(Array.prototype.slice.call(arguments).map(function (a) { return a instanceof Uint8Array ? a : new Uint8Array(a); }))).then(function (b) { return new Uint8Array(b); }); }
  function u32(i) { return new Uint8Array([i & 255, (i >>> 8) & 255, (i >>> 16) & 255, (i >>> 24) & 255]); }
  function fit(b, len, pad) { var r = new Uint8Array(len); for (var i = 0; i < len; i++) r[i] = i < b.length ? b[i] : pad; return r; }
  function padBlock(d) { var rem = d.length % 16; if (!rem) return d; var r = new Uint8Array(d.length + 16 - rem); r.set(d); return r; }
  function rnd(n) { var b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
  // AES-CBC không đệm: WebCrypto luôn thêm 1 khối PKCS#7 → bỏ khối cuối (dữ liệu đã là bội 16 byte)
  function aes(key, iv, data) { return SUB.importKey('raw', key, 'AES-CBC', false, ['encrypt']).then(function (k) { return SUB.encrypt({ name: 'AES-CBC', iv: iv }, k, data); }).then(function (b) { return new Uint8Array(b).slice(0, data.length); }); }
  function iv(salt, blockKey) { return sha512(salt, blockKey).then(function (h) { return fit(h, 16, 0x36); }); }
  function pwHash(pw, salt, spin) {
    var pwb = new Uint8Array(pw.length * 2); for (var i = 0; i < pw.length; i++) { var c = pw.charCodeAt(i); pwb[i * 2] = c & 255; pwb[i * 2 + 1] = c >> 8; }
    return sha512(salt, pwb).then(function (h) {
      var buf = new Uint8Array(68), k = 0;
      function step() {
        var chain = Promise.resolve(h);
        for (var j = 0; j < 2000 && k < spin; j++, k++) (function (kk) { chain = chain.then(function (x) { buf.set(u32(kk), 0); buf.set(x, 4); return SUB.digest('SHA-512', buf).then(function (b) { return new Uint8Array(b); }); }); })(k);
        return chain.then(function (x) { h = x; return k < spin ? step() : h; });
      }
      return step();
    });
  }
  function pwKey(h, bk) { return sha512(h, new Uint8Array(bk)).then(function (x) { return fit(x, 32, 0x36); }); }

  X.encrypt = function (pkg, password) {
    var keySalt = rnd(16), pkgKey = rnd(32), segs = [], n = 0;
    for (var off = 0; off < pkg.length; off += 4096, n++) segs.push({ i: n, d: padBlock(pkg.subarray(off, Math.min(pkg.length, off + 4096))) });
    var sizeHdr = new Uint8Array(8); var dv = new DataView(sizeHdr.buffer); dv.setUint32(0, pkg.length % 4294967296, true); dv.setUint32(4, Math.floor(pkg.length / 4294967296), true);
    return Promise.all(segs.map(function (s) { return iv(keySalt, u32(s.i)).then(function (v) { return aes(pkgKey, v, s.d); }); })).then(function (encSegs) {
      var encPkg = K.concat([sizeHdr].concat(encSegs)), hmacKey = rnd(64), pwSalt = rnd(16), verIn = rnd(16), out = {};
      return iv(keySalt, new Uint8Array(BK.hk)).then(function (v) { return aes(pkgKey, v, hmacKey); }).then(function (x) { out.encHmacKey = x; return SUB.importKey('raw', hmacKey, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']); })
        .then(function (k) { return SUB.sign('HMAC', k, encPkg); }).then(function (hv) { return iv(keySalt, new Uint8Array(BK.hv)).then(function (v) { return aes(pkgKey, v, new Uint8Array(hv)); }); })
        .then(function (x) { out.encHmacVal = x; return pwHash(password, pwSalt, 100000); })
        .then(function (h) {
          return Promise.all([pwKey(h, BK.vin).then(function (k) { return aes(k, pwSalt, verIn); }),
            Promise.all([pwKey(h, BK.vval), sha512(verIn)]).then(function (r) { return aes(r[0], pwSalt, r[1]); }),
            pwKey(h, BK.key).then(function (k) { return aes(k, pwSalt, pkgKey); })]);
        }).then(function (r) {
          var common = 'saltSize="16" blockSize="16" keyBits="256" hashSize="64" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512"';
          var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<encryption xmlns="http://schemas.microsoft.com/office/2006/encryption" xmlns:p="http://schemas.microsoft.com/office/2006/keyEncryptor/password" xmlns:c="http://schemas.microsoft.com/office/2006/keyEncryptor/certificate">' +
            '<keyData ' + common + ' saltValue="' + K.b64(keySalt) + '"/><dataIntegrity encryptedHmacKey="' + K.b64(out.encHmacKey) + '" encryptedHmacValue="' + K.b64(out.encHmacVal) + '"/>' +
            '<keyEncryptors><keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password"><p:encryptedKey spinCount="100000" ' + common + ' saltValue="' + K.b64(pwSalt) +
            '" encryptedVerifierHashInput="' + K.b64(r[0]) + '" encryptedVerifierHashValue="' + K.b64(r[1]) + '" encryptedKeyValue="' + K.b64(r[2]) + '"/></keyEncryptor></keyEncryptors></encryption>';
          var info = K.concat([new Uint8Array([4, 0, 4, 0, 0x40, 0, 0, 0]), new TextEncoder().encode(xml)]);
          return cfb([['EncryptionInfo', info], ['EncryptedPackage', encPkg]]);
        });
    });
  };

  // Compound File Binary (OLE2) v3: sector 512, mini stream, DIFAT
  function cfb(streams) {
    var FREE = 0xFFFFFFFF, END = 0xFFFFFFFE, FAT = 0xFFFFFFFD, DIF = 0xFFFFFFFC, NOS = 0xFFFFFFFF, SS = 512, MSS = 64, CUT = 4096;
    var list = streams.slice().sort(function (a, b) { return a[0].length - b[0].length || (a[0].toUpperCase() < b[0].toUpperCase() ? -1 : 1); }), n = list.length;
    var miniParts = [], miniLen = 0, miniFat = [], start = [], isMini = [];
    list.forEach(function (s, i) {
      var d = s[1]; if (d.length >= CUT) return; isMini[i] = true;
      if (!d.length) { start[i] = END; return; }
      var first = miniLen / MSS, cnt = Math.ceil(d.length / MSS); start[i] = first;
      var padded = new Uint8Array(cnt * MSS); padded.set(d); miniParts.push(padded); miniLen += padded.length;
      for (var k = 0; k < cnt; k++) miniFat.push(k === cnt - 1 ? END : first + k + 1);
    });
    var ceil = function (a, b) { return Math.ceil(a / b); };
    var miniFatSec = ceil(miniFat.length * 4, SS), miniSec = ceil(miniLen, SS), dirSec = ceil(n + 1, 4), big = [], bigTot = 0;
    list.forEach(function (s, i) { if (!isMini[i]) { big[i] = ceil(s[1].length, SS); bigTot += big[i]; } });
    var data = dirSec + miniFatSec + miniSec + bigTot, fatSec = 0, difSec = 0;
    for (;;) { var tot = data + fatSec + difSec, nf = ceil(tot, 128), nd = nf > 109 ? ceil(nf - 109, 127) : 0; if (nf === fatSec && nd === difSec) break; fatSec = nf; difSec = nd; }
    var total = fatSec + difSec + data, fat = new Uint32Array(fatSec * 128).fill(FREE), s = 0;
    for (var i = 0; i < fatSec; i++) fat[s++] = FAT;
    var difStart = s; for (i = 0; i < difSec; i++) fat[s++] = DIF;
    function chain(c) { var f = s; for (var k = 0; k < c; k++) { fat[s] = k === c - 1 ? END : s + 1; s++; } return f; }
    var dirStart = chain(dirSec), mfStart = miniFatSec ? chain(miniFatSec) : -1, msStart = miniSec ? chain(miniSec) : -1;
    list.forEach(function (st, j) { if (!isMini[j]) start[j] = big[j] ? chain(big[j]) : END; });
    var file = new Uint8Array(SS + total * SS), dv = new DataView(file.buffer);
    file.set([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], 0);
    dv.setUint16(24, 0x3E, true); dv.setUint16(26, 3, true); dv.setUint16(28, 0xFFFE, true); dv.setUint16(30, 9, true); dv.setUint16(32, 6, true);
    dv.setUint32(44, fatSec, true); dv.setUint32(48, dirStart, true); dv.setUint32(56, CUT, true);
    dv.setUint32(60, mfStart >= 0 ? mfStart : END, true); dv.setUint32(64, miniFatSec, true); dv.setUint32(68, difSec ? difStart : END, true); dv.setUint32(72, difSec, true);
    for (i = 0; i < 109; i++) dv.setUint32(76 + i * 4, i < fatSec ? i : FREE, true);
    for (var d = 0; d < difSec; d++) { var o = SS + (difStart + d) * SS; for (var k2 = 0; k2 < 127; k2++) { var ix = 109 + d * 127 + k2; dv.setUint32(o + k2 * 4, ix < fatSec ? ix : FREE, true); } dv.setUint32(o + 508, d === difSec - 1 ? END : difStart + d + 1, true); }
    for (i = 0; i < fat.length; i++) dv.setUint32(SS + i * 4, fat[i], true);
    var dOff = SS + dirStart * SS;
    for (var e = 0; e < dirSec * 4; e++) { var eo = dOff + e * 128; dv.setUint32(eo + 68, NOS, true); dv.setUint32(eo + 72, NOS, true); dv.setUint32(eo + 76, NOS, true); }
    var left = [], right = [], color = [];
    for (i = 0; i < n; i++) { left[i] = NOS; right[i] = NOS; color[i] = 1; }
    function tree(lo, hi, depth) { if (lo > hi) return -1; var mid = (lo + hi) >> 1, l = tree(lo, mid - 1, depth + 1), r = tree(mid + 1, hi, depth + 1); left[mid] = l < 0 ? NOS : l; right[mid] = r < 0 ? NOS : r; if (l < 0 && r < 0 && depth > 0) color[mid] = 0; return mid; }
    var rootChild = tree(0, n - 1, 0);
    function dir(o, name, type, col, l, r, child, st, size) {
      for (var c = 0; c < name.length && c < 31; c++) dv.setUint16(o + c * 2, name.charCodeAt(c), true);
      dv.setUint16(o + 64, (name.length + 1) * 2, true); file[o + 66] = type; file[o + 67] = col;
      dv.setUint32(o + 68, l, true); dv.setUint32(o + 72, r, true); dv.setUint32(o + 76, child, true); dv.setUint32(o + 116, st, true); dv.setUint32(o + 120, size, true); dv.setUint32(o + 124, 0, true);
    }
    dir(dOff, 'Root Entry', 5, 1, NOS, NOS, rootChild + 1, msStart >= 0 ? msStart : END, miniLen);
    list.forEach(function (st, j) { dir(dOff + (j + 1) * 128, st[0], 2, color[j], left[j] === NOS ? NOS : left[j] + 1, right[j] === NOS ? NOS : right[j] + 1, NOS, start[j], st[1].length); });
    if (mfStart >= 0) for (i = 0; i < miniFatSec * 128; i++) dv.setUint32(SS + mfStart * SS + i * 4, i < miniFat.length ? miniFat[i] : FREE, true);
    if (msStart >= 0) file.set(K.concat(miniParts), SS + msStart * SS);
    list.forEach(function (st, j) { if (!isMini[j] && st[1].length) file.set(st[1], SS + start[j] * SS); });
    return file;
  }

  root.TTSX = X;
})(typeof window !== 'undefined' ? window : self);
