/* modal login / register form using jquery and simplemodal */
var login = {
    message: null,
    init: function () {

        $('.logreg').click(function (e) {
            e.preventDefault();
            // load the login form using ajax
            $.get("{% url loginform %}", function(data){
                // create a modal dialog with the data
                $(data).modal({
                    closeHTML: "<a href='#' title='Close' class='modal-close'><img src='{{MEDIA_URL}}images/close-icon1.png' alt='' /></a>",
                    position: ["15%",],
                    minHeight: 400,
                    overlayId: 'popup-overlay',
                    containerId: 'popup-container',
                    onShow: login.button_events,
                    onClose: login.close
                });
            });
        });
    },

    button_events: function() {

        $('#log_button').click(function(e) {
          e.preventDefault();
          // validate the form in javascript
          if (login.log_validate()) {
            var msg = $('.popup-message');
            msg.fadeOut(function () {
                msg.removeClass('popup-error').empty();
            });

            $('.popup-title').html('Sending...');
            $.ajax({
                url: '{% url loginform %}',
                data: $('#logform form').serialize() + '&action=send',
                type: 'post',
                cache: false,
                dataType: 'json',
                success: function (data) {

                    if (data['loggedin'] == "Success")
                    {
                        window.location.href='{{ request.path }}';
                    }
                    else
                    {
                        login.message = data['loggedin'];
                        login.showlogError();
                    }
               },
                error: login.error
                });
            }
            else {
                  login.showlogError();
            }
        });

        $('#reg_button').click(function(e) {
          e.preventDefault();
          // validate the form in javascript
          if (login.reg_validate()) {
            var msg = $('.popup-message');
            msg.fadeOut(function () {
                msg.removeClass('popup-error').empty();
            });

            $('.popup-title').html('Sending...');
            $.ajax({
                        url: '{% url loginform %}',
                        data: $('#regform form').serialize() + '&action=send',
                        type: 'post',
                        cache: false,
                        dataType: 'json',
                        success: function (data) {

                            if (data['register'] == "Success")
                            {
                             $('.popup-loading').fadeOut(200, function () {
                                $('.popup-title').html('Login Success');
                                    window.location.href='{{ request.path }}';
                                });
                            }
                            else
                            {
                                login.message = data['register'];
                                login.showregError();
                            }
                       },
                        error: login.error
                });
            }
            else {
                  login.showregError();
            }
        });




    },



    close: function (dialog) {
        $('.popup-logtitle').fadeOut();
        $('.popup-regtitle').fadeOut();
        $('.popup-regmessage').fadeOut();
        $('.popup-loading').fadeOut();
        $('.popup-logmessage').fadeOut();
        $('#popup-container form').fadeOut(200);
        $('#popup-container').animate({
            height: 20 
        }, function () {
               $.modal.close();
        });
    },
    error: function (xhr) {
        alert(xhr.statusText);
   },


    log_validate: function () {
        login.message = '';
        if (!$('#id_logusername').val()) {
            login.message += 'Username is required. ';
        }
        if (!$('#id_logpassword').val()) {
            login.message += 'Password is required. ';
        }
        if (login.message.length > 0) {
            return false;
        }
        else {
            return true;
        }

    },


    reg_validate: function () {
        login.message = '';
        if (!$('#id_regusername').val()) {
            login.message += 'Username is required. ';
        }
        if (!$('#id_regpassword').val()) {
            login.message += 'Password is required. ';
        }

        if (!$('#id_regpassword2').val()) {
            login.message += 'Password confirm is required. ';
        }


        if (login.message.length > 0) {
            return false;
        }
        else {
            return true;
        }

    },


    showlogError: function () {

        if ($('.popup-logmessage:visible').length > 0) {
            var msg = $('.popup-logmessage div');
            msg.fadeOut(200, function () {
                msg.empty();
                msg.fadeIn(200);
            });
        }
   
        $('.popup-logmessage').animate({
            height: '30px'
            }, function() {
                $('.popup-logmessage')
                    .html($('<div class="popup-error"></div>').append(login.message))
                    .fadeIn(200);
            });

    },


    showregError: function () {

        if ($('.popup-regmessage:visible').length > 0) {
            var msg = $('.popup-regmessage div');
            msg.fadeOut(200, function () {
                msg.empty();
                msg.fadeIn(200);
            });
        }
   
        $('.popup-regmessage').animate({
            height: '50px'
            }, function() {
                $('.popup-regmessage')
                    .html($('<div class="popup-error"></div>').append(login.message))
                    .fadeIn(200);
            });

    },


    
};

login.init();
