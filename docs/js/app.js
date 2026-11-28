/* Ứng dụng chính – 3 chế độ: Kế toán (nhập dữ liệu, lập báo cáo), Lãnh đạo (mở báo cáo được gửi), Nhân sự (gửi dữ liệu cho kế toán).
   Mọi dữ liệu xử lý trong trình duyệt của người dùng; không gửi lên máy chủ nào. */
(function () {
  'use strict';
  var K = window.TTSK, SC = window.TTSS, D = window.TTSD, I = window.TTSI, Q = window.TTSQ, R = window.TTSR, X = window.TTSX, Z = window.TTSZ, M = window.TTSM, V = window.TTSV, W = window.TTSViewer, esc = V.esc;
  var S = { mode: null, cube: null, f: { from: '', to: '', shop: '', ent: '' }, preset: 'latest', tab: 'overview', remaining: 0, rankIndex: 0, detail: { dataset: 'ads_campaign', page: 0, q: '' }, cards: [], staffKey: null };
  var $ = function (s, el) { return (el || document).querySelector(s); }, $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var actions = {};

  function download(data, name, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function toast(msg, kind) {
    var t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 400); }, kind === 'err' ? 7000 : 3800);
  }
  function modal(html, onOk, okText) {
    var bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '<p class="err md-err"></p><div class="form-row"><button data-md="ok">' + (okText || 'Đồng ý') + '</button> <button class="secondary" data-md="cancel">Hủy</button></div></div>';
    document.body.appendChild(bg);
    var close = function () { bg.remove(); };
    bg.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-md]'); if (!b) return;
      if (b.getAttribute('data-md') === 'cancel') { if (bg._cancel) bg._cancel(); close(); return; }
      var msg = onOk(bg); if (msg) { bg.querySelector('.md-err').textContent = msg; return; } close();
    });
    bg.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); bg.querySelector('[data-md="ok"]').click(); } else if (ev.key === 'Escape') { if (bg._cancel) bg._cancel(); close(); } });
    var first = bg.querySelector('input'); if (first) first.focus();
    return bg;
  }
  function askPassword(title, note) {
    return new Promise(function (resolve) {
      var bg = modal('<h3>' + esc(title) + '</h3><p class="small">' + note + '</p><label>Mật khẩu (tối thiểu 6 ký tự)<input type="password" class="md-pw" autocomplete="new-password"></label><label>Nhập lại mật khẩu<input type="password" class="md-pw2" autocomplete="new-password"></label><label class="chk"><input type="checkbox" class="md-show"> Hiện mật khẩu</label>', function (b) {
        var a = b.querySelector('.md-pw').value; if (a.length < 6) return 'Mật khẩu tối thiểu 6 ký tự.';
        if (a !== b.querySelector('.md-pw2').value) return 'Hai lần nhập mật khẩu không khớp.';
        resolve(a); return null;
      });
      bg._cancel = function () { resolve(null); };
      bg.querySelector('.md-show').addEventListener('change', function () { var t = this.checked ? 'text' : 'password'; bg.querySelector('.md-pw').type = t; bg.querySelector('.md-pw2').type = t; });
    });
  }
  function busy(on, text) {
    var el = $('#busy'); if (!el) { el = document.createElement('div'); el.id = 'busy'; el.className = 'modal-bg'; el.innerHTML = '<div class="modal"><p class="busy-t"></p></div>'; document.body.appendChild(el); }
    el.style.display = on ? 'flex' : 'none'; if (on) el.querySelector('.busy-t').textContent = text || 'Đang xử lý…';
  }

  // ================= CHỌN CHẾ ĐỘ =================
  function boot() {
    var h = location.hash || '';
    var m = /^#gui=([A-Za-z0-9_-]{40,})/.exec(h);
    if (m) { S.staffKey = m[1]; return startStaff(); }
    if (h === '#xem') return startViewer();
    if (h === '#ketoan') return startAccountant();
    var saved = localStorage.getItem('tts-mode');
    if (saved === 'ketoan') return startAccountant();
    if (saved === 'xem') return startViewer();
    showChooser();
  }
  function header(title, sub, actions) {
    $('#title').textContent = title; $('#sub').innerHTML = sub || ''; $('#actions').innerHTML = actions || '';
  }
  function showChooser() {
    header('Phân tích TikTok Shop', 'Chạy trong trình duyệt – dữ liệu nằm trên máy của bạn');
    $('#tabs').style.display = 'none'; $('#filters').style.display = 'none';
    $('#main').innerHTML = '<h2>Bạn dùng ứng dụng với vai trò nào?</h2><div class="mode-cards">' +
      '<button class="mode-card" data-mode="ketoan"><h3>Kế toán</h3><p>Nhập file TikTok, kiểm soát số liệu, lập báo cáo, xuất Excel có mật khẩu, gửi báo cáo cho lãnh đạo.</p></button>' +
      '<button class="mode-card" data-mode="xem"><h3>Lãnh đạo – xem báo cáo</h3><p>Mở file báo cáo kế toán gửi qua Zalo/email, nhập mật khẩu để xem. Dùng được trên điện thoại.</p></button>' +
      '<button class="mode-card" data-mode="nhansu"><h3>Nhân sự – gửi dữ liệu</h3><p>Dùng đường link riêng do kế toán cung cấp: kiểm tra file, đóng gói mã hóa gửi kế toán. Không xem được báo cáo.</p></button></div>' +
      '<p class="small muted">Lần đầu mở trang cần Internet; sau đó trang chạy được khi mất mạng. Dữ liệu không được gửi lên máy chủ nào.</p>';
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-mode]'); if (!b) return;
    var m = b.getAttribute('data-mode');
    if (m === 'nhansu') { modal('<h3>Gửi dữ liệu cho kế toán</h3><p>Hãy mở <strong>đường link riêng</strong> kế toán gửi cho bạn (dạng …#gui=…). Link đó chứa khóa để gói dữ liệu chỉ kế toán mở được.</p>', function () { return null; }, 'Đã hiểu'); return; }
    localStorage.setItem('tts-mode', m); location.hash = m === 'ketoan' ? '#ketoan' : '#xem'; boot();
  });
  function switchMode() { localStorage.removeItem('tts-mode'); location.hash = ''; S.mode = null; showChooser(); }

  // ================= LÃNH ĐẠO =================
  function startViewer() {
    S.mode = 'xem';
    header('Báo cáo TikTok Shop', 'Chế độ xem báo cáo', '<button class="link" data-act="switchMode">Đổi vai trò</button>');
    $('#tabs').style.display = 'none'; $('#filters').style.display = 'none';
    var main = $('#main');
    main.innerHTML = '<div class="card"><h2>Mở báo cáo</h2><p>Chọn file báo cáo kế toán gửi (đuôi <code>.html</code>), rồi nhập mật khẩu.</p><div class="drop"><input type="file" id="vFile" accept=".html,.htm,.ttsbc,.json"></div>' +
      '<div id="vLast"></div></div><div id="viewer"></div>';
    idbGet('viewer:last').then(function (last) {
      if (last) $('#vLast').innerHTML = '<p class="small">Hoặc mở lại báo cáo gần nhất trên máy này: <button class="link" data-act="viewerLast">' + esc(last.title || 'Báo cáo') + '</button></p>';
    });
    $('#vFile').addEventListener('change', function () {
      var f = this.files[0]; this.value = ''; if (!f) return;
      f.text().then(function (txt) {
        var pkg = extractPkg(txt); if (!pkg) throw new Error('File này không phải báo cáo được mã hóa từ ứng dụng.');
        idbSet('viewer:last', pkg); W.unlock($('#viewer'), pkg); $('#viewer').scrollIntoView();
      }).catch(function (e) { toast(e.message, 'err'); });
    });
  }
  function extractPkg(txt) {
    try { var o = JSON.parse(txt); if (o && o.fmt === 'tts-baocao-1') return o; } catch (e) { }
    var m = /<script[^>]*id="tts-pkg"[^>]*>([\s\S]*?)<\/script>/.exec(txt);
    if (m) { try { var p = JSON.parse(m[1]); if (p.fmt === 'tts-baocao-1') return p; } catch (e2) { } }
    return null;
  }
  function idb() { return new Promise(function (res, rej) { var r = indexedDB.open('tts-viewer', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function idbGet(k) { return idb().then(function (db) { return new Promise(function (res) { var g = db.transaction('kv').objectStore('kv').get(k); g.onsuccess = function () { res(g.result); db.close(); }; g.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function idbSet(k, v) { return idb().then(function (db) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function () { db.close(); }; }); }

  // ================= NHÂN SỰ =================
  function startStaff() {
    S.mode = 'nhansu';
    header('Gửi dữ liệu cho kế toán', 'Chế độ nhân sự – không xem được báo cáo');
    $('#tabs').style.display = 'none'; $('#filters').style.display = 'none';
    var who = localStorage.getItem('tts-sender') || '';
    $('#main').innerHTML = '<div class="card form"><h2>Gửi dữ liệu cho kế toán</h2><ol class="steps"><li>Nhập họ tên, chọn các file xuất từ TikTok (Excel/CSV).</li><li>Xem kết quả kiểm tra từng file (đúng loại, đúng kỳ, đủ cột).</li><li>Bấm <strong>Tạo gói gửi kế toán</strong> → gửi file <code>.ttsgoi</code> tải về cho kế toán qua Zalo/email.</li></ol>' +
      '<div class="form-row"><label>Họ tên người gửi<input id="stName" value="' + esc(who) + '" placeholder="vd: Nguyễn Văn A"></label><label>Shop (nếu biết)<input id="stShop" placeholder="vd: tên shop trên TikTok"></label><label class="grow">Ghi chú<input id="stNote" placeholder="vd: số liệu tháng 11"></label></div>' +
      '<div class="drop"><input type="file" id="stFiles" multiple accept=".xlsx,.xlsm,.csv,.txt"></div></div><div id="stList"></div>' +
      '<div class="form-row"><button id="stMake" disabled>Tạo gói gửi kế toán</button></div><p class="small muted">Gói được mã hóa bằng khóa của kế toán – chỉ máy kế toán mở được. File không được gửi lên Internet; bạn tự gửi gói qua kênh nội bộ.</p>';
    S.staffFiles = [];
    D.loadEmpty().then(function () {
      $('#stFiles').addEventListener('change', function () {
        var files = Array.prototype.slice.call(this.files || []); this.value = '';
        files.forEach(function (f) {
          var item = { name: f.name, state: 'đang kiểm tra' }; S.staffFiles.push(item); renderStaff();
          f.arrayBuffer().then(function (buf) {
            item.bytes = new Uint8Array(buf);
            return I.addUpload(f.name, buf).then(function (up) { var rq = { uploadId: up.id, shopId: '__staff' }; return I.ready(rq).then(function () { return I.preview(rq); }); });
          }).then(function (p) { item.p = p; item.state = 'ok'; renderStaff(); }).catch(function (e) { item.state = 'lỗi'; item.err = e.message; renderStaff(); });
        });
      });
      $('#stMake').addEventListener('click', makeStaffPackage);
    });
  }
  function renderStaff() {
    var h = S.staffFiles.map(function (it, i) {
      var p = it.p, x = '<div class="card imp"><div class="imp-head"><strong>' + esc(it.name) + '</strong> <button class="link" data-stdel="' + i + '">Bỏ file</button></div>';
      if (it.state === 'đang kiểm tra') return x + '<p class="muted">Đang kiểm tra…</p></div>';
      if (it.state === 'lỗi') return x + '<p class="err">' + esc(it.err) + '</p></div>';
      if (!p.recognized) return x + '<p class="warnline">! Chưa nhận dạng được loại file – kế toán sẽ ánh xạ cột thủ công khi nhập.</p></div>';
      x += '<div>Loại: <strong>' + esc(p.datasetLabel) + '</strong></div>';
      if (p.needPeriod) x += '<p class="warnline">! File không ghi kỳ – ghi rõ kỳ trong Ghi chú để kế toán nhập.</p>';
      else if (p.counts) x += '<div>Kỳ: <strong>' + M.fmtPeriod(p.periodFrom, p.periodTo) + '</strong> · ' + p.counts.rowsRead + ' dòng · ' + p.counts.error + ' dòng lỗi</div>';
      if (p.missingRequired && p.missingRequired.length) x += '<p class="err">Thiếu cột: ' + p.missingRequired.map(esc).join(', ') + '</p>';
      (p.notes || []).forEach(function (n) { x += '<p class="ok small">✓ ' + esc(n) + '</p>'; });
      (p.warnings || []).filter(function (w) { return w.indexOf('ngày hôm nay') < 0; }).forEach(function (w) { x += '<p class="warnline small">! ' + esc(w) + '</p>'; });
      return x + '</div>';
    }).join('');
    $('#stList').innerHTML = h;
    $('#stMake').disabled = !S.staffFiles.some(function (it) { return it.bytes; });
  }
  document.addEventListener('click', function (ev) { var b = ev.target.closest('[data-stdel]'); if (b) { S.staffFiles.splice(+b.getAttribute('data-stdel'), 1); renderStaff(); } });
  function makeStaffPackage() {
    var name = $('#stName').value.trim(); if (!name) { toast('Nhập họ tên người gửi.', 'err'); return; }
    localStorage.setItem('tts-sender', name);
    var files = S.staffFiles.filter(function (it) { return it.bytes; });
    busy(true, 'Đang mã hóa gói dữ liệu…');
    Promise.all(files.map(function (it) { return K.sha256(it.bytes).then(function (h) { return { name: it.name, hash: h, data: K.b64(it.bytes), type: it.p && it.p.datasetLabel || '', period: it.p && it.p.periodFrom ? it.p.periodFrom + '~' + it.p.periodTo : '' }; }); }))
      .then(function (list) { return Z.sealFor(S.staffKey, { sender: name, shop: $('#stShop').value.trim(), note: $('#stNote').value.trim(), createdAt: K.nowStr(), files: list }); })
      .then(function (pkg) {
        busy(false);
        var fn = 'GoiDuLieu_' + name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^\w]+/g, '-') + '_' + K.today() + '.ttsgoi';
        download(JSON.stringify(pkg), fn, 'application/json');
        toast('Đã tạo gói ' + fn + ' – gửi file này cho kế toán.');
      }).catch(function (e) { busy(false); toast(e.message, 'err'); });
  }

  // ================= KẾ TOÁN =================
  var TABS = [['overview', 'Tổng quan'], ['brief', 'Bản tin điều hành'], ['shop', 'Hiệu quả shop'], ['growth', 'Cây chỉ số'], ['roas', 'ROAS & chiến dịch'], ['adsctl', 'Kiểm soát ads'], ['acc', 'Kiểm soát kế toán'], ['detail', 'Bảng chi tiết'], ['content', 'Video & Liên kết'], ['import', 'Nhập dữ liệu'], ['history', 'Lịch sử nhập'], ['settings', 'Chia sẻ, sao lưu & cài đặt']];
  function startAccountant() {
    S.mode = 'ketoan';
    header('Phân tích TikTok Shop', 'Chế độ kế toán – dữ liệu lưu trong trình duyệt của máy này',
      installBtn() + '<button class="secondary" data-act="exportExcel">Xuất Excel</button> <button data-act="exportLeader">Gửi báo cáo lãnh đạo</button> <button class="link" data-act="switchMode">Đổi vai trò</button>');
    $('#main').innerHTML = '<p class="muted">Đang tải dữ liệu…</p>';
    D.load().then(function () { S.cube = M.prepare(Q.build()); if (!S.f.from) applyPreset(S.preset); render(); fdInit(); }).catch(function (e) { $('#main').innerHTML = '<div class="nodata">Không mở được kho dữ liệu của trình duyệt: ' + esc(e.message) + '</div>'; });
  }

  // ================= CÀI ĐẶT ỨNG DỤNG LÊN MÁY (chạy như phần mềm, dùng được khi mất mạng) =================
  function isInstalled() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function installBtn() { return S.installEvt && !isInstalled() ? '<button class="secondary" data-act="installApp" id="btnInstall">Cài lên máy tính</button> ' : ''; }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); S.installEvt = e;
    var a = $('#actions'); if (a && !$('#btnInstall') && S.mode === 'ketoan') a.insertAdjacentHTML('afterbegin', installBtn());
  });
  window.addEventListener('appinstalled', function () { S.installEvt = null; var b = $('#btnInstall'); if (b) b.remove(); toast('Đã cài ứng dụng. Mở bằng biểu tượng “TikTok Shop” trên màn hình hoặc menu Start.'); });
  actions.installApp = function () {
    if (!S.installEvt) { toast('Trình duyệt chưa cho cài: mở menu ⋮ của Chrome → Truyền, lưu và chia sẻ → Cài đặt trang dưới dạng ứng dụng.', 'err'); return; }
    S.installEvt.prompt(); S.installEvt.userChoice.then(function () { S.installEvt = null; var b = $('#btnInstall'); if (b) b.remove(); });
  };
  // Mở file bằng ứng dụng đã cài (chuột phải file Excel → Mở bằng → TikTok Shop)
  if ('launchQueue' in window) window.launchQueue.setConsumer(function (params) {
    if (!params.files || !params.files.length) return;
    var go = function () {
      S.tab = 'import'; render();
      params.files.forEach(function (h) { h.getFile().then(function (f) { if (/\.ttsgoi$/i.test(f.name)) openPackage(f); else addFile(f.name, f.arrayBuffer(), null); }); });
    };
    if (S.mode === 'ketoan' && S.cube) go();
    else { localStorage.setItem('tts-mode', 'ketoan'); S.pendingLaunch = go; if (S.mode && S.mode !== 'ketoan') location.hash = '#ketoan'; }
  });

  // ================= THƯ MỤC DỮ LIỆU: bỏ file xuất từ TikTok vào là ứng dụng tự nhập =================
  /* Chỉ tự ghi nhận file “sạch”: nhận dạng được loại file, có kỳ, không chồng lấn kỳ, không có dòng lỗi.
     File cần quyết định (thiếu kỳ, chồng lấn, lỗi, chưa rõ shop/phạm vi) hiện thành thẻ ở tab Nhập dữ liệu để kế toán xem rồi bấm Ghi nhận.
     Mỗi lần tự nhập vẫn ghi vào Lịch sử nhập (hủy được). Nội dung file chỉ đọc trên máy này. */
  var FD = { handle: null, perm: null, scanning: false, timer: null, session: {} };
  var FD_EXT = /\.(xlsx|xlsm|csv)$/i;
  function fdSupported() { return typeof window.showDirectoryPicker === 'function'; }
  function fdInit() {
    if (S.pendingLaunch) { var g = S.pendingLaunch; S.pendingLaunch = null; g(); }
    if (!fdSupported()) return;
    idbGet('folder:handle').then(function (h) {
      FD.handle = h || null; if (!h) return;
      return h.queryPermission({ mode: 'read' }).then(function (p) {
        FD.perm = p;
        if (p === 'granted') { fdScan(false); fdTimer(); } else if (S.tab === 'import' || S.tab === 'overview') render();
      });
    }).catch(function () { FD.perm = null; });
  }
  function fdTimer() {
    clearInterval(FD.timer);
    FD.timer = setInterval(function () { if (S.mode === 'ketoan' && FD.perm === 'granted' && document.visibilityState === 'visible') fdScan(false); }, 60000);
  }
  function fdWalk(dir, path, depth, out) {
    if (depth > 4) return Promise.resolve(out);
    var it = dir.values(), subs = [];
    var next = function () {
      return it.next().then(function (r) {
        if (r.done) return;
        var e = r.value, p = path ? path + '/' + e.name : e.name;
        if (e.kind === 'directory') { if (!/^[._~$]/.test(e.name)) subs.push([e, p]); }
        else if (FD_EXT.test(e.name) && !/^~\$/.test(e.name)) out.push({ handle: e, path: p, dir: path });
        return next();
      });
    };
    return next().then(function () { return subs.reduce(function (pr, s) { return pr.then(function () { return fdWalk(s[0], s[1], depth + 1, out); }); }, Promise.resolve()); }).then(function () { return out; });
  }
  function fdSegs(path) { return path ? path.split('/').map(function (s) { return K.norm(s); }) : []; }
  function fdShopFor(dir) {
    var shops = D.settings.shops || [];
    if (shops.length === 1) return shops[0].id;
    var segs = fdSegs(dir), hit = shops.filter(function (s) { return segs.indexOf(K.norm(s.name)) >= 0; })[0];
    if (hit) return hit.id;
    return D.settings.folderShop && shops.some(function (s) { return s.id === D.settings.folderShop; }) ? D.settings.folderShop : '';
  }
  function fdScopeFor(dir) { // null = chưa rõ phạm vi (khi đã có nhiều phạm vi video)
    var sc = D.settings.scopes || [];
    if (sc.length <= 1) return '';
    var segs = fdSegs(dir), hit = sc.filter(function (s) { return segs.indexOf(K.norm(s)) >= 0; })[0];
    return hit || null;
  }
  function fdOne(x, file) {
    var up;
    return file.arrayBuffer().then(function (buf) { return I.addUpload(file.name, buf); }).then(function (u) {
      up = u;
      var scope = fdScopeFor(x.dir), req = { uploadId: up.id, shopId: fdShopFor(x.dir), newShop: '', scope: scope || '', from: '', to: '', category: 'auto' };
      return I.ready(req).then(function () {
        var p = I.preview(req), c = function (k) { return p.counts ? p.counts[k] : 0; };
        if (!p.recognized) { I.dropUpload(up.id); return { bucket: 'unknown', msg: 'không nhận dạng được loại file' }; }
        var ds = SC.get(p.dataset);
        var hold = p.needShop ? 'chưa rõ shop – chọn shop' : p.needPeriod ? 'file không ghi kỳ – nhập từ ngày, đến ngày' : p.blocked ? p.message
          : c('conflict') ? 'kỳ chồng lấn với dữ liệu đã nhập' : c('error') ? c('error') + ' dòng lỗi' : ds && ds.hasScope && scope === null ? 'chọn phạm vi (kênh) của file' : '';
        if (!hold && c('new') + c('update') === 0) { I.discard(p.token); I.dropUpload(up.id); return { bucket: 'same', msg: p.datasetLabel + ': đã có đủ, không có dòng mới' }; }
        if (hold) {
          S.cards.unshift({ id: 'c' + Math.random().toString(36).slice(2), name: file.name, state: 'ready', uploadId: up.id, p: p, sender: 'thư mục: ' + x.path, note: 'Từ thư mục: ' + x.path,
            opts: { shopId: req.shopId, newShop: '', scope: req.scope, from: '', to: '', category: 'auto' } });
          return { bucket: 'review', msg: (p.datasetLabel || '') + ': ' + hold, session: true };
        }
        return I.commit({ token: p.token, replaceConflicts: false, note: 'Tự nhập từ thư mục: ' + x.path, sender: 'Thư mục dữ liệu', user: 'Kế toán' }).then(function (r) {
          I.dropUpload(up.id);
          return { bucket: 'auto', id: r.id, msg: p.datasetLabel + ' · ' + M.fmtPeriod(r.from, r.to) + ': ' + M.fmtNum(r['new']) + ' dòng mới' + (r.update ? ', ' + M.fmtNum(r.update) + ' cập nhật' : '') + (r.dup ? ', ' + M.fmtNum(r.dup) + ' trùng bỏ qua' : '') };
        });
      });
    }).catch(function (e) { if (up) I.dropUpload(up.id); return { bucket: 'failed', msg: e.message }; });
  }
  function fdScan(manual) {
    if (!FD.handle || FD.scanning || FD.perm !== 'granted') return Promise.resolve();
    FD.scanning = true;
    var res = { time: K.nowStr(), auto: [], review: [], same: [], unknown: [], failed: [], total: 0 };
    return Promise.all([fdWalk(FD.handle, '', 0, []), idbGet('folder:seen')]).then(function (r) {
      var files = r[0], seen = r[1] || {}; res.total = files.length;
      var todo = [];
      return files.reduce(function (pr, x) {
        return pr.then(function () { return x.handle.getFile(); }).then(function (file) {
          var key = x.path + '|' + file.size + '|' + file.lastModified;
          if (seen[key] || FD.session[key]) return;
          todo.push(x.path);
          busy(true, 'Đang đọc file từ thư mục dữ liệu: ' + x.path);
          return fdOne(x, file).then(function (st) {
            res[st.bucket].push({ path: x.path, msg: st.msg, id: st.id || null });
            if (st.session) FD.session[key] = 1; else seen[key] = { st: st.bucket, t: res.time, id: st.id || null };
          });
        }).catch(function (e) { res.failed.push({ path: x.path, msg: e.message }); });
      }, Promise.resolve()).then(function () { return idbSet('folder:seen', seen); });
    }).then(function () {
      FD.scanning = false; busy(false);
      var n = res.auto.length + res.review.length + res.same.length + res.unknown.length + res.failed.length;
      FD.lastCheck = { time: res.time, total: res.total };
      if (n) { try { localStorage.setItem('tts-folder-last', JSON.stringify(res)); } catch (e) { } }
      if (res.auto.length) { S.cube = M.prepare(Q.build()); }
      if (n || manual) render();
      if (res.auto.length || res.review.length) toast('Thư mục dữ liệu: tự nhập ' + res.auto.length + ' file' + (res.review.length ? ', ' + res.review.length + ' file cần xem ở tab Nhập dữ liệu' : '') + '.');
      else if (manual) toast('Không có file mới trong thư mục (' + res.total + ' file đã kiểm tra).');
    }).catch(function (e) { FD.scanning = false; busy(false); if (e && e.name === 'NotAllowedError') { FD.perm = 'prompt'; render(); } toast('Không đọc được thư mục: ' + e.message, 'err'); });
  }
  actions.fdPick = function () {
    window.showDirectoryPicker({ id: 'tts-data', mode: 'read' }).then(function (h) {
      FD.handle = h; FD.perm = 'granted'; FD.session = {};
      return idbSet('folder:handle', h).then(function () { toast('Đã chọn thư mục “' + h.name + '”. Đang kiểm tra file…'); fdTimer(); return fdScan(true); });
    }).catch(function (e) { if (e && e.name !== 'AbortError') toast(e.message, 'err'); });
  };
  actions.fdAllow = function () {
    if (!FD.handle) return;
    FD.handle.requestPermission({ mode: 'read' }).then(function (p) { FD.perm = p; if (p === 'granted') { fdTimer(); fdScan(true); } else render(); });
  };
  actions.fdScan = function () { if (FD.perm !== 'granted') return actions.fdAllow(); fdScan(true); };
  actions.fdRescan = function () {
    if (!confirm('Kiểm tra lại toàn bộ file trong thư mục? Dòng đã có sẽ được nhận là trùng và bỏ qua, không cộng 2 lần.')) return;
    FD.session = {}; idbSet('folder:seen', {}).then(function () { actions.fdScan(); });
  };
  actions.fdForget = function () {
    if (!confirm('Ngừng theo dõi thư mục này? Dữ liệu đã nhập vẫn giữ nguyên.')) return;
    clearInterval(FD.timer); FD.handle = null; FD.perm = null; FD.session = {};
    Promise.all([idbSet('folder:handle', null), idbSet('folder:seen', {})]).then(function () { localStorage.removeItem('tts-folder-last'); render(); });
  };
  function fdPanel() {
    var h = '<div class="card fd"><h3>Thư mục dữ liệu – bỏ file vào là tự nhập</h3>';
    if (!fdSupported()) return h + '<p class="small">Trình duyệt này chưa hỗ trợ đọc thư mục. Dùng Chrome hoặc Edge trên máy tính (hoặc ứng dụng đã cài) để bật tính năng này; vẫn có thể chọn file thủ công ở dưới.</p></div>';
    if (!FD.handle) return h + '<p class="small">Chọn một thư mục trên máy (vd. <code>37. TIKTOK\\DU LIEU TIKTOK</code>) và đặt Chrome lưu file xuất từ TikTok vào đó. Mỗi lần mở ứng dụng, và mỗi phút khi đang mở, ứng dụng tự đọc file mới: file đủ thông tin được ghi nhận ngay, file cần quyết định hiện thành thẻ bên dưới.</p>' +
      '<div class="form-row"><button data-act="fdPick">Chọn thư mục dữ liệu</button></div><p class="small muted">Ứng dụng chỉ xin quyền <strong>đọc</strong> thư mục; không sửa, không xóa file và không gửi file đi đâu.</p></div>';
    var last = null; try { last = JSON.parse(localStorage.getItem('tts-folder-last') || 'null'); } catch (e) { }
    h += '<p>Đang theo dõi thư mục <strong>' + esc(FD.handle.name) + '</strong>' + (FD.perm === 'granted' ? ' · <span class="ok">đang tự kiểm tra mỗi phút</span>' : ' · <span class="warn-t">cần cho phép đọc lại</span>') + (FD.lastCheck ? '<span class="muted small"> · kiểm tra lúc ' + esc(FD.lastCheck.time.slice(11)) + ', ' + FD.lastCheck.total + ' file</span>' : '') + '</p>';
    h += '<div class="form-row">' + (FD.perm === 'granted' ? '<button data-act="fdScan">Kiểm tra file mới ngay</button>' : '<button data-act="fdAllow">Cho phép đọc thư mục</button>') +
      ' <button class="secondary" data-act="fdPick">Đổi thư mục</button> <button class="link" data-act="fdRescan">Kiểm tra lại toàn bộ</button> <button class="link" data-act="fdForget">Ngừng theo dõi</button></div>';
    if ((D.settings.shops || []).length > 1) h += '<div class="form-row small"><label>Shop mặc định cho file trong thư mục<select id="fdShop"><option value="">— chưa chọn (file sẽ chờ chọn shop) —</option>' + D.settings.shops.map(function (s) { return '<option value="' + esc(s.id) + '"' + (D.settings.folderShop === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label><span class="hint">Hoặc đặt file vào thư mục con trùng tên shop.</span></div>';
    if ((D.settings.scopes || []).length > 1) h += '<p class="small muted">File Video thuộc phạm vi khác “Tất cả kênh”: đặt vào thư mục con trùng tên phạm vi (' + D.settings.scopes.map(esc).join(', ') + ').</p>';
    if (last) {
      var grp = [['auto', 'Đã tự nhập', 'ok'], ['review', 'Cần xem (thẻ bên dưới)', 'warn-t'], ['same', 'Đã có đủ, bỏ qua', 'muted'], ['unknown', 'Không phải file TikTok', 'muted'], ['failed', 'Không đọc được', 'err']];
      h += '<details' + (last.auto.length || last.review.length || last.failed.length ? ' open' : '') + '><summary>Lần có file mới gần nhất: ' + esc(last.time) + '</summary><ul class="errlist">' +
        grp.map(function (g) { return last[g[0]].map(function (x) { return '<li><span class="' + g[2] + '">' + g[1] + '</span> · ' + esc(x.path) + (x.msg ? ' – ' + esc(x.msg) : '') + (x.id ? ' (lần nhập #' + x.id + ')' : '') + '</li>'; }).join(''); }).join('') + '</ul></details>';
    }
    return h + '</div>';
  }
  document.addEventListener('change', function (ev) { if (ev.target.id === 'fdShop') { D.settings.folderShop = ev.target.value || null; D.saveMeta().then(function () { toast('Đã lưu shop mặc định cho thư mục.'); }); } });
  function rebuild() { S.cube = M.prepare(Q.build()); render(); }
  function monthEnd(s) { return M.iso(new Date(+s.substr(0, 4), +s.substr(5, 2), 0)); }
  function latestDate(c) {
    var mx = function (a) { var b = null; (a || []).forEach(function (r) { var d = r.to || r.date; if (d && (!b || d > b)) b = d; }); return b; };
    var a = mx(c._ads); if (a) return a; var best = null;
    ['_shop', '_ord', '_stl', '_vid', '_acct', '_aff', '_inv', '_topup'].forEach(function (k) { var d = mx(c[k]); if (d && (!best || d > best)) best = d; }); return best;
  }
  function applyPreset(p) {
    var today = K.today(), f = S.f; S.preset = p;
    if (p === 'latest') { var d = latestDate(S.cube) || today; f.from = d.substr(0, 8) + '01'; f.to = monthEnd(d); }
    else if (p === 'today') { f.from = f.to = today; } else if (p === 'yesterday') { f.from = f.to = M.addDays(today, -1); }
    else if (p === '7d') { f.from = M.addDays(today, -6); f.to = today; } else if (p === '30d') { f.from = M.addDays(today, -29); f.to = today; }
    else if (p === 'mtd') { f.from = today.substr(0, 8) + '01'; f.to = today; } else if (p === 'lm') { var lm = M.addDays(today.substr(0, 8) + '01', -1); f.from = lm.substr(0, 8) + '01'; f.to = lm; }
    else if (p === 'ytd') { f.from = today.substr(0, 4) + '-01-01'; f.to = today; }
    else if (p === 'all') { var a = null, b = null; ['_ads', '_shop', '_ord', '_stl', '_vid', '_acct', '_aff', '_inv', '_topup'].forEach(function (k) { (S.cube[k] || []).forEach(function (r) { var x = r.from || r.date, y = r.to || r.date; if (x && (!a || x < a)) a = x; if (y && (!b || y > b)) b = y; }); }); f.from = a || today; f.to = b || today; }
  }
  function ctx() { return V.compute(S.cube, S.f, { remaining: S.remaining, rankIndex: S.rankIndex }); }
  function render() {
    if (S.mode !== 'ketoan') return;
    var t = S.tab, main = $('#main');
    $('#tabs').style.display = '';
    $('#tabs').innerHTML = TABS.map(function (x) { return '<button role="tab" data-tab="' + x[0] + '" aria-selected="' + (t === x[0]) + '">' + x[1] + '</button>'; }).join('');
    var noF = t === 'import' || t === 'history' || t === 'settings';
    $('#filters').style.display = noF ? 'none' : ''; if (!noF) renderFilters();
    if (window.TTSC) window.TTSC.hideTip();
    var warn = backupBanner();
    if (FD.handle && FD.perm && FD.perm !== 'granted' && t !== 'import') warn += '<div class="banner">Thư mục dữ liệu <strong>' + esc(FD.handle.name) + '</strong> cần được cho phép đọc lại để tự nhập file mới. <button class="link" data-act="fdAllow">Cho phép đọc thư mục</button></div>';
    try {
      if (t === 'overview') V.overview(main, ctx()); else if (t === 'brief') V.brief(main, ctx()); else if (t === 'shop') V.shop(main, ctx()); else if (t === 'roas') V.roas(main, ctx());
      else if (t === 'adsctl') V.adsControl(main, ctx()); else if (t === 'growth') V.growth(main, ctx()); else if (t === 'acc') V.accounting(main, ctx()); else if (t === 'content') V.content(main, ctx()); else if (t === 'detail') renderDetail(main);
      else if (t === 'import') renderImport(main); else if (t === 'history') renderHistory(main); else if (t === 'settings') renderSettings(main);
      if (warn) main.insertAdjacentHTML('afterbegin', warn);
    } catch (e) { main.innerHTML = '<div class="nodata">Lỗi hiển thị: ' + esc(e.message) + '</div>'; console.error(e); }
  }
  function backupBanner() {
    if (!D.imports.length) return '';
    var last = D.settings.lastBackup, days = last ? (Date.now() - new Date(last.replace(' ', 'T')).getTime()) / 864e5 : 999;
    if (days < 7) return '';
    return '<div class="banner">Dữ liệu chỉ nằm trong trình duyệt của máy này. ' + (last ? 'Lần sao lưu gần nhất: ' + esc(last) + '. ' : 'Chưa sao lưu lần nào. ') + '<button class="link" data-act="backup">Tải bản sao lưu ngay</button></div>';
  }
  function renderFilters() {
    var c = S.cube, f = S.f, camps = {};
    var presets = [['latest', 'Tháng có dữ liệu gần nhất'], ['today', 'Hôm nay'], ['yesterday', 'Hôm qua'], ['7d', '7 ngày gần nhất'], ['30d', '30 ngày gần nhất'], ['mtd', 'Tháng này'], ['lm', 'Tháng trước'], ['ytd', 'Từ đầu năm'], ['all', 'Toàn bộ dữ liệu'], ['custom', 'Tùy chọn']];
    c._ads.forEach(function (r) { if (r.ent && (!f.shop || r.shop === f.shop) && !(r.to < f.from || r.from > f.to)) camps[r.ent] = r.name; });
    var ck = Object.keys(camps).sort(function (a, b) { return String(camps[a]).localeCompare(String(camps[b]), 'vi'); });
    if (f.ent && !camps[f.ent]) f.ent = '';
    $('#filters').innerHTML = '<label>Kỳ <select id="fPreset">' + presets.map(function (p) { return '<option value="' + p[0] + '"' + (S.preset === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></label>' +
      '<label>Từ <input type="date" id="fFrom" value="' + f.from + '"></label><label>Đến <input type="date" id="fTo" value="' + f.to + '"></label>' +
      '<label>Shop <select id="fShop"><option value="">Tất cả shop (gộp)</option>' + (c.shops || []).map(function (s) { return '<option value="' + esc(s.id) + '"' + (f.shop === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>Chiến dịch <select id="fEnt"' + (ck.length ? '' : ' disabled') + '><option value="">' + (ck.length ? 'Tất cả chiến dịch' : 'Không có dữ liệu chiến dịch') + '</option>' + ck.map(function (k) { return '<option value="' + esc(k) + '"' + (f.ent === k ? ' selected' : '') + '>' + esc(camps[k]) + '</option>'; }).join('') + '</select></label>';
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-tab]'); if (b) { S.tab = b.getAttribute('data-tab'); render(); window.scrollTo(0, 0); return; }
    var a = ev.target.closest('[data-act]'); if (!a || a.tagName === 'INPUT' || a.tagName === 'SELECT') return;
    var act = a.getAttribute('data-act'); if (actions[act]) { ev.preventDefault(); actions[act](a); }
  });
  document.addEventListener('change', function (ev) {
    if (S.mode !== 'ketoan') return;
    var id = ev.target.id, f = S.f;
    if (id === 'fPreset') { if (ev.target.value !== 'custom') applyPreset(ev.target.value); else S.preset = 'custom'; render(); }
    else if (id === 'fFrom' || id === 'fTo') { var v = ev.target.value; if (!v) return; if (id === 'fFrom') f.from = v; else f.to = v; if (f.from > f.to) { if (id === 'fFrom') f.to = f.from; else f.from = f.to; } S.preset = 'custom'; render(); }
    else if (id === 'fShop') { f.shop = ev.target.value; render(); } else if (id === 'fEnt') { f.ent = ev.target.value; render(); }
    else if (ev.target.getAttribute('data-act') === 'remaining') { S.remaining = Number(String(ev.target.value).replace(/[^\d]/g, '')) || 0; render(); }
    else if (ev.target.getAttribute('data-act') === 'rankIndex') { S.rankIndex = Number(ev.target.value) || 0; render(); }
    else if (id === 'detDs') { S.detail.dataset = ev.target.value; S.detail.page = 0; render(); }
  });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (S.mode === 'ketoan' && ['overview', 'brief', 'shop', 'roas', 'adsctl', 'content'].indexOf(S.tab) >= 0) render(); }, 250); });

  /* (đã khai báo actions ở đầu file) */
  actions.switchMode = switchMode;
  actions.viewerLast = function () { idbGet('viewer:last').then(function (p) { if (p) W.unlock($('#viewer'), p); }); };
  actions.exportExcel = function () {
    askPassword('Xuất Excel đầy đủ – đặt mật khẩu mở file', 'File Excel được <strong>mã hóa</strong> chuẩn Microsoft Office (AES-256); ai mở cũng phải nhập mật khẩu. Mật khẩu không được lưu lại – quên mật khẩu sẽ không mở được file.').then(function (pw) {
      if (!pw) return;
      busy(true, 'Đang lập file Excel và mã hóa…');
      var c = ctx(), name = 'BaoCao_TikTokShop_' + S.f.from + '_' + S.f.to + '.xlsx';
      return R.build({ from: S.f.from, to: S.f.to, shop: S.f.shop, ent: S.f.ent, remaining: S.remaining, rankIndex: S.rankIndex, comments: c.comments.map(function (x) { return x.t; }).concat(c.recs.map(function (x) { return 'Kiến nghị: ' + x; })) })
        .then(function (bytes) { return X.encrypt(bytes, pw); })
        .then(function (enc) { busy(false); download(enc, name, XLSX_MIME); toast('Đã xuất Excel có mật khẩu mở file.'); });
    }).catch(function (e) { busy(false); toast(e.message, 'err'); });
  };
  function shareCube() {
    // kèm kỳ liền trước (để so sánh) – chỉ số liệu tổng hợp; Phân tích shop kèm toàn bộ các tháng để vẽ xu hướng
    var c = S.cube, f = S.f, lo = M.prevPeriod(f.from, f.to).from;
    var keepIn = function (a0) { return function (r) { var a = r.from || r.date, b = r.to || r.date; return (!f.shop || r.shop === f.shop) && !(b < a0 || a > f.to); }; };
    var pick = function (sec, a0) { var cols = c[sec].cols; return { cols: cols, rows: c['_' + sec].filter(keepIn(a0)).map(function (o) { return cols.map(function (k) { return o[k]; }); }) }; };
    var out = { generatedAt: c.generatedAt, today: c.today, thresholds: c.thresholds, official: c.official, shops: (c.shops || []).filter(function (s) { return !f.shop || s.id === f.shop; }) };
    ['inv', 'stl'].forEach(function (k) { out[k] = pick(k, f.from); });
    ['ads', 'acct', 'ord', 'stlr', 'vid', 'aff', 'booking', 'vlist', 'llist'].forEach(function (k) { out[k] = pick(k, lo); });
    out.shop = pick('shop', '0000-01-01');
    out.market = c.market || []; out.health = c.health || []; out.gmvMaxAccount = c.gmvMaxAccount || '';
    out.mgmt = { cogsRate: c.mgmt ? c.mgmt.cogsRate : null, entries: ((c.mgmt && c.mgmt.entries) || []).filter(function (e) { return (!f.shop || !e.shop || e.shop === f.shop) && !(e.to < lo || e.from > f.to); }) };
    var keep = keepIn(f.from);
    var tp = {}, tc = c.topup.cols;
    c._topup.filter(keep).forEach(function (r) { var k = [r.shop, r.date, r.accountId, r.cls, r.pay, r.ok].join('|'); var a = tp[k] || (tp[k] = { shop: r.shop, date: r.date, time: r.date, accountId: r.accountId, accountName: r.accountName, type: 'Tổng trong ngày', subtype: '', status: r.ok ? 'Thành công' : 'Không thành công', moneyType: '', amount: 0, voucher: '', imp: 0, cls: r.cls, pay: r.pay, ok: r.ok }); a.amount += r.amount; });
    out.topup = { cols: tc, rows: Object.keys(tp).map(function (k) { return tc.map(function (x) { return tp[k][x]; }); }) };
    out.imports = (c.imports || []).filter(function (i) { return !i.rolledBack && i.from && !(i.to < f.from || i.from > f.to); }).map(function (i) { return { id: i.id, time: i.time, fileName: i.fileName, datasetLabel: i.datasetLabel, shopName: i.shopName, scope: i.scope, from: i.from, to: i.to, 'new': i['new'], dup: i.dup, update: i.update }; });
    return out;
  }
  actions.exportLeader = function () {
    askPassword('Gửi báo cáo cho lãnh đạo – đặt mật khẩu xem', 'Tạo 1 file <code>.html</code> đã <strong>mã hóa</strong> (AES-256). Gửi file qua Zalo/email; người nhận mở file (hoặc mở trang ứng dụng → “Lãnh đạo – xem báo cáo”) và nhập mật khẩu. Báo cáo chỉ chứa số liệu tổng hợp, không có tên/SĐT/địa chỉ khách hàng, không có mã đơn.').then(function (pw) {
      if (!pw) return;
      busy(true, 'Đang mã hóa báo cáo…');
      var title = 'Báo cáo TikTok Shop ' + M.fmtPeriod(S.f.from, S.f.to) + (S.f.shop ? ' – ' + M.shopName(S.cube, S.f.shop) : '');
      var data = { meta: { title: title, createdAt: K.nowStr() }, cube: shareCube(), f: { from: S.f.from, to: S.f.to, shop: S.f.shop, ent: S.f.ent }, remaining: S.remaining, rankIndex: S.rankIndex };
      var assets = ['app.css', 'js/core.js', 'js/metrics.js', 'js/charts.js', 'js/views.js', 'js/secure.js', 'js/viewer.js'];
      return Promise.all([Z.encryptWithPassword(data, pw)].concat(assets.map(function (a) { return fetch(a).then(function (r) { if (!r.ok) throw new Error('thiếu ' + a); return r.text(); }); })))
        .then(function (r) {
          var pkg = r[0]; pkg.title = title;
          var safe = function (s) { return s.replace(/<\/script/gi, '<\\/script'); };
          var html = '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + '</title><style>' + r[1] + '</style></head><body class="report">' +
            '<header class="top"><div class="brand"><span class="logo" aria-hidden="true">◆</span><div><div class="app-title">' + esc(title) + '</div><div class="lan">Báo cáo đã mã hóa – nhập mật khẩu để xem. Mở được khi không có mạng.</div></div></div></header><main><div id="viewer"></div></main>' +
            '<script type="application/json" id="tts-pkg">' + JSON.stringify(pkg).replace(/</g, '\\u003c') + '</script>' +
            r.slice(2).map(function (js) { return '<script>' + safe(js) + '</script>'; }).join('') + '</body></html>';
          busy(false); download(html, 'BaoCao_LanhDao_' + S.f.from + '_' + S.f.to + '.html', 'text/html;charset=utf-8');
          toast('Đã tạo báo cáo mã hóa – gửi file .html cho lãnh đạo, báo mật khẩu qua kênh riêng.');
        });
    }).catch(function (e) { busy(false); toast(e.message, 'err'); });
  };

  // ----- Bảng chi tiết -----
  function renderDetail(main) {
    var d = S.detail, r = Q.detail(d.dataset, S.f.from, S.f.to, S.f.shop, d.q), size = 100, pages = Math.max(1, Math.ceil(r.total / size));
    if (d.page >= pages) d.page = pages - 1;
    var h = '<div class="filterline">Kỳ lọc <strong>' + M.fmtPeriod(S.f.from, S.f.to) + '</strong></div><div class="toolbar"><label>Loại dữ liệu <select id="detDs">' + SC.all.map(function (s) { return '<option value="' + s.key + '"' + (s.key === d.dataset ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</select></label>' +
      '<label>Tìm <input type="search" id="detQ" value="' + esc(d.q) + '" placeholder="mã đơn, chiến dịch, số hóa đơn…"></label><button data-act="detSearch">Lọc</button><button class="secondary" data-act="detXlsx">Xuất Excel chi tiết</button></div>' +
      '<p class="note">' + M.fmtNum(r.total) + ' bản ghi. Mỗi dòng ghi lần nhập, file nguồn và số dòng trong file để truy ngược.</p>';
    var num = function (t) { return t === 'Money' || t === 'Int' || t === 'Num' || t === 'Ratio'; };
    h += '<div class="tbl-wrap"><table class="tbl dense"><thead><tr>' + r.cols.map(function (c, i) { return '<th' + (num(r.types[i]) ? ' class="num"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    r.rows.slice(d.page * size, d.page * size + size).forEach(function (row) {
      h += '<tr>' + row.map(function (v, i) { var t = r.types[i], s = v == null ? '' : t === 'Money' ? M.fmtNum(v, Math.abs(v) % 1 ? 2 : 0) : t === 'Int' ? M.fmtNum(v) : t === 'Ratio' ? M.fmtPct(v) : t === 'Num' ? M.fmtNum(v, 2) : t === 'Date' ? M.fmtDate(v) : esc(v); return '<td' + (num(t) ? ' class="num"' : '') + '>' + s + '</td>'; }).join('') + '</tr>';
    });
    if (!r.rows.length) h += '<tr><td colspan="' + r.cols.length + '" class="empty">Không có dữ liệu trong kỳ lọc</td></tr>';
    h += '</tbody></table></div><div class="pager"><button data-act="detPrev"' + (d.page <= 0 ? ' disabled' : '') + '>‹ Trước</button> Trang ' + (d.page + 1) + '/' + pages + ' <button data-act="detNext"' + (d.page + 1 >= pages ? ' disabled' : '') + '>Sau ›</button></div>';
    main.innerHTML = h;
  }
  actions.detSearch = function () { S.detail.q = $('#detQ').value; S.detail.page = 0; render(); };
  actions.detPrev = function () { S.detail.page = Math.max(0, S.detail.page - 1); render(); };
  actions.detNext = function () { S.detail.page++; render(); };
  actions.detXlsx = function () {
    var d = S.detail, q = $('#detQ').value || '';
    askPassword('Xuất Excel chi tiết – đặt mật khẩu mở file', 'File được mã hóa chuẩn Microsoft Office. Mật khẩu không được lưu lại.').then(function (pw) {
      if (!pw) return; busy(true, 'Đang lập file…');
      return R.detail(d.dataset, S.f.from, S.f.to, S.f.shop, q).then(function (b) { return X.encrypt(b, pw); }).then(function (enc) { busy(false); download(enc, 'ChiTiet_' + d.dataset + '_' + K.today() + '.xlsx', XLSX_MIME); });
    }).catch(function (e) { busy(false); toast(e.message, 'err'); });
  };

  // ----- Nhập dữ liệu -----
  function shopOptions(sel) { return '<option value="">— Chọn shop —</option>' + D.settings.shops.map(function (s) { return '<option value="' + esc(s.id) + '"' + (sel === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '<option value="__new">+ Thêm shop mới…</option>'; }
  function renderImport(main) {
    main.innerHTML = fdPanel() + '<h2>Nhập file Excel / CSV xuất từ TikTok</h2><ol class="steps"><li>Chọn <strong>shop</strong> của file (file TikTok thường không ghi tên shop).</li><li>Chọn file (nhiều file được), hoặc gói <code>.ttsgoi</code> nhân sự gửi.</li><li>Xem trước số dòng <strong>mới / trùng / cập nhật / chồng lấn / lỗi</strong> rồi bấm <strong>Ghi nhận</strong>. Dòng trùng không bao giờ bị cộng 2 lần.</li></ol>' +
      '<div class="card form"><div class="form-row"><label>Shop <select id="impShop">' + shopOptions(S.impShop || '') + '</select></label><label id="impNewWrap" style="display:none">Tên shop mới<input id="impNew"></label>' +
      '<label>Phạm vi (file Video)<input id="impScope" list="scopeList" placeholder="Tất cả kênh" value="' + esc(S.impScope || '') + '"><datalist id="scopeList">' + D.settings.scopes.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist></label></div>' +
      '<div class="form-row"><label>Kỳ dữ liệu – từ<input type="date" id="impFrom" value="' + (S.impFrom || '') + '"></label><label>đến<input type="date" id="impTo" value="' + (S.impTo || '') + '"></label><span class="hint">Chỉ cần khi file không ghi kỳ (file Cost, chi tiết hóa đơn).</span></div>' +
      '<div class="form-row"><label>Nhóm hóa đơn<select id="impCat"><option value="auto">Tự nhận theo diễn giải</option><option value="ads">Quảng cáo (TikTok Ads)</option><option value="platform">Phí dịch vụ / phí sàn</option><option value="creator">Hoa hồng nhà sáng tạo</option><option value="other">Khác</option></select></label></div>' +
      '<div class="drop"><input type="file" id="impFiles" multiple accept=".xlsx,.xlsm,.csv,.txt,.ttsgoi"></div></div><div id="cards"></div>';
    $('#impCat').value = S.impCat || 'auto';
    $('#impShop').addEventListener('change', function () { S.impShop = this.value; $('#impNewWrap').style.display = this.value === '__new' ? '' : 'none'; });
    if (S.impShop === '__new') $('#impNewWrap').style.display = '';
    ['impScope', 'impFrom', 'impTo', 'impCat'].forEach(function (id) { $('#' + id).addEventListener('change', function () { S[id] = this.value; }); });
    $('#impFiles').addEventListener('change', function () { var fs = Array.prototype.slice.call(this.files || []); this.value = ''; fs.forEach(function (f) { if (/\.ttsgoi$/i.test(f.name)) openPackage(f); else addFile(f.name, f.arrayBuffer(), null); }); });
    renderCards();
  }
  function commonOpts() { return { shopId: $('#impShop').value, newShop: ($('#impNew').value || '').trim(), scope: $('#impScope').value.trim(), from: $('#impFrom').value, to: $('#impTo').value, category: $('#impCat').value }; }
  function addFile(name, bufP, sender) {
    var card = { id: 'c' + Math.random().toString(36).slice(2), name: name, state: 'uploading', opts: commonOpts(), sender: sender };
    S.cards.unshift(card); renderCards();
    Promise.resolve(bufP).then(function (buf) { return I.addUpload(name, buf); }).then(function (up) { card.uploadId = up.id; preview(card); }).catch(function (e) { card.state = 'error'; card.error = e.message; renderCards(); });
  }
  function openPackage(f) {
    var priv = D.settings.staffKey && D.settings.staffKey.priv;
    if (!priv) { toast('Máy này chưa tạo link nhận dữ liệu cho nhân sự (mục Chia sẻ) nên không mở được gói.', 'err'); return; }
    f.text().then(function (t) { return Z.openSealed(priv, JSON.parse(t)); }).then(function (pkg) {
      toast('Gói từ ' + pkg.sender + ' (' + pkg.createdAt + '): ' + pkg.files.length + ' file.' + (pkg.note ? ' Ghi chú: ' + pkg.note : ''));
      pkg.files.forEach(function (x) { addFile(x.name, K.unb64(x.data).buffer, pkg.sender + (pkg.note ? ' – ' + pkg.note : '')); });
    }).catch(function (e) { toast(e.message, 'err'); });
  }
  function preview(card) {
    card.state = 'previewing'; renderCards();
    var o = card.opts, req = { uploadId: card.uploadId, shopId: o.shopId, newShop: o.newShop, scope: o.scope, from: o.from, to: o.to, category: o.category };
    if (card.sheet != null) req.sheet = card.sheet;
    if (card.manual) { req.dataset = card.manual.dataset; req.headerRow = card.manual.headerRow; req.mapping = card.manual.mapping; req.saveTemplate = card.manual.save; }
    I.ready(req).then(function () { card.p = I.preview(req); card.state = 'ready'; }).catch(function (e) { card.state = 'error'; card.error = e.message; }).then(renderCards);
  }
  function cnt(p, k) { return p.counts ? p.counts[k] : 0; }
  function renderCards() { var h = $('#cards'); if (h) h.innerHTML = S.cards.map(cardHtml).join(''); }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function fmtv(v) { return v == null ? '(trống)' : typeof v === 'number' ? M.fmtNum(v, Math.abs(v) % 1 ? 2 : 0) : String(v); }
  function cntBox(l, n, cls) { return '<div class="cnt ' + cls + '"><div class="cnt-n">' + M.fmtNum(n || 0) + '</div><div class="cnt-l">' + l + '</div></div>'; }
  function cardHtml(c) {
    var h = '<div class="card imp"><div class="imp-head"><strong>' + esc(c.name) + '</strong>' + (c.sender ? ' <span class="muted small">từ ' + esc(c.sender) + '</span>' : '') + ' <button class="link" data-act="cardClose" data-card="' + c.id + '">Đóng</button></div>';
    if (c.state === 'uploading' || c.state === 'previewing') return h + '<p class="muted">Đang đọc file…</p></div>';
    if (c.state === 'error') return h + '<p class="err">' + esc(c.error) + '</p></div>';
    if (c.state === 'done') return h + '<p class="ok">✓ Đã ghi nhận lần nhập #' + c.done.id + ': ' + c.done['new'] + ' dòng mới, ' + c.done.dup + ' trùng (bỏ qua), ' + c.done.update + ' cập nhật, ' + c.done.replaced + ' dòng cũ bị thay thế, ' + c.done.error + ' dòng lỗi.</p></div>';
    var p = c.p, o = c.opts;
    h += '<div class="form-row small"><label>Shop<select data-card="' + c.id + '" data-opt="shopId">' + shopOptions(o.shopId) + '</select></label>' + (o.shopId === '__new' ? '<label>Tên shop mới<input data-card="' + c.id + '" data-opt="newShop" value="' + esc(o.newShop) + '"></label>' : '') +
      '<label>Kỳ từ<input type="date" data-card="' + c.id + '" data-opt="from" value="' + esc(o.from) + '"></label><label>đến<input type="date" data-card="' + c.id + '" data-opt="to" value="' + esc(o.to) + '"></label>' +
      (p.dataset === 'video_daily' ? '<label>Phạm vi<input list="scopeList" data-card="' + c.id + '" data-opt="scope" value="' + esc(o.scope || p.scope || '') + '"></label>' : '') +
      (p.dataset === 'invoice' ? '<label>Nhóm hóa đơn<select data-card="' + c.id + '" data-opt="category">' + [['auto', 'Tự nhận'], ['ads', 'Quảng cáo'], ['platform', 'Phí sàn'], ['creator', 'Hoa hồng NST'], ['other', 'Khác']].map(function (x) { return '<option value="' + x[0] + '"' + (o.category === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' : '') +
      (p.sheets && p.sheets.length > 1 ? '<label>Sheet<select data-card="' + c.id + '" data-opt="sheet">' + p.sheets.map(function (s) { return '<option value="' + s.index + '"' + (s.index === p.sheet ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label>' : '') +
      '<button class="secondary" data-act="cardPreview" data-card="' + c.id + '">Xem trước lại</button> <button class="secondary" data-act="cardManual" data-card="' + c.id + '">Ánh xạ cột thủ công</button></div>';
    if (!p.recognized) return h + '<p class="warnline">! ' + esc(p.message) + '</p>' + manualEditor(c) + '</div>';
    h += '<div class="imp-type">Loại file: <strong>' + esc(p.datasetLabel) + '</strong> · Cấp dữ liệu: ' + esc(p.level || '') + ' · Dòng tiêu đề: ' + (p.headerRow + 1) + '</div><div class="muted small">' + esc(p.datasetDesc) + '</div>';
    if (p.needShop || p.needPeriod || p.blocked) h += '<p class="warnline">! ' + esc(p.message) + '</p>';
    if (c.manual) h += manualEditor(c);
    h += '<details' + (p.blocked ? ' open' : '') + '><summary>Ánh xạ cột nguồn → chỉ tiêu (' + p.columns.filter(function (x) { return x.status === 'mapped'; }).length + ' cột dùng, ' + p.columns.filter(function (x) { return x.status === 'pii'; }).length + ' cột thông tin cá nhân bị loại)</summary><div class="tbl-wrap"><table class="tbl dense"><thead><tr><th>Cột</th><th>Tên cột trong file</th><th>Chỉ tiêu</th><th>Xử lý</th></tr></thead><tbody>' +
      p.columns.map(function (x) { return '<tr><td>' + colName(x.col) + '</td><td>' + esc(x.header) + '</td><td>' + esc(x.fieldLabel || '') + '</td><td>' + ({ mapped: '<span class="ok">Dùng</span>', pii: '<span class="pii">Thông tin cá nhân – KHÔNG lưu</span>', unused: '<span class="muted">Không dùng</span>', dup: '<span class="muted">Trùng – bỏ qua</span>' }[x.status]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (p.missingOptional && p.missingOptional.length ? '<p class="warnline">Thiếu cột: ' + p.missingOptional.map(esc).join('; ') + '</p>' : '') + '</details>';
    if (p.needShop || p.needPeriod || p.blocked) return h + '</div>';
    h += '<div class="imp-period">Kỳ dữ liệu: <strong>' + M.fmtPeriod(p.periodFrom, p.periodTo) + '</strong> (lấy từ ' + esc(p.periodSource || '') + ')</div><div class="counts">' +
      cntBox('Dòng mới', cnt(p, 'new'), 'good') + cntBox('Trùng (bỏ qua)', cnt(p, 'dup'), 'na') + cntBox('Cập nhật', cnt(p, 'update'), 'warn') + cntBox('Chồng lấn kỳ', cnt(p, 'conflict'), cnt(p, 'conflict') ? 'bad' : 'na') +
      cntBox('Dòng lỗi', cnt(p, 'error'), cnt(p, 'error') ? 'bad' : 'na') + cntBox('Bỏ qua (tổng/mô tả/trống)', cnt(p, 'skipTotal') + cnt(p, 'skipDesc') + cnt(p, 'skipBlank'), 'na') + '</div>';
    (p.notes || []).forEach(function (n) { h += '<p class="ok small">✓ ' + esc(n) + '</p>'; });
    (p.warnings || []).forEach(function (n) { h += '<p class="warnline small">! ' + esc(n) + '</p>'; });
    if (p.errors && p.errors.length) h += '<details><summary class="err">Xem ' + cnt(p, 'error') + ' dòng lỗi</summary><ul class="errlist">' + p.errors.map(function (e) { return '<li>Dòng ' + e.row + ': ' + esc(e.msg) + '</li>'; }).join('') + '</ul></details>';
    if (p.updates && p.updates.length) h += '<details><summary>Dòng cập nhật (cũ → mới)</summary><ul class="errlist">' + p.updates.map(function (u) { return '<li>Dòng ' + u.row + ' · ' + esc(u.key) + ' (lần nhập #' + u.importId + '): ' + u.diffs.map(function (d) { return esc(d.field) + ' ' + esc(fmtv(d.old)) + ' → ' + esc(fmtv(d['new'])); }).join('; ') + '</li>'; }).join('') + '</ul></details>';
    if (p.conflicts && p.conflicts.length) h += '<div class="conflict"><strong>Kỳ chồng lấn với dữ liệu đã nhập:</strong><ul>' + p.conflicts.map(function (x) { return '<li>Lần nhập #' + x.importId + ' (' + esc(x.file) + '): ' + x.records + ' bản ghi, kỳ ' + M.fmtPeriod(x.from, x.to) + '</li>'; }).join('') + '</ul><label><input type="checkbox" data-card="' + c.id + '" data-opt="replace"' + (c.replace ? ' checked' : '') + '> Thay thế dữ liệu cũ bị chồng lấn (giữ trong lịch sử, có thể hủy)</label></div>';
    if (p.checks && p.checks.length) h += '<details><summary>Đối chiếu với dòng “Tổng” trong file</summary><ul class="errlist">' + p.checks.map(function (x) { return '<li>' + esc(x.field) + ': tổng các dòng ' + M.fmtNum(x.sumRows) + ' / dòng Tổng ' + M.fmtNum(x.fileTotal) + ' → ' + (x.ok ? '<span class="ok">khớp</span>' : '<span class="err">LỆCH</span>') + '</li>'; }).join('') + '</ul></details>';
    var nothing = cnt(p, 'new') + cnt(p, 'update') + (c.replace ? cnt(p, 'conflict') : 0) === 0;
    return h + '<div class="form-row"><label class="grow">Ghi chú<input data-card="' + c.id + '" data-opt="note" value="' + esc(c.note || '') + '"></label><button data-act="cardCommit" data-card="' + c.id + '"' + (nothing ? ' class="secondary"' : '') + '>' + (nothing ? 'Ghi nhận (không có thay đổi)' : 'Ghi nhận') + '</button></div></div>';
  }
  function manualEditor(c) {
    var p = c.p, m = c.manual;
    if (!m) { m = c.manual = { dataset: p.dataset || '', headerRow: p.headerRow >= 0 ? p.headerRow : 0, mapping: {}, save: true }; (p.columns || []).forEach(function (x) { if (x.field && x.status !== 'dup') m.mapping[x.col] = x.field; }); }
    var ds = SC.get(m.dataset), top = p.rawTop || [], hdr = top[m.headerRow] || [];
    var h = '<div class="manual"><h4>Ánh xạ cột thủ công</h4><div class="form-row small"><label>Loại dữ liệu<select data-card="' + c.id + '" data-man="dataset"><option value="">— chọn —</option>' + SC.all.map(function (d) { return '<option value="' + d.key + '"' + (d.key === m.dataset ? ' selected' : '') + '>' + esc(d.label) + '</option>'; }).join('') + '</select></label>' +
      '<label>Dòng tiêu đề số<input type="number" min="1" max="12" data-card="' + c.id + '" data-man="headerRow" value="' + (m.headerRow + 1) + '"></label></div><div class="tbl-wrap"><table class="tbl dense raw"><tbody>' +
      top.map(function (r, i) { return '<tr' + (i === m.headerRow ? ' class="hdr"' : '') + '><td>' + (i + 1) + '</td>' + r.slice(0, 20).map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    if (ds) h += '<div class="tbl-wrap"><table class="tbl dense"><thead><tr><th>Cột</th><th>Tên cột</th><th>Gán cho chỉ tiêu</th></tr></thead><tbody>' + hdr.map(function (x, i) {
      return '<tr><td>' + colName(i) + '</td><td>' + esc(x) + '</td><td><select data-card="' + c.id + '" data-mapcol="' + i + '"><option value="">(không dùng)</option>' + ds.fields.filter(function (f) { return f.key.indexOf('_pii') !== 0; }).map(function (f) { return '<option value="' + f.key + '"' + (m.mapping[i] === f.key ? ' selected' : '') + '>' + esc(f.label) + (f.required ? ' *' : '') + '</option>'; }).join('') + '</select></td></tr>';
    }).join('') + '</tbody></table></div><div class="form-row small"><label class="chk"><input type="checkbox" data-card="' + c.id + '" data-man="save"' + (m.save ? ' checked' : '') + '> Lưu mẫu ánh xạ cho lần sau</label><button data-act="cardManualApply" data-card="' + c.id + '">Xem trước với ánh xạ này</button> <button class="link" data-act="cardManualCancel" data-card="' + c.id + '">Bỏ ánh xạ thủ công</button></div>';
    return h + '</div>';
  }
  function cardOf(el) { var id = el.getAttribute('data-card'); return S.cards.filter(function (x) { return x.id === id; })[0]; }
  document.addEventListener('change', function (ev) {
    var el = ev.target, c = el.getAttribute && el.getAttribute('data-card') ? cardOf(el) : null; if (!c) return;
    var opt = el.getAttribute('data-opt'), man = el.getAttribute('data-man'), mc = el.getAttribute('data-mapcol');
    if (opt === 'replace') { c.replace = el.checked; renderCards(); } else if (opt === 'note') c.note = el.value;
    else if (opt === 'sheet') { c.sheet = +el.value; c.manual = null; preview(c); } else if (opt) { c.opts[opt] = el.value; if (opt === 'shopId') renderCards(); }
    else if (man === 'dataset') { c.manual.dataset = el.value; c.manual.mapping = {}; renderCards(); } else if (man === 'headerRow') { c.manual.headerRow = Math.max(0, (+el.value || 1) - 1); renderCards(); }
    else if (man === 'save') c.manual.save = el.checked; else if (mc != null) { if (el.value) c.manual.mapping[mc] = el.value; else delete c.manual.mapping[mc]; }
  });
  actions.cardClose = function (b) { var c = cardOf(b); S.cards = S.cards.filter(function (x) { return x !== c; }); renderCards(); };
  actions.cardPreview = function (b) { preview(cardOf(b)); };
  actions.cardManual = function (b) { var c = cardOf(b); if (!c.manual) manualEditor(c); renderCards(); };
  actions.cardManualCancel = function (b) { var c = cardOf(b); c.manual = null; preview(c); };
  actions.cardManualApply = function (b) { var c = cardOf(b); if (!c.manual.dataset) { toast('Chọn loại dữ liệu trước.', 'err'); return; } preview(c); };
  actions.cardCommit = function (b) {
    var c = cardOf(b); b.disabled = true;
    I.commit({ token: c.p.token, replaceConflicts: !!c.replace, note: c.note || '', sender: c.sender || null, user: 'Kế toán' }).then(function (r) { c.state = 'done'; c.done = r; S.cube = M.prepare(Q.build()); renderCards(); toast('Đã ghi nhận lần nhập #' + r.id + '.'); })
      .catch(function (e) { b.disabled = false; toast(e.message, 'err'); });
  };

  // ----- Lịch sử nhập -----
  function renderHistory(main) {
    var list = D.imports.slice().reverse();
    var h = '<h2>Lịch sử nhập dữ liệu</h2><p class="note">Mỗi lần nhập lưu tên file, mã băm nội dung (SHA-256), kỳ, ánh xạ cột, người gửi và kết quả. Hủy một lần nhập sẽ xóa dòng mới và khôi phục dòng đã bị cập nhật/thay thế.</p><div class="tbl-wrap"><table class="tbl wide"><thead><tr><th>#</th><th class="nw">Thời điểm</th><th>Người gửi</th><th>Loại dữ liệu</th><th>Shop</th><th>Kỳ</th><th>File</th><th class="num">Mới</th><th class="num">Trùng</th><th class="num">Cập nhật</th><th class="num">Chồng lấn</th><th class="num">Lỗi</th><th></th></tr></thead><tbody>';
    if (!list.length) h += '<tr><td colspan="13" class="empty">Chưa có lần nhập nào</td></tr>';
    list.forEach(function (i) {
      h += '<tr class="' + (i.rolledBack ? 'row-muted' : '') + '"><td>' + i.id + '</td><td>' + esc(i.time) + '</td><td>' + esc(i.sender || i.user || '') + '</td><td>' + esc(i.datasetLabel) + '</td><td>' + esc(i.shopName) + (i.scope ? ' · ' + esc(i.scope) : '') + '</td><td>' + M.fmtPeriod(i.from, i.to) + '</td><td>' + esc(i.fileName) + (i.note ? '<div class="muted small">' + esc(i.note) + '</div>' : '') + '</td>' +
        '<td class="num">' + M.fmtNum(i['new']) + '</td><td class="num">' + M.fmtNum(i.dup) + '</td><td class="num">' + M.fmtNum(i.update) + '</td><td class="num">' + M.fmtNum(i.conflict) + '</td><td class="num">' + M.fmtNum(i.error) + '</td>' +
        '<td>' + (i.rolledBack ? '<span class="muted small">Đã hủy</span>' : '<button class="link" data-act="rollback" data-id="' + i.id + '">Hủy lần nhập</button>') + '</td></tr>';
    });
    main.innerHTML = h + '</tbody></table></div>';
  }
  actions.rollback = function (b) {
    var id = +b.getAttribute('data-id');
    if (!confirm('Hủy lần nhập #' + id + '?\n• Dòng mới của lần nhập này bị xóa khỏi báo cáo.\n• Dòng bị lần nhập này cập nhật/thay thế trở lại giá trị trước.')) return;
    D.rollback(id).then(function () { toast('Đã hủy lần nhập #' + id); rebuild(); }).catch(function (e) { toast(e.message, 'err'); });
  };

  // ----- Chia sẻ, sao lưu, cài đặt -----
  function staffLink() { var k = D.settings.staffKey; return k ? location.origin + location.pathname + '#gui=' + k.pub : null; }
  function renderSettings(main) {
    var th = D.settings.thresholds, off = D.settings.official, link = staffLink(), st = D.stats();
    var h = '<h2>Chia sẻ</h2><div class="card"><h3>Link gửi dữ liệu cho nhân sự</h3>' +
      (link ? '<p class="small">Gửi link này cho nhân sự (Zalo/email). Họ mở link → chọn file → tạo gói <code>.ttsgoi</code> gửi lại; chỉ máy này mở được gói. Nhân sự không xem được báo cáo.</p><div class="keybox" id="staffLink">' + esc(link) + '</div><div class="form-row"><button data-act="copyLink">Sao chép link</button></div><p class="small muted">Khóa mở gói lưu trong bản sao lưu – đổi máy thì khôi phục bản sao lưu để vẫn mở được gói.</p>'
        : '<p class="small">Tạo link riêng để nhân sự gửi file đã kiểm tra, mã hóa chỉ máy kế toán mở được.</p><button data-act="makeKey">Tạo link cho nhân sự</button>') + '</div>' +
      '<div class="card"><h3>Báo cáo cho lãnh đạo</h3><p class="small">Bấm <strong>Gửi báo cáo lãnh đạo</strong> ở đầu trang → đặt mật khẩu → gửi file <code>.html</code> qua Zalo/email, báo mật khẩu qua kênh riêng (gọi điện/tin nhắn khác). Lãnh đạo mở file hoặc mở trang ứng dụng → “Lãnh đạo – xem báo cáo”.</p></div>';
    h += '<h2>Sao lưu & khôi phục</h2><div class="card"><p>Dữ liệu nằm trong trình duyệt của máy này: <strong>' + M.fmtNum(st.records) + '</strong> bản ghi, <strong>' + st.imports + '</strong> lần nhập. Lần sao lưu gần nhất: <strong>' + esc(D.settings.lastBackup || 'chưa có') + '</strong>.</p>' +
      '<p class="small muted">Xóa lịch sử/dữ liệu duyệt web có thể xóa dữ liệu ứng dụng – nên sao lưu sau mỗi lần nhập và giữ file ở ổ khác/USB/Drive công ty.</p>' +
      '<div class="form-row"><button data-act="backup">Tải bản sao lưu (.ttsbak)</button><label class="filepick">Khôi phục từ file sao lưu<input type="file" id="restoreFile" accept=".ttsbak"></label><button class="link" data-act="wipe">Xóa toàn bộ dữ liệu trên máy này</button></div></div>';
    h += '<h2>Mục tiêu ROAS</h2><div class="card form"><div class="form-row"><label>Các mốc ROAS (cách nhau bởi ;)<input id="setTh" value="' + th.map(function (t) { return M.fmtNum(t, t % 1 ? 2 : 0); }).join('; ') + '"></label>' +
      '<label>Mốc chính thức để kết luận thưởng<select id="setOff"><option value="">Chưa chọn (không kết luận thưởng)</option>' + th.map(function (t) { return '<option value="' + t + '"' + (off != null && +off === t ? ' selected' : '') + '>ROAS ' + M.fmtNum(t, t % 1 ? 2 : 0) + '</option>'; }).join('') + '</select></label><button data-act="saveTargets">Lưu</button></div></div>';
    var accNames = {}; D.tables.ads_account_cost.forEach(function (r) { if (r.active && r.v.account_name) accNames[r.v.account_name] = 1; });
    var mk = (D.settings.market || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h += '<h2>Kiểm soát ads</h2><div class="card form"><div class="form-row"><label>Tài khoản quảng cáo đang chạy GMV Max<input id="setGmvAcc" list="accList" value="' + esc(D.settings.gmvMaxAccount || '') + '" placeholder="vd: tên tài khoản trong file Cost"><datalist id="accList">' + Object.keys(accNames).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></label><button data-act="saveGmvAcc">Lưu</button></div>' +
      '<p class="small muted">File GMV Max xuất từ Seller Center không ghi tên tài khoản. Xem ở Seller Center → Marketing → Quảng cáo cửa hàng → tab Tài khoản (mục “Tài khoản GMV Max”).</p>' +
      '<h3>Ghi nhận số liệu thị trường</h3><div class="form-row"><label>Ngày<input type="date" id="mkDate" value="' + K.today() + '"></label><label>Hạng GMV trong ngành<input id="mkRank" placeholder="vd: 19"></label><label>Thay đổi<input id="mkChange" placeholder="vd: giảm 2 bậc"></label>' +
      '<label class="grow">Chỉ số ACE<input id="mkAce" placeholder="vd: Danh mục 5% cao nhất; Nội dung 5% cao nhất; Tiếp cận 5% cao nhất"></label><label class="grow">Ghi chú<input id="mkNote"></label><button data-act="addMarket">Thêm</button></div>' +
      '<p class="small muted">Lấy ở Seller Center → Số liệu phân tích: “Bảng xếp hạng GMV” (Phân tích cửa hàng) và chỉ số ACE (Tăng trưởng &amp; thông tin chuyên sâu).</p>' +
      (mk.length ? '<div class="tbl-wrap"><table class="tbl dense"><thead><tr><th>Ngày</th><th>Hạng</th><th>Thay đổi</th><th>ACE</th><th>Ghi chú</th><th></th></tr></thead><tbody>' + mk.map(function (m) { return '<tr><td>' + M.fmtDate(m.date) + '</td><td>' + esc(m.rank) + '</td><td>' + esc(m.change || '') + '</td><td>' + esc(m.ace || '') + '</td><td>' + esc(m.note || '') + '</td><td><button class="link" data-act="delMarket" data-id="' + esc(m.id) + '">Xóa</button></td></tr>'; }).join('') + '</tbody></table></div>' : '') + '</div>';
    var hl = (D.settings.health || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h += '<h2>Tình trạng tài khoản shop</h2><div class="card form"><div class="form-row"><label>Ngày<input type="date" id="hlDate" value="' + K.today() + '"></label><label>Điểm tình trạng<input id="hlScore" inputmode="numeric" placeholder="vd: 700"></label>' +
      '<label>Gửi hàng muộn (%)<input id="hlLate" placeholder="vd: 3,5"></label><label>Hài lòng qua chat (%)<input id="hlChat" placeholder="vd: 72,5"></label><label>Vi phạm trong tháng<input id="hlViol" inputmode="numeric" placeholder="vd: 4"></label><label>Sản phẩm bị đóng băng<input id="hlFrozen" inputmode="numeric" placeholder="vd: 1"></label>' +
      '<label class="grow">Ghi chú<input id="hlNote" placeholder="vd: còn 1 vi phạm có thể khiếu nại"></label><button data-act="addHealth">Thêm</button></div>' +
      '<p class="small muted">Lấy ở Seller Center → Tình trạng tài khoản → Điểm tình trạng tài khoản (mục Tổng quan và Hồ sơ vi phạm). TikTok chưa cho xuất file mục này nên ghi nhận thủ công mỗi tuần; số liệu hiện ở tab Cây chỉ số.</p>' +
      (hl.length ? '<div class="tbl-wrap"><table class="tbl dense"><thead><tr><th>Ngày</th><th>Điểm</th><th>Gửi hàng muộn</th><th>Hài lòng chat</th><th>Vi phạm</th><th>Đóng băng</th><th>Ghi chú</th><th></th></tr></thead><tbody>' + hl.map(function (x) { return '<tr><td>' + M.fmtDate(x.date) + '</td><td>' + M.fmtNum(x.score) + '</td><td>' + M.fmtPct(x.late, 2) + '</td><td>' + M.fmtPct(x.chat, 2) + '</td><td>' + M.fmtNum(x.violations) + '</td><td>' + M.fmtNum(x.frozen) + '</td><td>' + esc(x.note || '') + '</td><td><button class="link" data-act="delHealth" data-id="' + esc(x.id) + '">Xóa</button></td></tr>'; }).join('') + '</tbody></table></div>' : '') + '</div>';
    var mg = D.settings.mgmt || {}, me = (mg.entries || []).slice().sort(function (a, b) { return a.from < b.from ? 1 : -1; });
    h += '<h2>Giá vốn và chi phí kênh (cho Bản tin điều hành)</h2><div class="card form">' +
      '<p class="small">Nhập theo sổ kế toán cho đúng kỳ quyết toán của TikTok (vd. 01/10 – 31/10). Bản tin chỉ dùng khoản nằm trọn trong kỳ xem; giá vốn thực tế phải phủ đủ mọi ngày của kỳ quyết toán, nếu thiếu sẽ dùng tỷ lệ ước tính bên dưới và ghi rõ “ước tính”.</p>' +
      '<div class="form-row"><label>Từ ngày<input type="date" id="mgFrom"></label><label>Đến ngày<input type="date" id="mgTo"></label>' +
      '<label>Giá vốn hàng bán (đ)<input id="mgCogs" inputmode="numeric" placeholder="vd: 1.000.000"></label><label>Chi phí vận hành kênh (đ)<input id="mgOpex" inputmode="numeric" placeholder="nhân sự LIVE, studio…"></label>' +
      '<label>Shop<select id="mgShop"><option value="">Toàn bộ shop</option>' + D.settings.shops.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="grow">Ghi chú / nguồn số liệu<input id="mgNote" placeholder="vd: TK 632 chi tiết kênh TikTok"></label><button data-act="addMgmt">Thêm</button></div>' +
      (me.length ? '<div class="tbl-wrap"><table class="tbl dense"><thead><tr><th>Từ ngày</th><th>Đến ngày</th><th>Shop</th><th class="num">Giá vốn</th><th class="num">Chi phí vận hành</th><th>Ghi chú</th><th></th></tr></thead><tbody>' + me.map(function (x) { return '<tr><td>' + M.fmtDate(x.from) + '</td><td>' + M.fmtDate(x.to) + '</td><td>' + (x.shop ? esc(D.shopName(x.shop)) : 'Toàn bộ') + '</td><td class="num">' + (x.cogs == null ? '—' : M.fmtMoney(x.cogs)) + '</td><td class="num">' + (x.opex == null ? '—' : M.fmtMoney(x.opex)) + '</td><td>' + esc(x.note || '') + '</td><td><button class="link" data-act="delMgmt" data-id="' + esc(x.id) + '">Xóa</button></td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '<div class="form-row"><label>Tỷ lệ giá vốn ước tính (% doanh thu thuần)<input id="mgRate" placeholder="để trống nếu không dùng" value="' + (typeof mg.cogsRate === 'number' ? M.fmtNum(mg.cogsRate * 100, 2) : '') + '"></label><button class="secondary" data-act="saveCogsRate">Lưu tỷ lệ</button></div>' +
      '<p class="small muted">Tỷ lệ ước tính chỉ dùng cho kỳ chưa có giá vốn thực tế (vd. tháng đang chạy). Số liệu này nằm trong trình duyệt máy này và trong báo cáo lãnh đạo đã mã hóa, không gửi đi nơi khác.</p></div>';
    h += '<h2>Shop</h2><div class="card form">' + D.settings.shops.map(function (s) { return '<div class="form-row"><label>' + esc(s.id) + '<input data-shop="' + esc(s.id) + '" value="' + esc(s.name) + '"></label></div>'; }).join('') + '<div class="form-row"><label>Thêm shop<input id="setNewShop" placeholder="Tên shop"></label><button data-act="saveShops">Lưu</button></div></div>';
    h += '<h2>Bảng ánh xạ cột nguồn → chỉ tiêu</h2><p class="note">So khớp tên cột không phân biệt dấu, hoa/thường, bỏ phần trong ngoặc. Cột thông tin cá nhân không bao giờ được lưu.</p>' + SC.all.map(function (d) {
      return '<details class="card"><summary><strong>' + esc(d.label) + '</strong></summary><p class="small">' + esc(d.desc) + '<br><span class="muted">Nguồn: ' + esc(d.source) + '</span></p><div class="tbl-wrap"><table class="tbl dense"><thead><tr><th>Chỉ tiêu</th><th>Kiểu</th><th>Bắt buộc</th><th>Tên cột nguồn được nhận</th><th>Ghi chú</th></tr></thead><tbody>' +
        d.fields.filter(function (f) { return f.key.indexOf('_pii') !== 0; }).map(function (f) { return '<tr><td>' + esc(f.label) + '</td><td>' + esc(f.type) + '</td><td>' + (f.required ? 'Có' : '') + '</td><td>' + esc(f.syn.join(' · ')) + '</td><td>' + (f.pii ? '<span class="pii">Không lưu</span>' : '') + (f.negate ? 'Số âm = chi phí → đổi dấu. ' : '') + (f.nonAdd ? 'Không cộng qua nhiều ngày. ' : '') + esc(f.missing ? 'Nếu thiếu: ' + f.missing : '') + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    }).join('') + '<p class="small muted"><a href="kiem_thu.html" target="_blank">Trang kiểm thử công thức</a> · <a href="huong_dan.html" target="_blank">Hướng dẫn sử dụng</a> · <a href="huong_dan_xuat_du_lieu.html" target="_blank">Quy trình tải dữ liệu TikTok</a></p>';
    main.innerHTML = h;
    $('#restoreFile').addEventListener('change', function () {
      var f = this.files[0]; this.value = ''; if (!f) return;
      if (!confirm('Khôi phục từ “' + f.name + '”? Dữ liệu hiện tại trên máy này sẽ được thay thế.')) return;
      f.arrayBuffer().then(function (b) { return D.restoreBytes(new Uint8Array(b)); }).then(function () { toast('Đã khôi phục dữ liệu.'); S.f.from = ''; S.cube = M.prepare(Q.build()); applyPreset('latest'); render(); }).catch(function (e) { toast(e.message, 'err'); });
    });
  }
  actions.makeKey = function () { Z.newKeyPair().then(function (k) { D.settings.staffKey = k; return D.saveMeta(); }).then(function () { toast('Đã tạo link cho nhân sự. Nên tải bản sao lưu ngay để giữ khóa.'); render(); }); };
  actions.copyLink = function () { var l = staffLink(); (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(function () { toast('Đã sao chép link.'); }, function () { prompt('Sao chép link:', l); }); };
  actions.backup = function () {
    D.backupBytes().then(function (b) { download(b, 'SaoLuu_TikTokShop_' + K.today() + '.ttsbak', 'application/gzip'); D.settings.lastBackup = K.nowStr(); return D.saveMeta(); }).then(function () { toast('Đã tải bản sao lưu. Lưu file ở nơi an toàn.'); render(); }).catch(function (e) { toast(e.message, 'err'); });
  };
  actions.wipe = function () { if (!confirm('Xóa TOÀN BỘ dữ liệu ứng dụng trên trình duyệt này? Không hoàn tác được nếu chưa có bản sao lưu.')) return; D.wipe().then(function () { toast('Đã xóa dữ liệu.'); S.cards = []; rebuild(); }); };
  actions.saveTargets = function () {
    var vals = $('#setTh').value.split(/[;\s]+/).filter(Boolean).map(function (s) { return Number(s.replace(/\./g, '').replace(',', '.')); });
    if (!vals.length || vals.some(function (v) { return !(v > 0); })) { toast('Mốc ROAS không hợp lệ.', 'err'); return; }
    D.settings.thresholds = vals.filter(function (v, i) { return vals.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    var off = $('#setOff').value; D.settings.official = off === '' ? null : +off;
    D.saveMeta().then(function () { toast('Đã lưu mục tiêu.'); rebuild(); });
  };
  actions.saveGmvAcc = function () { D.settings.gmvMaxAccount = $('#setGmvAcc').value.trim(); D.saveMeta().then(function () { toast('Đã lưu tài khoản GMV Max.'); rebuild(); }); };
  actions.addMarket = function () {
    var rank = $('#mkRank').value.trim(), date = $('#mkDate').value; if (!rank || !date) { toast('Nhập ngày và hạng GMV.', 'err'); return; }
    D.settings.market = D.settings.market || [];
    D.settings.market.push({ id: 'm' + Date.now().toString(36), date: date, rank: rank, change: $('#mkChange').value.trim(), ace: $('#mkAce').value.trim(), note: $('#mkNote').value.trim() });
    D.saveMeta().then(function () { toast('Đã ghi nhận số liệu thị trường.'); rebuild(); });
  };
  actions.addHealth = function () {
    var date = $('#hlDate').value; if (!date) { toast('Nhập ngày ghi nhận.', 'err'); return; }
    var numOrNull = function (id, pct) { var s = $('#' + id).value.trim().replace('%', ''); if (!s) return null; var n = Number(s.replace(/\./g, '').replace(',', '.')); if (s.indexOf(',') < 0 && /^\d+\.\d+$/.test(s)) n = Number(s); return isFinite(n) ? (pct ? n / 100 : n) : null; };
    var rec = { id: 'h' + Date.now().toString(36), date: date, score: numOrNull('hlScore'), late: numOrNull('hlLate', true), chat: numOrNull('hlChat', true), violations: numOrNull('hlViol'), frozen: numOrNull('hlFrozen'), note: $('#hlNote').value.trim() };
    if (rec.score == null && rec.late == null && rec.chat == null && rec.violations == null) { toast('Nhập ít nhất một chỉ số.', 'err'); return; }
    D.settings.health = D.settings.health || []; D.settings.health.push(rec);
    D.saveMeta().then(function () { toast('Đã ghi nhận tình trạng tài khoản.'); rebuild(); });
  };
  actions.delHealth = function (b) { var id = b.getAttribute('data-id'); D.settings.health = (D.settings.health || []).filter(function (m) { return m.id !== id; }); D.saveMeta().then(function () { rebuild(); }); };
  function moneyIn(id) { var s = $('#' + id).value.trim().replace(/\s|đ/g, ''); if (!s) return null; var neg = /^[-−(]/.test(s), v = Number(s.replace(/[^\d,]/g, '').replace(',', '.')); return isFinite(v) ? (neg ? -v : v) : NaN; }
  actions.addMgmt = function () {
    var from = $('#mgFrom').value, to = $('#mgTo').value, cogs = moneyIn('mgCogs'), opex = moneyIn('mgOpex');
    if (!from || !to || from > to) { toast('Nhập kỳ từ ngày – đến ngày.', 'err'); return; }
    if ((cogs == null && opex == null) || (cogs != null && isNaN(cogs)) || (opex != null && isNaN(opex))) { toast('Nhập giá vốn hoặc chi phí vận hành (số tiền đồng).', 'err'); return; }
    var mg = D.settings.mgmt = D.settings.mgmt || {}; mg.entries = mg.entries || [];
    var shop = $('#mgShop').value || '';
    if (mg.entries.some(function (e) { return (e.shop || '') === shop && !(e.to < from || e.from > to) && ((cogs != null && e.cogs != null) || (opex != null && e.opex != null)); })) { toast('Kỳ này đã có số liệu trùng ngày – xóa dòng cũ trước khi nhập lại.', 'err'); return; }
    mg.entries.push({ id: 'g' + Date.now().toString(36), from: from, to: to, shop: shop, cogs: cogs, opex: opex, note: $('#mgNote').value.trim() });
    D.saveMeta().then(function () { toast('Đã lưu giá vốn / chi phí kênh.'); rebuild(); });
  };
  actions.delMgmt = function (b) { var id = b.getAttribute('data-id'), mg = D.settings.mgmt || {}; mg.entries = (mg.entries || []).filter(function (e) { return e.id !== id; }); D.saveMeta().then(function () { rebuild(); }); };
  actions.saveCogsRate = function () {
    var s = $('#mgRate').value.trim().replace('%', ''), mg = D.settings.mgmt = D.settings.mgmt || {};
    if (!s) mg.cogsRate = null;
    else { var v = Number(s.replace(',', '.')); if (!(v > 0 && v < 100)) { toast('Tỷ lệ phải từ 0 đến 100%.', 'err'); return; } mg.cogsRate = v / 100; }
    D.saveMeta().then(function () { toast('Đã lưu tỷ lệ giá vốn ước tính.'); rebuild(); });
  };
  actions.delMarket = function (b) { var id = b.getAttribute('data-id'); D.settings.market = (D.settings.market || []).filter(function (m) { return m.id !== id; }); D.saveMeta().then(function () { rebuild(); }); };
  actions.saveShops = function () {
    $$('[data-shop]').forEach(function (i) { var s = D.settings.shops.filter(function (x) { return x.id === i.getAttribute('data-shop'); })[0]; if (s && i.value.trim()) s.name = i.value.trim(); });
    var add = $('#setNewShop').value.trim(); if (add) D.addShop(add);
    D.saveMeta().then(function () { toast('Đã lưu shop.'); rebuild(); });
  };

  window.addEventListener('hashchange', function () { if (/^#gui=/.test(location.hash) || location.hash === '#xem' || location.hash === '#ketoan') boot(); });
  document.addEventListener('DOMContentLoaded', function () {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { });
    boot();
  });
  window.TTSApp = { S: S, rebuild: rebuild, fd: { use: function (h) { FD.handle = h; FD.perm = 'granted'; FD.session = {}; }, scan: function () { return fdScan(true); }, state: FD } };
})();
