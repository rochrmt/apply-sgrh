/* SIGRHE · écrans : paie, pensions, interopérabilité et piste d'audit */
window.MOD = window.MOD || {};
(function () {
  const { reg, on, ui, log, toast, can } = App;
  const H = App.h;
  const { esc, nf, n1, pct, fcfa, kpi, btn, pill, seg, utabs, select, input, bars, note, steps, timeline } = H;
  const S = () => App.S;
  const agentBy = mat => S().agents.find(a => a.mat === mat);
  const addHist = (a, t, ref) => { if (a) { a.hist = a.hist || []; a.hist.unshift({ date: H.today(), t, ref }); } };

  /* ================= PAIE ================= */
  MOD.PAIE_STEPS = ['Collecte des variables', 'Calcul', 'Contrôles', 'Validation', 'Transmission', 'Publication'];
  MOD.paie = () => ({ step: 0, fixed: {}, hold: {}, sign: {} });
  function anomalies(pa) {
    const A = S().agents, out = [];
    A.filter(a => 2026 - a.yob >= 61 && (a.statut === 'Actif' || a.statut === 'Détachement')).forEach(a => out.push({ k: 'age-' + a.mat, mat: a.mat, rule: 'Âge supérieur à la limite légale', who: a.nom + ' ' + a.prenom, det: 'Né(e) en ' + a.yob + ', toujours en solde', act: 'Suspendre la solde', done: 'Suspendu' }));
    A.filter(a => a.niu === 'Non rapproché' && a.statut !== 'Suspendu' && a.statut !== 'Retraité').forEach(a => out.push({ k: 'niu-' + a.mat, mat: a.mat, rule: 'Identifiant national non rapproché', who: a.nom + ' ' + a.prenom, det: a.min, act: 'Mettre le paiement en attente', done: 'En attente' }));
    out.push({ k: 'var-097-1120-D', mat: '097-1120-D', rule: 'Variation du net > 20 %', who: 'DÉKOUNA Pascal', det: 'Rappel de solde de 3 mois (avancement 2026)', act: 'Justifier', done: 'Justifié' });
    out.push({ k: 'dbl-1', mat: '', rule: 'Doublon d’identité', who: 'Agents 133-0921-B / 214-0045-B', det: 'Même nom, date et lieu de naissance', act: 'Bloquer et enquêter', done: 'Bloqué' });
    return out.map(x => ({ ...x, ok: !!pa.fixed[x.k] }));
  }
  reg('paie', {
    title: 'Campagne de paie — novembre 2026', menu: 'Paie', crumb: 'Solde et pensions · Module 4', tag: 'P1', rows: [10, 11],
    render() {
      const pa = App.mod('paie', MOD.paie);
      const st = pa.step;
      const ptab = ui('paT', 'camp');
      const ptabs = utabs('paT', [['camp', 'Campagne mensuelle'], ['bulletin', 'Moteur de calcul · bulletin'], ['virements', 'Virements par banque et mode'], ['params', 'Paramètres et barèmes'], ['interfaces', 'Interfaces SIM-BA · SYSTAC · mobile']], ptab, 'Paie');
      const an = anomalies(pa), left = an.filter(a => !a.ok).length;
      const sample = S().agents.filter(a => a.statut !== 'Suspendu' && a.statut !== 'Retraité' && a.statut !== 'Disponibilité' && !pa.hold[a.mat]);
      const net = sample.reduce((s, a) => s + a.net, 0);
      const req = [[10, 2], [10, 2], [10, 2], [11, 3], [11, 3]][st];
      const NX = ['Clôturer la collecte et lancer le calcul', 'Lancer les contrôles', 'Soumettre à validation', 'Signer et valider (Ordonnateur)', 'Publier les bulletins'];
      const blocked = (st === 2 && left > 0) || (st === 4 && !MOD.payTxDone());
      let panel = '';
      if (st === 0) panel = `<h2>Collecte des éléments variables</h2><p class="muted" style="margin:0">Les mouvements validés dans les modules RH alimentent la paie. Aucune saisie manuelle de montant n’est autorisée.</p><div class="tbox"><table><thead><tr><th>Source</th><th class="num">Mouvements</th><th>Origine</th><th>État</th></tr></thead><tbody>${[['Avancements et reclassements', 214 + App.mod('carriere', MOD.carriere).actes.filter(a => a.p >= 4 && a.t === 'av').length, 'Module Carrière'], ['Nouvelles prises en charge (recrues)', 52 + S().agents.filter(a => a.statut === 'Stagiaire' && a.entree === 2027).length, 'Module Recrutement'], ['Mutations (indemnités de zone)', 96, 'Module Carrière'], ['Absences non justifiées', App.mod('presences', MOD.presences).sent ? 1036 : 1032, 'Temps et présences'], ['Suspensions et radiations', S().agents.filter(a => a.statut === 'Suspendu').length, 'Contrôle du fichier'], ['Oppositions et prêts', 3418, 'Banques (SYSTAC)']].map(r => `<tr><td>${r[0]}</td><td class="num mono">${nf(r[1])}</td><td class="muted">${r[2]}</td><td>${pill('Intégré', 'ok')}</td></tr>`).join('')}</tbody></table></div>`;
      if (st === 1) panel = MOD.paieCalcPanel();
      if (st === 2) panel = `<div class="row sb"><h2>Contrôles de cohérence</h2><span class="muted">${left} anomalie(s) bloquante(s) sur ${an.length} · issues du fichier des agents</span></div><div class="tbox" style="max-height:420px;overflow-y:auto"><table><thead><tr><th>Règle</th><th>Agent</th><th>Constat</th><th>Traitement</th></tr></thead><tbody>${an.map(a => `<tr><td>${a.rule}</td><td><b>${esc(a.who)}</b><div class="mono small muted">${a.mat}</div></td><td class="muted">${esc(a.det)}</td><td>${a.ok ? pill(a.done, 'ok') : btn(a.act, 'pa-fix', { sm: true, req: [10, 2], data: { k: a.k } })}</td></tr>`).join('')}</tbody></table></div>${left > 1 ? btn('Traiter toutes les anomalies (' + left + ')', 'pa-fixall', { req: [10, 2] }) : ''}`;
      if (st === 3) panel = `<h2>Validation hiérarchique (signature électronique)</h2><div class="fgrid">${[['Chef de service de la solde', pa.sign.sol || 'Signé à la soumission'], ['Contrôleur financier', pa.sign.cf || 'Visa automatique (conforme)'], ['Ordonnateur (DG Budget)', pa.sign.ord || 'En attente de signature']].map(([r, v], i) => `<div style="border:${i === 2 && !pa.sign.ord ? '2px solid var(--accent)' : '1px solid var(--line2)'};border-radius:10px;padding:12px"><div class="small muted">${r}</div><b>${esc(v)}</b></div>`).join('')}</div>${!can(11, 3) ? note('La validation et l’ordonnancement relèvent du Contrôleur financier ou de l’Ordonnateur : séparation des tâches avec la préparation de la paie.', 'info') : ''}`;
      if (st === 4) panel = MOD.paieTxPanel();
      if (st === 5) panel = `<h2>Campagne clôturée</h2>${note('24 864 bulletins électroniques publiés sur le portail agent, SMS de notification envoyés, état de liquidation archivé dans la GED.', 'ok')}<div class="row">${btn('Ouvrir une nouvelle campagne (démonstration)', 'pa-restart', { req: [10, 2] })}</div>`;
      if (ptab !== 'camp') return ptabs + MOD.paieTab(ptab);
      return ptabs + `<div class="kpis">${kpi('Agents en solde (État)', '24 864')}${kpi('Masse brute', '6,96 Md FCFA')}${kpi('Net à payer', '5,50 Md FCFA')}${kpi('Échantillon payable', nf(sample.length) + ' agents', n1(net / 1e6) + ' M FCFA nets')}</div>
      <section class="card">${steps(MOD.PAIE_STEPS, st >= 5 ? 6 : st)}${panel}
        <div class="row sb" style="border-top:1px solid var(--line2);padding-top:14px">${btn('Étape précédente', 'pa-prev', { req: [10, 2] })}${st < 5 ? (blocked ? `<span class="small" style="color:var(--warn)">${st === 4 ? 'Transmettez aux trois systèmes et traitez les rejets avant de publier.' : 'Traitez toutes les anomalies bloquantes pour continuer.'}</span>` : btn(NX[st], 'pa-next', { p: true, req })) : ''}</div>
        ${st < 5 && !can(req[0], req[1]) ? `<span class="lock">Étape réservée au profil « ${st >= 3 ? 'Ordonnateur ou Contrôleur financier' : 'Gestionnaire de la solde'} ».</span>` : ''}</section>`;
    }
  });
  on('pa-fix', d => {
    const pa = App.mod('paie', MOD.paie); pa.fixed[d.k] = true; const [type, ...rest] = d.k.split('-'); const mat = rest.join('-'); const g = agentBy(mat);
    if (type === 'age' && g) { g.statut = 'Suspendu'; addHist(g, 'Suspension de solde (limite d’âge dépassée)', 'Contrôle paie novembre'); }
    if (type === 'niu' && g) { pa.hold[mat] = true; addHist(g, 'Paiement mis en attente (NIU non rapproché)', 'Contrôle paie novembre'); }
    log('Traitement d’anomalie de paie', d.k);
  });
  on('pa-fixall', () => { const pa = App.mod('paie', MOD.paie); anomalies(pa).filter(a => !a.ok).forEach(a => ACT('pa-fix', { k: a.k })); toast('Toutes les anomalies ont été traitées.'); });
  function ACT(n, d) { const fn = { 'pa-fix': (dd) => { const pa = App.mod('paie', MOD.paie); pa.fixed[dd.k] = true; const [type, ...rest] = dd.k.split('-'); const mat = rest.join('-'); const g = agentBy(mat); if (type === 'age' && g) { g.statut = 'Suspendu'; addHist(g, 'Suspension de solde (limite d’âge dépassée)', 'Contrôle paie novembre'); } if (type === 'niu' && g) { pa.hold[mat] = true; } } }[n]; fn(d); }
  on('pa-next', () => {
    const pa = App.mod('paie', MOD.paie);
    if (pa.step === 3) { pa.sign.ord = 'Signé par ' + S().user.login + ' le ' + H.now(); }
    if (pa.step === 0) MOD.payApply();
    pa.step++; log('Paie novembre · ' + MOD.PAIE_STEPS[pa.step - 1] + ' terminée', 'par ' + S().user.login);
    if (pa.step === 5) { toast('Paie transmise et bulletins publiés sur le portail agent.'); }
  });
  on('pa-prev', () => { const pa = App.mod('paie', MOD.paie); if (pa.step > 0 && pa.step < 5) pa.step--; });
  on('pa-restart', () => { S().m.paie = MOD.paie(); log('Ouverture d’une campagne de paie', 'Démonstration'); });

  /* ================= PENSIONS ================= */
  MOD.pensions = () => ({ files: [
    { id: 'PEN-2026-0217', mat: '088-0912-A', nat: 'Pension d’ancienneté', date: '01/02/2027', state: 'En calcul', yrs: 38, idx: 1150 },
    { id: 'PEN-2026-0209', mat: '061-0207-M', nat: 'Pension d’ancienneté', date: '01/06/2025', state: 'Pièces manquantes', yrs: 35, idx: 980 },
    { id: 'PEN-2026-0198', mat: '077-1450-C', nat: 'Pension de réversion', date: '01/09/2026', state: 'Visa Contrôle financier', yrs: 30, idx: 1020 },
    { id: 'PEN-2026-0184', mat: '083-0322-A', nat: 'Pension d’invalidité', date: '01/08/2026', state: 'Liquidé', yrs: 22, idx: 760 }
  ] });
  reg('pensions', {
    title: 'Pensions, indemnités et retraites', menu: 'Pensions et retraites', crumb: 'Solde et pensions · Module 11', tag: 'P1', rows: [12],
    render() {
      const pe = App.mod('pensions', MOD.pensions);
      const sel = pe.files.find(f => f.id === ui('peSel', '')) || pe.files[0];
      const yrs = ui('peY', sel.yrs), idx = ui('peI', sel.idx);
      const base = idx * 310, rate = Math.min(75, yrs * 2), pen = Math.round(base * rate / 100);
      const nameOf = f => { const g = agentBy(f.mat); return g ? g.nom + ' ' + g.prenom : 'Agent ' + f.mat; };
      return `<div class="kpis">${kpi('Départs prévus (12 mois)', '418')}${kpi('Dossiers en instruction', String(pe.files.filter(f => f.state !== 'Liquidé').length + 33))}${kpi('Délai moyen de liquidation', '21 jours')}${kpi('Pensionnés payés (oct.)', '9 146')}</div>
      <div class="cols"><section class="card w3"><h2>Dossiers de liquidation</h2><div class="tbox"><table><thead><tr><th>N° dossier</th><th>Agent</th><th>Nature</th><th>Jouissance</th><th>État</th><th></th></tr></thead><tbody>${pe.files.map(f => `<tr class="${f.id === sel.id ? 'sel' : ''}"><td class="mono">${f.id}</td><td><b>${esc(nameOf(f))}</b><div class="mono small muted">${f.mat}</div></td><td>${f.nat}</td><td>${f.date}</td><td>${pill(f.state)}</td><td>${f.id === sel.id ? '<b class="small" style="color:var(--accent)">Ouvert</b>' : btn('Ouvrir', 'pe-open', { sm: true, data: { id: f.id } })}</td></tr>`).join('')}</tbody></table></div><span class="muted">Un dossier est ouvert automatiquement à la notification de l’admission à la retraite (module Carrière).</span></section>
      <section class="card w2"><h2>Simulateur et liquidation</h2><div class="muted">${esc(nameOf(sel))} · ${sel.id}</div>
        <div class="stack" style="gap:4px"><div class="row sb"><label for="pe-y" style="font-weight:500">Annuités validées</label><b class="mono">${yrs} ans</b></div><input id="pe-y" type="range" min="15" max="40" value="${yrs}" data-bind="peY" style="width:100%;accent-color:var(--accent)"></div>
        <div class="stack" style="gap:4px"><div class="row sb"><label for="pe-i" style="font-weight:500">Indice de fin de carrière</label><b class="mono">${idx}</b></div><input id="pe-i" type="range" min="400" max="2000" step="5" value="${idx}" data-bind="peI" style="width:100%;accent-color:var(--accent)"></div>
        <div class="kpis">${kpi('Traitement de base', fcfa(base))}${kpi('Taux de liquidation', rate + ' %')}${kpi('Pension mensuelle', '<span style="color:var(--accent)">' + fcfa(pen) + '</span>')}</div>
        ${note('Règle paramétrable, à confirmer selon le statut général et le régime de la caisse de retraite : 2 % par annuité, plafonné à 75 %, sur le traitement indiciaire de fin de carrière (point : 310 FCFA).', 'n')}
        ${sel.state === 'Liquidé' ? note('Pension liquidée' + (sel.amount ? ' : ' + fcfa(sel.amount) + ' par mois' : '') + '. Brevet de pension archivé dans la GED.', 'ok') : `<div class="row">${btn('Liquider la pension', 'pe-liq', { p: true, req: [12, 2], data: { id: sel.id, a: pen } })}${btn('Signaler des pièces manquantes', 'pe-miss', { req: [12, 2], data: { id: sel.id } })}</div>${H.lockNote(12, 2)}`}</section></div>`;
    }
  });
  on('pe-open', d => { App.setUi('peSel', d.id); delete App.S.ui.peY; delete App.S.ui.peI; });
  on('pe-liq', d => { const f = App.mod('pensions', MOD.pensions).files.find(x => x.id === d.id); f.state = 'Liquidé'; f.amount = +d.a; const g = agentBy(f.mat); addHist(g, 'Pension liquidée : ' + fcfa(+d.a) + ' / mois', f.id); log('Liquidation de pension', f.id + ' · ' + fcfa(+d.a)); toast('Pension liquidée et transmise à SIM-BA et à la caisse de retraite.'); });
  on('pe-miss', d => { const f = App.mod('pensions', MOD.pensions).files.find(x => x.id === d.id); f.state = 'Pièces manquantes'; log('Pièces manquantes signalées', f.id); });

  /* ================= INTEROPÉRABILITÉ ET AUDIT ================= */
  MOD.interop = () => ({ tested: {}, failed: false });
  reg('interop', {
    title: 'Interopérabilité, sécurité et niveaux de service', menu: 'Interopérabilité et sécurité', crumb: 'Système · Modules 14, 15 et §2.3', rows: [14],
    render() {
      const io = App.mod('interop', MOD.interop);
      const C = [['SIM-BA', 'Gestion financière de l’État : engagement, liquidation et ordonnancement de la paie.', 'Opérationnel', 'REST/XML', 118], ['SYSTAC', 'Télécompensation BEAC : virements vers les banques.', 'Opérationnel', 'ISO 20022 · 9 banques', 204], ['Mobile money', 'Paiement vers les wallets des opérateurs agréés.', 'Opérationnel', 'API REST · 2 opérateurs', 166], ['Registre d’état civil', 'Vérification de l’identité, naissances, mariages, décès.', 'Partiel', 'Lot hebdomadaire · rapprochement 94 %', 412], ['Identité nationale (NIU)', 'Identifiant unique, interopérable avec le registre biométrique.', 'En préparation', 'Connecteur prêt', 0], ['Casier judiciaire', 'Contrôle des candidats au recrutement.', 'Opérationnel', 'Requête unitaire · JSON', 287]];
      const q = ui('auQ', '').trim().toLowerCase(), uf = ui('auU', '');
      const A = S().audit.filter(a => (!uf || a.u === uf) && (!q || (a.a + ' ' + a.o).toLowerCase().includes(q)));
      const usersIn = [...new Set(S().audit.map(a => a.u))];
      const PS = 15, pages = Math.max(1, Math.ceil(A.length / PS)), pg = Math.min(ui('auPage', 0), pages - 1);
      return `<section class="card"><div class="row sb"><h2>Connecteurs (passerelle API)</h2><span class="muted">JSON / XML · TLS 1.3 · jetons OAuth 2.0 signés</span></div>
        <div class="fgrid">${C.map((c, i) => `<div style="border:1px solid var(--line2);border-radius:10px;padding:14px" class="stack"><div class="row sb"><b>${c[0]}</b>${pill(c[2])}</div><span class="muted">${c[1]}</span><span class="mono small">${io.tested[i] ? (c[4] ? 'Test OK · ' + c[4] + ' ms · certificat valide' : 'Service distant indisponible') : c[3]}</span>${btn(io.tested[i] ? 'Retester' : 'Tester la connexion', 'io-test', { sm: true, req: [14, 1], data: { i } })}</div>`).join('')}</div></section>
      <div class="cols"><section class="card"><h2>Hébergement et continuité</h2><div class="fgrid">${kpi('Site principal · Bangui', io.failed ? '<span style="font-size:16px;color:var(--warn)">En maintenance</span>' : '<span style="font-size:16px;color:var(--ok)">Actif</span>', '2 serveurs · 256 Go RAM · 32 To')}${kpi('Site de secours (CRS)', io.failed ? '<span style="font-size:16px;color:var(--ok)">Actif (bascule)</span>' : '<span style="font-size:16px;color:var(--accent)">Synchronisé</span>', 'réplication continue · RPO 15 min')}</div>
        <span class="muted">Sauvegarde complète chiffrée chaque nuit · énergie : réseau, solaire et groupe 100 kVA (48 h) · pare-feu NGFW et IPS.</span>
        ${io.failed ? note('Basculement réussi en 11 min 08 s (engagement : 15 minutes au plus). Aucune transaction validée perdue.', 'ok') + btn('Rétablir le site principal', 'io-fail', { req: [15, 4] }) : btn('Simuler un basculement vers le site de secours', 'io-fail', { req: [15, 4] })}</section>
        <section class="card"><h2>Niveaux de service mesurés (30 jours)</h2><div class="tbox"><table><thead><tr><th>Opération</th><th>Engagement</th><th>Mesuré</th></tr></thead><tbody>${[['Consultation d’un profil agent', '≤ 2 s', '0,8 s'], ['Calcul de paie (25 000 agents)', '≤ 5 min', '3 min 42 s'], ['Soumission d’une demande de congé', '≤ 3 s', '1,1 s'], ['Rapport RH standard (BI)', '≤ 10 s', '4,6 s'], ['Simulation budgétaire complexe', '≤ 30 s', '12 s'], ['Disponibilité', '≥ 99,5 %', '99,93 %']].map(r => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td><td class="mono"><b>${r[2]}</b> ${pill('Conforme')}</td></tr>`).join('')}</tbody></table></div></section></div>
      <section class="card"><div class="row sb"><h2>Piste d’audit (toutes les actions de l’application)</h2><span class="muted">${A.length} entrée(s)</span></div>
        <div class="fgrid">${input('au-q', 'Rechercher', 'auQ', ui('auQ', ''), { type: 'search', ph: 'Action ou objet' })}${select('au-u', 'Utilisateur', 'auU', uf, [['', 'Tous']].concat(usersIn))}</div>
        <div class="tbox"><table><thead><tr><th>Horodatage</th><th>Utilisateur</th><th>Action</th><th>Objet</th></tr></thead><tbody>${A.slice(pg * PS, pg * PS + PS).map(a => `<tr><td class="mono">${esc(a.t)}</td><td class="mono">${esc(a.u)}</td><td>${esc(a.a)}</td><td class="muted">${esc(a.o)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aucune entrée.</td></tr>'}</tbody></table></div>${H.pager('auPage', pg, pages)}</section>`;
    }
  });
  on('io-test', d => { const io = App.mod('interop', MOD.interop); io.tested[d.i] = true; log('Test de connecteur', ['SIM-BA', 'SYSTAC', 'Mobile money', 'État civil', 'Identité nationale', 'Casier judiciaire'][+d.i]); });
  on('io-fail', () => { const io = App.mod('interop', MOD.interop); io.failed = !io.failed; log(io.failed ? 'Basculement vers le site de secours' : 'Rétablissement du site principal', 'Plan de reprise d’activité'); });
})();
