// all globals 
state_list = [];  // list of states that are dropped, ex: ["AL", "IL"..]
wild_list = []; // list of wildcard states active, ex: ["NY", "NJ", ..]
wild_neighbor = ""; // position adjacent card to the wild card ex: "0"
wildcards = []; // full list of available wildcards to pick
                // from, ex: ["AL", "TX", ..]
points = 0;  // number of points
seconds = 0; // number of seconds left to play
is_gameover = false;
game_started = false;
var intval = 0;

$("#normal").click( function(e) {
    e.preventDefault();
    mode='normal';
    get_cards();
});

$("#practice").click( function(e) {
    e.preventDefault();
    mode='practice';
    get_cards();
});

$("#advanced").click( function(e) {
    e.preventDefault();
    mode='advanced';
    get_cards();
});

$("#gameover").click( function(e) {
    e.preventDefault();
    gameover();
});



// register all cards for clicks
$('.statecard').each( function() {
    $(this).click(function() {
        if (!game_started) {
            mode='normal';
            get_cards();
            return;
        }
        $('#message').html('');
        var id = $(this).attr('id');
        if (jQuery.inArray(id, wild_list) > -1) {
           showmsg(long_names[id] + " is already played as a wild card", 
                "info");

        } else if (jQuery.inArray(id, state_list) == -1 ) {
            // new state
            if (check_border(id)) {
                $('#' + id).css({
                    'opacity' : '.4',
                });
                map_add(id);
                state_list.push(id);
                pathdisp();
                check_path();
            }

        } else { 
            while (jQuery.inArray(id, state_list) > -1) {
                // state that was clicked is already placed
                // starting from the one that was clicked,
                // remove all cards 
                var state = state_list.pop();
                $('#' + state).css({
                    'opacity' : '1.0',
                });
                map_remove(state);
            }
            pathdisp();
            check_path();
        } 

    });

});

// register map states for clicks only to remove
$('.state').each( function() {
        
    $(this).click(function() {
        var id = $(this).attr('id');
        while (jQuery.inArray(id, state_list) > -1) {
            // starting from the one that was clicked,
            // remove all cards 
            var state = state_list.pop();
            $('#' + state).css({
                'opacity' : '1.0',
            });
            map_remove(state);
        }
        pathdisp();
    });        
});



$('#help').click( function(e) {
    e.preventDefault();
    // load the login form using ajax

    $.ajax({
        url: "{% url explain %}",
        success: function(data) {
                $(data).modal({
                    closeHTML: "<a href='#' title='Close' class='modal-close'><img src='{{ MEDIA_URL }}images/close-icon1.png' alt=''></a>",
                    position: ["10%",],
                    minHeight: 500,
                    overlayId: 'popup-overlay',
                    containerId: 'popup-container-ex',
                    //onShow: login.button_events,
                    onClose: function() {
                        $('#popup-container-ex').animate({
                            height: 20 
                        }, function () {
                               $.modal.close();
                        });
                    },
                });
        },
        error: function() {
            window.location.href='{% url servererror %}';
        },

    });

});



$('#highscores').click(function (e) {
    e.preventDefault();
    // load the login form using ajax

    $.ajax({
        url: "{% url highscores %}?mode=normal",
        success: function(data) {
                $(data).modal({
                    closeHTML: "<a href='#' title='Close' class='modal-close'><img src='{{ MEDIA_URL }}images/close-icon1.png' alt=''></a>",
                    position: ["10%",],
                    overlayId: 'popup-overlay',
                    minHeight: 600,
                    autoResize: true,
                    autoPosition: true,
                    containerId: 'popup-container-hs',
                    //onShow: login.button_events,
                    onClose: function() {
                        $('#popup-container-hs').animate({
                            height: 20 
                        }, function () {
                               $.modal.close();
                        });
                    },
                });
        },
        error: function() {
            window.location.href='{% url servererror %}';
        },

    });

});

$('#highscores-adv').click(function (e) {
    e.preventDefault();
    // load the login form using ajax

    $.ajax({
        url: "{% url highscores %}?mode=advanced",
        success: function(data) {
                $(data).modal({
                    closeHTML: "<a href='#' title='Close' class='modal-close'><img src='{{ MEDIA_URL }}images/close-icon1.png' alt=''></a>",
                    position: ["10%",],
                    overlayId: 'popup-overlay',
                    minHeight: 600,
                    autoResize: true,
                    autoPosition: true,
                    containerId: 'popup-container-hs',
                    //onShow: login.button_events,
                    onClose: function() {
                        $('#popup-container-hs').animate({
                            height: 20 
                        }, function () {
                               $.modal.close();
                        });
                    },
                });
        },
        error: function() {
            window.location.href='{% url servererror %}';
        },

    });

});


if (typeof console == "undefined") {
    console = { log: function() {} };
}


function pathdisp() {
    var str = []; 
    for (var state in state_list) {
        str.push('<img src="{{MEDIA_URL}}images/abbrev_small/' + state_list[state] + '.png" />');
    }
    $('#pathdisp').html(str.join('<img src="{{MEDIA_URL}}images/rightarrow.png" />'));
}

function gameover(path) {

    // reset the clock
    clearInterval(intval);
    $('#clock').html('');
    seconds = 0;

    if (is_gameover) {
        return;
    }
    is_gameover = true;

    $.ajax({
        url: "{% url gameover %}", 
        data: {'path': state_list, 'wild_list' : wild_list, 'mode' : mode},
        type: 'post',
        success:  function(data){
            // create a modal dialog with the data
            $(data).modal({
                closeHTML: "<a href='#' title='Close' class='modal-close'><img src='{{ MEDIA_URL }}images/close-icon1.png' alt=''></a>",
                position: ["10%",],
                minHeight: 600,
                overlayId: 'popup-overlay',
                containerId: 'popup-container-go',
                onShow: gameover_show,
                onClose: gameover_close,
            });
        },
        error: function() {
//   window.location.href='{% url servererror %}';
        },

       traditional: true,
    });


}


function gameover_show() {

    login.button_events();

    $('.popup-playagain').click( function() {
        $.modal.close();
        get_cards();
    });
    // re-enable game buttons
    $('#game_b').hide();
    $('#newgame_b').show();



}


function gameover_close() {
    $('#popup-container-go').animate({
        height: 20 
    }, function () {
           $.modal.close();
    });
}



function get_cards() {
    game_started = true;
    $('#newgame_b').fadeOut('slow', function() {
        $('#game_b').fadeIn('slow', function() { 
            $('#gameover').html('Give Up');
        });
    });
    $.ajax({
        url: '{% url startgame %}',
        cache: 'false',
        dataType: 'json',
        success: showcards,
        error: function() {
         window.location.href='{% url servererror %}';
        },
     });
}


function point_update(name, op) {
    if (op == "add") {
        points += point_values[name];
    } else if (op == "sub") {
        points -= point_values[name];
    }

    if (points > 0 ) {

        $('#points').fadeOut('fast', function() {
            $('#points p').html(points + 'pts');
            $('#points').fadeIn('fast', function() { });
        });
    } else {
        $('#points p').html('');
        $('#points').css( {
                'background-color' : '',
                'border' : '',
        });
        points = 0;
    }

}


function showcards(data)  {

    if (mode == 'advanced') {
        $('.maparea').css({
            backgroundImage: "url('{{ MEDIA_URL }}images/usa3.png')"
        });
    } else {
        $('.maparea').css({
            backgroundImage: "url('{{ MEDIA_URL }}images/usa2.png')"
        });
    }
    is_gameover = false;

    wildcards = data[1];
    var card_list = data[0];
    for (var i=0; i<24; i++) {
        // if any styles are set, reset them
        $('.' + i).attr('style','');
        var id = card_list[i];
        // assign the card IDs
        $('.' + i).attr('id',id);
        // set the state seal bg image
        $('.' + i).css({
            'backgroundImage' : 
            "url('{{ MEDIA_URL }}images/seals/trans_33/" + id + ".png')",
        });
        // set the cardtext
        $('.' + i + ' .cardtext').html(
                '<img src="{{MEDIA_URL}}images/abbrev/' + id + '.png" />'
                ); 
        $('.' + i + ' .labeltext').html(
                long_names[id] + '<br />' + point_values[id] + 'pts');

        // add classes for west coast vs. east coast states     
        if ( ec_states[id]  || wc_states[id] ) {
            $('.' + i).addClass('endstate');
        } else {
            $('.' + i).removeClass('endstate');
        } 

    }

    $('.statewild').css({
        'backgroundImage' : 
            'url("{{ MEDIA_URL }}images/gadsden/gadsden1.png")',
    });

    clearInterval(intval);
    seconds = 300;  // client side timer, 3min default 
    time = new Date().getTime(); // tracks unix time using 
                             // the system clock every sec
    intval = setInterval(function () {
            if (mode == 'practice') {
                $('#clock').html('');
                return;
            } else if (seconds <= 0) {
                gameover();
            } else {
                seconds = seconds - (Math.round(
                        (new Date().getTime() - time) / 1000)); 
                var min = Math.floor( seconds / 60 );
                var sec = seconds % 60;
                var disptime = sprintf('%d:%02d', min, sec);
                $('#clock').html(disptime);
                time = new Date().getTime();
            }
    }, 1000);
    resetboard();
}


function map_add(id) {
    // adds state to the US map, updates list of wild cards
    point_update(id,"add");
    if (id == 'wild') {
        last_card = state_list[state_list.length-1];
        wild_neighbor = last_card;
        for (var state in borders[last_card]) {
            if (jQuery.inArray(state, state_list) > -1) {
                // only color states that are not 
                // already placed
                continue;
            }
            $('.maparea #' + state).css ({
                'backgroundImage' : 
                    "url('{{ MEDIA_URL }}images/states/yellow/trans_25/"
                            + state + ".png')",
            });
            wild_list.push(state);
        }


    } else {
       //$('.maparea #' + id).effect("scale", {percent:200},0);
       $('.maparea #' + id).css ({
          'backgroundImage' :
            "url('{{ MEDIA_URL }}images/states/red/trans_33/" + id + ".png')",
       }).show();
    }

}

function map_remove(id) {
    point_update(id,"sub");
    // removes state from the US map, updates list of wild cards
    if (id == 'wild') {

        for (var state in wild_list) {
            $('.maparea #' + wild_list[state]).css ({
                'backgroundImage' : '',
            });
        }
        wild_list = [];

    } else {
       $('.maparea #' + id).css ({
          'backgroundImage' : '',
        });
        
    }

}

function check_border(id) {
    if ( state_list.length == 0) {
        // if it's the first card all we need to verify is that
        // it is an end state
       if (ec_states[id] || wc_states[id] ) {
           return true;
       } else {
           showmsg(long_names[id] + " is not a coastal state", "info");
       }

    } else if (id == 'wild') {
        // always return true for the wild card
        return true;
    
    } else {
        // otherwise verify it is a correct border state 
        last_card = state_list[state_list.length-1];
        if (last_card == 'wild') {
            for (var state in wild_list) {
                if (borders[wild_list[state]][id]) {
                    return true;
                }
            }
            showmsg(long_names[id] + " does not border " +
                      " any of the wild card states ", "info");
        } else {
            if (borders[last_card][id]) {
                return true;
            } else {
                showmsg(long_names[id] + " does not border " +
                   long_names[last_card] , "info");
            }
        }
    } 
}


function resetboard() {

    $('#points p').html('');
    $('#points').css( {
            'background-color' : '',
            'border' : '',
    });
    $('#message').html('');
    // reset the map
    $('.state').each( function() {
        $(this).css({
            'backgroundImage' : '',
        });
    });    
    $('.statecard').each( function() {
        $(this).css({
            'opacity' : '1.0',
        });
    });
    $('#pathdisp').html('');
    state_list = [];
    wild_list = []; // reset wild card list
    wild_neighbor = ""; 
    points = 0;
}

function showmsg(message, type) {
    if (type=="error") {
        $('#message').css( {
            'color' : 'red',
        });
    } else if ( type == "info" ) {
        $('#message').css( {
            'color' : 'blue',
        });
    }    
    if (type == "clear") {
        $('#message').html('');
    } else {
        $('#message').html(message);
        $('#message').fadeIn('slow', function() {
            $('#message').fadeOut('5000', function() { });
        });
    }

}


function check_path() {
    // checks to see if  east and west coast states are connected
    // returns true or false if the path is valid
    first = state_list[0];
    last = state_list[state_list.length - 1];

    if (ec_states[first] && wc_states[last]) {
        $('#gameover').html('Path complete!<br /><span style="font-size:12px">Click to Finish</span>');
        return true;
    } else if (ec_states[last] && wc_states[first]) {
        $('#gameover').html('Path complete!<br /><span style="font-size:12px">Click to Finish</span>');
        return true;
    } else {
        $('#gameover').html('Give Up');
        return false;
    }

}

/* globals */

long_names = {
    "AL" : "Alabama", "AZ" : "Arizona", "AR" : "Arkansas", 
    "CA" : "California", "CO" : "Colorado", "CT" : "Connecticut", 
    "DE" : "Delaware", "FL" : "Florida", "GA" : "Georgia", 
    "ID" : "Idaho", "IL" : "Illinois", "IN" : "Indiana", 
    "IA" : "Iowa", "KS" : "Kansas", "KY" : "Kentucky", 
    "LA" : "Louisiana", "ME" : "Maine", "MD" : "Maryland", 
    "MA" : "Massachusetts", "MI" : "Michigan", 
    "MN" : "Minnesota", "MS" : "Mississippi", "MO" : "Missouri", 
    "MT" : "Montana", "NE" : "Nebraska", "NV" : "Nevada", 
    "NH" : "New Hampshire", "NJ" : "New Jersey", "NM" : "New Mexico", 
    "NY" : "New York", "NC" : "North Carolina", "ND" : "North Dakota", 
    "OH" : "Ohio", "OK" : "Oklahoma", "OR" : "Oregon", 
    "PA" : "Pennsylvannia", "RI" : "Rhode Island", 
    "SC" : "South Carolina", "SD" : "South Dakota", 
    "TN" : "Tennessee", "TX" : "Texas", "UT" : "Utah", "VT" : "Vermont", 
    "VA" : "Virginia", "WA" : "Washington", "WV" : "West Virginia", 
    "WI" : "Wisconsin", "WY" : "Wyoming", "wild": "Wild Card"};

point_values = {
    "AL": 1,
    "AZ": 2,
    "AR": 1,
    "CA": 1,
    "CO": 1,
    "CT": 3,
    "DE": 2,
    "FL": 2,
    "GA": 1,
    "ID": 2,
    "IL": 2,
    "IN": 1,
    "IA": 2,
    "KS": 1,
    "KY": 1,
    "LA": 1,
    "ME": 4,
    "MD": 1,
    "MA": 3,
    "MI": 3,
    "MN": 2,
    "MS": 1,
    "MO": 1,
    "MT": 2,
    "NE": 2,
    "NV": 1,
    "NH": 3,
    "NJ": 2,
    "NM": 3,
    "NY": 3,
    "NC": 1,
    "ND": 2,
    "OH": 2,
    "OK": 2,
    "OR": 2,
    "PA": 3,
    "RI": 3,
    "SC": 2,
    "SD": 1,
    "TN": 1,
    "TX": 2,
    "UT": 2,
    "VT": 3,
    "VA": 1,
    "WA": 3,
    "WV": 1,
    "WI": 3,
    "WY": 1,
    "wild": 0,
};


borders = {
    "AL": {"FL":true,"GA":true,"MS":true,"TN":true},
    "AZ": {"CA":true,"CO":true,"NV":true,"NM":true,"UT":true},
    "AR": {"LA":true,"MS":true,"MO":true,"OK":true,"TN":true,"TX":true},
    "CA": {"OR":true,"NV":true,"AZ":true},
    "CO": {"AZ":true,"KS":true,"NE":true,"NM":true,"OK":true,"UT":true,"WY":true},
    "CT": {"MA":true,"NY":true,"RI":true},
    "DE": {"MD":true,"NJ":true,"PA":true},
    "FL": {"GA":true,"AL":true},
    "GA": {"FL":true,"AL":true,"TN":true,"NC":true,"SC":true},
    "ID": {"MT":true,"NV":true,"OR":true,"UT":true,"WA":true,"WY":true},
    "IL": {"IN":true,"KY":true,"MO":true,"IA":true,"WI":true},
    "IN": {"IL":true,"KY":true,"MI":true,"OH":true},
    "IA": {"IL":true,"NE":true,"MN":true,"MO":true,"SD":true,"WI":true},
    "KS": {"CO":true,"MO":true,"NE":true,"OK":true},
    "KY": {"IL":true,"IN":true,"MO":true,"OH":true,"TN":true,"VA":true,"WV":true},
    "LA": {"AR":true,"MS":true,"TX":true},
    "ME": {"NH":true},
    "MD": {"DE":true,"PA":true,"VA":true,"WV":true},
    "MA": {"CT":true,"NH":true,"NY":true,"RI":true,"VT":true},
    "MI": {"WI":true,"OH":true,"IN":true,"MN":true},
    "MN": {"IA":true,"MI":true,"ND":true,"SD":true,"WI":true},
    "MS": {"AL":true,"AR":true,"LA":true,"TN":true},
    "MO": {"AR":true,"IL":true,"IA":true,"KS":true,"KY":true,"NE":true,"OK":true,"TN":true},
    "MT": {"ID":true,"ND":true,"SD":true,"WY":true},
    "NE": {"CO":true,"IA":true,"KS":true,"MO":true,"SD":true,"WY":true},
    "NV": {"AZ":true,"CA":true,"ID":true,"OR":true,"UT":true},
    "NH": {"ME":true,"MA":true,"VT":true},
    "NJ": {"NY":true,"PA":true,"DE":true},
    "NM": {"AZ":true,"CO":true,"OK":true,"TX":true,"UT":true},
    "NY": {"VT":true,"MA":true,"CT":true,"NJ":true,"PA":true,"RI":true},
    "NC": {"GA":true,"SC":true,"TN":true,"VA":true},
    "ND": {"MN":true,"MT":true,"SD":true},
    "OH": {"PA":true,"WV":true,"KY":true,"IN":true,"MI":true},
    "OK": {"AR":true,"CO":true,"KS":true,"MO":true,"NM":true,"TX":true},
    "OR": {"CA":true,"ID":true,"NV":true,"WA":true},
    "PA": {"NY":true,"NJ":true,"DE":true,"MD":true,"WV":true,"OH":true},
    "RI": {"CT":true,"MA":true,"NY":true},
    "SC": {"GA":true,"NC":true},
    "SD": {"IA":true,"MN":true,"MT":true,"NE":true,"ND":true,"WY":true},
    "TN": {"AL":true,"AR":true,"GA":true,"KY":true,"MS":true,"MO":true,"NC":true,"VA":true},
    "TX": {"AR":true,"LA":true,"NM":true,"OK":true},
    "UT": {"AZ":true,"CO":true,"ID":true,"NV":true,"NM":true,"WY":true},
    "VT": {"MA":true,"NH":true,"NY":true},
    "VA": {"KY":true,"MD":true,"NC":true,"TN":true,"WV":true},
    "WA": {"ID":true,"OR":true},
    "WV": {"KY":true,"MD":true,"OH":true,"PA":true,"VA":true},
    "WI": {"MN":true,"MI":true,"IA":true,"IL":true},
    "WY": {"CO":true,"MT":true,"NE":true,"SD":true,"UT":true,"ID":true},
};

states_full = [
    "AL", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI",
    "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
    "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN",
    "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", ];

ec_states = { "ME":true, "NH":true, "MA":true, "RI":true, 
              "CT":true, "NJ":true, "NY":true, "DE":true,
              "MD":true, "VA":true, "NC":true, "SC":true, 
              "GA":true, "FL":true, };
wc_states = { "CA":true, "OR":true, "WA":true, };

