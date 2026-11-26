/* 델타투어 보조 — 하나투어 상품 파서 (순수 함수 모음) */
(function (root) {
  'use strict';

  var AGENT_CODE = 'PH05438';
  var WD = ['일', '월', '화', '수', '목', '금', '토'];

  var DEST = [
    '코타키나발루', '쿠알라룸푸르', '보라카이', '푸꾸옥', '나트랑', '다낭', '호이안', '하노이', '호치민', '달랏', '하롱', '사파',
    '치앙마이', '코사무이', '파타야', '방콕', '푸켓', '세부', '마닐라', '클락', '발리', '자카르타', '인도네시아',
    '싱가포르', '말레이시아', '도쿄', '오사카', '교토', '나라', '후쿠오카', '삿포로', '오키나와', '나고야',
    '간사이', '규슈', '홋카이도', '도야마', '시즈오카', '이시카와', '상하이', '베이징', '북경', '장가계',
    '서안', '청도', '칭다오', '타이베이', '가오슝', '대만', '홍콩', '마카오', '괌', '사이판', '하와이',
    '프랑스', '이탈리아', '스페인', '독일', '체코', '오스트리아', '스위스', '영국', '크로아티아', '그리스',
    '포르투갈', '동유럽', '북유럽', '유럽', '미국', '캐나다', '호주', '뉴질랜드', '두바이', '이집트',
    '터키', '몽골', '미얀마', '라오스', '캄보디아', '인도', '네팔', '일본', '중국', '태국', '베트남', '필리핀'
  ].sort(function (a, b) { return b.length - a.length; });

  var AIRLINES = [
    '대한항공', '아시아나항공', '제주항공', '진에어', '티웨이항공', '에어서울', '에어부산', '이스타항공',
    '에어프레미아', '에어로케이', '에어인천', '플라이강원', '하이에어', '유나이티드항공', '델타항공',
    '아메리칸항공', '전일본공수', '일본항공', '타이항공', '타이에어아시아', '베트남항공', '비엣젯항공',
    '에어아시아', '세부퍼시픽', '필리핀항공', '싱가포르항공', '스쿠트', '캐세이퍼시픽', '중국동방항공',
    '중국국제항공', '중국남방항공', '산동항공', '춘추항공', '에바항공', '중화항공', '홍콩항공',
    '홍콩익스프레스', '라오항공', '미얀마항공', '말레이시아항공', '가루다인도네시아', '터키항공',
    '카타르항공', '에미레이트', '루프트한자', '에어프랑스', '영국항공', '핀에어', '하와이안항공',
    '에어캐나다', '콴타스', '뉴질랜드항공', '젯스타', '에어뉴질랜드', '파라타항공', '트리니티항공'
  ].sort(function (a, b) { return b.length - a.length; });

  function digits(v) { return String(v == null ? '' : v).replace(/[^0-9]/g, ''); }
  function pad2(n) { return ('0' + n).slice(-2); }

  /* ---------- URL / 상품코드 ---------- */
  function normalizeUrl(raw) {
    var url = String(raw || '').trim();
    if (!url) return '';
    try {
      var u = new URL(url);
      u.searchParams.set('ptnCd', AGENT_CODE);
      return u.toString();
    } catch (e) {
      if (/ptnCd=/i.test(url)) return url.replace(/ptnCd=[^&]*/i, 'ptnCd=' + AGENT_CODE);
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'ptnCd=' + AGENT_CODE;
    }
  }

  function resolveInput(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    var code = '';
    var url = s;

    if (!/^https?:\/\//i.test(s)) {
      if (/^[A-Za-z]{2,4}[0-9][A-Za-z0-9]{6,}$/.test(s)) {
        code = s.toUpperCase();
        url = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=' + code + '&type=A';
      } else if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$|\?)/i.test(s)) {
        url = 'https://' + s;
      } else {
        return null;
      }
    }

    try {
      var u = new URL(url);
      var q = u.searchParams.get('pkgCd') || u.searchParams.get('pkgcd') || u.searchParams.get('prodCd');
      if (q) code = q.toUpperCase();
      if (!code) {
        var m = /\/(?:product|pkg|goods)\/([A-Za-z0-9]{8,})/i.exec(u.pathname);
        if (m) code = m[1].toUpperCase();
      }
      if (!code) {
        var m2 = /(?:^|[/?&=])([A-Z]{2,4}[0-9]{6,}[A-Z0-9]*)(?:$|[&#?])/i.exec(u.pathname + u.search);
        if (m2) code = m2[1].toUpperCase();
      }
      u.searchParams.set('ptnCd', AGENT_CODE);
      url = u.toString();
    } catch (e) {
      var m3 = /pkgCd=([A-Za-z0-9]+)/i.exec(s);
      if (m3) code = m3[1].toUpperCase();
      url = normalizeUrl(url);
    }

    return { url: url, code: code || '' };
  }

  /* ---------- 텍스트 정리 ---------- */
  function cleanText(raw) {
    var s = String(raw || '');
    s = s.replace(/\r\n?/g, '\n');
    s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    s = s.replace(/\*\*|__/g, '');
    s = s.replace(/[ \t\u00a0\u200b]+/g, ' ');
    return s;
  }

  function titleCase(s) { return String(s || '').trim(); }

  /* ---------- 가격 ---------- */
  var BAD_PREV = /(유류할증료|제세공과금|할부|마일리지|취소료|위약금|보험료|팁|옵션|선택경비|추가요금|1인객실|싱글차지)\s*[:：]?\s*$/;

  function findPrices(txt) {
    var startIdx = txt.indexOf('상품가격');
    if (startIdx < 0) startIdx = txt.indexOf('기본상품');
    if (startIdx < 0) return {};
    var block = txt.slice(startIdx, startIdx + 1200);

    var re = /([0-9][0-9,]{2,})\s*원/g;
    var out = [];
    var m;
    while ((m = re.exec(block)) !== null) {
      var before = block.slice(Math.max(0, m.index - 16), m.index);
      if (BAD_PREV.test(before)) continue;
      var v = Number(digits(m[1]));
      if (!v) continue;
      out.push(v);
      if (out.length >= 3) break;
    }
    var res = {};
    if (out[0]) res.adult = out[0];
    if (out[1]) res.child = out[1];
    if (out[2]) res.infant = out[2];

    // 라벨이 붙은 형태: "성인 819,000원"
    if (!res.adult) {
      var ma = /성인[^\n]{0,24}?([0-9][0-9,]{2,})\s*원/.exec(txt);
      if (ma) res.adult = Number(digits(ma[1]));
    }
    if (!res.child) {
      var mc = /아동[^\n]{0,24}?([0-9][0-9,]{2,})\s*원/.exec(txt);
      if (mc) res.child = Number(digits(mc[1]));
    }
    return res;
  }

  /* ---------- 날짜·시간 ---------- */
  function dateTimeFrom(line) {
    var out = [];
    var re = /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})\s*\(?([월화수목금토일])?\)?[^0-9]{0,12}?(\d{1,2}):(\d{2})/g;
    var m;
    while ((m = re.exec(line)) !== null) {
      var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      var dt = new Date(y, mo - 1, d);
      var wd = m[4] || WD[dt.getDay()];
      out.push({
        date: y + '.' + pad2(mo) + '.' + pad2(d),
        wd: wd,
        time: pad2(Number(m[5])) + ':' + m[6],
        text: y + '.' + pad2(mo) + '.' + pad2(d) + '(' + wd + ') ' + pad2(Number(m[5])) + ':' + m[6]
      });
    }
    return out;
  }

  function findLine(txt, label) {
    var re = new RegExp('(?:^|\\n)\\s*' + label + '\\s*[:：]', 'm');
    var m = re.exec(txt);
    if (!m) {
      re = new RegExp(label + '\\s*[:：]\\s*([^\\n]{0,160})');
      m = re.exec(txt);
      if (!m) return '';
      return m[1];
    }
    var rest = txt.slice(m.index + m[0].length, m.index + m[0].length + 180);
    return rest.split('\n')[0];
  }

  function findFlightTime(txt) {
    var m = /총\s*(\d{1,2})\s*시간\s*(\d{1,2})\s*분/.exec(txt);
    if (m) {
      var h = Number(m[1]), mm = Number(m[2]);
      if (h && mm) return '약 ' + h + '시간 ' + mm + '분';
      if (h) return '약 ' + h + '시간';
      if (mm) return '약 ' + mm + '분';
    }
    m = /(\d{1,2})\s*시간\s*(\d{1,2})\s*분\s*소요/.exec(txt);
    if (m) {
      var h2 = Number(m[1]), mm2 = Number(m[2]);
      if (h2 && mm2) return '약 ' + h2 + '시간 ' + mm2 + '분';
    }
    return '';
  }

  /* ---------- 항공사 ---------- */
  function findAirline(txt, around) {
    var seg = around || txt.slice(0, 3000);
    for (var i = 0; i < AIRLINES.length; i++) {
      if (seg.indexOf(AIRLINES[i]) >= 0) return AIRLINES[i];
    }
    var m = /([가-힣]{2,10}항공)/.exec(seg);
    if (m && !/^(현지|국내|국제|해외|왕복|편도|항공)/.test(m[1])) return m[1];
    return '';
  }

  /* ---------- 숙소 ---------- */
  function findHotel(txt) {
    var m = /([0-9])\s*성급/.exec(txt);
    if (m) return m[1] + '성급 호텔';
    var lines = txt.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].replace(/^[\s|*\-•]+/, '').trim();
      if (l.length < 8 || l.length > 60) continue;
      if (!/(호텔|리조트|풀빌라)/.test(l)) continue;
      if (/(추가|문의|별도|불가|변동|예정 호텔 리스트|섭외)/.test(l)) continue;
      if (/(결제|보험|카드|항공|면세|취소)/.test(l)) continue;
      return l.replace(/\s+/g, ' ').slice(0, 40);
    }
    return '';
  }

  /* ---------- 여행지·기간 ---------- */
  function findDest(txt) {
    var head = txt.slice(0, 2500);
    for (var i = 0; i < DEST.length; i++) {
      if (head.indexOf(DEST[i]) >= 0) return DEST[i];
    }
    return '';
  }

  function findDays(txt) {
    var m = /(\d{1,2})\s*박\s*(\d{1,2})\s*일/.exec(txt);
    if (m) return m[1] + '박 ' + m[2] + '일';
    m = /(\d{1,2})\s*일\s*(?:간|#|$|\n)/.exec(txt);
    if (m) return m[1] + '일';
    return '';
  }

  function findTitleLine(txt) {
    var lines = txt.split('\n');
    var best = '';
    for (var i = 0; i < Math.min(lines.length, 40); i++) {
      var l = lines[i].replace(/^[\s#>|\-*]+/, '').trim();
      if (!l || l.length > 90) continue;
      if (/^(Title|URL Source|Markdown Content|Published Time|Warning)\s*:/i.test(l)) continue;
      if (/하나투어\s*:\s*꿈꾸는/.test(l)) continue;
      if (/(박\s*\d+일|\d+일)/.test(l) && !/(http|로그인|회원가입|검색)/.test(l)) {
        if (l.length > best.length) best = l;
      }
    }
    return best;
  }

  function findTip(txt) {
    var m = /(?:현지\s*)?(?:투어매니저|가이드|기사)[^\n]{0,14}경비\s*[:：]?\s*[^\n]{0,40}?((?:USD|JPY|EUR|VND|THB|TWD|CNY|SGD|HKD)\s?[0-9,]+|[0-9,]+\s*(?:달러|엔|원))/i.exec(txt);
    if (m) return '현지 가이드·기사 경비 ' + m[1].replace(/\s+/g, ' ').trim() + ' 별도';
    return '';
  }

  function parseProduct(raw) {
    var txt = cleanText(raw);
    var res = {};

    var p = findPrices(txt);
    res.adult = p.adult || 0;
    res.child = p.child || 0;
    res.infant = p.infant || 0;

    var depLine = findLine(txt, '출발');
    var arrLine = findLine(txt, '도착');
    var depList = dateTimeFrom(depLine);
    var arrList = dateTimeFrom(arrLine);
    res.dep = depList.length ? depList[0].text : '';
    res.arr = arrList.length ? arrList[arrList.length - 1].text : '';

    res.flight = findFlightTime(depLine) || findFlightTime(txt.slice(0, 4000));
    res.airline = findAirline(txt, depLine ? txt.slice(Math.max(0, txt.indexOf(depLine) - 700), txt.indexOf(depLine) + 400) : '');

    res.hotel = findHotel(txt);
    res.dest = findDest(txt);
    res.days = findDays(txt);
    res.titleLine = findTitleLine(txt);
    res.tip = findTip(txt);

    var t = res.titleLine || '';
    var short = res.dest && res.days ? (res.dest + ' ' + res.days) : (t ? t.split('#')[0].replace(/\s+/g, ' ').trim().slice(0, 30) : '');
    res.title = short;
    return res;
  }

  /* ---------- 견적 문구 ---------- */
  function fmt(n) {
    var v = Number(String(n == null ? '' : n).replace(/[^0-9]/g, ''));
    return v ? v.toLocaleString('ko-KR') : '';
  }

  function buildQuote(q) {
    var L = [];
    L.push('■ ' + (q.title || '상품명'));
    if (fmt(q.adult)) L.push('성인: ' + fmt(q.adult) + '원 (성인 1인)');
    if (fmt(q.child)) L.push('아동: ' + fmt(q.child) + '원 (만 12세 미만)');
    if (q.dep) L.push('출발: ' + q.dep);
    if (q.arr) L.push('도착: ' + q.arr);
    if (q.airline) L.push('항공: ' + q.airline);
    if (q.flight) L.push('비행시간: ' + q.flight);
    if (q.hotel) L.push('숙소: ' + q.hotel);
    var notes = [q.note1, q.note2].filter(function (x) { return x && String(x).trim(); });
    if (notes.length) {
      L.push('');
      notes.forEach(function (n) {
        var s = String(n).trim();
        L.push(/^※/.test(s) ? s : '※ ' + s);
      });
    }
    L.push('');
    L.push('계약금 10% 및 여권사본 카카오톡 전달 요청');
    L.push('');
    L.push('일정표 확인하기 >>');
    if (q.url) L.push(q.url);
    return L.join('\n');
  }

  /* ---------- 날짜 표기 도우미 ---------- */
  function formatDateInput(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    var m = /^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})(?:\s*(?:\(([월화수목금토일])\))?\s*(\d{1,2}):(\d{2}))?$/.exec(s);
    if (!m) return s;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    var wd = m[4] || WD[d.getDay()];
    var out = m[1] + '.' + pad2(m[2]) + '.' + pad2(m[3]) + '(' + wd + ')';
    if (m[5] != null) out += ' ' + pad2(Number(m[5])) + ':' + m[6];
    return out;
  }

  var api = {
    AGENT_CODE: AGENT_CODE,
    WD: WD,
    resolveInput: resolveInput,
    normalizeUrl: normalizeUrl,
    cleanText: cleanText,
    parseProduct: parseProduct,
    buildQuote: buildQuote,
    formatDateInput: formatDateInput,
    findPrices: findPrices,
    fmt: fmt
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DTParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
