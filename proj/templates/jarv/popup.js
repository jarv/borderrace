{% if not user.is_authenticated %}
/* modal login / register form using jquery and simplemodal */
jQuery(function ($) {
    var login = {
        message: null,
        init: function () {
                    $('.logreq').click(function (e) {
                        e.preventDefault();
                        // load the login form using ajax
                        $.get("{% url loginform %}", function(data){
                            // create a modal dialog with the data
                            $(data).modal({
                                closeHTML: "<a href='#' title='Close' class='modal-close'>x</a>",
                                position: ["15%",],
                                overlayId: 'popup-overlay',
                                containerId: 'popup-container',
                                onShow: login.show,
                                onClose: login.close
                            });
                        });
                    });
                },

        show: function() {

          $('#log_button').click(function(e) {
              e.preventDefault();
              // validate the form in javascript
              if (login.log_validate()) {
                var msg = $('#popup-container .popup-message');
                msg.fadeOut(function () {
                    msg.removeClass('popup-error').empty();
                });

                $('#popup-container .popup-title').html('Sending...');
                $.ajax({
                    url: '{% url loginform %}',
                    data: $('#logform form').serialize() + 
                                        '&action=send',
                    type: 'post',
                    cache: false,
                    dataType: 'json',
                    success: function (data) {

                        if (data['loggedin'] == "Success")
                        {
                         $('#popup-container .popup-loading').fadeOut(200, function () {
                            $('#popup-container .popup-title').html('Login Success');
                                window.location.href='http://localhost:8000{{ request.path }}';
                            });
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
                var msg = $('#popup-container .popup-message');
                msg.fadeOut(function () {
                    msg.removeClass('popup-error').empty();
                });

                $('#popup-container .popup-title').html('Sending...');
                $.ajax({
                            url: '{% url loginform %}',
                            data: $('#regform form').serialize() + '&action=send',
                            type: 'post',
                            cache: false,
                            dataType: 'json',
                            success: function (data) {

                                if (data['loggedin'] == "Success")
                                {
                                 $('#popup-container .popup-loading').fadeOut(200, function () {
                                    $('#popup-container .popup-title').html('Login Success');
                                        window.location.href='http://localhost:8000{{ request.path }}';
                                    });
                                }
                                else
                                {
                                    login.message = data['loggedin'];
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
            $('#popup-container .popup-logtitle').fadeOut();
            $('#popup-container .popup-regtitle').fadeOut();
            $('#popup-container .popup-message').fadeOut();
            $('#popup-container form').fadeOut(200);
            $('#popup-container .popup').animate({
                height: 20 
            }, function () {
                dialog.data.fadeOut(200, function () {
                    dialog.container.fadeOut(200, function () {
                        dialog.overlay.fadeOut(200, function () {
                            $.modal.close();
                        });
                    });
                });
            });
        },
        error: function (xhr) {
            alert(xhr.statusText);
       },


        log_validate: function () {
            login.message = '';
            if (!$('#popup-container #id_logusername').val()) {
                login.message += 'Username is required. ';
            }
            if (!$('#popup-container #id_logpassword').val()) {
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
            if (!$('#popup-container #id_regusername').val()) {
                login.message += 'Username is required. ';
            }
            if (!$('#popup-container #id_regpassword').val()) {
                login.message += 'Password is required. ';
            }

            if (!$('#popup-container #id_regpassword2').val()) {
                login.message += 'Password confirm is required. ';
            }

            if (!$('#popup-container #id_regemail').val()) {
                login.message += 'Email is required. ';
            }



            if (login.message.length > 0) {
                return false;
            }
            else {
                return true;
            }

        },


        showlogError: function () {

            if ($('#popup-container .popup-logmessage:visible').length > 0) {
                var msg = $('#popup-container .popup-logmessage div');
                msg.fadeOut(200, function () {
                    msg.empty();
                    msg.fadeIn(200);
                });
            }
       
            $('#popup-container .popup-logmessage').animate({
                height: '30px'
                }, function() {
                    $('#popup-container .popup-logmessage')
                        .html($('<div class="popup-error"></div>').append(login.message))
                        .fadeIn(200);
                });

        },


        showregError: function () {

            if ($('#popup-container .popup-regmessage:visible').length > 0) {
                var msg = $('#popup-container .popup-regmessage div');
                msg.fadeOut(200, function () {
                    msg.empty();
                    msg.fadeIn(200);
                });
            }
       
            $('#popup-container .popup-regmessage').animate({
                height: '30px'
                }, function() {
                    $('#popup-container .popup-regmessage')
                        .html($('<div class="popup-error"></div>').append(login.message))
                        .fadeIn(200);
                });

        },
    

        
    };

    login.init();
});
{% endif %}
