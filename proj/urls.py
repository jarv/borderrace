from django.conf.urls.defaults import *

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('',
    # Example:
    # (r'^proj/', include('proj.foo.urls')),

    # Uncomment the admin/doc line below and add 'django.contrib.admindocs' 
    # to INSTALLED_APPS to enable admin documentation:
    (r'^admin/doc/', include('django.contrib.admindocs.urls')),
    # Uncomment the next line to enable the admin:
    (r'^admin/', include(admin.site.urls)),
)

urlpatterns += patterns('proj.states.views',
        url(r'^$', 'states', name='states'),
        url(r'^states/', 'states', name='states1'),
        url(r'^startgame/', 'startgame', name='startgame'),
        url(r'^logout/', 'logout_user', name='logout_user'),
        url(r'^loginform/','loginform', name='loginform'),
        url(r'^gameover/','gameover', name='gameover'),
        url(r'^highscores/','highscores', name='highscores'),
        url(r'^servererror/','servererror', name='servererror'),
        url(r'^explain/','explain', name='explain'),
        )
