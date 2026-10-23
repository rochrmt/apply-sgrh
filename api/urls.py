from django.urls import path
from . import views

urlpatterns = [
    path('bootstrap', views.bootstrap),
    path('login', views.api_login),
    path('logout', views.api_logout),
    path('modules', views.modules_since),
    path('modules/<str:key>', views.module),
    path('agents-lot', views.agents_lot),
    path('agents/<str:mat>', views.agent),
    path('audit', views.audit_add),
    path('matrice', views.matrice),
    path('comptes', views.comptes),
    path('fichiers', views.files_upload),
    path('fichiers/<str:fid>', views.files_get),
    path('public/candidature', views.candidature),
    path('assistant', views.assistant),
    path('demo/reset', views.demo_reset),
    path('sante', views.health),
]
