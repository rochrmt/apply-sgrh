from django.contrib import admin
from .models import AppelAssistant, Audit, Agent, Compte, Courriel, Droit, Entite, Fichier, ModuleState, Profil, Rubrique


@admin.register(Compte)
class CompteAdmin(admin.ModelAdmin):
    list_display = ('user', 'profil', 'perimetre', 'entite', 'statut', 'demo')
    list_filter = ('profil', 'statut', 'demo')
    search_fields = ('user__username', 'user__last_name', 'perimetre')
    exclude = ('mfa_secret',)


@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = ('matricule', 'nom', 'prenom', 'entite', 'statut', 'modifie_le', 'modifie_par')
    list_filter = ('statut', 'entite')
    search_fields = ('matricule', 'nom', 'prenom', 'niu')


@admin.register(Audit)
class AuditAdmin(admin.ModelAdmin):
    list_display = ('horodatage', 'utilisateur', 'action', 'objet', 'ip')
    list_filter = ('utilisateur',)
    search_fields = ('action', 'objet', 'utilisateur')

    def has_change_permission(self, request, obj=None):
        return False  # la piste d'audit n'est jamais modifiable

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Fichier)
class FichierAdmin(admin.ModelAdmin):
    list_display = ('id', 'nom', 'contexte', 'type', 'taille', 'depose_par', 'cree_le', 'supprime')
    search_fields = ('id', 'nom', 'contexte')


@admin.register(Courriel)
class CourrielAdmin(admin.ModelAdmin):
    list_display = ('cree_le', 'destinataire', 'sujet', 'statut')
    list_filter = ('statut',)


admin.site.register(Profil)
admin.site.register(Rubrique)
admin.site.register(Droit)
admin.site.register(Entite)
admin.site.register(ModuleState)
admin.site.register(AppelAssistant)
