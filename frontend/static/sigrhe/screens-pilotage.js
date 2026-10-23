/* SIGRHE · écrans : connexion, pilotage, couverture, utilisateurs et droits */
window.MOD = window.MOD || {};
(function () {
  const { reg, on, ui, log, toast, can, go } = App;
  const H = App.h;
  const { esc, nf, n1, pct, kpi, btn, pill, seg, utabs, chips, select, input, bars, note } = H;
  const S = () => App.S;

  /* ================= CONNEXION ================= */
  reg('login', {
    title: 'Connexion', public: true,
    render() {
      const st = S();
      const P = DATA.main;
      const cur = P.find(p => p[0] === st.prof) || P[1];
      const box = !st.mfa ? `
        <div><h2 style="font-size:24px">Connexion</h2><p class="muted" style="margin:4px 0 0;font-size:14.5px">Authentification unique (SSO) de l’administration.</p></div>
        <div class="row note info" style="gap:10px"><span class="pill info" style="background:var(--accent);color:var(--on-accent)">${cur[0]}</span><b>${esc(cur[1])}</b></div>
        ${H.field('l-id', 'Identifiant', `<input id="l-id" value="${esc(cur[3])}" class="mono" autocomplete="username">`)}
        ${H.field('l-pw', 'Mot de passe', `<input id="l-pw" type="password" value="demo-sigrhe" autocomplete="current-password">`)}
        <button type="button" class="btn p" style="min-height:46px" data-a="login-next">Se connecter</button>
        <button type="button" class="btn" style="min-height:46px" data-a="login-next">Certificat PKI / carte agent</button>
        <div class="row sb small"><a href="#offres" data-a="nav" data-r="offres">Portail public des offres d’emploi</a><span class="muted">Mot de passe de démonstration : demo-sigrhe</span></div>`
        : `
        <div><h2 style="font-size:24px">Vérification en deux étapes</h2><p class="muted" style="margin:4px 0 0;font-size:14.5px">Saisissez le code à 6 chiffres de votre application d’authentification ou reçu par SMS.</p></div>
        ${H.field('l-mfa', 'Code de vérification', `<input id="l-mfa" inputmode="numeric" value="482 913" class="mono" style="font-size:22px;letter-spacing:.25em;height:52px">`)}
        <div class="note n"><b>${esc(cur[2])}</b> · ${esc(cur[1])}<br><span class="muted">Périmètre : ${esc(cur[4])} · page d’accueil : ${esc(cur[6])}</span></div>
        <button type="button" class="btn p" style="min-height:46px" data-a="login-ok">Vérifier et accéder</button>
        <div class="row sb small"><button type="button" class="btn ghost" data-a="login-back">Changer de compte</button><span class="muted">Code de démonstration : 482 913</span></div>`;
      return `<div class="login">
        <section class="hero">
          <div class="row" style="gap:14px">${H.LOGO(60)}<div><b style="font-size:18px;letter-spacing:.02em">SIGRHE</b><div class="small" style="color:var(--navy-muted)">République Centrafricaine · Unité – Dignité – Travail</div></div></div>
          <div class="stack" style="gap:16px"><h1>Système Intégré de Gestion des Ressources Humaines de l’État</h1><p>Un registre unique de l’agent public, de son recrutement à sa pension, pour les 31 ministères et les institutions de la République.</p></div>
          <div class="small" style="color:var(--navy-muted);line-height:1.6">Application de démonstration · données fictives<br>Accès réservé aux agents habilités. Toute connexion est journalisée.</div>
        </section>
        <section class="pane"><div class="box">${box}</div></section>
        <section class="profiles" aria-label="Comptes de démonstration">
          <div><div class="small" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--warn)">Démonstration</div><h2 style="font-size:18px;margin-top:4px">Choisir un profil de connexion</h2><p class="muted" style="margin:4px 0 0">Les menus, les actions et les données affichées dépendent des droits du profil.</p></div>
          <div role="radiogroup" aria-label="Profils" class="stack" style="gap:6px">${P.map(p => `<button type="button" role="radio" class="prof" aria-checked="${p[0] === cur[0]}" data-a="pick-prof" data-p="${p[0]}"><span class="code">${p[0]}</span><span style="flex:1;min-width:0"><b>${esc(p[1])}</b><span>${esc(p[2])} · ${esc(p[4])}</span></span></button>`).join('')}</div>
          <div class="note n" style="font-size:13px"><b>Droits :</b> ${esc(cur[7])}</div>
        </section>
      </div>`;
    }
  });
  on('pick-prof', d => { S().prof = d.p; S().mfa = false; });
  on('login-next', () => { S().mfa = true; });
  on('login-back', () => { S().mfa = false; });
  on('login-ok', () => {
    const st = S(); const p = DATA.main.find(x => x[0] === st.prof);
    st.user = { prof: p[0], name: p[2], login: p[3], scope: p[4] };
    st.mfa = false;
    const u = st.users.find(x => x.login === p[3]); if (u) u.last = H.now().slice(0, 5) + ' ' + H.now().slice(11);
    log('Connexion réussie (MFA)', p[3] + ' · ' + p[1]);
    go(App.landingFor(p[0]));
    toast('Bienvenue ' + p[2] + '. Profil : ' + p[1] + '.');
  });

  /* ================= TABLEAU DE BORD ================= */
  function myTasks() {
    const st = S(), t = [];
    const car = App.mod('carriere', MOD.carriere), pay = App.mod('paie', MOD.paie), pos = App.mod('postes', MOD.postes), rec = App.mod('recrutement', MOD.recrutement), pr = App.mod('presences', MOD.presences);
    const pendingVisa = car.actes.filter(a => !a.rej && a.p === 1).length, pendingFP = car.actes.filter(a => !a.rej && (a.p === 0 || a.p === 2 || a.p === 3)).length;
    if (can(4, 3) && pendingVisa) t.push(['Actes en attente de votre visa financier', pendingVisa, 'carriere']);
    if (can(3, 3) && pendingFP) t.push(['Actes à viser ou signer (Fonction publique)', pendingFP, 'carriere']);
    if (can(10, 2) && pay.step < 3) t.push(['Campagne de paie de novembre : étape « ' + MOD.PAIE_STEPS[pay.step] + ' »', 1, 'paie']);
    if (can(11, 3) && pay.step === 3) t.push(['Paie de novembre à valider et ordonnancer', 1, 'paie']);
    const toVal = pos.added.filter(p => p.state === 'Validation budgétaire').length;
    if (can(1, 3) && toVal) t.push(['Créations de postes à valider budgétairement', toVal, 'postes']);
    const cands = rec.cands.filter(c => !c.d).length;
    if (can(9, 3) && cands) t.push(['Candidatures à arbitrer (commission)', cands, 'recrutement']);
    const lv = pr.leaves.filter(l => !l.r).length;
    if (can(7, 2) && lv) t.push(['Demandes de congé à valider', lv, 'presences']);
    if (can(15, 4)) { const w = st.users.filter(u => u.status === 'En attente de validation').length; if (w) t.push(['Comptes en attente de validation', w, 'utilisateurs']); }
    return t;
  }
  reg('dashboard', {
    title: 'Tableau de bord RH', menu: 'Tableau de bord', crumb: 'Pilotage · Effectifs et statistiques (P2)', tag: 'P2', rows: [13],
    render() {
      const A = App.visibleAgents();
      const sc = App.scopeCode();
      const scopeName = sc ? DATA.E.find(e => e[0] === sc)[3] : 'tous ministères et institutions';
      const fem = A.filter(a => a.sx === 'F').length, susp = A.filter(a => a.statut === 'Suspendu').length, ret = A.filter(a => a.statut === 'Départ retraite').length, nr = A.filter(a => a.niu === 'Non rapproché').length, old = A.filter(a => 2026 - a.yob >= 60 && a.statut !== 'Départ retraite' && a.statut !== 'Retraité').length;
      const net = A.reduce((s, a) => s + a.net, 0);
      const byM = {}; A.forEach(a => { byM[a.min] = (byM[a.min] || 0) + 1; });
      const top = Object.entries(byM).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const months = ['nov.', 'déc.', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'];
      const masse = [6.71, 6.72, 6.74, 6.75, 6.77, 6.80, 6.82, 6.83, 6.86, 6.88, 6.91, 6.94];
      const tasks = myTasks();
      const audit = S().audit.slice(0, 7);
      return `
      <div class="row sb"><span class="muted" style="font-size:14px">Situation au ${H.today()} · ${esc(scopeName)}</span><span class="row" style="gap:8px">${btn('Analyses stratégiques', 'nav', { data: { r: 'bi' } })}${btn('Simulation de la masse salariale', 'nav', { p: true, data: { r: 'simulation' } })}</span></div>
      <div class="kpis">
        ${kpi('Effectif modélisé (État)', '24 812', 'masse mensuelle 6,94 Md FCFA')}
        ${kpi('Agents de l’échantillon', nf(A.length), pct(fem, A.length) + ' de femmes')}
        ${kpi('Net mensuel de l’échantillon', n1(net / 1e6) + ' M FCFA', 'calculé à partir des indices')}
        ${kpi('Postes budgétaires vacants', '1 237', 'sur 26 049 ouverts au budget')}
        ${kpi('Départs à la retraite (échantillon)', nf(ret), 'dossiers de pension à ouvrir')}
      </div>
      <div class="cols">
        <section class="card w2"><h2>Mes tâches</h2>${tasks.length ? `<div class="stack" style="gap:8px">${tasks.map(t => `<a href="#${t[2]}" data-a="nav" data-r="${t[2]}" class="row sb" style="text-decoration:none;color:var(--fg);border:1px solid var(--line2);border-radius:10px;padding:10px 12px"><span>${esc(t[0])}</span><span class="pill info">${t[1]}</span></a>`).join('')}</div>` : '<p class="muted" style="margin:0">Aucune tâche en attente pour votre profil.</p>'}</section>
        <section class="card"><h2>Alertes de contrôle du fichier</h2>
          <div class="stack" style="gap:8px">
            ${[['Identifiant national non rapproché', nr, 'warn'], ['Agents suspendus', susp, 'bad'], ['Agents de 60 ans et plus encore en activité', old, 'bad']].map(([l, v, c]) => `<div class="row sb" style="border:1px solid var(--line2);border-radius:10px;padding:10px 12px"><span>${l}</span><span class="pill ${c}">${v}</span></div>`).join('')}
            ${App.canSee('agents') ? btn('Examiner dans le fichier des agents', 'nav', { sm: true, data: { r: 'agents' } }) : ''}
          </div></section>
      </div>
      <div class="cols">
        <section class="card w2"><h2>Masse salariale brute (Md FCFA) · 12 derniers mois</h2>
          <div style="overflow-x:auto"><div style="display:flex;align-items:flex-end;gap:10px;height:210px;min-width:520px;border-bottom:1px solid var(--field);padding-top:6px">
            ${masse.map((v, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%"><span class="mono" style="font-size:11px;color:var(--muted)">${n1(v).replace(',0', '')}</span><div style="width:100%;max-width:34px;height:${Math.round(v / 6.94 * 170)}px;border-radius:4px 4px 0 0;background:${i === 11 ? 'var(--accent)' : 'var(--accent-mid)'}"></div></div>`).join('')}
          </div><div style="display:flex;gap:10px;min-width:520px;padding-top:6px">${months.map(m => `<span style="flex:1;text-align:center" class="small muted">${m}</span>`).join('')}</div></div>
          <span class="muted">Axe à partir de zéro · source : liquidations mensuelles transmises à SIM-BA (données modélisées).</span></section>
        <section class="card"><h2>Agents de l’échantillon par ministère</h2>${bars(top.map(([m, v]) => [m, v]), top.length ? top[0][1] : 1)}${App.canSee('organisation') ? `<a href="#organisation" data-a="nav" data-r="organisation">Voir les 31 ministères et 12 institutions ›</a>` : ''}</section>
      </div>
      <section class="card"><div class="row sb"><h2>Activité récente (journal d’audit)</h2>${App.canSee('interop') ? btn('Piste d’audit complète', 'nav', { sm: true, data: { r: 'interop' } }) : ''}</div>
        <div class="tbox"><table><thead><tr><th>Horodatage</th><th>Utilisateur</th><th>Action</th><th>Objet</th></tr></thead><tbody>${audit.map(a => `<tr><td class="mono">${esc(a.t)}</td><td class="mono">${esc(a.u)}</td><td>${esc(a.a)}</td><td class="muted">${esc(a.o)}</td></tr>`).join('')}</tbody></table></div></section>`;
    }
  });

  /* ================= BI ================= */
  reg('bi', {
    title: 'Analyses stratégiques et prospective RH', menu: 'Analyses stratégiques (BI)', crumb: 'Pilotage · Priorité P3 · Module 16', tag: 'P3', rows: [13],
    render() {
      const M = { all: ['Tous ministères et institutions', 24812, 1.0, 1.0], MEN: ['Éducation nationale', 9420, 1.12, 1.15], MSP: ['Santé et Population', 4185, 0.92, 1.05], MDNRA: ['Défense nationale', 3610, 0.75, 0.8], MISP: ['Intérieur et Sécurité publique', 2240, 0.95, 0.9], MFB: ['Finances et Budget', 1315, 1.25, 0.85], MADR: ['Agriculture et Développement rural', 980, 1.35, 1.2], MJDHBG: ['Justice', 520, 1.2, 1.0] };
      const m = ui('biM', 'all'), sc = ui('biS', 'plan');
      const cur = M[m] || M.all, eff = cur[1], ageF = cur[2], share = eff / 24812;
      const BANDS = ['60+', '55–59', '50–54', '45–49', '40–44', '35–39', '30–34', '25–29', '20–24'];
      const Hh = [420, 1240, 1610, 1920, 2150, 2370, 2480, 1810, 520], Ff = [272, 620, 860, 1170, 1450, 1740, 1980, 1590, 610];
      const adj = i => i < 3 ? ageF : (i > 5 ? 2 - ageF : 1);
      let hv = Hh.map((v, i) => v * share * adj(i)), fv = Ff.map((v, i) => v * share * adj(i));
      const k = eff / (hv.reduce((a, b) => a + b, 0) + fv.reduce((a, b) => a + b, 0)); hv = hv.map(v => v * k); fv = fv.map(v => v * k);
      const mx = Math.max(...hv, ...fv), over55 = (hv[0] + hv[1] + fv[0] + fv[1]) / eff;
      const ret = [418, 452, 497, 530, 566].map(v => v * share * cur[2]);
      const cost = 6.94 * 12 / 24812;
      const run = mode => { let e = eff; const out = [{ yr: '2026', eff: e, ret: 0, rec: 0, ms: e * cost }]; for (let i = 0; i < 5; i++) { const leave = ret[i] + e * 0.012; const rec = mode === 'gel' ? 0 : mode === 'un' ? leave : leave + 400 * share * cur[3]; e = e - leave + rec; out.push({ yr: String(2027 + i), eff: e, ret: ret[i], rec, ms: e * cost * Math.pow(1.02, i + 1) }); } return out; };
      const P = run(sc), B = run('un'); const all = P.concat(B).map(p => p.eff); const lo = Math.min(...all) * 0.97, hi = Math.max(...all) * 1.02;
      const X = i => 80 + i * 104, Y = v => 220 - (v - lo) / (hi - lo) * 190;
      const last = P[5], rot12 = (0.012 + ret[0] / eff) * 100;
      const R = [['Agriculture et Développement rural', 6.8, 21.4, 14.2, 7.9], ['Éducation nationale', 5.9, 18.7, 9.8, 9.4], ['Finances et Budget', 7.4, 22.9, 5.1, 4.2], ['Santé et Population', 6.1, 15.3, 11.6, 6.8], ['Justice, Droits humains et Bonne gouvernance', 5.2, 19.8, 8.4, 5.1], ['Intérieur et Sécurité publique', 4.8, 14.1, 7.2, 8.3], ['Enseignement supérieur et Recherche', 4.4, 24.6, 6.0, 3.9], ['Défense nationale', 3.1, 10.2, 4.6, 4.4]]
        .map(r => ({ r, s: Math.round(r[1] / 8 * 30 + r[2] / 25 * 30 + r[3] / 15 * 25 + r[4] / 10 * 15) })).sort((a, b) => b.s - a.s);
      const N = [['Enseignants (fondamental et secondaire)', 820], ['Infirmiers et sages-femmes', 410], ['Agents de sécurité publique', 260], ['Administrateurs et attachés', 140], ['Médecins et pharmaciens', 95], ['Cadres financiers', 85], ['Techniciens agricoles et d’élevage', 70]];
      const G = [['Bangui', 41], ['Ombella-M’Poko', 9], ['Ouaka', 6], ['Mambéré-Kadéï', 5], ['Nana-Mambéré', 5], ['Ouham', 5], ['Ouham-Pendé', 4], ['Basse-Kotto', 3], ['Haute-Kotto', 3], ['Autres préfectures', 19]];
      const ticks = [0, 1, 2, 3].map(j => lo + (hi - lo) * j / 3);
      return `
      <div class="row sb" style="align-items:flex-end">
        <div class="row" style="align-items:flex-end">
          <div style="min-width:280px">${select('bi-m', 'Périmètre d’analyse', 'biM', m, Object.entries(M).map(([k, v]) => [k, v[0] + ' (' + nf(v[1]) + ' agents)']))}</div>
          <div class="field">Scénario 2027–2031${seg('biS', [['gel', 'Gel des recrutements'], ['un', 'Remplacement 1 pour 1'], ['plan', 'Plan prioritaire santé-éducation']], sc, 'Scénario')}</div>
        </div>
        ${btn('Exporter la note stratégique', 'toast-msg', { p: true, data: { m: 'Note stratégique générée et classée dans la GED (Projet PGNSP).' } })}
      </div>
      <div class="kpis">
        ${kpi('Effectif actuel', nf(eff), esc(cur[0]))}
        ${kpi('Rotation prévue (12 mois)', n1(rot12) + ' %', rot12 > 3.4 ? 'au-dessus de la moyenne' : 'dans la moyenne', rot12 > 3.4 ? 'bad' : 'ok')}
        ${kpi('Départs à la retraite 2027–2031', nf(ret.reduce((a, b) => a + b, 0)), n1(ret.reduce((a, b) => a + b, 0) / eff * 100) + ' % de l’effectif')}
        ${kpi('Agents de 55 ans et plus', n1(over55 * 100) + ' %', over55 > 0.1 ? 'vieillissement marqué' : 'pyramide équilibrée')}
        ${kpi('Effectif projeté 2031', nf(last.eff), (last.eff >= eff ? '+' : '') + n1((last.eff / eff - 1) * 100) + ' % · ' + n1(last.ms) + ' Md FCFA')}
      </div>
      <div class="cols">
        <section class="card"><div class="row sb"><h2>Pyramide des âges</h2><span class="row small muted" style="gap:12px"><span class="row" style="gap:6px"><i style="width:12px;height:12px;border-radius:3px;background:var(--accent);display:inline-block"></i>Hommes</span><span class="row" style="gap:6px"><i style="width:12px;height:12px;border-radius:3px;background:var(--fem);display:inline-block"></i>Femmes</span></span></div>
          <div class="stack" style="gap:5px">${BANDS.map((b, i) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 52px minmax(0,1fr);gap:8px;align-items:center"><div class="row" style="justify-content:flex-end;gap:6px;flex-wrap:nowrap"><span class="mono small muted">${nf(hv[i])}</span><i style="display:block;height:16px;border-radius:3px 0 0 3px;background:var(--accent);width:${hv[i] / mx * 80}%"></i></div><b class="mono small" style="text-align:center;${i < 2 ? 'color:var(--bad)' : ''}">${b}</b><div class="row" style="gap:6px;flex-wrap:nowrap"><i style="display:block;height:16px;border-radius:0 3px 3px 0;background:var(--fem);width:${fv[i] / mx * 80}%"></i><span class="mono small muted">${nf(fv[i])}</span></div></div>`).join('')}</div>
          ${note(nf(hv[0] + hv[1] + fv[0] + fv[1]) + ' agents ont 55 ans ou plus et partiront d’ici 2031 : anticiper les concours et les transferts de compétences.', 'warn')}</section>
        <section class="card w2"><h2>Projection des effectifs et de la masse salariale</h2>
          <div style="overflow-x:auto"><svg role="img" aria-label="Projection de l’effectif de ${nf(eff)} en 2026 à ${nf(last.eff)} en 2031" viewBox="0 0 640 260" style="width:100%;min-width:480px;height:auto;display:block">
            ${ticks.map(t => `<line x1="56" x2="620" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="var(--line2)"/><text x="48" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${nf(t)}</text>`).join('')}
            <polyline points="${B.map((p, i) => X(i) + ',' + Y(p.eff).toFixed(1)).join(' ')}" fill="none" stroke="var(--accent-mid)" stroke-width="2" stroke-dasharray="5 4"/>
            <polyline points="${P.map((p, i) => X(i) + ',' + Y(p.eff).toFixed(1)).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round"/>
            ${P.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.eff).toFixed(1)}" r="${i === 5 ? 5 : 3.5}" fill="var(--accent)"/><text x="${X(i)}" y="${(Y(p.eff) - 10).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--fg)" font-family="IBM Plex Mono, monospace">${nf(p.eff)}</text><text x="${X(i)}" y="248" text-anchor="middle" font-size="12" fill="var(--muted)">${p.yr}</text>`).join('')}
          </svg></div>
          <div class="tbox"><table><thead><tr><th>Année</th>${P.map(p => `<th class="num">${p.yr}</th>`).join('')}</tr></thead><tbody>
            <tr><td>Effectif</td>${P.map(p => `<td class="num mono">${nf(p.eff)}</td>`).join('')}</tr>
            <tr><td>Départs à la retraite</td>${P.map(p => `<td class="num mono">${p.ret ? nf(p.ret) : '—'}</td>`).join('')}</tr>
            <tr><td>Recrutements</td>${P.map(p => `<td class="num mono">${p.yr === '2026' ? '—' : nf(p.rec)}</td>`).join('')}</tr>
            <tr><td>Masse salariale (Md FCFA / an)</td>${P.map(p => `<td class="num mono"><b>${n1(p.ms)}</b></td>`).join('')}</tr>
          </tbody></table></div><span class="muted">Ligne pointillée : remplacement 1 pour 1 (référence). Effet carrière : +2 % par an.</span></section>
      </div>
      <div class="cols">
        <section class="card w2"><h2>Indice de risque RH par ministère (prédictif)</h2><span class="muted">Pondération : rotation 30 % · départs 5 ans 30 % · vacance 25 % · absentéisme 15 %</span>
          <div class="tbox"><table><thead><tr><th>Ministère</th><th class="num">Rotation 12 mois</th><th class="num">Départs 5 ans</th><th class="num">Postes vacants</th><th class="num">Absentéisme</th><th>Indice</th></tr></thead><tbody>
          ${R.map(({ r, s }) => { const c = s >= 75 ? 'bad' : s >= 55 ? 'warn' : 'ok'; return `<tr><td>${esc(r[0])}</td><td class="num mono">${n1(r[1])} %</td><td class="num mono">${n1(r[2])} %</td><td class="num mono">${n1(r[3])} %</td><td class="num mono">${n1(r[4])} %</td><td><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="bar" style="flex:1;min-width:60px"><i style="width:${s}%;background:var(--${c === 'warn' ? 'warn-bar' : c})"></i></div>${pill(s + ' · ' + (s >= 75 ? 'Élevé' : s >= 55 ? 'Modéré' : 'Faible'), c)}</div></td></tr>`; }).join('')}
          </tbody></table></div></section>
        <section class="card"><h2>Besoins de remplacement 2027–2031</h2>${bars(N.map(([l, v]) => [l, v, nf(v * (m === 'all' ? 1 : share * 4))]), 820)}${App.canSee('recrutement') ? `<a href="#recrutement" data-a="nav" data-r="recrutement">Programmer les concours correspondants ›</a>` : ''}</section>
      </div>
      <div class="cols">
        <section class="card"><h2>Répartition territoriale des agents</h2>${bars(G.map(([l, v]) => [l, v, v + ' %']), 41)}</section>
        <section class="card"><h2>Alertes stratégiques</h2>${[['bad', 'Élevé', 'Agriculture : 1 agent sur 5 part à la retraite d’ici 2031', 'Sans recrutement, 9 secteurs agricoles sur 34 n’auront plus de technicien en 2029.'], ['bad', 'Élevé', 'Éducation : déficit d’enseignants hors Bangui', '1 enseignant pour 78 élèves dans le fondamental en province contre 1 pour 52 à Bangui (indicateur de démonstration).'], ['warn', 'Modéré', 'Finances : départs concentrés sur les cadres A1', '23 % des inspecteurs du Trésor et des impôts partent d’ici 5 ans : plan de transmission recommandé.'], ['info', 'Info', 'Masse salariale : le scénario prioritaire dépasse le plafond indicatif dès 2028', 'Avec l’effet carrière, il faut financer environ 1,5 Md FCFA par an ou redéployer des postes.']].map(([c, l, t, d]) => `<div class="row" style="align-items:flex-start;flex-wrap:nowrap;border:1px solid var(--line2);border-radius:10px;padding:12px">${pill(l, c)}<div><b>${t}</b><div class="muted">${d}</div></div></div>`).join('')}</section>
      </div>`;
    }
  });
  on('toast-msg', d => { toast(d.m); log('Export', d.m); });

  /* ================= SIMULATION ================= */
  reg('simulation', {
    title: 'Simulation de la masse salariale', menu: 'Simulation masse salariale', crumb: 'Pilotage · Analyse « What-if »', tag: 'P3', rows: [13],
    render() {
      const pt = ui('simPt', 3), rec = ui('simRec', 1200), dep = ui('simDep', 300), pr = ui('simPr', 5000), fic = ui('simFic', 250);
      const base = 6.94 * 12;
      const items = [['Revalorisation du point d’indice', base * 0.72 * pt / 100], ['Recrutements', rec * 185000 * 12 / 1e9], ['Nouvelle indemnité', 24812 * pr * 12 / 1e9], ['Départs non remplacés', -dep * 310000 * 12 / 1e9], ['Radiation d’agents fictifs', -fic * 210000 * 12 / 1e9]];
      const delta = items.reduce((s, x) => s + x[1], 0), total = base + delta, usage = total / 88 * 100;
      const maxAbs = Math.max(0.01, ...items.map(x => Math.abs(x[1])));
      const c = usage > 100 ? 'bad' : usage > 97 ? 'warn' : 'ok';
      const sl = (id, l, k, v, min, max, step, lab) => `<div class="stack" style="gap:4px"><div class="row sb"><label for="${id}" style="font-weight:500">${l}</label><b class="mono">${lab}</b></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-bind="${k}" style="width:100%;accent-color:var(--accent);height:28px"></div>`;
      const saved = App.mod('simu', () => ({ list: [] })).list;
      return `<div class="cols">
        <section class="card"><h2>Hypothèses du scénario 2027</h2><span class="muted">Base : masse d’octobre 2026 annualisée (${n1(base)} Md FCFA)</span>
          ${sl('s1', 'Revalorisation du point d’indice', 'simPt', pt, 0, 10, 0.5, n1(pt) + ' %')}
          ${sl('s2', 'Recrutements prévus', 'simRec', rec, 0, 3000, 50, nf(rec) + ' agents')}
          ${sl('s3', 'Départs à la retraite non remplacés', 'simDep', dep, 0, 1000, 10, nf(dep) + ' agents')}
          ${sl('s4', 'Nouvelle indemnité mensuelle par agent', 'simPr', pr, 0, 25000, 500, nf(pr) + ' FCFA')}
          ${sl('s5', 'Agents fictifs radiés après contrôle', 'simFic', fic, 0, 800, 10, nf(fic) + ' agents')}
          ${note('Paramètres : part indiciaire 72 % du brut ; coût moyen d’une recrue 185 000 FCFA/mois ; d’un partant 310 000 ; d’un agent fictif 210 000 ; plafond indicatif de la loi de finances 88,0 Md FCFA.', 'n')}
          <div class="row">${btn('Réinitialiser', 'sim-reset')}${btn('Enregistrer le scénario', 'sim-save', { p: true })}</div>
        </section>
        <div class="w2 stack" style="gap:16px">
          <div class="kpis">${kpi('Masse simulée 2027', n1(total) + ' Md', 'écart ' + (delta >= 0 ? '+' : '') + n1(delta) + ' Md FCFA')}${kpi('Consommation du plafond', n1(usage) + ' %', usage > 100 ? 'Dépassement du plafond' : usage > 97 ? 'Marge inférieure à 3 %' : 'Dans le plafond', c)}</div>
          <section class="card"><h2>Plafond budgétaire</h2><div class="bar" style="height:20px;border-radius:6px"><i style="width:${Math.min(100, usage)}%;background:var(--${c})"></i></div><div class="row sb muted"><span>0</span><span>Plafond : 88,0 Md FCFA</span></div></section>
          <section class="card"><h2>Décomposition de l’écart (Md FCFA / an)</h2><div class="tbox"><table><thead><tr><th>Facteur</th><th class="num">Impact</th><th style="width:40%">Poids</th></tr></thead><tbody>${items.map(([l, v]) => `<tr><td>${l}</td><td class="num mono" style="color:var(--${v >= 0 ? 'accent' : 'ok'})">${v >= 0 ? '+' : ''}${n1(v)}</td><td><div class="bar"><i style="width:${Math.abs(v) / maxAbs * 100}%;background:var(--${v >= 0 ? 'accent' : 'ok'})"></i></div></td></tr>`).join('')}</tbody></table></div></section>
          ${saved.length ? `<section class="card"><h2>Scénarios enregistrés</h2><div class="tbox"><table><thead><tr><th>Scénario</th><th>Hypothèses</th><th class="num">Masse 2027</th><th class="num">Plafond</th></tr></thead><tbody>${saved.map(s => `<tr><td>${esc(s.n)}</td><td class="muted">${esc(s.h)}</td><td class="num mono">${s.t}</td><td class="num mono">${s.u}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
        </div></div>`;
    }
  });
  on('sim-reset', () => { ['simPt', 'simRec', 'simDep', 'simPr', 'simFic'].forEach(k => delete App.S.ui[k]); });
  on('sim-save', () => {
    const u = App.S.ui; const pt = u.simPt ?? 3, rec = u.simRec ?? 1200, dep = u.simDep ?? 300, pr = u.simPr ?? 5000, fic = u.simFic ?? 250;
    const total = 6.94 * 12 + 6.94 * 12 * 0.72 * pt / 100 + rec * 185000 * 12 / 1e9 + 24812 * pr * 12 / 1e9 - dep * 310000 * 12 / 1e9 - fic * 210000 * 12 / 1e9;
    const list = App.mod('simu', () => ({ list: [] })).list;
    list.unshift({ n: 'Scénario ' + (list.length + 1) + ' · ' + App.S.user.login, h: 'point +' + n1(pt) + ' %, ' + nf(rec) + ' recrues, indemnité ' + nf(pr), t: n1(total), u: n1(total / 88 * 100) + ' %' });
    log('Scénario de masse salariale enregistré', 'Masse 2027 : ' + n1(total) + ' Md FCFA'); toast('Scénario enregistré.');
  });

  /* ================= COUVERTURE ================= */
  reg('couverture', {
    title: 'Couverture des modules fonctionnels obligatoires', menu: 'Couverture du cahier', crumb: 'DAO n° 011/MFB/PGNSP/COORDO/SPM/26 · Partie 2', tag: '16/16',
    render() {
      const L = { organisation: 'Répertoire national', postes: 'Postes et emplois', agents: 'Agents', documents: 'Documents RH', ged: 'GED', paie: 'Paie', recrutement: 'Concours', offres: 'Portail des offres', evaluation: 'Évaluation', carriere: 'Carrière', formation: 'Formation', portail: 'Application agent', pensions: 'Pensions', presences: 'Temps et présences', interop: 'Interopérabilité et SLA', dashboard: 'Tableau de bord', bi: 'Analyses (BI)', simulation: 'Simulation', discipline: 'Discipline', utilisateurs: 'Utilisateurs et droits', notifications: 'Notifications', fiche: 'Fiches électroniques', architecture: 'Architecture et intégration', api: 'Portail développeur (API)', login: 'Connexion' };
      const R = [
        ['1', 'Ministères, institutions et répertoire national', 'Socle', '31 ministères et 2 délégations du gouvernement Moloua III, 12 institutions ; code unique ; organigramme généré ; versions ; circuit Saisie → Validation → Publication.', ['organisation']],
        ['2', 'Postes et emplois', 'Socle', 'Postes budgétaires par ministère ; grade et fonction distincts ; contrôle des crédits ; validation par l’ordonnateur ; publication au portail des offres.', ['postes']],
        ['3', 'Profils personnels et fiches électroniques', 'Socle', 'Registre unique (1 agent = 1 matricule = 1 NIU) ; fiche électronique : état civil rapproché, coordonnées, situation de famille et enfants à charge (liés à la paie), parcours d’affectations, historique administratif consolidé, complétude du dossier, déclarations validées par la DRH, traçabilité.', ['agents', 'fiche', 'documents']],
        ['4', 'Calcul de la paie et liquidation', 'P1', 'Moteur de calcul paramétrable et versionné (traitement, primes, indemnités, allocations, pension, CNSS, IRPP, oppositions), bulletin détaillé règle par règle ; campagne en 6 étapes avec contrôles bloquants ; interfaces obligatoires SIM-BA, SYSTAC (ISO 20022) et mobile money avec traitement des rejets et rapprochement.', ['paie']],
        ['5', 'Recrutement compétitif', 'P1', 'Concours, présélection automatique arbitrée par la commission, intégration des lauréats dans le fichier.', ['recrutement', 'offres']],
        ['6', 'Évaluation des performances', 'P1', 'Objectifs pondérés, note calculée, validation hiérarchique.', ['evaluation']],
        ['7', 'Carrières et compétences', 'P1', 'Avancements, mutations, retraites avec circuit de visas ; mise à jour automatique du dossier.', ['carriere']],
        ['8', 'Formation et développement', 'P2', 'Besoins, plans sectoriels validés, suivi et impact.', ['formation']],
        ['9', 'Portail libre-service', 'P3', 'Bulletins, congés, attestations, mutation ; les demandes arrivent chez le gestionnaire.', ['portail']],
        ['10', 'Appréciation périodique', 'P1', 'Auto-évaluation puis évaluation hiérarchique et archivage.', ['evaluation']],
        ['11', 'Indemnités, pensions et retraites', 'P1', 'Circuit complet : données RH reprises de la fiche → calcul automatisé (annuités, taux, majorations, minimum, indemnité de départ, arrérages) → visa du Contrôle financier → ordonnancement → paiement via SIM-BA et la caisse de retraite ; délai de liquidation suivi (30 jours) ; bulletins et brevets de pension ; barèmes versionnés ; traçabilité de chaque paiement.', ['pensions', 'carriere']],
        ['12', 'Portail d’offres d’emploi et ATS', 'P1', 'Portail public sans connexion, candidature en 3 étapes, suivi du dossier.', ['offres', 'recrutement']],
        ['13', 'Temps et présences', 'P2', 'Feuille de présence modifiable, validation des congés venant du portail, transmission à la paie.', ['presences']],
        ['14', 'Plus de 25 000 utilisateurs', 'Technique', 'Engagements de service affichés et mesurés ; calcul de paie en moins de 5 minutes.', ['interop']],
        ['15', 'Accès web, mobile et USSD', 'Technique', 'Application adaptative, portail agent mobile, menu USSD.', ['portail']],
        ['16', 'Analyses, tableaux de bord et pilotage', 'P2 / P3', 'Indicateurs et tâches par profil (P2) ; pyramide, projection, indice de risque (P3) ; simulation « What-if ».', ['dashboard', 'bi', 'simulation']],
        ['P2', 'Discipline et sanctions', 'P2', 'Procédure contradictoire, sanction appliquée au dossier de l’agent.', ['discipline']],
        ['P3', 'Gestion documentaire (archivage, GED)', 'P3', 'Téléversement réel de fichiers PDF, images, Word et Excel (glisser-déposer, contrôle du format et de la signature du fichier, empreinte SHA-256, aperçu intégré) dans les dossiers des agents et la GED ; lots de numérisation, conservation ; versions, circuits, courrier, modèles.', ['documents', 'ged']],
        ['Notif.', 'Notifications dans l’application, par courriel et SMS', 'Technique', 'Cloche avec compteur dans la barre supérieure ; 23 règles reliées aux événements du journal (actes, paie, dossiers, portail, sécurité) ; courriels journalisés avec aperçu ; SMS pour les agents ; règles paramétrables par l’administrateur ; préférences et récapitulatif quotidien.', ['notifications']],
        ['IA', 'Assistant RH (intelligence artificielle)', 'Technique', 'Chatbot disponible sur tous les écrans et dans l’espace agent : répond en français à partir des données du SIGRHE (fiche, paie, retraite, effectifs, tâches, règles), dans les limites des droits du profil ; chaque consultation est journalisée ; mode guidé si l’IA est indisponible.', ['dashboard', 'portail']],
        ['§2.3', 'Architecture et sécurité', 'Technique', 'SSO / MFA, 10 profils, matrice des droits appliquée en direct, séparation des tâches, piste d’audit commune.', ['utilisateurs', 'interop']],
        ['Spéc.', 'Architecture SOA, API REST et interopérabilité', 'Technique', 'Schéma cible et flux (paie, carrière, pensions, notation, recrutement), statut des systèmes existants, calendrier d’intégration, portail développeur v1/v2 avec OAuth2, JSON/XML/CSV et codes d’erreur.', ['architecture', 'api']]
      ];
      const f = ui('covF', 'all');
      const PC = { 'P1': 'bad', 'P2': 'warn', 'P3': 'info', 'P2 / P3': 'warn', 'Socle': 'n', 'Technique': 'n' };
      const match = p => f === 'all' || (f === 'P2' ? p.includes('P2') : f === 'P3' ? p.includes('P3') : f === 'o' ? (p === 'Socle' || p === 'Technique') : p === f);
      return `<div class="kpis">${kpi('Modules détaillés', '16 / 16', 'un écran fonctionnel chacun')}${kpi('P1 · obligatoires', '5 / 5', 'paie, carrière, recrutement, notation, pensions')}${kpi('P2 · recommandés', '4 / 4', 'formation, absences, discipline, effectifs')}${kpi('P3 · bonus', '3 / 3', 'libre-service, GED, BI avancée')}</div>
      ${note('Cette application illustre l’ergonomie et les processus. Elle ne remplace pas la démonstration en direct exigée en post-qualification, qui doit montrer le fonctionnement <b>natif</b> d’au moins 80 % des fonctionnalités essentielles dans la solution logicielle réelle.', 'warn')}
      <section class="card">${H.chips('covF', [['all', 'Tout'], ['P1', 'P1'], ['P2', 'P2'], ['P3', 'P3'], ['o', 'Socle et technique']], f, 'Filtrer')}
        <div class="tbox"><table><thead><tr><th>N°</th><th>Module</th><th>Priorité</th><th>Ce que montre l’application</th><th>Écran(s)</th></tr></thead><tbody>
        ${R.filter(r => match(r[2])).map(r => `<tr><td class="mono"><b>${r[0]}</b></td><td style="min-width:200px"><b>${esc(r[1])}</b></td><td>${pill(r[2], PC[r[2]])}</td><td class="muted" style="min-width:300px">${esc(r[3])}</td><td style="min-width:170px">${r[4].map(k => App.canSee(k) ? `<a href="#${k}" data-a="nav" data-r="${k}" style="display:block">${L[k]} ›</a>` : `<span class="muted" style="display:block">${L[k]} (non autorisé)</span>`).join('')}</td></tr>`).join('')}
        </tbody></table></div></section>`;
    }
  });

  /* ================= UTILISATEURS ET DROITS ================= */
  function sodRules(mx) {
    const P = DATA.P, col = k => P.findIndex(p => p[0] === k);
    return [
      ['Préparer la paie ≠ valider la paie', 'Un même profil ne peut pas saisir la paie (S) et la valider (V).', P.filter((p, j) => mx[10][j] >= 2 && mx[11][j] >= 3)],
      ['Proposer un acte ≠ le viser financièrement', 'Le visa du Contrôle financier reste indépendant de l’initiateur.', P.filter((p, j) => mx[3][j] >= 2 && mx[4][j] >= 3)],
      ['Administrer les comptes ≠ valider des opérations', 'L’administrateur des droits ne détient aucune validation sur la paie, les postes ou les actes.', P.filter((p, j) => mx[15][j] >= 4 && [1, 4, 11].some(r => mx[r][j] >= 3))],
      ['L’auditeur reste en lecture seule', 'Le profil Auditeur ne détient que des droits de lecture.', mx.some(r => r[col('AUD')] > 1) ? [P[col('AUD')]] : []],
      ['Le portail agent n’accède qu’aux données personnelles', 'Le profil Agent n’a aucun droit de validation.', mx.some(r => r[col('AGT')] >= 3) ? [P[col('AGT')]] : []],
      ['Créer un poste ≠ l’approuver', 'La validation budgétaire d’un poste est réservée à l’Ordonnateur.', P.filter((p, j) => mx[1][j] >= 3 && p[0] !== 'ORD')]
    ];
  }
  MOD.sodRules = sodRules;
  reg('utilisateurs', {
    title: 'Utilisateurs, profils et droits d’accès', menu: 'Utilisateurs et droits', crumb: 'Système · Sécurité et habilitations', rows: [15],
    render() {
      const st = S(), P = DATA.P, mx = st.mx;
      const admin = can(15, 4);
      const rules = sodRules(mx), nConf = rules.filter(r => r[2].length).length;
      const tab = ui('usT', 'users');
      const head = `<div class="kpis">${kpi('Comptes gestionnaires actifs', '1 318', '+ 24 812 comptes agents')}${kpi('Profils définis', '10', 'droits par module et périmètre')}${kpi('Double authentification', '100 %', 'obligatoire pour les gestionnaires')}${kpi('Conflits de séparation des tâches', String(nConf), 'contrôle en temps réel', nConf ? 'bad' : 'ok')}</div>
      ${admin ? '' : note('Lecture seule : seul le profil Administrateur système peut modifier les comptes et les droits.', 'n')}
      ${seg('usT', [['users', 'Utilisateurs'], ['matrix', 'Profils et droits'], ['sod', 'Séparation des tâches' + (nConf ? ' (' + nConf + ')' : '')], ['log', 'Journal des habilitations']], tab, 'Rubriques')}`;
      if (tab === 'matrix') {
        return head + `<section class="card"><div class="row sb"><h2>Matrice des droits par profil</h2><div class="row small muted" style="gap:10px">${H.LV.map((l, i) => `<span class="row" style="gap:5px"><span class="lv lv${i}" style="cursor:default">${l}</span>${H.LVN[i]}</span>`).join('')}</div></div>
          ${note('Les droits s’appliquent immédiatement : retirer la lecture d’un module à un profil le fait disparaître de son menu à la prochaine connexion. Cliquez sur une case pour changer le niveau.', 'info')}
          <div class="tbox"><table><thead><tr><th style="min-width:230px">Module / fonction</th>${P.map(p => `<th style="text-align:center;white-space:normal;min-width:78px;font-size:11px">${esc(p[2])}</th>`).join('')}</tr></thead><tbody>
          ${DATA.R.map((r, i) => `<tr><td>${esc(r)}</td>${P.map((p, j) => { const v = mx[i][j]; const conf = v >= 2 && rules.some(x => x[2].includes(p)); return `<td style="text-align:center;padding:4px">${admin ? `<button type="button" class="lv lv${v}${conf ? ' conf' : ''}" data-a="mx-cycle" data-i="${i}" data-j="${j}" aria-label="${esc(p[1] + ' · ' + r + ' : ' + H.LVN[v] + '. Changer.')}">${H.LV[v]}</button>` : `<span class="lv lv${v}" style="cursor:default" title="${H.LVN[v]}">${H.LV[v]}</span>`}</td>`; }).join('')}</tr>`).join('')}
          <tr><td><b>Périmètre de données</b></td>${P.map(p => `<td class="small muted" style="text-align:center">${esc(p[3])}</td>`).join('')}</tr></tbody></table></div>
          <div>${btn('Rétablir la matrice de référence', 'mx-reset', { req: [15, 4] })}</div></section>`;
      }
      if (tab === 'sod') return head + `<section class="card"><h2>Règles de séparation des tâches</h2>${rules.map(([t, w, bad]) => `<div class="row" style="align-items:flex-start;flex-wrap:nowrap;border:1px solid ${bad.length ? 'var(--bad)' : 'var(--line2)'};border-radius:10px;padding:12px">${pill(bad.length ? 'Conflit' : 'Conforme')}<div><b>${t}</b><div class="muted">${w}</div>${bad.length ? `<div class="small" style="color:var(--bad);margin-top:4px">En conflit : ${bad.map(p => esc(p[1])).join(', ')}</div>` : ''}</div></div>`).join('')}<span class="muted">Pour le démontrer : donnez « Validation » au Gestionnaire de la solde sur « Paie · validation et ordonnancement ».</span></section>`;
      if (tab === 'log') { const types = /droit|compte|MFA|profil|matrice|Connexion|Déconnexion/i; const L = st.audit.filter(a => types.test(a.a)).slice(0, 40); return head + `<section class="card"><h2>Journal des habilitations</h2><div class="tbox"><table><thead><tr><th>Horodatage</th><th>Auteur</th><th>Action</th><th>Objet</th></tr></thead><tbody>${L.map(a => `<tr><td class="mono">${esc(a.t)}</td><td class="mono">${esc(a.u)}</td><td>${esc(a.a)}</td><td class="muted">${esc(a.o)}</td></tr>`).join('')}</tbody></table></div></section>`; }
      const q = ui('usQ', '').trim().toLowerCase(), pf = ui('usP', '');
      const users = st.users.map((u, i) => ({ u, i })).filter(({ u }) => (!pf || u.prof === pf) && (!q || (u.name + ' ' + u.login).toLowerCase().includes(q)));
      const np = ui('nProf', 'GRH');
      return head + `<div class="cols">
        <section class="card w3"><div class="fgrid">${input('u-q', 'Rechercher', 'usQ', ui('usQ', ''), { type: 'search', ph: 'Nom ou identifiant' })}${select('u-p', 'Profil', 'usP', pf, [['', 'Tous les profils']].concat(P.map(p => [p[0], p[1]])))}</div>
          <div class="tbox"><table><thead><tr><th>Utilisateur</th><th>Profil</th><th>Périmètre</th><th>MFA</th><th>Dernière connexion</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
          ${users.map(({ u, i }) => `<tr><td><b>${esc(u.name)}</b><div class="mono muted">${esc(u.login)}</div></td><td>${pill(App.profName(u.prof), 'info')}</td><td>${esc(u.scope)}</td><td class="small">${esc(u.mfa)}</td><td class="mono small">${esc(u.last)}</td><td>${pill(u.status)}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap">${u.status === 'En attente de validation' ? btn('Valider (RSSI)', 'us-validate', { sm: true, req: [15, 4], data: { i } }) : btn(u.status === 'Actif' ? 'Suspendre' : 'Réactiver', 'us-toggle', { sm: true, danger: u.status === 'Actif', req: [15, 4], data: { i } })}${btn('MFA', 'us-mfa', { sm: true, req: [15, 4], data: { i }, aria: 'Réinitialiser la double authentification de ' + u.name })}</div></td></tr>`).join('')}
          </tbody></table></div></section>
        <section class="card"><h2>Créer un compte gestionnaire</h2>
          ${input('n-n', 'Nom et prénom', 'nName', ui('nName', 'GOUNDJÉ Hortense'))}
          ${select('n-p', 'Profil', 'nProf', np, P.filter(p => p[0] !== 'AGT').map(p => [p[0], p[1]]))}
          ${select('n-s', 'Périmètre de données', 'nScope', ui('nScope', 'Santé et Population'), ['Tous ministères'].concat(DATA.E.filter(e => e[4] !== 'del').map(e => e[3])))}
          ${note(esc((P.find(p => p[0] === np) || P[0])[4]), 'n')}
          ${btn('Demander la création', 'us-create', { p: true, req: [15, 4] })}
          <span class="muted small">Principe des « quatre yeux » : le compte n’est actif qu’après validation par le responsable de la sécurité.</span></section></div>`;
    }
  });
  on('mx-cycle', d => { const st = S(); const i = +d.i, j = +d.j, v = st.mx[i][j]; st.mx[i][j] = (v + 1) % 5; log('Modification de droit', DATA.P[j][1] + ' · ' + DATA.R[i] + ' : ' + H.LVN[v] + ' → ' + H.LVN[(v + 1) % 5]); });
  on('mx-reset', () => { S().mx = DATA.BASE.map(r => r.slice()); log('Rétablissement de la matrice', 'Matrice de référence v1.0'); toast('Matrice de référence rétablie.'); });
  on('us-toggle', d => { const u = S().users[+d.i]; u.status = u.status === 'Actif' ? 'Suspendu' : 'Actif'; log(u.status === 'Actif' ? 'Réactivation de compte' : 'Suspension de compte', u.login); toast('Compte ' + u.login + ' : ' + u.status.toLowerCase() + '.'); });
  on('us-mfa', d => { const u = S().users[+d.i]; log('Réinitialisation MFA', 'Compte ' + u.login); toast('Double authentification réinitialisée pour ' + u.login + ' : un SMS d’activation est envoyé.'); });
  on('us-validate', d => { const u = S().users[+d.i]; u.status = 'Actif'; u.last = 'jamais'; log('Validation de compte (RSSI)', u.login + ' · ' + App.profName(u.prof)); toast('Compte ' + u.login + ' activé.'); });
  on('us-create', () => {
    const st = S(), np = ui('nProf', 'GRH'), sc = ui('nScope', 'Santé et Population'), nm = ui('nName', 'GOUNDJÉ Hortense');
    const login = np.toLowerCase() + '.' + sc.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 4) + String(st.users.length + 1).padStart(2, '0');
    st.users.unshift({ name: nm, login, prof: np, scope: sc, status: 'En attente de validation', last: '—', mfa: 'À activer' });
    log('Demande de création de compte', login + ' · ' + App.profName(np) + ' · ' + sc); toast('Demande créée pour ' + login + ', en attente de validation.');
  });
})();
