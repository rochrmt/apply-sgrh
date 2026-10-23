/* SIGRHE · Module 3 : registre unique et fiche électronique de l'agent */
window.MOD = window.MOD || {};
(function () {
  const { reg, on, ui, log, toast, can, go } = App;
  const H = App.h;
  const { esc, nf, kpi, btn, pill, utabs, note, timeline } = H;
  const S = () => App.S;
  const hh = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const pad = n => String(n).padStart(2, '0');
  const agentBy = mat => S().agents.find(a => a.mat === mat);
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const PF = ['Grâce', 'Esther', 'Rachel', 'Ornella', 'Sandrine', 'Bénédicte', 'Merveille', 'Chancelle', 'Prisca', 'Nadège'];
  const PM = ['Junior', 'Emmanuel', 'Fidèle', 'Rodrigue', 'Ghislain', 'Christian', 'Dieudonné', 'Prince', 'Josué', 'Évrard'];
  const NOMS = ['NGUÉRÉ', 'YAKOMA', 'SÉLÉMBI', 'DOKO', 'MBAÏKOUA', 'KOYANGBO', 'NAMSÉNÉ', 'ZANGA', 'FEÏGOUDOU', 'GBANDA'];
  const QB = ['Boy-Rabe', 'Lakouanga', 'Gobongo', 'Fatima', 'Galabadja', 'Combattant', 'Sica 1', 'Miskine', 'Ouango', 'Benz-Vi'];
  const VILLES = ['Bambari', 'Berbérati', 'Bouar', 'Bossangoa', 'Bria', 'Kaga-Bandoro', 'Mbaïki', 'Bangassou', 'Sibut', 'Nola', 'Paoua', 'Bozoum'];

  /* Fiche générée une seule fois puis conservée (les modifications validées y sont appliquées) */
  MOD.fiche = a => {
    if (a.fiche) return a.fiche;
    const h = hh(a.mat), age = 2026 - a.yob, nE = h % 7;
    const d = 1 + h % 28, m = 1 + (h >>> 3) % 12;
    const sit = age < 26 && nE === 0 ? 'Célibataire' : (h >>> 5) % 11 === 0 ? 'Veuf / veuve' : (h >>> 5) % 9 === 0 ? 'Divorcé(e)' : nE || (h >>> 4) % 3 ? 'Marié(e)' : 'Célibataire';
    const enf = [];
    for (let i = 0; i < nE; i++) { const hx = hh(a.mat + i), y = Math.min(2025, Math.max(a.yob + 20, 2006) + ((hx % 19) + i * 2) % 19), sx = hx % 2 ? 'F' : 'M'; enf.push({ prenom: (sx === 'F' ? PF : PM)[hx % 10], sx, ne: pad(1 + hx % 28) + '/' + pad(1 + (hx >>> 2) % 12) + '/' + y, charge: true, acte: 'Acte n° ' + (1000 + hx % 8999) + '/' + y }); }
    if (age > 52) { const hx = hh(a.mat + 'x'); enf.unshift({ prenom: PF[hx % 10], sx: 'F', ne: pad(1 + hx % 28) + '/' + pad(1 + hx % 12) + '/' + (a.yob + 22), charge: false, acte: 'Acte n° ' + (1000 + hx % 8999) + '/' + (a.yob + 22) }); }
    const conj = sit === 'Marié(e)' ? { nom: NOMS[h % 10] + ' ' + (a.sx === 'F' ? PM : PF)[(h >>> 2) % 10], ne: (a.yob + (a.sx === 'F' ? -3 : 4)), mariage: pad(1 + (h >>> 6) % 28) + '/' + pad(1 + (h >>> 7) % 12) + '/' + Math.min(2024, a.yob + 26 + h % 5), agentPublic: (h >>> 8) % 4 === 0, prof: ['Commerçant(e)', 'Enseignant(e)', 'Sans profession', 'Infirmier(ère)', 'Agent du secteur privé'][(h >>> 3) % 5] } : null;
    // parcours d'affectations
    const aff = [];
    const v1 = a.ville === 'Bangui' ? VILLES[h % VILLES.length] : 'Bangui';
    const y1 = a.entree, y2 = Math.min(2024, a.entree + 4 + h % 6);
    aff.push({ du: '01/' + pad(1 + h % 9) + '/' + y1, au: a.entree + 2026 - y2 > 2 && y2 > y1 ? '31/12/' + (y2 - 1) : null, lieu: v1, struct: (a.sig || '') + ' · service déconcentré de ' + v1, fonction: a.grade.split(',')[0], acte: 'Arrêté n° ' + (100 + h % 800) + '/' + (a.sig || 'MFP') + '/' + String(y1).slice(2) });
    if (y2 > y1) aff.push({ du: '01/01/' + y2, au: null, lieu: a.ville, struct: (a.sig || '') + ' · ' + (a.ville === 'Bangui' ? 'administration centrale' : 'direction régionale de ' + a.ville), fonction: a.fonction, acte: 'Note de mutation n° ' + (10 + h % 90) + '/' + (a.sig || 'MFP') + '/' + String(y2).slice(2) });
    else aff[0].lieu = a.ville;
    aff.reverse();
    a.fiche = {
      naissance: pad(d) + '/' + pad(m) + '/' + a.yob, nationalite: 'Centrafricaine',
      cni: 'CNI ' + String(h % 1000000000).padStart(9, '0'), cniExp: pad(d) + '/' + pad(m) + '/' + (2027 + h % 5),
      pere: NOMS[(h >>> 1) % 10].charAt(0) + NOMS[(h >>> 1) % 10].slice(1).toLowerCase() + ' ' + a.nom, mere: PF[(h >>> 4) % 10] + ' ' + NOMS[(h >>> 2) % 10],
      adresse: a.ville === 'Bangui' ? 'Quartier ' + QB[h % 10] + ', ' + (1 + h % 8) + 'e arrondissement, Bangui' : 'Quartier administratif, ' + a.ville,
      tel: '+236 7' + (h % 3 + 2) + ' ' + pad(h % 100) + ' ' + pad((h >>> 3) % 100) + ' ' + pad((h >>> 5) % 100), mail: (a.prenom.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '.' + a.nom.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')) + '@gouv.cf',
      urgence: (conj ? conj.nom + ' (conjoint)' : NOMS[(h >>> 3) % 10] + ' ' + PM[h % 10] + ' (frère)') + ' · +236 75 ' + pad(h % 97) + ' ' + pad((h >>> 2) % 97) + ' ' + pad((h >>> 4) % 97),
      sit, conj, enf, aff,
      diplome: ['Baccalauréat', 'Licence', 'Master', 'Doctorat', 'BEPC', 'Diplôme d’école professionnelle'][h % 6],
      cnss: 'PEN-' + String(h % 10000000).padStart(7, '0'),
      maj: '15/' + pad(1 + h % 9) + '/2026'
    };
    return a.fiche;
  };
  MOD.enfantsACharge = a => MOD.fiche(a).enf.filter(e => e.charge).length;

  /* Historique administratif consolidé */
  function histo(a, F) {
    const E = [];
    E.push({ y: a.entree, d: F.aff[F.aff.length - 1].du, t: 'Recrutement', l: 'Recrutement et prise en charge', r: 'Arrêté de recrutement n° ' + (200 + hh(a.mat) % 700) + '/MFP/' + String(a.entree).slice(2) });
    E.push({ y: a.entree + 1, d: '01/01/' + (a.entree + 1), t: 'Carrière', l: 'Titularisation', r: 'Arrêté n° ' + (300 + hh(a.mat) % 600) + '/MFP/' + String(a.entree + 1).slice(2) });
    for (let y = a.entree + 3; y <= 2025; y += 3) E.push({ y, d: '01/01/' + y, t: 'Carrière', l: 'Avancement d’échelon', r: 'Arrêté collectif n° ' + (y % 97 + 10) + '/MFP/' + String(y).slice(2) });
    F.aff.slice(0, -1).forEach(x => E.push({ y: +x.du.slice(-4), d: x.du, t: 'Affectation', l: 'Mutation à ' + x.lieu + ' · ' + x.fonction, r: x.acte }));
    if (F.conj) E.push({ y: +F.conj.mariage.slice(-4), d: F.conj.mariage, t: 'Famille', l: 'Mariage (mise à jour de la situation de famille)', r: 'Acte de mariage' });
    F.enf.forEach(e => E.push({ y: +e.ne.slice(-4), d: e.ne, t: 'Famille', l: 'Naissance de ' + e.prenom, r: e.acte }));
    for (let y = Math.max(a.entree + 1, 2019); y <= 2025; y += 2) E.push({ y, d: '31/12/' + y, t: 'Évaluation', l: 'Notation annuelle : ' + (14 + hh(a.mat + y) % 5) + '/20', r: 'Fiche de notation ' + y });
    if (a.statut === 'Détachement') E.push({ y: 2024, d: '01/09/2024', t: 'Position', l: 'Mise en détachement', r: 'Arrêté n° 77/MFP/24' });
    (a.hist || []).forEach(x => E.push({ y: +x.date.slice(-4), d: x.date, t: 'Mouvement', l: x.t, r: x.ref, live: true }));
    const key = s => { const [dd, mm, yy] = s.split('/'); return yy + mm + dd; };
    return E.filter(e => e.d && e.d.length === 10).sort((x, y) => key(y.d).localeCompare(key(x.d)));
  }

  function completude(a, F) {
    const C = [['État civil rapproché (NIU)', a.niu !== 'Non rapproché'], ['Pièce d’identité valide', +F.cniExp.slice(-4) >= 2026], ['Adresse et téléphone', !!F.tel], ['Situation de famille justifiée', true], ['Acte de recrutement numérisé', true], ['Dernier acte d’avancement numérisé', hh(a.mat) % 4 !== 0], ['Diplôme vérifié', hh(a.mat) % 5 !== 0], ['Personne à prévenir', !!F.urgence]];
    return { C, p: Math.round(C.filter(c => c[1]).length / C.length * 100) };
  }

  MOD.fiches = () => ({ req: [] });
  const TYPES = { naissance: 'Naissance d’un enfant', mariage: 'Mariage', divorce: 'Divorce', deces: 'Décès du conjoint', majorite: 'Enfant n’étant plus à charge', adresse: 'Changement d’adresse ou de téléphone' };

  reg('fiche', {
    title: 'Fiche électronique de l’agent', menu: 'Fiches électroniques', crumb: 'Gestion des agents · Module 3 · registre unique', rows: [2],
    render() {
      const all = App.visibleAgents();
      const a = agentBy(ui('agSel', all[0] && all[0].mat)) && all.find(z => z.mat === ui('agSel')) || all[0];
      if (!a) return note('Aucun agent dans votre périmètre.', 'info');
      const F = MOD.fiche(a), cp = completude(a, F), tab = ui('fiT', 'syn'), fs = App.mod('fiches', MOD.fiches);
      const pend = fs.req.filter(r => r.mat === a.mat && r.state === 'En attente');
      const q = (ui('fiQ', '') || '').toLowerCase();
      const res = q.length >= 2 ? all.filter(z => (z.mat + ' ' + z.nom + ' ' + z.prenom + ' ' + z.niu).toLowerCase().includes(q)).slice(0, 8) : [];
      const dl = rows => `<dl class="dl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
      const age = 2026 - a.yob, aCh = F.enf.filter(e => e.charge).length;
      let body = '';
      if (tab === 'syn') body = `<div class="cols"><section class="card w2"><h2>Identifiants uniques</h2>${dl([['Matricule', `<span class="mono">${a.mat}</span>`], ['Identifiant national (NIU)', `<span class="mono">${esc(a.niu)}</span> ${a.niu === 'Non rapproché' ? pill('À rapprocher', 'warn') : pill('Rapproché état civil', 'ok')}`], ['N° d’affiliation pension / CNSS', `<span class="mono">${F.cnss}</span>`], ['Poste budgétaire', `<span class="mono">PB-${a.code}-${a.mat.replace(/\D/g, '').slice(3, 7)}</span>`]])}
          <h2>Situation actuelle</h2>${dl([['Ministère', esc(a.code + ' · ' + a.min)], ['Affectation', esc(F.aff[0].struct)], ['Lieu', esc(a.ville)], ['Grade · indice', esc(a.grade + ' · ' + a.indice)], ['Fonction', esc(a.fonction)], ['Position', pill(a.statut)], ['Ancienneté', (2026 - a.entree) + ' ans (depuis ' + a.entree + ')'], ['Situation de famille', esc(F.sit) + ' · ' + aCh + ' enfant(s) à charge']])}</section>
          <section class="card"><h2>Complétude du dossier</h2><div class="row" style="gap:12px"><b style="font-size:30px">${cp.p} %</b><div style="flex:1;height:10px;border-radius:5px;background:var(--line2)"><div style="height:10px;border-radius:5px;width:${cp.p}%;background:var(--${cp.p >= 85 ? 'ok' : 'warn-bar'})"></div></div></div>
          ${cp.C.map(([l, ok]) => `<div class="row small" style="gap:8px">${ok ? pill('OK', 'ok') : pill('Manquant', 'warn')}${l}</div>`).join('')}
          <span class="small muted">Dernière mise à jour : ${F.maj}</span></section></div>`;
      if (tab === 'ec') body = `<section class="card"><div class="row sb"><h2>État civil</h2>${a.niu === 'Non rapproché' ? (can(2, 2) ? btn('Rapprocher avec le registre d’état civil', 'ag-niu', { sm: true, data: { m: a.mat } }) : pill('Non rapproché', 'warn')) : pill('Source : registre national d’état civil', 'ok')}</div>
          ${dl([['Nom', '<b>' + esc(a.nom) + '</b>'], ['Prénom(s)', esc(a.prenom)], ['Sexe', a.sx === 'F' ? 'Féminin' : 'Masculin'], ['Date et lieu de naissance', F.naissance + ' à ' + esc(a.lieu) + ' (' + age + ' ans)'], ['Nationalité', F.nationalite], ['Filiation', 'Père : ' + esc(F.pere) + '<br>Mère : ' + esc(F.mere)], ['Pièce d’identité', `<span class="mono">${F.cni}</span> · expire le ${F.cniExp}`], ['Diplôme le plus élevé', esc(F.diplome)]])}</section>
          <section class="card"><div class="row sb"><h2>Coordonnées</h2>${can(2, 2) ? btn('Signaler un changement', 'tab', { sm: true, data: { k: 'fiNew', v: 'adresse' } }) : ''}</div>${dl([['Adresse', esc(F.adresse)], ['Téléphone', `<span class="mono">${F.tel}</span>`], ['Courriel professionnel', `<span class="mono">${esc(F.mail)}</span>`], ['Personne à prévenir', esc(F.urgence)]])}</section>`;
      if (tab === 'fam') body = `<section class="card"><div class="row sb"><h2>Situation de famille</h2>${pill(F.sit, 'info')}</div>
          ${F.conj ? dl([['Conjoint(e)', '<b>' + esc(F.conj.nom) + '</b>'], ['Année de naissance', F.conj.ne], ['Date du mariage', F.conj.mariage], ['Profession', esc(F.conj.prof)], ['Agent public', F.conj.agentPublic ? 'Oui : allocations versées à un seul des deux conjoints' : 'Non']]) : '<p class="muted" style="margin:0">Aucun conjoint déclaré.</p>'}
          <h2>Enfants (${F.enf.length}, dont ${aCh} à charge)</h2>
          <div class="tbox"><table><thead><tr><th>Prénom</th><th>Sexe</th><th>Date de naissance</th><th>Âge</th><th>Pièce</th><th>À charge</th></tr></thead><tbody>${F.enf.map(e => `<tr><td><b>${esc(e.prenom)}</b> ${esc(a.nom)}</td><td>${e.sx}</td><td>${e.ne}</td><td>${2026 - +e.ne.slice(-4)} ans</td><td class="small muted">${esc(e.acte)}</td><td>${e.charge ? pill('Oui', 'ok') : pill('Non', 'n')}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucun enfant déclaré.</td></tr>'}</tbody></table></div>
          ${note('Impact sur la paie : ' + aCh + ' enfant(s) à charge × allocations familiales (moteur de calcul, rubrique 1500). Toute modification validée est prise en compte dans la campagne suivante.', 'info')}</section>`;
      if (tab === 'aff') body = `<section class="card"><h2>Parcours d’affectations</h2><div class="tbox"><table><thead><tr><th>Période</th><th>Structure</th><th>Lieu</th><th>Fonction</th><th>Acte</th></tr></thead><tbody>${F.aff.map((x, i) => `<tr${i === 0 ? ' class="sel"' : ''}><td class="small">${x.du} → ${x.au || '<b>en cours</b>'}</td><td>${esc(x.struct)}</td><td>${esc(x.lieu)}</td><td>${esc(x.fonction)}</td><td class="small muted">${esc(x.acte)}</td></tr>`).join('')}</tbody></table></div>
          ${App.canSee('carriere') ? `<div>${btn('Proposer une mutation', 'ag-acte', { sm: true, req: [3, 2], data: { m: a.mat } })}</div>` : ''}</section>`;
      if (tab === 'his') { const E = histo(a, F), tf = ui('fiH', 'all'); const T = [...new Set(E.map(e => e.t))]; body = `<section class="card"><div class="row sb"><h2>Historique administratif</h2><span class="muted">${E.length} événements depuis ${a.entree}</span></div>${H.chips('fiH', [['all', 'Tous']].concat(T.map(t => [t, t])), tf, 'Type')}
          <div class="tbox"><table><thead><tr><th>Date</th><th>Type</th><th>Événement</th><th>Acte de référence</th></tr></thead><tbody>${E.filter(e => tf === 'all' || e.t === tf).map(e => `<tr><td class="mono small">${e.d}</td><td>${pill(e.t, e.live ? 'info' : 'n')}</td><td>${esc(e.l)}</td><td class="small muted">${esc(e.r)}</td></tr>`).join('')}</tbody></table></div></section>`; }
      if (tab === 'doc') body = MOD.agentDocs(a);
      if (tab === 'trace') { const L = S().audit.filter(x => String(x.o || '').includes(a.mat) || String(x.a || '').includes(a.mat)); body = `<section class="card"><h2>Traçabilité des modifications</h2><p class="muted" style="margin:0">Toute consultation sensible et toute modification de la fiche sont journalisées (auteur, date, valeur).</p><div class="tbox"><table><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détail</th></tr></thead><tbody>${L.map(x => `<tr><td class="mono small">${x.t}</td><td class="mono small">${esc(x.u)}</td><td>${esc(x.a)}</td><td class="small muted">${esc(x.o)}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">Aucune modification depuis la reprise des données (${F.maj}).</td></tr>`}</tbody></table></div></section>`; }

      // formulaire de déclaration
      const nt = ui('fiNew', '');
      const form = !nt ? '' : `<section class="card" style="border:2px solid var(--accent)"><div class="row sb"><h2>Déclarer : ${TYPES[nt]}</h2>${btn('Annuler', 'tab', { sm: true, data: { k: 'fiNew', v: '' } })}</div>
        <div class="fgrid">${nt === 'naissance' ? H.input('fi-p', 'Prénom de l’enfant', 'fiP', ui('fiP', 'Dieu-Merci')) + H.input('fi-d', 'Date de naissance', 'fiD', ui('fiD', '12/10/2026')) + H.select('fi-s', 'Sexe', 'fiS', ui('fiS', 'M'), [['M', 'Masculin'], ['F', 'Féminin']]) : ''}
        ${nt === 'mariage' ? H.input('fi-c', 'Nom et prénom du conjoint', 'fiC', ui('fiC', 'MBOLI Clarisse')) + H.input('fi-d', 'Date du mariage', 'fiD', ui('fiD', '04/10/2026')) : ''}
        ${nt === 'divorce' || nt === 'deces' ? H.input('fi-d', 'Date de l’événement', 'fiD', ui('fiD', '01/10/2026')) : ''}
        ${nt === 'majorite' ? H.select('fi-e', 'Enfant concerné', 'fiE', ui('fiE', '0'), F.enf.map((e, i) => [String(i), e.prenom + ' (' + e.ne + ')']).filter((x, i) => F.enf[i].charge)) : ''}
        ${nt === 'adresse' ? H.input('fi-a', 'Nouvelle adresse', 'fiA', ui('fiA', F.adresse)) + H.input('fi-t', 'Téléphone', 'fiT2', ui('fiT2', F.tel)) : ''}
        ${H.select('fi-j', 'Pièce justificative', 'fiJ', ui('fiJ', 'Numérisée et versée à la GED'), ['Numérisée et versée à la GED', 'Transmise au format papier'])}</div>
        <div class="row">${btn('Soumettre pour validation', 'fi-submit', { p: true, req: [2, 2], data: { m: a.mat, t: nt } })}<span class="small muted">Les changements d’état civil et de famille sont validés par la DRH avant d’être appliqués (et pris en compte par la paie).</span></div></section>`;

      return `<div class="row sb" style="gap:12px"><a href="#agents" data-a="nav" data-r="agents">‹ Registre des agents</a>
          <label class="field" for="fiq" style="min-width:280px;flex:0 1 380px">Ouvrir une autre fiche (nom, matricule, NIU)<input id="fiq" data-bind="fiQ" value="${esc(ui('fiQ', ''))}" placeholder="2 caractères au moins"></label></div>
        ${res.length ? `<div class="card" style="gap:2px;padding:8px">${res.map(z => `<button type="button" data-a="fi-open" data-m="${z.mat}" style="text-align:left;border:0;background:transparent;color:var(--fg);padding:8px;border-radius:6px;cursor:pointer"><b>${esc(z.nom + ' ' + z.prenom)}</b> <span class="mono small muted">${z.mat} · ${esc(z.niu)}</span></button>`).join('')}</div>` : ''}
        <section class="card"><div class="row" style="gap:16px;flex-wrap:wrap"><span class="av" style="width:64px;height:64px;font-size:22px" aria-hidden="true">${esc(a.nom[0] + a.prenom[0])}</span>
          <div style="flex:1;min-width:220px"><b style="font-size:20px">${esc(a.nom)} ${esc(a.prenom)}</b><div class="mono muted">${a.mat} · NIU ${esc(a.niu)}</div><div class="small muted">${esc(a.grade)} · ${esc(a.fonction)} · ${esc(a.ville)}</div></div>
          <div class="row" style="gap:8px">${pill(a.statut)}${pill('Dossier complet à ' + cp.p + ' %', cp.p >= 85 ? 'ok' : 'warn')}${pend.length ? pill(pend.length + ' modification(s) en attente', 'warn') : ''}</div></div>
          ${can(2, 2) ? `<div class="row" style="gap:6px"><span class="small muted">Déclarer un événement :</span>${Object.entries(TYPES).map(([k, l]) => `<button type="button" class="btn sm" data-a="tab" data-k="fiNew" data-v="${k}">${l}</button>`).join('')}</div>` : ''}</section>
        ${form}
        ${pend.length || fs.req.some(r => r.mat === a.mat) ? `<section class="card"><h2>Demandes de modification</h2><div class="tbox"><table><thead><tr><th>N°</th><th>Objet</th><th>Déposée par</th><th>État</th><th></th></tr></thead><tbody>${fs.req.filter(r => r.mat === a.mat).map(r => `<tr><td class="mono small">${r.id}</td><td>${esc(r.desc)}</td><td class="small">${esc(r.by)} · ${r.date}</td><td>${pill(r.state, r.state === 'Validée' ? 'ok' : r.state === 'Rejetée' ? 'bad' : 'warn')}</td><td>${r.state === 'En attente' ? `<span class="row" style="gap:6px;flex-wrap:nowrap">${btn('Valider', 'fi-val', { sm: true, p: true, req: [2, 3], data: { id: r.id } })}${btn('Rejeter', 'fi-rej', { sm: true, danger: true, req: [2, 3], data: { id: r.id } })}</span>` : ''}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
        ${utabs('fiT', [['syn', 'Synthèse'], ['ec', 'État civil et coordonnées'], ['fam', 'Situation de famille'], ['aff', 'Affectations'], ['his', 'Historique administratif'], ['doc', 'Pièces du dossier (' + MOD.uplFiles('agent:' + a.mat).length + ')'], ['trace', 'Traçabilité']], tab, 'Fiche électronique')}
        ${body}`;
    }
  });

  on('fi-go', d => { App.setUi('agSel', d.m); App.setUi('fiT', d.t || 'syn'); App.go('fiche'); log('Consultation de la fiche électronique', d.m); });
  on('fi-open', d => { App.setUi('agSel', d.m); App.setUi('fiQ', ''); App.setUi('fiNew', ''); log('Consultation de la fiche électronique', d.m); });
  on('fi-submit', d => {
    const fs = App.mod('fiches', MOD.fiches), a = agentBy(d.m), F = MOD.fiche(a), t = d.t;
    const p = { naissance: { prenom: ui('fiP', 'Dieu-Merci'), ne: ui('fiD', '12/10/2026'), sx: ui('fiS', 'M') }, mariage: { nom: ui('fiC', 'MBOLI Clarisse'), date: ui('fiD', '04/10/2026') }, divorce: { date: ui('fiD', '01/10/2026') }, deces: { date: ui('fiD', '01/10/2026') }, majorite: { i: +ui('fiE', String(F.enf.findIndex(e => e.charge))) }, adresse: { adresse: ui('fiA', F.adresse), tel: ui('fiT2', F.tel) } }[t];
    const desc = TYPES[t] + (t === 'naissance' ? ' : ' + p.prenom + ' né(e) le ' + p.ne : t === 'mariage' ? ' avec ' + p.nom + ' le ' + p.date : t === 'majorite' ? ' : ' + (F.enf[p.i] || {}).prenom : t === 'adresse' ? ' : ' + p.adresse : ' le ' + p.date);
    const id = 'MAJ-2026-' + String(410 + fs.req.length).padStart(4, '0');
    fs.req.unshift({ id, mat: a.mat, t, p, desc, by: S().user.login, date: H.today(), state: 'En attente' });
    App.setUi('fiNew', '');
    log('Demande de modification de fiche ' + id, a.mat + ' · ' + desc);
    toast('Demande ' + id + ' transmise à la DRH pour validation.');
  });
  on('fi-val', d => {
    const fs = App.mod('fiches', MOD.fiches), r = fs.req.find(x => x.id === d.id), a = agentBy(r.mat), F = MOD.fiche(a), p = r.p;
    const before = MOD.payCalc ? MOD.payCalc(a).netCalc : 0;
    if (r.t === 'naissance') F.enf.push({ prenom: p.prenom, sx: p.sx, ne: p.ne, charge: true, acte: 'Acte versé à la GED' });
    if (r.t === 'mariage') { F.sit = 'Marié(e)'; F.conj = { nom: p.nom, ne: '—', mariage: p.date, agentPublic: false, prof: '[à compléter]' }; }
    if (r.t === 'divorce') { F.sit = 'Divorcé(e)'; F.conj = null; }
    if (r.t === 'deces') { F.sit = 'Veuf / veuve'; F.conj = null; }
    if (r.t === 'majorite' && F.enf[p.i]) F.enf[p.i].charge = false;
    if (r.t === 'adresse') { F.adresse = p.adresse; F.tel = p.tel; }
    F.maj = H.today(); r.state = 'Validée';
    a.hist = a.hist || []; a.hist.unshift({ date: H.today(), t: 'Mise à jour de la fiche : ' + r.desc, ref: r.id });
    const after = MOD.payCalc ? MOD.payCalc(a).netCalc : 0;
    if (MOD.payCalc && a.net) a.net = MOD.payCalc(a).net;
    log('Validation de la modification ' + r.id, a.mat + ' · ' + r.desc + (after !== before ? ' · net ' + nf(before) + ' → ' + nf(after) : ''));
    toast('Fiche mise à jour.' + (after !== before ? ' Net mensuel recalculé : ' + nf(before) + ' → ' + nf(after) + ' FCFA.' : ''));
  });
  on('fi-rej', d => { const r = App.mod('fiches', MOD.fiches).req.find(x => x.id === d.id); r.state = 'Rejetée'; log('Rejet de la modification ' + r.id, r.mat + ' · pièce justificative insuffisante'); });
})();
