/* 델타투어 보조 — 앱 로직 */
(function () {
  'use strict';

  var P = window.DTParse;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var SIGN = 'DELTA TOUR · 하나투어 공식인증 대리점 · 박주연 실장 010-9692-5632 · 카카오톡 POK1206';
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  var DAY = 86400000;
  var ARCHIVE_DAYS = 30;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad2(n) { return ('0' + n).slice(-2); }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function dotYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return String(s || '');
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return m[1] + '.' + m[2] + '.' + m[3] + '(' + WD[d.getDay()] + ')';
  }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  /* ================= storage ================= */
  var mem = {};
  var lsOK = true;
  try { localStorage.setItem('__dt2__', '1'); localStorage.removeItem('__dt2__'); } catch (e) { lsOK = false; }

  function get(key, dflt) {
    if (lsOK) {
      try {
        var raw = localStorage.getItem(key);
        if (raw !== null) return JSON.parse(raw);
      } catch (e) {}
    }
    return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : dflt;
  }
  function set(key, val) {
    mem[key] = val;
    if (lsOK) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { lsOK = false; } }
  }
  function del(key) {
    delete mem[key];
    if (lsOK) { try { localStorage.removeItem(key); } catch (e) {} }
  }

  var DB = {
    inquiries: get('dt2.inquiries', []),
    jobs: get('dt2.jobs', []),
    arc: get('dt2.archive', []),
    notices: get('dt2.notices', {}) || {},
    quote: get('dt2.quote', null),
    seeded: get('dt2.seeded', false)
  };
  if (!Array.isArray(DB.inquiries)) DB.inquiries = [];
  if (!Array.isArray(DB.jobs)) DB.jobs = [];
  if (!Array.isArray(DB.arc)) DB.arc = [];

  function saveInq() { set('dt2.inquiries', DB.inquiries); }
  function saveJobs() { set('dt2.jobs', DB.jobs); }
  function saveArc() { set('dt2.archive', DB.arc); }

  /* ================= toast / copy / modal ================= */
  var toastEl = $('#toast'), toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2100);
  }

  function copyText(text) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, ta.value.length);
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    }
    return Promise.resolve(fallback());
  }
  function copyWithToast(text, okMsg) {
    if (!text) { toast('복사할 내용이 없습니다'); return; }
    Promise.resolve(copyText(text)).then(function (ok) {
      toast(ok ? (okMsg || '복사 완료 — 카톡에 붙여넣으세요') : '복사하지 못했습니다. 길게 눌러 직접 복사해 주세요');
    });
  }

  var modalWrap = $('#modalWrap');
  var modalOpen = false;
  function closeModal() {
    modalWrap.classList.remove('on');
    modalOpen = false;
    $('#mActions').innerHTML = '';
    $('#mBody').innerHTML = '';
  }
  function openModal(opts) {
    $('#mTitle').textContent = opts.title || '';
    var sub = $('#mSub');
    if (opts.sub) { sub.textContent = opts.sub; sub.hidden = false; } else { sub.hidden = true; }
    $('#mBody').innerHTML = opts.body || '';
    var box = $('#mActions');
    box.innerHTML = '';
    (opts.actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.kind || '');
      b.textContent = a.label;
      b.addEventListener('click', function () { a.onClick && a.onClick(); });
      box.appendChild(b);
    });
    modalWrap.classList.add('on');
    modalOpen = true;
    if (opts.focus) setTimeout(function () { var el = $(opts.focus); if (el) el.focus(); }, 80);
  }
  modalWrap.addEventListener('click', function (e) { if (e.target === modalWrap) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalOpen) closeModal(); });

  /* ================= tabs ================= */
  var currentTab = '1';
  function showTab(name, opts) {
    currentTab = name;
    var panelId = 'p' + name;
    $$('.panel').forEach(function (p) { p.classList.toggle('on', p.id === panelId); });
    $$('.tab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === String(name).charAt(0);
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (!(opts && opts.noScroll)) window.scrollTo(0, 0);
    if (location.hash !== '#s' + name) {
      try { history.replaceState(null, '', '#s' + name); } catch (e) {}
    }
    if (name === '1') renderInquiries();
    if (name === '4') renderJobs();
    if (name === '5') renderArchive();
  }
  $$('.tab').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
  });

  /* ================= 1섹션 · 문의 ================= */
  var qType = '패키지';
  var editingId = null;

  $('#qType').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    qType = b.getAttribute('data-v');
    $$('#qType .chip').forEach(function (c) { c.classList.toggle('on', c === b); });
  });

  function resetForm() {
    editingId = null;
    ['qName', 'qPhone', 'qDate', 'qPax', 'qDest', 'qReq'].forEach(function (id) { $('#' + id).value = ''; });
    qType = '패키지';
    $$('#qType .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-v') === '패키지'); });
    $('#qSave').textContent = '문의 저장';
    $('#qEditCancel').hidden = true;
  }

  $('#qEditCancel').addEventListener('click', function () { resetForm(); toast('수정을 취소했습니다'); });

  $('#qForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#qName').value.trim();
    var phone = $('#qPhone').value.trim();
    var date = $('#qDate').value;
    var dest = $('#qDest').value.trim();
    var pax = $('#qPax').value.trim();
    var req = $('#qReq').value.trim();

    if (!name && !phone) { toast('이름이나 전화번호를 넣어 주세요'); $('#qName').focus(); return; }
    if (!dest && !req) { toast('여행지역이나 요구사항을 적어 주세요'); $('#qDest').focus(); return; }

    if (editingId) {
      var it = DB.inquiries.filter(function (x) { return x.id === editingId; })[0];
      if (it) {
        it.name = name; it.phone = phone; it.date = date; it.dest = dest; it.pax = pax;
        it.type = qType; it.req = req; it.updatedAt = Date.now();
        saveInq();
        toast('문의를 수정했습니다');
      }
      resetForm();
      renderInquiries();
      return;
    }

    DB.inquiries.unshift({
      id: uid(), name: name, phone: phone, date: date, dest: dest, pax: pax,
      type: qType, req: req, createdAt: Date.now(), updatedAt: Date.now()
    });
    saveInq();
    resetForm();
    renderInquiries();
    toast('문의를 저장했습니다');
    window.scrollTo({ top: 260, behavior: 'smooth' });
  });

  function inquiryCard(it) {
    var meta = [];
    if (it.dest) meta.push(it.dest);
    if (it.date) meta.push(dotYmd(it.date));
    if (it.pax) meta.push(it.pax);
    return '' +
      '<article class="item" data-id="' + it.id + '">' +
        '<div class="item-top">' +
          '<div style="min-width:0">' +
            '<h3 class="item-title">' + esc(it.name || '이름 없음') +
              '<span class="tag">' + esc(it.type || '기타') + '</span></h3>' +
            '<p class="item-meta">' + (meta.length ? esc(meta.join(' · ')) : '조건 미기재') +
              (it.phone ? ' · ' + esc(it.phone) : '') + '</p>' +
          '</div>' +
        '</div>' +
        (it.req ? '<p class="item-req">' + esc(it.req) + '</p>' : '') +
        '<div class="item-actions">' +
          '<button class="btn small line" data-act="edit">수정</button>' +
          '<button class="btn small" data-act="go">진행</button>' +
          '<button class="btn small ghost" data-act="no">미진행</button>' +
        '</div>' +
      '</article>';
  }

  function renderInquiries() {
    var list = $('#qList');
    $('#qCount').textContent = DB.inquiries.length;
    var dot = $('#dot1');
    if (DB.inquiries.length) { dot.textContent = DB.inquiries.length > 9 ? '9+' : DB.inquiries.length; dot.hidden = false; }
    else dot.hidden = true;

    if (!DB.inquiries.length) {
      list.innerHTML = '<div class="empty"><b>대기 중인 문의가 없습니다</b>손님 문의를 위에 적어 두면 여기에 쌓입니다.</div>';
      return;
    }
    list.innerHTML = DB.inquiries.map(inquiryCard).join('');
  }

  $('#qList').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var card = btn.closest('[data-id]');
    var id = card.getAttribute('data-id');
    var it = DB.inquiries.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var act = btn.getAttribute('data-act');

    if (act === 'edit') {
      editingId = id;
      $('#qName').value = it.name || '';
      $('#qPhone').value = it.phone || '';
      $('#qDate').value = it.date || '';
      $('#qPax').value = it.pax || '';
      $('#qDest').value = it.dest || '';
      $('#qReq').value = it.req || '';
      qType = it.type || '기타';
      $$('#qType .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-v') === qType); });
      $('#qSave').textContent = '수정 저장';
      $('#qEditCancel').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(function () { $('#qName').focus(); }, 260);
      return;
    }

    if (act === 'go') openProgressModal(it);
    if (act === 'no') openSkipModal(it);
  });

  function openProgressModal(it) {
    openModal({
      title: '진행건으로 이관',
      sub: (it.dest || '여행지') + ' · ' + (it.name || '손님') + ' — 예약번호와 상품번호를 넣으면 4섹션에 생깁니다.',
      body: '' +
        '<div class="field"><label for="mBook">예약번호</label>' +
          '<input type="text" id="mBook" placeholder="예: 12345678" autocomplete="off"></div>' +
        '<div class="field"><label for="mProd">상품번호</label>' +
          '<input type="text" id="mProd" placeholder="예: AVP231270212RSB" autocomplete="off"></div>',
      focus: '#mBook',
      actions: [
        { label: '취소', kind: 'line', onClick: closeModal },
        {
          label: '4섹션으로 이관', kind: '', onClick: function () {
            var booking = $('#mBook').value.trim();
            var product = $('#mProd').value.trim();
            moveToJobs(it, product, booking);
            closeModal();
          }
        }
      ]
    });
  }

  function moveToJobs(it, product, booking) {
    DB.inquiries = DB.inquiries.filter(function (x) { return x.id !== it.id; });
    saveInq();
    DB.jobs.unshift({
      id: uid(),
      name: it.name || '', phone: it.phone || '', dest: it.dest || '',
      date: it.date || '', pax: it.pax || '', type: it.type || '',
      req: it.req || '',
      productCode: product || '', bookingCode: booking || '',
      commissionType: 'pct', commissionValue: '', commissionMemo: '',
      checklist: emptyChecks(),
      createdAt: Date.now(), updatedAt: Date.now()
    });
    saveJobs();
    renderInquiries();
    renderJobs();
    toast('4섹션 진행건으로 옮겼습니다');
    showTab('4');
  }

  function openSkipModal(it) {
    var memo = (it.req || '').replace(/\s+/g, ' ').trim();
    if (memo.length > 90) memo = memo.slice(0, 90) + '…';
    if (!memo) {
      memo = [it.dest, it.date ? dotYmd(it.date) : '', it.pax].filter(Boolean).join(' · ');
    }
    openModal({
      title: '미진행으로 보관',
      sub: '핵심만 추려 5섹션(미진행건)에 30일 보관합니다. 나중에 진행건으로 복원할 수 있어요.',
      body: '' +
        '<div class="field"><label for="mMemo">핵심 메모</label>' +
        '<textarea id="mMemo" rows="4" placeholder="왜 미진행인지, 다시 연락할 조건 등">' + esc(memo) + '</textarea></div>',
      focus: '#mMemo',
      actions: [
        { label: '취소', kind: 'line', onClick: closeModal },
        {
          label: '보관함으로', kind: 'ghost', onClick: function () {
            var text = $('#mMemo').value.trim();
            archiveInquiry(it, text);
            closeModal();
          }
        }
      ]
    });
  }

  function archiveInquiry(it, memo) {
    DB.inquiries = DB.inquiries.filter(function (x) { return x.id !== it.id; });
    saveInq();
    DB.arc.unshift({
      id: uid(), kind: 'inquiry', result: 'lost',
      name: it.name || '', phone: it.phone || '', dest: it.dest || '',
      date: it.date || '', pax: it.pax || '', type: it.type || '',
      memo: memo || '', req: it.req || '',
      archivedAt: Date.now()
    });
    saveArc();
    renderInquiries();
    renderArchive();
    toast('5섹션 미진행건으로 보관했습니다');
  }

  /* ================= 4섹션 · 진행건 ================= */
  var CHECKLIST = [
    { k: 'passport', label: '여권사본' },
    { k: 'deposit', label: '예약금' },
    { k: 'notice', label: '잔금안내, 준비사항 안내' },
    { k: 'balance', label: '잔금결제' },
    { k: 'final', label: '최종 안내사항' }
  ];
  function emptyChecks() {
    var o = {};
    CHECKLIST.forEach(function (c) { o[c.k] = { done: false, date: '', memo: '' }; });
    return o;
  }
  function checkScore(job) {
    var n = 0;
    CHECKLIST.forEach(function (c) { if (job.checklist && job.checklist[c.k] && job.checklist[c.k].done) n++; });
    return n;
  }
  function jobTitle(job) { return (job.dest || '여행지') + ' · ' + (job.name || '손님') + '건'; }

  function renderJobs() {
    var list = $('#jobList');
    $('#jobCount').textContent = DB.jobs.length;
    var dot = $('#dot4');
    if (DB.jobs.length) { dot.textContent = DB.jobs.length > 9 ? '9+' : DB.jobs.length; dot.hidden = false; }
    else dot.hidden = true;

    if (!DB.jobs.length) {
      list.innerHTML = '<div class="empty"><b>진행 중인 건이 없습니다</b>1섹션에서 ‘진행’을 누르면 이곳으로 들어옵니다.</div>';
      return;
    }
    list.innerHTML = DB.jobs.map(function (job) {
      var done = checkScore(job);
      var pct = Math.round((done / CHECKLIST.length) * 100);
      var sub = [];
      if (job.bookingCode) sub.push('예약 ' + job.bookingCode);
      if (job.productCode) sub.push('상품 ' + job.productCode);
      if (job.date) sub.push(dotYmd(job.date));
      return '' +
        '<article class="item" data-id="' + job.id + '" data-act="open" style="cursor:pointer">' +
          '<div class="item-top">' +
            '<div style="min-width:0">' +
              '<h3 class="item-title">' + esc(jobTitle(job)) +
                (job.sample ? '<span class="tag navy">샘플</span>' : '') + '</h3>' +
              '<p class="item-meta">' + esc(sub.join(' · ') || '코드 미입력') +
                (job.pax ? ' · ' + esc(job.pax) : '') + '</p>' +
            '</div>' +
            '<span class="dday">' + done + '/' + CHECKLIST.length + '</span>' +
          '</div>' +
          '<div class="prog"><div class="prog-bar" style="width:' + pct + '%"></div></div>' +
          '<p class="prog-txt">' + (done === CHECKLIST.length ? '체크리스트 완료 — 보관함으로 옮길 수 있어요' : '다음: ' + (CHECKLIST.filter(function (c) { return !(job.checklist && job.checklist[c.k] && job.checklist[c.k].done); })[0] || {}).label) + '</p>' +
        '</article>';
    }).join('');
  }

  $('#jobList').addEventListener('click', function (e) {
    var card = e.target.closest('[data-id]');
    if (!card) return;
    openJobDetail(card.getAttribute('data-id'));
  });

  var detailId = null;
  function openJobDetail(id) {
    detailId = id;
    renderJobDetail();
    showTab('4d');
  }
  $('#btnBackJob').addEventListener('click', function () { detailId = null; showTab('4'); });

  function renderJobDetail() {
    var job = DB.jobs.filter(function (x) { return x.id === detailId; })[0];
    var box = $('#jobDetail');
    if (!job) { showTab('4'); return; }
    job.checklist = job.checklist || emptyChecks();
    CHECKLIST.forEach(function (c) { if (!job.checklist[c.k]) job.checklist[c.k] = { done: false, date: '', memo: '' }; });

    var checksHTML = CHECKLIST.map(function (c) {
      var s = job.checklist[c.k];
      return '' +
        '<div class="check" data-k="' + c.k + '">' +
          '<div class="check-row">' +
            '<button type="button" class="check-box ' + (s.done ? 'on' : '') + '" data-act="toggle" aria-pressed="' + (s.done ? 'true' : 'false') + '">' + (s.done ? '✓' : '') + '</button>' +
            '<span class="check-label ' + (s.done ? 'done' : '') + '" data-act="toggle">' + esc(c.label) + '</span>' +
            '<span class="check-date">' + (s.date ? esc(s.date.replace(/-/g, '.')) : '') + '</span>' +
            '<button type="button" class="check-memo-btn ' + (s.memo ? 'has' : '') + '" data-act="memo">' + (s.memo ? '메모' : '＋') + '</button>' +
          '</div>' +
          (s.memo ? '<p class="check-memo">' + esc(s.memo) + '</p>' : '') +
          '<div class="check-edit">' +
            '<input type="date" data-field="date" value="' + esc(s.date || '') + '">' +
            '<textarea data-field="memo" rows="2" placeholder="메모 (예: 11/28 카톡 전달 완료)">' + esc(s.memo || '') + '</textarea>' +
          '</div>' +
        '</div>';
    }).join('');

    box.innerHTML = '' +
      '<p class="detail-title">' + esc(jobTitle(job)) + '</p>' +
      '<p class="detail-sub">' + esc([job.type, job.pax, job.date ? dotYmd(job.date) : '', job.phone].filter(Boolean).join(' · ') || '손님 정보 없음') + '</p>' +

      '<div class="card">' +
        '<p class="card-title">상품 · 예약</p>' +
        '<div class="codes">' +
          '<div class="field"><label>상품코드</label>' +
            '<input type="text" data-f="productCode" value="' + esc(job.productCode || '') + '" placeholder="상품번호" autocomplete="off"></div>' +
          '<div class="field"><label>예약코드</label>' +
            '<input type="text" data-f="bookingCode" value="' + esc(job.bookingCode || '') + '" placeholder="예약번호" autocomplete="off"></div>' +
        '</div>' +
        '<p class="card-title" style="margin:16px 0 8px">커미션 (내가 입력)</p>' +
        '<div class="comm">' +
          '<select id="commType" style="min-height:44px;border:1px solid var(--line);border-radius:12px;padding:0 10px;font-size:14px;background:#fff;color:var(--navy)">' +
            '<option value="pct"' + (job.commissionType === 'pct' ? ' selected' : '') + '>수수료율 %</option>' +
            '<option value="amt"' + (job.commissionType === 'amt' ? ' selected' : '') + '>금액 원</option>' +
          '</select>' +
          '<input type="text" id="commValue" inputmode="decimal" value="' + esc(job.commissionValue || '') + '" placeholder="' + (job.commissionType === 'amt' ? '예: 150000' : '예: 8') + '">' +
        '</div>' +
        '<div class="field" style="margin-top:10px"><textarea id="commMemo" rows="2" placeholder="커미션 메모 (예: 마진 12만, 12월 정산)">' + esc(job.commissionMemo || '') + '</textarea></div>' +
      '</div>' +

      '<div class="card">' +
        '<p class="card-title">진행 체크리스트 <span style="letter-spacing:0;font-weight:600">' + checkScore(job) + '/' + CHECKLIST.length + '</span></p>' +
        '<div class="checks">' + checksHTML + '</div>' +
        '<p class="hint">체크하면 오늘 날짜가 들어갑니다. ＋를 눌러 날짜·메모를 직접 적을 수 있습니다.</p>' +
      '</div>' +

      (job.req ? '<div class="card"><p class="card-title">손님 요구사항</p><p class="item-req" style="margin-top:0">' + esc(job.req) + '</p></div>' : '') +

      '<div class="btn-row">' +
        '<button class="btn ghost" id="jobDone">완료 → 보관함</button>' +
        '<button class="btn line" id="jobCancel">취소 → 보관함</button>' +
      '</div>' +
      '<div class="btn-row tight">' +
        '<button class="btn line" id="jobDelete" style="color:var(--alert)">이 건 삭제</button>' +
      '</div>' +
      (job.sample ? '<p class="hint">샘플로 넣어 둔 건입니다. 실제로 쓰실 때는 위 ‘이 건 삭제’로 지우면 됩니다.</p>' : '');

    bindJobDetail(job);
  }

  function saveJob(job) { job.updatedAt = Date.now(); saveJobs(); }

  function bindJobDetail(job) {
    $$('#jobDetail [data-f]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        job[inp.getAttribute('data-f')] = inp.value.trim();
        saveJob(job);
      });
    });
    var ct = $('#commType');
    if (ct) ct.addEventListener('change', function () {
      job.commissionType = ct.value; saveJob(job);
      $('#commValue').placeholder = ct.value === 'amt' ? '예: 150000' : '예: 8';
    });
    var cv = $('#commValue');
    if (cv) cv.addEventListener('input', function () { job.commissionValue = cv.value.trim(); saveJob(job); });
    var cm = $('#commMemo');
    if (cm) cm.addEventListener('input', function () { job.commissionMemo = cm.value; saveJob(job); });

    $('#jobDetail').onclick = function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var row = btn.closest('.check');
      if (!row) return;
      var k = row.getAttribute('data-k');
      var st = job.checklist[k];
      var act = btn.getAttribute('data-act');

      if (act === 'memo') {
        var ed = row.querySelector('.check-edit');
        ed.classList.toggle('on');
        if (ed.classList.contains('on')) {
          var memo = ed.querySelector('[data-field=memo]');
          if (memo) setTimeout(function () { memo.focus(); }, 60);
        }
        return;
      }
      if (act === 'toggle') {
        st.done = !st.done;
        if (st.done && !st.date) st.date = ymd(today());
        if (!st.done) st.date = '';
        saveJob(job);
        renderJobDetail();
        if (st.done) toast(CHECKLIST.filter(function (c) { return c.k === k; })[0].label + ' 체크');
      }
    };

    $$('#jobDetail .check-edit [data-field]').forEach(function (f) {
      f.addEventListener('input', function () {
        var row = f.closest('.check');
        var k = row.getAttribute('data-k');
        job.checklist[k][f.getAttribute('data-field')] = f.value;
        saveJob(job);
      });
      f.addEventListener('change', function () {
        if (f.getAttribute('data-field') === 'date') {
          var row = f.closest('.check');
          var k = row.getAttribute('data-k');
          job.checklist[k].date = f.value;
          if (f.value && !job.checklist[k].done) job.checklist[k].done = true;
          saveJob(job);
          renderJobDetail();
        }
      });
    });

    var doneBtn = $('#jobDone');
    if (doneBtn) doneBtn.addEventListener('click', function () { archiveJob(job, 'done'); });
    var cancelBtn = $('#jobCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function () {
      openModal({
        title: '취소로 보관할까요?',
        sub: '진행건에서 빼고 5섹션 지난건에 30일 보관합니다.',
        actions: [
          { label: '그대로 두기', kind: 'line', onClick: closeModal },
          { label: '취소 → 보관함', kind: 'ghost', onClick: function () { closeModal(); archiveJob(job, 'cancel'); } }
        ]
      });
    });
    var delBtn = $('#jobDelete');
    if (delBtn) delBtn.addEventListener('click', function () {
      openModal({
        title: '이 건을 삭제할까요?',
        sub: '보관함에도 남지 않고 완전히 지워집니다.',
        actions: [
          { label: '취소', kind: 'line', onClick: closeModal },
          {
            label: '삭제', kind: 'ghost', onClick: function () {
              DB.jobs = DB.jobs.filter(function (x) { return x.id !== job.id; });
              saveJobs(); closeModal(); detailId = null; showTab('4'); toast('삭제했습니다');
            }
          }
        ]
      });
    });
  }

  function archiveJob(job, result) {
    DB.jobs = DB.jobs.filter(function (x) { return x.id !== job.id; });
    saveJobs();
    var copy = JSON.parse(JSON.stringify(job));
    copy.kind = 'job';
    copy.result = result;
    copy.archivedAt = Date.now();
    DB.arc.unshift(copy);
    saveArc();
    detailId = null;
    renderJobs();
    renderArchive();
    showTab('5');
    toast(result === 'done' ? '완료 — 5섹션 지난건으로 옮겼습니다' : '취소 — 5섹션 지난건으로 옮겼습니다');
  }

  /* ================= 5섹션 · 보관함 ================= */
  var arcTab = 'job';
  $('#arcSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    arcTab = b.getAttribute('data-v');
    $$('#arcSeg button').forEach(function (x) { x.classList.toggle('on', x === b); });
    renderArchive();
  });

  function daysLeft(a) {
    var end = a.archivedAt + ARCHIVE_DAYS * DAY;
    return Math.max(0, Math.ceil((end - Date.now()) / DAY) - 1);
  }

  function purgeExpired() {
    var now = Date.now();
    var before = DB.arc.length;
    DB.arc = DB.arc.filter(function (a) { return a.archivedAt + ARCHIVE_DAYS * DAY > now; });
    if (DB.arc.length !== before) { saveArc(); return before - DB.arc.length; }
    return 0;
  }

  function renderArchive() {
    var list = $('#arcList');
    var items = DB.arc.filter(function (a) { return (a.kind === 'job') === (arcTab === 'job'); });
    var otherCount = DB.arc.filter(function (a) { return (a.kind === 'job') !== (arcTab === 'job'); }).length;
    $$('#arcSeg button').forEach(function (b) {
      var isJob = b.getAttribute('data-v') === 'job';
      var n = DB.arc.filter(function (a) { return (a.kind === 'job') === isJob; }).length;
      b.textContent = (isJob ? '지난건' : '미진행건') + ' ' + n;
    });

    if (!items.length) {
      list.innerHTML = '<div class="empty"><b>' + (arcTab === 'job' ? '지난 건이 없습니다' : '미진행건이 없습니다') + '</b>' +
        (arcTab === 'job' ? '4섹션에서 완료·취소하면 이곳에 쌓입니다.' : '1섹션에서 ‘미진행’으로 보낸 문의가 이곳에 보관됩니다.') + '</div>';
      return;
    }

    list.innerHTML = items.map(function (a) {
      var left = daysLeft(a);
      var soon = left <= 7 ? ' soon' : '';
      if (a.kind === 'job') {
        var done = 0;
        CHECKLIST.forEach(function (c) { if (a.checklist && a.checklist[c.k] && a.checklist[c.k].done) done++; });
        return '' +
          '<article class="item" data-id="' + a.id + '">' +
            '<div class="item-top">' +
              '<div style="min-width:0">' +
                '<h3 class="item-title">' + esc(jobTitle(a)) +
                  '<span class="tag ' + (a.result === 'done' ? 'ok' : 'alert') + '">' + (a.result === 'done' ? '완료' : '취소') + '</span></h3>' +
                '<p class="item-meta">' + esc([a.bookingCode ? '예약 ' + a.bookingCode : '', a.productCode ? '상품 ' + a.productCode : '', dotYmd(ymd(new Date(a.archivedAt)))].filter(Boolean).join(' · ')) + '</p>' +
                '<p class="prog-txt" style="margin-top:6px">체크 ' + done + '/' + CHECKLIST.length + (a.commissionValue ? ' · 커미션 ' + esc(a.commissionValue) + (a.commissionType === 'pct' ? '%' : '원') : '') + '</p>' +
              '</div>' +
              '<span class="dday' + soon + '">D-' + left + ' 남음</span>' +
            '</div>' +
            '<div class="item-actions">' +
              '<button class="btn small line" data-act="restore">진행건으로 복원</button>' +
              '<button class="btn small line" data-act="del" style="color:var(--alert)">삭제</button>' +
            '</div>' +
          '</article>';
      }
      var meta = [a.dest, a.date ? dotYmd(a.date) : '', a.pax, a.phone].filter(Boolean).join(' · ');
      return '' +
        '<article class="item" data-id="' + a.id + '">' +
          '<div class="item-top">' +
            '<div style="min-width:0">' +
              '<h3 class="item-title">' + esc(a.name || '손님') +
                '<span class="tag">' + esc(a.type || '기타') + '</span></h3>' +
              '<p class="item-meta">' + esc(meta || '조건 미기재') + '</p>' +
            '</div>' +
            '<span class="dday' + soon + '">D-' + left + ' 남음</span>' +
          '</div>' +
          (a.memo ? '<p class="item-req">' + esc(a.memo) + '</p>' : '') +
          '<div class="item-actions">' +
            '<button class="btn small line" data-act="restore">진행건으로 복원</button>' +
            '<button class="btn small line" data-act="del" style="color:var(--alert)">삭제</button>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  $('#arcList').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var card = btn.closest('[data-id]');
    var id = card.getAttribute('data-id');
    var a = DB.arc.filter(function (x) { return x.id === id; })[0];
    if (!a) return;

    if (btn.getAttribute('data-act') === 'del') {
      openModal({
        title: '삭제할까요?',
        sub: (a.name || '이 항목') + ' — 보관함에서 완전히 지워집니다.',
        actions: [
          { label: '취소', kind: 'line', onClick: closeModal },
          {
            label: '삭제', kind: 'ghost', onClick: function () {
              DB.arc = DB.arc.filter(function (x) { return x.id !== id; });
              saveArc(); closeModal(); renderArchive(); toast('삭제했습니다');
            }
          }
        ]
      });
      return;
    }

    // 복원
    DB.arc = DB.arc.filter(function (x) { return x.id !== id; });
    saveArc();
    var job = {
      id: uid(),
      name: a.name || '', phone: a.phone || '', dest: a.dest || '',
      date: a.date || '', pax: a.pax || '', type: a.type || '',
      req: a.req || a.memo || '',
      productCode: a.productCode || '', bookingCode: a.bookingCode || '',
      commissionType: a.commissionType || 'pct', commissionValue: a.commissionValue || '',
      commissionMemo: a.commissionMemo || '',
      checklist: a.checklist || emptyChecks(),
      createdAt: Date.now(), updatedAt: Date.now()
    };
    CHECKLIST.forEach(function (c) { if (!job.checklist[c.k]) job.checklist[c.k] = { done: false, date: '', memo: '' }; });
    DB.jobs.unshift(job);
    saveJobs();
    renderArchive();
    renderJobs();
    toast('4섹션으로 복원했습니다');
    showTab('4');
  });

  /* ================= 3섹션 · 안내사항 ================= */
  var NOTICE_DEF = [
    {
      key: 'booking', num: 1, name: '예약처리 안내사항',
      text: [
        '[예약 안내]',
        '',
        '· 위 금액은 견적을 보내 드린 당일 기준 금액이며, 예약하시는 시점에 따라 가격이 변동될 수 있습니다.',
        '· 예약 시 예약자 전원의 이름 · 핸드폰번호 · 성별을 알려 주세요.',
        '· 여권사본은 가능한 한 빨리 카카오톡으로 보내 주세요.',
        '· 예약금은 상품가의 10%입니다.',
        '',
        '델타투어 · 하나투어 공식인증 대리점',
        '박주연 실장 010-9692-5632 · 카카오톡 POK1206'
      ].join('\n')
    },
    {
      key: 'dest', num: 2, name: '도착지별 안내사항', type: 'dest',
      dests: [
        {
          key: 'vn', label: '베트남(다낭·나트랑·푸꾸옥)',
          text: [
            '[베트남 입국 안내]',
            '',
            '· 관광 목적으로 45일까지 무비자 입국이 가능합니다.',
            '· 여권 유효기간이 입국일 기준 6개월 이상 남아 있어야 합니다.',
            '· 일부 공항은 사전입국신고(PAI) QR을 확인하니, 출발 3일 전까지 발급 방법을 안내드립니다.',
            '· 입국신고서는 기내에서 작성해 주시면 됩니다.'
          ].join('\n')
        },
        {
          key: 'th', label: '태국(방콕·푸켓·치앙마이)',
          text: [
            '[태국 입국 안내]',
            '',
            '· 도착 3일 전부터 태국 디지털 입국신고(TDAC, tdac.immigration.go.th)를 작성해야 합니다. (무료)',
            '· 한국 여권은 비자 없이 90일까지 체류가 가능합니다.',
            '· 여권 유효기간 6개월 이상을 권장합니다.'
          ].join('\n')
        },
        {
          key: 'id', label: '인도네시아(발리)',
          text: [
            '[발리 입국 안내]',
            '',
            '· 도착 3일 이내에 All Indonesia 입국신고(allindonesia.imigrasi.go.id)를 작성해 주세요. (무료)',
            '· 발리 관광세 1인 150,000루피아는 Love Bali에서 미리 결제하시면 입국이 빠릅니다.',
            '· 도착비자(e-VOA) 500,000루피아는 온라인 사전 신청이 가능합니다.'
          ].join('\n')
        },
        {
          key: 'ph', label: '필리핀(세부·보라카이)',
          text: [
            '[필리핀 입국 안내]',
            '',
            '· 한국 여권은 비자 없이 30일까지 체류할 수 있습니다.',
            '· 출발 72시간 이내에 eTravel(etravel.gov.ph) 입국신고를 작성해 주세요. (무료)',
            '· 귀국 항공권을 함께 소지하시면 입국 심사가 빠릅니다.'
          ].join('\n')
        },
        {
          key: 'jp', label: '일본',
          text: [
            '[일본 입국 안내]',
            '',
            '· 출발 전 비짓재팬웹(Visit Japan Web)에 여권·입국 정보를 등록하시면 입국 심사가 빠릅니다.',
            '· 일본은 입국 시 여권 유효기간이 남아 있으면 되지만, 6개월 이상을 권장합니다.',
            '· 면세 한도(20만 엔)와 반입 금지 품목을 미리 확인해 주세요.'
          ].join('\n')
        },
        {
          key: 'cn', label: '중국',
          text: [
            '[중국 입국 안내]',
            '',
            '· 단기(30일 이내) 무비자 입국이 가능하지만 정책이 자주 바뀌므로 출발 전에 다시 확인해 드립니다.',
            '· 여권 유효기간 6개월 이상이 필요합니다.',
            '· 입국신고서는 기내에서 작성합니다.'
          ].join('\n')
        },
        {
          key: 'tw', label: '대만',
          text: [
            '[대만 입국 안내]',
            '',
            '· 한국 여권은 비자 없이 90일까지 체류할 수 있습니다.',
            '· 여권 유효기간 6개월 이상을 권장합니다.',
            '· 입국신고서는 기내에서 작성해 주세요.'
          ].join('\n')
        },
        {
          key: 'gu', label: '괌 · 사이판',
          text: [
            '[괌·사이판 입국 안내]',
            '',
            '· 미국령 지역으로 ESTA(전자여행허가) 또는 미국 비자가 반드시 필요합니다.',
            '· ESTA는 출발 최소 72시간 전, 가급적 1주일 전에 신청해 주세요. (미국 국토안보부 공식 사이트만 이용)',
            '· 과거 미국 입국 거절·ESTA 거절 이력이 있으면 ESTA가 승인되지 않을 수 있어 비자 준비가 필요합니다.'
          ].join('\n')
        },
        {
          key: 'eu', label: '유럽',
          text: [
            '[유럽 입국 안내]',
            '',
            '· 셴겐 지역은 180일 중 90일까지 무비자 체류가 가능합니다.',
            '· 여권 유효기간은 출국일 기준 3개월 이상 + 입국일 기준 6개월 이상을 권장합니다.',
            '· ETIAS(입국 사전허가) 시행 여부는 출발 전에 다시 확인해 안내드립니다.'
          ].join('\n')
        }
      ]
    },
    {
      key: 'pay', num: 3, name: '결제 안내사항',
      text: [
        '[결제 안내]',
        '',
        '· 예약금: 상품가의 10% (예약과 함께 결제)',
        '· 잔금: 출발 20일 전까지 결제 (출발이 임박한 상품은 예약 후 따로 안내드립니다)',
        '· 결제 방법: 하나투어 법인계좌(가상계좌) 송금 또는 신용카드',
        '  - 카드 결제는 하나투어 ARS(1577-0015) 또는 하나투어 홈페이지 [예약확인/결제]에서 가능합니다.',
        '· 현금영수증은 여행용역 제공 후 발급됩니다.',
        '· 카드 무이자 할부는 카드사·상품별 조건이 달라 예약 시 확인해 드립니다.'
      ].join('\n')
    },
    {
      key: 'items', num: 4, name: '준비물 안내사항',
      text: [
        '[출발 준비물]',
        '',
        '· 여권 (출발일 기준 유효기간 6개월 이상, 서명 필수)',
        '· 여권사본 1부 (분실 대비)',
        '· 이티켓 · 바우처 (카톡으로 받은 파일을 휴대폰에 저장)',
        '· 유심 또는 eSIM (출발 전 개통 확인)',
        '· 멀티어댑터, 보조배터리(기내 반입만), 상비약',
        '· 환전 (현지 화폐 또는 달러 소액권)',
        '· 항공사 규정에 맞는 캐리어와 기내 가방'
      ].join('\n')
    },
    {
      key: 'final', num: 5, name: '출발 전 최종 안내 · 귀국 감사 인사',
      text: [
        '[출발 전 최종 안내]',
        '',
        '· 집결: 인천공항 제○터미널 ○층 ○○항공 카운터 앞, 출발 2시간 30분 전',
        '· 담당: 델타투어 박주연 실장 010-9692-5632',
        '· 수하물: 위탁 ○○kg / 기내 ○○kg (항공사 규정 확인)',
        '· 기내 액체류는 100ml 이하 용기에 담아 1L 비닐봉투에 넣어 주세요.',
        '· 보조배터리는 기내 반입만 가능하고, 위탁 수하물에는 넣을 수 없습니다.',
        '· 여권 · 이티켓 · 바우처는 몸에 지니고 다녀 주세요.',
        '',
        '즐거운 여행 되세요!',
        '',
        '──────────────',
        '',
        '[귀국 후]',
        '',
        '다녀오시느라 고생 많으셨습니다.',
        '사진 몇 장과 짧은 후기 남겨 주시면 다음 여행 준비에 큰 도움이 됩니다.',
        '다음 여행도 델타투어가 정성껏 준비하겠습니다. 감사합니다.'
      ].join('\n')
    }
  ];

  var selDest = 'vn';
  var openAcc = {};

  function renderNotices() {
    var box = $('#noticeList');
    box.innerHTML = NOTICE_DEF.map(function (def) {
      var isOpen = !!openAcc[def.key];
      var body = '';
      if (def.type === 'dest') {
        var saved = (DB.notices.dest || {});
        var cur = def.dests.filter(function (d) { return d.key === selDest; })[0] || def.dests[0];
        var txt = saved[cur.key] || cur.text;
        body = '' +
          '<div class="dest-chips">' + def.dests.map(function (d) {
            return '<button type="button" class="chip' + (d.key === cur.key ? ' on' : '') + '" data-dest="' + d.key + '">' + esc(d.label) + '</button>';
          }).join('') + '</div>' +
          '<pre class="acc-text" data-body="dest">' + esc(txt) + '</pre>' +
          '<div class="acc-actions">' +
            '<button class="btn small" data-copy="dest">이 내용 복사</button>' +
            '<button class="btn small line" data-edit="dest" data-k="' + cur.key + '">수정</button>' +
            (saved[cur.key] ? '<button class="btn small line" data-reset="dest" data-k="' + cur.key + '">기본값</button>' : '') +
          '</div>';
      } else {
        var custom = typeof DB.notices[def.key] === 'string';
        body = '' +
          '<pre class="acc-text" data-body="' + def.key + '">' + esc(custom ? DB.notices[def.key] : def.text) + '</pre>' +
          '<div class="acc-actions">' +
            '<button class="btn small" data-copy="' + def.key + '">이 내용 복사</button>' +
            '<button class="btn small line" data-edit="' + def.key + '">수정</button>' +
            (custom ? '<button class="btn small line" data-reset="' + def.key + '">기본값</button>' : '') +
          '</div>';
      }
      return '' +
        '<div class="acc' + (isOpen ? ' open' : '') + '" data-key="' + def.key + '">' +
          '<button type="button" class="acc-head" data-toggle="' + def.key + '">' +
            '<span class="acc-num">' + def.num + '</span>' +
            '<span class="acc-name">' + esc(def.name) + (noticeHasCustom(def) ? '<span class="custom-flag">수정됨</span>' : '') + '</span>' +
            '<span class="acc-arrow">▾</span>' +
          '</button>' +
          '<div class="acc-body">' + body + '</div>' +
        '</div>';
    }).join('');
  }

  function noticeHasCustom(def) {
    if (def.type === 'dest') return Object.keys(DB.notices.dest || {}).length > 0;
    return typeof DB.notices[def.key] === 'string';
  }

  $('#noticeList').addEventListener('click', function (e) {
    var t = e.target.closest('[data-toggle]');
    if (t) {
      var k = t.getAttribute('data-toggle');
      openAcc[k] = !openAcc[k];
      renderNotices();
      return;
    }
    var d = e.target.closest('[data-dest]');
    if (d) {
      selDest = d.getAttribute('data-dest');
      renderNotices();
      return;
    }
    var c = e.target.closest('[data-copy]');
    if (c) {
      var body = c.closest('.acc-body').querySelector('[data-body]');
      copyWithToast(body ? body.textContent : '');
      return;
    }
    var ed = e.target.closest('[data-edit]');
    if (ed) {
      var kind = ed.getAttribute('data-edit');
      var bodyEl = ed.closest('.acc-body').querySelector('[data-body]');
      var cur = bodyEl ? bodyEl.textContent : '';
      var dk = ed.getAttribute('data-k') || '';
      openModal({
        title: '안내문 수정',
        sub: '이 기기에 저장되고, 복사할 때 이 내용으로 나갑니다.',
        body: '<div class="field"><textarea id="mNotice" rows="12" style="font-size:14px;line-height:1.65">' + esc(cur) + '</textarea></div>',
        actions: [
          { label: '취소', kind: 'line', onClick: closeModal },
          {
            label: '저장', kind: '', onClick: function () {
              var v = $('#mNotice').value;
              if (kind === 'dest') {
                DB.notices.dest = DB.notices.dest || {};
                DB.notices.dest[dk] = v;
              } else {
                DB.notices[kind] = v;
              }
              set('dt2.notices', DB.notices);
              closeModal(); renderNotices(); toast('저장했습니다');
            }
          }
        ]
      });
      return;
    }
    var rs = e.target.closest('[data-reset]');
    if (rs) {
      var kind2 = rs.getAttribute('data-reset');
      var k2 = rs.getAttribute('data-k') || '';
      if (kind2 === 'dest') {
        if (DB.notices.dest) delete DB.notices.dest[k2];
      } else {
        delete DB.notices[kind2];
      }
      set('dt2.notices', DB.notices);
      renderNotices();
      toast('기본 문구로 돌아갔습니다');
    }
  });

  /* ================= 2섹션 · 견적 ================= */
  var QDEF = {
    url: '', code: '', title: '', adult: '', child: '',
    dep: '', arr: '', airline: '', flight: '', hotel: '',
    note1: '관광과 체험을 중심으로 구성된 알찬 일정입니다.',
    note2: '현지 가이드·기사 경비 USD 40 별도'
  };
  var Q = Object.assign({}, QDEF, DB.quote || {});
  var QFIELDS = { title: 'fTitle', adult: 'fAdult', child: 'fChild', dep: 'fDep', arr: 'fArr', airline: 'fAir', flight: 'fFlight', hotel: 'fHotel', note1: 'fNote1', note2: 'fNote2' };

  function saveQuote() { set('dt2.quote', Q); }

  function fillQuoteFields() {
    Object.keys(QFIELDS).forEach(function (k) {
      var el = $('#' + QFIELDS[k]);
      if (el && document.activeElement !== el) el.value = Q[k] || '';
    });
    renderQuoteOut();
  }

  function renderQuoteOut() {
    $('#quoteOut').textContent = P.buildQuote(Q);
    saveQuote();
  }

  Object.keys(QFIELDS).forEach(function (k) {
    var el = $('#' + QFIELDS[k]);
    if (!el) return;
    el.addEventListener('input', function () {
      var v = el.value;
      if (k === 'adult' || k === 'child') {
        var d = v.replace(/[^0-9]/g, '');
        if (d) { v = Number(d).toLocaleString('ko-KR'); if (el.value !== v) el.value = v; }
      }
      Q[k] = v;
      renderQuoteOut();
    });
    if (k === 'dep' || k === 'arr') {
      el.addEventListener('blur', function () {
        var f = P.formatDateInput(el.value);
        if (f !== el.value) { el.value = f; Q[k] = f; renderQuoteOut(); }
      });
    }
  });

  $('#btnCopyQuote').addEventListener('click', function () {
    copyWithToast(P.buildQuote(Q), '견적서 복사 완료 — 카톡에 붙여넣으세요');
  });

  function setStatus(kind, msg) {
    var el = $('#readStatus');
    el.className = 'status' + (kind ? ' ' + kind : '');
    el.innerHTML = (kind === 'busy' ? '<span class="spin"></span>' : '') + msg;
  }

  function fetchText(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, ctrl ? { signal: ctrl.signal, mode: 'cors', credentials: 'omit' } : { mode: 'cors', credentials: 'omit' })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .catch(function (e) { clearTimeout(timer); throw e; });
  }

  function looksUseful(text) {
    if (!text || text.length < 400) return false;
    var p = P.parseProduct(text);
    var score = 0;
    if (p.adult) score += 2;
    if (p.dep) score += 2;
    if (p.title) score += 1;
    if (p.airline) score += 1;
    return score >= 2 ? p : false;
  }

  function fillFrom(p, code) {
    var got = [];
    ['title', 'adult', 'child', 'dep', 'arr', 'airline', 'flight', 'hotel'].forEach(function (k) {
      if (p[k]) {
        Q[k] = k === 'adult' || k === 'child' ? P.fmt(p[k]) : p[k];
        got.push(k);
      }
    });
    if (p.tip) Q.note2 = p.tip;
    if (code) Q.code = code;
    fillQuoteFields();
  }

  $('#btnRead').addEventListener('click', function () {
    var raw = $('#qUrl').value.trim();
    if (!raw) { setStatus('err', '상품 링크나 상품코드를 먼저 넣어 주세요.'); $('#qUrl').focus(); return; }

    var res = P.resolveInput(raw);
    if (!res) { setStatus('err', '링크 형식을 알아보지 못했습니다. 하나투어 상품 주소를 붙여넣거나 상품코드만 넣어 주세요.'); return; }

    Q.url = res.url;
    Q.code = res.code || Q.code;
    $('#qUrl').value = res.url;
    setStatus('busy', '상품 정보를 읽는 중입니다… (보통 10~30초, 길면 1분)');

    var stages = [
      { name: '상품페이지', url: res.url, ms: 7000 },
      { name: '렌더링 프록시', url: 'https://r.jina.ai/' + res.url, ms: 55000 },
      { name: '프록시', url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(res.url), ms: 18000 }
    ];

    var i = 0;
    function next() {
      if (i >= stages.length) {
        setStatus('err', '하나투어 페이지가 자동 읽기를 막았습니다. 아래 <b>텍스트 붙여넣기</b>를 열어 상품페이지 글자를 복사해 넣어 주세요. (상품코드 ' + (res.code || '미확인') + '는 자동으로 들어갑니다)');
        $('#pasteTool').open = true;
        return;
      }
      var st = stages[i++];
      fetchText(st.url, st.ms).then(function (text) {
        var p = looksUseful(text);
        if (!p) { next(); return; }
        fillFrom(p, res.code);
        var filled = ['title', 'adult', 'dep', 'airline'].filter(function (k) { return Q[k]; }).length;
        setStatus('ok', '상품 정보를 읽었습니다 · 상품코드 <b>' + (res.code || '-') + '</b> · ' + filled + '/4칸 자동 입력. 못 채운 칸은 아래에서 고쳐 주세요.');
        toast('견적 칸을 채웠습니다');
        if (Q.title) $('#fTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(function () { next(); });
    }
    next();
  });

  $('#btnParseText').addEventListener('click', function () {
    var txt = $('#pasteBox').value.trim();
    if (!txt || txt.length < 30) { setStatus('err', '붙여넣은 글이 너무 짧습니다. 상품페이지에서 글자를 전체 선택해 복사해 주세요.'); return; }
    var p = P.parseProduct(txt);
    var code = Q.code;
    var m = /pkgCd=([A-Za-z0-9]+)/i.exec(txt);
    if (m) code = m[1].toUpperCase();
    fillFrom(p, code);
    if (!Q.url && code) {
      var r = P.resolveInput(code);
      if (r) { Q.url = r.url; }
    }
    var filled = ['title', 'adult', 'dep', 'arr', 'airline', 'hotel', 'flight'].filter(function (k) { return Q[k]; });
    if (!filled.length) {
      setStatus('err', '글에서 상품 정보를 찾지 못했습니다. 상품명과 가격이 들어 있는 부분까지 함께 복사해 주세요.');
    } else {
      setStatus('ok', filled.length + '개 항목을 채웠습니다. 틀린 칸은 아래에서 고쳐 주세요.');
      toast('붙여넣은 글에서 채웠습니다');
    }
    renderQuoteOut();
  });

  /* ================= PDF ================= */
  var PDF_W = 794, PDF_H = 1123, PDF_S = 2;

  function wrapLines(ctx, text, maxW, font) {
    ctx.font = font;
    var words = String(text || '').split(/(\s+)/);
    var lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line.replace(/\s+$/, ''));
        line = words[i].replace(/^\s+/, '');
      } else {
        line = test;
      }
    }
    if (line.replace(/\s+$/, '')) lines.push(line.replace(/\s+$/, ''));
    if (!lines.length) lines.push('');
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawQuotePage(pageNo, blocks, isFirst) {
    var c = document.createElement('canvas');
    c.width = PDF_W * PDF_S; c.height = PDF_H * PDF_S;
    var ctx = c.getContext('2d');
    ctx.setTransform(PDF_S, 0, 0, PDF_S, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PDF_W, PDF_H);
    return { canvas: c, ctx: ctx };
  }

  function makePdfPages(q) {
    var M = 54;
    var innerW = PDF_W - M * 2;
    var pages = [];
    var page = null, ctx = null, y = 0;

    function startPage(first) {
      page = drawQuotePage(pages.length + 1, null, first);
      ctx = page.ctx;
      pages.push(page);
      y = 0;
      // header band
      ctx.fillStyle = '#1B2A4A';
      ctx.fillRect(0, 0, PDF_W, first ? 128 : 76);
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '700 24px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      ctx.fillText('DELTA TOUR', M, first ? 62 : 46);
      ctx.font = '600 12px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.fillText('하나투어 공식인증 대리점 · PH05438', M, first ? 84 : 64);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#F7F2E9';
      ctx.font = '700 15px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      ctx.fillText(first ? '여행 견적서' : '여행 견적서 (계속)', PDF_W - M, first ? 58 : 46);
      ctx.font = '500 11px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillText('박주연 실장 · 010-9692-5632', PDF_W - M, first ? 80 : 64);
      ctx.textAlign = 'left';
      y = first ? 158 : 106;
    }

    function need(h) {
      if (!ctx || y + h > PDF_H - 96) startPage(false);
    }

    startPage(true);

    // title
    var titleFont = '800 26px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    var tl = wrapLines(ctx, q.title || '상품 견적', innerW, titleFont);
    need(tl.length * 34 + 10);
    ctx.fillStyle = '#1B2A4A';
    ctx.font = titleFont;
    tl.forEach(function (l) { ctx.fillText(l, M, y + 24); y += 34; });

    // meta line
    var d = new Date();
    var metaTxt = '발행일 ' + d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) + '  ·  대리점 코드 PH05438' + (q.code ? '  ·  상품코드 ' + q.code : '');
    ctx.fillStyle = '#8F897B';
    ctx.font = '500 11.5px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    ctx.fillText(metaTxt, M, y + 8);
    y += 24;

    // divider
    ctx.strokeStyle = '#E6E0D6'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(PDF_W - M, y); ctx.stroke();
    y += 22;

    // rows
    var rows = [];
    if (P.fmt(q.adult)) rows.push(['성인', P.fmt(q.adult) + '원', '(성인 1인)']);
    if (P.fmt(q.child)) rows.push(['아동', P.fmt(q.child) + '원', '(만 12세 미만)']);
    if (q.dep) rows.push(['출발', q.dep, '']);
    if (q.arr) rows.push(['도착', q.arr, '']);
    if (q.airline) rows.push(['항공', q.airline, '']);
    if (q.flight) rows.push(['비행시간', q.flight, '']);
    if (q.hotel) rows.push(['숙소', q.hotel, '']);

    rows.forEach(function (r) {
      need(46);
      ctx.fillStyle = '#8F897B';
      ctx.font = '600 12px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      ctx.fillText(r[0], M, y + 20);
      var isPrice = r[0] === '성인' || r[0] === '아동';
      ctx.fillStyle = '#1B2A4A';
      ctx.font = (isPrice ? '800 19px' : '600 15px') + ' "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      var labelW = 76;
      ctx.fillText(r[1], M + labelW, y + (isPrice ? 22 : 21));
      if (r[2]) {
        var w1 = ctx.measureText(r[1]).width;
        ctx.font = '500 11.5px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
        ctx.fillStyle = '#8F897B';
        ctx.fillText(r[2], M + labelW + w1 + 7, y + 21);
      }
      y += 40;
      ctx.strokeStyle = '#F0EBE2'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(M, y - 1); ctx.lineTo(PDF_W - M, y - 1); ctx.stroke();
    });

    y += 14;

    // notes box
    var notes = [q.note1, q.note2].filter(function (x) { return x && String(x).trim(); });
    if (notes.length) {
      var nf = '500 12.5px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      var noteLines = [];
      notes.forEach(function (n) {
        wrapLines(ctx, '※ ' + String(n).trim(), innerW - 32, nf).forEach(function (l) { noteLines.push(l); });
      });
      var boxH = noteLines.length * 21 + 26;
      need(boxH + 10);
      ctx.fillStyle = '#FBF8F2';
      roundRect(ctx, M, y, innerW, boxH, 10); ctx.fill();
      ctx.strokeStyle = '#EDE4D5'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#4A4F5C';
      ctx.font = nf;
      var ny = y + 24;
      noteLines.forEach(function (l) { ctx.fillText(l, M + 16, ny); ny += 21; });
      y += boxH + 18;
    }

    // deposit box
    var depTxt = '계약금 10% 및 여권사본 카카오톡 전달 요청';
    need(56);
    ctx.fillStyle = '#1B2A4A';
    roundRect(ctx, M, y, innerW, 46, 10); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 14px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    ctx.fillText(depTxt, M + 16, y + 29);
    y += 64;

    // link
    need(40);
    ctx.fillStyle = '#1B2A4A';
    ctx.font = '700 13px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    ctx.fillText('일정표 확인하기  ›', M, y + 16);
    y += 26;
    if (q.url) {
      var urlLines = wrapLines(ctx, q.url, innerW, '500 10.5px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif');
      need(urlLines.length * 15 + 6);
      ctx.fillStyle = '#5C6678';
      ctx.font = '500 10.5px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      urlLines.slice(0, 4).forEach(function (l) { ctx.fillText(l, M, y + 12); y += 15; });
    }

    // footer on each page
    pages.forEach(function (pg) {
      var c2 = pg.ctx;
      var fy = PDF_H - 62;
      c2.strokeStyle = '#E6E0D6'; c2.lineWidth = 1;
      c2.beginPath(); c2.moveTo(M, fy - 14); c2.lineTo(PDF_W - M, fy - 14); c2.stroke();
      c2.fillStyle = '#8F897B';
      c2.font = '600 10.5px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      c2.fillText('DELTA TOUR · 하나투어 공식인증 대리점 · 박주연 실장 010-9692-5632 · 카카오톡 POK1206', M, fy + 4);
      c2.font = '500 10px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      c2.fillText('본 견적은 발행일 기준 금액이며 예약 시점에 따라 변동될 수 있습니다.', M, fy + 22);
    });

    return pages;
  }

  function dataUrlToBytes(dataUrl) {
    var b64 = dataUrl.split(',')[1];
    var bin = atob(b64);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function buildPdf(pages) {
    var enc = new TextEncoder();
    var chunks = [];
    var total = 0;
    var offsets = [];
    function put(bytes) { chunks.push(bytes); total += bytes.length; }
    function puts(s) { put(enc.encode(s)); }

    puts('%PDF-1.4\n');

    var n = pages.length;
    var objects = [];
    // compute object data in order
    var objBodies = [];
    var pageObjNums = [];
    for (var i = 0; i < n; i++) pageObjNums.push(3 + i * 3);

    objBodies[1] = function () {
      puts('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    };
    objBodies[2] = function () {
      var kids = pageObjNums.map(function (x) { return x + ' 0 R'; }).join(' ');
      puts('2 0 obj\n<< /Type /Pages /Kids [' + kids + '] /Count ' + n + ' >>\nendobj\n');
    };
    for (var i2 = 0; i2 < n; i2++) {
      (function (i3) {
        var pageNum = 3 + i3 * 3, imgNum = 4 + i3 * 3, contNum = 5 + i3 * 3;
        objBodies[pageNum] = function () {
          puts(pageNum + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] ' +
            '/Resources << /XObject << /Im0 ' + imgNum + ' 0 R >> /ProcSet [/PDF /ImageC] >> ' +
            '/Contents ' + contNum + ' 0 R >>\nendobj\n');
        };
        objBodies[imgNum] = function () {
          var bytes = pages[i3].bytes;
          puts(imgNum + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + pages[i3].w +
            ' /Height ' + pages[i3].h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + bytes.length + ' >>\nstream\n');
          put(bytes);
          puts('\nendstream\nendobj\n');
        };
        objBodies[contNum] = function () {
          var s = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
          puts(contNum + ' 0 obj\n<< /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream\nendobj\n');
        };
      })(i2);
    }

    var count = 2 + n * 3;
    for (var o = 1; o <= count; o++) {
      offsets[o] = total;
      objBodies[o]();
    }

    var xrefStart = total;
    var xref = 'xref\n0 ' + (count + 1) + '\n0000000000 65535 f \n';
    for (var k = 1; k <= count; k++) {
      xref += ('0000000000' + offsets[k]).slice(-10) + ' 00000 n \n';
    }
    puts(xref);
    puts('trailer\n<< /Size ' + (count + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF\n');

    var out = new Uint8Array(total);
    var pos = 0;
    chunks.forEach(function (ch) { out.set(ch, pos); pos += ch.length; });
    return out;
  }

  function quotePdf() {
    if (!Q.title && !P.fmt(Q.adult)) { toast('견적 내용을 먼저 채워 주세요'); return; }
    try {
      var pages = makePdfPages(Q);
      var packed = pages.map(function (pg) {
        var dataUrl = pg.canvas.toDataURL('image/jpeg', 0.92);
        return { bytes: dataUrlToBytes(dataUrl), w: pg.canvas.width, h: pg.canvas.height };
      });
      var pdf = buildPdf(packed);
      var blob = new Blob([pdf], { type: 'application/pdf' });
      var name = '견적서_' + (Q.title || '상품').replace(/[\\/:*?"<>|]/g, ' ').trim().replace(/\s+/g, '_') + '_' + ymd(new Date()).replace(/-/g, '') + '.pdf';
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
      toast('PDF를 저장했습니다 — 다운로드 폴더를 확인하세요');
    } catch (e) {
      toast('PDF 생성에 실패했습니다: ' + (e && e.message ? e.message : '오류'));
    }
  }
  $('#btnPdf').addEventListener('click', quotePdf);

  /* ================= 데이터 관리 ================= */
  $('#btnData').addEventListener('click', function () {
    openModal({
      title: '데이터 관리',
      sub: '문의 · 진행건 · 보관함 · 안내문 수정본이 모두 이 기기에 저장됩니다. 백업 파일로 옮길 수 있어요.',
      body: '' +
        '<div class="btn-row" style="margin-top:0">' +
          '<button class="btn sub ghost" id="mExport">백업 내보내기</button>' +
          '<button class="btn sub line" id="mImport">백업 불러오기</button>' +
        '</div>' +
        '<input type="file" id="mFile" accept="application/json,.json" hidden>' +
        '<p class="hint">내보낸 JSON 파일을 다른 기기에서 불러오면 그대로 이어서 쓸 수 있습니다.</p>' +
        '<div class="btn-row tight"><button class="btn sub line" id="mWipe" style="color:var(--alert)">진행건·보관함 비우기</button></div>',
      actions: [{ label: '닫기', kind: 'line', onClick: closeModal }]
    });

    $('#mExport').addEventListener('click', function () {
      var data = {
        app: 'deltatour-helper', version: 2, exportedAt: new Date().toISOString(),
        inquiries: DB.inquiries, jobs: DB.jobs, archive: DB.arc, notices: DB.notices, quote: Q
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = '델타투어보조_백업_' + ymd(new Date()).replace(/-/g, '') + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1200);
      toast('백업 파일을 저장했습니다');
    });

    $('#mImport').addEventListener('click', function () { $('#mFile').click(); });
    $('#mFile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var d = JSON.parse(String(fr.result));
          if (Array.isArray(d.inquiries)) DB.inquiries = d.inquiries;
          if (Array.isArray(d.jobs)) DB.jobs = d.jobs;
          if (Array.isArray(d.archive)) DB.arc = d.archive;
          if (d.notices && typeof d.notices === 'object') DB.notices = d.notices;
          saveInq(); saveJobs(); saveArc(); set('dt2.notices', DB.notices);
          renderInquiries(); renderJobs(); renderArchive(); renderNotices();
          closeModal(); toast('백업을 불러왔습니다');
        } catch (err) { toast('백업 파일을 읽지 못했습니다'); }
      };
      fr.readAsText(f);
    });

    $('#mWipe').addEventListener('click', function () {
      openModal({
        title: '진행건·보관함을 비울까요?',
        sub: '문의 목록과 수정한 안내문은 그대로 둡니다. 되돌릴 수 없습니다.',
        actions: [
          { label: '취소', kind: 'line', onClick: function () { closeModal(); $('#btnData').click(); } },
          {
            label: '비우기', kind: 'ghost', onClick: function () {
              DB.jobs = []; DB.arc = [];
              saveJobs(); saveArc();
              renderJobs(); renderArchive(); closeModal(); toast('비웠습니다');
            }
          }
        ]
      });
    });
  });

  /* ================= 시작 ================= */
  function seed() {
    if (DB.seeded) return;
    DB.seeded = true;
    set('dt2.seeded', true);
    if (!DB.jobs.length) {
      var c = emptyChecks();
      c.passport = { done: true, date: ymd(today()), memo: '여권사본 카톡 수령' };
      DB.jobs.push({
        id: uid(), sample: true,
        name: '김진희', phone: '010-0000-0000', dest: '다낭', date: '', pax: '성인2',
        type: '패키지', req: '3박 5일, 5성급, 노쇼핑',
        productCode: 'AVP231270212RSB', bookingCode: '', commissionType: 'pct',
        commissionValue: '', commissionMemo: '', checklist: c,
        createdAt: Date.now(), updatedAt: Date.now()
      });
      saveJobs();
    }
  }

  var purged = purgeExpired();
  seed();
  fillQuoteFields();
  renderInquiries();
  renderJobs();
  renderArchive();
  renderNotices();

  var hash = (location.hash || '').replace('#s', '');
  showTab(/^[1-5]$/.test(hash) ? hash : '1', { noScroll: true });

  if (purged > 0) setTimeout(function () { toast('보관 기한(30일)이 지난 ' + purged + '건을 정리했습니다'); }, 700);

  // 서비스워커
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
