/* SIGRHE · écrans : architecture cible, systèmes existants, calendrier d'intégration, portail développeur des API */
window.MOD = window.MOD || {};
(function () {
  const { reg, on, ui, log, toast, lvl } = App;
  const H = App.h;
  const { esc, nf, kpi, btn, pill, seg, utabs, select, input, note } = H;
  const S = () => App.S;

  /* ---------- Référentiel des systèmes externes ---------- */
  const SYS = [
    { k: 'simba', n: 'SIM-BA', full: 'Système d’Information de Gestion Financière de l’État', side: 'r', y: 70, flows: ['Paie', 'Pensions'], dir: 'SIGRHE → SIM-BA (engagement, liquidation, ordonnancement) ; SIM-BA → SIGRHE (statut de paiement, crédits de personnel)', proto: 'API REST via passerelle + fichier XML signé (lot mensuel)', fmt: 'JSON, XML', freq: 'Temps réel (crédits) · mensuel (paie)', ctrl: 'mTLS, jeton OAuth2 client, signature XML, rapprochement des montants', m: 'M6' },
    { k: 'systac', n: 'SYSTAC / banques', full: 'Télécompensation BEAC et 9 banques', side: 'r', y: 140, flows: ['Paie'], dir: 'SIGRHE → banques (ordres de virement) ; banques → SIGRHE (rejets, oppositions)', proto: 'Échange de fichiers sécurisé (SFTP) + API', fmt: 'XML ISO 20022, CSV', freq: 'Mensuel + rejets quotidiens', ctrl: 'Chiffrement, accusés de réception, contrôle des RIB', m: 'M4' },
    { k: 'momo', n: 'Mobile money', full: 'Opérateurs agréés de paiement mobile', side: 'r', y: 210, flows: ['Paie'], dir: 'SIGRHE → opérateurs (paiements) ; opérateurs → SIGRHE (confirmations)', proto: 'API REST des opérateurs via la passerelle', fmt: 'JSON', freq: 'Mensuel + confirmations en temps réel', ctrl: 'OAuth2, vérification du titulaire du wallet, plafonds', m: 'M5' },
    { k: 'cnss', n: 'CNSS', full: 'Caisse nationale de sécurité sociale', side: 'r', y: 280, flows: ['Paie', 'Pensions'], dir: 'SIGRHE → CNSS (déclarations, cotisations) ; CNSS → SIGRHE (droits, pensions servies)', proto: 'API REST ou ETL selon l’état du système CNSS', fmt: 'JSON, CSV', freq: 'Mensuel', ctrl: 'Rapprochement des cotisations, identifiant unique', m: 'M9' },
    { k: 'tresor', n: 'Trésor / Caisse de retraite', full: 'Direction du Trésor et régime de retraite des fonctionnaires', side: 'r', y: 350, flows: ['Pensions'], dir: 'SIGRHE → Trésor (liquidation des pensions) ; Trésor → SIGRHE (paiements effectués)', proto: 'Bus d’échange (ESB) + API', fmt: 'XML, JSON', freq: 'Mensuel', ctrl: 'Visa du Contrôle financier, signature électronique', m: 'M7' },
    { k: 'ec', n: 'État civil', full: 'Registres d’état civil', side: 'l', y: 280, flows: ['Carrière', 'Recrutement'], dir: 'SIGRHE → état civil (vérification) ; état civil → SIGRHE (naissances, mariages, décès)', proto: 'ETL (lots) puis API dès numérisation', fmt: 'CSV, JSON', freq: 'Hebdomadaire', ctrl: 'Rapprochement nominatif, alertes de doublons', m: 'M10' },
    { k: 'niu', n: 'Identité nationale', full: 'Système d’identité nationale / registre biométrique (éventuel)', side: 'l', y: 350, flows: ['Carrière', 'Recrutement'], dir: 'SIGRHE → registre (vérification du NIU)', proto: 'API REST (connecteur prêt, activation à la mise en service du registre)', fmt: 'JSON', freq: 'Temps réel', ctrl: 'Consentement, minimisation des données', m: 'M12+' },
    { k: 'casier', n: 'Casier judiciaire', full: 'Registre des casiers judiciaires', side: 'l', y: 210, flows: ['Recrutement'], dir: 'SIGRHE → casier (demande de bulletin n° 3) ; casier → SIGRHE (réponse)', proto: 'API REST ou web service', fmt: 'JSON, XML', freq: 'À la demande', ctrl: 'Accès limité à la commission, journalisation', m: 'M8' },
    { k: 'sect', n: 'Systèmes sectoriels', full: 'Systèmes des ministères (éducation, santé, défense…)', side: 'l', y: 140, flows: ['Carrière', 'Notation'], dir: 'Bidirectionnel (affectations, effectifs, évaluations)', proto: 'API REST + webhooks', fmt: 'JSON', freq: 'Temps réel', ctrl: 'Périmètre par ministère, jetons dédiés', m: 'M7' }
  ];
  const FLOWC = { 'Paie': '#1F4E8C', 'Pensions': '#7B4FB0', 'Carrière': '#2E7D4F', 'Recrutement': '#C46A1C', 'Notation': '#B33A6B' };

  MOD.archi = () => ({ sys: [
    ['SIM-BA – Système d’Information de Gestion Financière de l’État', 'Existant', 'Opérationnel', '[XX]', '[XXX transactions mensuelles]', 'Interfaces à préciser avec la DGB'],
    ['SYSTAC – Télécompensation BEAC', 'Existant', 'Opérationnel', '[XX banques]', '[XXX ordres mensuels]', 'Format ISO 20022'],
    ['Plateformes de paiement mobile', 'Existant', 'Opérationnel', '[XX opérateurs]', '[XXX transactions mensuelles]', 'API des opérateurs'],
    ['Système de la CNSS', '[À confirmer]', '[À confirmer]', '[XX]', '[XXX]', '[À confirmer]'],
    ['Fichier actuel de la solde', 'Existant', 'Opérationnel', '[XX ministères]', '[≈ 25 000 dossiers]', 'Extraction pour migration'],
    ['Registres d’état civil', '[À confirmer]', 'Partiel', '[XX centres]', '[XXX actes]', 'Aucune interface connue'],
    ['Registre des casiers judiciaires', '[À confirmer]', '[À confirmer]', '[XX]', '[XXX]', '[À confirmer]'],
    ['Système d’identité nationale / biométrique', 'Projet futur', 'Non', '—', '—', 'Connecteur prévu']
  ] });
  MOD.api = () => ({ ver: 'v2', ep: 'agents-list', fmt: 'json', token: null, resp: null, calls: 0 });

  /* ---------- Architecture cible (SVG interactif) ---------- */
  function diagram(sel, flowSel) {
    const box = (x, y, w, h, t, cls, sub) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="${cls}"/><text x="${x + w / 2}" y="${y + (sub ? h / 2 - 3 : h / 2 + 4)}" text-anchor="middle" class="dg-t">${esc(t)}</text>${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle" class="dg-s">${esc(sub)}</text>` : ''}</g>`;
    const core = [['Référentiel', 'Dossier agent'], ['Carrière', 'Évaluation'], ['Paie', 'Pensions'], ['Recrutement', 'GED'], ['Présences', 'BI · pilotage']];
    let s = `<svg role="img" aria-label="Architecture cible du SIGRHE et interfaces avec les systèmes existants et futurs" viewBox="0 0 1140 470" style="width:100%;min-width:900px;height:auto;display:block">`;
    s += `<defs>${Object.entries(FLOWC).map(([k, c]) => `<marker id="ar-${k.normalize('NFD').replace(/[^a-z]/gi, '')}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
    // canaux
    s += `<g transform="translate(40,0)">`;
    s += `<text x="450" y="22" text-anchor="middle" class="dg-h">Canaux d’accès (client léger)</text>`;
    [['Portail gestionnaires', 260], ['Application agent', 390], ['USSD', 520], ['Portail des offres', 650]].forEach(([t, x]) => { s += box(x - 58, 30, 116, 30, t, 'dg-ch'); s += `<line x1="${x}" y1="60" x2="${x}" y2="82" class="dg-l"/>`; });
    // gateway & IAM
    s += box(190, 82, 520, 34, 'Passerelle d’API (API Gateway) · REST v1/v2 · TLS 1.3', 'dg-gw');
    s += box(722, 82, 150, 34, 'IAM · OAuth2 / OIDC', 'dg-sec', 'MFA · PKI');
    // core
    s += `<rect x="190" y="126" width="520" height="210" rx="12" class="dg-core"/><text x="450" y="146" text-anchor="middle" class="dg-h">SIGRHE · microservices</text>`;
    core.forEach((pair, i) => pair.forEach((t, j) => { s += box(205 + i * 101, 156 + j * 44, 92, 36, t, 'dg-ms'); }));
    s += box(205, 252, 490, 30, 'Bus d’échange (ESB) · ETL · webhooks d’événements', 'dg-esb');
    s += box(205, 292, 238, 34, 'Base de données (site principal)', 'dg-db'); s += box(457, 292, 238, 34, 'Réplication · site de secours', 'dg-db');
    // contrôles
    s += box(722, 126, 150, 210, '', 'dg-sec');
    ['Points de contrôle', 'Authentification forte', 'Habilitations par profil', 'Validation des schémas', 'Signature électronique', 'Journal d’audit', 'Chiffrement TLS / repos', 'Protection des données'].forEach((t, i) => { s += `<text x="797" y="${150 + i * 23}" text-anchor="middle" class="${i ? 'dg-s' : 'dg-t'}">${t}</text>`; });
    s += `</g>`;
    // externes
    SYS.forEach(x => {
      const xr = x.side === 'r' ? 950 : 10, w = 180, cx = x.side === 'r' ? 950 : 230;
      const on = sel === x.k, dim = flowSel && !x.flows.includes(flowSel);
      s += `<g data-a="tab" data-k="arSys" data-v="${x.k}" style="cursor:pointer;opacity:${dim ? .3 : 1}" tabindex="0" role="button" aria-label="${esc(x.n)} : afficher les flux"><rect x="${xr}" y="${x.y + 60}" width="${w}" height="40" rx="8" class="${on ? 'dg-ext on' : 'dg-ext'}"/><text x="${xr + w / 2}" y="${x.y + 77}" text-anchor="middle" class="dg-t">${esc(x.n)}</text><text x="${xr + w / 2}" y="${x.y + 92}" text-anchor="middle" class="dg-s">${x.flows.join(' · ')} · ${x.m}</text></g>`;
      x.flows.forEach((f, fi) => { if (flowSel && f !== flowSel) return; const yy = x.y + 74 + fi * 8; const c = FLOWC[f]; const id = 'ar-' + f.normalize('NFD').replace(/[^a-z]/gi, ''); s += `<line x1="${x.side === 'r' ? 912 : 190}" y1="${yy}" x2="${cx}" y2="${yy}" stroke="${c}" stroke-width="${on ? 3 : 1.8}" marker-end="url(#${id})" marker-start="url(#${id})"/>`; });
      if (x.side === 'r' && x.y + 74 > 336) s += `<line x1="912" y1="${x.y + 74}" x2="912" y2="336" class="dg-l"/>`;
    });
    s += `<text x="100" y="190" text-anchor="middle" class="dg-h">Systèmes nationaux</text><text x="1040" y="120" text-anchor="middle" class="dg-h">Systèmes financiers</text>`;
    // légende
    s += Object.entries(FLOWC).map(([k, c], i) => `<g data-a="tab" data-k="arFlow" data-v="${flowSel === k ? '' : k}" style="cursor:pointer" role="button" tabindex="0" aria-label="Filtrer le flux ${k}"><rect x="${290 + i * 120}" y="440" width="14" height="14" rx="3" fill="${c}"/><text x="${310 + i * 120}" y="452" class="dg-s" style="font-weight:${flowSel === k ? 700 : 400}">Flux ${k}</text></g>`).join('');
    return s + `</svg>`;
  }

  reg('architecture', {
    title: 'Architecture cible et intégration', menu: 'Architecture et intégration', crumb: 'Spécifications logicielles · architecture et interfaces',
    render() {
      const ar = App.mod('archi', MOD.archi);
      const tab = ui('arT', 'schema');
      const head = `<div class="kpis">${kpi('Architecture', '<span style="font-size:17px">Web centralisée · SOA</span>', 'client léger, API REST, microservices')}${kpi('Systèmes à interfacer', String(SYS.length), 'existants, en déploiement ou futurs')}${kpi('Protocoles', '<span style="font-size:17px">REST · ESB · ETL</span>', 'TLS 1.2 minimum (1.3 retenu)')}${kpi('Formats ouverts', '<span style="font-size:17px">JSON · XML · CSV</span>', 'schémas validés par l’autorité')}</div>
        ${seg('arT', [['schema', 'Schéma cible et flux'], ['sys', 'Statut des systèmes existants'], ['cal', 'Calendrier d’intégration'], ['strat', 'Stratégie d’interopérabilité']], tab, 'Rubriques')}`;
      if (tab === 'sys') {
        const ST = ['Existant', 'En cours de déploiement', 'Projet futur', '[À confirmer]'], OP = ['Opérationnel', 'Partiel', 'Non', '[À confirmer]'];
        return head + note('Le DAO demande au soumissionnaire de renseigner ce tableau pour chaque système. Les valeurs entre crochets sont à compléter avec les données officielles (DGB, BEAC, CNSS, ministère de la Justice…). Les cellules sont modifiables et enregistrées dans votre navigateur.', 'warn') + `
        <section class="card"><div class="tbox"><table><thead><tr><th style="min-width:230px">Système</th><th>Statut</th><th>Opérationnalité</th><th>Administrations utilisatrices</th><th>Volume de données</th><th style="min-width:200px">Interopérabilité actuelle</th></tr></thead><tbody>
        ${ar.sys.map((r, i) => `<tr><td><b>${esc(r[0])}</b></td><td><select aria-label="Statut de ${esc(r[0])}" data-bind="arS_${i}_1" id="ars${i}1" style="height:34px;border:1px solid var(--field);border-radius:6px;background:var(--surface)">${ST.map(o => `<option${(ui('arS_' + i + '_1', r[1])) === o ? ' selected' : ''}>${o}</option>`).join('')}</select></td><td><select aria-label="Opérationnalité de ${esc(r[0])}" data-bind="arS_${i}_2" id="ars${i}2" style="height:34px;border:1px solid var(--field);border-radius:6px;background:var(--surface)">${OP.map(o => `<option${(ui('arS_' + i + '_2', r[2])) === o ? ' selected' : ''}>${o}</option>`).join('')}</select></td>${[3, 4, 5].map(c => `<td><input aria-label="${esc(r[0])}" id="ars${i}${c}" data-bind="arS_${i}_${c}" value="${esc(ui('arS_' + i + '_' + c, r[c]))}" style="height:34px;border:1px solid var(--field);border-radius:6px;padding:0 8px;width:100%;min-width:140px;background:var(--surface)"></td>`).join('')}</tr>`).join('')}
        </tbody></table></div><div class="row">${btn('Copier le tableau (pour Excel)', 'ar-copy')}</div></section>`;
      }
      if (tab === 'cal') {
        const M = ['M1 déc.', 'M2 janv.', 'M3 févr.', 'M4 mars', 'M5 avr.', 'M6 mai', 'M7 juin', 'M8 juil.', 'M9 août', 'M10 sept.', 'M11 oct.', 'M12 nov.'];
        const R = [['Cadrage, schémas de données validés par l’autorité', 1, 2, null, 'n'], ['Passerelle d’API, IAM (OAuth2/OIDC), portail développeur', 1, 3, 3, 'info'], ['SYSTAC / banques (virements, rejets)', 3, 4, 4, 'info'], ['Mobile money', 4, 5, 5, 'info'], ['SIM-BA (engagement, liquidation, ordonnancement)', 4, 6, 6, 'info'], ['Trésor / Caisse de retraite (pensions)', 5, 7, 7, 'info'], ['Systèmes sectoriels (webhooks)', 5, 7, 7, 'info'], ['Pilote dans 3 ministères puis généralisation', 5, 7, 7, 'ok'], ['Casier judiciaire', 7, 8, 8, 'warn'], ['CNSS (déclarations, cotisations)', 7, 9, 9, 'warn'], ['État civil (ETL puis API)', 8, 10, 10, 'warn'], ['Identité nationale (selon mise en service du registre)', 11, 12, 12, 'n']];
        return head + note('<b>Point d’attention :</b> le DAO fixe l’achèvement au <b>30 juin 2027</b> (M7 si le marché démarre en décembre 2026), alors que son propre exemple place l’interfaçage CNSS au mois 9. Les connexions au-delà de M7 sont proposées pendant la période de garantie, à faire confirmer par une demande d’éclaircissement.', 'warn') + `
        <section class="card"><h2>Jalons de connexion, tests et mise en production</h2><div class="tbox"><table style="min-width:980px"><thead><tr><th style="min-width:280px">Lot d’intégration</th>${M.map((m, i) => `<th style="text-align:center;font-size:10.5px;${i === 6 ? 'border-right:2px solid var(--bad)' : ''}">${m}</th>`).join('')}</tr></thead><tbody>
        ${R.map(r => `<tr><td>${esc(r[0])}</td>${M.map((m, i) => { const mi = i + 1, inb = mi >= r[1] && mi <= r[2], ms = mi === r[3]; return `<td style="padding:6px 2px;${i === 6 ? 'border-right:2px solid var(--bad)' : ''}">${inb ? `<div style="height:20px;border-radius:4px;background:var(--${r[4] === 'n' ? 'n-soft' : r[4] === 'ok' ? 'ok-soft' : r[4] === 'warn' ? 'warn-soft' : 'accent-soft'});display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--${r[4] === 'n' ? 'muted' : r[4] === 'warn' ? 'warn' : r[4] === 'ok' ? 'ok' : 'accent'})">${ms ? '◆' : ''}</div>` : ''}</td>`; }).join('')}</tr>`).join('')}
        </tbody></table></div><div class="row small muted" style="gap:16px"><span>◆ jalon de mise en service</span><span style="color:var(--bad)">│ fin du marché (30/06/2027)</span><span>Orange : période de garantie</span></div></section>
        <section class="card"><h2>Validation de chaque connecteur</h2><div class="tbox"><table><thead><tr><th>Étape</th><th>Contenu</th><th>Critère d’acceptation</th></tr></thead><tbody>${[['Tests unitaires du connecteur', 'Contrats d’API, schémas JSON/XML, cas d’erreur', '100 % des cas du contrat passés'], ['Tests d’interopérabilité', 'Échanges réels en environnement de recette avec le système partenaire', 'Procès-verbal signé par les deux parties'], ['Tests de charge et SLA', '25 000 utilisateurs, calcul de paie, débit des échanges', 'Engagements de service tenus (≤ 2 s, ≥ 99,5 %)'], ['Mise en production progressive', 'Pilote, double run d’un mois sur la paie, généralisation', 'Écart de paie nul sur le double run'], ['Suivi des indicateurs', 'Taux de rejet, délais, disponibilité de chaque interface', 'Tableau de bord mensuel au comité de pilotage']].map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="muted">${r[2]}</td></tr>`).join('')}</tbody></table></div></section>`;
      }
      if (tab === 'strat') return head + `<div class="cols"><section class="card"><h2>Principes</h2><ul style="margin:0;padding-left:18px;line-height:1.8"><li><b>API d’abord :</b> toute fonction du SIGRHE est exposée par une API REST documentée, utilisée aussi par nos propres écrans.</li><li><b>Passerelle d’API :</b> point d’entrée unique (authentification, quotas, versionnage, journalisation).</li><li><b>Bus d’échange (ESB) :</b> transformation des formats, files d’attente et reprise sur erreur pour les systèmes non temps réel.</li><li><b>Microservices :</b> chaque module se déploie et évolue séparément.</li><li><b>Événements :</b> webhooks (acte notifié, paie publiée, agent créé) pour les systèmes sectoriels.</li><li><b>ETL :</b> pour les registres encore gérés par lots (état civil).</li><li><b>Connecteurs standards :</b> un nouveau système s’ajoute par configuration d’un connecteur, sans modifier le cœur.</li></ul></section>
        <section class="card"><h2>Sécurité et conformité</h2><ul style="margin:0;padding-left:18px;line-height:1.8"><li>TLS 1.3 (1.2 minimum accepté), mTLS avec SIM-BA et les banques</li><li>OAuth2 (client credentials, authorization code + PKCE) et OpenID Connect</li><li>Jetons à portée limitée (scopes) dérivés des profils d’habilitation</li><li>Signature électronique XML des lots financiers</li><li>Journal d’audit horodaté avec identifiant de corrélation de bout en bout</li><li>Minimisation des données, chiffrement au repos, durées de conservation</li><li>Conformité à la réglementation nationale sur les données personnelles [référence à confirmer] et alignement sur le RGPD</li></ul></section></div>
        <section class="card"><h2>Exemple de schéma de données documenté (Agent, v2)</h2><pre class="code">${esc(JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://api.sigrhe.gouv.cf/schemas/v2/agent.json', title: 'Agent', type: 'object', required: ['matricule', 'identite', 'affectation', 'statut'], properties: { matricule: { type: 'string', pattern: '^[0-9]{3}-[0-9]{4}-[A-Z]$' }, identite: { type: 'object', required: ['nom', 'prenom', 'niu'], properties: { nom: { type: 'string' }, prenom: { type: 'string' }, sexe: { enum: ['F', 'M'] }, anneeNaissance: { type: 'integer' }, niu: { type: 'string' } } }, affectation: { type: 'object', properties: { ministere: { type: 'object', properties: { code: { type: 'string' }, libelle: { type: 'string' } } }, lieu: { type: 'string' }, fonction: { type: 'string' } } }, carriere: { type: 'object', properties: { grade: { type: 'string' }, indice: { type: 'integer', minimum: 100 } } }, statut: { enum: ['Actif', 'Stagiaire', 'Détachement', 'Disponibilité', 'Suspendu', 'Départ retraite', 'Retraité'] } } }, null, 2))}</pre></section>`;
      // schéma
      const k = ui('arSys', 'simba'), f = ui('arFlow', '');
      const x = SYS.find(s => s.k === k) || SYS[0];
      return head + `<section class="card"><div class="row sb"><h2>Architecture cible du SIGRHE et interfaces</h2><span class="muted">Cliquez sur un système ou un flux pour l’isoler</span></div><div style="overflow-x:auto">${diagram(k, f)}</div></section>
        <div class="cols"><section class="card w2"><div class="row sb"><h2>${esc(x.n)}</h2>${pill('Jalon ' + x.m, 'info')}</div><div class="muted">${esc(x.full)}</div><dl class="dl">${[['Flux', x.flows.join(', ')], ['Sens et contenu', x.dir], ['Protocole', x.proto], ['Formats', x.fmt], ['Fréquence', x.freq], ['Contrôles qualité et sécurité', x.ctrl]].map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl></section>
        <section class="card"><h2>Flux de données</h2>${Object.entries(FLOWC).map(([fl, c]) => `<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span style="width:12px;height:12px;border-radius:3px;background:${c};flex:none;margin-top:4px"></span><div><b>${fl}</b><div class="small muted">${SYS.filter(s => s.flows.includes(fl)).map(s => s.n).join(', ')}</div></div></div>`).join('')}${App.canSee('api') ? btn('Voir les API correspondantes', 'nav', { data: { r: 'api' } }) : ''}</section></div>`;
    }
  });
  on('ar-copy', async () => {
    const ar = App.mod('archi', MOD.archi);
    const rows = [['Système', 'Statut', 'Opérationnalité', 'Administrations', 'Volume', 'Interopérabilité actuelle']].concat(ar.sys.map((r, i) => [r[0]].concat([1, 2, 3, 4, 5].map(c => ui('arS_' + i + '_' + c, r[c])))));
    try { await navigator.clipboard.writeText(rows.map(r => r.join('\t')).join('\n')); toast('Tableau copié : collez-le dans Excel.'); } catch (e) { toast('Copie refusée par le navigateur.'); }
    App.commit();
  });

  /* ---------- Portail développeur ---------- */
  const SCOPES = () => {
    const s = [];
    if (lvl(0) >= 1) s.push('structures:read'); if (lvl(2) >= 1) s.push('agents:read'); if (lvl(3) >= 2) s.push('actes:write');
    if (lvl(10) >= 1 || lvl(11) >= 1) s.push('paie:read'); if (lvl(11) >= 3) s.push('paie:transmit'); if (lvl(12) >= 1) s.push('pensions:read');
    if (lvl(9) >= 1) s.push('recrutement:read'); if (lvl(14) >= 1) s.push('audit:read'); if (lvl(15) >= 4) s.push('webhooks:admin');
    return s;
  };
  const v1Agent = a => ({ matricule: a.mat, nom: a.nom, prenom: a.prenom, ministere: a.min, grade: a.grade, indice: a.indice, statut: a.statut });
  const v2Agent = a => ({ matricule: a.mat, identite: { nom: a.nom, prenom: a.prenom, sexe: a.sx, anneeNaissance: a.yob, niu: a.niu }, affectation: { ministere: { code: a.code, libelle: a.min }, lieu: a.ville, fonction: a.fonction }, carriere: { grade: a.grade, indice: a.indice, dateEntree: String(a.entree) }, statut: a.statut, liens: { self: '/v2/agents/' + a.mat, carriere: '/v2/agents/' + a.mat + '/carriere' } });
  const EP = [
    { id: 'token', m: 'POST', p: '/oauth2/token', v: ['v1', 'v2'], scope: null, d: 'Obtenir un jeton d’accès (OAuth2 client credentials ou authorization code + PKCE). Point d’entrée OpenID Connect : /.well-known/openid-configuration.', params: [['grant_type', 'body', 'string', 'client_credentials', 'Type d’autorisation'], ['client_id', 'body', 'string', 'sigrhe-demo', 'Identifiant du client enregistré'], ['scope', 'body', 'string', '', 'Portées demandées (vide : toutes celles de votre profil)']] },
    { id: 'agents-list', m: 'GET', p: '/agents', v: ['v1', 'v2'], scope: 'agents:read', d: 'Liste paginée des agents, filtrable par ministère et statut. Le périmètre du jeton s’applique (un gestionnaire sectoriel ne reçoit que son ministère).', params: [['ministere', 'query', 'string', '14', 'Code du ministère'], ['statut', 'query', 'string', 'Actif', 'Statut de l’agent'], ['page', 'query', 'integer', '1', 'Numéro de page (à partir de 1)'], ['size', 'query', 'integer', '5', 'Taille de page (1 à 100)']], list: true },
    { id: 'agent', m: 'GET', p: '/agents/{matricule}', v: ['v1', 'v2'], scope: 'agents:read', d: 'Dossier d’un agent.', params: [['matricule', 'path', 'string', '211-0457-B', 'Matricule de l’agent']] },
    { id: 'carriere', m: 'GET', p: '/agents/{matricule}/carriere', v: ['v2'], scope: 'agents:read', d: 'Historique de carrière (actes notifiés).', params: [['matricule', 'path', 'string', '211-0457-B', 'Matricule']], list: true },
    { id: 'structures', m: 'GET', p: '/structures', v: ['v1', 'v2'], scope: 'structures:read', d: 'Répertoire national des ministères et institutions.', params: [['type', 'query', 'string', 'min', 'etat, min, del, inst']], list: true },
    { id: 'actes', m: 'POST', p: '/actes', v: ['v2'], scope: 'actes:write', d: 'Créer une proposition d’acte (avancement, mutation, retraite). Le circuit de visas démarre automatiquement.', params: [['matricule', 'body', 'string', '244-0071-E', 'Agent concerné'], ['type', 'body', 'string', 'mu', 'av, mu, rt'], ['destination', 'body', 'string', 'Bouar', 'Pour une mutation']] },
    { id: 'paie', m: 'GET', p: '/paie/campagnes/{periode}', v: ['v1', 'v2'], scope: 'paie:read', d: 'État d’une campagne de paie et totaux.', params: [['periode', 'path', 'string', '2026-11', 'Période AAAA-MM']] },
    { id: 'virements', m: 'GET', p: '/paie/campagnes/{periode}/virements', v: ['v2'], scope: 'paie:read', d: 'Ordres de virement de la période (format bancaire), pour SYSTAC et le mobile money.', params: [['periode', 'path', 'string', '2026-11', 'Période'], ['canal', 'query', 'string', 'Mobile money', 'Banque (SYSTAC) ou Mobile money'], ['size', 'query', 'integer', '5', 'Taille de page']], list: true },
    { id: 'simba', m: 'POST', p: '/paie/campagnes/{periode}/transmission-simba', v: ['v2'], scope: 'paie:transmit', d: 'Transmettre la campagne validée à SIM-BA (lot XML signé). Opération idempotente (en-tête Idempotency-Key).', params: [['periode', 'path', 'string', '2026-11', 'Période']] },
    { id: 'pensions', m: 'GET', p: '/pensions/dossiers', v: ['v2'], scope: 'pensions:read', d: 'Dossiers de liquidation de pension.', params: [], list: true },
    { id: 'cands', m: 'GET', p: '/recrutement/concours/{id}/candidatures', v: ['v2'], scope: 'recrutement:read', d: 'Candidatures d’un concours (y compris dépôts du portail public).', params: [['id', 'path', 'string', 'C26-ENS', 'Identifiant du concours']], list: true },
    { id: 'audit', m: 'GET', p: '/audit/evenements', v: ['v2'], scope: 'audit:read', d: 'Piste d’audit (lecture seule).', params: [['size', 'query', 'integer', '5', 'Taille de page']], list: true },
    { id: 'webhooks', m: 'POST', p: '/webhooks', v: ['v2'], scope: 'webhooks:admin', d: 'Abonner un système à des événements : acte.notifie, paie.publiee, agent.cree, pension.liquidee.', params: [['url', 'body', 'string', 'https://sectoriel.men.cf/hooks/sigrhe', 'Adresse de rappel (HTTPS)'], ['evenements', 'body', 'string', 'acte.notifie,agent.cree', 'Liste séparée par des virgules']] }
  ];
  const CODES = [['200', 'OK', 'Requête traitée'], ['201', 'Created', 'Ressource créée'], ['400', 'Bad Request', 'Paramètre invalide (code erreur PARAM_INVALIDE)'], ['401', 'Unauthorized', 'Jeton absent ou expiré (JETON_INVALIDE)'], ['403', 'Forbidden', 'Portée insuffisante ou hors périmètre (PORTEE_INSUFFISANTE)'], ['404', 'Not Found', 'Ressource inconnue (RESSOURCE_INTROUVABLE)'], ['409', 'Conflict', 'État incompatible, ex. campagne non validée (ETAT_INCOMPATIBLE)'], ['422', 'Unprocessable Entity', 'Règle de gestion violée (REGLE_METIER)'], ['429', 'Too Many Requests', 'Quota dépassé : 600 requêtes / minute / client'], ['500', 'Internal Server Error', 'Erreur interne (identifiant de corrélation fourni)'], ['503', 'Service Unavailable', 'Maintenance ou bascule en cours']];
  const err = (st, code, msg) => ({ status: st, body: { erreur: { code, message: msg, correlationId: 'c-' + Math.random().toString(16).slice(2, 10) } } });
  function runEP(ep, ver, P, tok) {
    if (ep.id === 'token') {
      if (P.grant_type !== 'client_credentials') return err(400, 'PARAM_INVALIDE', 'grant_type doit valoir client_credentials pour cette démonstration.');
      const sc = SCOPES(); const asked = String(P.scope || '').split(/\s+/).filter(Boolean); const granted = asked.length ? asked.filter(s => sc.includes(s)) : sc;
      const payload = { sub: S().user.login, iss: 'https://iam.sigrhe.gouv.cf', aud: 'api.sigrhe', scope: granted.join(' '), perimetre: App.scopeCode() || 'tous', exp: Math.floor(Date.now() / 1000) + 3600 };
      const b64 = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, '');
      return { status: 200, body: { access_token: b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64(payload) + '.' + 'c2lnbmF0dXJlLWRlbW8', token_type: 'Bearer', expires_in: 3600, scope: granted.join(' ') }, token: { scope: granted, exp: payload.exp } };
    }
    if (!tok) return err(401, 'JETON_INVALIDE', 'Obtenez d’abord un jeton via POST /oauth2/token.');
    if (ep.scope && !tok.scope.includes(ep.scope)) return err(403, 'PORTEE_INSUFFISANTE', 'La portée « ' + ep.scope + ' » n’est pas accordée à votre profil.');
    if (!ep.v.includes(ver)) return err(404, 'RESSOURCE_INTROUVABLE', 'Cette opération n’existe pas en ' + ver + '.');
    const A = App.visibleAgents(); const map = ver === 'v1' ? v1Agent : v2Agent;
    const page = Math.max(1, +P.page || 1), size = +P.size || 5;
    if (size < 1 || size > 100) return err(400, 'PARAM_INVALIDE', 'size doit être compris entre 1 et 100.');
    const paged = (L, fn) => { const it = L.slice((page - 1) * size, page * size).map(fn); return ver === 'v1' ? it : { donnees: it, meta: { total: L.length, page, size, suivant: page * size < L.length ? '/' + ver + ep.p + '?page=' + (page + 1) + '&size=' + size : null } }; };
    switch (ep.id) {
      case 'agents-list': return { status: 200, body: paged(A.filter(a => (!P.ministere || a.code === P.ministere) && (!P.statut || a.statut === P.statut)), map) };
      case 'agent': { const a = A.find(x => x.mat === P.matricule); return a ? { status: 200, body: map(a) } : err(404, 'RESSOURCE_INTROUVABLE', 'Aucun agent ' + P.matricule + ' dans votre périmètre.'); }
      case 'carriere': { const a = A.find(x => x.mat === P.matricule); return a ? { status: 200, body: paged((a.hist || []).concat([{ date: String(a.entree), t: 'Recrutement et intégration', ref: '—' }]), h => ({ date: h.date, evenement: h.t, reference: h.ref })) } : err(404, 'RESSOURCE_INTROUVABLE', 'Agent inconnu.'); }
      case 'structures': return { status: 200, body: paged(DATA.E.filter(e => !P.type || e[4] === P.type), e => ver === 'v1' ? { code: e[0], sigle: e[1], libelle: e[2] } : { code: e[0], sigle: e[1], libelle: e[2], libelleCourt: e[3], type: e[4], tutelle: e[6] || null, effectif: e[5] || null }) };
      case 'actes': { const a = App.visibleAgents().find(x => x.mat === P.matricule); if (!a) return err(422, 'REGLE_METIER', 'Agent inconnu ou hors périmètre.'); if (!['av', 'mu', 'rt'].includes(P.type)) return err(400, 'PARAM_INVALIDE', 'type doit valoir av, mu ou rt.'); const c = App.mod('carriere', MOD.carriere); const id = { av: 'AV', mu: 'MU', rt: 'RT' }[P.type] + '-2026-0' + (500 + c.actes.length); c.actes.unshift({ id, t: P.type, mat: a.mat, objet: P.type === 'mu' ? 'Mutation ' + a.ville + ' → ' + (P.destination || 'Bangui') + ' (API)' : P.type === 'av' ? 'Avancement d’échelon (API)' : 'Admission à la retraite (API)', effet: '01/01/2027', detail: 'Acte créé par l’API par ' + S().user.login + '.', p: 0, dest: P.destination || 'Bangui' }); return { status: 201, body: { id, statut: 'Initiation', circuit: ['Visa Fonction publique', 'Visa Contrôle financier', 'Signature', 'Notification'], liens: { self: '/v2/actes/' + id } }, created: id }; }
      case 'paie': { const pa = App.mod('paie', MOD.paie); return { status: 200, body: { periode: P.periode, etape: MOD.PAIE_STEPS[Math.min(pa.step, 5)], cloturee: pa.step >= 5, agents: 24864, brut: 6960000000, net: 5500000000, devise: 'XAF' } }; }
      case 'virements': return { status: 200, body: paged(S().agents.filter(a => a.net && (!P.canal || a.canal === P.canal)), a => ({ beneficiaire: a.nom + ' ' + a.prenom, matricule: a.mat, montant: a.net, devise: 'XAF', canal: a.canal, reference: 'PAIE-' + P.periode + '-' + a.mat })) };
      case 'simba': { const pa = App.mod('paie', MOD.paie); if (pa.step < 4) return err(409, 'ETAT_INCOMPATIBLE', 'La campagne ' + P.periode + ' n’est pas encore validée par l’ordonnateur (étape : ' + MOD.PAIE_STEPS[pa.step] + ').'); return { status: 200, body: { lot: 'SIMBA-' + P.periode + '-001', lignes: 24864, montant: 6960000000, signature: 'XAdES-BES', accuse: 'reçu' } }; }
      case 'pensions': return { status: 200, body: paged(MOD.penDossiers(), f => { const c = f.calc || MOD.penCalc(f); return { dossier: f.id, matricule: f.mat, nature: f.nat, jouissance: f.jouis, etape: ['Constitution du dossier', 'Calcul automatisé', 'Visa du Contrôle financier', 'Ordonnancement', 'Mise en paiement', 'Pension en paiement'][Math.min(f.step, 5)], annuites: c.ann, pensionNetteMensuelle: c.net, indemniteDepart: c.indem, referenceSimba: f.refs.simba || null }; }) };
      case 'cands': { if (P.id !== 'C26-ENS') return err(404, 'RESSOURCE_INTROUVABLE', 'Concours inconnu.'); return { status: 200, body: paged(App.mod('recrutement', MOD.recrutement).cands, k => ({ dossier: k.id, candidat: k.name, ville: k.city, diplome: k.dip, score: k.score, pieces: k.pieces, decision: k.d === 'in' ? 'retenu' : k.d === 'out' ? 'ecarte' : null, origine: k.web ? 'portail' : 'import' })) }; }
      case 'audit': return { status: 200, body: paged(S().audit, a => ({ horodatage: a.t, utilisateur: a.u, action: a.a, objet: a.o })) };
      case 'webhooks': { if (!/^https:\/\//.test(P.url || '')) return err(400, 'PARAM_INVALIDE', 'url doit commencer par https://'); return { status: 201, body: { id: 'wh_' + Math.random().toString(36).slice(2, 8), url: P.url, evenements: String(P.evenements).split(','), secret: 'whsec_demo_••••', signature: 'HMAC-SHA256 dans l’en-tête X-SIGRHE-Signature' } }; }
    }
    return err(500, 'ERREUR_INTERNE', 'Opération non simulée.');
  }
  const toXML = (o, tag = 'reponse', ind = '') => {
    if (Array.isArray(o)) return o.map(x => toXML(x, 'element', ind)).join('\n');
    if (o && typeof o === 'object') return `${ind}<${tag}>\n${Object.entries(o).map(([k, v]) => (v && typeof v === 'object') ? toXML(v, k, ind + '  ') : `${ind}  <${k}>${esc(v ?? '')}</${k}>`).join('\n')}\n${ind}</${tag}>`;
    return `${ind}<${tag}>${esc(o)}</${tag}>`;
  };
  const toCSV = body => { const L = Array.isArray(body) ? body : body.donnees; if (!L) return '# Format CSV disponible pour les listes uniquement\n'; const flat = o => { const r = {}; const f = (x, p) => Object.entries(x).forEach(([k, v]) => v && typeof v === 'object' ? f(v, p + k + '.') : r[p + k] = v); f(o, ''); return r; }; const rows = L.map(flat); const cols = [...new Set(rows.flatMap(Object.keys))]; return [cols.join(';')].concat(rows.map(r => cols.map(c => String(r[c] ?? '').replace(/;/g, ',')).join(';'))).join('\n'); };

  reg('api', {
    title: 'Portail développeur des API', menu: 'Portail développeur (API)', crumb: 'Spécifications logicielles · API REST, versionnage, documentation',
    render() {
      const ap = App.mod('api', MOD.api);
      const ver = ap.ver, ep = EP.find(e => e.id === ap.ep) || EP[1];
      const P = {}; ep.params.forEach(p => { P[p[0]] = ui('apiP_' + ep.id + '_' + p[0], p[3]); });
      const url = '/' + ver + ep.p.replace(/\{(\w+)\}/g, (m, k) => P[k]) + (ep.params.filter(p => p[1] === 'query').length ? '?' + ep.params.filter(p => p[1] === 'query' && P[p[0]] !== '').map(p => p[0] + '=' + encodeURIComponent(P[p[0]])).join('&') : '');
      const bodyP = ep.params.filter(p => p[1] === 'body');
      const curl = ep.id === 'token' ? `curl -X POST https://api.sigrhe.gouv.cf/oauth2/token \\\n  -d grant_type=${P.grant_type} -d client_id=${P.client_id} -d "scope=${P.scope}" \\\n  --cert client.pem` : `curl -X ${ep.m} "https://api.sigrhe.gouv.cf${url}" \\\n  -H "Authorization: Bearer <jeton>" \\\n  -H "Accept: ${ap.fmt === 'xml' ? 'application/xml' : ap.fmt === 'csv' ? 'text/csv' : 'application/json'}"${bodyP.length ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(Object.fromEntries(bodyP.map(p => [p[0], P[p[0]]])))}'` : ''}`;
      const r = ap.resp;
      const out = r ? (ap.fmt === 'xml' ? '<?xml version="1.0" encoding="UTF-8"?>\n' + toXML(r.body) : ap.fmt === 'csv' && r.status < 300 ? toCSV(r.body) : JSON.stringify(r.body, null, 2)) : '';
      const scopes = SCOPES();
      return `<div class="kpis">${kpi('Version courante', 'v2', 'v1 dépréciée, fin de support le 31/12/2027')}${kpi('Opérations documentées', String(EP.length), 'REST · JSON, XML, CSV')}${kpi('Sécurité', '<span style="font-size:17px">OAuth2 · OIDC · TLS 1.3</span>', 'mTLS pour SIM-BA et les banques')}${kpi('Vos portées (selon profil)', String(scopes.length), esc(scopes.join(' · ') || 'aucune'))}</div>
      <div class="cols">
        <nav class="card" style="max-width:340px;gap:4px" aria-label="Opérations">
          <div class="row sb"><b>Opérations</b>${seg('apiVer', [['v1', 'v1'], ['v2', 'v2']], ver, 'Version').replace(/data-a="tab" data-k="apiVer"/g, 'data-a="api-ver"')}</div>
          ${EP.map(e => `<button type="button" data-a="api-ep" data-id="${e.id}" style="text-align:left;border:0;border-radius:8px;padding:8px 10px;cursor:pointer;display:flex;gap:8px;align-items:center;background:${e.id === ep.id ? 'var(--accent-soft)' : 'transparent'};color:var(--fg);opacity:${e.v.includes(ver) ? 1 : .45}"${e.id === ep.id ? ' aria-current="true"' : ''}><span class="pill ${e.m === 'GET' ? 'ok' : 'info'}" style="min-width:46px;text-align:center">${e.m}</span><span class="mono" style="font-size:12px;word-break:break-all">${esc(e.p)}</span></button>`).join('')}
          <span class="small muted" style="padding:8px 4px 0">Opérations grisées : absentes de la version ${ver}.</span>
        </nav>
        <div class="w3 stack" style="gap:16px">
          <section class="card"><div class="row" style="gap:10px"><span class="pill ${ep.m === 'GET' ? 'ok' : 'info'}">${ep.m}</span><code class="mono" style="font-size:15px">${esc((ep.id === 'token' ? '' : '/' + ver) + ep.p)}</code>${ep.scope ? pill('portée : ' + ep.scope, scopes.includes(ep.scope) ? 'n' : 'warn') : ''}${ver === 'v1' && ep.id !== 'token' ? pill('Dépréciée', 'warn') : ''}</div><p style="margin:0">${esc(ep.d)}</p>
            ${ep.params.length ? `<div class="tbox"><table><thead><tr><th>Paramètre</th><th>Emplacement</th><th>Type</th><th>Description</th><th style="min-width:180px">Valeur d’essai</th></tr></thead><tbody>${ep.params.map(p => `<tr><td class="mono"><b>${p[0]}</b></td><td>${p[1]}</td><td class="mono">${p[2]}</td><td class="muted">${p[3 + 1]}</td><td><input id="apip-${ep.id}-${p[0]}" aria-label="${p[0]}" data-bind="apiP_${ep.id}_${p[0]}" value="${esc(P[p[0]])}" class="mono" style="height:34px;width:100%;border:1px solid var(--field);border-radius:6px;padding:0 8px;background:var(--surface)"></td></tr>`).join('')}</tbody></table></div>` : ''}
            <div class="row sb"><div class="row" style="gap:8px"><span class="small muted">Format de réponse</span>${seg('apiFmt', [['json', 'JSON'], ['xml', 'XML'], ['csv', 'CSV']], ap.fmt, 'Format').replace(/data-a="tab" data-k="apiFmt"/g, 'data-a="api-fmt"')}</div><span class="row" style="gap:8px">${ap.token ? pill('Jeton actif · expire dans 60 min', 'ok') : pill('Aucun jeton', 'warn')}${btn('Essayer', 'api-run', { p: true })}</span></div>
            <pre class="code">${esc(curl)}</pre>
            ${r ? `<div class="row sb"><span class="row" style="gap:8px">${pill('HTTP ' + r.status, r.status < 300 ? 'ok' : r.status < 500 ? 'warn' : 'bad')}<span class="mono small muted">${r.ms} ms · X-RateLimit-Remaining: ${600 - ap.calls}${ver === 'v1' ? ' · Deprecation: true · Sunset: 31/12/2027' : ''}</span></span>${btn('Copier la réponse', 'api-copy', { sm: true })}</div><pre class="code" style="max-height:420px">${esc(out)}</pre>` : '<p class="muted" style="margin:0">Cliquez sur « Essayer ». Les réponses sont calculées à partir des données réelles de l’application, avec les droits de votre profil.</p>'}
          </section>
          <div class="cols">
            <section class="card"><h2>Codes de retour et messages d’erreur</h2><div class="tbox"><table><thead><tr><th>Code</th><th>Statut</th><th>Signification</th></tr></thead><tbody>${CODES.map(c => `<tr><td class="mono"><b>${c[0]}</b></td><td>${c[1]}</td><td class="muted small">${c[2]}</td></tr>`).join('')}</tbody></table></div><span class="small muted">Format d’erreur : { "erreur": { "code", "message", "correlationId" } }</span></section>
            <section class="card"><h2>Versionnage et migration</h2><ul style="margin:0;padding-left:18px;line-height:1.7"><li>Version dans le chemin (/v1, /v2) ; compatibilité ascendante garantie au sein d’une version.</li><li>Changement majeur : nouvelle version, préavis de 6 mois, en-têtes Deprecation et Sunset.</li><li>Coexistence v1 / v2 pendant 12 mois au minimum.</li></ul>
              <b style="margin-top:4px">Guide de migration v1 → v2</b><ul style="margin:0;padding-left:18px;line-height:1.7" class="small"><li>Agent : champs regroupés en <span class="mono">identite</span>, <span class="mono">affectation</span>, <span class="mono">carriere</span> ; ajout du NIU et des liens.</li><li>Listes : réponse enveloppée dans <span class="mono">donnees</span> + <span class="mono">meta</span> (total, page suivante).</li><li>Nouvelles opérations : actes, virements, transmission SIM-BA, webhooks, audit.</li></ul></section>
          </div>
        </div>
      </div>`;
    }
  });
  on('api-ver', d => { const ap = App.mod('api', MOD.api); ap.ver = d.v; ap.resp = null; });
  on('api-fmt', d => { App.mod('api', MOD.api).fmt = d.v; });
  on('api-ep', d => { const ap = App.mod('api', MOD.api); ap.ep = d.id; ap.resp = null; });
  on('api-run', () => {
    const ap = App.mod('api', MOD.api), ep = EP.find(e => e.id === ap.ep) || EP[1];
    const P = {}; ep.params.forEach(p => { P[p[0]] = ui('apiP_' + ep.id + '_' + p[0], p[3]); });
    const tok = ap.token && ap.token.exp * 1000 > Date.now() ? ap.token : null;
    const r = runEP(ep, ap.ver, P, tok);
    if (r.token) ap.token = r.token;
    ap.calls++; ap.resp = { status: r.status, body: r.body, ms: 40 + Math.floor(Math.random() * 140) };
    log('Appel API ' + ep.m + ' ' + (ep.id === 'token' ? '' : '/' + ap.ver) + ep.p, 'HTTP ' + r.status + (r.created ? ' · ' + r.created : ''));
  });
  on('api-copy', async () => {
    const ap = App.mod('api', MOD.api); if (!ap.resp) return;
    try { await navigator.clipboard.writeText(JSON.stringify(ap.resp.body, null, 2)); toast('Réponse copiée.'); } catch (e) { toast('Copie refusée par le navigateur.'); }
    App.commit();
  });
})();
