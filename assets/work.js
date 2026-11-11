/* 약 여권 — 업무용 웹 (약국 · 진료 · 감사) */
(function () {
  const I = MP.icon, esc = MP.esc;
  const A = (window.W = {});
  const D = (k) => MP.DRUGS[k];
  const TABS = { pharmacy: '약국', clinic: '진료', audit: '감사' };
  let TAB = (location.hash || '#clinic').slice(1); if (!TABS[TAB]) TAB = 'clinic';

  const ORG = { pharmacy: '온누리약국', clinic: '행복내과의원' };

  /* ================================================================
   * 상단 바
   * ================================================================ */
  function renderTop() {
    const right = {
      pharmacy: `<span class="chip primary badge">약사 인증 · 처방 발급 권한</span><span class="acct">[약사 계정] ${ORG.pharmacy}</span>`,
      clinic: `<span class="row" id="readerStat"></span><span class="acct">[의료진 계정] ${ORG.clinic} 진료실</span>`,
      audit: `<span class="chip ok badge">읽기 전용</span><span class="chip ok badge">FIDO2 인증됨 · IP 허용 목록</span><span class="acct">[감사 계정] · 세션 <span id="sess">27:00</span> 남음</span>`,
    }[TAB];
    document.getElementById('wtop').innerHTML = `
      <div class="brand">${I(TAB === 'audit' ? 'shield' : 'sidebar', 'lg')} 약 여권 · 업무용 웹</div>
      <nav class="tabs">${Object.entries(TABS).map(([k, t]) => `<a href="#${k}" class="${TAB === k ? 'on' : ''}">${t}</a>`).join('')}</nav>
      <span class="sp"></span>${right}
      <a class="btn sm" href="index.html">처음</a>`;
  }

  let cleanup = [];
  function render() {
    cleanup.forEach((f) => { try { f(); } catch (e) {} }); cleanup = [];
    renderTop();
    document.title = `약 여권 · ${TABS[TAB]}`;
    ({ pharmacy: renderPharmacy, clinic: renderClinic, audit: renderAudit })[TAB]();
    if (!MP.cryptoReady()) MP.toast('⚠ https 주소(또는 localhost)에서 열어야 QR 암호화가 동작해요', 6000);
  }
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TABS[t]) { TAB = t; render(); window.scrollTo(0, 0); } });

  function modal(html, wide) { document.getElementById('modal-root').innerHTML = `<div class="modal-back" onclick="if(event.target===this)W.closeModal()"><div class="modal" style="${wide ? 'max-width:760px' : ''}">${html}</div></div>`; }
  A.closeModal = () => (document.getElementById('modal-root').innerHTML = '');

  function notifyPatient(pid, text, logRow) {
    const e = MP.load(MP.KEY.elder, null);
    if (!e || e.pid !== pid) return;
    e.notifications = e.notifications || [];
    e.notifications.push({ ts: Date.now(), text, read: false });
    if (logRow) e.accessLog.push({ ts: Date.now(), ...logRow });
    MP.save(MP.KEY.elder, e);
  }

  /* ================================================================
   * 1. 약국: 처방 입력 → 공개 범위 → 안내지(QR) 발급 / 발급 현황·무효화
   * ================================================================ */
  let PH = null;
  function freshPH() {
    const e = MP.getPersona('elder');
    return {
      sub: 'issue', verified: false, org: '행복내과의원', date: MP.today(),
      items: [{ drug: 'atorvastatin', freq: 'qd_pm', days: 30, vis: MP.DEFAULT_VIS, isNew: true }]
        .concat(e.meds.map((m) => ({ drug: m.drug, freq: m.freq, days: m.days, vis: m.vis || MP.DEFAULT_VIS, isNew: false }))),
      guardian: { on: false, type: 'family', name: '김민수', rel: '아들', status: true, emergencyQR: true },
      sticker: { on: true, allergy: true, contact: true, meds: true },
      out: null,
    };
  }
  const FREQ_OPTS = Object.entries(MP.FREQ).map(([k, f]) => [k, f.short]);

  function renderPharmacy() {
    if (!PH) PH = freshPH();
    const main = document.getElementById('main');
    const subtabs = `<div class="seg noprint" style="margin-bottom:18px"><button class="${PH.sub === 'issue' ? 'on' : ''}" onclick="W.phSub('issue')">처방 등록 · 안내지 발급</button><button class="${PH.sub === 'list' ? 'on' : ''}" onclick="W.phSub('list')">발급 현황 · 무효화</button></div>`;
    if (PH.sub === 'list') { main.innerHTML = subtabs + issuedList(); return; }
    const e = MP.getPersona('elder');
    const dur = MP.durCheck(PH.items.map((i) => i.drug), e.allergies);
    main.innerHTML = `${subtabs}
      <div class="grid2">
        <div class="stack noprint">
          <div class="card">
            <div class="between"><h3 class="h-sec" style="margin:0">${I('user')} 환자</h3><span class="mono faint">${e.pid}</span></div>
            <div class="row" style="margin-top:12px;gap:16px"><div class="photo" style="width:64px;height:64px">사진</div>
              <div class="grow"><div style="font-size:20px;font-weight:800">${esc(e.name)} <span class="sub" style="font-weight:400">${e.sex} · ${MP.age(e.birth)}세 · ${e.birth}</span></div>
              <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">${e.allergies.map((a) => `<span class="chip danger">${MP.ALLERGY[a].ko}</span>`).join('')}<span class="chip">${esc(e.lives)}</span></div></div></div>
            <label class="check" style="margin-top:14px"><input type="checkbox" ${PH.verified ? 'checked' : ''} onchange="W.ph('verified',this.checked)"> 신분증으로 본인 확인했어요</label>
          </div>

          <div class="card">
            <h3 class="h-sec">${I('doc')} 처방 내용</h3>
            <div class="row" style="gap:12px"><label class="field grow"><span>처방 기관</span><input class="input" value="${esc(PH.org)}" onchange="W.ph('org',this.value)"></label><label class="field" style="width:170px"><span>처방일</span><input class="input mono" type="date" value="${PH.date}" onchange="W.ph('date',this.value)"></label></div>
            <div style="margin-top:16px">
              <div class="medrow head"><span>약품</span><span>복용법</span><span>일수</span><span>보호자 공개 범위</span><span></span></div>
              ${PH.items.map((it, i) => `<div class="medrow">
                <span>${it.isNew ? `<select class="input" onchange="W.phItem(${i},'drug',this.value)">${Object.keys(MP.DRUGS).map((k) => `<option value="${k}" ${k === it.drug ? 'selected' : ''}>${MP.drugName(k)}</option>`).join('')}</select>` : `<b style="font-size:14px">${MP.drugName(it.drug)}</b>${D(it.drug).sensitive ? ' <span class="chip warn" style="font-size:11px;padding:1px 6px">민감</span>' : ''}<div class="faint" style="font-size:12px">기존 복용</div>`}</span>
                <span>${it.isNew ? `<select class="input" onchange="W.phItem(${i},'freq',this.value)">${FREQ_OPTS.map(([k, t]) => `<option value="${k}" ${k === it.freq ? 'selected' : ''}>${t}</option>`).join('')}</select>` : `<span class="sub">${MP.FREQ[it.freq].short}</span>`}</span>
                <span>${it.isNew ? `<input class="input mono" type="number" min="1" value="${it.days}" onchange="W.phItem(${i},'days',+this.value)">` : `<span class="sub mono">${it.days}</span>`}</span>
                <span><select class="input" onchange="W.phItem(${i},'vis',this.value)">${Object.entries(MP.VIS).map(([k, v]) => `<option value="${k}" ${k === it.vis ? 'selected' : ''}>${v.label}</option>`).join('')}</select></span>
                <span>${it.isNew ? `<button class="x" onclick="W.phDel(${i})" title="삭제">${I('x')}</button>` : ''}</span></div>`).join('')}
              <button class="btn sm" style="margin-top:10px" onclick="W.phAdd()">${I('plus')} 약 추가</button>
            </div>
            ${dur.length ? `<div class="stack" style="margin-top:14px">${dur.map((d) => `<div class="alert ${d.level === 'warn' ? 'warn' : ''}">${I('tri')}<span><b>DUR</b> · ${esc(d.text)}</span></div>`).join('')}</div>` : `<div class="alert ok" style="margin-top:14px">${I('check')}<span>DUR 점검: 중복·금기 없음</span></div>`}
            <div class="notice" style="display:flex;gap:10px;margin-top:14px;padding:12px 14px;background:var(--primary-weak);border-radius:12px;color:var(--primary-2);font-size:14px">${I('eye')}<span><b>공개 범위는 어르신과 함께 정해 주세요.</b> 기본값은 '복약 여부만'이에요. 의료진은 이 설정과 관계없이 진료용 QR로 전체 처방을 봐요.</span></div>
          </div>

          <div class="card">
            <label class="check" style="font-weight:700"><input type="checkbox" ${PH.guardian.on ? 'checked' : ''} onchange="W.phG('on',this.checked)"> 보호자 연결 QR도 함께 출력 <span class="sub" style="font-weight:400">(선택 · 어르신이 원할 때만)</span></label>
            ${PH.guardian.on ? `<div class="stack" style="margin-top:12px;padding-left:28px">
              <div class="seg"><button class="${PH.guardian.type === 'family' ? 'on' : ''}" onclick="W.phGType('family')">가족</button><button class="${PH.guardian.type === 'care' ? 'on' : ''}" onclick="W.phGType('care')">보건소 돌봄 담당자</button></div>
              <div class="row" style="gap:12px"><label class="field grow"><span>보호자 이름</span><input class="input" value="${esc(PH.guardian.name)}" onchange="W.phG('name',this.value)"></label><label class="field grow"><span>관계</span><input class="input" value="${esc(PH.guardian.rel)}" onchange="W.phG('rel',this.value)"></label></div>
              <label class="check"><input type="checkbox" ${PH.guardian.status ? 'checked' : ''} onchange="W.phG('status',this.checked)"> 오늘 복약 현황 보기</label>
              <label class="check"><input type="checkbox" ${PH.guardian.emergencyQR ? 'checked' : ''} onchange="W.phG('emergencyQR',this.checked)"> 응급 QR 대신 보여주기 <span class="sub">(보호자도 내용은 못 보는 암호화 QR)</span></label>
              ${PH.guardian.type === 'care' ? '<div class="sub">가족이 없는 어르신은 보건소 방문간호·돌봄 담당자를 보호자로 연결할 수 있어요.</div>' : ''}
            </div>` : ''}
          </div>

          <div class="card">
            <label class="check" style="font-weight:700"><input type="checkbox" ${PH.sticker.on ? 'checked' : ''} onchange="W.phS('on',this.checked)"> 응급 QR 스티커 출력 <span class="sub" style="font-weight:400">(종이 약수첩·지갑용)</span></label>
            ${PH.sticker.on ? `<div style="margin-top:10px;padding-left:28px" class="stack">
              <div class="sub">스티커에 넣을 정보는 어르신이 고르세요.</div>
              <div class="row" style="gap:18px;flex-wrap:wrap">
                <label class="check"><input type="checkbox" ${PH.sticker.allergy ? 'checked' : ''} onchange="W.phS('allergy',this.checked)"> 알레르기</label>
                <label class="check"><input type="checkbox" ${PH.sticker.contact ? 'checked' : ''} onchange="W.phS('contact',this.checked)"> 보호자 연락처</label>
                <label class="check"><input type="checkbox" ${PH.sticker.meds ? 'checked' : ''} onchange="W.phS('meds',this.checked)"> 복용 약 · 기저질환</label>
              </div></div>` : ''}
          </div>

          <button class="btn primary lg block" ${PH.verified ? '' : 'disabled'} onclick="W.issue()">${I('qr')} 안내지 만들기</button>
          ${PH.verified ? '' : '<div class="sub" style="text-align:center">본인 확인을 먼저 체크해 주세요</div>'}
        </div>
        <div class="sticky print-target" id="paperCol">${PH.out ? paperHTML(PH.out) : `<div class="paper-empty">${I('printer', 'xl')}<div style="margin-top:12px;font-size:17px;font-weight:700;color:var(--text)">안내지 미리보기</div><div style="margin-top:6px">왼쪽을 채우고 '안내지 만들기'를 누르면<br>어르신께 드릴 QR 안내지가 여기에 나와요.</div></div>`}</div>
      </div>`;
  }
  A.phSub = (s) => { PH.sub = s; render(); };
  A.ph = (k, v) => { PH[k] = v; PH.out = null; render(); };
  A.phItem = (i, k, v) => { PH.items[i][k] = v; PH.out = null; render(); };
  A.phDel = (i) => { PH.items.splice(i, 1); PH.out = null; render(); };
  A.phAdd = () => { PH.items.splice(PH.items.filter((x) => x.isNew).length, 0, { drug: 'aspirin', freq: 'qd_am', days: 30, vis: MP.DEFAULT_VIS, isNew: true }); PH.out = null; render(); };
  A.phG = (k, v) => { PH.guardian[k] = v; PH.out = null; render(); };
  A.phGType = (t) => { PH.guardian.type = t; if (t === 'care') { PH.guardian.name = '박○○ 간호사'; PH.guardian.rel = '○○구 보건소 방문간호'; } else { PH.guardian.name = '김민수'; PH.guardian.rel = '아들'; } PH.out = null; render(); };
  A.phS = (k, v) => { PH.sticker[k] = v; PH.out = null; render(); };

  A.issue = async () => {
    const e = MP.getPersona('elder');
    const now = Math.floor(Date.now() / 1000);
    const newItems = PH.items.filter((x) => x.isNew);
    const rid = 'R-' + MP.rid(6);
    // 이 처방을 반영한 환자 상태(약국 기준 스냅샷)
    const snap = { ...e, meds: PH.items.map((it, i) => ({ id: 'p' + i, drug: it.drug, freq: it.freq, days: it.days, start: it.isNew ? PH.date : MP.today(), vis: it.vis })), emergencyContact: e.emergencyContact };
    const out = { rid, date: PH.date, org: PH.org, newItems, sticker: PH.sticker.on ? { ...PH.sticker } : null, guardian: PH.guardian.on ? { ...PH.guardian } : null };
    let g = null;
    if (PH.guardian.on) g = { id: 'G-' + MP.rid(6), name: PH.guardian.name, rel: PH.guardian.rel, type: PH.guardian.type, perms: { status: PH.guardian.status, emergencyQR: PH.guardian.emergencyQR } };
    const stickerOpts = { allergy: PH.sticker.allergy, contact: PH.sticker.contact, meds: PH.sticker.meds };
    const sid = 'E-' + MP.rid(6);
    try {
      out.R = await MP.encode('R', { v: 1, rid, iat: now, ph: ORG.pharmacy, org: PH.org, date: PH.date, pid: e.pid, n: e.name, items: PH.items.map((x) => [x.drug, x.freq, x.days, x.vis, x.isNew ? 1 : 0]), g, eo: PH.sticker.on ? stickerOpts : undefined });
      if (PH.sticker.on) out.E = await MP.encode('E', MP.buildEmergencyPayload(snap, stickerOpts, sid));
      if (g) {
        const gp = MP.buildGuardianPayload(snap, g); gp.s = e.sex;
        if (g.perms.emergencyQR) gp.eq = out.E || await MP.encode('E', MP.buildEmergencyPayload(snap, e.emergencyOpts, sid));
        out.G = await MP.encode('G', gp); out.gid = g.id;
      }
    } catch (err) { MP.toast('https 주소에서 열어야 QR을 만들 수 있어요'); return; }
    out.sid = sid;
    MP.addIssued({ id: rid, type: 'R', pid: e.pid, name: e.name.slice(0, 1) + '○○' });
    if (out.G) MP.addIssued({ id: g.id, type: 'G', pid: e.pid, name: e.name.slice(0, 1) + '○○', exp: Date.now() + 24 * 3600e3 });
    if (out.E) MP.addIssued({ id: sid, type: 'E', pid: e.pid, name: e.name.slice(0, 1) + '○○' });
    MP.save('mp.lastPharmacy', { R: out.R, G: out.G || null, E: out.E || null, ts: Date.now() });
    MP.addAudit({ who: `[약사] ${ORG.pharmacy}`, role: '약사', pid: e.pid, action: '처방 등록 QR 발급', path: '약국 발급', result: '허용', ip: '10.0.31.7' });
    PH.out = out;
    render();
    MP.toast('안내지를 만들었어요. 인쇄하거나 화면을 그대로 보여주세요.');
  };

  function paperHTML(o) {
    const e = MP.getPersona('elder');
    const incl = o.sticker ? [o.sticker.allergy && '알레르기', o.sticker.contact && '보호자 연락처', o.sticker.meds && '복용 약·기저질환'].filter(Boolean) : [];
    return `<div class="row noprint" style="justify-content:flex-end;margin-bottom:10px;gap:8px"><button class="btn sm" onclick="W.phReset()">새 처방</button><button class="btn sm primary" onclick="window.print()">${I('printer')} 인쇄</button></div>
      <div class="paper">
        <div class="ph"><div><div style="font-size:13px;color:#666">약 여권 안내지</div><h2>${esc(e.name)} 님</h2></div><div style="text-align:right;font-size:13px;color:#555">${ORG.pharmacy}<br>${o.date} · ${esc(o.org)}</div></div>
        <div class="blk"><div class="qr-box">${MP.qrSVG(o.R)}</div>
          <div><div class="big"><span class="num">1</span>내 휴대폰에 약 등록</div>
          <div class="how">약 여권 앱 → <b>'약 등록'</b> → <b>'약국에서 받은 QR 찍기'</b><br>이번에 받은 약: ${o.newItems.map((x) => `<b>${MP.drugName(x.drug)}</b>`).join(', ') || '없음'}</div></div></div>
        ${o.G ? `<div class="blk"><div class="qr-box">${MP.qrSVG(o.G)}</div>
          <div><div class="big"><span class="num">2</span>${o.guardian.type === 'care' ? '돌봄 담당자' : '보호자'} 연결 (${esc(o.guardian.name)})</div>
          <div class="how">${o.guardian.type === 'care' ? '담당자' : '보호자'} 휴대폰의 약 여권 앱 → <b>'가족'</b> → <b>'보호자 연결 QR 찍기'</b><br><span style="color:#8A3A1C">1회용 · 24시간 안에 찍어 주세요</span></div></div></div>` : ''}
        ${o.E ? `<div class="cut"><span>✂ 잘라서 약수첩·지갑에 붙이세요</span></div>
          <div class="sticker"><div class="qr-box">${MP.qrSVG(o.E)}</div>
            <div><div style="color:var(--danger);font-weight:800;font-size:16px">⚠ 응급 의료 정보 QR</div><div style="font-weight:700;margin-top:4px">${esc(e.name)} · ${e.birth}</div>
            <div style="font-size:12px;color:#555;margin-top:4px">의료진 단말에서만 열림 · 인터넷 없이 확인<br>포함: ${incl.join(', ') || '기본 정보만'}</div><div class="mono" style="font-size:11px;color:#888;margin-top:4px">${o.sid}</div></div></div>` : ''}
      </div>
      <div class="sub noprint" style="margin-top:10px">발급 ID ${o.rid}${o.gid ? ` · ${o.gid}` : ''}${o.sid && o.E ? ` · ${o.sid}` : ''} — 발급 현황에서 확인·무효화할 수 있어요.</div>`;
  }
  A.phReset = () => { PH = freshPH(); render(); };

  function issuedList() {
    const list = MP.getIssued(), rev = MP.getRevoked(), now = Date.now();
    const status = (x) => {
      if (rev.has(x.id)) return '<span class="res-no">무효화됨</span>';
      if (x.type === 'G') return x.exp && x.exp < now ? '<span class="chip">만료</span>' : `<span class="res-ok">유효 · ${Math.max(0, Math.round((x.exp - now) / 3600e3))}시간 남음</span>`;
      return x.type === 'E' ? '<span class="res-ok">유효</span>' : '<span class="chip">발급됨</span>';
    };
    return `<div class="card" style="padding:0;overflow:hidden">
      <div class="between" style="padding:20px 24px"><div><h3 class="h-sec" style="margin:0">${ORG.pharmacy} 발급 현황</h3><div class="sub">응급 QR 스티커를 잃어버렸다면 여기서 무효화하세요. 무효화된 스티커는 의료진 단말에서 열리지 않아요.</div></div><span class="sub">${list.length}건</span></div>
      <table class="tbl"><thead><tr><th>발급 ID</th><th>종류</th><th>환자</th><th>발급 시각</th><th>상태</th><th>비고</th><th></th></tr></thead><tbody>
      ${list.map((x) => `<tr class="${rev.has(x.id) ? 'hl' : ''}"><td class="mono">${x.id}</td><td>${MP.TYPE_LABEL[x.type]}</td><td><span class="mono">${x.pid}</span> ${esc(x.name || '')}</td><td class="mono">${MP.dateStr(x.ts)} ${MP.hhmm(x.ts)}</td><td>${status(x)}</td><td class="sub">${esc(x.note || '')}</td>
        <td>${x.type === 'E' && !rev.has(x.id) ? `<button class="btn sm danger" onclick="W.revokeAsk('${x.id}')">무효화</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  A.revokeAsk = (id) => modal(`<h3 style="margin-top:0">응급 QR ${id}를 무효화할까요?</h3>
    <label class="field"><span>사유</span><select class="input" id="rvReason"><option>분실 신고</option><option>재발급</option><option>환자 요청</option></select></label>
    <p class="sub">무효화 목록은 의료진 단말에 주기적으로 동기화돼요. 무효화 후에는 되돌릴 수 없어요.</p>
    <div class="row" style="margin-top:14px"><button class="btn grow" onclick="W.closeModal()">취소</button><button class="btn primary grow" style="background:var(--danger);border-color:var(--danger)" onclick="W.revoke('${id}')">무효화</button></div>`);
  A.revoke = (id) => {
    const reason = document.getElementById('rvReason').value;
    MP.revoke(id);
    const x = MP.getIssued().find((r) => r.id === id);
    MP.addAudit({ who: `[약사] ${ORG.pharmacy}`, role: '약사', pid: x?.pid || '—', action: `응급 QR 무효화 (${reason})`, path: '약국 발급', result: '허용', ip: '10.0.31.7' });
    if (x) notifyPatient(x.pid, `${ORG.pharmacy}에서 응급 QR(${id})을 무효화했어요 · ${reason}`);
    A.closeModal(); render(); MP.toast('무효화했어요');
  };

  /* ================================================================
   * 2. 진료: QR 리더기 / 카메라 → 복호화 → 환자 정보 · 응급 정보 · 거부
   * ================================================================ */
  const CL = { view: 'idle', data: null, reason: null, lang: 'ko', ts: 0, history: [] };
  const LANGS = { ko: '한국어 + 원문', ja: '日本語', en: 'English' };

  function renderClinic() {
    const main = document.getElementById('main');
    let html = '';
    if (CL.view === 'idle') html = clinicIdle();
    else if (CL.view === 'result') html = clinicResult();
    else if (CL.view === 'emer') html = clinicEmer();
    else html = clinicReject();
    main.innerHTML = html + `<input id="reader" autocomplete="off" spellcheck="false" style="position:fixed;left:-9999px;top:0;opacity:0" aria-label="QR 리더기 입력">`;
    setupReader();
  }

  function clinicIdle() {
    return `<div class="card scanpanel">
      <div class="scanicon">${I('scan')}</div>
      <h2 style="font-size:28px;margin:0">환자 QR을 리더기에 보여주세요</h2>
      <div class="sub" style="font-size:16px;margin-top:8px">실시간 QR(진료용) · 응급 QR 모두 읽을 수 있어요</div>
      <div style="margin-top:22px"><span class="reader" id="readerBox" onclick="W.focusReader()"><span class="dot live" id="rdot"></span><span id="rtext">리더기 입력 대기 중</span></span></div>
      <div id="imeWarn"></div>
      <div class="row" style="justify-content:center;gap:10px;margin-top:22px">
        <button class="btn outline" onclick="W.camera()">${I('camera')} 카메라로 스캔</button>
        <button class="btn" onclick="W.fromScreen()">${I('phone')} 환자 화면의 QR 읽기 <span class="sub">(한 화면 시연)</span></button>
        <label class="btn">${I('image')} 이미지에서 읽기<input type="file" accept="image/*" hidden onchange="W.fromFile(this.files[0])"></label>
      </div>
      <details style="margin-top:26px;text-align:left"><summary class="sub" style="cursor:pointer;text-align:center">시연용 샘플 · 직접 붙여넣기</summary>
        <div class="samples" style="margin-top:14px">
          <button class="btn sm" onclick="W.sample('live')">정상 실시간 QR</button>
          <button class="btn sm" onclick="W.sample('expired')">5분 지난 QR</button>
          <button class="btn sm" onclick="W.sample('emer')">응급 QR</button>
          <button class="btn sm" onclick="W.sample('revoked')">무효화된 스티커</button>
          <button class="btn sm" onclick="W.sample('tamper')">위조된 코드</button>
        </div>
        <div class="row" style="margin-top:12px"><input class="input mono grow" id="paste" placeholder="MP1.D.… 코드를 붙여넣고 Enter" onkeydown="if(event.key==='Enter')W.scan(this.value,'붙여넣기')"><button class="btn" onclick="W.scan(document.getElementById('paste').value,'붙여넣기')">확인</button></div>
      </details>
    </div>
    ${CL.history.length ? `<div class="card" style="max-width:860px;margin:18px auto 0"><b>이번 세션 스캔</b><div style="margin-top:8px">${CL.history.slice(-5).reverse().map((h) => `<div class="between" style="padding:6px 0;border-top:1px solid var(--line-2);font-size:14px"><span class="mono faint">${MP.hhmmss(h.ts)}</span><span>${esc(h.label)}</span><span class="${/거부/.test(h.result) ? 'res-no' : 'res-ok'}">${esc(h.result)}</span></div>`).join('')}</div></div>` : ''}
    <div class="sub" style="text-align:center;margin-top:16px">${I('lock')} 모든 열람은 감사 로그에 기록되고, 환자가 앱에서 확인할 수 있어요.</div>`;
  }

  function setupReader() {
    const inp = document.getElementById('reader');
    if (!inp) return;
    MP.KeyboardScanner(inp, (v) => A.scan(v, 'QR 리더기'), () => {
      const w = document.getElementById('imeWarn');
      if (w) w.innerHTML = `<div class="alert warn" style="max-width:520px;margin:14px auto 0;text-align:left">${I('alert')}<span>키보드가 <b>한글</b> 상태예요. 자동으로 영문으로 복구해서 읽지만, <b>한/영 키</b>를 눌러 영문으로 바꿔 두면 더 안정적이에요.</span></div>`;
    });
    const upd = () => {
      const on = document.activeElement === inp;
      const dot = document.getElementById('rdot'), t = document.getElementById('rtext');
      if (dot) dot.className = 'dot' + (on ? ' live' : ' off');
      if (t) t.textContent = on ? '리더기 입력 대기 중' : '여기를 클릭하면 리더기 입력이 켜져요';
      const rs = document.getElementById('readerStat');
      if (rs) rs.innerHTML = `<span class="dot ${on ? 'live' : 'off'}"></span><span class="sub">${on ? 'QR 리더기 대기' : '리더기 꺼짐'}</span>`;
    };
    inp.addEventListener('focus', upd); inp.addEventListener('blur', upd);
    const refocus = (e) => { if (TAB !== 'clinic') return; if (e.target.closest('input,select,textarea,summary,label') || document.getElementById('modal-root').innerHTML) return; setTimeout(() => inp.focus({ preventScroll: true }), 0); };
    document.addEventListener('click', refocus);
    cleanup.push(() => document.removeEventListener('click', refocus));
    inp.focus({ preventScroll: true }); upd();
  }
  A.focusReader = () => document.getElementById('reader')?.focus();

  A.scan = async (text, source) => {
    if (!text) return;
    const r = await MP.decode(text);
    const base = { who: `[의료진] ${ORG.clinic}`, role: '의료진', ip: '10.0.12.41' };
    const reject = (reason, pid, path, label) => {
      CL.view = 'reject'; CL.reason = reason; CL.data = r.data || null;
      MP.addAudit({ ...base, pid: pid || '—', action: reason.action, path: path || '실시간 QR', result: '거부 · ' + reason.short });
      CL.history.push({ ts: Date.now(), label: label || reason.title, result: '거부 · ' + reason.short });
      render();
    };
    if (!r.ok) {
      if (r.reason === 'insecure') return MP.toast('https 주소에서 열어야 복호화할 수 있어요');
      if (r.reason === 'format') return reject({ title: '약 여권 QR이 아니에요', short: '형식 오류', action: '알 수 없는 코드 스캔', desc: '약 여권에서 만든 QR만 읽을 수 있어요.', how: '환자에게 약 여권 앱의 \'의료진에게 보여주기\' 화면을 요청하세요.' });
      return reject({ title: '위조되었거나 손상된 코드예요', short: '복호화 실패', action: '위조 코드 스캔', desc: '암호 검증(AES-GCM 인증 태그)에 실패했어요. 내용이 바뀌었거나 약 여권에서 만든 코드가 아니에요.', how: '이 시도는 감사 로그에 이상 징후로 기록됐어요.' }, null, MP.TYPE_LABEL[r.type] || '실시간 QR');
    }
    const d = r.data;
    if (r.type === 'D') {
      const now = Date.now() / 1000;
      if (d.exp < now) return reject({ title: '만료된 코드예요', short: '만료 토큰', action: '약 목록 열람', desc: `이 QR은 ${MP.hhmmss(d.exp * 1000)}에 만료됐어요. 실시간 QR은 5분만 유효해요.`, how: '환자에게 \'지금 새로 고침\'을 눌러 새 코드를 보여달라고 하세요.' }, d.p.id, '실시간 QR', `${d.p.n} · 실시간 QR`);
      if (d.iat > now + 120) return reject({ title: '시간이 맞지 않는 코드예요', short: '시각 오류', action: '약 목록 열람', desc: '발급 시각이 미래로 되어 있어요.', how: '환자 휴대폰의 시간 설정을 확인해 주세요.' }, d.p.id);
      if (MP.isUsed(d.j)) return reject({ title: '이미 사용된 코드예요', short: '사용된 토큰', action: '토큰 재사용 시도', desc: '실시간 QR은 한 번 읽히면 바로 폐기돼요. 같은 코드를 다시 읽을 수 없어요.', how: '다시 확인하려면 환자에게 새 코드를 요청하세요.' }, d.p.id, '실시간 QR', `${d.p.n} · 실시간 QR`);
      MP.markUsed(d.j);
      MP.addAudit({ ...base, pid: d.p.id, action: '약 목록 열람', path: '실시간 QR', result: '허용' });
      notifyPatient(d.p.id, `${ORG.clinic}에서 내 약 정보를 열람했어요`, { who: ORG.clinic, role: '의료진', action: '약 목록 열람', path: '실시간 QR', result: '허용' });
      CL.view = 'result'; CL.data = d; CL.ts = Date.now(); CL.source = source;
      CL.history.push({ ts: Date.now(), label: `${d.p.n} · 실시간 QR · ${source}`, result: '허용' });
      return render();
    }
    if (r.type === 'E') {
      if (MP.getRevoked().has(d.sid)) return reject({ title: '무효화된 응급 QR이에요', short: '무효화된 스티커', action: '응급 정보 열람', desc: `이 스티커(${d.sid})는 분실 등의 이유로 약국에서 무효화했어요.`, how: '환자 본인 확인 후 앱의 응급 QR이나 실시간 QR을 요청하세요.' }, d.p.id, '응급 QR', `${d.p.n} · 응급 QR`);
      MP.addAudit({ ...base, who: `[의료진] ${ORG.clinic}`, pid: d.p.id, action: '응급 정보 열람', path: '응급 QR', result: '허용', ip: '단말 로컬' });
      notifyPatient(d.p.id, `${ORG.clinic}에서 응급 정보를 열람했어요`, { who: ORG.clinic, role: '의료진', action: '응급 정보 열람', path: '응급 QR', result: '허용' });
      CL.view = 'emer'; CL.data = d; CL.ts = Date.now();
      CL.history.push({ ts: Date.now(), label: `${d.p.n} · 응급 QR · ${source}`, result: '허용' });
      return render();
    }
    return reject({ title: `${MP.TYPE_LABEL[r.type]}이에요`, short: '용도 불일치', action: '용도 외 QR 스캔', desc: `${MP.TYPE_LABEL[r.type]}은 진료용이 아니라 ${r.type === 'R' ? '환자 앱에 처방을 등록할 때' : '보호자를 연결할 때'} 쓰는 QR이에요.`, how: '환자에게 \'의료진에게 보여주기\' 화면을 요청하세요.' }, d.pid, MP.TYPE_LABEL[r.type]);
  };
  A.again = () => { CL.view = 'idle'; CL.data = null; render(); };
  A.setLang = (l) => { CL.lang = l; render(); };

  A.camera = () => {
    modal(`<div class="between"><h3 style="margin:0">카메라로 스캔</h3><button class="btn ghost sm" onclick="W.closeCam()">${I('x')}</button></div>
      <div class="cam" style="margin-top:14px"><video id="wcam"></video><div class="frame"></div><div class="msg" id="wcammsg">카메라를 켜는 중…</div></div>
      <div class="sub" style="margin-top:10px;text-align:center">환자 휴대폰 화면을 카메라에 가까이 보여주세요</div>`, true);
    const cam = MP.Camera(document.getElementById('wcam'), (t) => { A.closeModal(); A.scan(t, '카메라'); }, (m) => { const e = document.getElementById('wcammsg'); if (e) e.textContent = m; });
    cam.start('user'); A._cam = cam;
  };
  A.closeCam = () => { A._cam?.stop(); A.closeModal(); };
  A.fromFile = async (f) => { if (!f) return; const t = await MP.decodeImageFile(f); if (!t) return MP.toast('이미지에서 QR을 찾지 못했어요'); A.scan(t, '이미지'); };
  A.fromScreen = () => {
    const s = MP.load(MP.KEY.shown, null);
    if (!s || Date.now() - s.ts > 15 * 60e3) return MP.toast('환자 앱에서 \'의료진에게 보여주기\' 화면을 먼저 열어 주세요', 3500);
    A.scan(s.code, '환자 화면');
  };
  A.sample = async (k) => {
    const e = MP.getPersona('elder');
    if (k === 'live') return A.scan(await MP.encode('D', MP.buildClinicalPayload(e)), '샘플');
    if (k === 'expired') return A.scan(await MP.encode('D', MP.buildClinicalPayload(e, { ageSec: 420 })), '샘플');
    if (k === 'emer') return A.scan(await MP.encode('E', MP.buildEmergencyPayload(e, e.emergencyOpts, e.emerSid || 'E-DEMO01')), '샘플');
    if (k === 'revoked') {
      const other = { pid: 'PT-002981', name: '박순자', sex: '여', birth: '1945-09-02', blood: 'B+', allergies: ['nsaid'], conditions: ['htn'], meds: [{ drug: 'amlodipine' }], emergencyContact: null };
      return A.scan(await MP.encode('E', MP.buildEmergencyPayload(other, { allergy: true, meds: true, contact: false }, 'E-7Q2KD9')), '샘플');
    }
    if (k === 'tamper') { const c = await MP.encode('D', MP.buildClinicalPayload(e)); return A.scan(c.slice(0, 30) + (c[30] === 'A' ? 'B' : 'A') + c.slice(31), '샘플'); }
  };

  function clinicResult() {
    const d = CL.data, L = CL.lang;
    const nm = (o) => (L === 'ko' ? o.ko : o[L]);
    const drugs = d.m.map((x) => x[0]);
    const dur = MP.durCheck(drugs, d.al || []);
    const left = Math.max(0, Math.round(d.exp - Date.now() / 1000));
    const orgs = d.o || [];
    return `
      <div class="between noprint" style="margin-bottom:16px">
        <div class="row" style="gap:10px"><span class="chip ok">${I('lock')} 실시간 QR · AES-256-GCM 복호화</span><span class="chip">1회용 · 사용 처리됨</span><span class="chip mono" id="ttlchip">코드 남은 시간 ${MP.mmss(left)}</span><span class="sub">${esc(CL.source || '')}로 읽음</span></div>
        <div class="row" style="gap:10px"><span class="sub">표시 언어</span><select class="input" style="width:170px" onchange="W.setLang(this.value)">${Object.entries(LANGS).map(([k, t]) => `<option value="${k}" ${k === L ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="btn primary" onclick="W.again()">${I('scan')} 다시 스캔</button></div>
      </div>
      <div class="grid3">
        <div class="stack">
          <div class="card">
            <div class="row" style="gap:16px;align-items:center"><div class="photo">사진</div><div><div style="font-size:24px;font-weight:800">${esc(d.p.n)}</div><div class="sub">${d.p.s} · ${MP.age(d.p.b)}세 · ${d.p.b}</div><div class="sub">혈액형 ${d.p.bt}</div></div></div>
            <div class="kv2" style="margin-top:18px">
              <span>환자 ID</span><span class="mono">${d.p.id}</span>
              <span>사용 언어</span><span>한국어</span>
              <span>보호자</span><span>${d.ec ? `${esc(d.ec[0])} (${esc(d.ec[1])}) · ${esc(d.ec[2])}` : '<span class="faint">없음</span>'}</span>
              <span>데이터 기준</span><span class="mono">${MP.dateStr(d.iat * 1000)} ${MP.hhmm(d.iat * 1000)}</span>
              <span>스캔 시각</span><span class="mono">${MP.hhmmss(CL.ts)}</span>
            </div>
          </div>
          <div class="card"><b>기저질환</b><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px">${(d.c || []).map((c) => `<span class="chip" style="font-size:15px;padding:6px 12px">${nm(MP.COND[c])}</span>`).join('') || '<span class="faint">없음</span>'}</div></div>
          <div class="alert info">${I('lock')}<span>이 열람 기록은 감사 로그에 저장되며 환자가 앱에서 확인할 수 있습니다.</span></div>
        </div>
        <div class="stack">
          ${(d.al || []).length ? `<div class="banner-allergy">${I('tri')}<div><div class="t1">${L === 'ko' ? '알레르기 · 금기' : L === 'ja' ? 'アレルギー・禁忌' : 'Allergies · Contraindications'}</div><div class="t2">${d.al.map((a) => nm(MP.ALLERGY[a])).join(' · ')}</div></div></div>` : ''}
          ${dur.map((x) => `<div class="alert ${x.level === 'warn' ? 'warn' : ''}">${I('alert')}<span><b>DUR</b> · ${esc(x.text)}</span></div>`).join('')}
          <div class="card" style="padding:0;overflow:hidden">
            <div class="between" style="padding:18px 22px"><b style="font-size:18px">현재 복용 약 ${d.m.length}</b><span class="sub">코드 기준 WHO ATC · INN</span></div>
            <table class="tbl"><thead><tr><th>성분명 (INN)</th><th>${L === 'ko' ? '원문 표기' : L === 'ja' ? '日本語' : 'Brand / local'}</th><th>ATC</th><th>용량</th><th>${L === 'ko' ? '복용법' : L === 'ja' ? '用法' : 'Directions'}</th><th>처방일</th></tr></thead><tbody>
              ${d.m.map(([k, f, start, days, oi]) => { const g = D(k), fr = MP.FREQ[f]; return `<tr><td><b>${g.innShort}</b><div class="faint" style="font-size:12px">${esc(orgs[oi] || '')}</div></td><td class="muted">${L === 'ko' ? g.orig : L === 'ja' ? g.ja : g.ko + ' (KR)'}</td><td class="mono">${g.atc}</td><td style="white-space:nowrap">${g.strength.replace(/(\d)([a-z])/i, '$1 $2')}</td><td>${L === 'ko' ? fr.short : fr[L]}</td><td class="mono muted" style="white-space:nowrap">${start}</td></tr>`; }).join('')}
            </tbody></table>
          </div>
        </div>
        <div class="card stack">
          <b style="font-size:17px">최근 처방 이력</b>
          <div class="timeline">${(d.rx || []).map(([date, oi, cnt]) => `<div class="it"><div class="d">${date}</div><div>${esc(orgs[oi] || '')} · ${cnt}건</div></div>`).join('')}</div>
          <div style="height:30px"></div>
          <button class="btn block noprint" onclick="MP.toast('시연 버전에서는 최근 이력까지만 보여줘요')">전체 이력 보기</button>
          <button class="btn block noprint" onclick="window.print()">${I('printer')} 요약 인쇄</button>
        </div>
      </div>`;
  }

  function clinicEmer() {
    const d = CL.data;
    const NI = '<span class="notincl">환자가 포함하지 않음</span>';
    return `<div class="emer-head">${I('tri', 'xl')}<div><div style="font-size:14px;opacity:.85">응급 QR · 인터넷 없이 단말에서 복호화</div><div style="font-size:28px;font-weight:800">${esc(d.p.n)} <span style="font-size:18px;font-weight:500">${d.p.s} · ${MP.age(d.p.b)}세 · ${d.p.b}</span></div></div><span class="sp" style="flex:1"></span><button class="btn" style="color:var(--text)" onclick="W.again()">${I('scan')} 다시 스캔</button></div>
      <div class="emer-grid">
        <div class="card" style="border-color:var(--danger-line)"><h4>알레르기 · 금기</h4><div class="big" style="color:var(--danger)">${d.al ? (d.al.map((a) => MP.ALLERGY[a].ko).join(' · ') || '없음') : NI}</div></div>
        <div class="card"><h4>혈액형</h4><div class="big">${d.p.bt}</div></div>
        <div class="card"><h4>복용 약 (성분명 · ATC)</h4>${d.m ? d.m.map((k) => `<div class="between" style="padding:6px 0;border-bottom:1px solid var(--line-2)"><b>${D(k).innShort} ${D(k).strength}</b><span class="mono muted">${D(k).atc}</span></div>`).join('') : NI}</div>
        <div class="card"><h4>기저질환</h4><div style="font-size:18px;font-weight:700">${d.c ? d.c.map((c) => MP.COND[c].ko).join(' · ') : NI}</div>
          <h4 style="margin-top:18px">응급 연락처</h4><div style="font-size:18px;font-weight:700">${d.ec ? `${esc(d.ec[0])} (${esc(d.ec[1])}) <span class="mono">${esc(d.ec[2])}</span>` : NI}</div></div>
      </div>
      <div class="alert info" style="margin-top:18px">${I('lock')}<span>응급 QR은 생명과 직결된 최소 정보만 담고 있어요 (발급 ID <span class="mono">${d.sid}</span>). 자세한 처방은 환자의 실시간 QR로 확인하세요.</span></div>`;
  }

  function clinicReject() {
    const r = CL.reason;
    return `<div class="card reject"><div class="ricon">${I('lock')}</div>
      <h2 style="font-size:28px;margin:0">${esc(r.title)}</h2>
      <div class="sub" style="font-size:16px;margin-top:10px">${esc(r.desc)}</div>
      <div class="alert info" style="margin-top:20px;text-align:left">${I('alert')}<span>${esc(r.how)}</span></div>
      <div class="sub" style="margin-top:14px">이 시도는 감사 로그에 <b>거부 · ${esc(r.short)}</b>로 기록됐어요. 환자 정보는 표시되지 않아요.</div>
      <button class="btn primary lg" style="margin-top:22px" onclick="W.again()">${I('scan')} 다시 스캔</button></div>`;
  }

  /* ================================================================
   * 3. 감사: 열람 기록 (의료 정보 없음, 메타데이터만)
   * ================================================================ */
  const AU = { period: '24h', role: 'all', pid: '', paths: [], results: [], anomaly: false, sel: null };
  const PATHS = ['실시간 QR', '응급 QR', '보호자 위임', '약국 발급', '앱'];
  function auditRows() {
    const now = Date.now(), lim = { '24h': 864e5, '7d': 7 * 864e5, all: Infinity }[AU.period];
    return MP.getAudit().filter((r) => now - r.ts <= lim)
      .filter((r) => AU.role === 'all' || (AU.role === '미인증' ? r.role === '—' : r.role === AU.role))
      .filter((r) => !AU.pid || r.pid.includes(AU.pid.toUpperCase()))
      .filter((r) => !AU.paths.length || AU.paths.includes(r.path))
      .filter((r) => !AU.results.length || AU.results.some((x) => r.result.startsWith(x)))
      .filter((r) => !AU.anomaly || r.anomaly || /복호화 실패|사용된 토큰/.test(r.result))
      .sort((a, b) => b.ts - a.ts);
  }
  function renderAudit() {
    const all = MP.getAudit(), today = MP.today();
    const t = all.filter((r) => MP.dateStr(r.ts) === today);
    const kp = { views: 1262 + t.filter((r) => r.result === '허용').length, denied: 4 + t.filter((r) => r.result.startsWith('거부')).length, offline: 59 + t.filter((r) => r.path === '응급 QR').length, anomaly: t.filter((r) => r.anomaly || /복호화 실패|사용된 토큰/.test(r.result)).length };
    const rows = auditRows();
    document.getElementById('main').innerHTML = `
      <div class="audit-grid">
        <div class="card stack sticky">
          <b style="font-size:17px">조회 조건</b>
          <label class="field"><span>기간</span><select class="input" id="fPeriod"><option value="24h" ${AU.period === '24h' ? 'selected' : ''}>최근 24시간</option><option value="7d" ${AU.period === '7d' ? 'selected' : ''}>최근 7일</option><option value="all" ${AU.period === 'all' ? 'selected' : ''}>전체</option></select></label>
          <label class="field"><span>열람 주체</span><select class="input" id="fRole">${['all', '의료진', '약사', '보호자', '환자', '미인증'].map((r) => `<option value="${r}" ${AU.role === r ? 'selected' : ''}>${r === 'all' ? '전체' : r}</option>`).join('')}</select></label>
          <label class="field"><span>대상 환자 ID</span><input class="input mono" id="fPid" placeholder="PT-000000" value="${esc(AU.pid)}"></label>
          <div><div class="sub" style="font-size:13px;margin-bottom:6px">접근 경로</div>${PATHS.map((p) => `<label class="check" style="padding:4px 0"><input type="checkbox" class="fPath" value="${p}" ${AU.paths.includes(p) ? 'checked' : ''}> ${p}</label>`).join('')}</div>
          <div><div class="sub" style="font-size:13px;margin-bottom:6px">결과</div>${['허용', '거부'].map((p) => `<label class="check" style="padding:4px 0"><input type="checkbox" class="fRes" value="${p}" ${AU.results.includes(p) ? 'checked' : ''}> ${p}</label>`).join('')}
            <label class="check" style="padding:4px 0"><input type="checkbox" id="fAnom" ${AU.anomaly ? 'checked' : ''}> 이상 징후만</label></div>
          <button class="btn primary block lg" onclick="W.applyFilter()">조회</button>
        </div>
        <div>
          <div class="kpis">
            <div class="card kpi"><div class="l">오늘 열람</div><div class="v">${kp.views.toLocaleString()}</div></div>
            <div class="card kpi"><div class="l">거부된 시도</div><div class="v red">${kp.denied}</div></div>
            <div class="card kpi"><div class="l">오프라인(응급) 스캔</div><div class="v">${kp.offline}</div></div>
            <div class="card kpi"><div class="l">이상 징후</div><div class="v red">${kp.anomaly}</div></div>
          </div>
          <div class="card" style="padding:0;overflow:hidden">
            <div class="between" style="padding:20px 24px"><b style="font-size:19px">접근 기록</b><div class="row" style="gap:14px"><span class="sub">${rows.length}건</span><button class="btn" onclick="W.csv()">${I('download')} CSV 내보내기</button></div></div>
            <table class="tbl"><thead><tr><th>시각</th><th>열람 주체</th><th>역할</th><th>대상 환자</th><th>동작</th><th>경로</th><th>결과</th><th>IP</th></tr></thead><tbody>
              ${rows.map((r, i) => `<tr class="click ${r.result.startsWith('거부') ? 'hl' : ''}" onclick="W.detail(${r.ts},'${esc(r.action)}')"><td class="mono">${MP.hhmmss(r.ts)}${MP.dateStr(r.ts) !== today ? `<div class="faint" style="font-size:11px">${MP.dateStr(r.ts)}</div>` : ''}</td><td>${r.anomaly ? '<span style="color:var(--danger)">⚠</span> ' : ''}${esc(r.who)}</td><td class="muted">${esc(r.role)}</td><td class="mono">${esc(r.pid)}</td><td>${esc(r.action)}</td><td class="muted">${esc(r.path)}</td><td><span class="${r.result.startsWith('거부') ? 'res-no' : 'res-ok'}">${esc(r.result)}</span></td><td class="mono muted">${esc(MP.maskIp(r.ip))}</td></tr>`).join('') || '<tr><td colspan="8" class="sub" style="text-align:center;padding:30px">조건에 맞는 기록이 없어요</td></tr>'}
            </tbody></table>
          </div>
          <div class="sub" style="margin-top:12px">${I('lock')} 감사 화면에는 약 이름·질환 등 의료 정보가 표시되지 않아요. 열람 주체는 기관·계정 단위로 보여요.</div>
        </div>
      </div>
      <div id="drawer"></div>`;
    let sec = 27 * 60; const st = setInterval(() => { sec--; const e = document.getElementById('sess'); if (e) e.textContent = MP.mmss(sec); }, 1000);
    cleanup.push(() => clearInterval(st));
  }
  A.applyFilter = () => {
    AU.period = document.getElementById('fPeriod').value; AU.role = document.getElementById('fRole').value; AU.pid = document.getElementById('fPid').value.trim();
    AU.paths = [...document.querySelectorAll('.fPath:checked')].map((x) => x.value); AU.results = [...document.querySelectorAll('.fRes:checked')].map((x) => x.value);
    AU.anomaly = document.getElementById('fAnom').checked; render();
  };
  A.detail = (ts, action) => {
    const r = MP.getAudit().find((x) => x.ts === ts && x.action === action); if (!r) return;
    const hash = Array.from(new TextEncoder().encode(r.ts + r.pid + r.action)).reduce((h, b) => ((h * 31 + b) >>> 0), 7).toString(16).padStart(8, '0');
    document.getElementById('drawer').innerHTML = `<div class="drawer">
      <div class="between"><b style="font-size:18px">접근 기록 상세</b><button class="btn ghost sm" onclick="document.getElementById('drawer').innerHTML=''">${I('x')}</button></div>
      <div class="kv2" style="margin-top:18px;grid-template-columns:100px 1fr">
        <span>이벤트 ID</span><span class="mono">EV-${hash.toUpperCase()}</span>
        <span>시각</span><span class="mono">${MP.dateStr(r.ts)} ${MP.hhmmss(r.ts)}</span>
        <span>열람 주체</span><span>${esc(r.who)}</span>
        <span>역할</span><span>${esc(r.role)}</span>
        <span>대상 환자</span><span class="mono">${esc(r.pid)}</span>
        <span>동작</span><span>${esc(r.action)}</span>
        <span>접근 경로</span><span>${esc(r.path)}</span>
        <span>결과</span><span><span class="${r.result.startsWith('거부') ? 'res-no' : 'res-ok'}">${esc(r.result)}</span></span>
        <span>IP</span><span class="mono">${esc(MP.maskIp(r.ip))}</span>
        <span>토큰 해시</span><span class="mono">sha256:${hash}…</span>
      </div>
      ${r.anomaly ? `<div class="alert" style="margin-top:18px">${I('tri')}<span>이상 징후: 짧은 시간에 같은 토큰을 반복 사용하거나 복호화에 실패한 시도예요.</span></div>` : ''}
      <div class="card soft" style="margin-top:18px;text-align:center;padding:26px">${I('lock', 'xl')}<div style="font-weight:700;margin-top:10px">의료 정보는 감사 화면에서 볼 수 없어요</div><div class="sub" style="margin-top:4px">약 이름·질환·처방 내용은 저장소에서 암호화되어 있고, 감사 계정에는 복호화 권한이 없어요.</div></div>
      <button class="btn block" style="margin-top:14px" onclick="MP.toast('열람 기관에 소명 요청을 보냈어요 (시연)')">열람 사유 소명 요청</button>
    </div>`;
  };
  A.csv = () => {
    const rows = auditRows();
    const head = ['시각', '열람 주체', '역할', '대상 환자', '동작', '경로', '결과', 'IP'];
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const body = rows.map((r) => [`${MP.dateStr(r.ts)} ${MP.hhmmss(r.ts)}`, r.who, r.role, r.pid, r.action, r.path, r.result, MP.maskIp(r.ip)].map(q).join(','));
    const blob = new Blob(['﻿' + [head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `access-log-${MP.today()}.csv`; a.click();
    MP.addAudit({ who: '[감사] 보안 담당', role: '감사', pid: '—', action: '접근 기록 CSV 내보내기', path: '감사 웹', result: '허용', ip: '10.0.1.2' });
    setTimeout(render, 100);
  };

  /* ---------------- 다른 탭과 동기화 ---------------- */
  MP.onSync(() => { if (TAB === 'audit' && !document.getElementById('drawer')?.innerHTML) render(); if (TAB === 'pharmacy' && PH?.sub === 'list') render(); });
  setInterval(() => { const c = document.getElementById('ttlchip'); if (c && CL.data?.exp) c.textContent = `코드 남은 시간 ${MP.mmss(Math.round(CL.data.exp - Date.now() / 1000))}`; }, 1000);

  render();
})();
