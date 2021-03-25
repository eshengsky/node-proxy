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
    btnLogin.text('登录中...');
    $.post('/node-proxy/login', {
        username,
        password: md5(password)
    }).done(data => {
        if (data.code === 1) {
            // 成功
            window.location.href = data.data || '/node-proxy/';
        } else {
            // 失败
            swal({
                title: '登录失败',
                text: data.message,
                icon: 'error',
                buttons: false,
                timer: 2000
            });
            inputPassword.val('');
            btnLogin.removeAttr('disabled');
            btnLogin.text('登录');
        }
    }).fail(resp => {
        swal({
            title: '登录失败',
            text: resp.responseText,
            icon: 'error',
            button: {
                text: '关闭',
                className: 'btn btn-primary'
            }
        });
        btnLogin.removeAttr('disabled');
        btnLogin.text('登录');
    })
});

$('#input-username').on('input', () => {
    $('#input-username').removeClass('is-invalid');
});

$('#input-password').on('input', () => {
    $('#input-password').removeClass('is-invalid');
});

setTimeout(() => {
    $('#input-username').focus();
}, 100);

// 回车登录
$('body').on('keyup', event => {
    if(event.keyCode == '13') {
        $('#btn-login').click();
    }
});
