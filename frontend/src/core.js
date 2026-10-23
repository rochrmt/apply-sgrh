/* SIGRHE · socle de l'application : état, routage, connexion, droits, audit, composants */
const App = (function () {
  const KEY = 'sigrhe-webapp-v1';
  const ROUTES = {};
  const ACTIONS = {};
  let S = null;
  const HOOK = {}; // points d’extension utilisés par la version serveur (server.js)

  /* ---------- utilitaires ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = v => Math.round(Number(v) || 0).toLocaleString('fr-FR');
  const n1 = v => (Number(v) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct = (a, b) => b ? (a / b * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %' : '—';
  const fcfa = v => v ? nf(v) + ' FCFA' : '—';
  const pad = n => String(n).padStart(2, '0');
  function now() { const d = new Date(); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { const d = new Date(); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  /* Logo SIGRHE validé (proposition B · Unité des agents) : 'dark' sur fond marine, 'light' sur fond clair */
  const LOGO_C = { dark: ['#7FA9E0', '#4CC26A', '#FFCE00', '#FF6B7D', '#FFFFFF', '#1F4E8C', '#FFCE00'], light: ['#003082', '#289728', '#E0A800', '#D21034', '#13243A', '#13243A', '#FFCE00'] };
  const LOGO = (w = 44, v = 'dark') => { const c = LOGO_C[v] || LOGO_C.dark; return `<svg class="logo" role="img" aria-label="Logo SIGRHE" width="${w}" height="${w}" viewBox="0 0 120 120" style="flex:none">${c.slice(0, 5).map((col, i) => `<g transform="rotate(${i * 72} 60 60)"><circle cx="60" cy="17" r="7.5" fill="${col}"/><path d="M48 39 a12 9 0 0 1 24 0 Z" fill="${col}"/></g>`).join('')}<circle cx="60" cy="60" r="17" fill="${c[5]}"/><path transform="translate(60 61) scale(1.15)" d="M0,-10 L2.25,-3.09 L9.51,-3.09 L3.63,1.18 L5.88,8.09 L0,3.82 L-5.88,8.09 L-3.63,1.18 L-9.51,-3.09 L-2.25,-3.09Z" fill="${c[6]}"/></svg>`; };
  const FLAG = (w = 44) => `<svg class="flag" role="img" aria-label="Drapeau de la République centrafricaine" width="${w}" height="${Math.round(w * .75)}" viewBox="0 0 640 480"><g fill-rule="evenodd" transform="translate(12.4 -32)"><path fill="#003082" d="M-52 32h719.3v119H-52z"/><path fill="#FFCE00" d="M-52 391.6h719.3V512H-52z"/><path fill="#289728" d="M-52 271.3h719.3v120.3H-52z"/><path fill="#FFFFFF" d="M-52 151h719.3v120.3H-52z"/><path fill="#D21034" d="M247.7 32.5h119.9V512H247.7z"/><path fill="#FFCE00" d="m99.3 137.7-31.5-21.8-31.3 22L47.4 101 16.9 78l38.2-1 12.5-36.3L80.3 77l38.1.7L88.2 101"/></g></svg>`;
  const ICON = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'
  };
  const icon = (k, s = 18) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || k}</svg>`;

  /* ---------- état ---------- */
  function toAgent(r) { return { mat: r[0], nom: r[1], prenom: r[2], sx: r[3], yob: r[4], lieu: r[5], code: r[6], sig: r[7], min: r[8], grade: r[9], fonction: r[10], ville: r[11], indice: r[12], statut: r[13], entree: r[14], net: r[15], canal: r[16], niu: r[17], hist: [] }; }
  function fresh() {
    return {
      v: 1, user: null, prof: 'DRH', mfa: false, route: 'login', ui: {}, toast: '',
      mx: DATA.BASE.map(r => r.slice()),
      users: DATA.users.map(u => ({ ...u })),
      agents: DATA.A.map(toAgent),
      audit: DATA.log.map(l => ({ t: l.t, u: l.u, a: l.a, o: l.o })),
      m: {}
    };
  }
  function load() { if (HOOK.load) return HOOK.load(); try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return s; } catch (e) { } return fresh(); }
  function save() { if (HOOK.save) return HOOK.save(S); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  function mod(name, init) { if (!S.m[name]) S.m[name] = init(); return S.m[name]; }
  function ui(k, d) { return S.ui[k] === undefined ? d : S.ui[k]; }
  function setUi(k, v) { S.ui[k] = v; }
  function log(a, o) { const e = { t: now(), u: S.user ? S.user.login : 'anonyme', a, o }; S.audit.unshift(e); if (S.audit.length > 400) S.audit.length = 400; if (HOOK.log) HOOK.log(e); try { if (window.MOD && MOD.onLog) MOD.onLog(e); } catch (err) { console.error(err); } }
  function toast(m) { S.toast = m; }

  /* ---------- profils et droits ---------- */
  const LV = ['—', 'L', 'S', 'V', 'A'], LVN = ['Aucun', 'Lecture', 'Saisie', 'Validation', 'Administration'];
  const profCol = code => DATA.P.findIndex(p => p[0] === code);
  const profName = code => (DATA.P.find(p => p[0] === code) || [0, code])[1];
  function lvl(row) { if (!S.user) return 0; const c = profCol(S.user.prof); return c < 0 ? 0 : S.mx[row][c]; }
  const can = (row, l) => lvl(row) >= l;
  function scopeCode() {
    if (!S.user) return null;
    if (S.user.prof !== 'GRH' && S.user.prof !== 'DEC') return null;
    const sc = (S.user.scope || '').toLowerCase().replace('agrégats ', '');
    const e = DATA.E.find(x => x[3].toLowerCase() === sc || x[3].toLowerCase().startsWith(sc));
    return e ? e[0] : null;
  }
  function visibleAgents() { const c = scopeCode(); return c ? S.agents.filter(a => a.code === c) : S.agents; }
  function canSee(name) {
    const d = ROUTES[name]; if (!d) return false;
    if (d.public) return true;
    if (!S.user) return false;
    if (S.user.prof === 'AGT') return !!d.agent;
    if (d.agentOnly) return false;
    if (d.rows) return d.rows.some(r => lvl(r) >= 1);
    return true;
  }
  function btn(label, action, o = {}) {
    const data = Object.entries(o.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
    const cls = 'btn' + (o.p ? ' p' : '') + (o.sm ? ' sm' : '') + (o.danger ? ' danger' : '') + (o.ghost ? ' ghost' : '');
    if (o.req && !can(o.req[0], o.req[1])) {
      const t = 'Droit requis : ' + LVN[o.req[1]] + ' sur « ' + DATA.R[o.req[0]] + ' » (votre profil : ' + LVN[lvl(o.req[0])] + ')';
      return `<button type="button" class="${cls}" disabled title="${esc(t)}" aria-label="${esc(label + ' — ' + t)}">${esc(label)}</button>`;
    }
    return `<button type="button" class="${cls}" data-a="${action}"${data}${o.aria ? ` aria-label="${esc(o.aria)}"` : ''}>${o.html || esc(label)}</button>`;
  }
  const lockNote = (row, l) => can(row, l) ? '' : `<span class="lock">Lecture seule pour votre profil (droit « ${LVN[l]} » requis sur ${esc(DATA.R[row])})</span>`;

  /* ---------- composants ---------- */
  const PILL = { 'Actif': 'ok', 'Stagiaire': 'info', 'Détachement': 'n', 'Disponibilité': 'n', 'Suspendu': 'bad', 'Départ retraite': 'warn', 'Retraité': 'vio', 'En attente de validation': 'warn', 'Conflit': 'bad', 'Conforme': 'ok', 'Brouillon': 'n', 'En validation': 'info', 'Validé': 'ok', 'Signé': 'ok', 'Archivé': 'vio', 'Vacant': 'n', 'Occupé': 'ok', 'Intérim': 'warn', 'Notifié': 'ok', 'Renvoyé': 'bad', 'Approuvée': 'ok', 'Refusée': 'bad', 'En attente': 'warn', 'Déposée': 'n', 'Délivrée': 'ok', 'En cours': 'info', 'À traiter': 'warn', 'Répondu': 'ok', 'Envoyé': 'ok', 'Liquidé': 'ok', 'Pièces manquantes': 'warn', 'En calcul': 'n', 'Visa Contrôle financier': 'info', 'Clôturé': 'ok', 'Retenu': 'ok', 'Écarté': 'bad', 'Opérationnel': 'ok', 'Partiel': 'warn', 'En préparation': 'n' };
  const pill = (s, cls) => `<span class="pill ${cls || PILL[s] || 'info'}">${esc(s)}</span>`;
  const kpi = (l, v, s, c) => `<div class="kpi"><div class="l">${esc(l)}</div><div class="v"${c ? ` style="color:var(--${c})"` : ''}>${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  const seg = (k, items, cur, label) => `<div class="seg" role="tablist" aria-label="${esc(label || '')}">${items.map(([v, l]) => `<button type="button" role="tab" aria-selected="${v === cur}" data-a="tab" data-k="${k}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;
  const utabs = (k, items, cur, label) => `<div class="utabs" role="tablist" aria-label="${esc(label || '')}">${items.map(([v, l]) => `<button type="button" role="tab" aria-selected="${v === cur}" data-a="tab" data-k="${k}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;
  const chips = (k, items, cur, label) => `<div class="chips" role="group" aria-label="${esc(label || '')}">${items.map(([v, l]) => `<button type="button" aria-pressed="${v === cur}" data-a="tab" data-k="${k}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;
  const field = (id, label, inner) => `<label class="field" for="${id}">${esc(label)}${inner}</label>`;
  const input = (id, label, bind, val, o = {}) => field(id, label, `<input id="${id}" type="${o.type || 'text'}" data-bind="${bind}" value="${esc(val)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.min != null ? ` min="${o.min}" max="${o.max}" step="${o.step || 1}"` : ''}>`);
  const select = (id, label, bind, val, opts) => field(id, label, `<select id="${id}" data-bind="${bind}">${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`);
  const bars = (items, max) => `<div class="bars">${items.map(([l, v, lab, color]) => `<div><div class="h"><span>${esc(l)}</span><span>${lab ?? nf(v)}</span></div><div class="bar"><i style="width:${max ? Math.max(1, v / max * 100) : 0}%${color ? ';background:' + color : ''}"></i></div></div>`).join('')}</div>`;
  const steps = (labels, cur) => `<ol class="steps">${labels.map((l, i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}"><span class="dot">${i < cur ? '✓' : i + 1}</span>${esc(l)}</li>`).join('')}</ol>`;
  const timeline = items => `<ol class="tl">${items.map(it => `<li><div class="rail"><span class="dot" style="${it.done ? 'background:var(--ok);color:#fff' : it.cur ? 'background:var(--accent);color:var(--on-accent)' : ''}">${it.done ? '✓' : it.mark ?? ''}</span></div><div class="body"><div style="font-weight:600">${esc(it.l)}</div><div class="muted">${esc(it.d || '')}</div></div></li>`).join('')}</ol>`;
  const note = (txt, kind = 'warn') => `<div class="note ${kind}">${txt}</div>`;
  const pager = (k, page, pages) => `<div class="row sb"><span class="muted">Page ${page + 1} sur ${pages}</span><span class="row" style="gap:8px"><button type="button" class="btn sm" data-a="page" data-k="${k}" data-v="-1"${page <= 0 ? ' disabled' : ''}>‹ Précédente</button><button type="button" class="btn sm" data-a="page" data-k="${k}" data-v="1"${page >= pages - 1 ? ' disabled' : ''}>Suivante ›</button></span></div>`;

  /* ---------- navigation ---------- */
  const MENU = [
    ['Pilotage', ['dashboard', 'bi', 'simulation', 'couverture']],
    ['Organisation de l’État', ['organisation', 'postes']],
    ['Gestion des agents', ['agents', 'fiche', 'carriere', 'evaluation', 'formation', 'presences', 'discipline']],
    ['Recrutement', ['recrutement', 'offres']],
    ['Solde et pensions', ['paie', 'pensions']],
    ['Documents', ['documents', 'ged']],
    ['Système', ['notifications', 'utilisateurs', 'interop', 'architecture', 'api', 'portail']]
  ];
  function reg(name, def) { ROUTES[name] = def; }
  function on(name, fn) { ACTIONS[name] = fn; }
  function go(r) { S.route = r; S.ui.navOpen = false; try { history.replaceState(null, '', '#' + r); } catch (e) { } window.scrollTo(0, 0); }

  function landingFor(code) {
    const p = DATA.main.find(x => x[0] === code); if (!p) return 'dashboard';
    const f = p[5].replace('.dc.html', '').toLowerCase();
    return f.startsWith('mobile') ? 'portail' : (ROUTES[f] ? f : 'dashboard');
  }

  function sidebar() {
    const groups = MENU.map(([g, items]) => {
      const vis = items.filter(canSee); if (!vis.length) return '';
      return `<div class="navg"><h4>${esc(g)}</h4>${vis.map(k => `<a class="navi" href="#${k}" data-a="nav" data-r="${k}"${S.route === k ? ' aria-current="page"' : ''}><span>${esc(ROUTES[k].menu || ROUTES[k].title)}</span>${ROUTES[k].tag ? `<small>${ROUTES[k].tag}</small>` : ''}</a>`).join('')}</div>`;
    }).join('');
    const reset = ui('resetAsk', false)
      ? `<span>Effacer toutes les actions de démonstration ?</span><span class="row" style="gap:6px"><button class="btn sm p" data-a="reset-yes">Confirmer</button><button class="btn sm" data-a="reset-no">Annuler</button></span>`
      : `<button class="navi" style="padding:0;min-height:28px;color:var(--navy-muted);font-size:12px" data-a="reset-ask">Réinitialiser la démonstration</button>`;
    return `<nav class="side" aria-label="Navigation principale">
      <a class="brand" href="#dashboard" data-a="nav" data-r="${landingFor(S.user.prof)}">${LOGO(42)}<div><b>SIGRHE</b><span>République Centrafricaine</span></div></a>
      ${groups}
      <div class="side-foot"><span>Site principal : opérationnel · secours : synchronisé</span>${reset}</div>
    </nav>`;
  }
  function topbar(d) {
    const u = S.user;
    const ini = u.name.split(' ').map(x => x[0]).slice(0, 2).join('');
    return `<header class="top">
      <button type="button" class="btn sm burger" data-a="nav-toggle" aria-label="Ouvrir le menu">${icon('menu')}</button>
      <div class="ttl"><small>${esc(d.crumb || '')}</small><h1>${esc(d.title)}</h1></div>
      <span class="demo-tag">Démonstration · données fictives</span>
      ${window.MOD && MOD.chatBtn ? MOD.chatBtn() : ''}${window.MOD && MOD.bell ? MOD.bell() : ''}
      <div class="chip-user"><span class="av" aria-hidden="true">${esc(ini)}</span><div><b>${esc(u.name)}</b><span>${esc(profName(u.prof))} · ${esc(u.scope)}</span></div></div>
      <button type="button" class="btn sm" data-a="logout">${icon('out', 16)}${HOOK.logoutLabel || 'Changer de profil'}</button>
    </header>`;
  }
  function denied() {
    return `<div class="card" style="max-width:640px"><h2>Accès non autorisé</h2><p class="muted" style="margin:0">Votre profil « ${esc(profName(S.user.prof))} » n’a aucun droit sur ce module. L’administrateur peut modifier la matrice des droits dans « Utilisateurs et droits ».</p><div>${btn('Retour à mon accueil', 'nav', { p: true, data: { r: landingFor(S.user.prof) } })}</div></div>`;
  }
  function view() {
    const r = S.route;
    if (r === 'offres' && (!S.user || S.user.prof === 'AGT')) return ROUTES.offres.render({ standalone: true });
    if (!S.user) return ROUTES.login.render();
    if (S.user.prof === 'AGT') return ROUTES.portail.render({ standalone: true });
    const d = ROUTES[r] && r !== 'login' ? ROUTES[r] : ROUTES[landingFor(S.user.prof)];
    const ok = canSee(ROUTES[r] && r !== 'login' ? r : landingFor(S.user.prof));
    const body = ok ? d.render({}) : denied();
    return `<div class="shell${ui('navOpen', false) ? ' open' : ''}">${sidebar()}<div class="main">${topbar(ok ? d : { title: 'Accès non autorisé', crumb: '' })}<main class="content" id="main">${body}</main></div></div>`;
  }
  function renderToast() {
    const t = document.getElementById('toast-root');
    t.innerHTML = S.toast ? `<div class="toast" role="status"><span style="flex:1">${esc(S.toast)}</span><button type="button" data-a="toast-close">OK</button></div>` : '';
  }
  function render() {
    const ae = document.activeElement, id = ae && ae.id; let pos = null;
    try { pos = ae && ae.selectionStart; } catch (e) { }
    document.getElementById('app').innerHTML = view();
    renderToast();
    if (id) { const el = document.getElementById(id); if (el) { el.focus({ preventScroll: true }); try { if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); } catch (e) { } } }
  }
  function commit() { save(); render(); }

  /* ---------- actions communes ---------- */
  on('nav', d => go(d.r));
  on('nav-toggle', () => { S.ui.navOpen = !S.ui.navOpen; });
  on('tab', d => { S.ui[d.k] = /^evR\d$/.test(d.k) ? Number(d.v) : d.v; if (S.ui[d.k + 'Page'] !== undefined) S.ui[d.k + 'Page'] = 0; });
  on('page', d => { S.ui[d.k] = Math.max(0, (S.ui[d.k] || 0) + Number(d.v)); });
  on('toast-close', () => { S.toast = ''; });
  on('logout', () => { log('Déconnexion', S.user.login); S.user = null; S.mfa = false; go('login'); });
  on('reset-ask', () => { S.ui.resetAsk = true; });
  on('reset-no', () => { S.ui.resetAsk = false; });
  on('reset-yes', () => { const u = S.user; S = fresh(); S.user = u; S.route = landingFor(u.prof); toast('Démonstration réinitialisée : toutes les données de départ sont restaurées.'); });

  function bindValue(el) { if (el.type === 'number' || el.type === 'range') return Number(el.value); if (el.type === 'checkbox') return el.checked; return el.value; }
  function onBind(e) {
    const el = e.target.closest('[data-bind]'); if (!el) return;
    const k = el.dataset.bind;
    S.ui[k] = bindValue(el);
    if (S.ui[k + 'Page'] !== undefined) S.ui[k + 'Page'] = 0;
    const pg = el.dataset.page; if (pg) S.ui[pg] = 0;
    commit();
  }

  function start() {
    S = load();
    const h = (location.hash || '').slice(1);
    if (h && ROUTES[h]) S.route = h;
    else if (S.user) S.route = S.route && ROUTES[S.route] ? S.route : landingFor(S.user.prof);
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
      const fn = ACTIONS[el.dataset.a]; if (!fn) return;
      e.preventDefault();
      try { fn(el.dataset, el, e); } catch (err) { console.error(err); toast('Action impossible : ' + err.message); }
      commit();
    });
    document.addEventListener('input', e => { const el = e.target; if (el.matches('[data-bind]') && (el.type === 'text' || el.type === 'search' || el.type === 'range' || el.type === 'number' || el.tagName === 'TEXTAREA')) onBind(e); });
    document.addEventListener('change', e => { const el = e.target; if (el.matches('[data-bind]') && !(el.type === 'text' || el.type === 'search' || el.type === 'range' || el.type === 'number' || el.tagName === 'TEXTAREA')) onBind(e); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.ui.navOpen) { S.ui.navOpen = false; commit(); } });
    window.addEventListener('hashchange', () => { const r = (location.hash || '').slice(1); if (ROUTES[r] && r !== S.route) { S.route = r; commit(); } });
    render();
  }

  return {
    hook: HOOK, meMat: () => (S && S.user && S.user.prof === 'AGT' ? (S.user.mat || S.user.login) : '211-0457-B'),
    start, reg, on, go, commit, mod, ui, setUi, log, toast, can, lvl, canSee, scopeCode, visibleAgents, landingFor, profName, profCol,
    get S() { return S; },
    h: { esc, nf, n1, pct, fcfa, now, today, FLAG, LOGO, icon, pill, kpi, btn, lockNote, seg, utabs, chips, field, input, select, bars, steps, timeline, note, pager, LV, LVN }
  };
})();
