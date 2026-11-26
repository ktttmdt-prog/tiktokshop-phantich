/* Bảo mật khi chia sẻ:
   - Báo cáo cho lãnh đạo: mã hóa AES-256-GCM, khóa sinh từ mật khẩu (PBKDF2-SHA256, 310.000 vòng).
   - Gói dữ liệu nhân sự gửi kế toán: mã hóa bằng khóa công khai của kế toán (ECDH P-256 + AES-256-GCM) – chỉ máy kế toán mở được. */
(function (root) {
  'use strict';
  var K = root.TTSK, SUB = crypto.subtle, Z = {};
  var ITER = 310000;
  function rnd(n) { var b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
  function pwKey(pw, salt, iter) {
    return SUB.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey'])
      .then(function (k) { return SUB.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); });
  }
  function packJson(obj) { return K.gzip(new TextEncoder().encode(JSON.stringify(obj))); }
  function unpackJson(u8) { return K.gunzip(u8).then(function (b) { return JSON.parse(new TextDecoder().decode(b)); }); }

  Z.encryptWithPassword = function (obj, pw) {
    var salt = rnd(16), iv = rnd(12);
    return Promise.all([packJson(obj), pwKey(pw, salt, ITER)]).then(function (r) { return SUB.encrypt({ name: 'AES-GCM', iv: iv }, r[1], r[0]); })
      .then(function (ct) { return { fmt: 'tts-baocao-1', kdf: 'PBKDF2-SHA256', iter: ITER, salt: K.b64(salt), iv: K.b64(iv), data: K.b64(new Uint8Array(ct)) }; });
  };
  Z.decryptWithPassword = function (pkg, pw) {
    return pwKey(pw, K.unb64(pkg.salt), pkg.iter || ITER).then(function (k) { return SUB.decrypt({ name: 'AES-GCM', iv: K.unb64(pkg.iv) }, k, K.unb64(pkg.data)); })
      .then(function (pt) { return unpackJson(new Uint8Array(pt)); }, function () { throw new Error('Sai mật khẩu hoặc file đã bị thay đổi.'); });
  };

  // ----- cặp khóa của kế toán -----
  Z.newKeyPair = function () {
    return SUB.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']).then(function (kp) {
      return Promise.all([SUB.exportKey('raw', kp.publicKey), SUB.exportKey('jwk', kp.privateKey)]).then(function (r) { return { pub: K.b64u(new Uint8Array(r[0])), priv: r[1] }; });
    });
  };
  function aesFromEcdh(priv, pub) { return SUB.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
  Z.sealFor = function (pubB64u, obj) {
    return Promise.all([SUB.importKey('raw', K.unb64u(pubB64u), { name: 'ECDH', namedCurve: 'P-256' }, false, []), SUB.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']), packJson(obj)])
      .then(function (r) {
        var iv = rnd(12);
        return Promise.all([aesFromEcdh(r[1].privateKey, r[0]), SUB.exportKey('raw', r[1].publicKey)]).then(function (x) {
          return SUB.encrypt({ name: 'AES-GCM', iv: iv }, x[0], r[2]).then(function (ct) { return { fmt: 'tts-goidulieu-1', epk: K.b64u(new Uint8Array(x[1])), to: pubB64u.slice(0, 12), iv: K.b64(iv), data: K.b64(new Uint8Array(ct)) }; });
        });
      });
  };
  Z.openSealed = function (privJwk, pkg) {
    return Promise.all([SUB.importKey('jwk', privJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']), SUB.importKey('raw', K.unb64u(pkg.epk), { name: 'ECDH', namedCurve: 'P-256' }, false, [])])
      .then(function (r) { return aesFromEcdh(r[0], r[1]); })
      .then(function (k) { return SUB.decrypt({ name: 'AES-GCM', iv: K.unb64(pkg.iv) }, k, K.unb64(pkg.data)); })
      .then(function (pt) { return unpackJson(new Uint8Array(pt)); }, function () { throw new Error('Gói dữ liệu không mở được trên máy này (không phải gói gửi cho kế toán này, hoặc file đã bị thay đổi).'); });
  };
  root.TTSZ = Z;
})(typeof window !== 'undefined' ? window : self);
