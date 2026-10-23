"""
SIGRHE · contrôle des droits côté serveur.

Le navigateur applique les mêmes règles pour l'affichage, mais c'est le serveur qui décide :
périmètre des agents visibles, écriture des modules, fichiers, matrice des droits, comptes.
"""
from .models import Agent, Droit, Profil

# Lignes de la matrice des droits (voir api/fixtures/reference.json)
R_REPERTOIRE, R_POSTES, R_DOSSIERS, R_ACTES, R_VISA_FIN, R_EVAL, R_FORMATION, R_PRESENCES, \
    R_DISCIPLINE, R_RECRUTEMENT, R_PAIE_PREP, R_PAIE_VALID, R_PENSIONS, R_PILOTAGE, R_AUDIT, R_COMPTES = range(16)

# Écriture d'un module : niveau minimal requis sur au moins une des lignes listées.
# None = tout utilisateur connecté (notifications, préférences techniques).
MODULE_RULES = {
    'notif': None, 'api': None, 'archi': None,
    'org': ([R_REPERTOIRE], 2),
    'postes': ([R_POSTES], 2),
    'offres': ([R_POSTES, R_RECRUTEMENT], 2),
    'carriere': ([R_ACTES, R_VISA_FIN, R_DOSSIERS], 2),
    'evaluation': ([R_EVAL], 2),
    'formation': ([R_FORMATION], 2),
    'presences': ([R_PRESENCES], 2),
    'portail': ([R_PRESENCES, R_DOSSIERS], 2),
    'discipline': ([R_DISCIPLINE], 2),
    'recrutement': ([R_RECRUTEMENT], 2),
    'paie': ([R_PAIE_PREP, R_PAIE_VALID], 2),
    'pp': ([R_PAIE_PREP], 2),
    'pensions': ([R_PENSIONS, R_ACTES, R_VISA_FIN], 2),
    'pen2': ([R_PENSIONS, R_VISA_FIN, R_PAIE_VALID, R_PAIE_PREP], 2),
    'documents': ([R_DOSSIERS], 2),
    'ged': ([R_DOSSIERS, R_ACTES, R_PENSIONS, R_PAIE_PREP], 2),
    'fiches': ([R_DOSSIERS], 2),
    'upl': ([R_DOSSIERS, R_PENSIONS], 2),
    'simu': ([R_PILOTAGE], 1),
    'interop': ([R_AUDIT, R_COMPTES], 1),
}
# Modules que l'agent (espace personnel) peut faire évoluer : ses demandes, ses notifications
AGENT_MODULES = {'portail', 'notif', 'presences', 'carriere', 'ged'}
# Modules lisibles sans connexion (portail public des offres d'emploi)
PUBLIC_MODULES = {'offres'}


class Ctx:
    """Contexte de droits d'un utilisateur, calculé une fois par requête."""

    def __init__(self, user):
        self.user = user
        self.compte = getattr(user, 'compte', None) if user and user.is_authenticated else None
        self.prof = self.compte.profil_id if self.compte else None
        self._lv = {}
        if self.compte:
            for d in Droit.objects.filter(profil_id=self.prof):
                self._lv[d.rubrique_id] = d.niveau

    @property
    def ok(self):
        return bool(self.compte and self.compte.statut == 'Actif' and self.user.is_active)

    def lvl(self, row):
        return self._lv.get(row, 0)

    def can(self, row, level):
        return self.lvl(row) >= level

    @property
    def is_agent(self):
        return self.prof == 'AGT'

    def agents_qs(self):
        qs = Agent.objects.select_related('entite')
        if not self.ok:
            return qs.none()
        if self.is_agent:
            return qs.filter(matricule=self.compte.agent_matricule)
        if self.prof in ('GRH', 'DEC') and self.compte.entite_id:
            return qs.filter(entite_id=self.compte.entite_id)
        return qs

    @property
    def pseudonymise(self):
        """L'administrateur système n'accède à aucune donnée nominative."""
        return self.prof == 'ADM' or self.lvl(R_DOSSIERS) == 0 and not self.is_agent and not any(
            self.lvl(r) for r in (R_PAIE_PREP, R_PAIE_VALID, R_PENSIONS, R_ACTES, R_VISA_FIN))

    def can_write_module(self, key):
        if not self.ok:
            return False
        if self.is_agent:
            return key in AGENT_MODULES
        rule = MODULE_RULES.get(key, 'unknown')
        if rule is None:
            return True
        if rule == 'unknown':
            return any(v >= 2 for v in self._lv.values())
        rows, level = rule
        return any(self.can(r, level) for r in rows)

    def can_write_agents(self):
        return self.ok and not self.is_agent and any(
            self.can(r, 2) for r in (R_DOSSIERS, R_ACTES, R_VISA_FIN, R_PAIE_PREP, R_PAIE_VALID, R_PENSIONS))

    def can_see_all_audit(self):
        return self.can(R_AUDIT, 1)

    def can_admin(self):
        return self.can(R_COMPTES, 4)

    def file_access(self, contexte, write=False):
        """Accès à un fichier selon son contexte (agent:<mat>, ged:…, pension:…, pensionne:…)."""
        if not self.ok:
            return False
        need = 2 if write else 1
        if contexte.startswith('agent:'):
            mat = contexte.split(':', 1)[1]
            if self.is_agent:
                return mat == self.compte.agent_matricule and not write
            return self.can(R_DOSSIERS, need) and self.agents_qs().filter(matricule=mat).exists()
        if contexte.startswith(('pension:', 'pensionne:')):
            return self.can(R_PENSIONS, need) or (not write and self.can(R_VISA_FIN, 1))
        if contexte.startswith('ged:'):
            return self.can(R_DOSSIERS, need) or (write and self.can(R_PENSIONS, 2))
        return self.can(R_DOSSIERS, need)


def matrix():
    """Matrice complète [rubrique][profil] dans l'ordre des profils."""
    profs = list(Profil.objects.order_by('ordre').values_list('code', flat=True))
    rows = {}
    for d in Droit.objects.all():
        rows.setdefault(d.rubrique_id, {})[d.profil_id] = d.niveau
    n = max(rows.keys(), default=-1) + 1
    return [[rows.get(i, {}).get(p, 0) for p in profs] for i in range(n)], profs
