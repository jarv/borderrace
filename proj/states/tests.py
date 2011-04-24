"""
    Tests for path checking
"""

from django.test import TestCase
from proj.states.solve import state_path


class PathTest(TestCase):
    def test_statepaths(self):
        """
        Test to make sure we can create a random map
        and perform path calculations
        """
        sp = state_path(24)
        path = sp.path
        print "first found path: " + str(path)
        print "full state list: " + str(sp.states)
        print "full wc state list: " + str(sp.wc_states)
        print "number of paths: " + str( len(list(sp)))
        print "path with least num of points: " + \
                str(len(sp.min_points)) + " / " + str(sp.min_points)
        print "path with shortest route: " + \
                str(len(sp.min)) + " / " + str(sp.min)
        print "path with greatest num of points: " + \
            str(len(sp.max_points)) + " / " + str(sp.max_points)
        print "path with longest route: " + \
            str(len(sp.max)) + " / " + str(sp.max)
        print "valid path check1: " + str(sp.validate(path))  
        wild = (path[1],)
        path[1] = 'wild'
        print "valid path check2 " + str(path) + \
                " / " + str(wild) + " : " + str(sp.validate(tuple(path), wild))  
        print "invalid path check: " + str(sp.validate(tuple(path)))  

