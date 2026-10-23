/* SIGRHE · Téléversement de documents (PDF, images, Word, Excel) : dossiers des agents et GED */
window.MOD = window.MOD || {};
(function () {
  const { on, ui, log, toast, can } = App;
  const H = App.h;
  const { esc, nf, btn, pill, note } = H;
  const S = () => App.S;

  /* ---------- Types acceptés ---------- */
  const MAXB = 20 * 1024 * 1024;
  const EXT = {
    pdf: ['PDF', 'pdf', ['25504446']],
    png: ['IMG', 'img', ['89504e47']], jpg: ['IMG', 'img', ['ffd8ff']], jpeg: ['IMG', 'img', ['ffd8ff']], gif: ['IMG', 'img', ['47494638']], webp: ['IMG', 'img', ['52494646']],
    docx: ['DOCX', 'word', ['504b0304']], doc: ['DOC', 'word', ['d0cf11e0']],
    xlsx: ['XLSX', 'excel', ['504b0304']], xls: ['XLS', 'excel', ['d0cf11e0']]
  };
  const ACCEPT = Object.keys(EXT).map(e => '.' + e).join(',');
  const FAM = { pdf: 'PDF', img: 'Image', word: 'Word', excel: 'Excel' };
  const COL = { pdf: 'bad', img: 'warn', word: 'info', excel: 'ok' };
  MOD.uplType = name => EXT[(name.split('.').pop() || '').toLowerCase()];
  const size = b => b < 1024 ? b + ' o' : b < 1048576 ? Math.round(b / 1024) + ' Ko' : (b / 1048576).toFixed(1).replace('.', ',') + ' Mo';
  MOD.uplSize = size;
  MOD.AGENT_CATS = ['Acte de naissance', 'Pièce d’identité (CNI ou passeport)', 'Diplôme ou titre', 'Arrêté de recrutement', 'Arrêté d’avancement ou de nomination', 'Acte de mariage', 'Acte de naissance d’un enfant', 'Certificat médical', 'Photo d’identité', 'Relevé d’identité bancaire', 'Autre pièce'];
  const REQ = ['Acte de naissance', 'Pièce d’identité (CNI ou passeport)', 'Diplôme ou titre', 'Arrêté de recrutement', 'Photo d’identité'];

  /* ---------- Stockage des fichiers (IndexedDB du navigateur pour la démonstration) ---------- */
  let dbp = null;
  const idb = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open('sigrhe-fichiers', 1); r.onupgradeneeded = () => r.result.createObjectStore('blobs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
  const mem = {};
  async function put(k, blob) { mem[k] = blob; try { const d = await idb(); await new Promise((res, rej) => { const t = d.transaction('blobs', 'readwrite'); t.objectStore('blobs').put(blob, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); return true; } catch (e) { return false; } }
  async function get(k) { if (mem[k]) return mem[k]; if (window.SIGRHE_SRV && SIGRHE_SRV.on) { const b = await SIGRHE_SRV.getFile(k); if (b) mem[k] = b; return b; } try { const d = await idb(); return await new Promise((res, rej) => { const r = d.transaction('blobs').objectStore('blobs').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); } catch (e) { return null; } }

  MOD.upl = () => ({ files: [] });
  const U = () => App.mod('upl', MOD.upl);
  MOD.uplFiles = ctx => U().files.filter(f => !f.del && (!ctx || f.ctx === ctx));
  MOD.uplFile = id => U().files.find(f => f.id === id);

  async function sha(buf) { try { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; } }
  async function ingest(file, ctx, cat) {
    const t = MOD.uplType(file.name);
    if (!t) return { err: file.name + ' : format refusé (formats acceptés : PDF, images JPG/PNG/GIF/WEBP, Word DOC/DOCX, Excel XLS/XLSX).' };
    if (file.size > MAXB) return { err: file.name + ' : ' + size(file.size) + ', au-delà de la limite de 20 Mo.' };
    if (!file.size) return { err: file.name + ' : fichier vide.' };
    const buf = await file.arrayBuffer();
    const head = [...new Uint8Array(buf.slice(0, 4))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (!t[2].some(s => head.startsWith(s))) return { err: file.name + ' : le contenu ne correspond pas à l’extension .' + file.name.split('.').pop() + ' (fichier refusé par le contrôle de sécurité).' };
    let id, ok, digest;
    if (window.SIGRHE_SRV && SIGRHE_SRV.on) {
      const r = await SIGRHE_SRV.putFile(file, ctx, cat);
      if (r.err) return { err: file.name + ' : ' + r.err };
      id = r.id; ok = true; digest = r.sha; mem[id] = new Blob([buf], { type: file.type || '' });
    } else {
      id = 'FIC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      ok = await put(id, new Blob([buf], { type: file.type || '' }));
      digest = await sha(buf);
    }
    const meta = { id, ctx, cat, name: file.name, type: t[0], fam: t[1], mime: file.type || '', size: file.size, by: S().user ? S().user.login : 'anonyme', date: H.now(), sha: digest, status: 'À vérifier', v: 1, versions: [{ n: 1, id, date: H.now(), by: S().user ? S().user.login : '', name: file.name }], local: ok };
    U().files.unshift(meta);
    return { meta };
  }

  /* Un seul champ fichier caché, réutilisé par tous les écrans */
  let pending = null;
  function picker() {
    let i = document.getElementById('upl-input');
    if (!i) {
      i = document.createElement('input'); i.type = 'file'; i.id = 'upl-input'; i.multiple = true; i.accept = ACCEPT; i.hidden = true; i.setAttribute('aria-hidden', 'true');
      i.addEventListener('change', () => { const fl = [...i.files]; i.value = ''; if (pending) handle(fl, pending); });
      document.body.appendChild(i);
    }
    return i;
  }
  async function handle(list, p) {
    if (!list.length) return;
    const errs = [], made = [];
    for (const f of list.slice(0, 20)) { const r = await ingest(f, p.ctx, p.cat); if (r.err) errs.push(r.err); else made.push(r.meta); }
    if (made.length && p.after) p.after(made);
    made.forEach(m => log('Téléversement de document', m.id + ' · ' + m.name + ' (' + size(m.size) + ') · ' + ctxLabel(m.ctx)));
    App.setUi('uplErr', errs.join('\n'));
    toast(made.length ? made.length + ' fichier(s) téléversé(s)' + (errs.length ? ', ' + errs.length + ' refusé(s).' : '.') : 'Aucun fichier accepté.');
    App.commit();
  }
  const ctxLabel = c => c.startsWith('agent:') ? 'dossier de l’agent ' + c.slice(6) : c.startsWith('ged:') ? 'GED · ' + c.slice(4) : c.startsWith('pension:') ? 'dossier de pension ' + c.slice(8) : c.startsWith('pensionne:') ? 'pensionné ' + c.slice(10) : c;

  /* Actions déclarant le contexte de dépôt */
  const CTX = MOD.uplCtx = {
    agent: d => ({ ctx: 'agent:' + d.m, cat: ui('uplCat_' + d.m, MOD.AGENT_CATS[0]), after: made => { const a = S().agents.find(x => x.mat === d.m); if (a) { a.hist = a.hist || []; made.forEach(m => a.hist.unshift({ date: H.today(), t: 'Pièce versée au dossier : ' + m.cat, ref: m.id })); } } }),
    ged: d => ({ ctx: 'ged:new', cat: '', after: made => { const g = App.mod('ged', MOD.ged); let fo = ui('gdF', 'actes'); if (fo === 'agents') fo = 'actes'; made.forEach(m => { const id = MOD.gedAdd(g, fo, m.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), 'Brouillon', 'Fichier téléversé · ' + m.name, S().user.login); const x = g.docs.find(z => z.id === id); x.type = m.type; x.size = size(m.size); x.fileId = m.id; x.tags = ['téléversé']; m.ctx = 'ged:' + id; App.setUi('gdSel', id); }); } }),
    gedver: d => ({ ctx: 'ged:' + d.id, cat: '', after: made => { const g = App.mod('ged', MOD.ged), x = g.docs.find(z => z.id === d.id), m = made[0]; if (!x || !m) return; const prev = x.fileId && MOD.uplFile(x.fileId); if (prev) { prev.del = true; m.v = prev.v + 1; m.versions = prev.versions.concat([{ n: m.v, id: m.id, date: H.now(), by: m.by, name: m.name }]); } x.fileId = m.id; x.type = m.type; x.size = size(m.size); x.v++; x.locked = false; x.date = H.today(); x.versions.push({ n: x.v, date: H.today(), who: S().user.login, note: 'Nouvelle version téléversée : ' + m.name }); } })
  };
  on('upl-pick', d => { pending = CTX[d.c](d); const i = picker(); i.multiple = d.c !== 'gedver'; i.click(); });

  /* Glisser-déposer sur toute zone [data-drop] */
  document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
  document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) z.classList.remove('over'); });
  document.addEventListener('drop', e => { const z = e.target.closest && e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); const d = { ...z.dataset }; handle([...e.dataTransfer.files], CTX[d.c](d)); });

  /* ---------- Composants ---------- */
  MOD.dropzone = (c, data, label) => `<div class="dropzone" data-drop="1" data-c="${c}"${Object.entries(data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
      <div><b>${label || 'Glissez vos fichiers ici'}</b><div class="small muted">ou ${btn('choisissez des fichiers', 'upl-pick', { sm: true, p: true, data: { c, ...(data || {}) } })} · PDF, images (JPG, PNG), Word, Excel · 20 Mo au plus par fichier</div></div></div>
      ${ui('uplErr', '') ? `<div class="note warn" style="white-space:pre-line">${esc(ui('uplErr', ''))} <button type="button" class="btn sm" data-a="tab" data-k="uplErr" data-v="">Fermer</button></div>` : ''}`;
  const ico = f => `<span class="pill ${COL[f.fam]}" style="min-width:46px;text-align:center">${f.type}</span>`;
  MOD.fileRow = (f, o = {}) => `<tr><td><div class="row" style="gap:10px;flex-wrap:nowrap">${ico(f)}<span style="min-width:0"><b style="word-break:break-word">${esc(f.name)}</b><span class="small muted" style="display:block">${f.cat ? esc(f.cat) + ' · ' : ''}${size(f.size)} · v${f.v}${o.ctx ? ' · ' + esc(ctxLabel(f.ctx)) : ''}</span></span></div></td>
      <td class="small"><span class="mono">${esc(f.by)}</span><div class="muted">${f.date}</div></td>
      <td>${pill(f.status, f.status === 'Vérifié' ? 'ok' : 'warn')}</td>
      <td><span class="row" style="gap:6px;flex-wrap:nowrap">${btn('Aperçu', 'upl-view', { sm: true, data: { id: f.id } })}${btn('Télécharger', 'upl-dl', { sm: true, data: { id: f.id } })}${f.status !== 'Vérifié' && o.verify !== false ? btn('Vérifier', 'upl-ok', { sm: true, req: [2, 3], data: { id: f.id } }) : ''}${btn('Corbeille', 'upl-del', { sm: true, danger: true, req: [2, 3], data: { id: f.id } })}</span></td></tr>`;
  MOD.fileTable = (L, o = {}) => `<div class="tbox"><table><thead><tr><th>Fichier</th><th>Déposé par</th><th>Contrôle</th><th>Actions</th></tr></thead><tbody>${L.map(f => MOD.fileRow(f, o)).join('') || `<tr><td colspan="4" class="muted">${o.empty || 'Aucun fichier téléversé.'}</td></tr>`}</tbody></table></div>`;
  const stNote = () => window.SIGRHE_SRV && SIGRHE_SRV.on ? note('Fichiers stockés sur le serveur du SIGRHE, hors de la racine web, avec contrôle des droits à chaque consultation et empreinte SHA-256.', 'n') : note('Démonstration : les fichiers sont conservés dans ce navigateur (stockage local chiffré par le système). En production : stockage serveur chiffré, répliqué sur le site de secours, avec empreinte SHA-256 et journal d’accès.', 'n');

  /* Onglet « Pièces du dossier » de la fiche électronique */
  MOD.agentDocs = a => {
    const L = MOD.uplFiles('agent:' + a.mat), cat = ui('uplCat_' + a.mat, MOD.AGENT_CATS[0]);
    const got = c => L.filter(f => f.cat === c);
    return `<section class="card"><div class="row sb"><h2>Pièces du dossier individuel</h2><span class="muted">${L.length} fichier(s) téléversé(s)</span></div>
      ${can(2, 2) ? `<div class="fgrid">${H.select('upl-cat', 'Type de pièce', 'uplCat_' + a.mat, cat, MOD.AGENT_CATS)}</div>${MOD.dropzone('agent', { m: a.mat }, 'Déposez les pièces de ' + a.nom + ' ' + a.prenom)}` : note('Votre profil consulte le dossier en lecture seule.', 'info')}
      ${MOD.fileTable(L, { empty: 'Aucune pièce téléversée pour cet agent.' })}</section>
      <div class="cols"><section class="card"><h2>Pièces obligatoires</h2>${REQ.map(c => { const g = got(c); return `<div class="row sb" style="border-bottom:1px solid var(--line2);padding:8px 0"><span>${c}</span>${g.length ? pill(g.some(f => f.status === 'Vérifié') ? 'Téléversée et vérifiée' : 'Téléversée, à vérifier', g.some(f => f.status === 'Vérifié') ? 'ok' : 'warn') : pill('Manquante', 'bad')}</div>`; }).join('')}</section>
      <section class="card"><h2>Règles de dépôt</h2><ul style="margin:0;padding-left:18px;line-height:1.7" class="small"><li>Formats : PDF, JPG, PNG, GIF, WEBP, DOC, DOCX, XLS, XLSX ; 20 Mo au plus par fichier, 20 fichiers par dépôt.</li><li>Contrôle du contenu réel (signature du fichier) : un fichier renommé est refusé.</li><li>Empreinte SHA-256 calculée au dépôt pour garantir l’intégrité.</li><li>Vérification de chaque pièce par la DRH ; aucune suppression définitive (corbeille journalisée).</li></ul>${stNote()}</section></div>`;
  };
  MOD.uplCompletude = a => { const L = MOD.uplFiles('agent:' + a.mat); return REQ.map(c => [c + ' (fichier)', L.some(f => f.cat === c)]); };

  /* Onglet GED « Fichiers téléversés » */
  MOD.gedUploads = () => {
    const f = ui('upF', 'all'), L = U().files.filter(x => !x.del && (f === 'all' || x.fam === f || (f === 'agents' && x.ctx.startsWith('agent:')) || (f === 'gedf' && x.ctx.startsWith('ged:'))));
    const all = U().files.filter(x => !x.del), tot = all.reduce((s, x) => s + x.size, 0);
    return `<div class="kpis">${H.kpi('Fichiers téléversés', String(all.length), size(tot))}${H.kpi('Dossiers d’agents', String(all.filter(x => x.ctx.startsWith('agent:')).length), 'pièces individuelles')}${H.kpi('Fonds GED', String(all.filter(x => x.ctx.startsWith('ged:')).length), 'documents administratifs')}${H.kpi('À vérifier', String(all.filter(x => x.status !== 'Vérifié').length), 'contrôle DRH')}</div>
      <section class="card"><h2>Téléverser dans la GED</h2>${can(2, 2) ? MOD.dropzone('ged', {}, 'Déposez des documents dans le fonds « ' + (({ actes: 'Actes administratifs', textes: 'Textes et référentiels', projet: 'Projet SIGRHE', modeles: 'Modèles' })[ui('gdF', 'actes')] || 'Actes administratifs') + ' »') : note('Votre profil consulte la GED en lecture seule.', 'info')}<span class="small muted">Chaque fichier crée une fiche GED (brouillon) avec ses métadonnées, ses versions et son circuit de validation.</span></section>
      <section class="card"><div class="row sb"><h2>Tous les fichiers téléversés</h2>${H.chips('upF', [['all', 'Tous'], ['agents', 'Dossiers d’agents'], ['gedf', 'Fonds GED'], ['pdf', 'PDF'], ['img', 'Images'], ['word', 'Word'], ['excel', 'Excel']], f, 'Filtre')}</div>${MOD.fileTable(L, { ctx: true })}${stNote()}</section>`;
  };

  /* ---------- Aperçu ---------- */
  const CDN = {
    pdf: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'],
    mammoth: ['https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js'],
    xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js']
  };
  const loaded = {};
  function lib(k) {
    return loaded[k] || (loaded[k] = (async () => {
      for (const u of CDN[k]) { try { await new Promise((res, rej) => { const s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); return u; } catch (e) { } }
      throw new Error('lib');
    })());
  }
  const frame = html => { const f = document.createElement('iframe'); f.setAttribute('sandbox', ''); f.title = 'Aperçu du document'; f.style.cssText = 'width:100%;height:100%;border:0;background:#fff;border-radius:8px'; f.srcdoc = '<!doctype html><meta charset="utf-8"><style>body{font:14px/1.5 system-ui,sans-serif;color:#14202E;padding:24px;margin:0}table{border-collapse:collapse;font-size:12.5px}td,th{border:1px solid #DDE3EA;padding:4px 8px}img{max-width:100%}</style>' + html; return f; };
  async function render(meta, box) {
    const blob = await get(meta.id);
    if (!blob) { box.innerHTML = '<p>Le fichier n’est pas disponible dans ce navigateur (il a été déposé depuis un autre poste). En production, il est servi par le serveur du SIGRHE.</p>'; return; }
    const url = URL.createObjectURL(blob);
    if (meta.fam === 'img') { box.innerHTML = `<img src="${url}" alt="${esc(meta.name)}" style="max-width:100%;max-height:100%;display:block;margin:auto;border-radius:8px">`; return; }
    if (meta.fam === 'pdf') {
      try {
        await lib('pdf'); const P = window.pdfjsLib; P.GlobalWorkerOptions.workerSrc = (await lib('pdf')).replace('pdf.min.js', 'pdf.worker.min.js');
        const doc = await P.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        box.innerHTML = `<div class="small muted" style="margin-bottom:8px">${doc.numPages} page(s)${doc.numPages > 10 ? ' · aperçu des 10 premières' : ''}</div>`;
        for (let i = 1; i <= Math.min(doc.numPages, 10); i++) { const pg = await doc.getPage(i), vp = pg.getViewport({ scale: Math.min(1.6, (box.clientWidth - 24) / pg.getViewport({ scale: 1 }).width) }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.style.cssText = 'display:block;margin:0 auto 12px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);max-width:100%'; box.appendChild(c); await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; }
      } catch (e) { box.innerHTML = `<object data="${url}" type="application/pdf" style="width:100%;height:100%"><p>Aperçu PDF indisponible dans ce navigateur : utilisez « Télécharger ».</p></object>`; }
      return;
    }
    if (meta.type === 'DOCX') {
      try { await lib('mammoth'); const r = await window.mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() }); box.innerHTML = ''; box.appendChild(frame(r.value || '<p>Document vide.</p>')); } catch (e) { box.innerHTML = '<p>Aperçu Word indisponible (bibliothèque non chargée) : utilisez « Télécharger ».</p>'; }
      return;
    }
    if (meta.fam === 'excel') {
      try {
        await lib('xlsx'); const wb = window.XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' });
        const show = n => { const tabs = box.querySelector('.xl-tabs'); tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === n)); const host = box.querySelector('.xl-host'); host.innerHTML = ''; host.appendChild(frame(window.XLSX.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' }))); };
        box.innerHTML = `<div class="chips xl-tabs" style="margin-bottom:8px">${wb.SheetNames.map(n => `<button type="button" data-s="${esc(n)}">${esc(n)}</button>`).join('')}</div><div class="xl-host" style="height:calc(100% - 44px)"></div>`;
        box.querySelectorAll('.xl-tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.s)));
        show(wb.SheetNames[0]);
      } catch (e) { box.innerHTML = '<p>Aperçu Excel indisponible : utilisez « Télécharger ».</p>'; }
      return;
    }
    box.innerHTML = `<p>Aperçu non disponible pour le format ${meta.type} (ancien format binaire). Utilisez « Télécharger » pour l’ouvrir avec Word ou Excel.</p>`;
  }
  function modal(meta) {
    const old = document.getElementById('upl-modal'); if (old) old.remove();
    const back = document.activeElement;
    const m = document.createElement('div'); m.id = 'upl-modal'; m.className = 'upl-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Aperçu : ' + meta.name);
    m.innerHTML = `<div class="upl-box"><div class="row sb" style="gap:8px;flex-wrap:nowrap"><div style="min-width:0">${ico(meta)} <b style="word-break:break-word">${esc(meta.name)}</b><div class="small muted">${size(meta.size)} · v${meta.v} · déposé par ${esc(meta.by)} le ${meta.date}${meta.sha ? ' · SHA-256 ' + meta.sha.slice(0, 16) + '…' : ''}</div></div><span class="row" style="gap:6px;flex-wrap:nowrap"><button type="button" class="btn sm" data-a="upl-dl" data-id="${meta.id}">Télécharger</button><button type="button" class="btn sm upl-x">Fermer</button></span></div><div class="upl-view">Chargement de l’aperçu…</div></div>`;
    document.body.appendChild(m);
    const close = () => { m.remove(); document.removeEventListener('keydown', esc_); if (back && back.focus) back.focus(); };
    const esc_ = e => { if (e.key === 'Escape') close(); };
    m.querySelector('.upl-x').addEventListener('click', close); m.addEventListener('click', e => { if (e.target === m) close(); }); document.addEventListener('keydown', esc_);
    m.querySelector('.upl-x').focus();
    render(meta, m.querySelector('.upl-view'));
    log('Consultation de document', meta.id + ' · ' + meta.name);
  }
  on('upl-view', d => { const f = MOD.uplFile(d.id); if (f) modal(f); });
  MOD.uplOpen = id => { const f = MOD.uplFile(id); if (f) modal(f); };

  /* ---------- Téléchargement ---------- */
  on('upl-dl', async d => {
    const f = MOD.uplFile(d.id); if (!f) return;
    const blob = await get(f.id);
    if (!blob) { toast('Fichier indisponible dans ce navigateur.'); App.commit(); return; }
    log('Téléchargement de document', f.id + ' · ' + f.name);
    let done = false;
    try { const dl = window.claude && await window.claude.use('downloads'); if (dl) { await dl.save({ filename: f.name, data: blob }); done = true; } } catch (e) { if (e && e.code === 'declined') { App.commit(); return; } }
    if (!done) { try { const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = f.name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); } catch (e) { toast('Téléchargement bloqué par le navigateur.'); } }
    App.commit();
  });
  on('upl-ok', d => { const f = MOD.uplFile(d.id); f.status = 'Vérifié'; f.checkedBy = S().user.login; log('Vérification de pièce', f.id + ' · ' + f.name); });
  on('upl-del', d => { const f = MOD.uplFile(d.id); f.del = true; log('Mise à la corbeille de document', f.id + ' · ' + f.name + ' (récupérable 30 jours)'); toast('Fichier placé dans la corbeille (récupérable pendant 30 jours).'); });
})();
