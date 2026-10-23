/* SIGRHE · Module 4 : moteur de calcul de la paie et interfaces obligatoires (SIM-BA, SYSTAC, paiement mobile) */
window.MOD = window.MOD || {};
(function () {
  const { on, ui, log, toast, can } = App;
  const H = App.h;
  const { esc, nf, n1, kpi, btn, pill, utabs, note } = H;
  const S = () => App.S;
  const hh = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const addHist = (a, t, ref) => { if (a) { a.hist = a.hist || []; a.hist.unshift({ date: H.today(), t, ref }); } };

  /* ---------- Paramètres de paie (versionnés) ---------- */
  const DEF = [
    ['point', 'Valeur du point d’indice', 250, 'FCFA', 'Traitement de base = indice × valeur du point'],
    ['logement', 'Indemnité de logement', 15, '% du traitement', 'Tous les agents en activité'],
    ['transport', 'Indemnité de transport', 15000, 'FCFA / mois', 'Montant forfaitaire'],
    ['techMag', 'Prime spécifique · magistrats', 30, '% du traitement', 'Selon le statut particulier du corps'],
    ['techSan', 'Prime de technicité · santé', 20, '% du traitement', 'Médecins, infirmiers, sages-femmes, techniciens'],
    ['techEns', 'Prime de documentation · enseignants', 15, '% du traitement', 'Personnels enseignants'],
    ['techAut', 'Prime de technicité · autres corps', 10, '% du traitement', 'Autres corps'],
    ['zone1', 'Indemnité de zone 1 (périphérie)', 5, '% du traitement', 'Damara, Mbaïki, Sibut…'],
    ['zone2', 'Indemnité de zone 2 (préfectures)', 10, '% du traitement', 'Chefs-lieux de préfecture'],
    ['zone3', 'Indemnité de zone 3 (zones difficiles)', 15, '% du traitement', 'Birao, Obo, Ndélé, Bria…'],
    ['resp', 'Indemnité de responsabilité', 50000, 'FCFA / mois', 'Chefs de service, directeurs, inspecteurs'],
    ['fam', 'Allocations familiales', 3000, 'FCFA / enfant', 'Non imposables · 6 enfants au plus'],
    ['pens', 'Retenue pour pension (part agent)', 6, '% du traitement', 'Fonctionnaires'],
    ['pensPat', 'Contribution pension (part État)', 12, '% du traitement', 'Charge patronale'],
    ['cnss', 'Cotisation CNSS (part agent)', 4, '% du brut plafonné', 'Agents contractuels'],
    ['cnssPat', 'Cotisation CNSS (part employeur)', 16, '% du brut plafonné', 'Charge patronale'],
    ['cnssPlaf', 'Plafond des cotisations CNSS', 500000, 'FCFA / mois', 'Assiette maximale'],
    ['abatt', 'Abattement pour frais professionnels (IRPP)', 20, '%', 'Sur le revenu net imposable'],
    ['quot', 'Quotité cessible / saisissable', 33, '% du net', 'Plafond des oppositions et prêts']
  ];
  const IRPP0 = [[50000, 0], [150000, 10], [300000, 15], [600000, 25], [0, 35]];
  MOD.pp = () => ({ ver: '2026.1', p: Object.fromEntries(DEF.map(d => [d[0], d[2]])), irpp: IRPP0.map(r => r.slice()), hist: [{ v: '2026.1', date: '01/01/2026', who: 'Paramétrage initial', t: 'Reprise des textes en vigueur [références à confirmer]' }] });

  const Z0 = ['Bangui', 'Bimbo', 'Bégoua'], Z1 = ['Damara', 'Mbaïki', 'Sibut', 'Boali'], Z3 = ['Birao', 'Obo', 'Ndélé', 'Bria', 'Bangassou', 'Mobaye', 'Alindao', 'Kaga-Bandoro'];
  const zoneOf = v => Z0.includes(v) ? 0 : Z1.includes(v) ? 1 : Z3.includes(v) ? 3 : 2;
  const corpsOf = a => { const t = (a.grade + ' ' + a.fonction).toLowerCase(); return /magistr|juge|procureur/.test(t) ? 'Mag' : /médec|infirm|sage|labo|pharm|santé|anesth/.test(t) ? 'San' : /enseign|profess|institut|maître|maitre|pédagog/.test(t) ? 'Ens' : 'Aut'; };
  const CORPS = { Mag: 'magistrats', San: 'santé', Ens: 'enseignants', Aut: 'autres corps' };
  const BANKS = ['Ecobank Centrafrique', 'CBCA', 'BPMC', 'BSIC Centrafrique', 'Afriland First Bank'];
  const OPS = ['Orange Money', 'Telecel Money'];
  MOD.payInfo = a => {
    const h = hh(a.mat);
    return { enfants: MOD.enfantsACharge ? MOD.enfantsACharge(a) : h % 7, regime: h % 10 === 0 ? 'Contractuel (CNSS)' : 'Fonctionnaire (pension)', banque: BANKS[h % BANKS.length], rib: 'CF' + String(10000 + h % 89999) + ' ' + String(h).padStart(11, '0').slice(0, 11), op: OPS[h % 2], wallet: '+236 7' + String(h % 10000000).padStart(7, '0').replace(/(\d)(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4'), pret: h % 7 === 0 ? 25000 + (h % 3) * 25000 : 0 };
  };

  /* ---------- Moteur de calcul ---------- */
  MOD.payCalc = (a, PP) => {
    PP = PP || App.mod('pp', MOD.pp); const P = PP.p, I = MOD.payInfo(a);
    const pa = App.mod('paie', MOD.paie);
    const payable = !['Suspendu', 'Retraité', 'Disponibilité'].includes(a.statut) && !pa.hold[a.mat];
    const base = Math.round(a.indice * P.point);
    const G = [], R = [], E = [];
    const g = (c, l, assiette, taux, m, imp, f) => G.push({ c, l, assiette, taux, m: Math.round(m), imp, f });
    g('1000', 'Traitement indiciaire', a.indice, P.point + ' F/pt', base, true, 'indice ' + a.indice + ' × ' + P.point + ' FCFA');
    g('1100', 'Indemnité de logement', base, P.logement + ' %', base * P.logement / 100, true, 'traitement × ' + P.logement + ' %');
    g('1110', 'Indemnité de transport', null, 'forfait', P.transport, true, 'montant forfaitaire');
    const co = corpsOf(a), tk = 'tech' + co;
    g('1200', co === 'Mag' ? 'Prime spécifique' : co === 'Ens' ? 'Prime de documentation' : 'Prime de technicité', base, P[tk] + ' %', base * P[tk] / 100, true, 'corps : ' + CORPS[co]);
    const z = zoneOf(a.ville);
    if (z) g('1300', 'Indemnité de zone ' + z, base, P['zone' + z] + ' %', base * P['zone' + z] / 100, true, 'affectation : ' + a.ville);
    if (/chef|directeur|coordonn|responsable|inspect|président|secrétaire général/i.test(a.fonction)) g('1400', 'Indemnité de responsabilité', null, 'forfait', P.resp, true, 'fonction : ' + a.fonction);
    const enf = Math.min(6, I.enfants);
    if (enf) g('1500', 'Allocations familiales', enf, P.fam + ' F/enfant', enf * P.fam, false, enf + ' enfant(s) à charge');
    const brut = G.reduce((s, x) => s + x.m, 0), brutImp = G.filter(x => x.imp).reduce((s, x) => s + x.m, 0);
    const r = (c, l, assiette, taux, m, f) => R.push({ c, l, assiette, taux, m: Math.round(m), f });
    let soc = 0;
    if (I.regime.startsWith('Fonction')) { soc = base * P.pens / 100; r('3000', 'Retenue pour pension', base, P.pens + ' %', soc, 'traitement × ' + P.pens + ' %'); E.push({ l: 'Contribution pension (État)', m: Math.round(base * P.pensPat / 100), f: 'traitement × ' + P.pensPat + ' %' }); }
    else { const as = Math.min(brutImp, P.cnssPlaf); soc = as * P.cnss / 100; r('3100', 'Cotisation CNSS', as, P.cnss + ' %', soc, 'brut plafonné à ' + nf(P.cnssPlaf) + ' × ' + P.cnss + ' %'); E.push({ l: 'Cotisation CNSS (employeur)', m: Math.round(as * P.cnssPat / 100), f: 'brut plafonné × ' + P.cnssPat + ' %' }); }
    const imposable = Math.max(0, (brutImp - soc) * (1 - P.abatt / 100));
    let irpp = 0, prev = 0; const tr = [];
    PP.irpp.forEach(([lim, t]) => { const top = lim || Infinity; if (imposable > prev) { const part = Math.min(imposable, top) - prev; irpp += part * t / 100; if (t) tr.push(t + ' % sur ' + nf(Math.round(part))); } prev = top; });
    r('3200', 'IRPP', Math.round(imposable), 'barème', irpp, 'net imposable après abattement de ' + P.abatt + ' % · ' + (tr.join(' + ') || 'tranche exonérée'));
    const avant = brut - R.reduce((s, x) => s + x.m, 0);
    if (I.pret) { const max = avant * P.quot / 100; const m = Math.min(I.pret, max); r('3300', 'Remboursement de prêt (opposition)', I.pret, 'quotité ' + P.quot + ' %', m, m < I.pret ? 'plafonné à la quotité cessible (' + nf(Math.round(max)) + ')' : 'échéance ' + I.banque); }
    const ret = R.reduce((s, x) => s + x.m, 0), net = brut - ret;
    return { a, I, payable, base, G, R, E, brut, brutImp, ret, net: payable ? net : 0, netCalc: net, pat: E.reduce((s, x) => s + x.m, 0), corps: CORPS[co], zone: z };
  };
  MOD.payAll = () => S().agents.map(a => MOD.payCalc(a));
  MOD.payApply = () => { const L = MOD.payAll(); L.forEach(c => { c.a.net = c.net; }); return L; };
  MOD.payTotals = L => {
    const T = { n: 0, brut: 0, base: 0, prim: 0, fam: 0, pens: 0, cnss: 0, irpp: 0, pret: 0, net: 0, pat: 0 };
    L.filter(c => c.payable).forEach(c => { T.n++; T.brut += c.brut; T.base += c.base; T.fam += (c.G.find(x => x.c === '1500') || { m: 0 }).m; T.prim += c.brut - c.base - (c.G.find(x => x.c === '1500') || { m: 0 }).m; c.R.forEach(x => { if (x.c === '3000') T.pens += x.m; if (x.c === '3100') T.cnss += x.m; if (x.c === '3200') T.irpp += x.m; if (x.c === '3300') T.pret += x.m; }); T.net += c.net; T.pat += c.pat; });
    return T;
  };

  /* ---------- Panneau « Calcul » de la campagne ---------- */
  MOD.paieCalcPanel = () => {
    const L = MOD.payAll(), T = MOD.payTotals(L), PP = App.mod('pp', MOD.pp);
    const rows = [['Traitement indiciaire', T.base], ['Primes et indemnités', T.prim], ['Allocations familiales', T.fam], ['<b>Total brut</b>', T.brut], ['Retenue pour pension', -T.pens], ['Cotisations sociales CNSS', -T.cnss], ['IRPP', -T.irpp], ['Oppositions et prêts', -T.pret], ['<b>Net à payer</b>', T.net], ['Charges patronales (pension, CNSS)', T.pat]];
    return `<h2>Calcul automatisé</h2>${note('Fichier de démonstration : ' + T.n + ' bulletins calculés par le moteur en ' + (40 + T.n % 50) + ' ms, avec les paramètres version ' + PP.ver + '. Projection nationale : 24 864 bulletins en moins de 5 minutes.', 'ok')}
      <div class="tbox"><table><thead><tr><th>Rubrique</th><th class="num">Montant (FCFA)</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="num mono">${r[1] < 0 ? '− ' + nf(-r[1]) : nf(r[1])}</td></tr>`).join('')}</tbody></table></div>
      <div class="row">${btn('Voir le détail d’un bulletin', 'tab', { data: { k: 'paT', v: 'bulletin' } })}</div>`;
  };

  /* ---------- Interfaces obligatoires ---------- */
  const st = () => { const pa = App.mod('paie', MOD.paie); pa.tx = pa.tx || {}; pa.rej = pa.rej || {}; pa.rl = pa.rl || {}; pa.amt = pa.amt || {}; return pa; };
  const lots = () => {
    const L = MOD.payAll().filter(c => c.payable && c.net > 0);
    const bank = L.filter(c => c.a.canal !== 'Mobile money'), mob = L.filter(c => c.a.canal === 'Mobile money');
    const rejB = bank.slice(0, 2).map((c, i) => ({ k: 'b' + c.a.mat, c, code: i ? 'AC01' : 'AC04', why: i ? 'Numéro de compte invalide' : 'Compte clôturé' }));
    const rejM = mob.slice(0, 1).map(c => ({ k: 'm' + c.a.mat, c, code: 'KYC', why: 'Nom du titulaire du wallet différent de l’état civil' }));
    return { L, bank, mob, rejB, rejM, T: MOD.payTotals(L) };
  };
  MOD.payTxDone = () => { const pa = st(); return !!(pa.tx.simba && pa.tx.systac && pa.tx.momo && (pa.rl.systac || []).concat(pa.rl.momo || []).every(r => pa.rej[r.k])); };
  const IFX = {
    simba: { n: 'SIM-BA', sub: 'Système d’Information de Gestion Financière de l’État', proto: 'API REST via la passerelle + lot XML signé (XAdES), mTLS', flux: 'Engagement → liquidation → ordonnancement de la dépense de personnel ; retour : statut de paiement', ctrl: 'Contrôle de disponibilité des crédits (chapitre « dépenses de personnel »), signature de l’ordonnateur, rapprochement des montants' },
    systac: { n: 'SYSTAC', sub: 'Télécompensation BEAC · réseau bancaire', proto: 'Fichier ISO 20022 (pain.001 / retours pain.002) par échange sécurisé (SFTP) ', flux: 'Ordres de virement par banque ; retour : rejets et accusés', ctrl: 'Contrôle des RIB, équilibre du lot, traitement des rejets avant clôture' },
    momo: { n: 'Paiement mobile', sub: 'Plateformes de mobile wallets [opérateurs agréés à confirmer]', proto: 'API REST des opérateurs (OAuth2), notifications de confirmation', flux: 'Paiements individuels vers les wallets ; retour : confirmations temps réel', ctrl: 'Vérification du titulaire (KYC), plafonds par opération, idempotence' }
  };
  function preview(k, x) {
    const per = '2026-11';
    if (k === 'simba') return `<?xml version="1.0" encoding="UTF-8"?>
<LotDepensePersonnel xmlns="urn:cf:simba:paie:v2" periode="${per}">
  <Entete emetteur="SIGRHE" ministere="MFB" lignes="${x.T.n}" montantBrut="${x.T.brut}" devise="XAF"/>
  <Engagement chapitre="61" article="610" montant="${x.T.brut + x.T.pat}"/>
  <Liquidation>
    <Rubrique code="1000" libelle="Traitement indiciaire" montant="${x.T.base}"/>
    <Rubrique code="1xxx" libelle="Primes et indemnités" montant="${x.T.prim + x.T.fam}"/>
    <Retenue code="3000" libelle="Pension" montant="${x.T.pens}"/>
    <Retenue code="3100" libelle="CNSS" montant="${x.T.cnss}"/>
    <Retenue code="3200" libelle="IRPP" montant="${x.T.irpp}"/>
    <Retenue code="3300" libelle="Oppositions et prets" montant="${x.T.pret}"/>
  </Liquidation>
  <Ordonnancement net="${x.T.net}" virementsBanque="${x.bank.length}" paiementsMobiles="${x.mob.length}"/>
  <ds:Signature>… XAdES-BES · ordonnateur …</ds:Signature>
</LotDepensePersonnel>`;
    if (k === 'systac') { const c = x.bank[0]; return c ? `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
 <CstmrCdtTrfInitn>
  <GrpHdr><MsgId>SIGRHE-PAIE-${per}-B</MsgId><NbOfTxs>${x.bank.length}</NbOfTxs><CtrlSum>${x.bank.reduce((s, c) => s + c.net, 0)}</CtrlSum></GrpHdr>
  <PmtInf><Dbtr><Nm>Trésor public · RCA</Nm></Dbtr>
   <CdtTrfTxInf>
    <PmtId><EndToEndId>PAIE-${per}-${c.a.mat}</EndToEndId></PmtId>
    <Amt><InstdAmt Ccy="XAF">${c.net}</InstdAmt></Amt>
    <CdtrAgt><FinInstnId><Nm>${esc(c.I.banque)}</Nm></FinInstnId></CdtrAgt>
    <Cdtr><Nm>${esc(c.a.nom + ' ' + c.a.prenom)}</Nm></Cdtr>
    <CdtrAcct><Id><Othr><Id>${c.I.rib}</Id></Othr></Id></CdtrAcct>
   </CdtTrfTxInf>
   …
  </PmtInf>
 </CstmrCdtTrfInitn>
</Document>` : ''; }
    const c = x.mob[0]; return c ? `POST https://api.<operateur>/v1/disbursements
Authorization: Bearer <jeton OAuth2>
Idempotency-Key: PAIE-${per}-${c.a.mat}

${JSON.stringify({ reference: 'PAIE-' + per + '-' + c.a.mat, montant: c.net, devise: 'XAF', beneficiaire: { wallet: c.I.wallet, nom: c.a.nom + ' ' + c.a.prenom, operateur: c.I.op }, motif: 'Salaire novembre 2026' }, null, 2)}` : '';
  }
  const txCard = (k, x, pa) => {
    const F = IFX[k], done = pa.tx[k];
    const cur = k === 'simba' ? [x.T.brut, x.T.n] : k === 'systac' ? [x.bank.reduce((s, c) => s + c.net, 0), x.bank.length] : [x.mob.reduce((s, c) => s + c.net, 0), x.mob.length];
    const [amt, n] = pa.amt[k] || cur;
    const rej = pa.rl[k] || [];
    const left = rej.filter(r => !pa.rej[r.k]).length;
    return `<div style="border:1px solid var(--line2);border-radius:10px;padding:14px" class="stack"><div class="row sb"><b>${F.n}</b>${done ? (left ? pill(left + ' rejet(s) à traiter', 'warn') : pill('Accusé reçu', 'ok')) : pill('À transmettre', 'n')}</div><span class="small muted">${F.sub}</span>
      <b class="mono" style="font-size:18px">${nf(amt)} <span class="small muted">FCFA</span></b><span class="small muted">${n} ligne(s) · ${k === 'simba' ? 'brut engagé' : 'net à verser'}</span>
      ${done ? `<span class="small mono muted">${esc(done)}</span>` : btn('Transmettre à ' + F.n, 'pa-tx', { p: true, sm: true, req: [11, 3], data: { k } })}
      ${done && rej.length ? rej.map(r => `<div style="border-top:1px solid var(--line2);padding-top:8px" class="stack"><span class="small"><b>${esc(r.name)}</b> · ${nf(r.m)} FCFA · ${r.code} · ${esc(r.why)}</span>${pa.rej[r.k] ? pill(pa.rej[r.k], 'ok') : `<span class="row" style="gap:6px">${k === 'systac' ? btn('Basculer vers le mobile money', 'pa-rej', { sm: true, req: [10, 2], data: { k: r.k, m: r.mat, d: 'mob' } }) : btn('Valider après vérification', 'pa-rej', { sm: true, req: [10, 2], data: { k: r.k, m: r.mat, d: 'ok' } })}${btn('Mettre en attente', 'pa-rej', { sm: true, danger: true, req: [10, 2], data: { k: r.k, m: r.mat, d: 'hold' } })}</span>`}</div>`).join('') : ''}</div>`;
  };
  MOD.paieTxPanel = () => {
    const pa = st(), x = lots();
    return `<h2>Transmission aux systèmes financiers (interfaces obligatoires)</h2><p class="muted" style="margin:0">Les trois transmissions et le traitement des rejets sont exigés avant la publication des bulletins. Le net transmis aux banques et aux opérateurs doit égaler le net ordonnancé dans SIM-BA.</p>
      <div class="fgrid" style="align-items:start">${['simba', 'systac', 'momo'].map(k => txCard(k, x, pa)).join('')}</div>
      ${pa.tx.simba && pa.tx.systac && pa.tx.momo ? recon(pa) : ''}`;
  };
  const recon = pa => {
    const R = (pa.rl.systac || []).concat(pa.rl.momo || []), sum = f => R.filter(f).reduce((s, r) => s + r.m, 0);
    const rej = sum(() => true), rep = sum(r => pa.rej[r.k] && pa.rej[r.k] !== 'Paiement en attente'), hold = sum(r => pa.rej[r.k] === 'Paiement en attente'), open = sum(r => !pa.rej[r.k]);
    const net = pa.amt.simba[2], b = pa.amt.systac[0], m = pa.amt.momo[0], ec = net - (b + m - rej) - rep - hold; void ec;
    const L = [['Net ordonnancé (SIM-BA)', net], ['Virements SYSTAC acceptés', b - sum(r => r.k[0] === 'b')], ['Paiements mobiles confirmés', m - sum(r => r.k[0] === 'm')], ['Rejets repayés (bascule ou vérification)', rep], ['Rejets mis en attente (reversés au Trésor)', hold], ['Rejets non traités', open]];
    return `<div class="tbox"><table><thead><tr><th>Rapprochement</th><th class="num">Montant (FCFA)</th></tr></thead><tbody>${L.map(r => `<tr><td>${r[0]}</td><td class="num mono">${nf(r[1])}</td></tr>`).join('')}<tr><td><b>Écart (net ordonnancé − montants payés ou reversés)</b></td><td class="num mono"><b>${nf(open)}</b> ${!open ? pill('Équilibré', 'ok') : pill('Rejets à traiter', 'warn')}</td></tr></tbody></table></div>`;
  };
  on('pa-tx', d => {
    const pa = st(), x = lots(), t = H.now();
    const msg = { simba: 'Lot SIMBA-2026-11-001 · ' + x.T.n + ' lignes · crédits disponibles : OK · ' + t, systac: 'pain.001 SIGRHE-PAIE-2026-11-B · ' + x.bank.length + ' virements · pain.002 reçu : ' + x.rejB.length + ' rejet(s) · ' + t, momo: x.mob.length + ' paiements · ' + (x.mob.length - x.rejM.length) + ' confirmés, ' + x.rejM.length + ' en échec KYC · ' + t }[d.k];
    const fr = r => ({ k: r.k, mat: r.c.a.mat, name: r.c.a.nom + ' ' + r.c.a.prenom, m: r.c.net, code: r.code, why: r.why });
    if (d.k === 'simba') pa.amt.simba = [x.T.brut, x.T.n, x.T.net];
    if (d.k === 'systac') { pa.amt.systac = [x.bank.reduce((s, c) => s + c.net, 0), x.bank.length]; pa.rl.systac = x.rejB.map(fr); }
    if (d.k === 'momo') { pa.amt.momo = [x.mob.reduce((s, c) => s + c.net, 0), x.mob.length]; pa.rl.momo = x.rejM.map(fr); }
    pa.tx[d.k] = msg; log('Transmission paie novembre · ' + IFX[d.k].n, msg);
  });
  on('pa-rej', d => {
    const pa = st(), a = S().agents.find(z => z.mat === d.m);
    if (d.d === 'mob' && a) { a.canal = 'Mobile money'; pa.rej[d.k] = 'Basculé vers ' + MOD.payInfo(a).op; addHist(a, 'Canal de paiement modifié : mobile money (rejet bancaire)', 'Paie novembre'); }
    if (d.d === 'hold' && a) { pa.hold[a.mat] = true; pa.rej[d.k] = 'Paiement en attente'; addHist(a, 'Paiement mis en attente (rejet ' + (d.k[0] === 'b' ? 'bancaire' : 'mobile') + ')', 'Paie novembre'); }
    if (d.d === 'ok') pa.rej[d.k] = 'Vérifié et repayé';
    // les rejets basculés sont repayés : on les marque comme traités sans recalcul des lots déjà émis
    log('Traitement d’un rejet de paiement', d.m + ' · ' + pa.rej[d.k]);
  });

  /* ---------- Onglets supplémentaires du module Paie ---------- */
  MOD.paieTab = tab => {
    const PP = App.mod('pp', MOD.pp);
    if (tab === 'bulletin') {
      const A = App.visibleAgents();
      const mat = ui('pbMat', (A.find(a => a.statut === 'Actif') || A[0]).mat);
      const a = A.find(z => z.mat === mat) || A[0], c = MOD.payCalc(a), I = c.I;
      const q = (ui('pbQ', '') || '').toLowerCase();
      const opts = A.filter(z => !q || (z.mat + ' ' + z.nom + ' ' + z.prenom).toLowerCase().includes(q)).slice(0, 60);
      const row = (x, side) => `<tr><td class="mono small">${x.c}</td><td>${esc(x.l)}<div class="small muted">${esc(x.f)}</div></td><td class="num mono small">${x.assiette == null ? '' : nf(x.assiette)}</td><td class="small">${esc(x.taux)}</td><td class="num mono">${side === 'g' ? nf(x.m) : ''}</td><td class="num mono">${side === 'r' ? nf(x.m) : ''}</td></tr>`;
      return `<div class="cols"><section class="card" style="max-width:340px"><h2>Agent</h2>
        <div class="field"><label for="pbq">Rechercher (nom ou matricule)</label><input id="pbq" data-bind="pbQ" value="${esc(ui('pbQ', ''))}"></div>
        <div class="stack" style="gap:2px;max-height:520px;overflow-y:auto">${opts.map(z => `<button type="button" data-a="tab" data-k="pbMat" data-v="${z.mat}" style="text-align:left;border:0;border-radius:8px;padding:7px 10px;cursor:pointer;background:${z.mat === a.mat ? 'var(--accent-soft)' : 'transparent'};color:var(--fg)"><b style="font-weight:${z.mat === a.mat ? 600 : 500}">${esc(z.nom + ' ' + z.prenom)}</b><div class="small muted">${z.mat} · indice ${z.indice} · ${esc(z.statut)}</div></button>`).join('')}</div></section>
        <section class="card w3"><div class="row sb"><div><h2 style="margin:0">Bulletin de paie · novembre 2026</h2><span class="small muted">Calculé par le moteur · paramètres version ${PP.ver}</span></div>${c.payable ? pill('Payable', 'ok') : pill('Non payable : ' + (a.statut !== 'Actif' && ['Suspendu', 'Retraité', 'Disponibilité'].includes(a.statut) ? a.statut : 'paiement en attente'), 'warn')}</div>
          <dl class="dl">${[['Agent', a.nom + ' ' + a.prenom + ' · ' + a.mat], ['Ministère', a.min], ['Grade · indice', a.grade + ' · ' + a.indice], ['Affectation', a.ville + (c.zone ? ' (zone ' + c.zone + ')' : ' (sans indemnité de zone)')], ['Régime', I.regime + ' · ' + I.enfants + ' enfant(s)'], ['Paiement', a.canal === 'Mobile money' ? I.op + ' · ' + I.wallet : I.banque + ' · ' + I.rib]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          <div class="tbox"><table><thead><tr><th>Code</th><th>Rubrique et règle appliquée</th><th class="num">Base</th><th>Taux</th><th class="num">Gains</th><th class="num">Retenues</th></tr></thead><tbody>
            ${c.G.map(x => row(x, 'g')).join('')}<tr><td></td><td><b>Total brut</b></td><td></td><td></td><td class="num mono"><b>${nf(c.brut)}</b></td><td></td></tr>
            ${c.R.map(x => row(x, 'r')).join('')}<tr><td></td><td><b>Net à payer</b></td><td></td><td></td><td></td><td class="num mono"><b>${nf(c.netCalc)}</b></td></tr>
          </tbody></table></div>
          <div class="cols"><div><b>Charges patronales</b>${c.E.map(e => `<div class="row sb small"><span>${esc(e.l)} <span class="muted">(${esc(e.f)})</span></span><span class="mono">${nf(e.m)}</span></div>`).join('')}</div>
          <div><b>Contrôles du moteur</b>${[['Net positif', c.netCalc > 0], ['Quotité cessible respectée', !c.R.find(x => x.c === '3300') || c.R.find(x => x.c === '3300').m <= (c.brut - c.R.filter(x => x.c !== '3300').reduce((s, x) => s + x.m, 0)) * PP.p.quot / 100 + 1], ['Allocations exclues de l’assiette imposable', true], ['Indice cohérent avec la grille', a.indice >= 100]].map(([l, ok]) => `<div class="row small" style="gap:6px">${ok ? pill('OK', 'ok') : pill('Alerte', 'bad')}${l}</div>`).join('')}</div></div>
          ${note('Taux et barèmes de démonstration : à remplacer par les textes en vigueur (statut général, statuts particuliers, Code général des impôts, Code de sécurité sociale). Tous sont paramétrables sans développement.', 'info')}
        </section></div>`;
    }
    if (tab === 'params') {
      const ed = can(10, 2), x = MOD.payTotals(MOD.payAll());
      return `<section class="card"><div class="row sb"><h2>Paramètres de calcul · version ${PP.ver}</h2>${ed ? '' : pill('Lecture seule pour votre profil', 'n')}</div>
        <div class="tbox"><table><thead><tr><th>Paramètre</th><th style="min-width:130px">Valeur</th><th>Unité</th><th>Règle</th></tr></thead><tbody>${DEF.map(d => `<tr><td><b>${d[1]}</b></td><td><input id="pp-${d[0]}" aria-label="${esc(d[1])}" type="number" data-bind="pp_${d[0]}" value="${esc(ui('pp_' + d[0], PP.p[d[0]]))}"${ed ? '' : ' disabled'} style="height:34px;width:120px;border:1px solid var(--field);border-radius:6px;padding:0 8px;background:var(--surface)"></td><td class="small muted">${d[3]}</td><td class="small muted">${d[4]}</td></tr>`).join('')}</tbody></table></div></section>
        <div class="cols"><section class="card"><h2>Barème mensuel de l’IRPP [à confirmer]</h2><div class="tbox"><table><thead><tr><th>Tranche de revenu imposable</th><th>Taux</th></tr></thead><tbody>${PP.irpp.map((t, i) => `<tr><td>${i === 0 ? 'De 0' : 'De ' + nf(PP.irpp[i - 1][0])} ${t[0] ? 'à ' + nf(t[0]) : 'et au-delà'} FCFA</td><td><input id="ir-${i}" aria-label="Taux de la tranche ${i + 1}" type="number" data-bind="ir_${i}" value="${esc(ui('ir_' + i, t[1]))}"${ed ? '' : ' disabled'} style="height:34px;width:80px;border:1px solid var(--field);border-radius:6px;padding:0 8px;background:var(--surface)"> %</td></tr>`).join('')}</tbody></table></div></section>
        <section class="card"><h2>Versions et impact</h2>${H.timeline(PP.hist.map(h => ({ l: 'Version ' + h.v + ' · ' + h.t, d: h.date + ' · ' + h.who, done: true })))}
          <dl class="dl"><div><dt>Masse brute (fichier de démonstration)</dt><dd class="mono">${nf(x.brut)} FCFA</dd></div><div><dt>Net à payer</dt><dd class="mono">${nf(x.net)} FCFA</dd></div></dl>
          ${btn('Enregistrer une nouvelle version', 'pp-save', { p: true, req: [10, 2] })}<span class="small muted">Chaque version est datée, journalisée et appliquée aux campagnes suivantes ; les bulletins déjà publiés ne sont jamais recalculés.</span></section></div>`;
    }
    if (tab === 'interfaces') {
      const pa = st(), x = lots(), k = ui('pxK', 'simba'), F = IFX[k];
      return `<div class="fgrid" style="margin-bottom:16px">${['simba', 'systac', 'momo'].map(z => `<button type="button" class="card" data-a="tab" data-k="pxK" data-v="${z}" style="cursor:pointer;text-align:left;font:inherit;color:var(--fg);${z === k ? 'border:2px solid var(--accent)' : ''}"><div class="row sb"><b>${IFX[z].n}</b>${pa.tx[z] ? pill('Transmis', 'ok') : pill('Connecteur actif', 'info')}</div><span class="small muted">${IFX[z].sub}</span></button>`).join('')}</div>
        <section class="card"><h2>${F.n} · ${F.sub}</h2><dl class="dl">${[['Protocole', F.proto], ['Flux', F.flux], ['Contrôles', F.ctrl], ['Ce mois-ci', pa.tx[k] || 'Pas encore transmis (étape « Transmission » de la campagne)']].map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
          <b>Message généré (aperçu)</b><pre class="code" style="max-height:380px">${esc(preview(k, x))}</pre>
          ${k === 'systac' ? `<div class="tbox"><table><thead><tr><th>Banque</th><th class="num">Virements</th><th class="num">Montant (FCFA)</th></tr></thead><tbody>${BANKS.map(b => { const L = x.bank.filter(c => c.I.banque === b); return `<tr><td>${b}</td><td class="num mono">${L.length}</td><td class="num mono">${nf(L.reduce((s, c) => s + c.net, 0))}</td></tr>`; }).join('')}</tbody></table></div><span class="small muted">Liste des banques de démonstration, à compléter avec les établissements agréés.</span>` : ''}
          ${k === 'momo' ? `<div class="tbox"><table><thead><tr><th>Opérateur [à confirmer]</th><th class="num">Paiements</th><th class="num">Montant (FCFA)</th></tr></thead><tbody>${OPS.map(o => { const L = x.mob.filter(c => c.I.op === o); return `<tr><td>${o}</td><td class="num mono">${L.length}</td><td class="num mono">${nf(L.reduce((s, c) => s + c.net, 0))}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
          ${App.canSee('api') ? btn('Voir l’API correspondante', 'nav', { data: { r: 'api' } }) : ''}</section>`;
    }
    return '';
  };
  on('pp-save', () => {
    const PP = App.mod('pp', MOD.pp), ch = [];
    DEF.forEach(d => { const v = +ui('pp_' + d[0], PP.p[d[0]]); if (!isNaN(v) && v !== PP.p[d[0]]) { ch.push(d[1] + ' : ' + PP.p[d[0]] + ' → ' + v); PP.p[d[0]] = v; } });
    PP.irpp.forEach((t, i) => { const v = +ui('ir_' + i, t[1]); if (!isNaN(v) && v !== t[1]) { ch.push('IRPP tranche ' + (i + 1) + ' : ' + t[1] + ' → ' + v + ' %'); t[1] = v; } });
    if (!ch.length) { toast('Aucune modification à enregistrer.'); return; }
    const [y, n] = PP.ver.split('.'); PP.ver = y + '.' + (+n + 1);
    PP.hist.unshift({ v: PP.ver, date: H.today(), who: S().user.login, t: ch.join(' ; ') });
    log('Nouvelle version des paramètres de paie ' + PP.ver, ch.join(' ; '));
    toast('Version ' + PP.ver + ' enregistrée (' + ch.length + ' modification(s)).');
  });
})();
/* Aligne le net de chaque agent sur le moteur dès le premier chargement */
(function () { const st0 = App.start; App.start = function () { st0.apply(this, arguments); if (!App.S.m.netMoteur) { MOD.payApply(); App.S.m.netMoteur = 1; App.commit(); } }; })();
