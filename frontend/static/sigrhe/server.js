/* SIGRHE · version serveur (Django + PostgreSQL)
   Remplace le stockage local de la démonstration par l'API : connexion réelle, données partagées,
   synchronisation des modifications, fichiers et courriels côté serveur, assistant IA via le serveur. */
(function () {
  const H = App.h, esc = H.esc;
  const SRV = window.SIGRHE_SRV = { on: true, ai: false, demo: false, boot: null };
  const cookie = n => (document.cookie.split('; ').find(c => c.startsWith(n + '=')) || '').split('=')[1] || '';
  async function call(method, url, data, raw) {
    const opt = { method, credentials: 'same-origin', headers: { 'X-CSRFToken': decodeURIComponent(cookie('csrftoken')) } };
    if (raw) opt.body = raw; else if (data !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(data); }
    const r = await fetch(url, opt);
    let j = null; try { j = await r.json(); } catch (e) { }
    if (r.status === 401 && App.S && App.S.user) { App.toast('Session expirée : reconnectez-vous.'); setTimeout(() => location.reload(), 1500); }
    return { status: r.status, ok: r.ok, data: j || {} };
  }
  SRV.call = call;

  /* ---------- État initial depuis le serveur ---------- */
  const hash = {}, ver = {};           // empreinte et version des modules connus du serveur
  const ahash = {};                    // empreinte des agents
  let mxHash = '', usersHash = '', auditMark = null, candIds = new Set(), lastPull = Date.now() / 1000;
  const uiKey = () => 'sigrhe-ui-' + (App.S && App.S.user ? App.S.user.login : 'public');
  const plain = v => v && typeof v === 'object' && !Array.isArray(v);

  App.hook.logoutLabel = 'Se déconnecter';
  App.hook.load = () => {
    const b = SRV.boot, saved = (() => { try { return JSON.parse(localStorage.getItem('sigrhe-ui-' + (b.user ? b.user.login : 'public')) || '{}'); } catch (e) { return {}; } })();
    const m = {};
    Object.entries(b.modules || {}).forEach(([k, v]) => { m[k] = v.data; hash[k] = JSON.stringify(v.data); ver[k] = v.version; });
    if (!b.auth) {
      DATA.users = b.demoAccounts || [];
      candIds = new Set(((m.recrutement || {}).cands || []).map(c => c.id));
      return { v: 1, user: null, prof: 'DRH', mfa: false, route: location.hash === '#offres' ? 'offres' : 'login', ui: saved.ui || {}, toast: '', mx: DATA.BASE.map(r => r.slice()), users: [], agents: [], audit: [], m };
    }
    DATA.users = b.users.map(u => ({ name: u.name, login: u.login, prof: u.prof, scope: u.scope, mat: u.mat }));
    const agents = b.agents.map(a => { a.hist = a.hist || []; return a; });
    agents.forEach(a => { ahash[a.mat] = JSON.stringify(a); });
    mxHash = JSON.stringify(b.mx); usersHash = JSON.stringify(b.users);
    const S = { v: 1, user: b.user, prof: b.user.prof, mfa: false, route: saved.route || App.landingFor(b.user.prof), ui: saved.ui || {}, toast: '', mx: b.mx, users: b.users, agents, audit: b.audit, m };
    auditMark = S.audit[0] || null;
    return S;
  };

  /* ---------- Enregistrement : préférences d'affichage en local, données au serveur ---------- */
  let timer = null, busy = false, again = false;
  App.hook.save = S => {
    try { localStorage.setItem(uiKey(), JSON.stringify({ ui: S.ui, route: S.route })); } catch (e) { }
    clearTimeout(timer); timer = setTimeout(sync, 400);
  };
  async function sync() {
    if (busy) { again = true; return; }
    busy = true;
    const S = App.S;
    let rerender = false;
    try {
      if (!S.user) {
        const rec = (S.m.recrutement || {}).cands || [];
        for (const c of rec) if (c.web && !candIds.has(c.id)) { candIds.add(c.id); const r = await call('POST', '/api/public/candidature', { cand: c }); if (r.ok) { c.id = r.data.id; App.toast('Candidature enregistrée sous le numéro ' + r.data.id + '.'); rerender = true; } else { App.toast(r.data.erreur || 'Candidature non enregistrée.'); rerender = true; } }
        return;
      }
      // 1. journal d'audit : nouvelles entrées (le serveur fixe l'auteur et l'heure)
      const fresh = [];
      for (const e of S.audit) { if (e === auditMark) break; fresh.push(e); }
      if (fresh.length) { auditMark = S.audit[0]; await call('POST', '/api/audit', { entries: fresh.reverse().map(e => ({ a: e.a, o: e.o })) }); }
      // 2. modules modifiés
      for (const [k, v] of Object.entries(S.m)) {
        if (!plain(v)) continue;
        const js = JSON.stringify(v);
        if (js === hash[k]) continue;
        const r = await call('PUT', '/api/modules/' + encodeURIComponent(k), { data: v, version: ver[k] || 0 });
        if (r.ok) { hash[k] = js; ver[k] = r.data.version; }
        else if (r.status === 409) { S.m[k] = r.data.data; hash[k] = JSON.stringify(r.data.data); ver[k] = r.data.version; App.toast('Données « ' + k + ' » mises à jour par un autre utilisateur : affichage actualisé, refaites votre dernière action.'); rerender = true; }
        else if (r.status === 403) { if (hash[k] !== undefined) S.m[k] = JSON.parse(hash[k]); else delete S.m[k]; App.toast(r.data.erreur || 'Modification refusée par le serveur.'); rerender = true; }
      }
      // 3. dossiers des agents
      const canA = SRV.boot.rights && SRV.boot.rights.agentsWrite;
      const changed = [];
      for (const a of S.agents) {
        const js = JSON.stringify(a);
        if (js === ahash[a.mat]) continue;
        if (!canA) { ahash[a.mat] = js; continue; }   // calcul local sans droit d'écriture : non transmis
        changed.push([a, js]);
      }
      for (let i = 0; i < changed.length; i += 200) {
        const part = changed.slice(i, i + 200);
        const r = await call('POST', '/api/agents-lot', { items: part.map(([a]) => ({ mat: a.mat, data: a })) });
        if (r.ok || r.status === 403) part.forEach(([a, js]) => { ahash[a.mat] = js; });
      }
      // 4. matrice des droits et comptes (administrateur)
      const isAdm = SRV.boot.rights && SRV.boot.rights.admin;
      const mj = JSON.stringify(S.mx);
      if (mj !== mxHash) { mxHash = mj; if (isAdm) await call('PUT', '/api/matrice', { mx: S.mx }); }
      const uj = JSON.stringify(S.users);
      if (uj !== usersHash) {
        usersHash = uj;
        if (isAdm) { const r = await call('PUT', '/api/comptes', { users: S.users }); if (r.ok && r.data.created && r.data.created.length) { App.toast(r.data.created.map(c => 'Compte ' + c.login + ' créé · mot de passe initial : ' + c.password).join(' · ') + ' (à transmettre au titulaire, changement exigé).'); rerender = true; } }
      }
    } catch (e) { console.error(e); }
    finally {
      busy = false;
      if (rerender) App.commit();
      if (again) { again = false; sync(); }
    }
  }
  App.hook.log = () => { };

  /* ---------- Actualisation périodique (travail à plusieurs) ---------- */
  setInterval(async () => {
    if (!App.S || !App.S.user || busy || document.hidden) return;
    const r = await call('GET', '/api/modules?since=' + lastPull);
    if (!r.ok) return;
    lastPull = r.data.now;
    let changed = false;
    Object.entries(r.data.modules || {}).forEach(([k, v]) => {
      if (ver[k] === v.version) return;
      const local = App.S.m[k];
      if (local !== undefined && JSON.stringify(local) !== hash[k]) return; // modification locale en cours d'envoi
      App.S.m[k] = v.data; hash[k] = JSON.stringify(v.data); ver[k] = v.version; changed = true;
    });
    if (changed) App.commit();
  }, 30000);

  /* ---------- Connexion réelle ---------- */
  App.reg('login', {
    title: 'Connexion', public: true,
    render() {
      const S = App.S, ui = App.ui, demo = SRV.demo;
      const accounts = SRV.boot.demoAccounts || [];
      const box = `<div><h2 style="font-size:24px">Connexion</h2><p class="muted" style="margin:4px 0 0;font-size:14.5px">Accès réservé aux agents habilités. Toute connexion est journalisée.</p></div>
        ${H.field('l-id', 'Identifiant', `<input id="l-id" data-bind="lgId" value="${esc(ui('lgId', ''))}" class="mono" autocomplete="username" autocapitalize="off">`)}
        ${H.field('l-pw', 'Mot de passe', `<input id="l-pw" type="password" value="${esc(ui('lgPw', ''))}" autocomplete="current-password">`)}
        ${ui('lgMfa', false) ? H.field('l-mfa', 'Code de vérification (application d’authentification)', `<input id="l-mfa" data-bind="lgCode" inputmode="numeric" autocomplete="one-time-code" value="${esc(ui('lgCode', ''))}" class="mono" style="font-size:20px;letter-spacing:.2em">`) : ''}
        ${ui('lgErr', '') ? `<div class="note warn" role="alert">${esc(ui('lgErr', ''))}</div>` : ''}
        <button type="button" class="btn p" style="min-height:46px" data-a="srv-login"${ui('lgBusy', false) ? ' disabled' : ''}>${ui('lgBusy', false) ? 'Connexion…' : 'Se connecter'}</button>
        <div class="row sb small"><a href="#offres" data-a="nav" data-r="offres">Portail public des offres d’emploi</a></div>`;
      return `<div class="login">
        <section class="hero"><div class="row" style="gap:14px">${H.LOGO(60)}<div><b style="font-size:18px;letter-spacing:.02em">SIGRHE</b><div class="small" style="color:var(--navy-muted)">République centrafricaine · Unité – Dignité – Travail</div></div></div>
          <div class="stack" style="gap:16px"><h1>Système intégré de gestion des ressources humaines de l’État</h1><p>Un registre unique de l’agent public, de son recrutement à sa pension.</p></div>
          <div class="small" style="color:var(--navy-muted);line-height:1.6">${demo ? 'Serveur de démonstration · données fictives' : 'Ministère des Finances et du Budget'}<br>Accès réservé. Toute connexion est journalisée.</div></section>
        <section class="pane"><div class="box">${box}</div></section>
        ${demo && accounts.length ? `<section class="profiles" aria-label="Comptes de démonstration"><div><div class="small" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--warn)">Démonstration</div><h2 style="font-size:18px;margin-top:4px">Comptes de démonstration</h2><p class="muted small" style="margin:4px 0 0">Mot de passe commun : ${esc(SRV.boot.demoPassword || 'voir l’administrateur')}</p></div>
          <div class="stack" style="gap:6px">${accounts.map(u => `<button type="button" class="prof" data-a="srv-pick" data-l="${esc(u.login)}"><span class="code">${esc(u.prof)}</span><span><b>${esc(App.profName(u.prof))}</b><span class="small muted" style="display:block">${esc(u.name)} · ${esc(u.scope)}</span></span></button>`).join('')}</div></section>` : ''}
      </div>`;
    }
  });
  App.on('srv-pick', d => { App.setUi('lgId', d.l); App.setUi('lgPw', SRV.boot.demoPassword || ''); App.setUi('lgErr', ''); });
  App.on('srv-login', () => {
    const ui = App.ui;
    const id = (document.getElementById('l-id') || {}).value || ui('lgId', ''), pw = (document.getElementById('l-pw') || {}).value || ui('lgPw', '');
    App.setUi('lgBusy', true); App.setUi('lgErr', '');
    call('POST', '/api/login', { login: id, password: pw, code: ui('lgCode', '') }).then(r => {
      App.setUi('lgBusy', false);
      if (r.ok) { try { localStorage.removeItem('sigrhe-ui-public'); } catch (e) { } location.hash = ''; location.reload(); return; }
      if (r.data.mfa && !r.data.erreur) { App.setUi('lgMfa', true); App.setUi('lgErr', 'Saisissez le code à 6 chiffres de votre application d’authentification.'); }
      else App.setUi('lgErr', r.data.erreur || 'Connexion impossible.');
      App.setUi('lgPw', pw); App.commit();
    });
  });
  SRV.flush = async () => { clearTimeout(timer); for (let i = 0; i < 50 && busy; i++) await new Promise(r => setTimeout(r, 100)); await sync(); };
  App.on('logout', () => { SRV.flush().then(() => call('POST', '/api/logout')).then(() => { location.hash = ''; location.reload(); }); });
  window.addEventListener('beforeunload', e => { if (busy || timer) { clearTimeout(timer); sync(); } });
  App.on('reset-yes', () => { call('POST', '/api/demo/reset').then(r => { if (r.ok) location.reload(); else { App.toast(r.data.erreur || 'Réinitialisation refusée.'); App.commit(); } }); });

  /* ---------- Fichiers ---------- */
  SRV.putFile = async (file, ctx, cat) => {
    const fd = new FormData(); fd.append('file', file); fd.append('ctx', ctx); fd.append('cat', cat || '');
    const r = await call('POST', '/api/fichiers', undefined, fd);
    return r.ok ? r.data : { err: r.data.erreur || 'dépôt refusé par le serveur' };
  };
  SRV.getFile = async id => {
    const r = await fetch('/api/fichiers/' + encodeURIComponent(id), { credentials: 'same-origin' });
    return r.ok ? await r.blob() : null;
  };

  /* ---------- Assistant IA : boucle d'appels d'outils via le serveur (clé API côté serveur) ---------- */
  SRV.sample = async (turns, o = {}) => {
    const msgs = [];
    turns.forEach(t => { const last = msgs[msgs.length - 1]; if (last && last.role === t.role && typeof last.content === 'string') last.content += '\n\n' + t.content; else msgs.push({ role: t.role, content: t.content }); });
    const tools = (o.tools || []).map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: 'object', properties: {} } }));
    let text = '';
    for (let round = 0; round < 6; round++) {
      if (o.signal && o.signal.aborted) throw { code: 'cancelled', text };
      const r = await call('POST', '/api/assistant', { messages: msgs, tools });
      if (!r.ok) throw { code: r.status === 429 ? 'rate_limited' : r.status === 503 ? 'sampling_disabled' : 'upstream_error', message: r.data.erreur, text };
      const blocks = r.data.content || [];
      const t = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (t) { text = text ? text + '\n\n' + t : t; if (o.onText) o.onText({ text, delta: t }); }
      if (r.data.stop_reason !== 'tool_use') return { text: text || '…', truncated: r.data.stop_reason === 'max_tokens' };
      msgs.push({ role: 'assistant', content: blocks });
      const results = [];
      for (const b of blocks.filter(x => x.type === 'tool_use')) {
        const tool = (o.tools || []).find(x => x.name === b.name);
        try { const out = tool ? await tool.execute(b.input || {}, { signal: o.signal }) : 'Outil inconnu'; results.push({ type: 'tool_result', tool_use_id: b.id, content: typeof out === 'string' ? out : JSON.stringify(out).slice(0, 30000) }); }
        catch (e) { results.push({ type: 'tool_result', tool_use_id: b.id, content: 'Error: ' + (e && e.message || e), is_error: true }); }
      }
      msgs.push({ role: 'user', content: results });
    }
    return { text: text || 'Je n’ai pas pu conclure : reformulez votre question.', truncated: true };
  };

  /* ---------- Démarrage ---------- */
  SRV.start = async () => {
    let b;
    try { const r = await call('GET', '/api/bootstrap'); b = r.data; } catch (e) { b = null; }
    if (!b || b.erreur) { document.getElementById('app').innerHTML = '<p style="padding:24px">Serveur SIGRHE injoignable. Réessayez dans un instant.</p>'; return; }
    SRV.boot = b; SRV.ai = !!b.ai && !!b.auth; SRV.demo = !!b.demo;
    if (!SRV.demo) { const st = document.createElement('style'); st.textContent = '.demo-tag,[data-a="reset-ask"]{display:none!important}'; document.head.appendChild(st); }
    if (b.user) b.user.mat = b.user.mat || (b.user.prof === 'AGT' ? b.user.login : '');
    App.start();
    if (window.__bootResolve) window.__bootResolve();
  };
})();
