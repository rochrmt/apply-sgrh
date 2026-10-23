/* SIGRHE · Paie : répartition par mode de paiement et ordres de virement SYSTAC */
(function () {
  const { on, ui, log, toast, can } = App;
  const H = App.h;
  const { esc, nf, kpi, btn, pill, chips, note, pager } = H;
  const S = () => App.S;
  const PER = '2026-11', VAL = '25/11/2026';
  const BCODE = { 'Ecobank Centrafrique': 'B01', 'CBCA': 'B02', 'BPMC': 'B03', 'BSIC Centrafrique': 'B04', 'Afriland First Bank': 'B05' };

  function orders() {
    const pa = App.mod('paie', MOD.paie), rl = pa.rl || {}, rj = pa.rej || {}, tx = pa.tx || {};
    const rejOf = {}; (rl.systac || []).concat(rl.momo || []).forEach(r => { rejOf[r.mat] = r; });
    return MOD.payAll().filter(c => !['Suspendu', 'Retraité', 'Disponibilité'].includes(c.a.statut) && c.netCalc > 0).map(c => {
      const mob = c.a.canal === 'Mobile money', r = rejOf[c.a.mat];
      let st, kind;
      if (r && !rj[r.k]) { st = 'Rejeté · ' + r.code; kind = 'bad'; }
      else if (pa.hold[c.a.mat]) { st = 'En attente'; kind = 'warn'; }
      else if (r) { st = rj[r.k]; kind = 'info'; }
      else if (mob ? tx.momo : tx.systac) { st = mob ? 'Confirmé' : 'Émis · accusé reçu'; kind = 'ok'; }
      else { st = 'À émettre'; kind = 'n'; }
      return { ref: 'PAIE-' + PER + '-' + c.a.mat, c, a: c.a, mob, mode: mob ? c.I.op : c.I.banque, compte: mob ? c.I.wallet : c.I.rib, m: c.netCalc, st, kind, payable: kind !== 'bad' && kind !== 'warn' };
    });
  }
  const sum = L => L.reduce((s, o) => s + o.m, 0);

  function painXML(L) {
    const byBank = {}; L.filter(o => !o.mob && o.payable).forEach(o => { (byBank[o.mode] = byBank[o.mode] || []).push(o); });
    const all = Object.values(byBank).flat();
    return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
 <CstmrCdtTrfInitn>
  <GrpHdr><MsgId>SIGRHE-PAIE-${PER}-B</MsgId><CreDtTm>${new Date().toISOString().slice(0, 19)}</CreDtTm><NbOfTxs>${all.length}</NbOfTxs><CtrlSum>${sum(all)}</CtrlSum><InitgPty><Nm>Trésor public · République centrafricaine</Nm></InitgPty></GrpHdr>
${Object.entries(byBank).map(([b, L]) => `  <PmtInf>
   <PmtInfId>OV-${PER}-${BCODE[b] || 'BXX'}</PmtInfId><PmtMtd>TRF</PmtMtd><NbOfTxs>${L.length}</NbOfTxs><CtrlSum>${sum(L)}</CtrlSum>
   <ReqdExctnDt><Dt>2026-11-25</Dt></ReqdExctnDt><Dbtr><Nm>Trésor public</Nm></Dbtr><DbtrAgt><FinInstnId><Nm>BEAC · Bangui</Nm></FinInstnId></DbtrAgt>
${L.map(o => `   <CdtTrfTxInf><PmtId><EndToEndId>${o.ref}</EndToEndId></PmtId><Amt><InstdAmt Ccy="XAF">${o.m}</InstdAmt></Amt><CdtrAgt><FinInstnId><Nm>${esc(b)}</Nm></FinInstnId></CdtrAgt><Cdtr><Nm>${esc(o.a.nom + ' ' + o.a.prenom)}</Nm></Cdtr><CdtrAcct><Id><Othr><Id>${o.compte}</Id></Othr></Id></CdtrAcct><RmtInf><Ustrd>Salaire novembre 2026 ${o.a.mat}</Ustrd></RmtInf></CdtTrfTxInf>`).join('\n')}
  </PmtInf>`).join('\n')}
 </CstmrCdtTrfInitn>
</Document>`;
  }
  const csv = L => ['Référence;Matricule;Bénéficiaire;Ministère;Mode de paiement;Compte ou wallet;Montant (XAF);Statut'].concat(L.map(o => [o.ref, o.a.mat, o.a.nom + ' ' + o.a.prenom, o.a.min, o.mode, o.compte, o.m, o.st].map(v => String(v).replace(/;/g, ',')).join(';'))).join('\n');
  function download(name, text, mime) {
    try { const u = URL.createObjectURL(new Blob(['﻿' + text], { type: mime })); const l = document.createElement('a'); l.href = u; l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); return true; } catch (e) { return false; }
  }

  function filtered(L) {
    const f = ui('vrF', 'all'), q = (ui('vrQ', '') || '').toLowerCase();
    return L.filter(o => (f === 'all' || (f === 'bank' && !o.mob) || (f === 'mob' && o.mob) || (f === 'pb' && !o.payable) || f === o.mode) && (!q || (o.a.mat + ' ' + o.a.nom + ' ' + o.a.prenom + ' ' + o.a.min).toLowerCase().includes(q)));
  }

  function render() {
    const pa = App.mod('paie', MOD.paie), tx = pa.tx || {};
    const L = orders(), ok = L.filter(o => o.payable), bank = ok.filter(o => !o.mob), mob = ok.filter(o => o.mob), pb = L.filter(o => !o.payable);
    const f = ui('vrF', 'all');
    const modes = [...new Set(L.map(o => o.mode))].sort((x, y) => (BCODE[x] ? 0 : 1) - (BCODE[y] ? 0 : 1) || x.localeCompare(y));
    const tot = sum(ok);
    const mrow = md => { const all = L.filter(o => o.mode === md), p = all.filter(o => o.payable), isB = !!BCODE[md]; return `<tr data-a="tab" data-k="vrF" data-v="${esc(md)}" style="cursor:pointer;${f === md ? 'background:var(--accent-soft)' : ''}"><td><b>${esc(md)}</b><div class="small muted">${isB ? 'Virement bancaire · SYSTAC' : 'Paiement mobile · API opérateur'}</div></td><td class="mono small">${isB ? BCODE[md] : '—'}</td><td class="num mono">${p.length}</td><td class="num mono"><b>${nf(sum(p))}</b></td><td style="min-width:140px"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;border-radius:4px;background:var(--line2)"><div style="height:8px;border-radius:4px;width:${tot ? (sum(p) / tot * 100).toFixed(1) : 0}%;background:var(--${isB ? 'accent' : 'ok'})"></div></div><span class="small mono">${tot ? (sum(p) / tot * 100).toFixed(1) : 0} %</span></div></td><td class="num mono">${all.length - p.length || ''}</td></tr>`; };
    const F = filtered(L);
    const per = 15, pages = Math.max(1, Math.ceil(F.length / per)), pg = Math.min(ui('vrPg', 0), pages - 1);
    const banksSel = BCODE[f] ? [f] : Object.keys(BCODE);
    const bordereaux = banksSel.map(b => { const Lb = bank.filter(o => o.mode === b); return { b, n: Lb.length, m: sum(Lb) }; }).filter(x => x.n);
    const emitBtn = tx.systac ? pill('Ordres émis vers SYSTAC · ' + tx.systac.split(' · ').pop(), 'ok') : pa.step === 4 ? btn('Émettre les ordres vers SYSTAC', 'pa-tx', { p: true, req: [11, 3], data: { k: 'systac' } }) : `<span class="small muted">Émission à l’étape « Transmission » de la campagne (étape en cours : ${MOD.PAIE_STEPS[Math.min(pa.step, 5)]}).</span>`;

    return `<div class="kpis">${kpi('Net à virer', nf(tot) + ' <span style="font-size:13px">FCFA</span>', ok.length + ' ordres payables')}${kpi('Banques (SYSTAC)', nf(sum(bank)) + ' <span style="font-size:13px">FCFA</span>', bank.length + ' virements · ' + new Set(bank.map(o => o.mode)).size + ' banques')}${kpi('Paiement mobile', nf(sum(mob)) + ' <span style="font-size:13px">FCFA</span>', mob.length + ' paiements · ' + new Set(mob.map(o => o.mode)).size + ' opérateurs')}${kpi('En attente ou rejetés', String(pb.length), nf(sum(pb)) + ' FCFA retenus')}</div>
      <section class="card"><div class="row sb"><h2>Montant à virer par banque et moyen de paiement</h2><span class="small muted">Cliquez sur une ligne pour filtrer · fichier de démonstration · période ${PER}</span></div>
        <div class="tbox"><table><thead><tr><th>Banque ou opérateur</th><th>Code</th><th class="num">Ordres</th><th class="num">Montant (FCFA)</th><th>Part du net</th><th class="num">Retenus</th></tr></thead><tbody>
        ${modes.map(mrow).join('')}
        <tr style="background:var(--surface2)"><td><b>Sous-total banques (SYSTAC)</b></td><td></td><td class="num mono">${bank.length}</td><td class="num mono"><b>${nf(sum(bank))}</b></td><td></td><td></td></tr>
        <tr style="background:var(--surface2)"><td><b>Sous-total paiement mobile</b></td><td></td><td class="num mono">${mob.length}</td><td class="num mono"><b>${nf(sum(mob))}</b></td><td></td><td></td></tr>
        <tr><td><b>Total net à virer</b></td><td></td><td class="num mono"><b>${ok.length}</b></td><td class="num mono"><b>${nf(tot)}</b></td><td></td><td class="num mono">${pb.length || ''}</td></tr>
        </tbody></table></div><span class="small muted">Codes banque et liste des établissements fictifs, à remplacer par la nomenclature BEAC et les banques agréées.</span></section>

      <section class="card"><div class="row sb"><h2>Ordres de virement à envoyer à SYSTAC</h2>${emitBtn}</div>
        <div class="tbox"><table><thead><tr><th>N° d’ordre</th><th>Banque bénéficiaire</th><th class="num">Virements</th><th class="num">Montant (FCFA)</th><th>Date de valeur</th><th>Statut</th></tr></thead><tbody>
        ${bordereaux.map(x => `<tr><td class="mono">OV-${PER}-${BCODE[x.b]}</td><td><b>${esc(x.b)}</b></td><td class="num mono">${x.n}</td><td class="num mono"><b>${nf(x.m)}</b></td><td>${VAL}</td><td>${tx.systac ? pill('Émis', 'ok') : pill('À émettre', 'n')}</td></tr>`).join('')}
        <tr><td></td><td><b>Total du lot SYSTAC${BCODE[f] ? ' (banque filtrée)' : ''}</b></td><td class="num mono"><b>${bordereaux.reduce((s, x) => s + x.n, 0)}</b></td><td class="num mono"><b>${nf(bordereaux.reduce((s, x) => s + x.m, 0))}</b></td><td></td><td></td></tr>
        </tbody></table></div>
        <div class="row" style="gap:8px">${btn('Télécharger le fichier SYSTAC' + (BCODE[f] ? ' · ' + BCODE[f] : ''), 'vr-dl', { p: !tx.systac, data: { t: 'xml' } })}${btn('Liste filtrée (CSV)', 'vr-dl', { data: { t: 'csv' } })}${btn('Copier le XML', 'vr-copy')}</div>
        <details><summary class="small" style="cursor:pointer">Aperçu du fichier SYSTAC (ISO 20022 pain.001)</summary><pre class="code" style="max-height:340px;margin-top:8px">${esc(painXML(BCODE[f] ? L.filter(o => o.mode === f).slice(0, 4) : bank.slice(0, 4)))}\n<!-- aperçu limité aux 4 premiers virements ; le fichier téléchargé contient tout le lot --></pre></details>
        ${pb.some(o => !o.mob) ? note('Les virements rejetés ou en attente sont exclus du lot. Traitez-les à l’étape « Transmission » (bascule vers le mobile money ou mise en attente).', 'warn') : ''}</section>

      <section class="card"><div class="row sb"><h2>Détail des ordres de paiement</h2><span class="muted">${F.length} ordre(s) · ${nf(sum(F.filter(o => o.payable)))} FCFA payables</span></div>
        ${chips('vrF', [['all', 'Tous'], ['bank', 'Banques (SYSTAC)'], ['mob', 'Paiement mobile']].concat(modes.map(m => [m, m])).concat([['pb', 'En attente ou rejetés']]), f, 'Mode de paiement')}
        <label class="field" for="vrq" style="max-width:360px">Rechercher (nom, matricule, ministère)<input id="vrq" data-bind="vrQ" value="${esc(ui('vrQ', ''))}"></label>
        <div class="tbox"><table><thead><tr><th>Référence</th><th>Bénéficiaire</th><th>Mode de paiement</th><th>Compte ou wallet</th><th class="num">Montant (FCFA)</th><th>Statut</th></tr></thead><tbody>
        ${F.slice(pg * per, pg * per + per).map(o => `<tr><td class="mono small">${o.ref}</td><td><b>${esc(o.a.nom + ' ' + o.a.prenom)}</b><div class="small muted">${o.a.mat} · ${esc(o.a.min)}</div></td><td>${esc(o.mode)}<div class="small muted">${o.mob ? 'Mobile money' : 'SYSTAC'}</div></td><td class="mono small">${esc(o.compte)}</td><td class="num mono">${nf(o.m)}</td><td>${pill(o.st, o.kind)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucun ordre pour ce filtre.</td></tr>'}
        </tbody></table></div>${pages > 1 ? pager('vrPg', pg, pages) : ''}</section>`;
  }

  const prev = MOD.paieTab;
  MOD.paieTab = t => t === 'virements' ? render() : prev(t);
  on('vr-dl', d => {
    const L = orders(), f = ui('vrF', 'all');
    const ok = d.t === 'xml' ? download('SYSTAC_pain001_' + PER + (BCODE[f] ? '_' + BCODE[f] : '') + '.xml', painXML(BCODE[f] ? L.filter(o => o.mode === f) : L), 'application/xml') : download('ordres_paiement_' + PER + (f !== 'all' ? '_' + f.replace(/\W+/g, '_') : '') + '.csv', csv(filtered(L)), 'text/csv');
    log(d.t === 'xml' ? 'Génération du fichier SYSTAC (pain.001)' : 'Export des ordres de paiement (CSV)', f === 'all' ? 'tous modes' : f);
    toast(ok ? 'Fichier généré.' : 'Téléchargement bloqué par le navigateur : utilisez « Copier ».');
  });
  on('vr-copy', async () => {
    const L = orders(), f = ui('vrF', 'all');
    try { await navigator.clipboard.writeText(painXML(BCODE[f] ? L.filter(o => o.mode === f) : L)); toast('Fichier SYSTAC copié.'); } catch (e) { toast('Copie refusée par le navigateur.'); }
    App.commit();
  });
})();
