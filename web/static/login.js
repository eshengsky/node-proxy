$('#btn-login').on('click', () => {
    const inputUsername = $('#input-username');
    const username = inputUsername.val();
    const inputPassword = $('#input-password');
    const password = inputPassword.val();
    if (!username) {
        inputUsername.addClass('is-invalid');
        inputUsername.focus();
        return;
    }
    if (!password) {
        inputPassword.addClass('is-invalid');
        inputPassword.focus();
        return;
    }

    const btnLogin = $('#btn-login');
    btnLogin.attr('disabled', 'disabled');
    btnLogin.text('logining...');
    $.post('/nodeProxy/login', {
        username,
        password: md5(password)
    }).done(data => {
        if (data.valid) {
            window.location.href = data.returnTo || '/nodeProxy/';
        } else {
            swal({
                title: 'Login failed',
                text: data.message,
                icon: 'error',
                buttons: false,
                timer: 2000
            });
            inputPassword.val('');
            btnLogin.removeAttr('disabled');
            btnLogin.text('login');
        }
    }).fail(resp => {
        swal({
            title: 'Login failed',
            text: resp.responseText,
            icon: 'error',
            button: {
                text: 'Close',
                className: 'btn btn-primary'
            }
        });
        btnLogin.removeAttr('disabled');
        btnLogin.text('login');
    });
});

$('#input-username').on('input', () => {
    $('#input-username').removeClass('is-invalid');
});

$('#input-password').on('input', () => {
    $('#input-password').removeClass('is-invalid');
});

$('body').on('keyup', event => {
    if(event.keyCode == '13') {
        $('#btn-login').click();
    }
});