from django.contrib import admin
from django.urls import include, path
from api import views

admin.site.site_header = 'SIGRHE · administration technique'
admin.site.site_title = 'SIGRHE'

urlpatterns = [
    path('admin-technique/', admin.site.urls),
    path('api/', include('api.urls')),
    path('', views.index),
]
