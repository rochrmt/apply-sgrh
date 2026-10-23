/* SIGRHE · Module 11 : indemnités, pensions et retraites
   Données RH → calcul automatisé → validation (Contrôle financier, ordonnateur) → paiement (SIM-BA, caisse de retraite) */
window.MOD = window.MOD || {};
(function () {
  const { reg, on, ui, log, toast, can } = App;
  const H = App.h;
  const { esc, nf, kpi, btn, pill, seg, note, steps, timeline, chips } = H;
  const S = () => App.S;
  const agentBy = mat => S().agents.find(a => a.mat === mat);
  const TODAY = new Date(2026, 9, 23);
  const pd = s => { const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d); };
  const fd = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  const days = (a, b) => Math.round((b - a) / 86400000);
  const F = n => nf(Math.round(n)) + ' FCFA';

  /* ---------- Étapes du circuit ---------- */
  const ST = [
    { l: 'Constitution du dossier', who: 'Service des pensions', req: [12, 2], act: 'Valider les données RH et les pièces' },
    { l: 'Calcul automatisé', who: 'Service des pensions', req: [12, 2], act: 'Valider le calcul' },
    { l: 'Visa du Contrôle financier', who: 'Contrôleur financier', req: [4, 3], act: 'Viser la liquidation' },
    { l: 'Ordonnancement', who: 'Ordonnateur (DG Budget)', req: [11, 3], act: 'Ordonnancer la dépense' },
    { l: 'Mise en paiement', who: 'Gestionnaire de la solde', req: [10, 2], act: 'Transmettre à SIM-BA et à la caisse de retraite' },
    { l: 'Pension en paiement', who: '—', req: null, act: '' }
  ];
  const DELAI = 30; // jours, de l'ouverture du dossier à la mise en paiement
  const PIECES = ['Acte de naissance', 'Arrêté d’admission à la retraite', 'Relevé des services validés', 'Certificat de cessation de paiement', 'Relevé d’identité bancaire ou wallet'];

  /* ---------- Barèmes versionnés ---------- */
  const DEF = [
    ['taux', 'Taux par annuité liquidable', 2, '%', 'Pension = traitement de base × annuités × taux'],
    ['plafond', 'Taux maximal de liquidation', 75, '%', 'Plafond réglementaire'],
    ['minAnn', 'Annuités minimales pour une pension', 15, 'ans', 'En dessous : allocation unique'],
    ['minPen', 'Pension minimale garantie', 30000, 'FCFA / mois', 'Plancher mensuel'],
    ['majEnf', 'Majoration pour enfants élevés (3 et plus)', 10, '%', 'Sur la pension principale'],
    ['inval', 'Taux minimal de la pension d’invalidité', 50, '%', 'Quel que soit le nombre d’annuités'],
    ['rev', 'Pension de réversion (conjoint survivant)', 50, '%', 'De la pension du défunt'],
    ['solid', 'Retenue de solidarité sur pension', 1, '%', 'Retenue mensuelle'],
    ['indMois', 'Indemnité de départ : mois de traitement par 5 ans', 1, 'mois', 'Versée une fois à la liquidation'],
    ['indPlaf', 'Indemnité de départ : plafond', 6, 'mois', 'Plafond de l’indemnité'],
    ['capDec', 'Capital décès', 12, 'mois', 'Versé aux ayants droit']
  ];
  const P0 = () => Object.fromEntries(DEF.map(d => [d[0], d[2]]));
  const point = () => (MOD.pp ? App.mod('pp', MOD.pp).p.point : 250);

  /* ---------- Moteur de calcul ---------- */
  MOD.penCalc = (d, Pm) => {
    const P = Pm || App.mod('pen2', MOD.pen2).p, a = agentBy(d.mat) || d.ext;
    const pt = point(), base = Math.round(a.indice * pt);
    const fi = MOD.fiche && agentBy(d.mat) ? MOD.fiche(a) : { enf: Array.from({ length: (d.ext && d.ext.enfants) || 0 }, () => ({ charge: true })), conj: d.ext && d.ext.conj ? { nom: d.ext.conj } : null };
    const jy = pd(d.jouis).getFullYear();
    const ann = Math.max(0, jy - a.entree - (d.interr || 0));
    const L = []; const add = (c, l, b, t, m, f) => L.push({ c, l, b, t, m: Math.round(m), f });
    let taux = Math.min(P.plafond, ann * P.taux);
    if (d.nat === 'Pension d’invalidité') taux = Math.max(taux, P.inval);
    const allocation = d.nat === 'Pension d’ancienneté' && ann < P.minAnn;
    let pen = 0;
    if (d.nat === 'Pension de réversion' && d.revOf) {
      add('V1', 'Pension du pensionné décédé', null, '', d.revOf.brut, d.revOf.name + ' · brevet ' + d.revOf.pen);
      pen = d.revOf.brut * P.rev / 100; add('V2', 'Pension de réversion', d.revOf.brut, P.rev + ' %', pen, 'conjoint survivant');
      if (pen < P.minPen) { add('P4', 'Complément au minimum garanti', null, '', P.minPen - pen, 'pension minimale ' + nf(P.minPen)); pen = P.minPen; }
    } else if (!allocation) {
      add('P1', 'Traitement de base de fin de carrière', a.indice, pt + ' F/pt', base, 'indice ' + a.indice + ' × ' + pt + ' FCFA');
      add('P2', 'Pension principale', base, nf(taux) + ' %', base * taux / 100, ann + ' annuités × ' + P.taux + ' %' + (taux === P.plafond ? ' (plafonné)' : '') + (d.nat === 'Pension d’invalidité' && taux === P.inval ? ' (minimum invalidité)' : ''));
      pen = base * taux / 100;
      const nEnf = fi.enf.length;
      if (nEnf >= 3) { add('P3', 'Majoration pour enfants', pen, P.majEnf + ' %', pen * P.majEnf / 100, nEnf + ' enfants élevés'); pen += pen * P.majEnf / 100; }
      if (pen < P.minPen) { add('P4', 'Complément au minimum garanti', null, '', P.minPen - pen, 'pension minimale ' + nf(P.minPen)); pen = P.minPen; }
    }
    const brut = Math.round(pen), sol = Math.round(brut * P.solid / 100), net = brut - sol;
    const indMois = d.nat === 'Pension d’ancienneté' ? Math.min(P.indPlaf, Math.floor((jy - a.entree) / 5) * P.indMois) : 0;
    const indem = Math.round(indMois * base);
    const alloc = allocation ? Math.round(base * ann * 1) : 0; // allocation unique : 1 mois par annuité
    const late = Math.max(0, (TODAY.getFullYear() - jy) * 12 + TODAY.getMonth() - (pd(d.jouis).getMonth()) + (TODAY >= pd(d.jouis) ? 1 : 0));
    const arr = TODAY > pd(d.jouis) ? late * net : 0;
    return { a, base, ann, taux, L, brut, sol, net, indem, indMois, alloc, allocation, arr, arrMois: TODAY > pd(d.jouis) ? late : 0, enf: fi.enf.length, conj: fi.conj, ver: Pm ? '2026.1' : App.mod('pen2', MOD.pen2).ver };
  };

  /* ---------- Données de départ ---------- */
  MOD.pen2 = () => {
    const mk = (mat, nat, ouv, step, extra) => {
      const a = agentBy(mat); if (!a) return null;
      const f = MOD.fiche ? MOD.fiche(a).naissance : '01/01/' + a.yob;
      const [dd, mm] = f.split('/').map(Number);
      const j = nat === 'Pension d’ancienneté' ? new Date(a.yob + 60, mm, 1) : pd(extra && extra.jouis || '01/09/2026');
      const trace = [{ s: -1, who: 'système', date: ouv + ' 08:00', note: nat === 'Pension d’invalidité' ? 'Dossier ouvert sur décision de la commission de réforme' : 'Dossier ouvert automatiquement (limite d’âge atteinte dans le fichier RH)' }];
      const W = ['drh.mfp01', 'solde.dgb02', 'controle.cf01', 'ord.dgb01', 'solde.dgb02'];
      for (let i = 0; i < Math.min(step, 5); i++) trace.push({ s: i, who: W[i], date: fd(new Date(pd(ouv).getTime() + (i + 1) * 4 * 86400000)) + ' 10:' + String(10 + i * 7), note: ST[i].act });
      return Object.assign({ id: 'PEN-2026-0' + (180 + Math.floor(Math.random() * 0) + mkN++), mat, nat, ouv, jouis: fd(j), step, trace, pieces: Object.fromEntries(PIECES.map((p, i) => [p, step > 0 || i < 3])), refs: {} }, extra || {});
    };
    let mkN = 1;
    const files = [
      mk('088-0912-A', 'Pension d’ancienneté', '02/09/2026', 5),
      mk('192-1208-B', 'Pension d’ancienneté', '15/09/2026', 3),
      mk('207-4505-D', 'Pension d’ancienneté', '22/09/2026', 2),
      mk('165-5999-K', 'Pension d’ancienneté', '29/09/2026', 1),
      mk('129-6233-C', 'Pension d’ancienneté', '06/10/2026', 1),
      mk('215-7663-K', 'Pension d’ancienneté', '13/10/2026', 0),
      mk('253-7817-A', 'Pension d’ancienneté', '17/10/2026', 0),
      mk('167-3579-H', 'Pension d’ancienneté', '20/10/2026', 0),
      mk('125-2761-E', 'Pension d’invalidité', '08/09/2026', 4, { jouis: '01/09/2026' })
    ].filter(Boolean);
    files.forEach((f, i) => { f.id = 'PEN-2026-0' + (231 - i); });
    const done = files.find(f => f.step === 5); if (done) { done.refs = { simba: 'SIMBA-PEN-2026-0912', caisse: 'CRF-INS-26-04417', brevet: 'BRV-2026-0231', paidOn: '28/09/2026' }; }
    // pensionnés déjà en paiement (historique fictif)
    const NOMS = [['YAKITÉ', 'Marcel', 412000], ['NGOUANDJI', 'Hélène', 268500], ['SÉLÉMBI', 'Gaston', 351200], ['DOKO', 'Albertine', 198400], ['KOYANGBO', 'Pierre', 302700], ['ZANGA', 'Odette', 174900]];
    const pays = [];
    ['Août 2026', 'Septembre 2026', 'Octobre 2026'].forEach((per, k) => NOMS.forEach((n, i) => pays.push({ per, ref: 'SIMBA-PEN-26' + (8 + k) + '-' + String(1000 + i).slice(1), pen: 'BRV-20' + (19 + i) + '-0' + (100 + i * 37), name: n[0] + ' ' + n[1], brut: n[2], sol: Math.round(n[2] * 0.01), canal: i % 2 ? 'Mobile money' : 'Banque (SYSTAC)', date: ['27/08/2026', '26/09/2026', '27/10/2026'][k], st: k === 2 ? 'Transmis · paiement le 27/10' : 'Payé' })));
    if (done) { const c = MOD.penCalc(done, P0()); pays.push({ per: 'Octobre 2026', ref: 'SIMBA-PEN-2610-901', pen: done.refs.brevet, name: (agentBy(done.mat) || {}).nom + ' ' + (agentBy(done.mat) || {}).prenom, brut: c.brut, sol: c.sol, canal: (agentBy(done.mat) || {}).canal, date: '27/10/2026', st: 'Transmis · paiement le 27/10', mat: done.mat }); }
    const indem = [{ id: 'IND-2026-031', type: 'Capital décès', benef: 'Ayants droit de feu MBAÏKOUA Jean-Paul (102-0311-D)', base: 410 * 250, mois: 12, step: 2, ouv: '05/10/2026' }];
    return { ver: '2026.1', p: P0(), hist: [{ v: '2026.1', date: '01/01/2026', who: 'Paramétrage initial', t: 'Reprise des textes en vigueur [références à confirmer]' }], files, pays, indem };
  };
  const PE = () => {
    const pe = App.mod('pen2', MOD.pen2);
    // dossiers ouverts par le module Carrière (acte de retraite notifié)
    const old = App.mod('pensions', MOD.pensions).files || [];
    old.forEach(o => { if (!pe.files.some(f => f.id === o.id || f.mat === o.mat) && agentBy(o.mat)) { const a = agentBy(o.mat); pe.files.unshift({ id: o.id, mat: o.mat, nat: o.nat || 'Pension d’ancienneté', ouv: H.today(), jouis: o.date || '01/01/2027', step: 0, trace: [{ s: -1, who: 'système', date: H.now(), note: 'Dossier ouvert automatiquement après notification de l’acte de retraite' }], pieces: Object.fromEntries(PIECES.map((p, i) => [p, i < 2])), refs: {} }); } });
    return pe;
  };
  /* Dossiers visibles : bénéficiaire hors fichier, ou agent dans le périmètre du profil connecté */
  const visF = f => !!(f.ext || agentBy(f.mat));
  const view = pe => new Proxy(pe, { get: (t, k) => k === 'files' ? t.files.filter(visF) : t[k] });
  MOD.penDossiers = () => PE().files.filter(visF);
  const nameOf = f => { const a = agentBy(f.mat); return a ? a.nom + ' ' + a.prenom : f.ext ? f.ext.nom + ' ' + f.ext.prenom : f.mat; };
  const elapsed = f => f.step >= 5 && f.refs.paidOn ? days(pd(f.ouv), pd(f.refs.paidOn)) : days(pd(f.ouv), TODAY);
  const delayPill = f => { const e = elapsed(f); return f.step >= 5 ? pill('Liquidé en ' + e + ' j', e <= DELAI ? 'ok' : 'bad') : pill('J+' + e + ' / ' + DELAI, e > DELAI ? 'bad' : e > DELAI - 7 ? 'warn' : 'n'); };

  /* ---------- Écran ---------- */
  reg('pensions', {
    title: 'Indemnités, pensions et retraites', menu: 'Pensions et retraites', crumb: 'Solde et pensions · Module 11 · liquidation et paiement', tag: 'P1', rows: [12],
    render() {
      const pe = view(PE()), tab = ui('penT', 'dos');
      const enc = pe.files.filter(f => f.step < 5), late = enc.filter(f => elapsed(f) > DELAI).length;
      const paidOct = pe.pays.filter(x => x.per === 'Octobre 2026');
      const avg = (() => { const L = pe.files.filter(f => f.step >= 5); return L.length ? Math.round(L.reduce((s, f) => s + elapsed(f), 0) / L.length) : 0; })();
      const head = `<div class="kpis">${kpi('Dossiers en cours', String(enc.length), pe.files.filter(f => f.step >= 5).length + ' liquidé(s)')}${kpi('Délai de liquidation', avg ? avg + ' j' : '—', 'norme : ' + DELAI + ' jours au plus')}${kpi('Hors délai', String(late), late ? 'dossiers à accélérer' : 'aucun retard')}${kpi('Pensions d’octobre', nf(paidOct.length), F(paidOct.reduce((s, x) => s + x.brut - x.sol, 0)) + ' nets')}</div>
        ${seg('penT', [['dos', 'Liquidation des pensions'], ['ind', 'Indemnités de départ'], ['pay', 'Paiements et bulletins'], ['ret', 'Pensionnés'], ['bar', 'Barèmes et simulation']], tab, 'Rubriques')}`;
      if (tab === 'ind') return head + indemTab(pe);
      if (tab === 'ret') return head + retTab(pe);
      if (tab === 'pay') return head + payTab(pe);
      if (tab === 'bar') return head + barTab(pe);
      const f = pe.files.find(x => x.id === ui('penSel')) || enc[0] || pe.files[0];
      const fl = ui('penF', 'all');
      const list = pe.files.filter(x => fl === 'all' || (fl === 'late' && x.step < 5 && elapsed(x) > DELAI) || (fl === 'mine' && x.step < 5 && ST[x.step].req && can(ST[x.step].req[0], ST[x.step].req[1])) || (fl === 'done' && x.step >= 5));
      return head + `<div class="cols">
        <section class="card w2"><div class="row sb"><h2>Dossiers de liquidation</h2>${btn('Nouveau dossier', 'tab', { sm: true, p: true, req: [12, 2], data: { k: 'penNew', v: '1' } })}</div>${chips('penF', [['all', 'Tous'], ['mine', 'À traiter par moi'], ['late', 'Hors délai'], ['done', 'Liquidés']], fl, 'Filtre')}
          <div class="stack" style="gap:2px">${list.map(x => `<button type="button" data-a="tab" data-k="penSel" data-v="${x.id}" style="text-align:left;border:0;border-radius:8px;padding:10px;cursor:pointer;background:${x.id === f.id ? 'var(--accent-soft)' : 'transparent'};color:var(--fg)"><span class="row sb" style="flex-wrap:nowrap;gap:8px"><b>${esc(nameOf(x))}</b>${delayPill(x)}</span><span class="small muted" style="display:block">${x.id} · ${x.nat} · jouissance ${x.jouis}</span><span class="small" style="display:block;color:var(--accent)">${x.step >= 5 ? 'Pension en paiement' : 'Étape ' + (x.step + 1) + ' : ' + ST[x.step].l}</span></button>`).join('') || '<p class="muted">Aucun dossier.</p>'}</div></section>
        <div class="w3 stack" style="gap:16px">${ui('penNew', '') ? newForm(pe) : dossier(f, pe)}</div></div>`;
    }
  });

  function dossier(f, pe) {
    if (!f) return '<section class="card"><p class="muted">Aucun dossier.</p></section>';
    const c = f.calc || MOD.penCalc(f), a = c.a, st = ST[Math.min(f.step, 5)];
    const missing = PIECES.filter(p => !f.pieces[p]);
    const canAct = st.req && can(st.req[0], st.req[1]);
    const blocked = f.step === 0 && missing.length;
    const action = f.step >= 5 ? '' : `<div class="row" style="gap:8px">${blocked ? `<span class="small" style="color:var(--warn)">${missing.length} pièce(s) manquante(s) : dossier bloqué.</span>${btn('Relancer l’agent et le gestionnaire', 'pen-relance', { sm: true, req: [12, 2], data: { id: f.id } })}` : btn(st.act, 'pen-next', { p: true, req: st.req, data: { id: f.id } })}${f.step > 0 && f.step < 4 ? btn('Renvoyer à l’étape précédente', 'pen-back', { sm: true, req: st.req, data: { id: f.id } }) : ''}</div>${!canAct ? `<span class="lock">Étape réservée au profil « ${st.who} ».</span>` : ''}`;
    const rows = c.L.map(x => `<tr><td class="mono small">${x.c}</td><td>${esc(x.l)}<div class="small muted">${esc(x.f)}</div></td><td class="num mono small">${x.b == null ? '' : nf(Math.round(x.b))}</td><td class="small">${esc(x.t)}</td><td class="num mono">${nf(x.m)}</td></tr>`).join('');
    return `<section class="card"><div class="row sb"><div><h2 style="margin:0">${esc(nameOf(f))}</h2><span class="small muted">${f.id} · ${f.mat} · ${f.nat}</span></div>${delayPill(f)}</div>
        ${steps(ST.map(s => s.l), f.step >= 5 ? 6 : f.step)}${action}</section>
      <div class="cols"><section class="card"><h2>Données RH reprises</h2><dl class="dl">${[['Né(e) le', MOD.fiche && agentBy(f.mat) ? MOD.fiche(a).naissance : (a.naiss || a.yob)], ['Ministère', a.min], ['Entrée en service', a.entree], ['Date de jouissance', f.jouis], ['Grade · indice de fin de carrière', a.grade + ' · ' + a.indice], ['Annuités liquidables', c.ann + ' ans'], ['Enfants', String(c.enf)], ['Conjoint', c.conj ? c.conj.nom : 'aucun'], ['Paiement', a.canal]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(String(v))}</dd></div>`).join('')}</dl><span class="small muted">${f.revOf ? 'Ayant droit de ' + esc(f.revOf.name) + ' (brevet ' + f.revOf.pen + ').' : f.ext ? 'Saisie manuelle : bénéficiaire hors du fichier RH.' : 'Source : fiche électronique de l’agent (aucune ressaisie).'}</span></section>
        <section class="card"><h2>Pièces du dossier</h2>${PIECES.map(p => `<div class="row sb" style="border-bottom:1px solid var(--line2);padding:7px 0;flex-wrap:nowrap;gap:8px"><span>${p}</span>${f.pieces[p] ? (typeof f.pieces[p] === 'string' && MOD.uplFile && MOD.uplFile(f.pieces[p]) ? `<span class="row" style="gap:6px;flex-wrap:nowrap">${pill('Téléversée', 'ok')}${btn('Aperçu', 'upl-view', { sm: true, data: { id: f.pieces[p] } })}</span>` : pill('Reçue', 'ok')) : (f.step === 0 && can(12, 2) ? `<span class="row" style="gap:6px;flex-wrap:nowrap">${MOD.uplCtx ? btn('Téléverser', 'upl-pick', { sm: true, data: { c: 'pension', id: f.id, p } }) : ''}${btn('Marquer reçue', 'pen-piece', { sm: true, data: { id: f.id, p } })}</span>` : pill('Manquante', 'bad'))}</div>`).join('')}</section></div>
      <section class="card"><div class="row sb"><h2>Calcul automatisé</h2><span class="small muted">Barème version ${c.ver}${f.calc ? ' · figé à la validation' : ' · provisoire'}</span></div>
        ${c.allocation ? note('Moins de ' + App.mod('pen2', MOD.pen2).p.minAnn + ' annuités : allocation unique de ' + F(c.alloc) + ' au lieu d’une pension.', 'warn') : `<div class="tbox"><table><thead><tr><th>Code</th><th>Élément et règle appliquée</th><th class="num">Base</th><th>Taux</th><th class="num">Montant (FCFA)</th></tr></thead><tbody>${rows}
          <tr><td></td><td><b>Pension mensuelle brute</b></td><td></td><td></td><td class="num mono"><b>${nf(c.brut)}</b></td></tr>
          <tr><td class="mono small">R1</td><td>Retenue de solidarité</td><td></td><td class="small">${App.mod('pen2', MOD.pen2).p.solid} %</td><td class="num mono">− ${nf(c.sol)}</td></tr>
          <tr><td></td><td><b>Pension mensuelle nette</b></td><td></td><td></td><td class="num mono"><b>${nf(c.net)}</b></td></tr></tbody></table></div>`}
        <div class="kpis">${kpi('Pension nette mensuelle', F(c.net))}${kpi('Indemnité de départ', c.indem ? F(c.indem) : '—', c.indem ? c.indMois + ' mois de traitement' : 'non applicable')}${kpi('Rappel d’arrérages', c.arr ? F(c.arr) : '—', c.arrMois ? c.arrMois + ' mois depuis la jouissance' : 'aucun')}</div>
        ${f.step >= 5 ? `<div class="row" style="gap:8px">${btn('Bulletin de pension (octobre)', 'pen-print', { sm: true, p: true, data: { id: f.id, k: 'bul' } })}${btn('Brevet de pension', 'pen-print', { sm: true, data: { id: f.id, k: 'brv' } })}</div>` : ''}</section>
      ${f.refs.simba ? `<section class="card"><h2>Paiement et références</h2><dl class="dl">${[['Ordre SIM-BA', f.refs.simba], ['Inscription caisse de retraite', f.refs.caisse], ['Brevet de pension', f.refs.brevet], ['Transmis le', f.refs.paidOn], ['Premier versement', '27/' + String(TODAY.getMonth() + 1).padStart(2, '0') + '/2026 · ' + F(c.net + c.arr + c.indem) + ' (pension, arrérages et indemnité)']].map(([k, v]) => `<div><dt>${k}</dt><dd class="mono">${esc(v)}</dd></div>`).join('')}</dl></section>` : ''}
      <section class="card"><h2>Traçabilité</h2>${timeline(f.trace.slice().reverse().map(t => ({ l: t.s < 0 ? 'Ouverture du dossier' : ST[t.s].l + (t.back ? ' : renvoyé pour correction' : ' : validé'), d: t.date + ' · ' + t.who + ' · ' + t.note, done: true })))}</section>
      ${printArea(f, c)}`;
  }

  /* Documents imprimables (bulletin, brevet) */
  function printArea(f, c) {
    const k = ui('penPrint', '');
    if (!k || ui('penPrintId') !== f.id) return '';
    const a = c.a, logo = H.LOGO ? H.LOGO(54, 'light') : '';
    const head = `<div style="display:flex;gap:14px;align-items:center;border-bottom:2px solid #13243A;padding-bottom:12px">${logo}<div><b style="font-size:18px">République centrafricaine</b><div class="small">Unité – Dignité – Travail · Ministère des Finances et du Budget · SIGRHE</div></div></div>`;
    const body = k === 'bul' ? `<h2 style="margin:16px 0 4px">Bulletin de pension · octobre 2026</h2><div class="small">N° de pension ${f.refs.brevet} · ${f.nat}</div>
        <dl class="dl" style="margin:12px 0">${[['Pensionné(e)', a.nom + ' ' + a.prenom], ['Matricule d’origine', a.mat], ['Jouissance', f.jouis], ['Mode de paiement', a.canal]].map(([x, y]) => `<div><dt>${x}</dt><dd>${esc(y)}</dd></div>`).join('')}</dl>
        <table style="width:100%;border-collapse:collapse"><tbody>${[['Pension principale et majorations', c.brut], ['Retenue de solidarité', -c.sol], ['Net à payer', c.net]].map(r => `<tr><td style="border:1px solid #DDE3EA;padding:6px 8px">${r[0]}</td><td style="border:1px solid #DDE3EA;padding:6px 8px;text-align:right" class="mono">${r[1] < 0 ? '− ' + nf(-r[1]) : nf(r[1])}</td></tr>`).join('')}</tbody></table>
        <p class="small">Référence de paiement SIM-BA : ${f.refs.simba} · Inscription caisse de retraite : ${f.refs.caisse}</p>`
      : `<h2 style="margin:16px 0 4px">Brevet de pension n° ${f.refs.brevet}</h2><p>Une ${f.nat.toLowerCase()} est concédée à <b>${esc(a.nom + ' ' + a.prenom)}</b>, matricule ${a.mat}, ${esc(a.grade)}, au titre de ${c.ann} annuités de services, sur la base de l’indice ${a.indice}.</p>
        <p>Montant mensuel brut : <b>${F(c.brut)}</b>, avec jouissance à compter du ${f.jouis}. Indemnité de départ : ${c.indem ? F(c.indem) : 'non applicable'}.</p>
        <p class="small">Liquidation visée par le Contrôle financier et ordonnancée par l’ordonnateur ; inscription à la caisse de retraite ${f.refs.caisse}. Document signé électroniquement et archivé dans la GED.</p>`;
    return `<section class="card print-target" id="pen-print-area"><div class="row sb"><b>Aperçu avant impression</b><span class="row" style="gap:6px">${btn('Imprimer', 'pen-doprint', { sm: true, p: true })}${btn('Fermer', 'tab', { sm: true, data: { k: 'penPrint', v: '' } })}</span></div><div style="background:#fff;color:#14202E;border:1px solid var(--line);border-radius:8px;padding:24px">${head}${body}</div></section>`;
  }

  function indemTab(pe) {
    const fromDos = pe.files.map(f => ({ f, c: f.calc || MOD.penCalc(f) })).filter(x => x.c.indem || x.c.alloc);
    return `<section class="card"><h2>Indemnités de départ et allocations</h2><p class="muted" style="margin:0">Calculées automatiquement à partir des données de carrière ; payées une seule fois avec la première pension, après visa et ordonnancement.</p>
      <div class="tbox"><table><thead><tr><th>Dossier</th><th>Bénéficiaire</th><th>Nature</th><th>Règle</th><th class="num">Montant (FCFA)</th><th>État</th></tr></thead><tbody>
      ${fromDos.map(({ f, c }) => `<tr><td class="mono small">${f.id}</td><td><b>${esc(nameOf(f))}</b><div class="small muted">${(c.a.entree)} → ${f.jouis.slice(-4)} · ${c.ann} ans</div></td><td>${c.alloc ? 'Allocation unique' : 'Indemnité de départ à la retraite'}</td><td class="small">${c.alloc ? '1 mois de traitement par annuité' : c.indMois + ' mois × ' + nf(c.base) + ' (1 mois par 5 ans, plafond ' + App.mod('pen2', MOD.pen2).p.indPlaf + ')'}</td><td class="num mono"><b>${nf(c.indem || c.alloc)}</b></td><td>${f.step >= 5 ? pill('Payée', 'ok') : pill(ST[f.step].l, 'n')}</td></tr>`).join('')}
      ${pe.indem.map(x => `<tr><td class="mono small">${x.id}</td><td><b>${esc(x.benef)}</b></td><td>${x.type}</td><td class="small">${x.mois} mois × ${nf(x.base)}</td><td class="num mono"><b>${nf(x.mois * x.base)}</b></td><td>${x.step >= 5 ? pill('Payé', 'ok') : `${pill(ST[x.step].l, 'n')} ${ST[x.step].req ? btn('Valider', 'ind-next', { sm: true, req: ST[x.step].req, data: { id: x.id } }) : ''}`}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  }

  function payTab(pe) {
    const PERS = [...new Set(pe.pays.map(x => x.per))], per = ui('penPer', 'Octobre 2026'), L = pe.pays.filter(x => x.per === per);
    return runCard(pe) + `<section class="card"><div class="row sb"><h2>Paiements des pensions</h2>${chips('penPer', PERS.map(p => [p, p.split(' ')[0]]), per, 'Période')}</div>
      <div class="kpis">${kpi('Pensionnés', String(L.length))}${kpi('Brut', F(L.reduce((s, x) => s + x.brut, 0)))}${kpi('Retenues', F(L.reduce((s, x) => s + x.sol, 0)))}${kpi('Net versé', F(L.reduce((s, x) => s + x.brut - x.sol, 0)))}</div>
      <div class="tbox"><table><thead><tr><th>Pensionné(e)</th><th>N° de pension</th><th class="num">Brut</th><th class="num">Retenue</th><th class="num">Net</th><th>Canal</th><th>Référence SIM-BA</th><th>Statut</th></tr></thead><tbody>
      ${L.map(x => `<tr><td><b>${esc(x.name)}</b></td><td class="mono small">${x.pen}</td><td class="num mono">${nf(x.brut)}</td><td class="num mono">${nf(x.sol)}</td><td class="num mono"><b>${nf(x.brut - x.sol)}</b></td><td class="small">${esc(x.canal)}</td><td class="mono small">${x.ref}</td><td>${pill(x.st, x.st === 'Payé' ? 'ok' : 'info')}<div class="small muted">${x.date}${x.cred ? ' · ' + x.cred : ''}</div></td></tr>`).join('')}</tbody></table></div>
      ${note('Traçabilité : chaque versement porte la référence de l’ordre SIM-BA, le canal (SYSTAC ou mobile money) et le retour de paiement. Les bulletins de pension sont publiés sur l’espace de chaque pensionné.', 'info')}</section>`;
  }

  function barTab(pe) {
    const ed = can(12, 3);
    const A = App.visibleAgents().filter(a => a.statut !== 'Retraité');
    const m = ui('penSim', (A.find(a => 2026 - a.yob >= 50) || A[0]).mat), a = agentBy(m) || A[0];
    const fd0 = MOD.fiche ? MOD.fiche(a).naissance : '01/01/' + a.yob, mm = +fd0.split('/')[1];
    const sim = MOD.penCalc({ mat: a.mat, nat: 'Pension d’ancienneté', jouis: fd(new Date(a.yob + 60, mm, 1)) });
    return `<div class="cols"><section class="card w3"><div class="row sb"><h2>Barèmes et règles · version ${pe.ver}</h2>${ed ? '' : pill('Lecture seule pour votre profil', 'n')}</div>
        <div class="tbox"><table><thead><tr><th>Règle</th><th style="min-width:120px">Valeur</th><th>Unité</th><th>Application</th></tr></thead><tbody>${DEF.map(d => `<tr><td><b>${d[1]}</b></td><td><input id="pb-${d[0]}" aria-label="${esc(d[1])}" type="number" data-bind="pb_${d[0]}" value="${esc(ui('pb_' + d[0], pe.p[d[0]]))}"${ed ? '' : ' disabled'} style="height:34px;width:110px;border:1px solid var(--field);border-radius:6px;padding:0 8px;background:var(--surface)"></td><td class="small muted">${d[3]}</td><td class="small muted">${d[4]}</td></tr>`).join('')}</tbody></table></div>
        <div class="row" style="gap:8px">${btn('Enregistrer une nouvelle version', 'pb-save', { p: true, req: [12, 3] })}<span class="small muted">Traitement de base : indice × valeur du point de la paie (${point()} FCFA). Valeurs de démonstration, à remplacer par les textes en vigueur.</span></div>
        ${timeline(pe.hist.map(h => ({ l: 'Version ' + h.v + ' · ' + h.t, d: h.date + ' · ' + h.who, done: true })))}</section>
      <section class="card w2"><h2>Simulation de départ à la retraite</h2>${H.select('pen-sim', 'Agent', 'penSim', a.mat, A.slice(0, 250).map(x => [x.mat, x.nom + ' ' + x.prenom + ' · ' + (2026 - x.yob) + ' ans']))}
        <dl class="dl">${[['Départ à 60 ans', fd(new Date(a.yob + 60, mm, 1))], ['Annuités à la date de départ', sim.ann + ' ans'], ['Taux de liquidation', nf(sim.taux) + ' %'], ['Pension nette estimée', F(sim.net)], ['Indemnité de départ', sim.indem ? F(sim.indem) : '—'], ['Taux de remplacement', a.net ? Math.round(sim.net / a.net * 100) + ' % du net actuel' : '—']].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <span class="small muted">Estimation au barème en vigueur, à indice constant. Le même calcul est proposé à l’agent dans son espace.</span></section></div>`;
  }

  /* ================= Registre des pensionnés ================= */
  const CVMAX = 365; // validité du certificat de vie, en jours
  const cvOk = r => r.cv && days(pd(r.cv), TODAY) <= CVMAX;
  function ensureRet(pe) {
    if (!pe.ret) {
      const CV = ['15/03/2026', '02/06/2026', '20/01/2026', '10/07/2026', '05/02/2026', '12/09/2025'];
      const seen = {};
      pe.ret = [];
      pe.pays.filter(x => !x.mat).forEach(x => { if (seen[x.pen]) return; seen[x.pen] = 1; const i = pe.ret.length; pe.ret.push({ pen: x.pen, name: x.name, nat: i === 3 ? 'Pension de réversion' : 'Pension d’ancienneté', brut: x.brut, canal: x.canal, compte: x.canal === 'Mobile money' ? '+236 72 ' + (40 + i) + ' 18 ' + (60 + i) : 'CF' + (20100 + i * 7) + ' 0001' + (4400 + i * 3), cv: CV[i] || '01/03/2026', statut: 'En paiement', jouis: '01/0' + (1 + i) + '/20' + (19 + i), ministere: ['Éducation nationale', 'Santé et Population', 'Finances et Budget', 'Justice', 'Intérieur', 'Agriculture'][i] || '—', hist: [{ date: '01/0' + (1 + i) + '/20' + (19 + i), t: 'Inscription au grand livre des pensions' }] }); });
    }
    pe.files.filter(f => f.step >= 5 && f.nat !== '—').forEach(f => {
      if (pe.ret.some(r => r.dossier === f.id)) return;
      const c = f.calc || MOD.penCalc(f), a = c.a || {};
      pe.ret.unshift({ pen: f.refs.brevet || ('BRV-2026-0' + f.id.slice(-3)), name: nameOf(f), mat: f.mat, dossier: f.id, nat: f.nat, brut: c.brut, canal: a.canal || 'Banque (SYSTAC)', compte: a.canal === 'Mobile money' ? (MOD.payInfo && agentBy(f.mat) ? MOD.payInfo(a).wallet : '+236 75 00 00 00') : (MOD.payInfo && agentBy(f.mat) ? MOD.payInfo(a).rib : 'CF00000 00000000000'), cv: f.refs.paidOn || H.today(), statut: 'En paiement', jouis: f.jouis, ministere: a.min || '—', conj: c.conj ? c.conj.nom : (f.ext && f.ext.conj) || '', hist: [{ date: f.refs.paidOn || H.today(), t: 'Pension concédée (brevet ' + (f.refs.brevet || '') + ') · dossier ' + f.id }] });
    });
    return pe.ret;
  }
  const retNet = r => r.brut - Math.round(r.brut * App.mod('pen2', MOD.pen2).p.solid / 100);
  function retTab(pe) {
    const R = ensureRet(pe), fl = ui('rtF', 'all');
    const L = R.filter(r => fl === 'all' || (fl === 'pay' && r.statut === 'En paiement') || (fl === 'cv' && r.statut === 'En paiement' && !cvOk(r)) || (fl === 'sus' && r.statut === 'Suspendu') || (fl === 'dec' && r.statut === 'Décédé'));
    const r = R.find(x => x.pen === ui('rtSel')) || L[0] || R[0];
    const active = R.filter(x => x.statut === 'En paiement');
    const head = `<div class="kpis">${kpi('Pensionnés inscrits', String(R.length), active.length + ' en paiement')}${kpi('Certificats de vie à renouveler', String(active.filter(x => !cvOk(x)).length), 'validité ' + CVMAX + ' jours')}${kpi('Suspendus', String(R.filter(x => x.statut === 'Suspendu').length))}${kpi('Masse mensuelle nette', F(active.filter(cvOk).reduce((s, x) => s + retNet(x), 0)))}</div>`;
    if (!r) return head + '<section class="card"><p class="muted">Aucun pensionné.</p></section>';
    const P = pe.pays.filter(x => x.pen === r.pen);
    const ed = can(12, 2);
    return head + `<div class="cols"><section class="card w2"><h2>Registre des pensionnés</h2>${chips('rtF', [['all', 'Tous'], ['pay', 'En paiement'], ['cv', 'Certificat de vie expiré'], ['sus', 'Suspendus'], ['dec', 'Décédés']], fl, 'Filtre')}
        <div class="stack" style="gap:2px">${L.map(x => `<button type="button" data-a="tab" data-k="rtSel" data-v="${x.pen}" style="text-align:left;border:0;border-radius:8px;padding:10px;cursor:pointer;background:${x.pen === r.pen ? 'var(--accent-soft)' : 'transparent'};color:var(--fg)"><span class="row sb" style="flex-wrap:nowrap;gap:8px"><b>${esc(x.name)}</b>${pill(x.statut, x.statut === 'En paiement' ? (cvOk(x) ? 'ok' : 'warn') : x.statut === 'Suspendu' ? 'warn' : 'n')}</span><span class="small muted" style="display:block">${x.pen} · ${x.nat} · ${F(retNet(x))} / mois${x.statut === 'En paiement' && !cvOk(x) ? ' · certificat de vie expiré' : ''}</span></button>`).join('') || '<p class="muted">Aucun pensionné pour ce filtre.</p>'}</div></section>
      <div class="w3 stack" style="gap:16px">
        <section class="card"><div class="row sb"><div><h2 style="margin:0">${esc(r.name)}</h2><span class="small muted">Pension n° ${r.pen} · ${r.nat}${r.mat && !r.mat.startsWith('EXT') ? ' · ancien matricule ' + r.mat : ''}</span></div>${pill(r.statut, r.statut === 'En paiement' ? 'ok' : 'warn')}</div>
          <dl class="dl">${[['Jouissance', r.jouis], ['Ministère d’origine', r.ministere], ['Pension brute', F(r.brut)], ['Pension nette', F(retNet(r))], ['Conjoint', r.conj || '—']].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
        <section class="card"><h2>Mode de paiement</h2><div class="fgrid">${H.select('rt-c', 'Canal', 'rtCanal_' + r.pen, ui('rtCanal_' + r.pen, r.canal), ['Banque (SYSTAC)', 'Mobile money'])}${H.input('rt-k', ui('rtCanal_' + r.pen, r.canal) === 'Mobile money' ? 'Numéro du wallet' : 'Numéro de compte (RIB)', 'rtCpt_' + r.pen, ui('rtCpt_' + r.pen, r.compte))}</div>
          <div class="row">${btn('Enregistrer le mode de paiement', 'rt-pay', { sm: true, req: [12, 2], data: { pen: r.pen } })}<span class="small muted">Pris en compte à la prochaine paie des pensions.</span></div></section>
        <section class="card"><div class="row sb"><h2>Certificat de vie</h2>${r.statut === 'Décédé' ? '' : cvOk(r) ? pill('Valide jusqu’au ' + fd(new Date(pd(r.cv).getTime() + CVMAX * 86400000)), 'ok') : pill('Expiré : paiement bloqué', 'bad')}</div>
          <p class="muted" style="margin:0">Dernier certificat : ${r.cv || '—'}. Sans certificat valide, la pension est exclue de la paie mensuelle.</p>
          ${r.statut !== 'Décédé' && ed ? `<div class="row" style="gap:8px">${btn('Enregistrer un certificat de vie (reçu ce jour)', 'rt-cv', { sm: true, p: !cvOk(r), data: { pen: r.pen } })}${MOD.dropzone ? btn('Téléverser le certificat', 'upl-pick', { sm: true, data: { c: 'retcv', pen: r.pen } }) : ''}</div>` : ''}</section>
        ${r.statut !== 'Décédé' && ed ? `<section class="card"><h2>Événements</h2><div class="row" style="gap:8px">${r.statut === 'Suspendu' ? btn('Rétablir le paiement', 'rt-sus', { sm: true, req: [12, 2], data: { pen: r.pen, v: 'En paiement' } }) : btn('Suspendre le paiement', 'rt-sus', { sm: true, danger: true, req: [12, 2], data: { pen: r.pen, v: 'Suspendu' } })}</div>
          <div class="fgrid" style="margin-top:6px">${H.input('rt-dd', 'Date du décès', 'rtDec_' + r.pen, ui('rtDec_' + r.pen, '10/10/2026'))}${H.input('rt-cj', 'Conjoint survivant (ayant droit)', 'rtCj_' + r.pen, ui('rtCj_' + r.pen, r.conj || ''))}</div>
          <div class="row">${btn('Déclarer le décès et ouvrir la réversion', 'rt-dec', { sm: true, danger: true, req: [12, 2], data: { pen: r.pen } })}</div></section>` : ''}
        <section class="card"><h2>Historique des paiements</h2><div class="tbox"><table><thead><tr><th>Période</th><th class="num">Brut</th><th class="num">Net</th><th>Canal</th><th>Référence</th><th>Statut</th></tr></thead><tbody>${P.map(x => `<tr><td>${x.per}</td><td class="num mono">${nf(x.brut)}</td><td class="num mono"><b>${nf(x.brut - x.sol)}</b></td><td class="small">${esc(x.canal)}</td><td class="mono small">${x.ref}</td><td>${pill(x.st, x.st === 'Payé' ? 'ok' : 'info')}<div class="small muted">${x.date}</div></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucun paiement.</td></tr>'}</tbody></table></div>
          ${timeline((r.hist || []).slice().reverse().map(h => ({ l: h.t, d: h.date, done: true })))}</section>
      </div></div>`;
  }

  /* ================= Création d'un dossier de retraite ================= */
  const MINS = () => DATA.E.filter(e => e[4] === 'min' || e[4] === 'etat').map(e => e[3]);
  function draft(pe) {
    const src = ui('pnSrc', 'agent'), nat = ui('pnNat', 'Pension d’ancienneté');
    if (nat === 'Pension de réversion') {
      const R = ensureRet(pe).filter(r => r.statut !== 'Décédé'), r = R.find(x => x.pen === ui('pnRev')) || R[0];
      if (!r) return null;
      return { mat: 'EXT-REV', nat, jouis: ui('pnJouis', '01/11/2026'), revOf: { pen: r.pen, brut: r.brut, name: r.name }, ext: { nom: (ui('pnNom', 'NGUÉRÉ') || '').toUpperCase(), prenom: ui('pnPre', 'Joséphine'), indice: 0, entree: 2026, yob: +String(ui('pnNais', '12/04/1958')).slice(-4) || 1958, naiss: ui('pnNais', '12/04/1958'), min: r.ministere, grade: 'Ayant droit de ' + r.name, canal: ui('pnCanal', 'Mobile money'), enfants: 0 } };
    }
    if (src === 'agent') {
      const A = App.visibleAgents().filter(a => a.statut !== 'Retraité' && !pe.files.some(f => f.mat === a.mat));
      const a = A.find(x => x.mat === ui('pnMat')) || A.find(x => 2026 - x.yob >= 59) || A[0];
      if (!a) return null;
      const nais = MOD.fiche ? MOD.fiche(a).naissance : '01/01/' + a.yob, mm = +nais.split('/')[1];
      return { mat: a.mat, nat, jouis: nat === 'Pension d’ancienneté' ? fd(new Date(a.yob + 60, mm, 1)) : ui('pnJouis', '01/11/2026'), A };
    }
    const nais = ui('pnNais', '05/03/1966'), yob = +String(nais).slice(-4) || 1966, mm = +String(nais).split('/')[1] || 1;
    const ext = { nom: (ui('pnNom', 'YAKOMA') || '').toUpperCase(), prenom: ui('pnPre', 'Bernard'), naiss: nais, yob, entree: +ui('pnEnt', '1990') || 1990, indice: +ui('pnInd', '980') || 980, min: ui('pnMin', MINS()[0]), grade: ui('pnGrade', 'Attaché d’administration'), canal: ui('pnCanal', 'Banque (SYSTAC)'), enfants: +ui('pnEnf', '3') || 0, sx: 'M' };
    return { mat: 'EXT', nat, jouis: nat === 'Pension d’ancienneté' ? fd(new Date(yob + 60, mm, 1)) : ui('pnJouis', '01/11/2026'), ext };
  }
  function newForm(pe) {
    const d = draft(pe), src = ui('pnSrc', 'agent'), nat = ui('pnNat', 'Pension d’ancienneté');
    const c = d ? MOD.penCalc(d) : null;
    const R = ensureRet(pe).filter(r => r.statut !== 'Décédé');
    return `<section class="card" style="border:2px solid var(--accent)"><div class="row sb"><h2>Nouveau dossier de retraite</h2>${btn('Annuler', 'tab', { sm: true, data: { k: 'penNew', v: '' } })}</div>
      <div class="fgrid">${H.select('pn-nat', 'Nature', 'pnNat', nat, ['Pension d’ancienneté', 'Pension d’invalidité', 'Pension de réversion'])}
      ${nat === 'Pension de réversion' ? H.select('pn-rev', 'Pensionné décédé', 'pnRev', d && d.revOf ? d.revOf.pen : '', R.map(r => [r.pen, r.name + ' · ' + r.pen])) : H.select('pn-src', 'Bénéficiaire', 'pnSrc', src, [['agent', 'Agent du fichier RH'], ['ext', 'Ancien agent hors fichier (saisie)']])}</div>
      ${nat !== 'Pension de réversion' && src === 'agent' && d ? `<div class="fgrid">${H.select('pn-mat', 'Agent', 'pnMat', d.mat, d.A.slice(0, 300).map(a => [a.mat, a.nom + ' ' + a.prenom + ' · ' + (2026 - a.yob) + ' ans · ' + a.mat]))}</div>` : ''}
      ${nat === 'Pension de réversion' || src === 'ext' ? `<div class="fgrid">${H.input('pn-nom', 'Nom', 'pnNom', ui('pnNom', nat === 'Pension de réversion' ? 'NGUÉRÉ' : 'YAKOMA'))}${H.input('pn-pre', 'Prénom', 'pnPre', ui('pnPre', nat === 'Pension de réversion' ? 'Joséphine' : 'Bernard'))}${H.input('pn-nais', 'Date de naissance (jj/mm/aaaa)', 'pnNais', ui('pnNais', nat === 'Pension de réversion' ? '12/04/1958' : '05/03/1966'))}
        ${nat !== 'Pension de réversion' ? H.input('pn-ent', 'Année d’entrée en service', 'pnEnt', ui('pnEnt', '1990')) + H.input('pn-ind', 'Indice de fin de carrière', 'pnInd', ui('pnInd', '980')) + H.input('pn-gr', 'Grade', 'pnGrade', ui('pnGrade', 'Attaché d’administration')) + H.select('pn-min', 'Ministère d’origine', 'pnMin', ui('pnMin', MINS()[0]), MINS()) + H.input('pn-enf', 'Enfants élevés', 'pnEnf', ui('pnEnf', '3')) : ''}
        ${H.select('pn-can', 'Paiement', 'pnCanal', ui('pnCanal', nat === 'Pension de réversion' ? 'Mobile money' : 'Banque (SYSTAC)'), ['Banque (SYSTAC)', 'Mobile money'])}</div>` : ''}
      ${nat !== 'Pension d’ancienneté' ? `<div class="fgrid">${H.input('pn-j', 'Date de jouissance', 'pnJouis', ui('pnJouis', '01/11/2026'))}</div>` : ''}
      ${c ? `<h2>Simulation de la pension</h2><div class="kpis">${kpi('Date de jouissance', d.jouis)}${nat === 'Pension de réversion' ? kpi('Pension du défunt', F(d.revOf.brut)) : kpi('Annuités · taux', c.ann + ' ans · ' + nf(c.taux) + ' %')}${kpi('Pension nette mensuelle', '<span style="color:var(--accent)">' + F(c.net) + '</span>', 'brute ' + F(c.brut))}${kpi('Indemnité de départ', c.indem ? F(c.indem) : (c.alloc ? 'Allocation ' + F(c.alloc) : '—'))}</div>
        ${c.allocation ? note('Moins de ' + pe.p.minAnn + ' annuités : une allocation unique remplace la pension.', 'warn') : ''}` : note('Aucun bénéficiaire disponible.', 'warn')}
      <div class="row">${c ? btn('Créer le dossier et lancer le circuit', 'pen-create', { p: true, req: [12, 2] }) : ''}<span class="small muted">Le dossier démarre à l’étape « Constitution du dossier » ; le délai de ${DELAI} jours court à partir d’aujourd’hui.</span></div></section>`;
  }

  /* ================= Paie mensuelle des pensions (jusqu'à la perception) ================= */
  const RST = [
    { l: 'Calcul de la paie des pensions', req: [12, 2], act: 'Calculer la paie des pensions', who: 'Service des pensions' },
    { l: 'Visa du Contrôle financier', req: [4, 3], act: 'Viser la paie des pensions', who: 'Contrôleur financier' },
    { l: 'Ordonnancement et transmission', req: [11, 3], act: 'Ordonnancer et transmettre (SIM-BA, SYSTAC, mobile)', who: 'Ordonnateur' },
    { l: 'Perception par les pensionnés', req: [12, 2], act: 'Enregistrer les retours de paiement', who: 'Service des pensions' }
  ];
  function runCard(pe) {
    pe.run = pe.run || { per: 'Novembre 2026', step: 0 };
    const run = pe.run, R = ensureRet(pe);
    if (run.step >= 4) return `<section class="card"><div class="row sb"><h2>Paie des pensions · ${run.per}</h2>${pill('Payée', 'ok')}</div>${steps(RST.map(s => s.l), 4)}${note(run.lines.length + ' pensions perçues pour ' + F(run.lines.reduce((s, x) => s + x.brut - x.sol, 0)) + ' nets. SMS de confirmation envoyés aux pensionnés.', 'ok')}<div class="row">${btn('Préparer la paie suivante', 'run-new', { sm: true, req: [12, 2] })}</div></section>`;
    const elig = R.filter(r => r.statut === 'En paiement' && cvOk(r)), excl = R.filter(r => !(r.statut === 'En paiement' && cvOk(r)));
    const L = run.lines || elig.map(r => ({ pen: r.pen, name: r.name, brut: r.brut, sol: Math.round(r.brut * pe.p.solid / 100), canal: r.canal }));
    const st = RST[run.step];
    return `<section class="card"><div class="row sb"><h2>Paie des pensions · ${run.per}</h2>${pill('Étape ' + (run.step + 1) + ' / 4', 'info')}</div>${steps(RST.map(s => s.l), run.step)}
      <div class="kpis">${kpi('Pensions à payer', String(L.length))}${kpi('Net total', F(L.reduce((s, x) => s + x.brut - x.sol, 0)))}${kpi('Par banque', F(L.filter(x => x.canal !== 'Mobile money').reduce((s, x) => s + x.brut - x.sol, 0)))}${kpi('Par mobile money', F(L.filter(x => x.canal === 'Mobile money').reduce((s, x) => s + x.brut - x.sol, 0)))}</div>
      ${!run.lines && excl.length ? note('<b>Exclus de la paie :</b> ' + excl.map(r => esc(r.name) + ' (' + (r.statut !== 'En paiement' ? r.statut.toLowerCase() : 'certificat de vie expiré') + ')').join(', ') + '.', 'warn') : ''}
      <div class="row" style="gap:8px">${btn(st.act, 'run-next', { p: true, req: st.req })}${!can(st.req[0], st.req[1]) ? `<span class="lock">Étape réservée au profil « ${st.who} ».</span>` : ''}</div></section>`;
  }

  /* ---------- Actions ---------- */
  const fileOf = id => PE().files.find(f => f.id === id);
  on('pen-piece', d => { const f = fileOf(d.id); f.pieces[d.p] = true; log('Pièce de pension reçue', f.id + ' · ' + f.mat + ' · ' + d.p); });
  on('pen-relance', d => { const f = fileOf(d.id); const miss = PIECES.filter(p => !f.pieces[p]); log('Pièces de pension manquantes', f.id + ' · ' + f.mat + ' · ' + miss.join(', ')); toast('Relance envoyée à l’agent (SMS) et au gestionnaire RH.'); });
  on('pen-next', d => {
    const f = fileOf(d.id), s = f.step, a = agentBy(f.mat);
    if (s === 1) f.calc = MOD.penCalc(f);
    f.trace.push({ s, who: S().user.login, date: H.now(), note: ST[s].act });
    f.step++;
    if (f.step === 5) {
      const c = f.calc || MOD.penCalc(f), n = String(232 + PE().pays.length).padStart(4, '0');
      f.refs = { simba: 'SIMBA-PEN-2026-' + n, caisse: 'CRF-INS-26-0' + (4400 + PE().files.indexOf(f) * 7), brevet: 'BRV-2026-0' + f.id.slice(-3), paidOn: H.today() };
      if (a) { a.statut = 'Retraité'; a.hist = a.hist || []; a.hist.unshift({ date: H.today(), t: 'Pension liquidée : ' + F(c.net) + ' nets par mois', ref: f.id }); }
      PE().pays.push({ per: 'Octobre 2026', ref: f.refs.simba, pen: f.refs.brevet, name: nameOf(f), brut: c.brut + c.arr + c.indem + c.sol * 0, sol: c.sol, canal: (a || f.ext || {}).canal || '', date: '27/10/2026', st: 'Transmis · paiement le 27/10', mat: f.mat, first: true });
      if (MOD.gedAdd) MOD.gedAdd(App.mod('ged', MOD.ged), 'actes', 'Brevet de pension ' + f.refs.brevet + ' · ' + nameOf(f), 'Signé', 'Liquidation ' + f.id, S().user.login);
      log('Pension · Mise en paiement', f.id + ' · ' + f.mat + ' · ' + nameOf(f) + ' · SIM-BA ' + f.refs.simba + ' · ' + F(c.net) + ' / mois');
      toast('Pension transmise à SIM-BA et à la caisse de retraite. Brevet archivé dans la GED.');
    } else { log('Pension · ' + ST[s].l + ' validé', f.id + ' · ' + f.mat + ' · ' + nameOf(f)); }
  });
  on('pen-back', d => { const f = fileOf(d.id); f.trace.push({ s: f.step, back: true, who: S().user.login, date: H.now(), note: 'Renvoi à l’étape précédente pour correction' }); f.step = Math.max(0, f.step - 1); delete f.calc; log('Pension · renvoi pour correction', f.id + ' · ' + f.mat); });
  on('pen-print', d => { App.setUi('penPrint', d.k); App.setUi('penPrintId', d.id); setTimeout(() => { const el = document.getElementById('pen-print-area'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); });
  on('pen-doprint', () => { setTimeout(() => { document.body.classList.add('print-one'); try { window.print(); } catch (e) { } setTimeout(() => document.body.classList.remove('print-one'), 500); }, 50); });
  on('ind-next', d => { const x = PE().indem.find(y => y.id === d.id); x.step++; log('Indemnité · ' + ST[x.step - 1].l + ' validé', x.id + ' · ' + x.type); if (x.step >= 5) toast('Capital décès transmis à SIM-BA pour paiement.'); });
  on('pb-save', () => {
    const pe = PE(), ch = [];
    DEF.forEach(d => { const v = +ui('pb_' + d[0], pe.p[d[0]]); if (!isNaN(v) && v !== pe.p[d[0]]) { ch.push(d[1] + ' : ' + pe.p[d[0]] + ' → ' + v); pe.p[d[0]] = v; } });
    if (!ch.length) { toast('Aucune modification.'); return; }
    const [y, n] = pe.ver.split('.'); pe.ver = y + '.' + (+n + 1);
    pe.hist.unshift({ v: pe.ver, date: H.today(), who: S().user.login, t: ch.join(' ; ') });
    log('Nouvelle version des barèmes de pension ' + pe.ver, ch.join(' ; '));
    toast('Barème ' + pe.ver + ' enregistré : les calculs non validés sont recalculés, les liquidations visées restent figées.');
  });
  /* ---------- Actions : pensionnés, création, paie des pensions ---------- */
  const retOf = pen => ensureRet(PE()).find(r => r.pen === pen);
  on('rt-pay', d => { const r = retOf(d.pen); r.canal = ui('rtCanal_' + r.pen, r.canal); r.compte = ui('rtCpt_' + r.pen, r.compte); r.hist.push({ date: H.today(), t: 'Mode de paiement modifié : ' + r.canal + ' · ' + r.compte }); log('Pensionné · modification du mode de paiement', r.pen + ' · ' + r.name); toast('Mode de paiement enregistré.'); });
  on('rt-cv', d => { const r = retOf(d.pen); r.cv = H.today(); r.hist.push({ date: H.today(), t: 'Certificat de vie enregistré' }); log('Pensionné · certificat de vie', r.pen + ' · ' + r.name); toast('Certificat de vie enregistré : la pension est de nouveau payable.'); });
  on('rt-sus', d => { const r = retOf(d.pen); r.statut = d.v; r.hist.push({ date: H.today(), t: d.v === 'Suspendu' ? 'Paiement suspendu' : 'Paiement rétabli' }); log('Pensionné · ' + (d.v === 'Suspendu' ? 'suspension' : 'rétablissement'), r.pen + ' · ' + r.name); });
  on('rt-dec', d => {
    const pe = PE(), r = retOf(d.pen), dd = ui('rtDec_' + r.pen, '10/10/2026'), cj = (ui('rtCj_' + r.pen, r.conj || '') || '').trim();
    r.statut = 'Décédé'; r.dec = dd; r.hist.push({ date: H.today(), t: 'Décès déclaré (survenu le ' + dd + ')' });
    log('Pensionné · déclaration de décès', r.pen + ' · ' + r.name);
    if (!cj) { toast('Décès enregistré. Aucun conjoint survivant déclaré : pas de réversion.'); return; }
    const dt = pd(dd), j = new Date(dt.getFullYear(), dt.getMonth() + 1, 1), parts = cj.split(' ');
    const id = 'PEN-2026-0' + (232 + pe.files.length);
    pe.files.unshift({ id, mat: 'EXT-' + (1000 + pe.files.length), nat: 'Pension de réversion', ouv: H.today(), jouis: fd(j), step: 0, revOf: { pen: r.pen, brut: r.brut, name: r.name }, ext: { nom: (parts[0] || '').toUpperCase(), prenom: parts.slice(1).join(' '), indice: 0, entree: 2026, yob: 1960, naiss: '—', min: r.ministere, grade: 'Conjoint survivant de ' + r.name, canal: r.canal, enfants: 0 }, trace: [{ s: -1, who: S().user.login, date: H.now(), note: 'Réversion ouverte après le décès de ' + r.name }], pieces: Object.fromEntries(PIECES.map(p => [p, false])), refs: {} });
    log('Pension · ouverture de dossier', id + ' · réversion au profit de ' + cj);
    App.setUi('penT', 'dos'); App.setUi('penSel', id); App.setUi('penNew', '');
    toast('Décès enregistré. Dossier de réversion ' + id + ' ouvert au profit de ' + cj + '.');
  });
  on('pen-create', () => {
    const pe = PE(), d = draft(pe); if (!d) return;
    const n = pe.files.length, id = 'PEN-2026-0' + (232 + n);
    const f = { id, mat: d.ext ? 'EXT-' + (1000 + n) : d.mat, nat: d.nat, ouv: H.today(), jouis: d.jouis, step: 0, trace: [{ s: -1, who: S().user.login, date: H.now(), note: 'Dossier créé ' + (d.ext ? 'par saisie (bénéficiaire hors fichier)' : 'à partir de la fiche de l’agent') }], pieces: Object.fromEntries(PIECES.map(p => [p, false])), refs: {} };
    if (d.ext) f.ext = d.ext; if (d.revOf) f.revOf = d.revOf;
    pe.files.unshift(f);
    const a = agentBy(f.mat); if (a) { a.statut = 'Départ retraite'; a.hist = a.hist || []; a.hist.unshift({ date: H.today(), t: 'Ouverture du dossier de pension ' + id, ref: id }); }
    log('Pension · ouverture de dossier', id + ' · ' + f.mat + ' · ' + nameOf(f) + ' · ' + f.nat);
    App.setUi('penSel', id); App.setUi('penNew', ''); App.setUi('penF', 'all');
    toast('Dossier ' + id + ' créé. Prochaine étape : réunir les pièces.');
  });
  on('run-next', () => {
    const pe = PE(), run = pe.run, s = run.step, R = ensureRet(pe);
    if (s === 0) run.lines = R.filter(r => r.statut === 'En paiement' && cvOk(r)).map(r => ({ pen: r.pen, name: r.name, brut: r.brut, sol: Math.round(r.brut * pe.p.solid / 100), canal: r.canal, mat: r.mat }));
    if (s === 2) run.lines.forEach((x, i) => pe.pays.push({ per: run.per, ref: 'SIMBA-PEN-' + run.per.slice(0, 3).toUpperCase() + '-' + String(i + 1).padStart(3, '0'), pen: x.pen, name: x.name, brut: x.brut, sol: x.sol, canal: x.canal, date: '27/' + (run.per.startsWith('Nov') ? '11' : '12') + '/2026', st: 'Transmis · paiement le 27/' + (run.per.startsWith('Nov') ? '11' : '12'), mat: x.mat }));
    if (s === 3) {
      pe.pays.filter(x => x.st !== 'Payé' && (x.per === run.per || x.per === 'Octobre 2026')).forEach(x => { x.st = 'Payé'; x.cred = x.canal === 'Mobile money' ? 'Confirmation opérateur' : 'Retour SYSTAC (pain.002)'; const r = R.find(y => y.pen === x.pen); if (r) r.hist.push({ date: x.date, t: (x.first ? 'Premier versement perçu (pension, arrérages et indemnité de départ) : ' : 'Pension ' + (/^[aeiouéo]/i.test(x.per) ? 'd’' : 'de ') + x.per.toLowerCase() + ' perçue : ') + F(x.brut - x.sol) + ' (' + x.canal + ')' }); });
      log('Pensions · perception confirmée', run.per + ' · ' + run.lines.length + ' pensions · ' + F(run.lines.reduce((t, x) => t + x.brut - x.sol, 0)));
      toast('Paiements confirmés par les banques et les opérateurs : SMS envoyés aux pensionnés.');
    } else log('Pensions · ' + RST[s].l + ' validé', run.per + ' · ' + (run.lines || []).length + ' pensions');
    run.step++;
  });
  on('run-new', () => { const pe = PE(); pe.run = { per: pe.run.per.startsWith('Nov') ? 'Décembre 2026' : 'Janvier 2027', step: 0 }; });
  if (MOD.uplCtx) {
    MOD.uplCtx.pension = d => ({ ctx: 'pension:' + d.id, cat: d.p, after: made => { const f = fileOf(d.id); if (f && made[0]) f.pieces[d.p] = made[0].id; } });
    MOD.uplCtx.retcv = d => ({ ctx: 'pensionne:' + d.pen, cat: 'Certificat de vie', after: made => { const r = retOf(d.pen); if (r && made[0]) { r.cv = H.today(); r.cvFile = made[0].id; r.hist.push({ date: H.today(), t: 'Certificat de vie téléversé' }); } } });
  }
})();
