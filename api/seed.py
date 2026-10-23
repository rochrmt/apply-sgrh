"""Chargement des données de référence et des données de démonstration."""
import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction

from .models import Agent, Audit, Compte, Droit, Entite, Fichier, ModuleState, Profil, Rubrique

DATA_DIR = Path(__file__).resolve().parent / 'data'


def _json(name):
    return json.loads((DATA_DIR / name).read_text(encoding='utf-8'))


@transaction.atomic
def load_reference(reset_rights=False):
    """Profils, rubriques de la matrice, droits par défaut, répertoire des entités. Idempotent."""
    ref = _json('reference.json')
    for i, p in enumerate(ref['P']):
        Profil.objects.update_or_create(code=p[0], defaults={'nom': p[1], 'nom_court': p[2], 'perimetre': p[3], 'description': p[4], 'ordre': i})
    for i, lib in enumerate(ref['R']):
        Rubrique.objects.update_or_create(index=i, defaults={'libelle': lib})
    profs = [p[0] for p in ref['P']]
    for i, row in enumerate(ref['BASE']):
        for j, v in enumerate(row):
            d, created = Droit.objects.get_or_create(rubrique_id=i, profil_id=profs[j], defaults={'niveau': v})
            if reset_rights and not created and d.niveau != v:
                d.niveau = v
                d.save()
    for e in ref['E']:
        Entite.objects.update_or_create(code=e[0], defaults={'sigle': e[1], 'libelle': e[2], 'libelle_court': e[3], 'type': e[4],
                                                             'effectif': e[5] or 0, 'tutelle': (e[6] if len(e) > 6 and e[6] else '')})
    return len(ref['P']), len(ref['E'])


def _entite_for_scope(scope):
    sc = (scope or '').lower().replace('agrégats ', '').strip()
    for e in Entite.objects.all():
        lc = e.libelle_court.lower()
        if lc == sc or lc.startswith(sc):
            return e
    return None


@transaction.atomic
def load_demo(reset_modules=False, email_domain=''):
    """Agents fictifs, comptes de démonstration (un par profil), journal initial."""
    load_reference(reset_rights=reset_modules)
    demo = _json('demo.json')
    keys = ['mat', 'nom', 'prenom', 'sx', 'yob', 'lieu', 'code', 'sig', 'min', 'grade', 'fonction', 'ville', 'indice', 'statut', 'entree', 'net', 'canal', 'niu']
    for r in demo['A']:
        d = dict(zip(keys, r))
        d['hist'] = []
        Agent.objects.update_or_create(matricule=d['mat'], defaults={'nom': d['nom'], 'prenom': d['prenom'], 'entite_id': d['code'], 'statut': d['statut'], 'niu': d['niu'], 'donnees': d})
    pwd = settings.SIGRHE_DEMO_PASSWORD
    for u in demo['users']:
        user, _ = User.objects.get_or_create(username=u['login'])
        parts = u['name'].split(' ', 1)
        user.last_name, user.first_name = parts[0], parts[1] if len(parts) > 1 else ''
        user.email = (u['login'].replace('.', '-') + '@' + email_domain) if email_domain else ''
        user.is_active = True
        user.set_password(pwd)
        user.save()
        Compte.objects.update_or_create(user=user, defaults={
            'profil_id': u['prof'], 'perimetre': u['scope'], 'statut': 'Actif', 'demo': True, 'mfa_secret': '', 'echecs': 0, 'verrou_jusqua': None,
            'entite': _entite_for_scope(u['scope']) if u['prof'] in ('GRH', 'DEC') else None,
            'agent_matricule': u['login'] if u['prof'] == 'AGT' else ''})
    if reset_modules:
        ModuleState.objects.all().delete()
        Fichier.objects.update(supprime=True)
    if not Audit.objects.exists():
        for l in reversed(demo['log']):
            Audit.objects.create(utilisateur=l['u'], action=l['a'], objet=l['o'])
    return len(demo['A']), len(demo['users'])
