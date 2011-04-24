
jQuery(function ($) {
	// Load dialog on click
  	$('body').click(function () {
            $('body').unbind();
            $('#basic-modal').load('http://tst.jarv.org/loginform/').modal(); // AJAX
            return false;
	});
});

