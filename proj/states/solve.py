import random

class state_path:

    def __init__(self, num=24,path=None,wilds=None):
        self.regen(num)

    def validate(self, path, wilds=()):
        # validates a path 

        if not isinstance(path, list):
            path = list(path)
        if not isinstance(wilds,list):
            wilds = list(wilds)
        path = filter(lambda x: x in self.states,path)
        wilds= filter(lambda x: x in self.states,wilds)

        if len(path) < 1:
            return False

        if not (path[0] in self.startlist and path[-1] in self.endlist or \
                path[0] in self.endlist and path[-1] in self.startlist):
            return False
        graph = self.r_borders

        # add the wildcard states to the border graph for path calculation
        graph_w = dict((s, list(set(self._borders[s]) & set(wilds + path))) \
                for s in wilds)
        graph.update(graph_w)

        for p in self.find_path(graph, path[0], path[-1]):
            if p:
                return(p)

        return False


    def regen(self, num=24, start=None, end=None):
        self._paths = None
        self.path = None  
        self.states = None
        self.wc_states = None
        self.r_borders = None

        if start is None:
            start_list = self._ec_states
        if end is None:
            end_list = self._wc_states

        if len(set(self._borders.keys()) & set( start_list + end_list )) == 0:
            raise NameError('Invalid start or end state specified')

        for i in range(100000):
            rs = set(random.sample(self._borders.keys(), num))
            start_filt = list(rs & set(start_list))
            end_filt = list(rs & set(end_list))
            if len(start_filt) == 0 or len(end_filt) == 0:
                continue
            # create a new border graph using the radom states
            graph = dict((k, list( set(self._borders[k]) & rs )) for k in rs)
            # look for at least one valid path
            for start in start_filt:
                for end in end_filt:
                    for p in self.find_path(graph, start, end):
                        if p:
                            self.r_borders = graph
                            self.states = graph.keys()
                            self.wc_states = list(set(self._borders.keys()) - set(graph.keys()))
                            self.path = p
                            self.startlist = start_filt
                            self.endlist = end_filt
                            return p

        raise NameError('Gave up trying to find a valid path')


#    def plot(self):
#        gen = UniqueIdGenerator()
#        map(lambda x: gen[x], self.r_borders.keys())
#        g = Graph(edges=list( (gen[a],gen[b]) for a in self.r_borders.keys() for b in self.r_borders[a]))
#        g.vs["label"] = gen.values()
#        layout = g.layout("kk")
#        plot(g, layout=layout)
#

    @property
    def min(self):
        return min(self.all_paths, key=lambda x: len(x))        

    @property
    def max(self):
        return max(self.all_paths, key=lambda x: len(x))        

    @property
    def min_points(self):
        return min(self.all_paths, 
                key=lambda x:sum(self.point_values[s] for s in x))

    @property
    def max_points(self):
        return max(self.all_paths, 
                key=lambda x:sum(self.point_values[s] for s in x))

    @property
    def all_paths(self):
        if self._paths is None:
            self._paths = []
            for start in self.startlist:
                for end in self.endlist:
                    for path in self.find_path(self.r_borders, start, end):
                        self._paths.append(path)
            return self._paths
        else:
            return self._paths



    def __iter__(self):
        i = 0
        for start in self.startlist:
            for end in self.endlist:
                for path in self.find_path(self.r_borders, start, end):
                    yield path
                    i += 1

    def find_path(self, graph, start, end, path=[]):
        path = path + [start]
        if start == end:
            yield path
        if not graph.has_key(start):
            return
        for node in graph[start]:
            if node not in path:
                for new_path in self.find_path(graph, node, end, path):
                    if new_path:
                        yield new_path
        return


    def Dijkstra( graph, source, dest ):

        # for our purposes None == Infinity 

        dist = {}
        previous = {}
        Q = graph.copy()

        for vertex in graph:
            dist[vertex] = None
            previous[vertex] = None

        dist[source] = 0
        while (len(Q) != 0):
            # Q is the queue for all nodes that have not been processed,
            # from these filter ones that have as assigned distance
            nodes = filter (lambda x : dist[x]!=None , Q.keys())
            if len(nodes) == 0:
                break;  # all remaining nodes in Q are inaccessible
            u = min(nodes, key=lambda x : dist.get(x))
            if (u == dest):
                break
            for neighbor in Q[u]:
                if not neighbor in Q:
                    continue
                alt = dist[u] + 1
                if alt < dist[neighbor] or dist[neighbor] == None:
                    dist[neighbor] = alt
                    previous[neighbor] = u
            del(Q[u])
            # node is processed, remove from queue

        # calculate the path using
        # the array of previous nodes
        u = dest
        path = []
        while previous[u] != None:
            path.insert(0,u)
            u = previous[u]
        path.insert(0,source)

        return dist[dest],path


    _borders = {
        "AL": ["FL","GA","MS","TN" ],
        "AZ": ["CA","CO","NV","NM","UT"  ],
        "AR": ["LA","MS","MO","OK","TN","TX"  ],
        "CA": ["OR","NV","AZ"  ],
        "CO": ["AZ","KS","NE","NM","OK","UT","WY"  ],
        "CT": ["MA","NY","RI" ],
        "DE": ["MD","NJ","PA"  ],
        "FL": ["GA","AL"  ],
        "GA": ["FL","AL","TN","NC","SC"  ],
        "ID": ["MT","NV","OR","UT","WA","WY" ],
        "IL": ["IN","KY","MO","IA","WI"  ],
        "IN": ["IL","KY","MI","OH" ],
        "IA": ["IL","NE","MN","MO","SD","WI"  ],
        "KS": ["CO","MO","NE","OK"  ],
        "KY": ["IL","IN","MO","OH","TN","VA","WV"  ],
        "LA": ["AR","MS","TX"  ],
        "ME": ["NH"],
        "MD": ["DE","PA","VA","WV"],
        "MA": ["CT","NH","NY","RI","VT" ],
        "MI": ["WI","OH","IN","MN" ],
        "MN": ["IA","MI","ND","SD","WI"  ],
        "MS": ["AL","AR","LA","TN"  ],
        "MO": ["AR","IL","IA","KS","KY","NE","OK","TN"  ],
        "MT": ["ID","ND","SD","WY"  ],
        "NE": ["CO","IA","KS","MO","SD","WY"  ],
        "NV": ["AZ","CA","ID","OR","UT"  ],
        "NH": ["ME","MA","VT"  ],
        "NJ": ["NY","PA","DE"  ],
        "NM": ["AZ","CO","OK","TX","UT"  ],
        "NY": ["VT","MA","CT","NJ","PA","RI"  ],
        "NC": ["GA","SC","TN","VA"  ],
        "ND": ["MN","MT","SD"  ],
        "OH": ["PA","WV","KY","IN","MI"  ],
        "OK": ["AR","CO","KS","MO","NM","TX"  ],
        "OR": ["CA","ID","NV","WA"  ],
        "PA": ["NY","NJ","DE","MD","WV","OH"  ],
        "RI": ["CT","MA","NY"  ],
        "SC": ["GA","NC"  ],
        "SD": ["IA","MN","MT","NE","ND","WY"  ],
        "TN": ["AL","AR","GA","KY","MS","MO","NC","VA"],
        "TX": ["AR","LA","NM","OK"  ],
        "UT": ["AZ","CO","ID","NV","NM","WY"  ],
        "VT": ["MA","NH","NY"  ],
        "VA": ["KY","MD","NC","TN","WV"  ],
        "WA": ["ID","OR"  ],
        "WV": ["KY","MD","OH","PA","VA"  ],
        "WI": ["MN","MI","IA","IL"  ],
        "WY": ["CO","MT","NE","SD","UT","ID"],
    };
    _ec_states = [ "ME", "NH", "MA", "RI", "CT", "NJ", "NY", "DE",
                      "MD", "VA", "NC", "SC", "GA", "FL", ]
    _wc_states = [ "CA", "OR", "WA", ]

    point_values = {
        "AL": 1, "AZ": 2, "AR": 1, "CA": 1, "CO": 1, "CT": 3, "DE": 2,
        "FL": 2, "GA": 1, "ID": 2, "IL": 2, "IN": 1, "IA": 2, "KS": 1,
        "KY": 1, "LA": 1, "ME": 4, "MD": 1, "MA": 3, "MI": 3, "MN": 2,
        "MS": 1, "MO": 1, "MT": 2, "NE": 2, "NV": 1, "NH": 3, "NJ": 2,
        "NM": 3, "NY": 3, "NC": 1, "ND": 2, "OH": 2, "OK": 2, "OR": 2,
        "PA": 3, "RI": 3, "SC": 2, "SD": 1, "TN": 1, "TX": 2, "UT": 2,
        "VT": 3, "VA": 1, "WA": 3, "WV": 1, "WI": 3, "WY": 1, "wild": 0,
    }


sp=state_path(24)
