// 인증 흐름 + 라우터
(function () {
  const { sb, state, err, toast } = App;

  const screens = {
    auth: document.getElementById('auth-screen'),
    pending: document.getElementById('pending-screen'),
    app: document.getElementById('app'),
  };
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => { el.hidden = k !== name; });
  }

  // ---------- 라우터 ----------
  const ROUTES = [
    [/^#?\/?$/, (m) => App.viewDashboard(m)],
    [/^#\/customers$/, (m) => App.viewCustomers(m)],
    [/^#\/customers\/([\w-]+)$/, (m, id) => App.viewCustomerDetail(m, id)],
    [/^#\/quotes$/, (m) => App.viewQuotes(m)],
    [/^#\/quotes\/([\w-]+)$/, (m, id) => App.viewQuoteDetail(m, id)],
    [/^#\/contracts$/, (m) => App.viewContracts(m)],
    [/^#\/contracts\/([\w-]+)$/, (m, id) => App.viewContractDetail(m, id)],
    [/^#\/expiry$/, (m) => App.viewExpiry(m)],
    [/^#\/vehicles$/, (m) => App.viewVehicles(m)],
    [/^#\/financiers$/, (m) => App.viewFinanciers(m)],
    [/^#\/commissions$/, (m) => App.viewCommissions(m)],
    [/^#\/settings$/, (m) => App.viewSettings(m)],
  ];
  const NAV_KEY = {
    customers: /^#\/customers/, quotes: /^#\/quotes/, contracts: /^#\/contracts/,
    expiry: /^#\/expiry/, vehicles: /^#\/vehicles/, financiers: /^#\/financiers/,
    commissions: /^#\/commissions/, settings: /^#\/settings/,
  };

  async function route() {
    if (!state.profile || !state.profile.approved) return;
    App.closeModal();
    const hash = location.hash || '#/';
    const main = document.getElementById('main');
    // 사이드바 활성 표시
    document.querySelectorAll('#side-nav a').forEach((a) => {
      const key = a.dataset.route;
      const active = key === 'dashboard' ? (hash === '#/' || hash === '' || hash === '#') : NAV_KEY[key]?.test(hash);
      a.classList.toggle('active', !!active);
    });
    for (const [re, fn] of ROUTES) {
      const m = hash.match(re);
      if (m) { try { await fn(main, m[1]); } catch (e) { err(e); } return; }
    }
    location.hash = '#/';
  }
  window.addEventListener('hashchange', route);

  // ---------- 인증 ----------
  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { show('auth'); return; }
    state.user = session.user;
    const { data: profile, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    if (error || !profile) { show('auth'); return; }
    state.profile = profile;
    if (!profile.approved) { show('pending'); return; }
    document.getElementById('side-user-name').textContent =
      `${profile.name} · ${App.LABELS.role[profile.role]}`;
    show('app');
    route();
  }

  // 로그인
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.hidden = true;
    const f = new FormData(e.target);
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    if (error) {
      errEl.textContent = error.message === 'Invalid login credentials'
        ? '이메일 또는 비밀번호가 올바르지 않습니다'
        : error.message === 'Email not confirmed'
          ? '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.'
          : error.message;
      errEl.hidden = false;
      return;
    }
    boot();
  });

  // 회원가입
  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('signup-error');
    errEl.hidden = true;
    const f = new FormData(e.target);
    const { data, error } = await sb.auth.signUp({
      email: f.get('email'), password: f.get('password'),
      options: { data: { name: f.get('name') } },
    });
    if (error) { errEl.textContent = error.message; errEl.hidden = false; return; }
    if (!data.session) {
      // 이메일 인증이 켜져 있는 경우
      errEl.style.color = 'var(--green)';
      errEl.textContent = '가입 확인 메일을 발송했습니다. 메일의 링크를 클릭한 뒤 로그인해 주세요.';
      errEl.hidden = false;
      return;
    }
    boot();
  });

  document.getElementById('show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').hidden = true;
    document.getElementById('signup-form').hidden = false;
  });
  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signup-form').hidden = true;
    document.getElementById('login-form').hidden = false;
  });

  App.logout = async function () {
    await sb.auth.signOut();
    state.user = state.profile = null;
    App.clearCache();
    location.hash = '';
    show('auth');
  };

  boot();
})();
