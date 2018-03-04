const popoverOptions = {
    trigger: 'click hover',
    container: 'body',
    placement: 'bottom'
};
$('[data-toggle="popover"]').popover(popoverOptions);

$('#btn-new-server').on('click', () => {
    $('#uid').val('');
    $('.modal-title').text('New');
    $('#server-modal').modal();
});

// 点击修改按钮
window.editServer = uid => {
    $('#uid').val(uid);
    $('.modal-title').text('Modify');
    $('#server-modal').modal();
};

// 点击删除
window.delServer = uid => {
    swal({
        title: 'Are you sure you want to delete?',
        icon: 'warning',
        buttons: {
            btnCancel: {
                text: 'Cancel',
                className: 'btn btn-default'
            },
            btnConfirm: {
                text: 'Confirm delete',
                className: 'btn btn-danger'
            }
        },
        dangerMode: true
    }).then(value => {
        if (value === 'btnConfirm') {
            $.post('/nodeProxy/delServer', {
                uid
            }).done(item => {
                swal({
                    text: 'Delete successfully!',
                    icon: 'success',
                    buttons: false,
                    timer: 1000
                });
                $(`#${item._id}`).remove();

                // 需要自动另一台为兜底
                if (item.updateId) {
                    $(`#${item.updateId}`).replaceWith(item.template);
                }
            }).fail(resp => {
                swal({
                    title: 'Delete failed',
                    text: resp.responseText,
                    icon: 'error',
                    button: {
                        text: 'Close',
                        className: 'btn btn-primary'
                    }
                });
            })
        }
    });
}

$('#input-name').on('input', () => {
    $('#input-name').removeClass('is-invalid');
});

$('#input-hosts').on('input', () => {
    $('#input-hosts').removeClass('is-invalid');
});

$('#btn-save').on('click', () => {
    const inputName = $('#input-name');
    const name = inputName.val().trim();
    if (!name) {
        inputName.addClass('is-invalid');
        inputName.focus();
        return;
    }

    const inputHosts = $('#input-hosts');
    const hosts = inputHosts.val().trim();
    if (!hosts) {
        inputHosts.addClass('is-invalid');
        inputHosts.focus();
        return;
    } else {
        const invalidHost = hosts.split(/\r|\n/).some(host => !/^https?:\/\//.test(host));
        if (invalidHost) {
            inputHosts.addClass('is-invalid');
            inputHosts.focus();
            return;
        }
    }

    $('#btn-save').attr('disabled', 'disabled');
    const uid = $('#uid').val();
    const fallback = $('#check-fallback').prop('checked');
    $.post('/nodeProxy/saveServer', {
        uid,
        name,
        fallback: fallback ? 'Y' : 'N',
        hosts: hosts.split(/\r|\n/).join(','),
        remarks: $('#input-remarks').val()
    }).done(template => {
        let updatedItem;
        if (fallback) {
            $('.badge-fallback').remove();
            $('[data-fallback=Y]').data('fallback', 'N');
            $('[data-fallback=Y]').attr('data-fallback', 'N');
        }
        if (!uid) {
            $('.servers').append(template);
            updatedItem = $('.servers div:last');
        } else {
            $(`#${uid}`).replaceWith(template);
            updatedItem = $(`#${uid}`);
        }
        updatedItem.find('[data-toggle="popover"]').popover(popoverOptions);
        $('#server-modal').modal('hide');
        swal({
            text: 'Save successfully!',
            icon: 'success',
            buttons: false,
            timer: 1000
        });
    }).fail(resp => {
        swal({
            title: 'Save failed',
            text: resp.responseText,
            icon: 'error',
            button: {
                text: 'Close',
                className: 'btn btn-primary'
            }
        });
    }).always(() => {
        $('#btn-save').removeAttr('disabled');
    });
});

$('#server-modal').on('show.bs.modal', () => {
    const uid = $('#uid').val();
    if (!uid) {
        $('#input-name').val('');
        $('#input-name').removeClass('is-invalid');
        $('#input-hosts').val('');
        $('#input-hosts').removeClass('is-invalid');
        $('#input-remarks').val('');
        if ($('.servers div').length === 0) {
            $('#check-fallback').prop('checked', true);
            $('#check-fallback').prop('disabled', true);
        } else {
            $('#check-fallback').prop('checked', false);
            $('#check-fallback').prop('disabled', false);
        }
    } else {
        const data = $(`#${uid}`).data();
        $('#input-name').val(data.name);
        if (data.fallback === 'Y') {
            $('#check-fallback').prop('checked', true);
            $('#check-fallback').prop('disabled', true);
        } else {
            $('#check-fallback').prop('checked', false);
            $('#check-fallback').prop('disabled', false);
        }
        
        $('#input-hosts').val(data.hosts.replace(/,/g, '\n'));
        $('#input-remarks').val(data.remarks);
    }
});

$('#server-modal').on('shown.bs.modal', () => {
    $('#input-name').focus();
});
