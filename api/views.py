"""
SIGRHE · API JSON consommée par l'application web (même origine, session Django + jeton CSRF).
"""
import base64
import hashlib
import hmac
import json
import logging
import secrets
import struct
import time
import urllib.error
import urllib.request
from datetime import timedelta
from functools import wraps

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.mail import send_mail
from django.db import transaction
from django.http import FileResponse, JsonResponse, HttpResponseNotAllowed
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import AppelAssistant, Audit, Agent, Compte, Courriel, Droit, Fichier, ModuleState, Profil, Rubrique
from .permissions import Ctx, PUBLIC_MODULES, matrix

log = logging.getLogger('sigrhe')


# ---------------------------------------------------------------- utilitaires
def _ip(request):
    fwd = request.META.get('HTTP_X_FORWARDED_FOR')
    return (fwd.split(',')[0].strip() if fwd else request.META.get('REMOTE_ADDR')) or None


def audit(request, action, objet='', user=None):
    u = user or (request.user.username if request.user.is_authenticated else 'anonyme')
    Audit.objects.create(utilisateur=u, action=action[:255], objet=str(objet)[:4000], ip=_ip(request))


def body(request):
    try:
        return json.loads(request.body or b'{}')
    except ValueError:
        return None


def err(msg, status=400, **extra):
    return JsonResponse({'erreur': msg, **extra}, status=status)


def api(methods, auth=True):
    """Décorateur : méthodes HTTP autorisées, utilisateur connecté et actif, contexte de droits."""
    def deco(fn):
        @wraps(fn)
        def wrapper(request, *a, **kw):
            if request.method not in methods:
                return HttpResponseNotAllowed(methods)
            ctx = Ctx(request.user)
            if auth and not ctx.ok:
                return err('Authentification requise.', 401)
            request.ctx = ctx
            return fn(request, *a, **kw)
        return wrapper
    return deco


def fmt_dt(dt):
    return timezone.localtime(dt).strftime('%d/%m/%Y %H:%M')


def agent_payload(a, ctx):
    d = dict(a.donnees or {})
    d.update({'mat': a.matricule, 'nom': a.nom, 'prenom': a.prenom, 'code': a.entite_id, 'statut': a.statut, 'niu': a.niu})
    if ctx.pseudonymise:
        h = hashlib.sha1(a.matricule.encode()).hexdigest()[:6].upper()
        d.update({'nom': 'AGENT', 'prenom': h, 'niu': 'masqué', 'lieu': '—'})
        d.pop('fiche', None)
        d['hist'] = []
    return d


def user_entry(c, full=False):
    u = c.user
    e = {'name': (u.last_name.upper() + ' ' + u.first_name).strip() or u.username, 'login': u.username, 'prof': c.profil_id, 'scope': c.perimetre}
    if c.profil_id == 'AGT':
        e['mat'] = c.agent_matricule or u.username
    if full:
        e.update({'status': c.statut, 'last': fmt_dt(u.last_login) if u.last_login else '—', 'mfa': 'Application TOTP' if c.mfa_secret else 'Mot de passe seul', 'email': u.email})
    return e


# ---------------------------------------------------------------- page de l'application
@ensure_csrf_cookie
def index(request):
    return render(request, 'index.html', {'demo': settings.SIGRHE_DEMO_MODE})


# ---------------------------------------------------------------- amorçage
@api(['GET'], auth=False)
def bootstrap(request):
    ctx = request.ctx
    base = {'demo': settings.SIGRHE_DEMO_MODE, 'ai': bool(settings.ANTHROPIC_API_KEY)}
    if not ctx.ok:
        mods = {m.cle: {'data': m.donnees, 'version': m.version} for m in ModuleState.objects.filter(cle__in=PUBLIC_MODULES)}
        demo_accounts = []
        if settings.SIGRHE_DEMO_MODE:
            demo_accounts = [user_entry(c) for c in Compte.objects.filter(demo=True, statut='Actif').select_related('user').order_by('profil__ordre')]
        return JsonResponse({**base, 'auth': False, 'modules': mods, 'demoAccounts': demo_accounts,
                             'demoPassword': settings.SIGRHE_DEMO_PASSWORD if settings.SIGRHE_DEMO_MODE else ''})
    c = ctx.compte
    mx, profs = matrix()
    agents = [agent_payload(a, ctx) for a in ctx.agents_qs()]
    mods = {m.cle: {'data': m.donnees, 'version': m.version} for m in ModuleState.objects.all()}
    aq = Audit.objects.all() if ctx.can_see_all_audit() else Audit.objects.filter(utilisateur=request.user.username)
    aud = [{'t': fmt_dt(x.horodatage), 'u': x.utilisateur, 'a': x.action, 'o': x.objet} for x in aq[:400]]
    comptes = Compte.objects.select_related('user').order_by('profil__ordre', 'user__username')
    users = [user_entry(x, full=ctx.can(15, 1)) for x in comptes]
    return JsonResponse({**base, 'auth': True, 'user': user_entry(c), 'profils': profs, 'mx': mx, 'agents': agents,
                         'modules': mods, 'audit': aud, 'users': users,
                         'rights': {'admin': ctx.can_admin(), 'agentsWrite': ctx.can_write_agents(), 'pseudo': ctx.pseudonymise}})


# ---------------------------------------------------------------- connexion
def _totp_ok(secret, code, window=1):
    try:
        key = base64.b32decode(secret.upper() + '=' * (-len(secret) % 8))
    except Exception:
        return False
    code = ''.join(ch for ch in str(code) if ch.isdigit())
    t = int(time.time()) // 30
    for w in range(-window, window + 1):
        h = hmac.new(key, struct.pack('>Q', t + w), hashlib.sha1).digest()
        o = h[-1] & 15
        v = (struct.unpack('>I', h[o:o + 4])[0] & 0x7fffffff) % 1000000
        if hmac.compare_digest(str(v).zfill(6), code):
            return True
    return False


@api(['POST'], auth=False)
def api_login(request):
    b = body(request) or {}
    login_ = str(b.get('login', '')).strip()[:150]
    pwd = str(b.get('password', ''))
    if not login_ or not pwd:
        return err('Identifiant et mot de passe requis.')
    c = Compte.objects.filter(user__username=login_).select_related('user').first()
    if c and c.verrou_jusqua and c.verrou_jusqua > timezone.now():
        audit(request, 'Connexion refusée (compte verrouillé)', login_, user=login_)
        return err('Compte verrouillé temporairement après plusieurs échecs. Réessayez plus tard.', 423)
    user = authenticate(request, username=login_, password=pwd)
    if not user or not c:
        if c:
            c.echecs += 1
            if c.echecs >= settings.LOGIN_MAX_FAILURES:
                c.verrou_jusqua = timezone.now() + timedelta(minutes=settings.LOGIN_LOCK_MINUTES)
                c.echecs = 0
            c.save(update_fields=['echecs', 'verrou_jusqua'])
        audit(request, 'Échec de connexion', login_, user=login_ or 'anonyme')
        return err('Identifiant ou mot de passe incorrect.', 401)
    if c.statut != 'Actif' or not user.is_active:
        audit(request, 'Connexion refusée (compte non actif)', login_, user=login_)
        return err('Compte non actif : contactez l’administrateur.', 403)
    if c.mfa_secret:
        if not b.get('code'):
            return JsonResponse({'mfa': True}, status=401)
        if not _totp_ok(c.mfa_secret, b.get('code')):
            audit(request, 'Échec du second facteur', login_, user=login_)
            return err('Code de vérification incorrect.', 401, mfa=True)
    c.echecs = 0
    c.verrou_jusqua = None
    c.save(update_fields=['echecs', 'verrou_jusqua'])
    login(request, user)
    request.session.cycle_key()
    audit(request, 'Connexion réussie' + (' (MFA)' if c.mfa_secret else ''), c.profil_id, user=login_)
    return JsonResponse({'ok': True})


@api(['POST'], auth=False)
def api_logout(request):
    if request.user.is_authenticated:
        audit(request, 'Déconnexion', request.user.username)
    logout(request)
    return JsonResponse({'ok': True})


# ---------------------------------------------------------------- modules (données de travail partagées)
@api(['PUT'])
def module(request, key):
    ctx = request.ctx
    if not key.isidentifier() or len(key) > 40:
        return err('Module inconnu.', 404)
    if not ctx.can_write_module(key):
        return err('Droit insuffisant pour modifier « %s ».' % key, 403)
    b = body(request)
    if not isinstance(b, dict) or not isinstance(b.get('data'), dict):
        return err('Contenu invalide.')
    raw = request.body
    if len(raw) > 5 * 1024 * 1024:
        return err('Module trop volumineux.', 413)
    with transaction.atomic():
        m, created = ModuleState.objects.select_for_update().get_or_create(cle=key, defaults={'donnees': b['data'], 'version': 1, 'modifie_par': request.user.username})
        if not created:
            if int(b.get('version') or 0) != m.version:
                return JsonResponse({'erreur': 'Conflit : le module a été modifié par un autre utilisateur.', 'data': m.donnees, 'version': m.version}, status=409)
            old = m.donnees
            m.donnees = b['data']
            m.version += 1
            m.modifie_par = request.user.username
            m.save()
        else:
            old = {}
    if key == 'notif':
        _send_new_mails(old, b['data'])
    return JsonResponse({'version': m.version})


@api(['GET'])
def modules_since(request):
    """Modules modifiés depuis une date (rafraîchissement périodique du navigateur)."""
    try:
        since = float(request.GET.get('since', '0'))
    except ValueError:
        since = 0
    dt = timezone.datetime.fromtimestamp(since, tz=timezone.utc)
    mods = {m.cle: {'data': m.donnees, 'version': m.version} for m in ModuleState.objects.filter(modifie_le__gt=dt)}
    return JsonResponse({'modules': mods, 'now': time.time()})


def _send_new_mails(old, new):
    """Envoie réellement les courriels de notification nouvellement générés (destinataires = comptes existants)."""
    known = {m.get('id') for m in (old or {}).get('mails', []) if isinstance(m, dict)}
    fresh = [m for m in (new or {}).get('mails', []) if isinstance(m, dict) and m.get('id') not in known
             and m.get('canal') == 'Courriel' and m.get('status') == 'Envoyé'][:50]
    for m in fresh:
        ref = str(m.get('id'))[:60]
        if Courriel.objects.filter(ref=ref).exists():
            continue
        u = User.objects.filter(username=m.get('login')).first()
        if not u or not u.email:
            continue
        c = Courriel.objects.create(ref=ref, destinataire=u.email, login=u.username, sujet=str(m.get('subj', ''))[:255], corps=str(m.get('body', ''))[:10000])
        try:
            send_mail(c.sujet, c.corps, settings.DEFAULT_FROM_EMAIL, [c.destinataire], fail_silently=False)
            c.statut, c.envoye_le = 'Envoyé', timezone.now()
        except Exception as e:  # le serveur SMTP peut être indisponible : on garde la trace
            c.statut, c.erreur = 'Échec', str(e)[:2000]
            log.warning('Courriel %s non envoyé : %s', ref, e)
        c.save()


# ---------------------------------------------------------------- agents
@api(['PATCH'])
def agent(request, mat):
    ctx = request.ctx
    if not ctx.can_write_agents() or ctx.pseudonymise:
        return err('Droit insuffisant pour modifier un dossier d’agent.', 403)
    a = ctx.agents_qs().filter(matricule=mat).first()
    if not a:
        return err('Agent introuvable dans votre périmètre.', 404)
    b = body(request)
    d = b.get('data') if isinstance(b, dict) else None
    if not isinstance(d, dict):
        return err('Contenu invalide.')
    for k in ('mat', 'code'):
        d.pop(k, None)  # le matricule et le rattachement ne changent pas par cette voie
    a.statut = str(d.get('statut', a.statut))[:30]
    a.niu = str(d.get('niu', a.niu))[:40]
    a.nom = str(d.get('nom', a.nom))[:80]
    a.prenom = str(d.get('prenom', a.prenom))[:80]
    a.donnees = d
    a.modifie_par = request.user.username
    a.save()
    return JsonResponse({'ok': True})


@api(['POST'])
def agents_lot(request):
    """Mise à jour groupée de dossiers d'agents (une requête au lieu d'une par agent)."""
    ctx = request.ctx
    if not ctx.can_write_agents() or ctx.pseudonymise:
        return err('Droit insuffisant pour modifier un dossier d’agent.', 403)
    b = body(request) or {}
    items = b.get('items') if isinstance(b.get('items'), list) else []
    if len(items) > 1000:
        return err('Trop d’éléments.', 413)
    by_mat = {str(i.get('mat')): i.get('data') for i in items if isinstance(i, dict) and isinstance(i.get('data'), dict)}
    ok, refused = [], []
    with transaction.atomic():
        for a in ctx.agents_qs().filter(matricule__in=list(by_mat)).select_for_update():
            d = by_mat[a.matricule]
            for k in ('mat', 'code'):
                d.pop(k, None)
            a.statut = str(d.get('statut', a.statut))[:30]
            a.niu = str(d.get('niu', a.niu))[:40]
            a.nom = str(d.get('nom', a.nom))[:80]
            a.prenom = str(d.get('prenom', a.prenom))[:80]
            a.donnees = d
            a.modifie_par = request.user.username
            a.save()
            ok.append(a.matricule)
    refused = [m for m in by_mat if m not in ok]
    return JsonResponse({'ok': ok, 'refuses': refused})


# ---------------------------------------------------------------- audit
@api(['POST'])
def audit_add(request):
    b = body(request) or {}
    items = b.get('entries') if isinstance(b.get('entries'), list) else []
    for e in items[:50]:
        if isinstance(e, dict) and e.get('a'):
            audit(request, str(e.get('a'))[:255], str(e.get('o', ''))[:4000])
    return JsonResponse({'ok': True, 'n': min(len(items), 50)})


# ---------------------------------------------------------------- matrice des droits et comptes
@api(['PUT'])
def matrice(request):
    ctx = request.ctx
    if not ctx.can_admin():
        return err('Réservé à l’administrateur.', 403)
    b = body(request) or {}
    mx = b.get('mx')
    profs = list(Profil.objects.order_by('ordre').values_list('code', flat=True))
    if not isinstance(mx, list):
        return err('Contenu invalide.')
    changes = []
    with transaction.atomic():
        for i, row in enumerate(mx):
            if not Rubrique.objects.filter(index=i).exists() or not isinstance(row, list):
                continue
            for j, p in enumerate(profs):
                if j < len(row):
                    v = max(0, min(4, int(row[j] or 0)))
                    d, _ = Droit.objects.get_or_create(rubrique_id=i, profil_id=p)
                    if d.niveau != v:
                        changes.append(f'{p} · ligne {i}: {d.niveau} → {v}')
                        d.niveau = v
                        d.save()
    if changes:
        audit(request, 'Modification de la matrice des droits', '; '.join(changes))
    return JsonResponse({'ok': True, 'changes': len(changes)})


@api(['PUT'])
def comptes(request):
    """Applique la liste des comptes gérée dans l'écran « Utilisateurs et droits »."""
    ctx = request.ctx
    if not ctx.can_admin():
        return err('Réservé à l’administrateur.', 403)
    b = body(request) or {}
    created = []
    for e in (b.get('users') or [])[:500]:
        if not isinstance(e, dict) or not e.get('login'):
            continue
        login_ = str(e['login'])[:150]
        prof = Profil.objects.filter(code=e.get('prof')).first()
        if not prof:
            continue
        c = Compte.objects.filter(user__username=login_).select_related('user').first()
        statut = e.get('status') if e.get('status') in ('Actif', 'Suspendu', 'En attente') else 'En attente'
        if not c:
            pwd = secrets.token_urlsafe(12)
            parts = str(e.get('name', login_)).split(' ', 1)
            u = User.objects.create_user(login_, password=pwd, last_name=parts[0], first_name=parts[1] if len(parts) > 1 else '')
            u.is_active = statut == 'Actif'
            u.save()
            Compte.objects.create(user=u, profil=prof, perimetre=str(e.get('scope', ''))[:160], statut=statut)
            created.append({'login': login_, 'password': pwd})
            audit(request, 'Création de compte', f'{login_} · {prof.code}')
            continue
        changed = []
        if c.statut != statut:
            changed.append(f'statut {c.statut} → {statut}')
            c.statut = statut
            c.user.is_active = statut == 'Actif'
            c.user.save(update_fields=['is_active'])
        if str(e.get('mfa', '')).lower().startswith('réinit') and c.mfa_secret:
            c.mfa_secret = ''
            changed.append('second facteur réinitialisé')
        if changed:
            c.save()
            audit(request, 'Modification de compte', f'{login_} · ' + ', '.join(changed))
    return JsonResponse({'ok': True, 'created': created})


# ---------------------------------------------------------------- fichiers
SIGS = {
    'pdf': ('PDF', 'pdf', [b'%PDF']), 'png': ('IMG', 'img', [b'\x89PNG']), 'jpg': ('IMG', 'img', [b'\xff\xd8\xff']),
    'jpeg': ('IMG', 'img', [b'\xff\xd8\xff']), 'gif': ('IMG', 'img', [b'GIF8']), 'webp': ('IMG', 'img', [b'RIFF']),
    'docx': ('DOCX', 'word', [b'PK\x03\x04']), 'doc': ('DOC', 'word', [b'\xd0\xcf\x11\xe0']),
    'xlsx': ('XLSX', 'excel', [b'PK\x03\x04']), 'xls': ('XLS', 'excel', [b'\xd0\xcf\x11\xe0']),
}


@api(['POST'])
def files_upload(request):
    ctx = request.ctx
    f = request.FILES.get('file')
    contexte = str(request.POST.get('ctx', ''))[:80]
    if not f or not contexte:
        return err('Fichier et contexte requis.')
    if not ctx.file_access(contexte, write=True):
        return err('Droit insuffisant pour déposer dans ce dossier.', 403)
    ext = f.name.rsplit('.', 1)[-1].lower() if '.' in f.name else ''
    if ext not in SIGS:
        return err('Format refusé (PDF, images, Word, Excel uniquement).', 415)
    if f.size > settings.SIGRHE_MAX_FILE_BYTES or f.size == 0:
        return err('Taille refusée (20 Mo au plus).', 413)
    data = f.read()
    t, fam, sigs = SIGS[ext]
    if not any(data.startswith(s) for s in sigs):
        return err('Le contenu ne correspond pas à l’extension (fichier refusé).', 415)
    fid = 'FIC-' + timezone.now().strftime('%y%m%d') + '-' + secrets.token_hex(4).upper()
    obj = Fichier(id=fid, contexte=contexte, categorie=str(request.POST.get('cat', ''))[:120], nom=f.name[:255], type=t, famille=fam,
                  mime=f.content_type or '', taille=len(data), sha256=hashlib.sha256(data).hexdigest(), depose_par=request.user.username)
    obj.cree_le = timezone.now()
    obj.fichier.save(fid, ContentFile(data), save=False)
    obj.save()
    audit(request, 'Téléversement de fichier (serveur)', f'{fid} · {f.name} · {contexte}')
    return JsonResponse({'id': fid, 'sha': obj.sha256, 'size': obj.taille, 'type': t, 'fam': fam})


@api(['GET'])
def files_get(request, fid):
    ctx = request.ctx
    obj = Fichier.objects.filter(id=fid, supprime=False).first()
    if not obj:
        return err('Fichier introuvable.', 404)
    if not ctx.file_access(obj.contexte):
        return err('Accès refusé.', 403)
    audit(request, 'Consultation de fichier (serveur)', f'{obj.id} · {obj.nom}')
    resp = FileResponse(obj.fichier.open('rb'), as_attachment=request.GET.get('dl') == '1', filename=obj.nom,
                        content_type=obj.mime or 'application/octet-stream')
    resp['X-Content-Type-Options'] = 'nosniff'
    resp['Content-Security-Policy'] = "default-src 'none'; sandbox"
    return resp


# ---------------------------------------------------------------- portail public : candidature
@api(['POST'], auth=False)
def candidature(request):
    ip = _ip(request) or 'x'
    k = 'cand:' + ip
    n = cache.get(k, 0)
    if n >= 10:
        return err('Trop de dépôts depuis cette adresse. Réessayez plus tard.', 429)
    cache.set(k, n + 1, 3600)
    b = body(request) or {}
    cand = b.get('cand') if isinstance(b.get('cand'), dict) else None
    if not cand or not str(cand.get('name', '')).strip():
        return err('Candidature incomplète.')
    clean = {'name': str(cand.get('name'))[:120], 'city': str(cand.get('city', ''))[:80], 'dip': str(cand.get('dip', ''))[:120],
             'age': int(cand.get('age') or 0) if str(cand.get('age', '0')).isdigit() else 0, 'pieces': str(cand.get('pieces', ''))[:40],
             'score': max(0, min(100, int(cand.get('score') or 0))), 'd': None, 'web': True}
    with transaction.atomic():
        m, _ = ModuleState.objects.select_for_update().get_or_create(cle='recrutement', defaults={'donnees': {}})
        d = m.donnees or {}
        d.setdefault('cands', [])
        clean['id'] = 'C26-ENS-' + str(9000 + len(d['cands'])).zfill(5)
        d['cands'].append(clean)
        m.donnees, m.version = d, m.version + 1
        m.save()
    audit(request, 'Candidature déposée sur le portail public', clean['id'], user='portail-public')
    return JsonResponse({'ok': True, 'id': clean['id']})


# ---------------------------------------------------------------- assistant RH (IA)
@api(['POST'])
def assistant(request):
    if not settings.ANTHROPIC_API_KEY:
        return err('Assistant IA non configuré sur ce serveur.', 503)
    since = timezone.now() - timedelta(hours=1)
    if AppelAssistant.objects.filter(utilisateur=request.user.username, cree_le__gte=since).count() >= settings.ASSISTANT_MAX_PER_HOUR:
        return err('Limite horaire de questions atteinte.', 429)
    b = body(request) or {}
    msgs, tools = b.get('messages'), b.get('tools') or []
    if not isinstance(msgs, list) or not msgs or len(request.body) > 400_000:
        return err('Requête invalide.')
    payload = {'model': settings.ANTHROPIC_MODEL, 'max_tokens': 1500, 'messages': msgs}
    if tools:
        payload['tools'] = [{'name': t['name'], 'description': t.get('description', '')[:1000], 'input_schema': t.get('input_schema') or {'type': 'object', 'properties': {}}} for t in tools[:12] if isinstance(t, dict) and t.get('name')]
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=json.dumps(payload).encode(), method='POST', headers={
        'content-type': 'application/json', 'x-api-key': settings.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = json.loads(r.read())
    except urllib.error.HTTPError as e:
        log.warning('Assistant IA : HTTP %s %s', e.code, e.read()[:500])
        return err('Le service IA a refusé la requête.', 502)
    except Exception as e:
        log.warning('Assistant IA indisponible : %s', e)
        return err('Service IA injoignable.', 502)
    u = out.get('usage') or {}
    AppelAssistant.objects.create(utilisateur=request.user.username, jetons_entree=u.get('input_tokens', 0), jetons_sortie=u.get('output_tokens', 0))
    return JsonResponse({'content': out.get('content', []), 'stop_reason': out.get('stop_reason')})


# ---------------------------------------------------------------- démonstration
@api(['POST'])
def demo_reset(request):
    if not settings.SIGRHE_DEMO_MODE:
        return err('Mode démonstration désactivé.', 403)
    if not (request.ctx.can_admin() or request.ctx.prof == 'DRH'):
        return err('Réservé à l’administrateur ou à la DRH.', 403)
    from .seed import load_demo
    load_demo(reset_modules=True)
    audit(request, 'Réinitialisation des données de démonstration')
    return JsonResponse({'ok': True})


@api(['GET'], auth=False)
def health(request):
    from django.db import connection
    with connection.cursor() as c:
        c.execute('SELECT 1')
    return JsonResponse({'status': 'ok', 'time': timezone.now().isoformat()})
