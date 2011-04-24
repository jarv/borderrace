from django.contrib import admin
from django.db import models
from django.contrib.auth.models import User
    
class GameStats(models.Model):
    user = models.ForeignKey(User, null=True)
    win = models.BooleanField()
    points = models.IntegerField(null=True)
    states = models.IntegerField(null=True)
    created = models.DateTimeField(auto_now_add=True)
    seconds = models.IntegerField(null=True)
    mode = models.CharField(max_length=10)
    ip = models.IPAddressField()

admin.site.register(GameStats)
