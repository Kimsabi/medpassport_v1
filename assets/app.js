/* 약 여권 — 어르신 · 보호자 모바일 앱 */
(function () {
  const I = MP.icon, esc = MP.esc;
  const qs = new URLSearchParams(location.search);
  let WHO = qs.get('as') || sessionStorage.getItem('mp.as') || 'elder';
  if (!['elder', 'guardian'].includes(WHO)) WHO = 'elder';
  sessionStorage.setItem('mp.as', WHO);
  const IN_FRAME = window.top !== window;

  let P = MP.getPersona(WHO);
  const S = { screen: 'home', params: {}, stack: [], profile: 'me' };
  let cleanup = [];
  const A = (window.A = {});

  const save = () => MP.savePersona(WHO, P);
  const isEasy = () => P.settings.mode === 'easy';
  const D = (k) => MP.DRUGS[k] || { ko: k, strength: '', inn: '', atc: '', cls: '' };

  /* ---------------- 라우팅 ---------------- */
  function go(screen, params = {}) { S.stack.push({ screen: S.screen, params: S.params }); S.screen = screen; S.params = params; render(true); }
  function back() { const p = S.stack.pop(); if (p) { S.screen = p.screen; S.params = p.params; } else { S.screen = 'home'; S.params = {}; } render(true); }
  function tab(screen) { S.stack = []; S.screen = screen; S.params = {}; render(true); }
  A.go = go; A.back = back; A.tab = tab;

  function render(scrollTop) {
    cleanup.forEach((f) => { try { f(); } catch (e) {} }); cleanup = [];
    document.body.classList.toggle('easy', isEasy());
    document.body.classList.toggle('framed', !IN_FRAME && window.innerWidth > 600);
    renderDemobar();
    if (!P.settings.mode) S.screen = 'onboard';
    const fn = SCREENS[S.screen] || SCREENS.home;
    const html = fn(S.params);
    const el = document.getElementById('screen');
    el.innerHTML = html;
    if (scrollTop) el.scrollTop = 0;
    renderNav();
    const after = AFTER[S.screen]; if (after) after(S.params);
    if (!MP.cryptoReady()) MP.toast('⚠ https 주소(또는 localhost)에서 열어야 QR 암호화가 동작해요', 5000);
  }

  function renderDemobar() {
    const el = document.getElementById('demobar');
    if (qs.get('bare') === '1') { el.style.display = 'none'; return; }
    el.innerHTML = `<span>시연 기기</span><b>${WHO === 'elder' ? '어르신 휴대폰' : '보호자(아들) 휴대폰'}</b><span class="sp"></span>
      <button onclick="A.switchWho()">${WHO === 'elder' ? '보호자 폰으로' : '어르신 폰으로'} 전환</button>
      ${IN_FRAME ? '' : '<button onclick="location.href=\'index.html\'">처음</button>'}`;
  }
  A.switchWho = () => { WHO = WHO === 'elder' ? 'guardian' : 'elder'; sessionStorage.setItem('mp.as', WHO); const u = new URL(location.href); u.searchParams.set('as', WHO); history.replaceState(null, '', u); P = MP.getPersona(WHO); S.stack = []; S.screen = 'home'; S.profile = 'me'; render(true); };

  const TOP_TABS = WHO === 'elder' ? ['home', 'register', 'guardians', 'me'] : ['home', 'register', 'family', 'me'];
  function renderNav() {
    const nav = document.getElementById('nav');
    const show = !isEasy() && TOP_TABS.includes(S.screen) && S.screen !== 'onboard';
    nav.style.display = show ? '' : 'none';
    if (!show) return;
    const items = WHO === 'elder'
      ? [['home', 'home', '홈'], ['register', 'doc', '처방전'], ['guardians', 'users', '보호자'], ['me', 'user', '내 정보']]
      : [['home', 'home', '홈'], ['register', 'doc', '처방전'], ['family', 'users', '가족'], ['me', 'user', '내 정보']];
    nav.innerHTML = items.map(([s, ic, t]) => `<button class="${S.screen === s ? 'on' : ''}" onclick="A.tab('${s}')">${I(ic)}<span>${t}</span></button>`).join('');
  }

  function topbar(title, { backBtn = true, right = '' } = {}) {
    return `<div class="topbar">${backBtn ? `<button class="iconbtn" onclick="A.back()" aria-label="뒤로">${I('back', 'lg')}</button>` : ''}<h1>${title}</h1>${right}</div>`;
  }

  /* ---------------- 복약 계산 ---------------- */
  const medDue = MP.medDue;
  function slotGroups(p) {
    const map = {};
    p.meds.filter(medDue).forEach((m) => MP.FREQ[m.freq].slots.forEach((s) => (map[s] = map[s] || []).push(m)));
    return MP.SLOT_ORDER.filter((s) => map[s]).map((s) => ({ slot: s, meds: map[s] }));
  }
  function takenStat(p) {
    let total = 0, done = 0;
    slotGroups(p).forEach((g) => g.meds.forEach((m) => { total++; if (p.taken.slots[`${m.id}@${g.slot}`]) done++; }));
    return { total, done };
  }
  const slotDone = (p, g) => g.meds.every((m) => p.taken.slots[`${m.id}@${g.slot}`]);
  A.toggleSlot = (slot) => {
    const g = slotGroups(P).find((x) => x.slot === slot); if (!g) return;
    const v = !slotDone(P, g);
    g.meds.forEach((m) => { P.taken.slots[`${m.id}@${slot}`] = v; });
    save();
    if (v && isEasy() && P.settings.voice) MP.speak(`${slot} 약을 드셨어요. 잘하셨어요.`);
    render();
  };

  /* ---------------- 알림 ---------------- */
  const unread = () => (P.notifications || []).filter((n) => !n.read);
  A.openNoti = () => {
    const list = (P.notifications || []).slice().reverse();
    modal(`<div class="between"><h3 style="margin:0">알림</h3><button class="btn ghost sm" onclick="A.closeModal()">${I('x')}</button></div>
      <div class="loglist" style="margin-top:10px">${list.length ? list.map((n) => `<div class="it"><div style="font-weight:600">${esc(n.text)}</div><div class="faint mono" style="font-size:12px">${MP.dateStr(n.ts)} ${MP.hhmm(n.ts)}</div></div>`).join('') : '<div class="empty">알림이 없어요</div>'}</div>`);
    P.notifications.forEach((n) => (n.read = true)); save(); render();
  };

  /* ================================================================
   * 화면들
   * ================================================================ */
  const SCREENS = {};
  const AFTER = {};

  /* ---------- 첫 실행: 보기 방식 선택 ---------- */
  SCREENS.onboard = () => `
    <div class="body" style="padding-top:36px">
      <div class="row" style="gap:10px">${I('qr', 'lg')}<b style="font-size:22px">약 여권</b></div>
      <h2 style="font-size:28px;margin:26px 0 6px;line-height:1.3">화면을 어떻게<br>보여드릴까요?</h2>
      <p class="muted" style="margin:0 0 20px">나중에 '내 정보'에서 언제든 바꿀 수 있어요.</p>
      <button class="option" onclick="A.setMode('easy')" style="padding:22px">
        <div class="ic" style="font-size:26px;font-weight:800">가</div>
        <div><b style="font-size:21px">크게 보기 (쉬운 모드)</b><small style="font-size:16px">큰 글씨 · 꼭 필요한 버튼만 · 음성 안내</small></div>
      </button>
      <button class="option" onclick="A.setMode('basic')">
        <div class="ic" style="font-size:16px;font-weight:700">가</div>
        <div><b>기본 모드</b><small>약 상세 · 보호자 관리 등 모든 기능</small></div>
      </button>
      <div class="notice">${I('speaker')}<span>쉬운 모드에서는 화면 위 '읽어주기' 버튼을 누르면 내용을 소리로 들려드려요.</span></div>
    </div>`;
  A.setMode = (m) => { P.settings.mode = m; if (m === 'easy') P.settings.voice = true; save(); S.stack = []; S.screen = 'home'; render(true); if (m === 'easy') MP.speak('크게 보기로 설정했어요.'); };

  /* ---------- 홈 ---------- */
  SCREENS.home = () => {
    if (WHO === 'guardian' && S.profile !== 'me') return familyView();
    return isEasy() ? easyHome() : basicHome();
  };

  function easyHome() {
    const st = takenStat(P), n = unread();
    const d = new Date();
    return `
      <div class="topbar" style="border:0;background:var(--bg)"><h1 style="font-size:17px" class="muted">약 여권</h1><button class="voicebtn" onclick="A.readHome()">${I('speaker')} 읽어주기</button></div>
      <div class="body" style="padding-top:4px">
        <div><div class="easy-hello">${esc(P.name)} 님,<br>안녕하세요</div><div class="easy-sub">${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일</div></div>
        ${n.length ? `<div class="banner">${I('bell', 'lg')}<span>${esc(n[n.length - 1].text)}</span><button class="btn sm" onclick="A.openNoti()">보기</button></div>` : ''}
        <button class="bigbtn primary" onclick="A.go('qr',{kind:'live'})">${I('qr')}<span><b>의료진에게<br>보여주기</b><small>병원·약국 접수대 기계에 보여주세요</small></span></button>
        <button class="bigbtn ${st.done === st.total && st.total ? 'done' : ''}" onclick="A.go('easyTaken')">${I(st.done === st.total && st.total ? 'check' : 'pill')}<span><b>오늘 약<br>먹었어요</b><small>${st.total ? `${st.total}번 중 ${st.done}번 먹었어요` : '오늘 드실 약이 없어요'}</small></span></button>
        <div class="easy-row">
          <button class="btn" onclick="A.go('qr',{kind:'emer'})" style="color:var(--danger);border-color:var(--danger-line)">${I('tri')}응급 QR</button>
          <button class="btn" onclick="A.go('register')">${I('plus')}약 등록</button>
        </div>
        <div style="text-align:center;padding:10px 0 24px"><button class="btn ghost" onclick="A.setMode('basic')" style="font-size:16px;color:var(--muted)">기본 화면으로 바꾸기</button></div>
      </div>`;
  }
  A.readHome = () => {
    const st = takenStat(P);
    MP.speak(`${P.name} 님, 안녕하세요. 오늘 약은 ${st.total}번 중 ${st.done}번 드셨어요. 병원이나 약국에 가시면 '의료진에게 보여주기' 버튼을 누르고, 화면을 접수대 기계에 보여주세요.`);
  };

  function basicHome() {
    const p = P, n = unread(), st = takenStat(p), groups = slotGroups(p);
    const switcher = WHO === 'guardian' ? profileSwitcher() : '';
    return `
      <div class="topbar">${I('sidebar', 'lg')}<h1>약 여권</h1>
        <button class="pill" onclick="A.setMode('easy')">크게 보기</button>
        <button class="iconbtn" onclick="A.openNoti()" aria-label="알림">${I('bell', 'lg')}${n.length ? `<span class="badge-dot">${n.length}</span>` : ''}</button>
      </div>
      <div class="body">
        ${switcher}
        ${n.length ? `<div class="banner">${I('bell')}<span>${esc(n[n.length - 1].text)}</span><button class="btn sm" onclick="A.openNoti()">보기</button></div>` : ''}
        <div class="card pcard">
          <div class="between"><span class="name">${esc(p.name)}</span><span class="meta">${p.sex} · ${MP.age(p.birth)}세 · 혈액형 ${p.blood}</span></div>
          <div class="kv">
            <span>알레르기</span><span class="row" style="flex-wrap:wrap;gap:6px">${p.allergies.length ? p.allergies.map((a) => `<span class="chip danger">${MP.ALLERGY[a].ko}</span>`).join('') : '<span class="faint">없음</span>'}</span>
            <span>기저질환</span><span>${p.conditions.map((c) => MP.COND[c].ko).join(' · ') || '<span class="faint">없음</span>'}</span>
          </div>
        </div>
        <button class="btn primary lg block" style="padding:22px;font-size:20px" onclick="A.go('qr',{kind:'live'})">${I('qr', 'lg')} 의료진에게 보여주기</button>
        <div class="card">
          <div class="between"><b>오늘 복약</b><span class="muted" style="font-size:14px">${st.done} / ${st.total}</span></div>
          <div class="slots" style="margin-top:10px">${groups.map((g) => `<button class="slot ${slotDone(p, g) ? 'done' : ''}" onclick="A.toggleSlot('${g.slot}')">${slotDone(p, g) ? I('check') : '<span style="width:20px;display:inline-block;text-align:center">○</span>'}${g.slot} <span class="faint" style="font-weight:400">${g.meds.length}</span></button>`).join('') || '<span class="faint">오늘 드실 약이 없어요</span>'}</div>
        </div>
        <div class="sec-title"><h2>복용 중인 약 ${p.meds.length}</h2><button class="link" onclick="A.tab('register')">+ 처방전 추가</button></div>
        <div>${p.meds.map(medCard).join('') || '<div class="empty">등록된 약이 없어요</div>'}</div>
        <div class="notice">${I('wifi')}<span>응급 QR 저장됨 · 인터넷이 끊겨도 응급 정보를 보여줄 수 있어요</span></div>
      </div>`;
  }
  function medCard(m) {
    const d = D(m.drug), r = MP.remainDays(m);
    return `<button class="medcard" onclick="A.go('med',{id:'${m.id}'})">
      <div class="between"><span class="t">${d.ko} ${d.strength}</span><span class="mono faint" style="font-size:13px">${d.atc}</span></div>
      <div class="inn">${d.inn}</div>
      <div class="bt"><span>${MP.FREQ[m.freq].ko}</span><span class="${r <= 3 ? 'low' : 'muted'}">남은 ${r}일분</span></div>
    </button>`;
  }

  function profileSwitcher() {
    if (!P.linked || !P.linked.length) return '';
    return `<div class="seg full">${[['me', '내 약 여권'], ...P.linked.map((l) => [l.lid, `${l.label} · ${l.name}`])].map(([k, t]) => `<button class="${S.profile === k ? 'on' : ''}" onclick="A.setProfile('${k}')">${esc(t)}</button>`).join('')}</div>`;
  }
  A.setProfile = (k) => { S.profile = k; S._viewLogged = null; render(true); };

  /* ---------- 쉬운 모드: 오늘 약 ---------- */
  SCREENS.easyTaken = () => {
    const groups = slotGroups(P);
    return `${topbar('오늘 약')}
      <div class="body">
        <div class="easy-sub" style="color:var(--text)">드신 다음 <b>'먹었어요'</b>를 눌러 주세요.</div>
        ${groups.map((g) => { const done = slotDone(P, g); return `<div class="slotcard ${done ? 'done' : ''}">
          <h3>${done ? '✓ ' : ''}${g.slot} 약</h3><div class="names">${g.meds.map((m) => D(m.drug).ko).join(', ')} · ${g.meds.length}개</div>
          <button class="btn ${done ? '' : 'primary'} block" onclick="A.toggleSlot('${g.slot}')">${done ? '먹었어요 (취소하기)' : '먹었어요'}</button></div>`; }).join('') || '<div class="empty">오늘 드실 약이 없어요</div>'}
        <button class="btn block lg" onclick="A.back()">처음으로</button>
      </div>`;
  };

  /* ---------- QR 보여주기 (실시간 / 응급) ---------- */
  SCREENS.qr = (prm) => {
    const kind = prm.kind || 'live';
    const easy = isEasy();
    const segs = `<div class="seg full"><button class="${kind === 'live' ? 'on' : ''}" onclick="A.qrKind('live')">실시간 QR</button><button class="${kind === 'emer' ? 'on' : ''}" onclick="A.qrKind('emer')">응급 QR</button></div>`;
    if (kind === 'live') {
      return `${topbar('의료진에게 보여주기', { right: easy ? `<button class="voicebtn" onclick="A.readQR()">${I('speaker')}</button>` : '' })}
        <div class="body">
          ${segs}
          <div class="card qr-wrap" style="padding:22px 16px">
            <div class="qr-box" id="qrbox"><div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center" class="faint">만드는 중…</div></div>
            <div class="timer" id="qrtimer">05:00</div>
            <div class="muted" style="font-size:${easy ? 17 : 14}px">후 자동으로 새 코드가 만들어집니다</div>
            <hr style="border:0;border-top:1px solid var(--line-2);margin:16px 0">
            <div><b style="font-size:${easy ? 20 : 16}px">${esc(P.name)}</b> <span class="muted">${P.birth} · ${P.blood}</span></div>
          </div>
          <button class="btn block lg" onclick="A.refreshQR()">${I('refresh')} 지금 새로 고침</button>
          ${easy ? `<div class="notice primary" style="font-size:17px">${I('sun', 'lg')}<span>화면 밝기를 크게 하고, 접수대 기계에 화면을 가까이 대 주세요.</span></div>` : `
          <ul class="list-plain card soft" style="padding:12px 16px">
            <li>${I('sun')}<span>화면 밝기를 최대로 올리면 더 잘 읽혀요.</span></li>
            <li>${I('nowifi')}<span>인터넷이 끊기면 위 탭에서 응급 QR로 바꿔 주세요.</span></li>
            <li>${I('lock')}<span>한 번 읽힌 코드는 다시 쓸 수 없고, 누가 언제 열람했는지 모두 기록돼요.</span></li>
          </ul>`}
        </div>`;
    }
    const o = P.emergencyOpts;
    return `${topbar('응급 QR', { right: easy ? `<button class="voicebtn" onclick="A.readQR()">${I('speaker')}</button>` : '' })}
      <div class="body">
        ${segs}
        <div class="card qr-wrap" style="padding:22px 16px;border-color:var(--danger-line)">
          <div class="chip danger" style="margin-bottom:12px">${I('tri')} 응급 · 인터넷 없이 읽힘</div><br>
          <div class="qr-box" id="qrbox"><div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center" class="faint">만드는 중…</div></div>
          <div style="margin-top:12px"><b>${esc(P.name)}</b> <span class="muted">${P.birth} · ${P.blood}</span></div>
        </div>
        <div class="card">
          <b>응급 QR에 넣을 정보</b>
          <div class="muted" style="font-size:14px;margin:2px 0 8px">고르신 정보만 담겨요. 바꾸면 새 QR이 만들어져요.</div>
          ${[['allergy', '알레르기'], ['contact', `보호자 연락처 (${esc(P.emergencyContact?.name || '')} · ${esc(P.emergencyContact?.rel || '')})`], ['meds', '복용 약 · 기저질환']].map(([k, t]) => `
            <label class="permrow"><span>${t}</span><span class="toggle"><input type="checkbox" ${o[k] ? 'checked' : ''} onchange="A.emerOpt('${k}',this.checked)"><span></span></span></label>`).join('')}
        </div>
        <div class="notice">${I('lock')}<span>기준 <b class="mono">${MP.today()} ${MP.hhmm(Date.now())}</b> · 약이나 정보가 바뀌면 자동으로 새 QR이 만들어져요. 인터넷 없이 의료진 단말에서만 열려요.</span></div>
      </div>`;
  };
  A.qrKind = (k) => { S.params = { ...S.params, kind: k }; render(); };
  A.emerOpt = (k, v) => { P.emergencyOpts[k] = v; P.emerSid = null; save(); render(); };
  A.readQR = () => MP.speak(S.params.kind === 'emer' ? '응급 QR이에요. 위급할 때 의료진에게 이 화면을 보여주세요.' : '이 화면을 병원이나 약국 접수대 기계에 보여주세요. 오 분마다 새 코드로 바뀌어요.');
  AFTER.qr = (prm) => {
    const kind = prm.kind || 'live';
    let wake = null;
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => (wake = w)).catch(() => {});
    cleanup.push(() => { try { wake && wake.release(); } catch (e) {} });
    if (kind === 'live') {
      let exp = 0, alive = true;
      cleanup.push(() => (alive = false));
      const make = async () => {
        const payload = MP.buildClinicalPayload(P);
        const code = await MP.encode('D', payload).catch(() => null);
        if (!alive) return;
        if (!code) { document.getElementById('qrbox').innerHTML = '<div class="faint" style="padding:30px">https에서 열어주세요</div>'; return; }
        exp = payload.exp * 1000;
        document.getElementById('qrbox').innerHTML = MP.qrSVG(code);
        MP.save(MP.KEY.shown, { code, type: 'D', ts: Date.now(), pid: P.pid, name: P.name });
      };
      A.refreshQR = () => { make(); MP.toast('새 코드를 만들었어요'); };
      make();
      const t = setInterval(() => {
        const left = Math.round((exp - Date.now()) / 1000);
        const el = document.getElementById('qrtimer'); if (el && exp) el.textContent = MP.mmss(left);
        if (exp && left <= 0) make();
      }, 500);
      cleanup.push(() => clearInterval(t));
      if (isEasy() && P.settings.voice) setTimeout(() => alive && A.readQR(), 400);
    } else {
      (async () => {
        if (!P.emerSid) { P.emerSid = 'E-' + MP.rid(6); save(); }
        const code = await MP.encode('E', MP.buildEmergencyPayload(P, P.emergencyOpts, P.emerSid)).catch(() => null);
        const box = document.getElementById('qrbox'); if (!box) return;
        box.innerHTML = code ? MP.qrSVG(code) : '<div class="faint" style="padding:30px">https에서 열어주세요</div>';
        if (code) MP.save(MP.KEY.shown, { code, type: 'E', ts: Date.now(), pid: P.pid, name: P.name });
      })();
    }
  };

  /* ---------- 약 상세 ---------- */
  SCREENS.med = ({ id }) => {
    const m = P.meds.find((x) => x.id === id); if (!m) return SCREENS.home();
    const d = D(m.drug), f = MP.FREQ[m.freq], r = MP.remainDays(m), rx = P.rx.find((x) => x.id === m.rx) || {};
    const pct = Math.max(4, Math.round((r / m.days) * 100));
    const perDay = f.perDay >= 1 ? f.perDay : 0;
    const pills = perDay ? r * perDay : Math.ceil(r / 7);
    const allergyRel = (d.interact || []).filter((x) => P.allergies.includes(x));
    return `${topbar('약 상세')}
      <div class="body">
        <div class="card row" style="gap:16px;align-items:flex-start">
          <div class="rx-photo" style="width:86px;height:86px">알약<br>사진</div>
          <div class="grow"><div style="font-size:22px;font-weight:800">${d.ko} ${d.strength}</div><div class="muted">${d.inn}</div>
            <div class="row" style="margin-top:8px;flex-wrap:wrap;gap:6px"><span class="chip mono">ATC ${d.atc}</span><span class="chip">${d.cls}</span></div></div>
        </div>
        <div class="card">
          <div class="between"><b>복용법</b><span class="muted" style="font-size:14px">다음 복용 ${f.slots[0]}</span></div>
          <div style="font-size:17px;margin-top:8px">${f.ko}</div>
          <div class="between" style="margin-top:14px;font-size:14px"><span class="muted">남은 수량</span><b>${pills}${d.form} · ${r}일분</b></div>
          <div style="height:8px;background:var(--bg-2);border-radius:4px;margin-top:8px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${r <= 3 ? 'var(--danger)' : 'var(--primary)'}"></div></div>
        </div>
        ${d.caution?.length ? `<div class="alert" style="display:block"><div class="row" style="font-weight:700;margin-bottom:6px">${I('alert')} 주의사항</div><ul style="margin:0;padding-left:20px">${d.caution.map((c, i) => `<li>${c}${i === 0 && allergyRel.length ? ' <b>(등록된 알레르기와 관련)</b>' : ''}</li>`).join('')}</ul></div>` : ''}
        <div class="card">
          <b>해외·다국어 표기</b><div class="muted" style="font-size:14px;margin-top:2px">외국 의료진에게 보여줄 때 함께 표시됩니다.</div>
          <div class="kv" style="grid-template-columns:70px 1fr"><span>English</span><span>${d.en} ${d.strength}, ${f.en.toLowerCase()}</span><span>日本語</span><span>${d.ja} ${d.strength} ${f.ja}</span></div>
        </div>
        <div class="card">
          <b>처방 정보</b>
          <div class="kv" style="grid-template-columns:70px 1fr"><span>처방일</span><span>${m.start} · ${m.days}일분</span><span>의료기관</span><span>${esc(rx.org || '-')}</span><span>등록 방법</span><span>${esc(rx.via || '-')}</span></div>
        </div>
        ${WHO === 'elder' ? `<button class="card between" style="width:100%;text-align:left" onclick="A.tab('guardians')"><span><b>보호자 공유</b><br><span class="muted" style="font-size:14px">① 복약 현황 ${m.inStatus !== false ? '포함' : '제외'} · ② 약 상세 ${m.share ? '공유' : '비공유'}</span></span>${I('eye')}</button>` : ''}
      </div>`;
  };

  /* ---------- 처방 등록 ---------- */
  SCREENS.register = () => `
    ${isEasy() ? topbar('약 등록') : topbar('처방 등록', { backBtn: false })}
    <div class="body">
      <button class="option" onclick="A.go('scan',{expect:'R'})"><div class="ic">${I('qr')}</div><div><b>약국에서 받은 QR 찍기</b><small>약국 안내지의 '처방 등록 QR'을 비춰 주세요. 바로 등록돼요.</small></div></button>
      <button class="option" onclick="A.go('ocr',{step:1})"><div class="ic">${I('camera')}</div><div><b>처방전 사진 찍기</b><small>자동으로 읽은 뒤, 맞는지 확인하고 저장해요.</small></div></button>
      ${isEasy() ? '' : `
      <div class="sec-title"><h2>처방 이력</h2></div>
      <div class="card" style="padding:4px 18px">
        <div class="loglist">${P.rx.map((r) => `<div class="it between"><div><b>${esc(r.org)}</b><div class="muted mono" style="font-size:13px">${r.date} · ${r.count}건</div></div><span class="chip ${r.via === '약국 QR' ? 'primary' : ''}">${esc(r.via)}</span></div>`).join('') || '<div class="empty">아직 없어요</div>'}</div>
      </div>`}
    </div>`;

  /* ---------- QR 스캔 (처방 등록 R / 보호자 연결 G) ---------- */
  SCREENS.scan = ({ expect }) => `
    ${topbar(expect === 'G' ? '보호자 연결 QR 찍기' : '처방 등록 QR 찍기')}
    <div class="body">
      <div class="cam"><video id="camv"></video><div class="frame"></div><div class="msg" id="cammsg">카메라를 켜는 중…</div></div>
      <div class="muted" style="text-align:center;font-size:14px">${expect === 'G' ? '어르신(또는 약국 안내지)의 보호자 연결 QR을 비춰 주세요' : '약국 안내지의 처방 등록 QR을 비춰 주세요'}</div>
      <label class="btn block">${I('image')} 사진에서 QR 읽기<input type="file" accept="image/*" hidden onchange="A.scanFile(this.files[0])"></label>
      <button class="btn block outline" onclick="A.useSample('${expect}')">시연용: ${expect === 'G' ? '최근 만든 보호자 연결 QR' : '최근 약국 안내지 QR'} 사용</button>
      <div id="scanres"></div>
    </div>`;
  AFTER.scan = ({ expect }) => {
    const cam = MP.Camera(document.getElementById('camv'), (text) => handleScan(text, expect), (m) => { const e = document.getElementById('cammsg'); if (e) e.textContent = m; });
    cam.start('environment');
    cleanup.push(() => cam.stop());
  };
  A.scanFile = async (f) => { if (!f) return; const t = await MP.decodeImageFile(f); if (!t) return MP.toast('사진에서 QR을 찾지 못했어요'); handleScan(t, S.params.expect); };
  A.useSample = async (expect) => {
    const last = MP.load(MP.KEY.lastPharmacy, {});
    if (expect === 'R') {
      if (last.R) return handleScan(last.R, 'R');
      const elder = MP.getPersona('elder');
      const code = await MP.encode('R', { v: 1, rid: 'R-' + MP.rid(6), iat: Math.floor(Date.now() / 1000), ph: '온누리약국', org: '행복내과의원', date: MP.today(), pid: elder.pid, n: elder.name, sh: elder.sharing,
        items: [['atorvastatin', 'qd_pm', 30, 0, 1, 1], ...elder.meds.map((m) => [m.drug, m.freq, m.days, m.share ? 1 : 0, m.inStatus === false ? 0 : 1, 0])] });
      return handleScan(code, 'R');
    }
    const inv = MP.load(MP.KEY.lastInvite, null);
    const pick = [last.G && { c: last.G, t: last.ts || 0 }, inv && { c: inv.code, t: inv.ts || 0 }].filter(Boolean).sort((a, b) => b.t - a.t)[0];
    if (pick) return handleScan(pick.c, 'G');
    MP.toast('먼저 어르신 앱(보호자 탭)이나 약국 화면에서 보호자 연결 QR을 만들어 주세요', 3500);
  };

  async function handleScan(text, expect) {
    const r = await MP.decode(text);
    const box = document.getElementById('scanres');
    const fail = (msg) => { if (box) box.innerHTML = `<div class="alert">${I('alert')}<span>${msg}</span></div>`; MP.toast(msg, 3200); setTimeout(() => S.screen === 'scan' && render(), 3000); };
    if (!r.ok) return fail(r.reason === 'insecure' ? 'https 주소에서 열어주세요' : r.reason === 'tamper' ? '훼손되었거나 위조된 QR이에요' : '약 여권 QR이 아니에요');
    if (r.type !== expect) return fail(`이건 ${MP.TYPE_LABEL[r.type]}이에요. ${MP.TYPE_LABEL[expect]}을 찍어 주세요.`);
    if (expect === 'R') return importRx(r.data, fail);
    return importLink(r.data, fail);
  }

  function importRx(d, fail) {
    if (WHO !== 'elder' && d.pid !== P.pid) return fail('처방 등록 QR은 환자 본인 휴대폰에서 찍어 주세요');
    if (d.pid !== P.pid) return fail(`다른 분(${d.n.slice(0, 1)}○○)의 처방이에요`);
    P.importedRx = P.importedRx || [];
    if (P.importedRx.includes(d.rid)) return fail('이미 등록한 처방이에요 (1회용 QR)');
    const rxId = 'rx' + MP.rid(4);
    const added = [];
    d.items.forEach(([drug, freq, days, share, inStatus, isNew]) => {
      const ex = P.meds.find((m) => m.drug === drug);
      if (ex) { ex.share = !!share; ex.inStatus = !!inStatus; if (isNew) { ex.start = d.date; ex.days = days; ex.freq = freq; ex.rx = rxId; added.push(drug); } }
      else if (isNew) { P.meds.push({ id: 'm' + MP.rid(4), drug, freq, days, start: d.date, rx: rxId, share: !!share, inStatus: !!inStatus }); added.push(drug); }
    });
    if (d.sh) P.sharing = d.sh;
    P.rx.unshift({ id: rxId, org: d.org, pharmacy: d.ph, date: d.date, count: added.length, via: '약국 QR' });
    if (d.g && !P.guardians.find((g) => g.id === d.g.id)) P.guardians.push({ ...d.g, status: 'active', since: MP.today(), via: '약국 등록' });
    P.importedRx.push(d.rid);
    P.accessLog.push({ ts: Date.now(), who: d.ph, role: '약사', action: '처방 등록', path: '약국 QR', result: '허용' });
    save();
    MP.markIssuedUsed(d.rid);
    S.stack = []; S.screen = 'done'; S.params = { title: `처방 ${added.length}건이 등록됐어요`, items: added.map(MP.drugName), sub: `${d.ph} · ${d.org} · ${d.date}${d.g ? ` · 보호자 ${d.g.name} 등록` : ''}` };
    render(true);
    if (isEasy() && P.settings.voice) MP.speak(`약 ${added.length}개가 등록됐어요.`);
  }

  async function importLink(d, fail) {
    if (WHO !== 'guardian') return fail('보호자 연결 QR은 보호자 휴대폰에서 찍어 주세요');
    const deny = (reason) => { MP.addAudit({ who: `[보호자] ${P.pid}`, role: '보호자', pid: d.pid, action: '보호자 연결', path: '보호자 위임', result: '거부 · ' + reason, ip: '10.0.8.203' }); };
    if (MP.load(MP.KEY.revokedLinks, []).includes(d.lid)) { deny('취소된 연결 QR'); return fail('약국이나 어르신이 취소한 연결 QR이에요'); }
    if (MP.load(MP.KEY.usedLinks, []).includes(d.lid)) { deny('사용된 연결 QR'); return fail('이미 사용된 연결 QR이에요 (1회용)'); }
    if (d.exp * 1000 < Date.now()) { deny('만료된 연결 QR'); return fail('기간이 지난 연결 QR이에요 (24시간 유효)'); }
    const mine = await MP.phoneHash(P.phone);
    if (d.gph !== mine) { deny('지정 보호자 불일치'); return fail(`이 QR은 ${esc(d.gn)} 님(${esc(d.gpm)}) 전용이에요. 다른 휴대폰에서는 연결할 수 없어요.`); }
    P.linked = P.linked || [];
    if (P.linked.find((l) => l.pid === d.pid)) return fail('이미 연결된 분이에요');
    const label = d.gt === 'care' ? '돌봄 대상' : ['아들', '딸', '자녀'].includes(d.rel) ? (d.s === '남' ? '아버지' : '어머니') : '가족';
    P.linked.push({ lid: d.lid, pid: d.pid, name: d.n, birth: d.b, s: d.s, label, rel: d.rel, gt: d.gt, perm: d.perm, st: d.st, dm: d.dm || [], eq: d.eq || null, since: MP.today(), snapAt: d.iat * 1000 });
    save();
    const ul = MP.load(MP.KEY.usedLinks, []); ul.push(d.lid); MP.save(MP.KEY.usedLinks, ul);
    MP.markIssuedUsed(d.lid);
    MP.addAudit({ who: `[보호자] ${P.pid}`, role: '보호자', pid: d.pid, action: '보호자 연결', path: '보호자 위임', result: '허용', ip: '10.0.8.203' });
    const elder = MP.load(MP.KEY.elder, null);
    if (elder && elder.pid === d.pid) {
      elder.notifications = elder.notifications || [];
      elder.notifications.push({ ts: Date.now(), text: `${d.rel} ${P.name} 님이 보호자로 연결됐어요. 원하지 않으면 보호자 탭에서 해지하세요.`, read: false });
      elder.accessLog.push({ ts: Date.now(), who: `${P.name} (${d.rel})`, role: '보호자', action: '보호자 연결', path: '보호자 위임', result: '허용' });
      MP.save(MP.KEY.elder, elder);
    }
    S.stack = []; S.screen = 'home'; S.profile = d.lid; S._viewLogged = null;
    render(true);
    MP.toast(`${d.n} 님과 연결됐어요`);
  }

  SCREENS.done = ({ title, items, sub }) => `
    <div class="body" style="padding-top:60px;text-align:center">
      <div style="width:84px;height:84px;border-radius:50%;background:var(--ok-bg);color:var(--ok);display:flex;align-items:center;justify-content:center;margin:0 auto">${I('check', 'xl')}</div>
      <h2 style="font-size:24px;margin:20px 0 6px">${esc(title)}</h2>
      <div class="muted">${esc(sub || '')}</div>
      <div class="card" style="text-align:left;margin-top:20px">${(items || []).map((t) => `<div class="row" style="padding:6px 0">${I('pill')}<b>${esc(t)}</b></div>`).join('') || '<span class="muted">새로 추가된 약은 없어요 (공유 설정만 갱신)</span>'}</div>
      <button class="btn primary lg block" style="margin-top:20px" onclick="A.tab('home')">확인</button>
    </div>`;

  /* ---------- 처방전 촬영 (OCR 확인 흐름 · 시연용 고정 결과) ---------- */
  const OCR_RESULT = {
    org: '튼튼정형외과', items: [
      { status: 'ok', drug: 'alendronate', freq: 'qw_am', days: 28, raw: '알렌드론산나트륨정70mg' },
      { status: 'check', raw: '세레콕시브캡슐 200mg (흐림)', cands: ['celecoxib', 'cetirizine'], freq: 'bid_pc', days: 14 },
      { status: 'ok', drug: 'esomeprazole', freq: 'qd_am', days: 14, raw: '에스오메프라졸마그네슘삼수화물20mg' },
    ],
  };
  SCREENS.ocr = (prm) => {
    const step = prm.step || 1;
    const stepper = `<div class="stepper"><span class="${step === 1 ? 'on' : ''}">1 촬영</span><i>›</i><span class="${step === 2 ? 'on' : ''}">2 자동 인식</span><i>›</i><span class="${step === 3 ? 'on' : ''}">3 확인</span></div>`;
    const photo = prm.img ? `<img src="${prm.img}">` : prm.sample ? '샘플<br>처방전' : '처방전 사진';
    if (step === 1) return `${topbar('처방전 사진 찍기')}${stepper}
      <div class="body">
        <div class="rx-sample"><div class="h">처 방 전</div>
          <div>의료기관: 튼튼정형외과 &nbsp; 교부일: ${MP.today()}</div><div>환자: ${esc(P.name)} (${P.birth.slice(2, 4)}${P.birth.slice(5, 7)}${P.birth.slice(8, 10)}-2******)</div>
          <hr style="border:0;border-top:1px dashed #bbb">
          <div>1. 알렌드론산나트륨정70mg &nbsp; 1 1 4</div><div class="blur">2. 세레콕시브캡슐 200mg &nbsp; 1 2 14</div><div>3. 에스오메프라졸마그네슘삼수화물20mg &nbsp; 1 1 14</div>
        </div>
        <div class="muted" style="font-size:14px;text-align:center">처방전 전체가 보이게, 밝은 곳에서 찍어 주세요.</div>
        <label class="btn primary lg block">${I('camera')} 사진 찍기<input type="file" accept="image/*" capture="environment" hidden onchange="A.ocrPhoto(this.files[0])"></label>
        <button class="btn block" onclick="A.ocrSample()">위 샘플 처방전으로 해보기</button>
        <div class="notice">${I('lock')}<span>시연 버전은 어떤 사진을 올려도 위 샘플 처방전 결과를 보여줘요. 사진은 저장되지 않아요.</span></div>
      </div>`;
    if (step === 2) return `${topbar('처방전 사진 찍기')}${stepper}
      <div class="body" style="text-align:center;padding-top:50px">
        <div class="rx-photo" style="margin:0 auto;width:160px;height:160px">${photo}</div>
        <h3 style="margin:24px 0 6px">처방전을 읽고 있어요…</h3>
        <div class="muted">약 이름을 표준 성분명(INN)과 ATC 코드로 맞추는 중</div>
        <div style="height:6px;background:var(--bg-2);border-radius:3px;margin:24px 30px;overflow:hidden"><div id="ocrbar" style="height:100%;width:5%;background:var(--primary);transition:width 1.5s ease"></div></div>
      </div>`;
    const sel = prm.sel;
    return `${topbar('처방전 인식 결과')}${stepper}
      <div class="body">
        <div class="row" style="gap:14px;align-items:flex-start">
          <div class="rx-photo">${photo}</div>
          <div><b style="font-size:17px">${OCR_RESULT.org}</b><div class="muted">발급일 ${MP.today()}</div><div class="muted">인식된 약품 ${OCR_RESULT.items.length}건</div>
          <button class="btn sm" style="margin-top:8px" onclick="A.go('ocr',{step:1})">다시 촬영</button></div>
        </div>
        ${sel ? '' : `<div class="alert">${I('alert')}<span>1건은 자동 인식 신뢰도가 낮습니다. 직접 확인해 주세요.</span></div>`}
        ${OCR_RESULT.items.map((it, i) => {
          if (it.status === 'ok') { const d = D(it.drug); return `<div class="card"><div class="between"><b style="font-size:18px">${d.ko} ${d.strength}</b><span class="chip ok">자동 확인</span></div>
            <div class="raw">원문 · ${it.raw}</div><div class="between"><span class="mono muted" style="font-size:13px">ATC ${d.atc} · INN ${d.innShort}</span><button class="btn sm" onclick="MP.toast('시연에서는 수정 화면을 생략했어요')">수정</button></div></div>`; }
          return `<div class="card" style="border-color:${sel ? 'var(--line)' : 'var(--danger-line)'}"><div class="between"><b style="font-size:18px">${sel ? `${D(sel).ko} ${D(sel).strength}` : '[약품명 확인 필요]'}</b><span class="chip ${sel ? 'ok' : 'danger'}">${sel ? '직접 확인' : '확인 필요'}</span></div>
            <div class="raw">원문 · ${it.raw}</div>
            ${sel ? `<div class="mono muted" style="font-size:13px">ATC ${D(sel).atc} · INN ${D(sel).innShort}</div>` : `<div style="color:var(--danger);font-size:14px;margin-bottom:8px">후보 2개 중 선택해 주세요</div>`}
            <div class="row" style="margin-top:8px">${it.cands.map((c) => `<button class="btn sm ${sel === c ? 'primary' : 'outline'}" onclick="A.ocrPick('${c}')">${D(c).ko} ${D(c).strength}</button>`).join('')}</div></div>`;
        }).join('')}
        <button class="btn primary lg block" ${sel ? '' : 'disabled'} onclick="A.ocrSave()">약 여권에 저장하기</button>
        <div class="muted" style="text-align:center;font-size:14px">저장 후에도 언제든 수정할 수 있어요</div>
      </div>`;
  };
  A.ocrPhoto = (f) => { if (!f) return; const url = URL.createObjectURL(f); S.params = { step: 2, img: url }; render(true); };
  A.ocrSample = () => { S.params = { step: 2, sample: true }; render(true); };
  AFTER.ocr = (prm) => {
    if (prm.step !== 2) return;
    setTimeout(() => { const b = document.getElementById('ocrbar'); if (b) b.style.width = '100%'; }, 50);
    const t = setTimeout(() => { S.params = { ...prm, step: 3 }; render(true); }, 1800);
    cleanup.push(() => clearTimeout(t));
  };
  A.ocrPick = (c) => { S.params = { ...S.params, sel: c }; render(); };
  A.ocrSave = () => {
    const rxId = 'rx' + MP.rid(4), added = [], skipped = [];
    OCR_RESULT.items.forEach((it) => {
      const drug = it.drug || S.params.sel;
      if (P.meds.find((m) => m.drug === drug)) { skipped.push(drug); return; }
      P.meds.push({ id: 'm' + MP.rid(4), drug, freq: it.freq, days: it.days, start: MP.today(), rx: rxId, ...MP.newMedShare() });
      added.push(drug);
    });
    if (!P.conditions.includes('osteo')) P.conditions.push('osteo');
    if (added.length) P.rx.unshift({ id: rxId, org: OCR_RESULT.org, pharmacy: '-', date: MP.today(), count: added.length, via: '처방전 촬영' });
    save();
    S.stack = []; S.screen = 'done';
    S.params = { title: added.length ? `약 ${added.length}개를 저장했어요` : '이미 모두 등록된 약이에요', items: added.map(MP.drugName), sub: `${OCR_RESULT.org} · 보호자에게는 복약 현황(합계)에만 포함돼요${skipped.length ? ` · 중복 ${skipped.length}건 제외` : ''}` };
    render(true);
  };

  /* ---------- 보호자 관리 (어르신) ---------- */
  const toggle = (on, js) => `<span class="toggle"><input type="checkbox" ${on ? 'checked' : ''} onchange="${js}"><span></span></span>`;
  SCREENS.guardians = () => {
    const gs = P.guardians, sh = P.sharing || MP.defaultSharing();
    return `${topbar('보호자 관리', { backBtn: false })}
      <div class="body">
        <div class="muted" style="font-size:15px">보호자는 내가 허락한 만큼만 볼 수 있어요. 끄거나 해지하면 바로 적용돼요.</div>
        <div class="sec-title" style="margin-top:6px"><h2>연결된 보호자 ${gs.length}</h2><span class="faint" style="font-size:13px">최대 3명</span></div>
        ${gs.map((g) => `<div class="card gcard">
          <div class="head"><div class="avatar">${esc(g.name.slice(0, 1))}</div><div class="grow"><b style="font-size:17px">${esc(g.name)}</b><div class="muted" style="font-size:14px">${esc(g.rel)} · ${esc(g.phone || '')} · ${esc(g.via || '앱에서 초대')}</div></div>
            <span class="chip ${g.type === 'care' ? 'primary' : 'ok'}">${g.type === 'care' ? '보건소 담당' : '가족'}</span></div>
          <div style="margin-top:12px">
            <label class="permrow"><span>① 복약 현황 보기</span>${toggle(g.perms.status, `A.gPerm('${g.id}','status',this.checked)`)}</label>
            <label class="permrow"><span>② 약 상세 보기</span>${toggle(g.perms.detail, `A.gPerm('${g.id}','detail',this.checked)`)}</label>
            <label class="permrow"><span>응급 QR 대신 보여주기</span>${toggle(g.perms.emergencyQR, `A.gPerm('${g.id}','emergencyQR',this.checked)`)}</label>
          </div>
          <button class="btn danger block" style="margin-top:12px" onclick="A.unlink('${g.id}')">연결 해지</button>
        </div>`).join('') || `<div class="card empty">${I('users')}<div style="margin-top:8px">아직 연결된 보호자가 없어요.<br>보호자 없이도 약 여권은 모두 쓸 수 있어요.</div></div>`}
        <button class="btn outline lg block" onclick="A.invite()">${I('plus')} 보호자 초대하기</button>

        <div class="sec-title"><h2>보호자에게 공유하는 것</h2><button class="link" onclick="A.previewGuardian()">미리보기</button></div>
        <div class="card">
          <div class="between"><div><b style="font-size:16px">① 복약 현황</b><div class="muted" style="font-size:14px">고른 약들을 <b>합쳐서</b> 다 드셨는지만 보여요. 약 이름과 개수는 안 보여요.</div></div>${toggle(sh.status, 'A.shStatus(this.checked)')}</div>
          ${sh.status ? `
          <div class="seg full small" style="margin-top:12px">${Object.entries(MP.SHARE_LVL).map(([k, t]) => `<button class="${sh.lvl === k ? 'on' : ''}" onclick="A.shLvl('${k}')">${t}</button>`).join('')}</div>
          ${sh.lvl === 'slot' ? `<div class="alert warn" style="margin-top:10px;font-size:14px">${I('alert')}<span>시간대 단위는 아침·저녁·자기 전처럼 <b>약 먹는 시간대</b>가 보여요.</span></div>` : ''}
          <div class="muted" style="font-size:13px;margin:14px 0 2px">복약 현황에 포함할 약</div>
          ${P.meds.map((m) => `<label class="permrow"><span>${MP.drugName(m.drug)}${D(m.drug).sensitive ? ' <span class="chip warn" style="font-size:11px;padding:1px 6px">민감</span>' : ''}</span><input type="checkbox" style="width:20px;height:20px;accent-color:var(--primary)" ${m.inStatus !== false ? 'checked' : ''} onchange="A.medInc('${m.id}',this.checked)"></label>`).join('')}` : ''}
        </div>
        <div class="card">
          <b style="font-size:16px">② 약 상세</b><div class="muted" style="font-size:14px">켠 약만 이름·함량·복용법·복용 여부가 보여요. 처음에는 모두 꺼져 있어요.</div>
          <div style="margin-top:8px">${P.meds.map((m) => `<label class="permrow"><span>${MP.drugName(m.drug)}${D(m.drug).sensitive ? ' <span class="chip warn" style="font-size:11px;padding:1px 6px">민감</span>' : ''}</span>${toggle(m.share, `A.medShare('${m.id}',this.checked)`)}</label>`).join('')}</div>
        </div>
        <div class="notice">${I('shield')}<span>상세 공유하지 않은 약은 개수나 시간으로도 드러나지 않아요. 보호자가 볼 때마다 알림이 오고, 기록은 내 정보 › 열람 기록에 남아요.</span></div>
      </div>`;
  };
  A.shStatus = (v) => { P.sharing = { ...(P.sharing || MP.defaultSharing()), status: v }; save(); render(); MP.toast(v ? '복약 현황 공유를 켰어요' : '복약 현황 공유를 껐어요'); };
  A.shLvl = (l) => { P.sharing.lvl = l; save(); render(); };
  A.medInc = (id, v) => { const m = P.meds.find((x) => x.id === id); m.inStatus = v; save(); MP.toast(`${D(m.drug).ko}: 복약 현황 ${v ? '포함' : '제외'}`); };
  A.medShare = (id, v) => { const m = P.meds.find((x) => x.id === id); m.share = v; save(); MP.toast(`${D(m.drug).ko}: 약 상세 ${v ? '공유' : '비공유'}`); };
  A.gPerm = (id, k, v) => { const g = P.guardians.find((x) => x.id === id); g.perms[k] = v; save(); MP.toast('바로 적용됐어요'); };
  A.unlink = (id) => {
    const g = P.guardians.find((x) => x.id === id);
    modal(`<h3 style="margin-top:0">${esc(g.name)} 님과 연결을 해지할까요?</h3><p class="muted">해지하면 보호자 화면에서 즉시 접근이 차단돼요. 다시 연결하려면 새로 초대해야 해요.</p>
      <div class="row" style="margin-top:16px"><button class="btn grow" onclick="A.closeModal()">취소</button><button class="btn primary grow" style="background:var(--danger);border-color:var(--danger)" onclick="A.doUnlink('${id}')">해지하기</button></div>`);
  };
  A.doUnlink = (id) => {
    const g = P.guardians.find((x) => x.id === id);
    P.guardians = P.guardians.filter((x) => x.id !== id);
    const rl = MP.load(MP.KEY.revokedLinks, []); rl.push(id); MP.save(MP.KEY.revokedLinks, rl);
    P.accessLog.push({ ts: Date.now(), who: '환자 본인', role: '환자', action: `보호자(${g.name}) 연결 해지`, path: '앱', result: '허용' });
    save(); A.closeModal(); render(); MP.toast('해지했어요. 보호자 화면에서 바로 차단돼요.');
  };
  A.invite = () => {
    const sh = P.sharing || MP.defaultSharing();
    modal(`<div class="between"><h3 style="margin:0">보호자 초대하기</h3><button class="btn ghost sm" onclick="A.closeModal()">${I('x')}</button></div>
      <div class="stack" style="margin-top:14px">
        <div><div class="muted" style="font-size:13px;margin-bottom:6px">누구를 연결할까요?</div><div class="seg full" id="gtype"><button class="on" data-v="family" onclick="A.pickType(this)">가족</button><button data-v="care" onclick="A.pickType(this)">보건소 돌봄 담당자</button></div></div>
        <div class="row" style="gap:10px"><label class="field grow"><span>이름</span><input class="input" id="gname" value="김민수"></label><label class="field grow"><span>나와의 관계</span><input class="input" id="grel" value="아들"></label></div>
        <label class="field"><span>보호자 휴대폰 번호 (이 번호의 휴대폰에서만 연결돼요)</span><input class="input mono" id="gphone" value="010-9876-5432" inputmode="tel"></label>
        <div class="notice">${I('eye')}<span>지금 공유 설정: ① 복약 현황 ${sh.status ? `${MP.SHARE_LVL[sh.lvl]} (약 ${P.meds.filter((m) => m.inStatus !== false).length}개 합계)` : '꺼짐'} · ② 약 상세 ${P.meds.filter((m) => m.share).length}개</span></div>
        <button class="btn primary block lg" onclick="A.makeInvite()">연결 QR 만들기</button>
      </div>`);
  };
  A.pickType = (b) => { b.parentElement.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); const care = b.dataset.v === 'care'; document.getElementById('gname').value = care ? '박○○ 간호사' : '김민수'; document.getElementById('grel').value = care ? '○○구 보건소 방문간호' : '아들'; document.getElementById('gphone').value = care ? '010-5555-0199' : '010-9876-5432'; };
  A.makeInvite = async () => {
    const type = document.querySelector('#gtype .on').dataset.v;
    const phone = document.getElementById('gphone').value.trim();
    if (MP.normPhone(phone).length < 10) return MP.toast('보호자 휴대폰 번호를 확인해 주세요');
    const g = { id: 'G-' + MP.rid(6), name: document.getElementById('gname').value.trim() || '보호자', rel: document.getElementById('grel').value.trim() || '가족', type, phone: MP.maskPhone(phone), perms: { status: true, detail: true, emergencyQR: true }, status: 'active', since: MP.today(), via: '앱에서 초대' };
    const payload = MP.buildGuardianPayload(P, { ...g, phone }, await MP.phoneHash(phone));
    payload.eq = await MP.encode('E', MP.buildEmergencyPayload(P, P.emergencyOpts, P.emerSid || 'E-' + MP.rid(6)));
    const code = await MP.encode('G', payload);
    P.guardians.push(g); save();
    MP.save(MP.KEY.lastInvite, { code, ts: Date.now() });
    modal(`<div style="text-align:center"><h3 style="margin-top:0">보호자 휴대폰으로 찍어 주세요</h3>
      <div class="qr-box" style="width:280px">${MP.qrSVG(code)}</div>
      <div class="muted" style="margin-top:12px;font-size:14px">1회용 · 24시간 유효 · ${esc(g.name)} (${esc(g.phone)}) 휴대폰 전용</div>
      <button class="btn primary block" style="margin-top:16px" onclick="A.closeModal();A.render()">완료</button></div>`);
  };
  A.previewGuardian = () => {
    modal(`<div class="between"><h3 style="margin:0">보호자에게 이렇게 보여요</h3><button class="btn ghost sm" onclick="A.closeModal()">${I('x')}</button></div>
      <div style="margin-top:12px" class="stack">${familyBlocks(MP.guardianSummary(P), { status: true, detail: true }, true, '어머니')}</div>
      <div class="muted" style="font-size:13px;margin-top:10px">보호자별로 ①·② 보기 권한을 따로 끌 수도 있어요.</div>`);
  };

  /* ---------- 보호자 화면 블록 ---------- */
  function slotChips(slots, live) {
    return slots.map((x) => live ? `<span class="chip ${x.done ? 'ok' : ''}">${x.done ? '✓ ' : '○ '}${x.s}</span>` : `<span class="chip">${x.s}</span>`).join('') || '<span class="faint" style="font-size:13px">오늘 없음</span>';
  }
  function familyBlocks(sum, perm, live, who) {
    let html = '';
    if (perm.status) {
      const st = sum.status;
      let inner;
      if (!st) inner = `<div class="muted">복약 현황 공유가 꺼져 있어요.</div>`;
      else if (!live) inner = `<div class="muted" style="font-size:14px">연결 시점 정보라 오늘 복용 여부는 알 수 없어요.</div>${st.lvl === 'slot' && st.slots ? `<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${st.slots.map((s) => `<span class="chip">${s}</span>`).join('')}</div>` : ''}`;
      else if (!st.any) inner = `<div style="font-size:18px;font-weight:700">오늘 드실 약이 없어요</div>`;
      else if (st.lvl === 'day') inner = st.done ? `<div class="row" style="font-size:19px;font-weight:800;color:var(--ok)">${I('check', 'lg')} 오늘 약을 다 드셨어요</div>` : `<div class="row" style="font-size:19px;font-weight:800;color:var(--warn)">${I('pill', 'lg')} 아직 드실 약이 남았어요</div>`;
      else inner = `<div class="row" style="gap:6px;flex-wrap:wrap">${slotChips(st.slots, true)}</div>`;
      html += `<div class="card"><div class="between"><b>① 오늘 복약 현황</b>${st ? `<span class="chip">${MP.SHARE_LVL[st.lvl]}</span>` : ''}</div><div style="margin-top:10px">${inner}</div></div>`;
    }
    if (perm.detail) {
      html += `<div class="card"><b>② 공유된 약</b>${sum.details.length ? sum.details.map((d) => `<div style="padding:10px 0;border-bottom:1px solid var(--line-2)"><div class="between"><b>${MP.drugName(d.drug)}</b><span class="muted" style="font-size:13px">${MP.FREQ[d.freq].short}</span></div><div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">${slotChips(d.slots, live)}</div></div>`).join('') : `<div class="muted" style="margin-top:8px">상세 공유된 약이 없어요.</div>`}</div>`;
    }
    if (!perm.status && !perm.detail) html = `<div class="alert info">${I('eyeoff')}<span>공유가 모두 꺼져 있어요.</span></div>`;
    return html;
  }

  /* ---------- 보호자: 가족 약 여권 보기 ---------- */
  function familyView() {
    const l = (P.linked || []).find((x) => x.lid === S.profile);
    if (!l) { S.profile = 'me'; return basicHome(); }
    const revoked = MP.load(MP.KEY.revokedLinks, []).includes(l.lid);
    const elder = MP.load(MP.KEY.elder, null);
    const live = !!(elder && elder.pid === l.pid && elder.taken?.date === MP.today());
    const liveG = live ? (elder.guardians || []).find((g) => g.id === l.lid) : null;
    const perm = liveG ? liveG.perms : l.perm;
    const sum = live ? MP.guardianSummary(elder) : { status: l.st ? { lvl: l.st.lvl, slots: l.st.slots } : null, details: (l.dm || []).map(([drug, freq]) => ({ drug, freq, slots: MP.FREQ[freq].slots.map((s) => ({ s, done: false })) })) };
    let body;
    if (revoked) body = `<div class="alert">${I('lock', 'lg')}<div><b>${esc(l.name)} 님이 연결을 해지했어요</b><br>더 이상 정보를 볼 수 없어요. 필요하면 다시 초대를 받아 주세요.</div></div>
      <button class="btn danger block" onclick="A.removeLinked('${l.lid}')">목록에서 지우기</button>`;
    else body = `${familyBlocks(sum, perm, live, esc(l.name) + ' 님')}
        ${live ? '' : '<div class="muted" style="font-size:13px">시연 버전은 휴대폰끼리 서버 없이 연결해서, 다른 휴대폰에서는 연결 시점의 공유 범위만 보여요. 실제 서비스에서는 실시간으로 갱신돼요.</div>'}
        ${perm.emergencyQR && l.eq ? `<button class="btn block lg" style="color:var(--danger);border-color:var(--danger-line)" onclick="A.go('proxyQR',{lid:'${l.lid}'})">${I('tri')} 응급 QR 대신 보여주기</button>` : ''}
        <div class="notice">${I('lock')}<span>${esc(l.name)} 님이 허락한 정보만 보여요. 공유하지 않은 약은 개수도 보이지 않아요. 내가 볼 때마다 ${esc(l.name)} 님에게 알림이 가요.</span></div>`;
    return `<div class="topbar">${I('sidebar', 'lg')}<h1>약 여권</h1></div>
      <div class="body">${profileSwitcher()}
        <div class="card pcard"><div class="between"><span class="name">${esc(l.name)}</span><span class="chip ${l.gt === 'care' ? 'primary' : 'ok'}">${esc(l.label)}</span></div>
          <div class="meta">${MP.age(l.birth)}세 · ${l.since}부터 연결 · ${l.gt === 'care' ? '보건소 돌봄 담당' : '가족 보호자'}</div></div>
        ${body}
      </div>`;
  }
  AFTER.home = () => {
    if (WHO !== 'guardian' || S.profile === 'me' || S._viewLogged === S.profile) return;
    const l = (P.linked || []).find((x) => x.lid === S.profile); if (!l) return;
    S._viewLogged = S.profile;
    if (MP.load(MP.KEY.revokedLinks, []).includes(l.lid)) {
      MP.addAudit({ who: `[보호자] ${P.pid}`, role: '보호자', pid: l.pid, action: '복약 현황 조회', path: '보호자 위임', result: '거부 · 위임 철회됨', ip: '10.0.8.203' });
      return;
    }
    MP.addAudit({ who: `[보호자] ${P.pid}`, role: '보호자', pid: l.pid, action: '복약 현황 조회', path: '보호자 위임', result: '허용', ip: '10.0.8.203' });
    const elder = MP.load(MP.KEY.elder, null);
    if (elder && elder.pid === l.pid) {
      elder.notifications = elder.notifications || [];
      elder.notifications.push({ ts: Date.now(), text: `${l.rel} ${P.name} 님이 공유된 복약 정보를 확인했어요`, read: false });
      elder.accessLog.push({ ts: Date.now(), who: `${P.name} (${l.rel})`, role: '보호자', action: '복약 현황 조회', path: '보호자 위임', result: '허용' });
      MP.save(MP.KEY.elder, elder);
    }
  };
  A.removeLinked = (lid) => { P.linked = P.linked.filter((x) => x.lid !== lid); save(); S.profile = 'me'; render(true); };

  SCREENS.proxyQR = ({ lid }) => {
    const l = P.linked.find((x) => x.lid === lid);
    return `${topbar(`${esc(l.name)} 님 응급 QR`)}
      <div class="body">
        <div class="card qr-wrap" style="border-color:var(--danger-line)"><div class="chip danger" style="margin-bottom:12px">${I('tri')} 응급 · 대신 보여주기</div><br>
          <div class="qr-box">${MP.qrSVG(l.eq)}</div><div style="margin-top:12px"><b>${esc(l.name)}</b> <span class="muted">${l.birth}</span></div></div>
        <div class="notice">${I('lock')}<span>암호화된 QR이라 보호자도 내용은 볼 수 없어요. 의료진 단말에서만 열려요.</span></div>
      </div>`;
  };
  AFTER.proxyQR = ({ lid }) => { const l = P.linked.find((x) => x.lid === lid); if (l?.eq) MP.save(MP.KEY.shown, { code: l.eq, type: 'E', ts: Date.now(), pid: l.pid, name: l.name }); };

  /* ---------- 보호자: 가족 탭 ---------- */
  SCREENS.family = () => `
    ${topbar('가족', { backBtn: false })}
    <div class="body">
      <div class="muted" style="font-size:15px">가족이 허락한 범위 안에서 복약 현황을 함께 볼 수 있어요.</div>
      ${(P.linked || []).map((l) => `<button class="card gcard" style="width:100%;text-align:left" onclick="A.setProfile('${l.lid}');A.tab('home')">
        <div class="head"><div class="avatar">${esc(l.name.slice(0, 1))}</div><div class="grow"><b style="font-size:17px">${esc(l.name)}</b><div class="muted" style="font-size:14px">${esc(l.label)} · ${l.since}부터</div></div>
        ${MP.load(MP.KEY.revokedLinks, []).includes(l.lid) ? '<span class="chip danger">해지됨</span>' : '<span class="chip ok">활성</span>'}</div></button>`).join('') || `<div class="card empty">${I('users')}<div style="margin-top:8px">연결된 가족이 없어요</div></div>`}
      <button class="btn primary lg block" onclick="A.go('scan',{expect:'G'})">${I('scan')} 보호자 연결 QR 찍기</button>
      <div class="notice">${I('alert')}<span>연결 QR은 어르신 앱이나 약국에서 받을 수 있어요. 1회용이고 24시간 뒤 만료돼요.</span></div>
    </div>`;

  /* ---------- 내 정보 / 열람 기록 ---------- */
  SCREENS.me = () => `
    ${isEasy() ? topbar('설정') : topbar('내 정보', { backBtn: false })}
    <div class="body">
      <div class="card pcard"><div class="between"><span class="name">${esc(P.name)}</span><span class="mono faint">${P.pid}</span></div>
        <div class="kv"><span>생년월일</span><span>${P.birth} (${MP.age(P.birth)}세)</span><span>혈액형</span><span>${P.blood}</span><span>응급 연락</span><span>${esc(P.emergencyContact?.name || '-')} · ${esc(P.emergencyContact?.rel || '')} · ${esc(P.emergencyContact?.phone || '')}</span></div></div>
      <div class="card">
        <b>화면 보기</b>
        <div class="seg full" style="margin-top:10px"><button class="${isEasy() ? 'on' : ''}" onclick="A.setMode('easy')">크게 보기</button><button class="${!isEasy() ? 'on' : ''}" onclick="A.setMode('basic')">기본</button></div>
        <label class="permrow" style="margin-top:12px"><span>음성 안내</span><span class="toggle"><input type="checkbox" ${P.settings.voice ? 'checked' : ''} onchange="A.setVoice(this.checked)"><span></span></span></label>
      </div>
      <button class="option" onclick="A.go('log')"><div class="ic">${I('eye')}</div><div class="grow"><b>열람 기록</b><small>누가 언제 내 정보를 봤는지</small></div></button>
      <button class="option" onclick="A.openNoti()"><div class="ic">${I('bell')}</div><div class="grow"><b>알림</b><small>${unread().length}개 읽지 않음</small></div></button>
      <button class="btn block" onclick="A.resetDemo()">시연 데이터 초기화</button>
    </div>`;
  A.setVoice = (v) => { P.settings.voice = v; save(); };
  A.resetDemo = () => { if (confirm('모든 시연 데이터를 처음 상태로 되돌릴까요?')) { MP.resetAll(); location.reload(); } };

  SCREENS.log = () => {
    const rows = [...(P.accessLog || []), ...MP.getAudit().filter((a) => a.pid === P.pid && a.role !== '보호자').map((a) => ({ ...a, who: a.who.replace(/^\[[^\]]+\]\s*/, '') }))]
      .sort((a, b) => b.ts - a.ts);
    const seen = new Set();
    const uniq = rows.filter((r) => { const k = r.ts + r.action; if (seen.has(k)) return false; seen.add(k); return true; });
    return `${topbar('열람 기록')}
      <div class="body">
        <div class="notice primary">${I('shield')}<span>내 정보를 누가, 언제, 어떤 방법으로 봤는지 모두 기록돼요. 이상한 기록이 있으면 약국이나 고객센터에 알려주세요.</span></div>
        <div class="card" style="padding:4px 18px"><div class="loglist">${uniq.map((r) => `<div class="it">
          <div class="between"><b>${esc(r.who)}</b><span class="chip ${/거부/.test(r.result) ? 'danger' : 'ok'}">${esc(r.result.split(' · ')[0])}</span></div>
          <div class="muted" style="font-size:14px">${esc(r.action)} · ${esc(r.path)}</div>
          <div class="faint mono" style="font-size:12px">${MP.dateStr(r.ts)} ${MP.hhmm(r.ts)}</div></div>`).join('') || '<div class="empty">기록이 없어요</div>'}</div></div>
      </div>`;
  };

  /* ---------------- 모달 ---------------- */
  function modal(html) { document.getElementById('modal-root').innerHTML = `<div class="modal-back" onclick="if(event.target===this)A.closeModal()"><div class="modal">${html}</div></div>`; }
  A.closeModal = () => (document.getElementById('modal-root').innerHTML = '');
  A.render = () => render();

  /* ---------------- 다른 탭(의료진 화면 등)에서 바뀐 내용 실시간 반영 ---------------- */
  MP.onSync((e) => {
    const before = unread().length;
    P = MP.getPersona(WHO);
    if (S.screen === 'qr' || S.screen === 'scan' || S.screen === 'ocr') { if (unread().length > before) MP.toast('🔔 ' + unread()[unread().length - 1].text, 3500); return; }
    if (document.getElementById('modal-root').innerHTML) return;
    render();
    if (unread().length > before) MP.toast('🔔 ' + unread()[unread().length - 1].text, 3500);
  });
  window.addEventListener('resize', () => document.body.classList.toggle('framed', !IN_FRAME && window.innerWidth > 600));

  if (window.speechSynthesis?.getVoices) window.speechSynthesis.getVoices();
  render(true);
})();
