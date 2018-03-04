const editable = $('#editable').val() === 'true';

function switcherInit(el) {
    const switchery = new Switchery(el, {
        color: '#78C2AD',
        size: 'small'
    });
    if (!editable) {
        switchery.disable();
    }
}
document.querySelectorAll('[name="active-checkbox"]').forEach(el => switcherInit(el));

const popoverOptions = {
    trigger: 'click hover',
    container: 'body',
    placement: 'top'
};
$('[data-toggle="popover"]').popover(popoverOptions);

let dragger = null;
function draggerInit() {
    if (dragger) {
        dragger.destroy();
    }
    if (document.querySelectorAll('.results tr').length) {
        dragger = tableDragger(document.querySelector('.table'), {
            mode: 'row',
            dragHandler: '.drag-icon',
            onlyBody: true,
            animation: 300
        });
        dragger.on('drop', (from, to) => {
            const start = Math.min(from, to);
            const end = Math.max(from, to);
            if (start === end) {
                return;
            }

            const seqList = [];
            for (let i = start - 1; i < end; i++) {
                const tr = $(`.results tr:eq(${i})`);
                seqList.push({
                    uid: tr.attr('id'),
                    seq: i + 1
                });
            }
            $.post('/nodeProxy/seq', {
                seqList
            }).done(() => {
                seqList.forEach(item => {
                    $(`#${item.uid}`).data('sequence', item.seq);
                    $(`#${item.uid}`).attr('data-sequence', item.seq);
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
            });
        });
    }
}

if (editable) {
    draggerInit();
}

const searcher = new QuickSearch({
    inputSelector: '[type=search]',
    findSelector: '.results tr',
    input: ({ text, find }) => {
        let num = '';
        if (text) {
            num = `${find}个`;
        }
        $('.search-count').text(num);

        const empty = find === 0;
        if (empty) {
            setTimeout(() => {
                $('tfoot').css('display', 'table-row-group');
            }, 0);
        } else {
            $('tfoot').css('display', 'none');
        }

        const dragIcons = document.querySelectorAll('.drag-icon');
        if (find !== document.querySelectorAll('.results tr').length) {
            dragIcons.forEach(item => {
                item.style.display = 'none';
            });
        } else {
            dragIcons.forEach(item => {
                item.style.display = 'block';
            });
        }
    }
});

$('#input-uri').on('input', () => {
    $('#input-uri').removeClass('is-invalid');
});

$('#select-type').on('change', () => {
    const type = $('#select-type').val();
    $('#input-uri').removeClass('is-invalid');
    switch (type) {
        case 'regexp':
            $('#input-uri').attr('placeholder', 'Match regular expression');
            $('#group-uri').addClass('group-regexp');
            break;
        case 'exact':
            $('#input-uri').attr('placeholder', 'Match exact full uri');
            $('#group-uri').removeClass('group-regexp');
            break;
        default:
            $('#input-uri').attr('placeholder', 'Match start of uri');
            $('#group-uri').removeClass('group-regexp');
    }
});

$('#input-content').on('input', () => {
    $('#input-content').removeClass('is-invalid');
});

$('#select-content').on('change', () => {
    $('#select-content').removeClass('is-invalid');
});

$('#select-process').on('change', () => {
    const process = $('#select-process').val();
    $('#input-content').removeClass('is-invalid');
    $('#select-content').removeClass('is-invalid');
    if (process === 'forward') {
        $('#input-content-addon').html('Server:&nbsp;');
        $('#input-content').hide();
        $('#group-tryFile').hide();
        $('#select-content').show();

        if ($('#select-content option').length === 1) {
            $('#alert-server').show();
        }
    } else {
        if (process === 'static') {
            $('#input-content-addon').html('directory:&nbsp;');
            $('#input-content').attr('placeholder', 'directory path');
            $('#group-tryFile').show();
        } else {
            $('#input-content-addon').html('URI:&nbsp;');
            $('#input-content').attr('placeholder', 'can ignore domain');
            $('#group-tryFile').hide();
        }
        $('#select-content').hide();
        $('#input-content').show();
        $('#input-content').focus();
        $('#alert-server').hide();
    }
});

$('#input-content-addon').on('click', () => {
    $('#input-content').focus();
});

$('#btn-new-route').on('click', () => {
    $('#uid').val('');
    $('.modal-title').text('New');
    $('#route-modal').modal();
});

window.editRoute = uid => {
    $('#uid').val(uid);
    $('.modal-title').text('Modify');
    $('#route-modal').modal();
};

window.activeRoute = (el, uid) => {
    const active = el.checked;
    $.post('/nodeProxy/active', {
        uid,
        active
    }).done(item => {
        if (item.active) {
            $(`#${uid} td`).removeClass('inactive');
        } else {
            $(`#${uid} td`).addClass('inactive');
        }
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
    });
};

window.delRoute = uid => {
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
            $.post('/nodeProxy/del', {
                uid
            }).done(item => {
                swal({
                    text: 'Delete successfully!',
                    icon: 'success',
                    buttons: false,
                    timer: 1000
                });
                $(`#${item._id}`).remove();
                if ($('.results tr').length === 0) {
                    $('tfoot').css('display', 'table-row-group');
                }
                searcher.triggerSearch();
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
            });
        }
    });
};

$('#btn-save').on('click', () => {
    const inputUri = $('#input-uri');
    const uri = inputUri.val().trim();
    if (!uri) {
        inputUri.addClass('is-invalid');
        inputUri.focus();
        return;
    }

    const process = $('#select-process').val();
    const inputContent = $('#input-content');
    const selectContent = $('#select-content');
    let content = inputContent.val().trim();
    if (process !== 'forward') {
        if (!content) {
            inputContent.addClass('is-invalid');
            inputContent.focus();
            return;
        }
    } else {
        content = $('#select-content').val();
        if (!content) {
            selectContent.addClass('is-invalid');
            return;
        }
    }

    $('#btn-save').attr('disabled', 'disabled');
    const uid = $('#uid').val();
    const tryFile = $('#check-tryFile').prop('checked');
    $.post('/nodeProxy/save', {
        uid,
        type: $('#select-type').val(),
        uri,
        process: $('#select-process').val(),
        content,
        tryFile: tryFile ? 'Y' : 'N',
        remarks: $('#input-remarks').val()
    }).done(template => {
        let updatedItem;
        if (!uid) {
            $('.results').append(template);
            updatedItem = $('.results tr:last');
            $('tfoot').css('display', 'none');
        } else {
            $(`#${uid}`).replaceWith(template);
            updatedItem = $(`#${uid}`);
        }

        searcher.triggerSearch();

        switcherInit(updatedItem.find('[name="active-checkbox"]')[0]);
        updatedItem.find('[data-toggle="popover"]').popover(popoverOptions);
        draggerInit();
        $('#route-modal').modal('hide');
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

$('#route-modal').on('show.bs.modal', () => {
    const uid = $('#uid').val();
    if (!uid) {
        $('#select-type').val('start').change();
        $('#input-uri').val('');
        $('#input-uri').removeClass('is-invalid');
        $('#select-process').val('static').change();
        $('#input-content').val('');
        $('#input-content').removeClass('is-invalid');
        $('#check-tryFile').prop('checked', false);
        $('#select-content').val('');
        $('#select-content').removeClass('is-invalid');
        $('#input-remarks').val('');
    } else {
        const data = $(`#${uid}`).data();
        $('#select-type').val(data.type).change();
        $('#input-uri').val(data.uri);
        const process = data.process;
        $('#select-process').val(process).change();
        if (process === 'forward') {
            $('#input-content').val('');
            $('#select-content').val(data.content);
        } else {
            $('#input-content').val(data.content);
            $('#select-content').val('');
        }
        $('#check-tryFile').prop('checked', data.tryfile === 'Y');
        $('#input-remarks').val(data.remarks);
    }
});

$('#route-modal').on('shown.bs.modal', () => {
    $('#input-uri').focus();
});

window.onpageshow = evt => {
    if (evt.persisted) {
        location.reload();
    }
};
