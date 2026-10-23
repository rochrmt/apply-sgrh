/* SIGRHE · écrans : agents, organisation, postes, carrière, évaluation, formation, présences, discipline, recrutement, offres */
window.MOD = window.MOD || {};
(function () {
  const { reg, on, ui, log, toast, can, go } = App;
  const H = App.h;
  const { esc, nf, n1, pct, fcfa, kpi, btn, pill, seg, utabs, chips, select, input, bars, note, steps, timeline } = H;
  const S = () => App.S;
  const agentBy = mat => S().agents.find(a => a.mat === mat);
  const addHist = (a, t, ref) => { if (a) { a.hist = a.hist || []; a.hist.unshift({ date: H.today(), t, ref }); } };
  const ENT = code => DATA.E.find(e => e[0] === code);

  /* ================= AGENTS ================= */
  reg('agents', {
    title: 'Agents de l’État', menu: 'Agents', crumb: 'Gestion des agents · Module 3', rows: [2],
    render() {
      const all = App.visibleAgents(), sc = App.scopeCode();
      const q = ui('agQ', '').trim().toLowerCase(), m = sc || ui('agM', ''), s = ui('agS', ''), x = ui('agX', '');
      const L = all.filter(a => (!m || a.code === m) && (!s || a.statut === s) && (!x || a.sx === x) && (!q || (a.nom + ' ' + a.prenom + ' ' + a.mat + ' ' + a.fonction + ' ' + a.ville + ' ' + a.grade).toLowerCase().includes(q)));
      const PS = 12, pages = Math.max(1, Math.ceil(L.length / PS)), pg = Math.min(ui('agPage', 0), pages - 1);
      const sel = agentBy(ui('agSel', all[0] && all[0].mat)) || all[0];
      const fem = L.filter(a => a.sx === 'F').length, net = L.reduce((t, a) => t + a.net, 0);
      const mins = []; all.forEach(a => { if (!mins.find(o => o[0] === a.code)) mins.push([a.code, a.code + ' · ' + a.min]); });
      const tab = ui('agT', 'id');
      const nr = sel && sel.niu === 'Non rapproché';
      const career = sel ? (sel.hist || []).map(h => ({ l: h.t, d: h.date + ' · ' + h.ref, done: true })).concat([
        { l: 'Avancement d’échelon (ancienneté)', d: '01/2026 · Arrêté n° 0142/MFP/26', done: true },
        { l: 'Nomination : ' + sel.fonction, d: Math.min(2025, sel.entree + 6) + ' · décision du ministère (' + sel.sig + ')', done: true },
        { l: 'Recrutement et intégration', d: sel.entree + ' · concours direct ou recrutement sur titre', done: true }]) : [];
      const fiche = !sel ? '' : `
        <div class="row" style="flex-wrap:nowrap;gap:14px"><span class="av" style="width:52px;height:52px;font-size:17px" aria-hidden="true">${esc(sel.nom[0] + sel.prenom[0])}</span><div style="flex:1;min-width:0"><b style="font-size:17px">${esc(sel.nom)} ${esc(sel.prenom)}</b><div class="mono muted">${sel.mat} · NIU ${esc(sel.niu)}</div></div>${pill(sel.statut)}</div>
        ${btn('Ouvrir la fiche électronique complète', 'fi-go', { p: true, sm: true, data: { m: sel.mat } })}
        ${utabs('agT', [['id', 'Identité'], ['car', 'Carrière'], ['pay', 'Paie'], ['doc', 'Documents']], tab, 'Fiche')}
        ${tab === 'id' ? `<dl class="dl">${[['Sexe', sel.sx === 'F' ? 'Féminin' : 'Masculin'], ['Naissance', sel.yob + ' à ' + sel.lieu + ' (' + (2026 - sel.yob) + ' ans)'], ['Ministère', sel.code + ' · ' + sel.min], ['Lieu d’affectation', sel.ville], ['Grade (statutaire)', sel.grade], ['Fonction exercée', sel.fonction], ['Entrée dans la fonction publique', sel.entree], ['Indice', sel.indice], ['Canal de paiement', sel.canal], ['Poste budgétaire', 'PB-' + sel.code + '-' + sel.mat.replace(/\D/g, '').slice(3, 7)]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${note(nr ? 'Identifiant national non rapproché avec le registre d’état civil : à régulariser avant la prochaine paie.' : 'État civil rapproché avec le registre national.', nr ? 'warn' : 'ok')}${nr && can(2, 2) ? btn('Lancer le rapprochement avec l’état civil', 'ag-niu', { sm: true, data: { m: sel.mat } }) : ''}` : ''}
        ${tab === 'car' ? timeline(career) + (App.canSee('carriere') ? `<div>${btn('Proposer un acte pour cet agent', 'ag-acte', { sm: true, req: [3, 2], data: { m: sel.mat } })}</div>` : '') : ''}
        ${tab === 'pay' ? `<div class="kpis">${kpi('Indice', sel.indice)}${kpi('Net octobre 2026', fcfa(sel.net))}${kpi('Canal', esc(sel.canal))}</div><div class="tbox"><table><thead><tr><th>Période</th><th class="num">Brut</th><th class="num">Net</th></tr></thead><tbody>${['Octobre 2026', 'Septembre 2026', 'Août 2026'].map(p => `<tr><td>${p}</td><td class="num mono">${fcfa(Math.round(sel.net / 0.8))}</td><td class="num mono">${fcfa(sel.net)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${tab === 'doc' ? `${MOD.fileTable(MOD.uplFiles('agent:' + sel.mat).slice(0, 5), { empty: 'Aucune pièce téléversée.', verify: false })}<div class="row" style="gap:8px">${btn('Téléverser des pièces', 'fi-go', { p: true, sm: true, data: { m: sel.mat, t: 'doc' } })}${App.canSee('ged') ? `<a href="#ged" data-a="nav" data-r="ged">Ouvrir la GED ›</a>` : ''}</div>` : ''}`;
      return `
      <div class="kpis">${kpi('Agents (sélection)', nf(L.length), sc ? 'périmètre : ' + esc(ENT(sc)[3]) : 'échantillon de ' + all.length + ' agents fictifs')}${kpi('Femmes', pct(fem, L.length))}${kpi('Âge moyen', L.length ? Math.round(L.reduce((t, a) => t + 2026 - a.yob, 0) / L.length) + ' ans' : '—')}${kpi('Hors Bangui', pct(L.filter(a => a.ville !== 'Bangui').length, L.length))}${kpi('Net mensuel (sélection)', n1(net / 1e6) + ' M FCFA')}</div>
      ${(() => { const nr = all.filter(a => a.niu === 'Non rapproché').length; return note('<b>Registre unique :</b> ' + nf(all.length) + ' agents, ' + nf(new Set(all.map(a => a.mat)).size) + ' matricules uniques, ' + nf(new Set(all.filter(a => a.niu !== 'Non rapproché').map(a => a.niu)).size) + ' identifiants nationaux rapprochés' + (nr ? ' · ' + nr + ' à rapprocher' : '') + '. Chaque agent a une seule fiche électronique, partagée par tous les modules.', 'info'); })()}
      ${sc ? note('Votre profil est limité au périmètre « ' + esc(ENT(sc)[3]) + ' » : seuls les agents de ce ministère sont visibles.', 'info') : ''}
      <div class="cols">
        <section class="card w3">
          <div class="fgrid">${input('ag-q', 'Rechercher', 'agQ', ui('agQ', ''), { type: 'search', ph: 'Nom, matricule, fonction, localité' })}${sc ? '' : select('ag-m', 'Ministère ou institution', 'agM', m, [['', 'Tous']].concat(mins))}${select('ag-s', 'Statut', 'agS', s, [['', 'Tous'], 'Actif', 'Stagiaire', 'Détachement', 'Disponibilité', 'Suspendu', 'Départ retraite', 'Retraité'])}${select('ag-x', 'Sexe', 'agX', x, [['', 'Tous'], ['F', 'Femmes'], ['M', 'Hommes']])}</div>
          <div class="tbox"><table><thead><tr><th>Matricule</th><th>Nom et prénom</th><th>Ministère</th><th>Grade · fonction</th><th>Statut</th><th></th></tr></thead><tbody>
          ${L.slice(pg * PS, pg * PS + PS).map(a => `<tr class="${sel && a.mat === sel.mat ? 'sel' : ''}"><td class="mono">${a.mat}</td><td><b>${esc(a.nom)}</b> ${esc(a.prenom)}<div class="small muted">${esc(a.ville)} · ${2026 - a.yob} ans</div></td><td class="small">${esc(a.min)}</td><td class="small">${esc(a.grade)}<div class="muted">${esc(a.fonction)}</div></td><td>${pill(a.statut)}</td><td>${sel && a.mat === sel.mat ? '<b class="small" style="color:var(--accent)">Ouvert</b>' : btn('Ouvrir', 'ag-open', { sm: true, data: { m: a.mat }, aria: 'Ouvrir la fiche de ' + a.nom + ' ' + a.prenom })}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">Aucun agent ne correspond aux filtres.</td></tr>`}
          </tbody></table></div>${H.pager('agPage', pg, pages)}
        </section>
        <section class="card w2" aria-label="Fiche électronique de l’agent">${fiche}</section>
      </div>`;
    }
  });
  on('ag-open', d => { App.setUi('agSel', d.m); App.setUi('agT', 'id'); });
  on('ag-niu', d => { const a = agentBy(d.m); a.niu = 'CF-' + String(a.yob).slice(2) + '-' + String(Math.floor(Math.random() * 900000) + 100000); addHist(a, 'Rapprochement état civil réussi', 'NIU ' + a.niu); log('Rapprochement état civil', a.mat + ' → ' + a.niu); toast('Identifiant national rapproché : ' + a.niu + '.'); });
  on('ag-acte', d => { App.setUi('carNewAg', d.m); go('carriere'); });

  /* ================= ORGANISATION ================= */
  const TL = { etat: 'Ministère d’État', min: 'Ministère', del: 'Ministre délégué', inst: 'Institution' };
  const DG = { MFB: ['DG du Budget', 'DG du Trésor et de la Comptabilité publique', 'DG des Impôts et des Domaines', 'DG des Douanes et Droits indirects', 'Direction de la Solde'], MEN: ['DG de l’Enseignement fondamental', 'DG de l’Enseignement secondaire général', 'DG de l’Enseignement technique', 'DG des Examens et Concours'], MSP: ['DG de la Santé publique', 'DG de la Population', 'DG des Établissements hospitaliers', 'Programmes nationaux de santé'], MFPRA: ['DG de la Fonction publique', 'DG de la Réforme administrative', 'Direction des Concours', 'ENAM'], MDNRA: ['État-major des Forces armées', 'DG des Services de santé des armées', 'Direction de la Solde militaire'], MISP: ['DG de la Police centrafricaine', 'DG de la Protection civile', 'Direction de l’Immigration-Émigration'] };
  reg('organisation', {
    title: 'Répertoire national des ministères et institutions', menu: 'Répertoire national', crumb: 'Organisation de l’État · Module 1', rows: [0],
    render() {
      const o = App.mod('org', () => ({ extra: {}, wf: -1, wfType: 'Création d’une direction' }));
      const q = ui('orQ', '').trim().toLowerCase(), f = ui('orF', 'all');
      const shown = DATA.E.filter(e => (f === 'all' || e[4] === f) && (!q || (e[0] + ' ' + e[1] + ' ' + e[2]).toLowerCase().includes(q)));
      const cur = ENT(ui('orSel', '08')) || DATA.E[7];
      const delOf = DATA.E.find(e => e[6] === cur[0]), parent = cur[6] ? ENT(cur[6]) : null;
      const nAg = S().agents.filter(a => a.code === cur[0]).length;
      let head, l1, l2, field, nt;
      if (cur[4] === 'inst') { head = cur[2]; l1 = ['Cabinet / Bureau', 'Secrétariat général ou Greffe', 'Services administratifs et financiers']; l2 = ['Direction des ressources humaines', 'Direction des affaires juridiques', 'Service informatique']; field = 'Pas de services déconcentrés'; nt = 'Organigramme type à compléter selon le texte organique.'; }
      else if (cur[4] === 'del') { head = cur[2]; l1 = ['Cabinet du Ministre délégué', 'Rattachement : ' + (parent ? parent[3] : '')]; l2 = ['Attributions déléguées par décret']; field = 'Personnel géré par le ministère de tutelle'; nt = 'Une délégation n’a pas de poste budgétaire propre.'; }
      else { head = (cur[4] === 'etat' ? 'Ministre d’État · ' : 'Ministre · ') + cur[3]; l1 = ['Cabinet du Ministre', 'Inspection générale', 'Secrétariat général']; l2 = (DG[cur[1]] || ['[Directions générales à paramétrer]']).concat(['Direction administrative et financière', 'Direction des ressources humaines', 'Direction des études et de la planification']); field = 'Services déconcentrés : directions régionales et services préfectoraux'; nt = DG[cur[1]] ? 'Organigramme généré à partir des structures enregistrées.' : 'Structure type ; les directions générales seront reprises du décret d’organisation.'; }
      const hist = (o.extra[cur[0]] || []).concat([{ v: 'v3', date: cur[0] === '31' ? '22/05/2026' : '21/05/2026', t: cur[0] === '31' ? 'Création par décret additif à la composition du Gouvernement' : 'Intitulé confirmé · gouvernement Moloua III', who: 'SGG · publiée' }, { v: 'v2', date: '[date]', t: 'Reprise de l’organigramme existant', who: 'Migration initiale' }, { v: 'v1', date: '[date]', t: 'Enregistrement au répertoire national', who: 'Code unique attribué' }]);
      const tab = ui('orT', 'org');
      const WF = ['Saisie', 'Validation par l’autorité compétente', 'Publication au répertoire'];
      const wf = o.wf;
      return `<div class="kpis">${kpi('Ministères', '31', 'dont 4 ministères d’État')}${kpi('Ministres délégués', '2', 'rattachés à leur tutelle')}${kpi('Institutions', '12', 'Présidence, Primature, Parlement, juridictions…')}${kpi('Référence', '<span style="font-size:16px">Gouvernement Moloua III</span>', 'décret du 21/05/2026 et additif du 22/05/2026')}</div>
      <div class="cols">
        <section class="card" style="max-width:420px">${input('or-q', 'Rechercher une entité', 'orQ', ui('orQ', ''), { type: 'search', ph: 'Intitulé, sigle ou code' })}
          ${chips('orF', [['all', 'Toutes'], ['etat', 'Ministères d’État'], ['min', 'Ministères'], ['del', 'Délégués'], ['inst', 'Institutions']], f, 'Type')}
          <span class="muted small">${shown.length} entité(s) · codes provisoires, à aligner sur la nomenclature budgétaire</span>
          <div class="stack" style="gap:2px;max-height:720px;overflow-y:auto">${shown.map(e => `<button type="button" data-a="tab" data-k="orSel" data-v="${e[0]}" style="text-align:left;border:0;border-radius:8px;padding:8px 10px;display:flex;gap:10px;cursor:pointer;background:${e[0] === cur[0] ? 'var(--accent-soft)' : 'transparent'};color:var(--fg)"${e[0] === cur[0] ? ' aria-current="true"' : ''}><span class="mono" style="min-width:34px;color:var(--accent)">${e[0]}</span><span style="padding-left:${e[4] === 'del' ? 12 : 0}px"><span style="display:block;font-weight:${e[0] === cur[0] ? 600 : 400}">${esc(e[3])}</span><span class="small muted">${TL[e[4]]}${e[5] ? ' · ' + nf(e[5]) + ' agents' : ''}</span></span></button>`).join('')}</div>
          ${btn('+ Créer un ministère ou une institution', 'or-create', { req: [0, 2] })}
        </section>
        <div class="w3 stack" style="gap:16px">
          <section class="card"><div class="row sb" style="align-items:flex-start"><div style="flex:1 1 360px;min-width:0"><div class="row" style="gap:8px"><span class="mono pill n">${cur[0]} · ${cur[1]}</span>${pill(TL[cur[4]], 'info')}${pill('Publié au répertoire', 'ok')}</div><h2 style="font-size:19px;margin-top:8px">${esc(cur[2])}</h2></div>${btn('Restructurer l’organigramme', 'or-edit', { p: true, req: [0, 2] })}</div>
            ${utabs('orT', [['org', 'Organigramme'], ['fiche', 'Fiche et délégations'], ['hist', 'Historique des versions']], tab, 'Vue')}
            ${tab === 'org' ? `<div style="overflow-x:auto"><div class="org"><div class="box" style="background:var(--navy);color:#fff;max-width:420px"><span class="small" style="color:var(--navy-muted)">Autorité</span><br><b>${esc(head)}</b></div><div class="vl"></div>${delOf ? `<div class="box" style="border:1px dashed var(--accent);color:var(--accent);max-width:420px">Délégation : ${esc(delOf[2])}</div><div class="vl"></div>` : ''}<div class="lvl">${l1.map(b => `<div class="box" style="background:var(--accent-soft);font-weight:600;flex:0 1 200px">${esc(b)}</div>`).join('')}</div><div class="vl"></div><div class="lvl">${l2.map(b => `<div class="box" style="border:1px solid var(--field);flex:0 1 175px">${esc(b)}</div>`).join('')}</div><div class="vl"></div><div class="box" style="background:var(--surface2);border:1px solid var(--line)">${esc(field)}</div></div></div><div class="row sb"><span class="muted">${nt}</span><span class="row" style="gap:8px">${btn('Exporter (PDF)', 'toast-msg', { sm: true, data: { m: 'Organigramme de ' + cur[1] + ' exporté en PDF.' } })}${btn('Exporter (JSON / XML)', 'toast-msg', { sm: true, data: { m: 'Organigramme de ' + cur[1] + ' exporté au format JSON / XML pour SIM-BA.' } })}</span></div>` : ''}
            ${tab === 'fiche' ? `<dl class="dl">${[['Code unique', cur[0] + ' (sigle ' + cur[1] + ')'], ['Type', TL[cur[4]]], ['Rattachement', parent ? 'Tutelle : ' + parent[3] : cur[4] === 'inst' ? 'Institution de la République' : 'Gouvernement'], ['Délégation rattachée', delOf ? delOf[2] : 'Aucune'], ['Effectif modélisé', cur[5] ? nf(cur[5]) : (cur[4] === 'del' ? 'géré par la tutelle' : 'à confirmer')], ['Agents dans l’échantillon', nAg], ['Interopérabilité', 'Code diffusé à SIM-BA et aux modules Postes, Paie, Carrière'], ['Dernière publication', hist[0].date + ' · ' + hist[0].v]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
            ${tab === 'hist' ? timeline(hist.map(h => ({ l: h.t, d: h.v + ' · ' + h.date + ' · ' + h.who, done: true }))) : ''}
          </section>
          ${wf >= 0 ? `<section class="card" style="border:2px solid var(--accent)"><div class="row sb"><h2>${esc(o.wfType)} · ${esc(cur[3])}</h2>${btn('Annuler', 'or-cancel', { ghost: true })}</div>${steps(WF, wf === 2 ? 3 : wf)}
            ${wf === 0 ? `<div class="fgrid">${select('wf-t', 'Nature de la modification', 'orWfType', o.wfType, ['Création d’une direction', 'Fusion de deux directions', 'Changement d’intitulé', 'Création d’un ministère', 'Création d’une délégation'])}${input('wf-n', 'Intitulé proposé', 'orWfName', ui('orWfName', 'Direction de la transformation numérique'))}</div>${btn('Soumettre pour validation', 'or-next', { p: true, req: [0, 2] })}` : ''}
            ${wf === 1 ? note('Transmis au Secrétariat général du Gouvernement et à la Fonction publique. Contrôles : code unique attribué, aucun doublon, rattachement valide.', 'n') + btn('Valider et publier', 'or-next', { p: true, req: [0, 3] }) : ''}
            ${wf === 2 ? note('Publié au répertoire national. Organigramme régénéré et code diffusé à SIM-BA et aux modules Postes et Paie.', 'ok') : ''}</section>` : ''}
        </div></div>`;
    }
  });
  on('or-create', () => { const o = App.mod('org'); o.wf = 0; o.wfType = 'Création d’un ministère'; });
  on('or-edit', () => { const o = App.mod('org'); o.wf = 0; o.wfType = 'Création d’une direction'; });
  on('or-cancel', () => { App.mod('org').wf = -1; });
  on('or-next', () => {
    const o = App.mod('org'), cur = ENT(ui('orSel', '08')) || DATA.E[7];
    if (o.wf === 0) { o.wfType = ui('orWfType', o.wfType); o.wf = 1; log('Proposition de modification du répertoire', o.wfType + ' · ' + cur[1]); }
    else if (o.wf === 1) { o.wf = 2; const list = o.extra[cur[0]] || []; list.unshift({ v: 'v' + (4 + list.length), date: H.today(), t: o.wfType + ' : ' + ui('orWfName', 'Direction de la transformation numérique'), who: S().user.login + ' · publiée' }); o.extra[cur[0]] = list; log('Publication au répertoire national', o.wfType + ' · ' + cur[1]); toast('Modification publiée au répertoire national.'); }
  });

  /* ================= POSTES ================= */
  MOD.postes = () => ({ added: [] });
  const EMP = { dirreg: ['Directeur régional', 'Encadrement supérieur', 'Cadre A1, 1re classe', 1650], chefsvc: ['Chef de service', 'Encadrement intermédiaire', 'Cadre A1', 1250], etudes: ['Chargé d’études', 'Études et conception', 'Cadre A2', 980], grh: ['Gestionnaire des ressources humaines', 'Gestion administrative', 'Cadre B1', 760], sante: ['Infirmier(ère) d’État', 'Santé', 'Cadre B1 (santé)', 870], ens: ['Professeur de lycée', 'Enseignement', 'Cadre A2 (enseignement)', 1020] };
  reg('postes', {
    title: 'Postes budgétaires et emplois', menu: 'Postes et emplois', crumb: 'Organisation de l’État · Module 2', rows: [1],
    render() {
      const ps = App.mod('postes', MOD.postes);
      const MINS = DATA.E.filter(e => e[4] === 'min' || e[4] === 'etat');
      const m = App.scopeCode() || ui('poM', '14');
      const cur = ENT(m), eff = cur[5] || 50, open = Math.round(eff * 1.05), credit = Math.max(40, Math.round(eff * 0.9)) * 1e6;
      const e = EMP[ui('poE', 'dirreg')], cost = e[3] * 310 * 1.35 * 12, line = '21.' + m + '.' + (e[1] === 'Encadrement supérieur' ? '611' : '612');
      const added = ps.added.filter(p => p.m === m), used = added.reduce((s, p) => s + p.cost, 0), left = credit - used, ok = cost <= left;
      const M0 = v => n1(v / 1e6) + ' M FCFA';
      const holders = S().agents.filter(a => a.code === m);
      const base = [['Directeur général', 'Cabinet / Secrétariat général', 'Administrateur civil, cl. exceptionnelle', 0, 'Occupé'], ['Directeur des ressources humaines', 'Direction des ressources humaines', 'Cadre A1, 1re classe', 1, 'Intérim'], ['Chef de service de la solde', 'Direction administrative et financière', 'Cadre A1', 2, 'Occupé'], ['Chargé d’études', 'Direction des études et de la planification', 'Cadre A2', -1, 'Vacant'], ['Gestionnaire des ressources humaines', 'Direction des ressources humaines', 'Cadre B1', 3, 'Occupé'], ['Directeur régional', 'Direction régionale n° 2', 'Cadre A1, 1re classe', -1, 'Vacant'], ['Comptable matières', 'Direction administrative et financière', 'Cadre B1', 4, 'Occupé']];
      const rows = base.map((b, i) => { const h = b[3] >= 0 ? holders[b[3] % Math.max(1, holders.length)] : null; return { code: 'PB-' + m + '-' + String(101 + i).padStart(4, '0'), fn: b[0], st: b[1], req: b[2], holder: h ? h.nom + ' ' + h.prenom : '—', hg: h ? h.grade : '', state: h ? b[4] : 'Vacant', line: '21.' + m + '.' + (i < 2 ? '611' : '612') }; });
      return `<div class="row" style="align-items:flex-end">${App.scopeCode() ? `<span class="pill info">Périmètre : ${esc(cur[3])}</span>` : `<div style="flex:1 1 380px">${select('po-m', 'Ministère', 'poM', m, MINS.map(x => [x[0], x[0] + ' · ' + x[3]]))}</div>`}
        <div class="kpis" style="flex:2 1 460px">${kpi('Postes ouverts', nf(open + added.length))}${kpi('Vacants', nf(open - eff + added.filter(p => p.state !== 'Validation budgétaire').length))}${kpi('Crédits de personnel disponibles', M0(left))}</div></div>
      <div class="cols">
        <section class="card w3"><div class="row sb"><h2>Postes budgétaires · ${esc(cur[3])}</h2><span class="muted">Grade (statut de l’agent) et fonction (poste occupé) sont gérés séparément</span></div>
          <div class="tbox"><table><thead><tr><th>Code poste</th><th>Fonction (Guide normatif)</th><th>Grade requis</th><th>Titulaire · son grade</th><th>Ligne</th><th>État</th></tr></thead><tbody>
          ${rows.map(r => `<tr><td class="mono">${r.code}</td><td><b>${esc(r.fn)}</b><div class="small muted">${esc(r.st)}</div></td><td class="small">${esc(r.req)}</td><td class="small">${esc(r.holder)}<div class="muted">${esc(r.hg)}</div></td><td class="mono">${r.line}</td><td>${pill(r.state)}</td></tr>`).join('')}
          ${added.map(p => `<tr><td class="mono">${p.code}</td><td><b>${esc(p.fn)}</b><div class="small muted">${esc(p.st)}</div></td><td class="small">${esc(p.req)}</td><td class="small">—</td><td class="mono">${p.line}</td><td>${pill(p.state === 'Validation budgétaire' ? 'En validation' : 'Vacant', p.state === 'Validation budgétaire' ? 'info' : 'ok')} ${p.state === 'Validation budgétaire' ? btn('Valider (DG Budget)', 'po-validate', { sm: true, req: [1, 3], data: { c: p.code } }) : (p.published ? '<span class="small muted">publié au portail</span>' : btn('Publier l’offre', 'po-publish', { sm: true, req: [1, 2], data: { c: p.code } }))}</td></tr>`).join('')}
          </tbody></table></div><span class="muted">« Intérim » : l’agent occupe une fonction dont le grade requis est supérieur au sien, sans changement de grade.</span></section>
        <section class="card"><h2>Proposer la création d’un poste</h2>${steps(['Proposition', 'Validation budgétaire', 'Intégration'], 0)}
          ${select('po-e', 'Emploi-type (référentiel)', 'poE', ui('poE', 'dirreg'), Object.entries(EMP).map(([k, v]) => [k, v[0]]))}
          ${input('po-s', 'Structure d’affectation', 'poS', ui('poS', 'Direction régionale n° 4 (Bambari)'))}
          <dl class="dl">${[['Grade minimum', e[2]], ['Famille', e[1]], ['Coût annuel', M0(cost)], ['Ligne budgétaire', line]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          ${note(ok ? 'Crédits suffisants : ' + M0(left) + ' disponibles, ' + M0(left - cost) + ' après création.' : 'Crédits insuffisants (' + M0(left) + ') : redéploiement nécessaire.', ok ? 'ok' : 'bad')}
          ${ok ? btn('Soumettre à la validation budgétaire', 'po-propose', { p: true, req: [1, 2] }) : ''}${H.lockNote(1, 2)}</section>
      </div>`;
    }
  });
  on('po-propose', () => {
    const ps = App.mod('postes', MOD.postes), m = App.scopeCode() || ui('poM', '14'), k = ui('poE', 'dirreg'), e = EMP[k];
    const code = 'PB-' + m + '-' + String(201 + ps.added.filter(p => p.m === m).length).padStart(4, '0');
    ps.added.push({ m, code, k, fn: e[0], st: ui('poS', 'Direction régionale n° 4 (Bambari)'), req: e[2], line: '21.' + m + '.' + (e[1] === 'Encadrement supérieur' ? '611' : '612'), cost: e[3] * 310 * 1.35 * 12, state: 'Validation budgétaire' });
    log('Proposition de création de poste', code + ' · ' + e[0]); toast('Proposition ' + code + ' transmise à la Direction générale du Budget.');
  });
  on('po-validate', d => { const p = App.mod('postes', MOD.postes).added.find(x => x.code === d.c); p.state = 'Intégré'; log('Validation budgétaire de poste', p.code); toast('Poste ' + p.code + ' intégré au SIGRHE. Il peut être publié au portail des offres.'); });
  on('po-publish', d => { const p = App.mod('postes', MOD.postes).added.find(x => x.code === d.c); p.published = true; const of = App.mod('offres', MOD.offres); of.extra.unshift(['V26-' + p.code.slice(3), p.fn + ' · ' + p.st, (ENT(p.m) || [0, 0, ''])[2], 'Poste vacant (mobilité interne)', 1, p.st, p.req, 55, '30/11/2026', false, 'Poste créé et validé dans le SIGRHE, ouvert à la mobilité interne.']); log('Publication d’une offre', p.code); toast('Offre publiée sur le portail public des offres d’emploi.'); });

  /* ================= CARRIÈRE ================= */
  const CSTEPS = [['Initiation', 'DRH sectorielle', null], ['Visa Fonction publique', 'Direction générale de la Fonction publique', [3, 3]], ['Visa Contrôle financier', 'Contrôle financier · MFB', [4, 3]], ['Signature', 'Ministre compétent', [3, 3]], ['Notification', 'Agent et services de la solde', [3, 2]]];
  MOD.carriere = () => ({ actes: [
    { id: 'AV-2026-0142', t: 'av', mat: '104-2381-K', objet: 'Avancement au 4e échelon', effet: '01/01/2027', detail: 'Ancienneté de 2 ans atteinte, note 2026 : 16,5/20. Indice 1 210 → 1 265.', p: 2 },
    { id: 'AV-2026-0151', t: 'av', mat: '132-1904-G', objet: 'Passage à la classe exceptionnelle', effet: '01/01/2027', detail: 'Inscrite au tableau d’avancement 2026, rang 4/31.', p: 1 },
    { id: 'AV-2026-0163', t: 'av', mat: '199-0560-H', objet: 'Avancement au 3e échelon', effet: '01/12/2026', detail: 'Ancienneté et évaluation conformes.', p: 3 },
    { id: 'MU-2026-0088', t: 'mu', mat: '211-0457-B', objet: 'Mutation Bambari → Bangui', effet: '01/12/2026', detail: 'Demande de l’agent (rapprochement de conjoint). Poste d’accueil vacant au CHU de l’Amitié.', p: 1, dest: 'Bangui' },
    { id: 'MU-2026-0091', t: 'mu', mat: '230-3301-F', objet: 'Mutation Carnot → Bozoum', effet: '01/01/2027', detail: 'Mutation dans l’intérêt du service.', p: 0, dest: 'Bozoum' },
    { id: 'RT-2026-0033', t: 'rt', mat: '088-0912-A', objet: 'Admission à la retraite', effet: '01/02/2027', detail: 'Limite d’âge atteinte. Le dossier de pension est ouvert à la notification.', p: 3 },
    { id: 'RT-2026-0036', t: 'rt', mat: '097-1120-D', objet: 'Prolongation d’activité (12 mois)', effet: '27/06/2027', detail: 'Demande motivée de la DG Budget.', p: 1, prolong: true }
  ] });
  reg('carriere', {
    title: 'Carrière et actes administratifs', menu: 'Carrière', crumb: 'Gestion des agents · Module 7', tag: 'P1', rows: [3, 4],
    render() {
      const c = App.mod('carriere', MOD.carriere);
      const sc = App.scopeCode();
      const tab = ui('caT', 'av');
      const vis = c.actes.filter(a => a.t === tab && (!sc || (agentBy(a.mat) || {}).code === sc));
      const sel = c.actes.find(a => a.id === ui('caSel', '')) || vis[0];
      const label = a => a.rej ? ['Renvoyé', 'bad'] : a.p >= 4 ? ['Notifié', 'ok'] : [CSTEPS[a.p + 1][0], 'info'];
      const ag = sel ? agentBy(sel.mat) : null;
      const nxt = sel && !sel.rej && sel.p < 4 ? CSTEPS[sel.p + 1] : null;
      const cands = App.visibleAgents().filter(a => a.statut === 'Actif');
      const newAg = ui('carNewAg', cands[0] && cands[0].mat);
      return `<div class="row sb">${seg('caT', [['av', 'Avancements (' + c.actes.filter(a => a.t === 'av').length + ')'], ['mu', 'Mutations (' + c.actes.filter(a => a.t === 'mu').length + ')'], ['rt', 'Retraites (' + c.actes.filter(a => a.t === 'rt').length + ')']], tab, 'Type d’acte')}<span class="muted">Avancements calculés à partir de l’ancienneté et des évaluations ; effets automatiques sur le dossier et la paie</span></div>
      <div class="cols">
        <section class="card w3"><div class="tbox"><table><thead><tr><th>N° acte</th><th>Agent</th><th>Objet</th><th>Effet</th><th>Étape</th><th></th></tr></thead><tbody>
          ${vis.map(a => { const g = agentBy(a.mat), l = label(a); return `<tr class="${sel && a.id === sel.id ? 'sel' : ''}"><td class="mono">${a.id}</td><td><b>${esc(g ? g.nom + ' ' + g.prenom : a.mat)}</b><div class="mono small muted">${a.mat}</div></td><td>${esc(a.objet)}</td><td class="small">${a.effet}</td><td>${pill(l[0], l[1])}</td><td>${sel && a.id === sel.id ? '<b class="small" style="color:var(--accent)">Ouvert</b>' : btn('Ouvrir', 'tab', { sm: true, data: { k: 'caSel', v: a.id } })}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">Aucun acte dans votre périmètre.</td></tr>'}
          </tbody></table></div>
          <h2 style="margin-top:6px">Proposer un nouvel acte</h2>
          <div class="fgrid">${select('ca-ag', 'Agent', 'carNewAg', newAg, cands.slice(0, 120).map(a => [a.mat, a.nom + ' ' + a.prenom + ' · ' + a.sig]))}${select('ca-ty', 'Nature', 'carNewT', ui('carNewT', 'av'), [['av', 'Avancement d’échelon'], ['mu', 'Mutation'], ['rt', 'Admission à la retraite']])}${ui('carNewT', 'av') === 'mu' ? select('ca-de', 'Destination', 'carNewD', ui('carNewD', 'Bangui'), ['Bangui', 'Bambari', 'Berbérati', 'Bouar', 'Bossangoa', 'Bria', 'Kaga-Bandoro']) : ''}<div>${btn('Créer l’acte', 'ca-new', { p: true, req: [3, 2] })}</div></div>${H.lockNote(3, 2)}
        </section>
        <section class="card w2">${sel ? `<div><div class="mono muted">${sel.id}</div><h2 style="font-size:18px;margin-top:2px">${esc(sel.objet)}</h2><div class="muted" style="font-size:14px">${esc(ag ? ag.nom + ' ' + ag.prenom + ' · ' + ag.grade : '')} · effet au ${sel.effet}</div></div>
          ${note(esc(sel.detail), 'n')}
          ${timeline(CSTEPS.map(([l, w], i) => ({ l, d: w + ' · ' + (i <= sel.p ? 'visé' : i === sel.p + 1 && !sel.rej ? 'en attente' : sel.rej && i === sel.p + 1 ? 'renvoyé' : 'à venir'), done: i <= sel.p, cur: i === sel.p + 1 && !sel.rej, mark: i + 1 })))}
          ${nxt ? `<div class="row">${btn('Viser : ' + nxt[0], 'ca-approve', { p: true, req: nxt[2], data: { id: sel.id } })}${btn('Renvoyer pour correction', 'ca-reject', { danger: true, req: nxt[2], data: { id: sel.id } })}</div>${nxt[2] && !can(nxt[2][0], nxt[2][1]) ? `<span class="lock">Cette étape relève du profil « ${nxt[0] === 'Visa Contrôle financier' ? 'Contrôleur financier' : 'DRH centrale'} ».</span>` : ''}` : ''}
          ${sel.p >= 4 ? note('Acte notifié. Le dossier de l’agent et les éléments de paie ont été mis à jour automatiquement.', 'ok') : ''}
          ${sel.rej ? note('Acte renvoyé à l’initiateur pour correction. L’historique est conservé dans la piste d’audit.', 'bad') : ''}` : '<p class="muted">Sélectionnez un acte.</p>'}</section>
      </div>`;
    }
  });
  on('ca-approve', d => {
    const c = App.mod('carriere', MOD.carriere), a = c.actes.find(x => x.id === d.id); a.p++;
    log('Visa d’acte · ' + CSTEPS[a.p][0], a.id + ' · ' + a.objet);
    if (a.p >= 4) {
      const g = agentBy(a.mat);
      if (a.t === 'av' && g) { g.indice += 55; g.net = Math.round(g.indice * 310 * 1.32 * 0.8 / 100) * 100; addHist(g, a.objet, a.id + ' · nouvel indice ' + g.indice); }
      if (a.t === 'mu' && g) { const from = g.ville; g.ville = a.dest || g.ville; addHist(g, a.objet, a.id + ' · ' + from + ' → ' + g.ville); }
      if (a.t === 'rt' && g && !a.prolong) { g.statut = 'Retraité'; addHist(g, 'Admission à la retraite', a.id); const pe = App.mod('pensions', MOD.pensions); pe.files.unshift({ id: 'PEN-2026-0' + (230 + pe.files.length), mat: g.mat, nat: 'Pension d’ancienneté', date: a.effet, state: 'En calcul', yrs: Math.min(40, 2026 - g.entree), idx: g.indice }); }
      if (a.t === 'rt' && g && a.prolong) addHist(g, a.objet, a.id);
      toast('Acte ' + a.id + ' notifié : dossier de l’agent et paie mis à jour.');
    } else toast('Visa enregistré : ' + CSTEPS[a.p][0] + '.');
  });
  on('ca-reject', d => { const a = App.mod('carriere', MOD.carriere).actes.find(x => x.id === d.id); a.rej = true; log('Renvoi d’acte pour correction', a.id); });
  on('ca-new', () => {
    const c = App.mod('carriere', MOD.carriere), t = ui('carNewT', 'av'), mat = ui('carNewAg', App.visibleAgents()[0].mat), g = agentBy(mat);
    const id = { av: 'AV', mu: 'MU', rt: 'RT' }[t] + '-2026-0' + (200 + c.actes.length);
    const dest = ui('carNewD', 'Bangui');
    c.actes.unshift({ id, t, mat, objet: t === 'av' ? 'Avancement d’échelon' : t === 'mu' ? 'Mutation ' + g.ville + ' → ' + dest : 'Admission à la retraite', effet: '01/01/2027', detail: 'Acte proposé par ' + S().user.login + ' le ' + H.today() + '.', p: 0, dest });
    App.setUi('caT', t); App.setUi('caSel', id); log('Proposition d’acte', id + ' · ' + g.nom + ' ' + g.prenom); toast('Acte ' + id + ' créé et transmis pour visa.');
  });

  /* ================= ÉVALUATION ================= */
  MOD.evaluation = () => ({ notes: {} });
  reg('evaluation', {
    title: 'Évaluation des performances', menu: 'Évaluation', crumb: 'Gestion des agents · Modules 6 et 10 · Campagne 2026', tag: 'P1', rows: [5],
    render() {
      const ev = App.mod('evaluation', MOD.evaluation);
      const A = App.visibleAgents().filter(a => a.statut === 'Actif' || a.statut === 'Stagiaire');
      const mat = ui('evAg', '104-2381-K'), ag = agentBy(mat) && A.find(a => a.mat === mat) ? agentBy(mat) : A[0];
      const O = [['Atteinte des résultats du service', 'objectifs chiffrés du poste', 35, 4], ['Qualité du travail et respect des procédures', 'contrôles et réclamations', 25, 4], ['Gestion des moyens et des dossiers', 'registres et délais', 20, 5], ['Formation et initiative', 'actions menées', 20, 3]];
      const r = O.map((o, i) => ui('evR' + i, [4, 5, 4, 3][i]));
      const note20 = O.reduce((s, o, i) => s + r[i] * o[2], 0) / 100 * 4;
      const mention = note20 >= 17 ? 'Excellent' : note20 >= 14 ? 'Très bien' : note20 >= 12 ? 'Bien' : note20 >= 10 ? 'Passable' : 'Insuffisant';
      const done = ev.notes[ag.mat];
      const P = [['Finances et Budget', 88], ['Santé et Population', 71], ['Éducation nationale', 64], ['Intérieur', 52], ['Agriculture', 47], ['Défense nationale', 38]];
      const nDone = Object.keys(ev.notes).length;
      return `<div class="cols">
        <section class="card"><h2>Avancement de la campagne 2026</h2><span class="muted">Du 01/10 au 12/11/2026 · auto-évaluation → évaluation N+1 → validation</span><div class="row" style="gap:10px;align-items:baseline"><b style="font-size:32px">63 %</b><span class="muted">des fiches validées (15 632 / 24 812)${nDone ? ' · ' + nDone + ' validée(s) pendant cette démonstration' : ''}</span></div>${bars(P.map(([l, v]) => [l, v, v + ' %', v >= 60 ? null : 'var(--warn-bar)']), 100)}${btn('Relancer les évaluateurs en retard (412)', 'toast-msg', { req: [5, 3], data: { m: 'Relance envoyée par SMS et courriel à 412 évaluateurs.' } })}</section>
        <section class="card w2"><div class="row sb" style="align-items:flex-start"><div style="flex:1 1 280px">${select('ev-ag', 'Agent évalué', 'evAg', ag.mat, A.slice(0, 150).map(a => [a.mat, a.nom + ' ' + a.prenom + ' · ' + a.fonction]))}</div><div style="text-align:right"><div class="small muted">Note calculée</div><b class="mono" style="font-size:30px;color:var(--accent)">${n1(note20)}/20</b><div class="small" style="color:var(--accent);font-weight:600">${mention}</div></div></div>
          <div class="muted">${esc(ag.grade)} · ${esc(ag.fonction)} · ${esc(ag.min)}</div>
          ${O.map((o, i) => `<div style="border:1px solid var(--line2);border-radius:10px;padding:12px" class="stack"><div class="row sb"><div><b>${o[0]}</b><div class="small muted">Indicateur : ${o[1]} · poids ${o[2]} %</div></div><span class="small muted">Auto-évaluation : <b style="color:var(--fg)">${o[3]}/5</b></span></div><div class="row" style="gap:6px" role="group" aria-label="Note de l’évaluateur">${[1, 2, 3, 4, 5].map(v => `<button type="button" class="btn${r[i] === v ? ' p' : ''}" style="width:44px;padding:0" aria-pressed="${r[i] === v}" data-a="tab" data-k="evR${i}" data-v="${v}"${done ? ' disabled' : ''}>${v}</button>`).join('')}</div></div>`).join('')}
          ${done ? note('Fiche validée le ' + done.date + ' (' + done.note + '). L’agent la consulte sur son portail ; la note alimente le tableau d’avancement 2027.', 'ok') : `<div class="row">${btn('Valider et transmettre à l’agent', 'ev-validate', { p: true, req: [5, 2], data: { m: ag.mat, n: n1(note20) + '/20 · ' + mention } })}</div>${H.lockNote(5, 2)}`}</section></div>`;
    }
  });
  on('ev-validate', d => { const ev = App.mod('evaluation', MOD.evaluation); ev.notes[d.m] = { date: H.today(), note: d.n }; const g = agentBy(d.m); addHist(g, 'Évaluation 2026 validée', d.n); log('Validation de fiche d’évaluation', d.m + ' · ' + d.n); toast('Fiche validée et transmise à l’agent.'); });

  /* ================= FORMATION ================= */
  MOD.formation = () => ({ inPlan: { 0: true, 2: true }, valid: { 0: true } });
  reg('formation', {
    title: 'Formation et développement des compétences', menu: 'Formation', crumb: 'Gestion des agents · Module 8', tag: 'P2', rows: [6],
    render() {
      const f = App.mod('formation', MOD.formation);
      const N = [['Gestion des urgences pédiatriques', 'Santé et Population', 'Évaluations 2026', 412, 'Haute', 'Atelier pratique', 'févr.–mars 2027', 38], ['Utilisation du SIGRHE (gestionnaires RH)', 'Fonction publique et Réforme administrative', 'Projet PGNSP', 640, 'Haute', 'Mixte', 'janv.–avr. 2027', 52], ['Pédagogie des mathématiques au secondaire', 'Éducation nationale', 'Inspections académiques', 1150, 'Haute', 'Cascade', 'avr.–juin 2027', 61], ['Comptabilité publique et chaîne de la dépense', 'Finances et Budget', 'Demandes des agents', 210, 'Moyenne', 'Présentiel', 'mai 2027', 24], ['Cybersécurité et protection des données', 'Économie numérique', 'Plan national cybersécurité', 95, 'Moyenne', 'E-learning', 'continu', 9], ['Gestion des conflits et accueil des usagers', 'Intérieur et Sécurité publique', 'Évaluations 2026', 380, 'Moyenne', 'Présentiel', 'sept. 2027', 27]];
      const tab = ui('foT', 'needs');
      const idx = N.map((_, i) => i).filter(i => f.inPlan[i]);
      return `<div class="kpis">${kpi('Besoins recensés 2027', '282', 'issus des évaluations et des demandes')}${kpi('Actions au plan', idx.length, idx.reduce((s, i) => s + N[i][7], 0) + ' M FCFA budgétés')}${kpi('Taux de participation 2026', '84 %', 'présents / inscrits')}${kpi('Agents formés (12 mois)', '3 214', 'inscrits au dossier de carrière')}</div>
      ${seg('foT', [['needs', '1. Recensement des besoins'], ['plan', '2. Plans sectoriels'], ['follow', '3. Suivi et impact']], tab, 'Cycle')}
      ${tab === 'needs' ? `<section class="card"><div class="tbox"><table><thead><tr><th>Besoin</th><th>Ministère</th><th>Source</th><th class="num">Agents</th><th>Priorité</th><th></th></tr></thead><tbody>${N.map((n, i) => `<tr><td><b>${n[0]}</b></td><td>${n[1]}</td><td class="muted">${n[2]}</td><td class="num mono">${nf(n[3])}</td><td>${pill(n[4], n[4] === 'Haute' ? 'bad' : 'warn')}</td><td>${f.inPlan[i] ? '<b class="small" style="color:var(--ok)">Au plan</b>' : btn('Intégrer au plan', 'fo-add', { sm: true, req: [6, 2], data: { i } })}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
      ${tab === 'plan' ? `<section class="card"><div class="tbox"><table><thead><tr><th>Action</th><th>Ministère</th><th>Modalité</th><th>Période</th><th class="num">Coût</th><th>Validation ministère</th></tr></thead><tbody>${idx.map(i => `<tr><td><b>${N[i][0]}</b></td><td>${N[i][1]}</td><td>${N[i][5]}</td><td>${N[i][6]}</td><td class="num mono">${N[i][7]} M FCFA</td><td>${f.valid[i] ? pill('Validé') : btn('Valider', 'fo-val', { sm: true, req: [6, 3], data: { i } })}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
      ${tab === 'follow' ? `<section class="card">${[['Gestion des urgences pédiatriques · session 1', 'Complexe pédiatrique de Bangui', 40, 37, 'délai de prise en charge −18 % (à mesurer)'], ['Rédaction administrative', 'ENAM', 60, 48, 'évaluation à chaud 4,2/5'], ['Gestion budgétaire axée sur les résultats', 'MFB', 35, 33, 'évaluation à froid à 6 mois'], ['Hygiène et sécurité au travail', 'Préfecture de l’Ouham', 50, 34, 'session de rattrapage programmée']].map(s => `<div class="row" style="border:1px solid var(--line2);border-radius:10px;padding:12px"><div style="flex:2 1 260px"><b>${s[0]}</b><div class="muted">${s[1]} · 2026</div></div><div style="flex:1 1 180px"><div class="row sb small"><span>Participation</span><span class="mono">${s[3]}/${s[2]} · ${Math.round(s[3] / s[2] * 100)} %</span></div><div class="bar" style="margin-top:6px"><i style="width:${s[3] / s[2] * 100}%"></i></div></div><div style="flex:1 1 200px" class="small"><b>Impact :</b> ${s[4]}</div></div>`).join('')}<span class="muted">Les formations suivies sont inscrites au dossier de l’agent et prises en compte pour la carrière.</span></section>` : ''}`;
    }
  });
  on('fo-add', d => { App.mod('formation', MOD.formation).inPlan[d.i] = true; log('Intégration d’un besoin au plan de formation', 'Besoin n° ' + (+d.i + 1)); });
  on('fo-val', d => { App.mod('formation', MOD.formation).valid[d.i] = true; log('Validation d’une action de formation', 'Action n° ' + (+d.i + 1)); toast('Action de formation validée par le ministère.'); });

  /* ================= PRÉSENCES ================= */
  MOD.presences = () => ({ g: ['PPPPPPPPPP', 'PPPPPCCCCC', 'PPAPPPPPAP', 'PPPPMMMPPP', 'PPPPPPPPPP', 'FFFPPPPPPP', 'PPPPPPAPPP'], leaves: [
    { name: 'ZANGA Irène', type: 'Congé annuel', period: 'du 02 au 13/11/2026 (10 j)', bal: '24 j', ch: 'application mobile' },
    { name: 'DOGO Félicité', type: 'Autorisation d’absence', period: '04/11/2026 (1 j)', bal: '—', ch: 'USSD' },
    { name: 'KOULOU Brice', type: 'Congé annuel', period: 'du 21/12/2026 au 04/01/2027 (15 j)', bal: '12 j', ch: 'portail web' }
  ], sent: false });
  const PC = { P: ['Présent', 'ok'], A: ['Absence non justifiée', 'bad'], J: ['Absence justifiée', 'n'], C: ['Congé', 'info'], M: ['Maladie', 'warn'], F: ['Formation', 'vio'] };
  const PO = ['P', 'A', 'J', 'C', 'M', 'F'];
  reg('presences', {
    title: 'Temps, présences et congés', menu: 'Temps et présences', crumb: 'Gestion des agents · Module 13', tag: 'P2', rows: [7],
    render() {
      const pr = App.mod('presences', MOD.presences);
      const days = ['lu 19', 'ma 20', 'me 21', 'je 22', 've 23', 'lu 26', 'ma 27', 'me 28', 'je 29', 've 30'];
      const A = [['NAMKOÏ Sylvie', 'Major de service'], ['YAKOMA Hervé', 'Infirmier d’État'], ['DOGO Félicité', 'Aide-soignante'], ['NGBALÉ Marcel', 'Infirmier d’État'], ['SAMBIA Rachel', 'Sage-femme'], ['KOULOU Brice', 'Technicien de laboratoire'], ['ZANGA Irène', 'Agent d’entretien']];
      const edit = can(7, 2);
      const unjust = pr.g.join('').split('').filter(c => c === 'A').length, pres = pr.g.join('').split('').filter(c => c === 'P').length;
      return `<div class="row sb"><div><div class="muted">Ministère de la Santé et de la Population · Hôpital régional de Bambari</div><b style="font-size:16px">Service de médecine générale · 19 au 30 octobre 2026</b></div><span class="row">${pill('Pointage biométrique · terminal BAM-01 synchronisé', 'ok')}${btn('Valider et transmettre à la paie', 'pr-pay', { p: true, req: [7, 2] })}</span></div>
      ${pr.sent ? note('Feuille transmise au module Paie (variables de novembre). Soldes de congés du portail agent mis à jour.', 'ok') : ''}
      <section class="card"><div class="row sb"><h2>Feuille de présence</h2><div class="row small" style="gap:10px">${PO.map(k => `<span class="row" style="gap:5px"><span class="pill ${PC[k][1]}">${k}</span>${PC[k][0]}</span>`).join('')}</div></div>
        <span class="muted">${edit ? 'Cliquez sur une case pour corriger un statut (ex. absence justifiée après dépôt d’un certificat). Chaque correction est tracée.' : 'Lecture seule pour votre profil.'}</span>
        <div class="tbox"><table><thead><tr><th style="min-width:170px">Agent</th>${days.map(d => `<th style="text-align:center">${d}</th>`).join('')}<th class="num">Présent</th><th class="num">Abs. non just.</th></tr></thead><tbody>
        ${A.map((a, i) => { const row = pr.g[i]; return `<tr><td><b>${a[0]}</b><div class="small muted">${a[1]}</div></td>${row.split('').map((c, j) => `<td style="text-align:center;padding:4px"><button type="button" class="pill ${PC[c][1]}" style="border:0;min-width:34px;min-height:30px;cursor:${edit ? 'pointer' : 'default'}" ${edit ? `data-a="pr-cycle" data-i="${i}" data-j="${j}"` : 'disabled'} aria-label="${esc(a[0] + ', ' + days[j] + ' : ' + PC[c][0])}">${c}</button></td>`).join('')}<td class="num mono">${row.split('').filter(c => c === 'P').length}</td><td class="num mono" style="color:var(--bad);font-weight:600">${row.split('').filter(c => c === 'A').length}</td></tr>`; }).join('')}
        </tbody></table></div>${note(unjust + ' jour(s) d’absence non justifiée : ' + (unjust ? 'retenue au prorata proposée sur la paie de novembre, après le délai de justification.' : 'aucune retenue.') + ' Taux de présence : ' + pct(pres, 70) + '.', 'n')}</section>
      <section class="card"><h2>Demandes de congé et d’absence à valider</h2>${pr.leaves.map((l, i) => `<div class="row sb" style="border:1px solid var(--line2);border-radius:10px;padding:12px"><div style="flex:1 1 280px"><b>${esc(l.name)} · ${esc(l.type)}</b>${l.portal ? ' ' + pill('reçue du portail', 'info') : ''}<div class="muted">${esc(l.period)} · solde : ${esc(l.bal)} · déposée via ${esc(l.ch)}</div></div>${l.r ? pill(l.r === 'ok' ? 'Approuvée' : 'Refusée') : `<span class="row" style="gap:8px">${btn('Approuver', 'pr-leave', { p: true, sm: true, req: [7, 2], data: { i, r: 'ok' } })}${btn('Refuser', 'pr-leave', { sm: true, danger: true, req: [7, 2], data: { i, r: 'no' } })}</span>`}</div>`).join('')}</section>`;
    }
  });
  on('pr-cycle', d => { const pr = App.mod('presences', MOD.presences), i = +d.i, j = +d.j, row = pr.g[i], c = row[j], nx = PO[(PO.indexOf(c) + 1) % PO.length]; pr.g[i] = row.slice(0, j) + nx + row.slice(j + 1); log('Correction de présence', 'Ligne ' + (i + 1) + ', jour ' + (j + 1) + ' : ' + c + ' → ' + nx); });
  on('pr-leave', d => {
    const pr = App.mod('presences', MOD.presences), l = pr.leaves[+d.i]; l.r = d.r;
    if (l.portal) { const po = App.mod('portail', MOD.portail); const rq = po.reqs.find(x => x.id === l.portal); if (rq) { rq.status = d.r === 'ok' ? 'Approuvée' : 'Refusée'; rq.steps = rq.steps.map((s, k) => ({ ...s, s: 1, w: k === rq.steps.length - 1 ? H.today() : s.w })); } }
    log(d.r === 'ok' ? 'Approbation de congé' : 'Refus de congé', l.name + ' · ' + l.period); toast(d.r === 'ok' ? 'Demande approuvée : l’agent est notifié par SMS.' : 'Demande refusée : motif demandé.');
  });
  on('pr-pay', () => { App.mod('presences', MOD.presences).sent = true; log('Transmission des présences à la paie', 'Service de médecine · Bambari'); toast('Feuille de présence transmise au module Paie.'); });

  /* ================= DISCIPLINE ================= */
  MOD.discipline = () => ({ list: [['DSC-2026-0031', '230-1187-C', 'Absences injustifiées répétées (23 jours en 2026)', 2], ['DSC-2026-0028', '104-3390-A', 'Perception de frais illicites auprès de parents d’élèves', 1], ['DSC-2026-0024', '211-2041-D', 'Manquement grave aux règles d’hygiène', 3], ['DSC-2026-0019', '097-0715-B', 'Retard répété dans le traitement des dossiers', 4]].map(x => ({ id: x[0], mat: x[1], fact: x[2], p: x[3], s: 1 })) });
  const DST = [['Rapport du supérieur', 'Constat des faits et pièces'], ['Demande d’explication écrite', 'Réponse de l’agent sous 8 jours'], ['Conseil de discipline', 'Audition et avis motivé'], ['Décision de l’autorité', 'Arrêté de sanction'], ['Notification et effets', 'Dossier, carrière et paie mis à jour']];
  const SAN = [['Avertissement', 'Inscrit au dossier, sans effet financier'], ['Blâme', 'Inscrit au dossier, retard possible à l’avancement'], ['Mise à pied temporaire', 'Retenue sur traitement pendant la durée'], ['Abaissement d’échelon', 'Réduction de l’indice'], ['Rétrogradation', 'Changement de grade et d’indice'], ['Révocation', 'Radiation des effectifs, arrêt de la solde']];
  reg('discipline', {
    title: 'Discipline et sanctions', menu: 'Discipline', crumb: 'Gestion des agents · Priorité P2', tag: 'P2', rows: [8],
    render() {
      const ds = App.mod('discipline', MOD.discipline);
      const sel = ds.list.find(x => x.id === ui('diSel', 'DSC-2026-0031')) || ds.list[0];
      const lab = x => x.p >= 5 ? pill('Clôturé') : pill(DST[x.p][0], 'info');
      const NX = ['Envoyer la demande d’explication', 'Enregistrer la réponse et saisir le conseil', 'Enregistrer l’avis du conseil', 'Signer la décision', 'Notifier l’agent et appliquer'];
      return `${note('Accès restreint : dossiers visibles uniquement par la DRH, l’autorité de nomination et le conseil de discipline. Chaque consultation est journalisée.', 'warn')}
      <div class="cols"><section class="card w3"><h2>Procédures en cours</h2><div class="tbox"><table><thead><tr><th>N° dossier</th><th>Agent</th><th>Faits reprochés</th><th>Étape</th><th></th></tr></thead><tbody>${ds.list.map(x => `<tr class="${x.id === sel.id ? 'sel' : ''}"><td class="mono">${x.id}</td><td class="mono">Agent ${x.mat}</td><td>${esc(x.fact)}</td><td>${lab(x)}</td><td>${x.id === sel.id ? '<b class="small" style="color:var(--accent)">Ouvert</b>' : btn('Ouvrir', 'tab', { sm: true, data: { k: 'diSel', v: x.id } })}</td></tr>`).join('')}</tbody></table></div>
        <h2>Échelle des sanctions (paramétrable)</h2><div class="fgrid">${SAN.map(([n, e]) => `<div style="border:1px solid var(--line2);border-radius:8px;padding:10px 12px"><b>${n}</b><div class="small muted">${e}</div></div>`).join('')}</div></section>
      <section class="card w2"><div class="mono muted">${sel.id}</div><h2 style="font-size:18px">Agent ${sel.mat}</h2><div class="muted">${esc(sel.fact)}</div>
        ${timeline(DST.map(([l, d], i) => ({ l, d, done: i < sel.p, cur: i === sel.p, mark: i + 1 })))}
        ${(sel.p === 2 || sel.p === 3) ? `<fieldset style="border:1px solid var(--line);border-radius:10px;padding:12px;margin:0"><legend class="small" style="font-weight:600;padding:0 4px">Sanction proposée</legend>${SAN.map(([n], i) => `<label class="row" style="gap:10px;min-height:34px"><input type="radio" name="san" ${i === sel.s ? 'checked' : ''} data-a="di-san" data-i="${i}"> ${n}</label>`).join('')}</fieldset>` : ''}
        ${sel.p < 5 ? btn(NX[sel.p], 'di-next', { p: true, req: [8, 3] }) + H.lockNote(8, 3) : note('Sanction « ' + SAN[sel.s][0] + ' » notifiée. Effet : ' + SAN[sel.s][1].toLowerCase() + '.', 'ok')}
        <span class="muted small">Droits de la défense : communication du dossier, délai de réponse de 8 jours, défenseur, recours hiérarchique et contentieux.</span></section></div>`;
    }
  });
  on('di-san', d => { const ds = App.mod('discipline', MOD.discipline); const sel = ds.list.find(x => x.id === ui('diSel', 'DSC-2026-0031')) || ds.list[0]; sel.s = +d.i; });
  on('di-next', () => { const ds = App.mod('discipline', MOD.discipline); const x = ds.list.find(y => y.id === ui('diSel', 'DSC-2026-0031')) || ds.list[0]; x.p++; log('Procédure disciplinaire · ' + (DST[x.p - 1] || ['Clôture'])[0], x.id); if (x.p >= 5) { const g = agentBy(x.mat); if (g) { addHist(g, 'Sanction : ' + SAN[x.s][0], x.id); if (x.s === 5) g.statut = 'Suspendu'; } toast('Sanction notifiée et inscrite au dossier.'); } });

  /* ================= RECRUTEMENT ================= */
  MOD.recrutement = () => ({ c: 'ens', integrated: false, cands: [['C26-ENS-00412', 'BÉKOÏ Maxime', 'Bangui', 'Licence de mathématiques', 27, 'Complètes', 92], ['C26-ENS-00988', 'GOUANDJIA Prisca', 'Bambari', 'Master de physique', 31, 'Complètes', 89], ['C26-ENS-01207', 'NDANGA Ulrich', 'Bouar', 'Licence de lettres modernes', 25, 'Complètes', 84], ['C26-ENS-01562', 'SÉRÉMALÉ Grâce', 'Berbérati', 'Licence d’histoire-géographie', 29, 'Casier manquant', 71], ['C26-ENS-02033', 'WANDA Jean-Luc', 'Bangui', 'Licence d’anglais', 36, 'Complètes', 68], ['C26-ENS-02741', 'KOMBO Nadège', 'Bossangoa', 'Baccalauréat série C', 23, 'Complètes', 41], ['C26-ENS-03455', 'YAMBÉRÉ Sandrine', 'Bria', 'Master de chimie', 28, 'Complètes', 87]].map(k => ({ id: k[0], name: k[1], city: k[2], dip: k[3], age: k[4], pieces: k[5], score: k[6], d: null })) });
  reg('recrutement', {
    title: 'Recrutement compétitif et concours', menu: 'Concours et sélection', crumb: 'Recrutement · Module 5', tag: 'P1', rows: [9],
    render() {
      const r = App.mod('recrutement', MOD.recrutement);
      const C = { ens: ['Concours d’enseignants du secondaire 2026', 'Candidatures ouvertes · présélection en cours', '400 postes · écrits le 01/12/2026', [5214 + r.cands.filter(c => c.web).length, 3880, 1420, 0, 0]], sante: ['Recrutement de personnels de santé', 'Candidatures ouvertes', '250 postes · clôture 30/11/2026', [1876, 0, 0, 0, 0]], adm: ['Concours d’administrateurs civils (ENAM)', 'Résultats publiés', '60 postes · intégration 01/01/2027', [3412, 2210, 640, 180, 60]] };
      const c = ui('reC', 'ens'), cur = C[c];
      const L = ['Candidatures', 'Recevables', 'Présélectionnés', 'Admissibles', 'Admis définitifs'];
      const nIn = r.cands.filter(x => x.d === 'in').length;
      return `<div class="fgrid">${Object.entries(C).map(([k, v]) => `<button type="button" data-a="tab" data-k="reC" data-v="${k}" aria-pressed="${k === c}" class="card" style="text-align:left;cursor:pointer;${k === c ? 'border:2px solid var(--accent);padding:17px' : ''}"><span class="small" style="font-weight:600;color:${k === c ? 'var(--accent)' : 'var(--muted)'}">${v[1]}</span><b style="font-size:15.5px">${v[0]}</b><span class="muted">${v[2]}</span></button>`).join('')}</div>
      <section class="card"><div class="row sb"><h2>Entonnoir de sélection · ${esc(cur[0])}</h2>${btn('Voir le portail public', 'nav', { sm: true, data: { r: 'offres' } })}</div><div class="kpis">${cur[3].map((n, i) => kpi(L[i], n ? nf(n) : '—', `<div class="bar" style="margin-top:6px"><i style="width:${n / cur[3][0] * 100}%;background:var(--${i === 4 ? 'ok' : 'accent'})"></i></div>`)).join('')}</div></section>
      ${c === 'ens' ? `<section class="card"><div class="row sb"><h2>Candidatures reçues en ligne (extrait)</h2><span class="muted">Présélection automatique : diplôme, âge, pièces, zone · validation humaine obligatoire</span></div>
        <div class="tbox"><table><thead><tr><th>N° dossier</th><th>Candidat</th><th>Diplôme</th><th>Âge</th><th>Pièces</th><th class="num">Score</th><th>Décision</th></tr></thead><tbody>
        ${r.cands.map((k, i) => `<tr><td class="mono">${k.id}</td><td><b>${esc(k.name)}</b>${k.web ? ' ' + pill('dépôt en ligne', 'info') : ''}<div class="small muted">${esc(k.city)}</div></td><td>${esc(k.dip)}</td><td>${k.age} ans</td><td>${pill(k.pieces, k.pieces === 'Complètes' ? 'ok' : 'warn')}</td><td class="num mono">${k.score}/100</td><td>${k.d ? pill(k.d === 'in' ? 'Retenu' : 'Écarté') : `<span class="row" style="gap:6px;flex-wrap:nowrap">${btn('Retenir', 're-dec', { sm: true, req: [9, 3], data: { i, d: 'in' } })}${btn('Écarter', 're-dec', { sm: true, danger: true, req: [9, 3], data: { i, d: 'out' } })}</span>`}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="row sb"><span class="muted">${nIn} candidat(s) retenu(s). Chaque décision est horodatée et signée électroniquement.</span>${r.integrated ? pill('Lauréats intégrés au fichier des agents', 'ok') : btn('Intégrer les lauréats retenus dans le fichier', 're-int', { p: true, req: [9, 3] })}</div>${H.lockNote(9, 3)}</section>` : ''}`;
    }
  });
  on('re-dec', d => { const r = App.mod('recrutement', MOD.recrutement), k = r.cands[+d.i]; k.d = d.d; log(d.d === 'in' ? 'Candidat retenu' : 'Candidat écarté', k.id + ' · ' + k.name); });
  on('re-int', () => {
    const r = App.mod('recrutement', MOD.recrutement); const ins = r.cands.filter(k => k.d === 'in');
    if (!ins.length) { toast('Retenez au moins un candidat avant l’intégration.'); return; }
    ins.forEach((k, i) => { const [nom, ...pr] = k.name.split(' '); const mat = '26' + (5 + i) + '-' + String(4100 + i).padStart(4, '0') + '-N'; S().agents.unshift({ mat, nom, prenom: pr.join(' '), sx: /a$|e$/.test(pr.join(' ')) ? 'F' : 'M', yob: 2026 - k.age, lieu: k.city, code: '02', sig: 'MEN', min: 'Éducation nationale', grade: 'Professeur de lycée, stagiaire', fonction: 'Enseignant', ville: k.city, indice: 850, statut: 'Stagiaire', entree: 2027, net: Math.round(850 * 310 * 1.32 * 0.8 / 100) * 100, canal: 'Mobile money', niu: 'CF-' + String(2026 - k.age).slice(2) + '-' + (300000 + i), hist: [{ date: H.today(), t: 'Recrutement sur concours (enseignants 2026)', ref: k.id }] }); });
    r.integrated = true; log('Intégration des lauréats', ins.length + ' agent(s) créé(s) · Éducation nationale'); toast(ins.length + ' lauréat(s) créé(s) dans le fichier des agents (statut Stagiaire). La prise en charge en paie suivra.');
  });

  /* ================= OFFRES (portail public) ================= */
  MOD.offres = () => ({ extra: [], view: 'list', sel: 0, step: 0, got: {}, last: null });
  const OFFERS = [['C26-ENS', 'Professeurs de lycée (mathématiques, physique, lettres)', 'Ministère d’État chargé de l’Éducation Nationale', 'Concours direct', 400, 'Toutes préfectures', 'Licence', 35, '15/11/2026', false, 'Enseigner dans les lycées publics et préparer les élèves aux examens nationaux.'], ['R26-SAN', 'Infirmiers et sages-femmes d’État', 'Ministère de la Santé et de la Population', 'Recrutement sur titre', 250, 'Préfectures prioritaires', 'Diplôme d’État', 40, '30/11/2026', false, 'Assurer les soins dans les hôpitaux et centres de santé, en priorité hors de Bangui.'], ['C26-ENAM', 'Administrateurs civils (cycle A)', 'Ministère de la Fonction Publique et de la Réforme Administrative', 'Concours direct', 60, 'Bangui (ENAM)', 'Master', 32, '20/11/2026', false, 'Après la formation à l’ENAM, encadrer les services de l’administration.'], ['C26-AGR', 'Techniciens d’agriculture et d’élevage', 'Ministère de l’Agriculture et du Développement Rural', 'Concours direct', 120, 'Directions régionales', 'BTS / DUT', 35, '05/12/2026', false, 'Appuyer les producteurs et suivre les campagnes agricoles.']];
  reg('offres', {
    title: 'Portail public des offres d’emploi', menu: 'Portail des offres (public)', crumb: 'Recrutement · Module 12', public: true, rows: [9],
    render(o) {
      const of = App.mod('offres', MOD.offres);
      const all = of.extra.concat(OFFERS);
      const q = ui('ofQ', '').trim().toLowerCase();
      const shown = all.map((x, i) => [x, i]).filter(([x]) => !q || (x[1] + ' ' + x[2]).toLowerCase().includes(q));
      const cur = all[of.sel] || all[0];
      let body;
      if (of.view === 'detail') body = `<div class="cols"><article class="card w3"><button type="button" class="btn ghost" style="align-self:flex-start" data-a="of-view" data-v="list">‹ Retour aux offres</button>${pill(cur[3] + ' · réf. ' + cur[0], 'info')}<h1 style="font-size:26px">${esc(cur[1])}</h1><div class="muted" style="font-size:15px">${esc(cur[2])} · ${esc(cur[5])}</div><h2>Missions</h2><p style="margin:0;line-height:1.65">${esc(cur[10])}</p><h2>Conditions</h2><ul style="margin:0;padding-left:20px;line-height:1.8"><li>Nationalité centrafricaine et jouissance des droits civiques</li><li>Diplôme exigé : ${esc(cur[6])}</li><li>Âge limite : ${cur[7]} ans</li><li>Casier judiciaire de moins de 3 mois</li></ul><div class="kpis">${kpi('Clôture', cur[8])}${kpi('Postes', nf(cur[4]))}${kpi('Prise de fonction', '01/2027')}</div></article>
        <aside class="card"><h2>Candidater en ligne</h2><p class="muted" style="margin:0">Gratuit, sans intermédiaire. Préparez une pièce d’identité, votre diplôme et votre casier judiciaire.</p><button type="button" class="btn p" style="min-height:46px" data-a="of-apply">Postuler</button>${note('Aucun paiement n’est demandé pour candidater. Signalez toute demande d’argent.', 'bad')}</aside></div>`;
      else if (of.view === 'apply') {
        const PI = ['Pièce d’identité', 'Diplôme exigé', 'Casier judiciaire', 'Photo d’identité'];
        body = `<section class="card" style="max-width:760px;width:100%;margin:0 auto"><div class="muted">${esc(cur[1])} · réf. ${cur[0]}</div><h1 style="font-size:22px">Dossier de candidature</h1>${steps(['Identité', 'Pièces justificatives', 'Vérification et envoi'], of.step)}
          ${of.step === 0 ? `<div class="fgrid">${input('of-n', 'Nom', 'ofN', ui('ofN', 'NGAÏKOSSÉ'))}${input('of-p', 'Prénom(s)', 'ofP', ui('ofP', 'Bérénice'))}${input('of-d', 'Date de naissance', 'ofD', ui('ofD', '1998-03-12'), { type: 'date' })}${input('of-t', 'Téléphone (SMS de suivi)', 'ofT', ui('ofT', '+236 72 00 00 00'))}${select('of-c', 'Centre d’examen', 'ofC', ui('ofC', 'Bangui'), ['Bangui', 'Bambari', 'Berbérati', 'Bouar'])}</div>` : ''}
          ${of.step === 1 ? `<div class="stack" style="gap:8px">${PI.map((p, i) => `<div class="row sb" style="border:1px solid var(--line);border-radius:10px;padding:12px">${p}${of.got[i] ? '<b class="small" style="color:var(--ok)">Ajouté ✓</b>' : `<button type="button" class="btn sm" data-a="of-got" data-i="${i}">Ajouter</button>`}</div>`).join('')}</div>` : ''}
          ${of.step === 2 ? note('Contrôle automatique : âge conforme, diplôme conforme, ' + (Object.keys(of.got).length === 4 ? 'dossier complet' : (4 - Object.keys(of.got).length) + ' pièce(s) manquante(s)') + '. En validant, vous certifiez l’exactitude des informations.', 'n') : ''}
          <div class="row sb"><button type="button" class="btn" data-a="of-prev">Retour</button><button type="button" class="btn p" data-a="of-next">${of.step === 2 ? 'Envoyer ma candidature' : 'Continuer'}</button></div></section>`;
      } else if (of.view === 'done') body = `<section class="card" style="max-width:760px;width:100%;margin:0 auto">${note('Candidature enregistrée · dossier n° ' + esc(of.last || 'C26-ENS-05215'), 'ok')}<h1 style="font-size:22px">Suivi de votre candidature</h1>${timeline([{ l: 'Dossier déposé', d: 'accusé de réception par SMS', done: true }, { l: 'Contrôle de recevabilité', d: 'automatique puis commission', cur: true, mark: 2 }, { l: 'Liste des candidats admis à concourir', d: 'publiée sur ce portail', mark: 3 }, { l: 'Épreuves', d: 'convocation par SMS', mark: 4 }, { l: 'Résultats définitifs', d: 'intégration dans le SIGRHE', mark: 5 }])}<p class="muted" style="margin:0">Le dossier apparaît immédiatement dans la liste de la commission (écran « Concours et sélection »).</p><button type="button" class="btn" data-a="of-view" data-v="list">Voir les autres offres</button></section>`;
      else body = `<section class="card">${input('of-q', 'Métier ou mot-clé', 'ofQ', ui('ofQ', ''), { type: 'search', ph: 'ex. infirmier, enseignant, comptable' })}<span class="muted">${shown.length} offre(s)</span></section><div class="offers">${shown.map(([x, i]) => `<article class="card"><div class="row sb">${pill(x[3], 'info')}<span class="small" style="color:var(--bad);font-weight:600">Clôture le ${x[8]}</span></div><h2 style="font-size:17px">${esc(x[1])}</h2><div class="muted">${esc(x[2])}</div><div class="row small muted"><span>${x[4]} poste(s)</span><span>${esc(x[5])}</span><span>${esc(x[6])}</span></div><button type="button" class="btn p" data-a="of-open" data-i="${i}">Voir l’offre</button></article>`).join('')}</div>`;
      if (!o.standalone) return note('Vue publique du portail, accessible sans connexion par tous les citoyens.', 'info') + body;
      return `<div class="pub"><header><div class="in row sb" style="padding-block:calc(16px + env(safe-area-inset-top,0px)) 16px">${'<div class="row" style="gap:14px">' + H.LOGO(48) + '<div><b style="font-size:17px">Emplois publics de Centrafrique</b><div class="small" style="color:var(--navy-muted)">Concours, recrutements et postes vacants de l’État</div></div></div>'}<span class="row"><span class="demo-tag">Démonstration · données fictives</span><button type="button" class="btn sm" data-a="of-view" data-v="list">Toutes les offres</button><button type="button" class="btn sm p" data-a="nav" data-r="login">Espace agents de l’État</button></span></div></header><main class="in stack" style="padding-block:24px 56px;gap:18px">${body}</main></div>`;
    }
  });
  on('of-open', d => { const of = App.mod('offres', MOD.offres); of.sel = +d.i; of.view = 'detail'; });
  on('of-view', d => { App.mod('offres', MOD.offres).view = d.v; });
  on('of-apply', () => { const of = App.mod('offres', MOD.offres); of.view = 'apply'; of.step = 0; of.got = {}; });
  on('of-got', d => { App.mod('offres', MOD.offres).got[d.i] = true; });
  on('of-prev', () => { const of = App.mod('offres', MOD.offres); if (of.step === 0) of.view = 'detail'; else of.step--; });
  on('of-next', () => {
    const of = App.mod('offres', MOD.offres);
    if (of.step < 2) { of.step++; return; }
    const r = App.mod('recrutement', MOD.recrutement); const id = 'C26-ENS-0' + (5215 + r.cands.length);
    const age = 2026 - Number(String(ui('ofD', '1998-03-12')).slice(0, 4));
    r.cands.push({ id, name: (ui('ofN', 'NGAÏKOSSÉ') + ' ' + ui('ofP', 'Bérénice')).trim(), city: ui('ofC', 'Bangui'), dip: 'Licence (déclarée)', age, pieces: Object.keys(of.got).length === 4 ? 'Complètes' : 'Incomplètes', score: Object.keys(of.got).length === 4 ? 80 : 55, d: null, web: true });
    of.last = id; of.view = 'done'; App.S.audit.unshift({ t: H.now(), u: 'portail public', a: 'Dépôt de candidature en ligne', o: id });
  });
})();
