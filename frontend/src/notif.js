/* SIGRHE · Notifications dans l'application et par courriel (et SMS pour les agents) */
window.MOD = window.MOD || {};
(function () {
  const { reg, on, ui, log, toast, can } = App;
  const H = App.h;
  const { esc, nf, btn, pill, note, kpi, chips, seg } = H;
  const S = () => App.S;
  const DOM = 'sigrhe.gouv.cf';
  const AGT_MAT = '211-0457-B';

  /* ---------- Règles : événement du journal → destinataires et canaux ---------- */
  const R = [
    { k: 'acte-new', g: 'Carrière', re: /^Proposition d’acte/, to: ['DRH', 'CF'], t: () => 'Nouvel acte à viser', b: e => 'Un acte de carrière vient d’être proposé (' + e.o + '). Il attend votre visa dans le circuit.', r: 'carriere', p: 'haute', mail: true },
    { k: 'acte-visa', g: 'Carrière', re: /^Visa d’acte · /, to: ['DRH', 'CF', 'GRH'], t: e => 'Acte visé : ' + e.a.replace('Visa d’acte · ', ''), b: e => 'L’acte ' + e.o + ' a franchi l’étape « ' + e.a.replace('Visa d’acte · ', '') + ' ».', r: 'carriere', p: 'normale', mail: false },
    { k: 'acte-renvoi', g: 'Carrière', re: /^Renvoi d’acte/, to: ['GRH'], t: () => 'Acte renvoyé pour correction', b: e => 'L’acte ' + e.o + ' vous est renvoyé pour correction.', r: 'carriere', p: 'haute', mail: true },
    { k: 'paie-valider', g: 'Paie', re: /^Paie novembre · Contrôles terminée/, to: ['ORD', 'CF'], t: () => 'Campagne de paie de novembre à valider', b: () => 'Les contrôles de cohérence sont terminés. La campagne attend votre visa et la signature de l’ordonnateur.', r: 'paie', p: 'haute', mail: true },
    { k: 'paie-signee', g: 'Paie', re: /^Paie novembre · Validation terminée/, to: ['SOL'], t: () => 'Paie de novembre signée', b: () => 'L’ordonnateur a signé la campagne. Les transmissions à SIM-BA, SYSTAC et au paiement mobile peuvent être lancées.', r: 'paie', p: 'haute', mail: true },
    { k: 'paie-rejets', g: 'Paie', re: /^Transmission paie novembre · /, when: e => /[1-9]\d* rejet|[1-9]\d* en échec/.test(e.o), to: ['SOL'], t: e => 'Rejets de paiement à traiter (' + e.a.split(' · ').pop() + ')', b: e => e.o, r: 'paie', p: 'haute', mail: true },
    { k: 'paie-publiee', g: 'Paie', re: /^Paie novembre · Transmission terminée/, to: ['AGT', 'DRH', 'SOL'], t: e => 'Bulletins de paie de novembre 2026 publiés', b: () => 'Les bulletins de novembre 2026 sont disponibles. Les agents les consultent sur le portail et l’application mobile.', bA: () => 'Votre bulletin de paie de novembre 2026 est disponible dans votre espace agent.', r: 'paie', rA: 'portail', p: 'normale', mail: true, sms: true },
    { k: 'pp-version', g: 'Paie', re: /^Nouvelle version des paramètres de paie/, to: ['SOL', 'CF', 'ORD', 'AUD'], t: e => 'Paramètres de paie modifiés (' + e.a.split(' ').pop() + ')', b: e => 'Modifications : ' + e.o + '. Elles s’appliqueront à la prochaine campagne.', r: 'paie', p: 'haute', mail: true },
    { k: 'fiche-dem', g: 'Dossiers', re: /^Demande de modification de fiche/, to: ['DRH'], t: () => 'Modification de dossier à valider', b: e => e.o, r: 'fiche', p: 'normale', mail: true },
    { k: 'fiche-dec', g: 'Dossiers', re: /^(Validation|Rejet) de la modification/, to: ['GRH', 'AGT'], agentOnly: true, t: e => /^Validation/.test(e.a) ? 'Modification de dossier validée' : 'Modification de dossier rejetée', b: e => e.o, r: 'fiche', rA: 'portail', p: 'normale', mail: true },
    { k: 'piece', g: 'Dossiers', re: /^Téléversement de document/, when: e => /dossier de l’agent/.test(e.o), to: ['DRH'], t: () => 'Pièce à vérifier', b: e => e.o, r: 'fiche', p: 'basse', mail: false },
    { k: 'piece-ok', g: 'Dossiers', re: /^Vérification de pièce/, to: ['GRH'], t: () => 'Pièce vérifiée par la DRH', b: e => e.o, r: 'fiche', p: 'basse', mail: false },
    { k: 'portail-dem', g: 'Portail agent', re: /^Demande déposée sur le portail agent/, to: ['GRH', 'DRH', 'AGT'], t: () => 'Nouvelle demande d’un agent', tA: () => 'Accusé de réception de votre demande', b: e => e.o, bA: e => 'Votre demande ' + e.o + ' a bien été reçue. Vous serez notifié(e) à chaque étape.', r: 'presences', rA: 'portail', p: 'normale', mail: true, sms: true },
    { k: 'conge-ok', g: 'Portail agent', re: /^(Approbation|Refus) de congé/, to: ['AGT'], t: e => /^Approbation/.test(e.a) ? 'Votre demande de congé est approuvée' : 'Votre demande de congé est refusée', b: e => 'Congé ' + String(e.o).replace(/^[^·]*· /, '') + '.', r: 'portail', p: 'normale', mail: true, sms: true },
    { k: 'poste-new', g: 'Postes', re: /^Proposition de création de poste/, to: ['ORD'], t: () => 'Poste budgétaire à valider', b: e => 'Contrôle des crédits requis pour ' + e.o + '.', r: 'postes', p: 'normale', mail: true },
    { k: 'poste-ok', g: 'Postes', re: /^Validation budgétaire de poste/, to: ['GRH', 'DRH'], t: () => 'Poste validé par le Budget', b: e => 'Le poste ' + e.o + ' est intégré et peut être publié.', r: 'postes', p: 'normale', mail: false },
    { k: 'laureats', g: 'Recrutement', re: /^Intégration des lauréats/, to: ['SOL', 'DRH'], t: () => 'Nouveaux agents à prendre en charge en paie', b: e => e.o, r: 'paie', p: 'normale', mail: true },
    { k: 'pension', g: 'Pensions', re: /^Liquidation de pension/, to: ['SOL'], t: () => 'Pension liquidée : mise en paiement', b: e => e.o, r: 'pensions', p: 'normale', mail: true },
    { k: 'pen-calc', g: 'Pensions', re: /^Pension · Calcul automatisé validé/, to: ['CF'], t: () => 'Liquidation de pension à viser', b: e => e.o, r: 'pensions', p: 'haute', mail: true },
    { k: 'pen-visa', g: 'Pensions', re: /^Pension · Visa du Contrôle financier validé/, to: ['ORD'], t: () => 'Pension à ordonnancer', b: e => e.o, r: 'pensions', p: 'haute', mail: true },
    { k: 'pen-ord', g: 'Pensions', re: /^Pension · Ordonnancement validé/, to: ['SOL'], t: () => 'Pension à mettre en paiement', b: e => e.o, r: 'pensions', p: 'haute', mail: true },
    { k: 'pen-pay', g: 'Pensions', re: /^Pension · Mise en paiement/, to: ['DRH', 'GRH'], t: () => 'Pension liquidée et mise en paiement', b: e => e.o, r: 'pensions', p: 'normale', mail: true },
    { k: 'pen-pieces', g: 'Pensions', re: /^Pièces de pension manquantes/, to: ['GRH'], t: () => 'Pièces manquantes pour une pension', b: e => e.o, r: 'pensions', p: 'haute', mail: true },
    { k: 'run-calc', g: 'Pensions', re: /^Pensions · Calcul de la paie des pensions validé/, to: ['CF'], t: () => 'Paie des pensions à viser', b: e => e.o, r: 'pensions', p: 'haute', mail: true },
    { k: 'run-visa', g: 'Pensions', re: /^Pensions · Visa du Contrôle financier validé/, to: ['ORD'], t: () => 'Paie des pensions à ordonnancer', b: e => e.o, r: 'pensions', p: 'haute', mail: true },
    { k: 'run-tx', g: 'Pensions', re: /^Pensions · Ordonnancement et transmission validé/, to: ['SOL', 'DRH'], t: () => 'Paie des pensions transmise : retours de paiement attendus', b: e => e.o, r: 'pensions', p: 'normale', mail: true },
    { k: 'run-ok', g: 'Pensions', re: /^Pensions · perception confirmée/, to: ['DRH', 'CF', 'ORD'], t: () => 'Pensions payées et perçues', b: e => e.o, r: 'pensions', p: 'normale', mail: false },
    { k: 'pen-new', g: 'Pensions', re: /^Pension · ouverture de dossier/, to: ['SOL', 'DRH'], t: () => 'Nouveau dossier de pension', b: e => e.o, r: 'pensions', p: 'normale', mail: false },
    { k: 'disc', g: 'Discipline', re: /^Procédure disciplinaire/, to: ['DRH', 'GRH'], t: e => 'Procédure disciplinaire : ' + e.a.split(' · ').pop(), b: e => e.o, r: 'discipline', p: 'normale', mail: true },
    { k: 'ged', g: 'GED', re: /^(Circuit GED|Envoi en circuit de validation|Génération de document)/, to: ['DRH'], t: () => 'Document en circuit de validation', b: e => e.a + ' · ' + e.o, r: 'ged', p: 'normale', mail: false },
    { k: 'courrier', g: 'GED', re: /^Enregistrement de courrier/, to: ['DRH'], t: () => 'Nouveau courrier enregistré', b: e => e.o, r: 'ged', p: 'basse', mail: false },
    { k: 'compte', g: 'Sécurité', re: /^Demande de création de compte/, to: ['ADM'], t: () => 'Compte utilisateur à valider', b: e => e.o, r: 'utilisateurs', p: 'normale', mail: true },
    { k: 'droits', g: 'Sécurité', re: /^(Modification de droit|Rétablissement de la matrice|Réinitialisation MFA)/, to: ['AUD', 'ADM'], t: e => 'Alerte sécurité : ' + e.a.toLowerCase(), b: e => e.o + ' (par ' + e.u + ')', r: 'utilisateurs', p: 'haute', mail: true }
  ];
  const PRIO = { haute: 'bad', normale: 'info', basse: 'n' };

  const seed = () => {
    const items = [], mails = [], d = '22/10/2026 16:';
    const add = (to, t, b, r, p, m) => { const u = DATA.users.find(x => x.login === to); if (!u) return; items.push({ id: 'N-' + (1000 + items.length), to, t, b, r, p, date: d + String(10 + items.length).padStart(2, '0'), read: false, rule: 'echeance', mail: !!m }); if (m) mails.push(mailOf(u, t, b, r, d + String(10 + items.length).padStart(2, '0'), 'echeance', 'Envoyé')); };
    add('drh.mfp01', 'Échéance : clôture de la campagne d’évaluation le 15/11/2026', '38 % des fiches d’évaluation restent à valider dans les ministères.', 'evaluation', 'haute', true);
    add('drh.mfp01', 'Rappel : 12 départs à la retraite au 01/01/2027', 'Les actes d’admission à la retraite doivent être signés avant le 30/11/2026.', 'carriere', 'normale', false);
    add('grh.msp02', 'Pièces d’identité expirées (4 agents)', '4 agents du ministère de la Santé ont une pièce d’identité expirée dans leur dossier.', 'agents', 'normale', true);
    add('solde.dgb02', 'Ouverture de la campagne de paie de novembre', 'La collecte des éléments variables est ouverte jusqu’au 15/11/2026.', 'paie', 'normale', true);
    add('211-0457-B', 'Votre évaluation 2026 est disponible', 'Votre supérieur a saisi votre évaluation annuelle. Prenez-en connaissance avant le 15/11/2026.', 'portail', 'normale', true);
    add('audit.cdc01', 'Rapport mensuel de la piste d’audit disponible', 'Le rapport d’octobre 2026 est prêt.', 'interop', 'basse', false);
    return { items, mails, rules: Object.fromEntries(R.map(r => [r.k, { app: true, mail: r.mail, sms: !!r.sms }])), prefs: {} };
  };
  MOD.notif = seed;
  const N = () => App.mod('notif', MOD.notif);

  const userMail = u => u.prof === 'AGT' ? ((MOD.fiche && S().agents.find(a => a.mat === u.login)) ? MOD.fiche(S().agents.find(a => a.mat === u.login)).mail : 'agent@' + DOM) : u.login + '@' + DOM;
  function mailOf(u, subj, body, route, date, rule, status) {
    return { id: 'MSG-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(), to: userMail(u), toName: u.name, login: u.login, subj: '[SIGRHE] ' + subj, body: 'Bonjour ' + u.name + ',\n\n' + body + '\n\nAccéder au SIGRHE : https://' + DOM + '/#' + route + '\n\nCe message est envoyé automatiquement par le Système intégré de gestion des ressources humaines de l’État. Merci de ne pas y répondre.\nMinistère des Finances et du Budget · République centrafricaine', date, rule, status, canal: 'Courriel' };
  }

  /* Le journal d'audit déclenche les notifications */
  MOD.onLog = e => {
    if (!S().m) return;
    const st = N(), actor = e.u;
    const actorU = DATA.users.find(u => u.login === actor);
    const mat0 = (String(e.o).match(/\b\d{3}-\d{4}-[A-Z]\b/) || [])[0] || (/portail/.test(e.a) && actorU && actorU.prof === 'AGT' ? (actorU.mat || actorU.login) : null);
    const ag = mat0 && S().agents.find(g => g.mat === mat0);
    R.forEach(r => {
      if (!r.re.test(e.a) || (r.when && !r.when(e))) return;
      const cfg = st.rules[r.k] || { app: true, mail: r.mail };
      if (!cfg.app && !cfg.mail && !cfg.sms) return;
      DATA.users.filter(u => r.to.includes(u.prof) && (u.login !== actor || (r.k === 'portail-dem' && u.prof === 'AGT'))).forEach(u => {
        if (u.prof === 'AGT' && r.k !== 'paie-publiee') { const um = u.mat || u.login, ua = S().agents.find(g => g.mat === um); const concerned = String(e.o).includes(um) || (ua && String(e.o).includes(ua.nom + ' ' + ua.prenom)) || e.u === u.login; if (!concerned) return; }
        if (u.prof === 'GRH' && ag && u.scope !== ag.min) return; // le gestionnaire sectoriel ne reçoit que son ministère
        const isA = u.prof === 'AGT', t = isA && r.tA ? r.tA(e) : r.t(e), b = isA && r.bA ? r.bA(e) : r.b(e), route = isA ? (r.rA || 'portail') : r.r;
        const pf = st.prefs[u.login] || {};
        const mailOn = cfg.mail && pf.mail !== false;
        if (cfg.app) st.items.unshift({ id: 'N-' + (1000 + st.items.length + Math.floor(Math.random() * 1e5)), to: u.login, t, b, r: route, p: r.p, date: e.t, read: false, rule: r.k, mail: mailOn, mat: (String(e.o).match(/\b\d{3}-\d{4}-[A-Z]\b/) || [])[0] || null });
        if (mailOn) st.mails.unshift(mailOf(u, t, b, route, e.t, r.k, pf.digest ? 'En file · récapitulatif de 18 h' : 'Envoyé'));
        if (cfg.sms && isA) st.mails.unshift({ id: 'SMS-' + Date.now().toString(36).toUpperCase(), to: '+236 75 •• •• 18', toName: u.name, login: u.login, subj: 'SMS', body: 'SIGRHE : ' + t + '. Détails dans votre espace agent.', date: e.t, rule: r.k, status: 'Envoyé', canal: 'SMS' });
      });
    });
    if (st.items.length > 300) st.items.length = 300;
    if (st.mails.length > 300) st.mails.length = 300;
  };

  const mine = () => S().user ? N().items.filter(x => x.to === S().user.login) : [];

  /* ---------- Cloche de la barre supérieure ---------- */
  MOD.bell = () => {
    const L = mine(), n = L.filter(x => !x.read).length, open = ui('ntOpen', false);
    return `<div class="bell-wrap"><button type="button" class="btn sm bell" data-a="nt-toggle" aria-expanded="${open}" aria-label="Notifications${n ? ' : ' + n + ' non lue(s)' : ''}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>${n ? `<span class="badge">${n > 99 ? '99+' : n}</span>` : ''}</button>
      ${open ? `<div class="bell-pop" role="dialog" aria-label="Dernières notifications"><div class="row sb"><b>Notifications</b>${n ? `<button type="button" class="btn sm" data-a="nt-all">Tout marquer comme lu</button>` : ''}</div>
        ${L.slice(0, 6).map(item).join('') || '<p class="muted small" style="margin:0">Aucune notification.</p>'}
        <button type="button" class="btn sm" data-a="nt-page" style="justify-content:center">Voir toutes les notifications</button></div>` : ''}</div>`;
  };
  const item = x => `<button type="button" class="nt-item${x.read ? '' : ' unread'}" data-a="nt-open" data-id="${x.id}"><span class="dot" style="background:var(--${x.read ? 'line' : PRIO[x.p] === 'bad' ? 'bad' : 'accent'})"></span><span style="min-width:0;flex:1"><b>${esc(x.t)}</b><span class="small muted" style="display:block">${esc(x.b)}</span><span class="small muted">${x.date}${x.mail ? ' · courriel envoyé' : ''}</span></span></button>`;
  on('nt-toggle', () => App.setUi('ntOpen', !ui('ntOpen', false)));
  on('nt-all', () => { mine().forEach(x => { x.read = true; }); });
  on('nt-page', () => { App.setUi('ntOpen', false); App.go(S().user.prof === 'AGT' ? 'portail' : 'notifications'); if (S().user.prof === 'AGT') App.setUi('agtNt', true); });
  on('nt-open', d => { const x = N().items.find(y => y.id === d.id); if (!x) return; x.read = true; App.setUi('ntOpen', false); if (x.mat && S().agents.some(g => g.mat === x.mat)) { App.setUi('agSel', x.mat); if (x.r === 'fiche') App.setUi('fiT', 'syn'); } if (App.canSee(x.r)) App.go(x.r); });
  on('nt-read', d => { const x = N().items.find(y => y.id === d.id); if (x) x.read = !x.read; });

  /* ---------- Page « Notifications » ---------- */
  reg('notifications', {
    title: 'Notifications', menu: 'Notifications', crumb: 'Système · alertes dans l’application, courriels et SMS',
    render() {
      const st = N(), tab = ui('ntT', 'in'), me = S().user, L = mine();
      const allMail = can(15, 1) || can(14, 1) || me.prof === 'DRH';
      const M = allMail ? st.mails : st.mails.filter(m => m.login === me.login);
      const head = `<div class="kpis">${kpi('Non lues', String(L.filter(x => !x.read).length), 'sur ' + L.length + ' notification(s)')}${kpi('Priorité haute', String(L.filter(x => !x.read && x.p === 'haute').length), 'non lues')}${kpi('Courriels envoyés', String(M.filter(m => m.canal === 'Courriel' && m.status === 'Envoyé').length), allMail ? 'tous utilisateurs' : 'à votre adresse')}${kpi('Règles actives', String(Object.values(st.rules).filter(r => r.app || r.mail).length) + ' / ' + R.length, 'événements surveillés')}</div>
        ${seg('ntT', [['in', 'Mes notifications'], ['mail', 'Courriels et SMS envoyés'], ['rules', 'Règles de notification'], ['pref', 'Mes préférences']], tab, 'Rubriques')}`;
      if (tab === 'in') {
        const f = ui('ntF', 'all'), F = L.filter(x => f === 'all' || (f === 'unread' && !x.read) || (f === 'haute' && x.p === 'haute'));
        return head + `<section class="card"><div class="row sb">${chips('ntF', [['all', 'Toutes'], ['unread', 'Non lues'], ['haute', 'Priorité haute']], f, 'Filtre')}${L.some(x => !x.read) ? btn('Tout marquer comme lu', 'nt-all', { sm: true }) : ''}</div>
          <div class="stack" style="gap:0">${F.map(x => `<div class="row" style="gap:12px;border-bottom:1px solid var(--line2);padding:12px 0;flex-wrap:nowrap;align-items:flex-start"><span class="dot" style="width:10px;height:10px;border-radius:50%;margin-top:6px;flex:none;background:var(--${x.read ? 'line' : x.p === 'haute' ? 'bad' : 'accent'})"></span>
            <div style="flex:1;min-width:0"><div class="row" style="gap:8px"><b style="${x.read ? 'font-weight:500' : ''}">${esc(x.t)}</b>${pill(x.p === 'haute' ? 'Priorité haute' : x.p === 'basse' ? 'Information' : 'À traiter', PRIO[x.p])}</div><div class="muted">${esc(x.b)}</div><div class="small muted">${x.date} · dans l’application${x.mail ? ' · courriel envoyé à ' + esc(userMail(me)) : ''}</div></div>
            <span class="row" style="gap:6px;flex-wrap:nowrap">${App.canSee(x.r) ? btn('Ouvrir', 'nt-open', { sm: true, p: !x.read, data: { id: x.id } }) : ''}${btn(x.read ? 'Marquer non lu' : 'Marquer lu', 'nt-read', { sm: true, data: { id: x.id } })}</span></div>`).join('') || '<p class="muted" style="margin:0">Aucune notification pour ce filtre.</p>'}</div></section>`;
      }
      if (tab === 'mail') {
        const sel = M.find(m => m.id === ui('ntMail')) || M[0], q = (ui('ntMQ', '') || '').toLowerCase();
        const FM = M.filter(m => !q || (m.to + ' ' + m.subj + ' ' + m.toName).toLowerCase().includes(q));
        return head + note('Démonstration : les envois sont simulés et journalisés. En production, les courriels partent par le serveur de messagerie de l’État (SMTP authentifié, TLS) et les SMS par la passerelle des opérateurs ; les échecs sont relancés automatiquement. Le bouton « Envoyer une copie de test » ouvre votre propre messagerie.', 'info') + `<div class="cols">
          <section class="card w2"><label class="field" for="ntmq">Rechercher (destinataire, objet)<input id="ntmq" data-bind="ntMQ" value="${esc(ui('ntMQ', ''))}"></label><div class="stack" style="gap:2px;max-height:620px;overflow-y:auto">${FM.map(m => `<button type="button" data-a="tab" data-k="ntMail" data-v="${m.id}" style="text-align:left;border:0;border-radius:8px;padding:9px 10px;cursor:pointer;background:${sel && m.id === sel.id ? 'var(--accent-soft)' : 'transparent'};color:var(--fg)"><span class="row sb" style="flex-wrap:nowrap"><b style="font-weight:600">${esc(m.canal === 'SMS' ? 'SMS · ' + m.toName : m.subj.replace('[SIGRHE] ', ''))}</b>${pill(m.status === 'Envoyé' ? (m.canal === 'SMS' ? 'SMS' : 'Envoyé') : 'En file', m.status === 'Envoyé' ? 'ok' : 'warn')}</span><span class="small muted" style="display:block">${esc(m.to)} · ${m.date}</span></button>`).join('') || '<p class="muted">Aucun envoi.</p>'}</div></section>
          <section class="card w3">${sel ? `<div class="mail-prev"><div class="mail-h"><div><span class="small muted">De</span> SIGRHE &lt;notifications@${DOM}&gt;</div><div><span class="small muted">À</span> ${esc(sel.toName)} &lt;${esc(sel.to)}&gt;</div><div><span class="small muted">Date</span> ${sel.date}</div><div style="font-size:16px;margin-top:6px"><b>${esc(sel.subj)}</b></div></div><div class="mail-b">${esc(sel.body).replace(/\n/g, '<br>')}</div></div>
            <div class="row" style="gap:8px;align-items:flex-end"><label class="field" for="ntto" style="flex:1;min-width:220px">Adresse de test<input id="ntto" type="email" data-bind="ntTo" value="${esc(ui('ntTo', ''))}" placeholder="votre.adresse@exemple.cf"></label><a class="btn" href="mailto:${encodeURIComponent(ui('ntTo', ''))}?subject=${encodeURIComponent(sel.subj)}&body=${encodeURIComponent(sel.body)}" target="_blank" rel="noopener">Envoyer une copie de test</a>${sel.status !== 'Envoyé' ? btn('Envoyer maintenant', 'nt-flush', { sm: true, data: { id: sel.id } }) : ''}</div>` : '<p class="muted">Aucun message.</p>'}</section></div>`;
      }
      if (tab === 'rules') {
        const ed = can(15, 4), G = [...new Set(R.map(r => r.g))];
        const tg = (r, c) => { const on = st.rules[r.k][c]; return `<button type="button" class="tgl${on ? ' on' : ''}" role="switch" aria-checked="${on}" aria-label="${c} · ${esc(r.k)}" data-a="nt-rule" data-k="${r.k}" data-c="${c}"${ed ? '' : ' disabled'}><span></span></button>`; };
        return head + (ed ? '' : note('Lecture seule : seul l’administrateur système modifie les règles de notification.', 'info')) + G.map(g => `<section class="card"><h2>${g}</h2><div class="tbox"><table><thead><tr><th style="min-width:260px">Événement</th><th>Destinataires</th><th>Priorité</th><th style="text-align:center">Application</th><th style="text-align:center">Courriel</th><th style="text-align:center">SMS (agents)</th></tr></thead><tbody>${R.filter(r => r.g === g).map(r => `<tr><td><b>${esc(r.t({ a: '', o: '', u: '' }).replace(/ : $| \(\)$/, ''))}</b><div class="small muted mono">${esc(r.re.source.replace(/\^|\\|\(|\)|\|/g, ' ').trim().slice(0, 60))}</div></td><td class="small">${r.to.map(p => App.profName(p)).join(', ')}</td><td>${pill(r.p, PRIO[r.p])}</td><td style="text-align:center">${tg(r, 'app')}</td><td style="text-align:center">${tg(r, 'mail')}</td><td style="text-align:center">${r.to.includes('AGT') ? tg(r, 'sms') : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div></section>`).join('');
      }
      const pf = st.prefs[me.login] || {};
      const tg2 = (k, on, l, d) => `<div class="row sb" style="border-bottom:1px solid var(--line2);padding:12px 0;flex-wrap:nowrap;gap:12px"><div><b>${l}</b><div class="small muted">${d}</div></div><button type="button" class="tgl${on ? ' on' : ''}" role="switch" aria-checked="${on}" aria-label="${l}" data-a="nt-pref" data-k="${k}"><span></span></button></div>`;
      return head + `<section class="card" style="max-width:720px"><h2>Mes préférences de notification</h2>${H.field('ntmail', 'Adresse de réception', `<input id="ntmail" value="${esc(userMail(me))}" disabled>`)}
        ${tg2('mail', pf.mail !== false, 'Recevoir les notifications par courriel', 'Selon les règles définies par l’administrateur.')}
        ${tg2('digest', !!pf.digest, 'Regrouper les courriels en un récapitulatif quotidien (18 h)', 'Les alertes de priorité haute restent envoyées immédiatement.')}
        <span class="small muted">Les notifications dans l’application restent toujours actives : elles constituent la trace des tâches qui vous sont adressées.</span></section>`;
    }
  });
  on('nt-rule', d => { const r = N().rules[d.k]; r[d.c] = !r[d.c]; log('Modification d’une règle de notification', d.k + ' · ' + d.c + ' : ' + (r[d.c] ? 'activé' : 'désactivé')); });
  on('nt-pref', d => { const st = N(), l = S().user.login; st.prefs[l] = st.prefs[l] || {}; st.prefs[l][d.k] = d.k === 'mail' ? st.prefs[l].mail === false : !st.prefs[l][d.k]; });
  on('nt-test', d => { log('Envoi d’une copie de test de notification', d.id + ' → ' + (ui('ntTo', '') || 'adresse non renseignée')); });
  on('nt-flush', d => { const m = N().mails.find(x => x.id === d.id); if (m) m.status = 'Envoyé'; toast('Courriel envoyé.'); });

  /* Notifications de l'agent dans son espace (application mobile) */
  MOD.agentNotifsMini = () => {
    const L = mine(), n = L.filter(x => !x.read).length, open = ui('agtNt', false);
    return `<button type="button" data-a="tab" data-k="agtNt" data-v="${open ? '' : '1'}" aria-expanded="${!!open}" style="display:flex;width:100%;align-items:center;gap:8px;border:0;background:var(--accent-soft);color:var(--accent);padding:8px 16px;font:600 13px inherit;cursor:pointer;text-align:left"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span style="flex:1">${n ? n + ' nouvelle' + (n > 1 ? 's' : '') + ' notification' + (n > 1 ? 's' : '') : 'Notifications'}</span><span aria-hidden="true">${open ? '▲' : '▼'}</span></button>
      ${open ? `<div style="padding:8px 12px;background:var(--surface);border-bottom:1px solid var(--line2)">${L.slice(0, 5).map(item).join('') || '<p class="muted small" style="margin:4px">Aucune notification.</p>'}${n ? `<button type="button" class="btn sm" data-a="nt-all" style="margin-top:6px">Tout marquer comme lu</button>` : ''}</div>` : ''}`;
  };
  MOD.agentNotifs = () => {
    const L = mine().slice(0, 5), n = mine().filter(x => !x.read).length;
    return `<section class="card agt-nt" style="max-width:420px;margin:0 auto 16px"><div class="row sb"><b>Mes notifications${n ? ' (' + n + ' non lue' + (n > 1 ? 's' : '') + ')' : ''}</b>${n ? `<button type="button" class="btn sm" data-a="nt-all">Tout marquer comme lu</button>` : ''}</div>${L.map(item).join('') || '<p class="muted small" style="margin:0">Aucune notification.</p>'}<span class="small muted">Copie envoyée par courriel et par SMS selon vos préférences.</span></section>`;
  };
})();
