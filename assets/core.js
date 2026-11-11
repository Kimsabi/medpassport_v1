/* 약 여권 시연 — 공통 모듈
 * - 약품 마스터 / 시연용 가상 환자 데이터
 * - QR 페이로드 암호화 (AES-256-GCM, Web Crypto) + Base32 (QR 영숫자 모드)
 * - QR 생성 (qrcode-generator), 카메라 스캔 (BarcodeDetector / jsQR), USB 리더기 입력
 * - localStorage 기반 상태 (같은 브라우저의 탭/창끼리 실시간 동기화)
 *
 * ⚠ 시연용: 암호화 키가 코드에 들어 있습니다. 실제 서비스에서는 서버(KMS/Vault)가 키를 관리합니다.
 */
(function () {
  const MP = (window.MP = {});

  /* ================================================================
   * 1. 약품 마스터 (INN · ATC · 다국어)
   * ================================================================ */
  MP.DRUGS = {
    metformin: { ko: '메트포르민', strength: '500mg', inn: 'Metformin hydrochloride', innShort: 'Metformin HCl', atc: 'A10BA02', cls: '당뇨병 치료제', orig: '메트포르민염산염정', ja: 'メトホルミン塩酸塩', en: 'Metformin HCl', form: '정',
      caution: ['조영제 검사 전후 48시간은 복용을 중단해야 합니다.', '과음 시 젖산산증 위험이 있습니다.'], interact: ['contrast'] },
    amlodipine: { ko: '암로디핀', strength: '5mg', inn: 'Amlodipine besylate', innShort: 'Amlodipine besylate', atc: 'C08CA01', cls: '고혈압 치료제', orig: '암로디핀베실산염정', ja: 'アムロジピンベシル酸塩', en: 'Amlodipine besylate', form: '정',
      caution: ['자몽 주스와 함께 드시지 마세요.', '갑자기 일어설 때 어지러울 수 있어요.'] },
    zolpidem: { ko: '졸피뎀', strength: '5mg', inn: 'Zolpidem tartrate', innShort: 'Zolpidem tartrate', atc: 'N05CF02', cls: '수면제 (향정신성의약품)', orig: '졸피뎀타르타르산염정', ja: 'ゾルピデム酒石酸塩', en: 'Zolpidem tartrate', form: '정',
      caution: ['잠들기 직전에 드세요.', '술과 함께 드시면 위험해요.', '밤에 일어날 때 넘어지지 않게 조심하세요.'], sensitive: true },
    atorvastatin: { ko: '아토르바스타틴', strength: '10mg', inn: 'Atorvastatin calcium', innShort: 'Atorvastatin', atc: 'C10AA05', cls: '고지혈증 치료제', orig: '아토르바스타틴칼슘삼수화물정', ja: 'アトルバスタチンカルシウム', en: 'Atorvastatin calcium', form: '정',
      caution: ['근육통이 심하면 의사와 상의하세요.'] },
    rosuvastatin: { ko: '로수바스타틴', strength: '10mg', inn: 'Rosuvastatin calcium', innShort: 'Rosuvastatin', atc: 'C10AA07', cls: '고지혈증 치료제', orig: '로수바스타틴칼슘정', ja: 'ロスバスタチンカルシウム', en: 'Rosuvastatin calcium', form: '정',
      caution: ['근육통이 심하면 의사와 상의하세요.'] },
    alendronate: { ko: '알렌드론산', strength: '70mg', inn: 'Alendronate sodium', innShort: 'Alendronate', atc: 'M05BA04', cls: '골다공증 치료제', orig: '알렌드론산나트륨정', ja: 'アレンドロン酸ナトリウム', en: 'Alendronate sodium', form: '정',
      caution: ['아침 공복에 물 한 컵과 함께 드세요.', '드신 뒤 30분 동안 눕지 마세요.'] },
    celecoxib: { ko: '세레콕시브', strength: '200mg', inn: 'Celecoxib', innShort: 'Celecoxib', atc: 'M01AH01', cls: '소염진통제', orig: '세레콕시브캡슐', ja: 'セレコキシブ', en: 'Celecoxib', form: '캡슐',
      caution: ['속이 쓰리면 식후에 드세요.'] },
    cetirizine: { ko: '세티리진', strength: '10mg', inn: 'Cetirizine hydrochloride', innShort: 'Cetirizine', atc: 'R06AE07', cls: '알레르기 치료제', orig: '세티리진염산염정', ja: 'セチリジン塩酸塩', en: 'Cetirizine HCl', form: '정',
      caution: ['졸릴 수 있어요.'] },
    esomeprazole: { ko: '에스오메프라졸', strength: '20mg', inn: 'Esomeprazole magnesium', innShort: 'Esomeprazole', atc: 'A02BC05', cls: '위장약', orig: '에스오메프라졸마그네슘삼수화물정', ja: 'エソメプラゾールマグネシウム', en: 'Esomeprazole', form: '정',
      caution: ['아침 식사 30분 전에 드세요.'] },
    aspirin: { ko: '아스피린', strength: '100mg', inn: 'Acetylsalicylic acid', innShort: 'Aspirin', atc: 'B01AC06', cls: '항혈소판제', orig: '아스피린장용정', ja: 'アスピリン', en: 'Aspirin', form: '정',
      caution: ['수술·치과 치료 전에는 꼭 알려주세요.'] },
  };

  MP.FREQ = {
    bid_pc: { ko: '1일 2회 · 아침 · 저녁 식후', short: '1일 2회 · 식후', ja: '1日2回 朝夕食後', en: 'Twice daily after meals', slots: ['아침', '저녁'], perDay: 2 },
    qd_am: { ko: '1일 1회 · 아침 식후', short: '1일 1회 · 아침', ja: '1日1回 朝食後', en: 'Once daily after breakfast', slots: ['아침'], perDay: 1 },
    qd_pm: { ko: '1일 1회 · 저녁 식후', short: '1일 1회 · 저녁', ja: '1日1回 夕食後', en: 'Once daily after dinner', slots: ['저녁'], perDay: 1 },
    qhs: { ko: '1일 1회 · 자기 전', short: '1일 1회 · 취침 전', ja: '1日1回 就寝前', en: 'Once daily at bedtime', slots: ['자기 전'], perDay: 1 },
    qw_am: { ko: '주 1회 · 아침 공복', short: '주 1회 · 공복', ja: '週1回 起床時', en: 'Once weekly on waking', slots: ['아침'], perDay: 1 / 7 },
  };
  MP.SLOT_ORDER = ['아침', '점심', '저녁', '자기 전'];

  MP.ALLERGY = {
    penicillin: { ko: '페니실린계', ja: 'ペニシリン系', en: 'Penicillins' },
    contrast: { ko: '요오드 조영제', ja: 'ヨード造影剤', en: 'Iodinated contrast' },
    nsaid: { ko: '진통소염제(NSAIDs)', ja: 'NSAIDs', en: 'NSAIDs' },
  };
  MP.COND = {
    htn: { ko: '고혈압', ja: '高血圧', en: 'Hypertension' },
    dm2: { ko: '제2형 당뇨', ja: '2型糖尿病', en: 'Type 2 diabetes' },
    insomnia: { ko: '불면증', ja: '不眠症', en: 'Insomnia' },
    osteo: { ko: '골다공증', ja: '骨粗鬆症', en: 'Osteoporosis' },
    dyslip: { ko: '이상지질혈증', ja: '脂質異常症', en: 'Dyslipidemia' },
    gerd: { ko: '역류성 식도염', ja: '逆流性食道炎', en: 'GERD' },
  };

  /* 보호자 공유 (2단계)
   *  ① 복약 현황: 환자가 고른 약들을 '합쳐서' 다 먹었는지만 (하루 단위 기본, 원하면 시간대 단위)
   *  ② 약 상세: 환자가 허용한 약만 이름·함량·복용법·시간대별 복용 여부
   *  상세 공유하지 않은 약은 개수·시간으로도 드러나지 않음
   * 기본값: 복약 현황 켬(하루 단위, 모든 약 포함) / 약 상세 모두 끔 */
  MP.SHARE_LVL = { day: '하루 단위', slot: '시간대 단위' };
  MP.newMedShare = () => ({ share: false, inStatus: true });
  MP.defaultSharing = () => ({ status: true, lvl: 'day' });

  /* ================================================================
   * 2. 날짜 · 유틸
   * ================================================================ */
  const pad = (n) => String(n).padStart(2, '0');
  MP.today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  MP.hhmm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  MP.hhmmss = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  MP.dateStr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  MP.addDays = (dateStr, n) => { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return MP.dateStr(d); };
  MP.daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  MP.age = (birth) => { const b = new Date(birth), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
  MP.mmss = (sec) => `${pad(Math.floor(Math.max(0, sec) / 60))}:${pad(Math.max(0, sec) % 60)}`;
  MP.rid = (n = 8) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, n).toUpperCase();
  MP.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  MP.drugName = (key) => { const d = MP.DRUGS[key]; return d ? `${d.ko} ${d.strength}` : key; };
  MP.remainDays = (med) => Math.max(0, med.days - MP.daysBetween(med.start, MP.today()));

  /* ================================================================
   * 3. 시연용 가상 데이터 (실제 인물 아님)
   * ================================================================ */
  MP.seedElder = () => {
    const t = MP.today();
    return {
      pid: 'PT-004871', name: '김영숙', sex: '여', birth: '1948-03-15', blood: 'A+',
      lives: '독거', region: '서울 ○○구', phone: '010-2345-6789',
      allergies: ['penicillin', 'contrast'],
      conditions: ['htn', 'dm2', 'insomnia'],
      meds: [
        { id: 'm1', drug: 'metformin', freq: 'bid_pc', days: 30, start: MP.addDays(t, -14), rx: 'rx1', share: false, inStatus: true },
        { id: 'm2', drug: 'amlodipine', freq: 'qd_am', days: 30, start: MP.addDays(t, -27), rx: 'rx1', share: false, inStatus: true },
        { id: 'm3', drug: 'zolpidem', freq: 'qhs', days: 14, start: MP.addDays(t, -7), rx: 'rx2', share: false, inStatus: true },
      ],
      rx: [
        { id: 'rx2', org: '마음편한정신건강의학과', pharmacy: '온누리약국', date: MP.addDays(t, -7), count: 1, via: '약국 QR' },
        { id: 'rx1', org: '행복내과의원', pharmacy: '온누리약국', date: MP.addDays(t, -14), count: 2, via: '약국 QR' },
      ],
      emergencyContact: { name: '김민수', rel: '아들', phone: '010-9876-5432' },
      emergencyOpts: { allergy: true, contact: true, meds: true },
      sharing: MP.defaultSharing(),
      guardians: [],
      taken: { date: t, slots: { 'm1@아침': true, 'm2@아침': true } },
      notifications: [],
      accessLog: [
        { ts: Date.now() - 86400000 * 7 - 3600e3 * 3, who: '온누리약국', role: '약사', action: '처방 등록 QR 발급', path: '약국 발급', result: '허용' },
        { ts: Date.now() - 86400000 * 2 - 3600e3 * 5, who: '행복내과의원', role: '의료진', action: '약 목록 열람', path: '실시간 QR', result: '허용' },
      ],
      importedRx: [],
      settings: { mode: null, voice: true },
    };
  };

  MP.seedGuardian = () => {
    const t = MP.today();
    return {
      pid: 'PT-005120', name: '김민수', sex: '남', birth: '1977-06-02', blood: 'O+',
      phone: '010-9876-5432',
      allergies: [], conditions: ['gerd', 'dyslip'],
      meds: [
        { id: 'g1', drug: 'esomeprazole', freq: 'qd_am', days: 28, start: MP.addDays(t, -10), rx: 'grx1', share: false, inStatus: true },
        { id: 'g2', drug: 'rosuvastatin', freq: 'qd_pm', days: 90, start: MP.addDays(t, -40), rx: 'grx2', share: false, inStatus: true },
      ],
      rx: [
        { id: 'grx1', org: '바른속내과', pharmacy: '하나약국', date: MP.addDays(t, -10), count: 1, via: '처방전 촬영' },
        { id: 'grx2', org: '바른속내과', pharmacy: '하나약국', date: MP.addDays(t, -40), count: 1, via: '약국 QR' },
      ],
      emergencyContact: { name: '이지은', rel: '배우자', phone: '010-1111-2222' },
      emergencyOpts: { allergy: true, contact: true, meds: true },
      sharing: MP.defaultSharing(),
      guardians: [], linked: [],
      taken: { date: t, slots: { 'g1@아침': true } },
      notifications: [], accessLog: [], importedRx: [],
      settings: { mode: 'basic', voice: false },
    };
  };

  /* ================================================================
   * 4. 저장소 (localStorage, 같은 브라우저 탭/창 사이 실시간 동기화)
   * ================================================================ */
  const KEY = { elder: 'mp.elder', guardian: 'mp.guardian', audit: 'mp.audit', issued: 'mp.issued', revoked: 'mp.revoked', used: 'mp.used', shown: 'mp.lastShown', revokedLinks: 'mp.revokedLinks', usedLinks: 'mp.usedLinks', ver: 'mp.ver', lastPharmacy: 'mp.lastPharmacy', lastInvite: 'mp.lastInvite' };
  const SCHEMA = 2;
  MP.KEY = KEY;
  const mem = {};
  function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] ?? null; } }
  function rawSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
  function rawDel(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  MP.load = (k, fallback) => { const v = rawGet(k); if (v == null) return typeof fallback === 'function' ? fallback() : fallback; try { return JSON.parse(v); } catch (e) { return typeof fallback === 'function' ? fallback() : fallback; } };
  MP.save = (k, v) => rawSet(k, JSON.stringify(v));

  MP.getPersona = (who) => {
    const k = who === 'guardian' ? KEY.guardian : KEY.elder;
    let p = MP.load(k, null);
    if (!p) { p = who === 'guardian' ? MP.seedGuardian() : MP.seedElder(); MP.save(k, p); }
    if (p.taken?.date !== MP.today()) { p.taken = { date: MP.today(), slots: {} }; MP.save(k, p); }
    return p;
  };
  MP.savePersona = (who, p) => MP.save(who === 'guardian' ? KEY.guardian : KEY.elder, p);

  MP.resetAll = () => { Object.values(KEY).forEach(rawDel); rawSet(KEY.ver, String(SCHEMA)); };
  // 이전 버전 시연 데이터가 남아 있으면 초기화
  if (rawGet(KEY.ver) !== String(SCHEMA)) MP.resetAll();

  MP.onSync = (fn) => window.addEventListener('storage', (e) => { if (!e.key || e.key.startsWith('mp.')) fn(e); });

  /* ---------- 감사 로그 (의료 정보 없이 메타데이터만) ---------- */
  MP.seedAudit = () => {
    const now = Date.now(), m = 60e3;
    const rows = [
      [-412, '[의료진] 행복내과의원', '의료진', 'PT-004871', '약 목록 열람', '실시간 QR', '허용', '10.0.12.41'],
      [-398, '[약사] 온누리약국', '약사', 'PT-003310', '처방 등록 QR 발급', '약국 발급', '허용', '10.0.31.7'],
      [-377, '[의료진] 튼튼정형외과', '의료진', 'PT-002981', '약 목록 열람', '실시간 QR', '허용', '10.0.44.18'],
      [-351, '[보호자] PT-005877', '보호자', 'PT-005870', '복약 현황 조회', '보호자 위임', '허용', '10.0.8.203'],
      [-330, '[응급실] 서울○○병원', '의료진', 'PT-001204', '응급 정보 열람', '응급 QR', '허용', '단말 로컬'],
      [-302, '미인증 요청', '—', 'PT-004660', '토큰 재사용 시도', '실시간 QR', '거부 · 사용된 토큰', '203.0.113.9', true],
      [-301, '미인증 요청', '—', 'PT-004660', '토큰 재사용 시도', '실시간 QR', '거부 · 사용된 토큰', '203.0.113.9', true],
      [-288, '[의료진] 하늘가정의학과', '의료진', 'PT-004660', '약 목록 열람', '실시간 QR', '허용', '10.0.21.5'],
      [-260, '[보호자] PT-003399', '보호자', 'PT-003310', '복약 현황 조회', '보호자 위임', '거부 · 위임 철회됨', '10.0.9.88'],
      [-241, '[약사] 하나약국', '약사', 'PT-002981', '보호자 연결 QR 취소', '약국 발급', '허용', '10.0.33.2'],
      [-215, '[의료진] 행복내과의원', '의료진', 'PT-003310', '약 목록 열람', '실시간 QR', '거부 · 만료 토큰', '10.0.12.41'],
      [-214, '[의료진] 행복내과의원', '의료진', 'PT-003310', '약 목록 열람', '실시간 QR', '허용', '10.0.12.41'],
      [-190, '[보호자] PT-007702', '보호자', 'PT-002981', '보호자 연결', '보호자 위임', '거부 · 지정 보호자 불일치', '10.0.17.54', true],
      [-162, '[환자 본인] PT-001204', '환자', 'PT-001204', '열람 기록 확인', '앱', '허용', '10.0.5.61'],
      [-140, '[의료진] 튼튼정형외과', '의료진', 'PT-005870', '약 목록 열람', '실시간 QR', '허용', '10.0.44.18'],
      [-95, '[감사] 보안 담당', '감사', '—', '접근 기록 CSV 내보내기', '감사 웹', '허용', '10.0.1.2'],
      [-61, '[보호자] PT-005877', '보호자', 'PT-005870', '복약 현황 조회', '보호자 위임', '허용', '10.0.8.203'],
      [-33, '알 수 없는 단말', '—', '—', '위조 코드 스캔', '실시간 QR', '거부 · 복호화 실패', '198.51.100.24', true],
    ];
    return rows.map((r) => ({ ts: now + r[0] * m, who: r[1], role: r[2], pid: r[3], action: r[4], path: r[5], result: r[6], ip: r[7], anomaly: !!r[8] }));
  };
  MP.getAudit = () => { let a = MP.load(KEY.audit, null); if (!a) { a = MP.seedAudit(); MP.save(KEY.audit, a); } return a; };
  MP.addAudit = (row) => { const a = MP.getAudit(); a.push({ ts: Date.now(), ip: '10.0.12.41', ...row }); MP.save(KEY.audit, a); };
  MP.maskIp = (ip) => { if (!ip || !/\d+\.\d+\.\d+\.\d+/.test(ip)) return ip || ''; const p = ip.split('.'); return `${p[0]}.${p[1]}.__.__`; };

  /* ---------- 발급 현황 / 무효화 / 1회용 토큰 ---------- */
  MP.seedIssued = () => {
    const now = Date.now(), h = 3600e3;
    return [
      { id: 'G-7Q2KD9', type: 'G', pid: 'PT-002981', name: '박○○', ts: now - 30 * h, exp: now - 6 * h, status: 'revoked', note: '보호자 변경 요청' },
      { id: 'R-3HX81A', type: 'R', pid: 'PT-003310', name: '이○○', ts: now - 6.6 * h },
      { id: 'G-P0Q7MZ', type: 'G', pid: 'PT-003310', name: '이○○', ts: now - 6.6 * h, exp: now + 17.4 * h, phone: '010-****-1180' },
      { id: 'R-K2V0B5', type: 'R', pid: 'PT-004871', name: '김○○', ts: now - 7 * 24 * h },
    ];
  };
  MP.getIssued = () => { let a = MP.load(KEY.issued, null); if (!a) { a = MP.seedIssued(); MP.save(KEY.issued, a); } return a; };
  MP.addIssued = (row) => { const a = MP.getIssued(); a.unshift({ ts: Date.now(), ...row }); MP.save(KEY.issued, a); };
  MP.getRevoked = () => { const issued = MP.getIssued(); return new Set([...MP.load(KEY.revoked, []), ...issued.filter((x) => x.status === 'revoked').map((x) => x.id)]); };
  MP.revoke = (id, note) => {
    const r = MP.load(KEY.revoked, []); if (!r.includes(id)) r.push(id); MP.save(KEY.revoked, r);
    if (id.startsWith('G-')) { const rl = MP.load(KEY.revokedLinks, []); if (!rl.includes(id)) rl.push(id); MP.save(KEY.revokedLinks, rl); }
    const a = MP.getIssued(); a.forEach((x) => { if (x.id === id) { x.status = 'revoked'; x.note = note || '약국에서 취소'; } }); MP.save(KEY.issued, a);
  };
  MP.markIssuedUsed = (id) => { const a = MP.getIssued(); a.forEach((x) => { if (x.id === id && x.status !== 'revoked') { x.status = 'used'; } }); MP.save(KEY.issued, a); };

  /* ---------- 보호자 지정 번호 (해시로만 QR에 담음) ---------- */
  MP.normPhone = (ph) => String(ph || '').replace(/\D/g, '');
  MP.maskPhone = (ph) => { const d = MP.normPhone(ph); return d.length >= 8 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : ph; };
  MP.phoneHash = async (ph) => {
    const d = new TextEncoder().encode('mp-guardian:' + MP.normPhone(ph));
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', d));
    return Array.from(h.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
  };
  MP.isUsed = (jti) => MP.load(KEY.used, []).includes(jti);
  MP.markUsed = (jti) => { const u = MP.load(KEY.used, []); u.push(jti); MP.save(KEY.used, u.slice(-300)); };

  /* ================================================================
   * 5. 암호화 + Base32 (QR 영숫자 모드 → 더 작은 QR, 리더기 한/영 오류 복구 가능)
   * ================================================================ */
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  MP.b32enc = (bytes) => {
    let bits = 0, val = 0, out = '';
    for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits > 0) out += B32[(val << (5 - bits)) & 31];
    return out;
  };
  MP.b32dec = (str) => {
    const s = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0, val = 0; const out = [];
    for (const c of s) { val = (val << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
    return new Uint8Array(out);
  };

  // 시연용 고정 키 (실서비스: 서버 KMS 관리 / 오프라인 응급 QR은 주기적으로 동기화되는 파생 키)
  const DEMO_KEY_HEX = '6d702d64656d6f2d6b65792d32303236213f9a4c1e77b03d5a2c8e61f4d9b2a7';
  let keyPromise = null;
  function getKey() {
    if (!window.crypto?.subtle) return Promise.reject(new Error('NO_SUBTLE'));
    if (!keyPromise) {
      const raw = new Uint8Array(DEMO_KEY_HEX.match(/../g).map((h) => parseInt(h, 16)));
      keyPromise = crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    }
    return keyPromise;
  }
  MP.cryptoReady = () => !!window.crypto?.subtle;

  // 압축: 첫 바이트 1 = deflate-raw, 0 = 원문 (QR을 작게 만들어 카메라·리더기 인식률 향상)
  async function streamBytes(bytes, Ctor, fmt) {
    const s = new Blob([bytes]).stream().pipeThrough(new Ctor(fmt));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function pack(str) {
    const raw = new TextEncoder().encode(str);
    if (window.CompressionStream) {
      try { const z = await streamBytes(raw, CompressionStream, 'deflate-raw'); if (z.length < raw.length) { const o = new Uint8Array(z.length + 1); o[0] = 1; o.set(z, 1); return o; } } catch (e) {}
    }
    const o = new Uint8Array(raw.length + 1); o[0] = 0; o.set(raw, 1); return o;
  }
  async function unpack(bytes) {
    const body = bytes.slice(1);
    if (bytes[0] === 1) return new TextDecoder().decode(await streamBytes(body, DecompressionStream, 'deflate-raw'));
    return new TextDecoder().decode(body);
  }

  // 형식: MP1.{타입}.{BASE32(iv 12B + 암호문)}   타입: D 진료(실시간) · E 응급 · R 처방 등록 · G 보호자 연결
  MP.TYPE_LABEL = { D: '실시간 QR', E: '응급 QR', R: '처방 등록 QR', G: '보호자 연결 QR' };
  MP.encode = async (type, obj) => {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await pack(JSON.stringify(obj));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('MP1.' + type) }, key, data));
    const all = new Uint8Array(iv.length + ct.length); all.set(iv); all.set(ct, iv.length);
    return `MP1.${type}.${MP.b32enc(all)}`;
  };
  // 반환: { ok, type, data } 또는 { ok:false, reason }
  MP.decode = async (text) => {
    const s = MP.normalizeScan(text);
    const m = /^MP1\.([DERG])\.([A-Z2-7]+)$/.exec(s);
    if (!m) return { ok: false, reason: 'format', raw: s };
    try {
      const key = await getKey();
      const all = MP.b32dec(m[2]);
      const iv = all.slice(0, 12), ct = all.slice(12);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('MP1.' + m[1]) }, key, ct);
      return { ok: true, type: m[1], data: JSON.parse(await unpack(new Uint8Array(pt))) };
    } catch (e) {
      if (e.message === 'NO_SUBTLE') return { ok: false, reason: 'insecure' };
      return { ok: false, reason: 'tamper', type: m[1] };
    }
  };

  /* ---------- USB 리더기가 한글 입력 상태에서 입력했을 때 복구 (두벌식 → 영문) ---------- */
  const JAMO_KEY = { 'ㅂ': 'Q', 'ㅈ': 'W', 'ㄷ': 'E', 'ㄱ': 'R', 'ㅅ': 'T', 'ㅛ': 'Y', 'ㅕ': 'U', 'ㅑ': 'I', 'ㅐ': 'O', 'ㅔ': 'P', 'ㅁ': 'A', 'ㄴ': 'S', 'ㅇ': 'D', 'ㄹ': 'F', 'ㅎ': 'G', 'ㅗ': 'H', 'ㅓ': 'J', 'ㅏ': 'K', 'ㅣ': 'L', 'ㅋ': 'Z', 'ㅌ': 'X', 'ㅊ': 'C', 'ㅍ': 'V', 'ㅠ': 'B', 'ㅜ': 'N', 'ㅡ': 'M', 'ㅃ': 'Q', 'ㅉ': 'W', 'ㄸ': 'E', 'ㄲ': 'R', 'ㅆ': 'T', 'ㅒ': 'O', 'ㅖ': 'P' };
  const CMP = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ', 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ' };
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const jamoToKeys = (j) => (CMP[j] || j).split('').map((x) => JAMO_KEY[x] || '').join('');
  MP.hasHangul = (s) => /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(s);
  MP.normalizeScan = (text) => {
    let out = '';
    for (const ch of String(text).trim()) {
      const c = ch.charCodeAt(0);
      if (c >= 0xac00 && c <= 0xd7a3) {
        const i = c - 0xac00, cho = Math.floor(i / 588), jung = Math.floor((i % 588) / 28), jong = i % 28;
        out += jamoToKeys(CHO[cho]) + jamoToKeys(JUNG[jung]) + (jong ? jamoToKeys(JONG[jong]) : '');
      } else if (/[ㄱ-ㅎㅏ-ㅣ]/.test(ch)) out += jamoToKeys(ch);
      else out += ch;
    }
    return out.toUpperCase().replace(/\s+/g, '');
  };

  /* ================================================================
   * 6. 페이로드 만들기
   * ================================================================ */
  MP.TTL = 300; // 실시간 QR 유효시간(초)

  // 진료용 실시간 QR: 의료진은 전체 처방을 봄 (보호자 공개 범위와 무관 — 안전한 진료를 위해)
  MP.buildClinicalPayload = (p, opts = {}) => {
    const iat = Math.floor(Date.now() / 1000) - (opts.ageSec || 0);
    const orgs = []; const orgIdx = (o) => { let i = orgs.indexOf(o); if (i < 0) { orgs.push(o); i = orgs.length - 1; } return i; };
    return {
      v: 1, j: MP.rid(10), iat, exp: iat + MP.TTL,
      p: { id: p.pid, n: p.name, s: p.sex, b: p.birth, bt: p.blood },
      al: p.allergies, c: p.conditions,
      // [약, 복용법, 처방일, 일수, 처방기관 인덱스]
      m: p.meds.map((m) => [m.drug, m.freq, m.start, m.days, orgIdx((p.rx.find((r) => r.id === m.rx) || {}).org || '')]),
      rx: p.rx.slice(0, 4).map((r) => [r.date, orgIdx(r.org), r.count]),
      o: orgs,
      ec: p.emergencyContact ? [p.emergencyContact.name, p.emergencyContact.rel, p.emergencyContact.phone] : null,
    };
  };
  // 응급 QR: 환자가 고른 항목만 포함
  MP.buildEmergencyPayload = (p, opts, sid) => ({
    v: 1, sid: sid || 'E-' + MP.rid(6), iat: Math.floor(Date.now() / 1000),
    p: { id: p.pid, n: p.name, s: p.sex, b: p.birth, bt: p.blood },
    al: opts.allergy ? p.allergies : null,
    m: opts.meds ? p.meds.map((m) => m.drug) : null,
    c: opts.meds ? p.conditions : null,
    ec: opts.contact && p.emergencyContact ? [p.emergencyContact.name, p.emergencyContact.rel, p.emergencyContact.phone] : null,
  });
  // 보호자 연결 QR: 1회용 · 24시간 · 지정 보호자 번호(해시) 일치 시에만 연결
  // 공유 설정에 맞춰 허용된 정보만 담음 (상세 공유하지 않은 약은 이름·개수·시간 모두 빠짐)
  MP.buildGuardianPayload = (p, g, phoneHash) => {
    const iat = Math.floor(Date.now() / 1000);
    const sh = p.sharing || MP.defaultSharing();
    const inc = p.meds.filter((m) => m.inStatus !== false);
    const slots = MP.SLOT_ORDER.filter((s) => inc.some((m) => MP.FREQ[m.freq].slots.includes(s)));
    return {
      v: 1, lid: g.id, iat, exp: iat + 24 * 3600,
      pid: p.pid, n: p.name, b: p.birth, s: p.sex, rel: g.rel, gt: g.type, gn: g.name,
      gph: phoneHash, gpm: MP.maskPhone(g.phone),
      perm: g.perms,
      st: sh.status && inc.length ? { lvl: sh.lvl, slots: sh.lvl === 'slot' ? slots : null } : null,
      dm: p.meds.filter((m) => m.share).map((m) => [m.drug, m.freq]),
    };
  };

  // 보호자에게 보여줄 요약 (같은 브라우저에서 실시간 계산할 때 사용)
  MP.medDue = (m) => (m.freq === 'qw_am' ? MP.daysBetween(m.start, MP.today()) % 7 === 0 : true);
  MP.guardianSummary = (elder) => {
    const sh = elder.sharing || MP.defaultSharing();
    const taken = (m, s) => !!elder.taken?.slots?.[`${m.id}@${s}`];
    const out = { status: null, details: [] };
    if (sh.status) {
      const inc = elder.meds.filter((m) => m.inStatus !== false && MP.medDue(m));
      const bySlot = {};
      inc.forEach((m) => MP.FREQ[m.freq].slots.forEach((s) => (bySlot[s] = bySlot[s] || []).push(taken(m, s))));
      const all = Object.values(bySlot).flat();
      out.status = { lvl: sh.lvl, any: all.length > 0, done: all.length > 0 && all.every(Boolean),
        slots: MP.SLOT_ORDER.filter((s) => bySlot[s]).map((s) => ({ s, done: bySlot[s].every(Boolean) })) };
    }
    out.details = elder.meds.filter((m) => m.share).map((m) => ({ drug: m.drug, freq: m.freq,
      slots: MP.medDue(m) ? MP.FREQ[m.freq].slots.map((s) => ({ s, done: taken(m, s) })) : [] }));
    return out;
  };

  /* ================================================================
   * 7. QR 렌더링 (SVG)
   * ================================================================ */
  MP.qrSVG = (text, { ecc, margin = 2, dark = '#1F1E1B' } = {}) => {
    // 응급 스티커(종이)는 오염에 강하게 M, 화면에 띄우는 코드는 덜 빽빽하게 L
    const qr = qrcode(0, ecc || (String(text).startsWith('MP1.E.') ? 'M' : 'L'));
    qr.addData(text, /^[0-9A-Z $%*+\-./:]*$/.test(text) ? 'Alphanumeric' : 'Byte');
    qr.make();
    const n = qr.getModuleCount(), size = n + margin * 2;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="${dark}"/></svg>`;
  };

  /* ================================================================
   * 8. 스캐너: 카메라 (BarcodeDetector → jsQR) / USB 리더기(키보드 입력)
   * ================================================================ */
  MP.Camera = function (videoEl, onResult, onStatus) {
    let stream = null, raf = null, stopped = false, detector = null, busy = false;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    const status = (s) => onStatus && onStatus(s);
    async function start(facing = 'environment') {
      stopped = false;
      if (!navigator.mediaDevices?.getUserMedia) { status('이 브라우저(또는 http 주소)에서는 카메라를 쓸 수 없어요. https 주소로 열어주세요.'); return false; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e) { status('카메라 권한이 없어요. 주소창의 카메라 권한을 허용해 주세요.'); return false; }
      videoEl.srcObject = stream; videoEl.setAttribute('playsinline', ''); videoEl.muted = true;
      await videoEl.play().catch(() => {});
      if ('BarcodeDetector' in window) { try { const f = await BarcodeDetector.getSupportedFormats(); if (f.includes('qr_code')) detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) {} }
      status('QR을 네모 안에 맞춰 주세요');
      loop();
      return true;
    }
    async function loop() {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      if (busy || videoEl.readyState < 2) return;
      busy = true;
      try {
        let text = null;
        if (detector) { const r = await detector.detect(videoEl); if (r.length) text = r[0].rawValue; }
        else {
          const w = 720, h = Math.round((videoEl.videoHeight / videoEl.videoWidth) * w) || 540;
          canvas.width = w; canvas.height = h; ctx.drawImage(videoEl, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h); const r = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (r) text = r.data;
        }
        if (text && !stopped) { stop(); onResult(text); }
      } catch (e) {}
      busy = false;
    }
    function stop() { stopped = true; if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; }
    return { start, stop };
  };

  // 이미지 파일에서 QR 읽기 (카메라가 안 될 때 대안)
  MP.decodeImageFile = (file) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'), s = Math.min(1, 1200 / Math.max(img.width, img.height));
      c.width = img.width * s; c.height = img.height * s;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height); const r = jsQR(d.data, c.width, c.height);
      resolve(r ? r.data : null);
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });

  // USB QR 리더기: 키보드처럼 문자열 + Enter 를 입력함
  MP.KeyboardScanner = function (inputEl, onResult, onHangul) {
    let timer = null;
    const flush = () => {
      const v = inputEl.value.trim(); inputEl.value = '';
      if (!v) return;
      if (MP.hasHangul(v) && onHangul) onHangul();
      onResult(v);
    };
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); setTimeout(flush, 40); } });
    inputEl.addEventListener('input', () => {
      clearTimeout(timer);
      if (MP.hasHangul(inputEl.value) && onHangul) onHangul();
      // Enter를 보내지 않는 리더기 대비: 입력이 멈추면 처리
      timer = setTimeout(() => { if (/^MP1/i.test(MP.normalizeScan(inputEl.value)) && inputEl.value.length > 40) flush(); }, 350);
    });
  };

  /* ================================================================
   * 9. 기타 UI 도우미
   * ================================================================ */
  MP.toast = (msg, ms = 2400) => {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
  };
  MP.speak = (text) => {
    try {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 0.92;
      const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith('ko')); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  };

  // DUR(의약품 안전) 점검: 알레르기-약물, 동일 성분군 중복
  MP.durCheck = (drugKeys, allergies = []) => {
    const out = [];
    if (allergies.includes('contrast') && drugKeys.includes('metformin')) out.push({ level: 'warn', text: '요오드 조영제 알레르기 + 메트포르민 복용 중 — 조영제 검사 전후 48시간 메트포르민 중단 검토' });
    if (allergies.includes('nsaid') && drugKeys.some((k) => ['celecoxib', 'aspirin'].includes(k))) out.push({ level: 'danger', text: '진통소염제 알레르기 환자에게 NSAIDs 계열 약 포함' });
    const groups = {};
    drugKeys.forEach((k) => { const d = MP.DRUGS[k]; if (!d) return; const g = d.atc.slice(0, 5); (groups[g] = groups[g] || []).push(d.ko); });
    Object.entries(groups).forEach(([g, list]) => { if (list.length > 1) out.push({ level: 'danger', text: `동일 계열 중복 처방 (ATC ${g}) — ${list.join(', ')}` }); });
    return out;
  };

  // 아이콘 (Lucide 스타일, 직접 그린 SVG path)
  const IC = {
    qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
    tri: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.5M12 17v.01"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    wifi: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.3a5 5 0 0 1 7 0M12 20h.01"/>',
    nowifi: '<path d="M2 2l20 20M8.5 16.3a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 5.2-2.7M14.3 10a10 10 0 0 1 4.7 2.6M2 8.8a15 15 0 0 1 4.6-2.9M10.7 5.1A15 15 0 0 1 22 8.8M12 20h.01"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    pill: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.5 8.5l7 7"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
    speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M6 14h12v7H6z"/>',
    scan: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16M5.5 8h1.5M5.5 11h1.5"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  };
  MP.icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[name] || ''}</svg>`;
})();
