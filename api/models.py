"""
SIGRHE · modèle de données.

Données de référence et données nominatives en tables relationnelles (PostgreSQL) :
profils, matrice des droits, entités de l'État, comptes, agents, fichiers, journal d'audit, courriels.
Les données de travail propres à chaque module (campagne de paie, circuits d'actes, dossiers de pension…)
sont conservées par module dans un document JSON versionné (ModuleState), avec contrôle des droits
d'écriture par module et détection des conflits de version.
"""
from django.conf import settings
from django.db import models


class Profil(models.Model):
    code = models.CharField(max_length=8, primary_key=True)
    nom = models.CharField(max_length=120)
    nom_court = models.CharField(max_length=60)
    perimetre = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['ordre']

    def __str__(self):
        return f'{self.code} · {self.nom}'


class Rubrique(models.Model):
    """Ligne de la matrice des droits (ex. « Paie · préparation et calcul »)."""
    index = models.PositiveSmallIntegerField(primary_key=True)
    libelle = models.CharField(max_length=120)

    class Meta:
        ordering = ['index']

    def __str__(self):
        return self.libelle


class Droit(models.Model):
    NIVEAUX = [(0, 'Aucun'), (1, 'Lecture'), (2, 'Saisie'), (3, 'Validation'), (4, 'Administration')]
    rubrique = models.ForeignKey(Rubrique, on_delete=models.CASCADE)
    profil = models.ForeignKey(Profil, on_delete=models.CASCADE)
    niveau = models.PositiveSmallIntegerField(choices=NIVEAUX, default=0)

    class Meta:
        unique_together = [('rubrique', 'profil')]


class Entite(models.Model):
    """Ministère, ministère délégué ou institution (répertoire national)."""
    code = models.CharField(max_length=8, primary_key=True)
    sigle = models.CharField(max_length=20)
    libelle = models.CharField(max_length=255)
    libelle_court = models.CharField(max_length=120)
    type = models.CharField(max_length=8)  # etat, min, del, inst
    effectif = models.PositiveIntegerField(default=0)
    tutelle = models.CharField(max_length=8, blank=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f'{self.code} · {self.libelle_court}'


class Compte(models.Model):
    """Profil SIGRHE d'un utilisateur Django."""
    STATUTS = [('Actif', 'Actif'), ('Suspendu', 'Suspendu'), ('En attente', 'En attente de validation')]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='compte')
    profil = models.ForeignKey(Profil, on_delete=models.PROTECT)
    perimetre = models.CharField(max_length=160, help_text='Libellé affiché (ex. « Santé et Population »)')
    entite = models.ForeignKey(Entite, null=True, blank=True, on_delete=models.SET_NULL,
                               help_text='Périmètre de données pour un gestionnaire sectoriel ou un décideur')
    agent_matricule = models.CharField(max_length=20, blank=True, help_text='Pour le profil Agent : son matricule')
    statut = models.CharField(max_length=12, choices=STATUTS, default='Actif')
    mfa_secret = models.CharField(max_length=64, blank=True, help_text='Secret TOTP (base32) ; vide = sans second facteur')
    echecs = models.PositiveSmallIntegerField(default=0)
    verrou_jusqua = models.DateTimeField(null=True, blank=True)
    demo = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.user.username} · {self.profil_id}'


class Agent(models.Model):
    """Fiche de l'agent. Les colonnes servent aux filtres et aux droits ; `donnees` porte la fiche complète."""
    matricule = models.CharField(max_length=20, primary_key=True)
    nom = models.CharField(max_length=80)
    prenom = models.CharField(max_length=80)
    entite = models.ForeignKey(Entite, on_delete=models.PROTECT, related_name='agents')
    statut = models.CharField(max_length=30, db_index=True)
    niu = models.CharField(max_length=40, blank=True, db_index=True)
    donnees = models.JSONField(default=dict)
    modifie_le = models.DateTimeField(auto_now=True)
    modifie_par = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ['matricule']
        indexes = [models.Index(fields=['entite', 'statut']), models.Index(fields=['nom', 'prenom'])]

    def __str__(self):
        return f'{self.matricule} · {self.nom} {self.prenom}'


class ModuleState(models.Model):
    cle = models.CharField(max_length=40, primary_key=True)
    donnees = models.JSONField(default=dict)
    version = models.PositiveIntegerField(default=1)
    modifie_le = models.DateTimeField(auto_now=True)
    modifie_par = models.CharField(max_length=150, blank=True)

    def __str__(self):
        return f'{self.cle} (v{self.version})'


class Audit(models.Model):
    """Piste d'audit : l'horodatage, l'utilisateur et l'adresse IP sont fixés par le serveur."""
    horodatage = models.DateTimeField(auto_now_add=True, db_index=True)
    utilisateur = models.CharField(max_length=150, db_index=True)
    action = models.CharField(max_length=255)
    objet = models.TextField(blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-horodatage', '-id']


def fichier_chemin(instance, filename):
    return f'fichiers/{instance.cree_le:%Y/%m}/{instance.id}'


class Fichier(models.Model):
    id = models.CharField(max_length=40, primary_key=True)
    contexte = models.CharField(max_length=80, db_index=True)  # agent:<matricule>, ged:<id>, pension:<id>…
    categorie = models.CharField(max_length=120, blank=True)
    nom = models.CharField(max_length=255)
    type = models.CharField(max_length=8)
    famille = models.CharField(max_length=8)
    mime = models.CharField(max_length=120, blank=True)
    taille = models.PositiveBigIntegerField()
    sha256 = models.CharField(max_length=64)
    fichier = models.FileField(upload_to=fichier_chemin)
    depose_par = models.CharField(max_length=150)
    cree_le = models.DateTimeField(auto_now_add=True)
    supprime = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.id} · {self.nom}'


class Courriel(models.Model):
    """Courriels de notification réellement envoyés (ou en échec) par le serveur."""
    ref = models.CharField(max_length=60, unique=True)
    destinataire = models.EmailField()
    login = models.CharField(max_length=150, blank=True)
    sujet = models.CharField(max_length=255)
    corps = models.TextField()
    statut = models.CharField(max_length=20, default='En file')
    erreur = models.TextField(blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    envoye_le = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-cree_le']


class AppelAssistant(models.Model):
    """Comptage des appels à l'assistant IA (limitation de débit et suivi des coûts)."""
    utilisateur = models.CharField(max_length=150, db_index=True)
    cree_le = models.DateTimeField(auto_now_add=True, db_index=True)
    jetons_entree = models.PositiveIntegerField(default=0)
    jetons_sortie = models.PositiveIntegerField(default=0)
