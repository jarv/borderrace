from django.template import RequestContext
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseServerError
from django.shortcuts import render_to_response
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, logout, login
from django.core.context_processors import request
from django.utils import simplejson
from proj.states.forms import LoginForm, RegisterForm
from proj.states.models import GameStats
from django.db.models import Avg, Max, Min
from django.core.urlresolvers import reverse
import random
from time import time
from math import floor
from proj.states.solve import state_path


def explain(request):
    return render_to_response( 'states/explain.html', {},
            context_instance=RequestContext(request));

def servererror(request):
    raise Exception()

def highscores(request):
    mode = request.GET['mode']
    if not (mode == 'normal' or mode =='advanced'):
        # invalid mode
        return HttpResponse('There was an error processing highscores.')
    hs = {}
    stats = {}

    user_data = GameStats.objects.filter(user__isnull=False, mode=mode)
    all_data = GameStats.objects.filter(mode=mode)
    wins = all_data.filter(win=True)
    stats['wins'] = wins.count()
    if (stats['wins'] < 1): # no HS data yet
        return HttpResponse("""<div class='highscores'> no data yet </div>""")
    stats['losses'] = all_data.filter(win=False).count();
    stats['pts_max'] = wins.aggregate(Max('points'))['points__max']
    stats['pts_avg'] = "%d" % round(
            wins.aggregate(Avg('points'))['points__avg'])
    stats['sec_min'] = wins.aggregate(Min('seconds'))['seconds__min']
    stats['sec_avg'] = "%d" % round(
            wins.aggregate(Avg('seconds'))['seconds__avg'])
    hs['points'] = user_data.filter(win=True).order_by('-points', 'seconds')[0:5]
    hs['seconds'] = user_data.filter(win=True).order_by('seconds', '-points')[0:5]
    
    return render_to_response( 'states/highscores.html', {
        'hs' : hs, 
        'stats' : stats, 
        'mode' : mode},
        context_instance=RequestContext(request));


def gameover(request):
    path = []
    wild_list = []
    message = {}
    stats = {}
    pathdata = []
    player = None
    mode = None

    request.session['end_game'] = time()
    sp = request.session['sp']

    if request.method == 'POST':
        mode = request.POST.get('mode')
        wild_list = tuple(request.POST.getlist('wild_list'))
        path = tuple(request.POST.getlist('path'))
    else:
        return render_to_response('states/cheater.html')


    if request.user.is_authenticated():
        player = request.user

    # calculate how long the game took
    start = int(request.session.get('start_game', 0))
    if start == 0:
        # cant determine start time
        return render_to_response('states/cheater.html')

    finish = int(request.session.get('end_game', 0))

    if not (mode == 'normal' or mode =='advanced' or mode=='practice'):
        # invalid mode
        return render_to_response('states/cheater.html')

    delta = finish - start
    if delta < 1:
        return render_to_response('states/cheater.html')

    path_check = sp.validate(path,wild_list)


    if (path_check):
        message['win'] = True
        # calculate points
        points = 0
        for state in path:
            # filename, displayname, pointvalue
            pathdata.append( [state,state, sp.point_values[state] ])
            points += sp.point_values[state]
                

        g = GameStats(user=player, win=True, 
                points=points, states=len(path),
                seconds=delta, ip=request.META['REMOTE_ADDR'],
                mode=mode) 
        g.save()
 
        if delta >= 60:
            message['min'] = "%d" % (floor(delta / 60))
        message['sec'] = "%d" % (delta % 60)

        message['states'] = len(path)  
        message['points'] = points
        message['pathdata'] = pathdata  # state display data


    else:
        for state in sp.path:
            pathdata.append( [state,state, sp.point_values[state] ])
        message['win'] = False
        message['title'] = "Game Over"

        g = GameStats(user=player, win=False, 
                        ip=request.META['REMOTE_ADDR'],
                        seconds=delta,mode=mode)
        g.save()
    # if they aren't registered, display a registration/login form
    form1 = LoginForm()
    form2 = RegisterForm()

    if request.user.is_authenticated():
        # if they are registered, generate some stats
        losses = GameStats.objects.filter(user=player, win=False, mode=mode)
        stats['losses'] = losses.count()
        wins = GameStats.objects.filter(user=player, win=True, mode=mode)
        stats['wins'] = wins.count()
        if (stats['wins'] > 0):
            stats['max_points'] = wins.aggregate(Max('points'))['points__max']
            stats['min_points'] = wins.aggregate(Min('points'))['points__min']
            stats['max_ts'] = wins.aggregate(Max('seconds'))['seconds__max']
            stats['min_ts'] = wins.aggregate(Min('seconds'))['seconds__min']
            if stats['min_ts'] >= 60:
                stats['min_tm'] = "%d" % (floor(stats['min_ts'] / 60))
            stats['min_ts'] = "%d" % (stats['min_ts'] % 60)
            if stats['max_ts'] >= 60:
                stats['max_tm'] = "%d" % (floor(stats['max_ts'] / 60))
            stats['max_ts'] = "%d" % (stats['max_ts'] % 60)
            stats['max_states'] = wins.aggregate(Max('states'))['states__max']
            stats['min_states'] = wins.aggregate(Min('states'))['states__min']


    return render_to_response( 'states/gameover.html', { 
        'message' : message, 
        'pathdata' : pathdata,
        'form1' : form1,
        'form2' : form2,
        'stats' : stats,},
        context_instance=RequestContext(request));


def loginform(request):
    if request.method == 'POST':
        if request.POST['type'] == 'register':
            form = RegisterForm(request.POST)
            if form.is_valid():
                if (form.cleaned_data['regpassword'] ==
                        form.cleaned_data['regpassword2']):
                    #try:
                        if not form.cleaned_data['regemail']:
                            form.cleaned_data['regemail'] = 'noemail@example.com'

                        user = User.objects.create_user(
                               form.cleaned_data['regusername'],
                               form.cleaned_data['regemail'],
                               form.cleaned_data['regpassword'])
                        user.save()

                        user_login = authenticate(
                                username = form.cleaned_data['regusername'],
                                password = form.cleaned_data['regpassword'])
                        login(request,user_login)
                        msg = {'register':'Success'}
                    #except:
                    #    msg = {'register':'Error creating user'}
                else:
                    msg = {'register':"Passwords don't match"}

            else:
                msg = {'register':"Invalid registration"}

        else:  # otherwise assume it's a login request
            form = LoginForm(request.POST)
            if form.is_valid():
                user = authenticate(
                        username = form.cleaned_data['logusername'],
                        password = form.cleaned_data['logpassword'])
                if user is not None:
                    if user.is_active:
                        login(request,user)
                        msg = {'loggedin':"Success"}
                    else:
                        msg = {'loggedin':"Login failed"}
                else:
                    msg = {'loggedin':"Login failed"}
            else:
                msg = {'loggedin':"Login failed"}

        json = simplejson.dumps(msg)
        return HttpResponse(json, mimetype='application/json')

    # if it's not a POST, return the login form
    form1=LoginForm()
    form2=RegisterForm()
    return render_to_response('states/loginform.html',{
        'form1': form1, 'form2':form2 },
        context_instance=RequestContext(request))

def logout_user(request):
   logout(request)
   return HttpResponseRedirect(request.GET['page'])


def startgame(request):
    if not request.session.test_cookie_worked():
        raise Exception() # prob should give the user a better
                          # error here :)

    sp = state_path(24)  # 24 random states out of 48
    request.session['start_game'] = time()
    request.session['sp'] = sp

    return HttpResponse( 
            simplejson.dumps((sorted(sp.states),sorted(sp.wc_states))),
            mimetype='application/json')

def states(request):
    request.session.set_test_cookie()
    return render_to_response('states/index.html', 
            {'user':request.user,
                },
            context_instance=RequestContext(request))


