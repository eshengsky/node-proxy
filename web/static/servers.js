const popoverOptions = {
    trigger: 'click hover',
    container: 'body',
    placement: 'bottom'
};
$('[data-toggle="popover"]').popover(popoverOptions);

// 点击新增按钮
$('#btn-new-server').on('click', () => {
    $('#uid').val('');
    $('.modal-title').text('新增');
    $('#server-modal').modal();
});

// 点击导出
$('#btn-export').on('click', () => {
    window.location.href = '/nodeProxy/exportServers';
});

// 点击导入
$('#btn-import').on('change', () => {
    const file = $('#btn-import')[0].files[0];
    const reader = new FileReader();
    reader.onload = () => {
        $.post('/nodeProxy/importServers', {
            data: reader.result
        }).done(data => {
            if (data.code === 1) {
                swal({
                    title: '导入成功',
                    text: `共导入 ${data.data} 条数据`,
                    icon: 'success',
                    closeOnClickOutside: false,
                    button: {
                        text: '刷新',
                        className: 'btn btn-primary'
                    }
                }).then(() => {
                    window.location.reload();
                });
            } else {
                swal({
                    title: '导入失败',
                    text: data.message,
                    icon: 'error',
                    button: {
                        text: '关闭',
                        className: 'btn btn-primary'
                    }
                });
            }
        }).fail(resp => {
            swal({
                title: '导入失败',
                text: resp.responseText,
                icon: 'error',
                button: {
                    text: '关闭',
                    className: 'btn btn-primary'
                }
            });
        });
    };
    reader.readAsDataURL(file);
});

// 点击修改按钮
window.editServer = uid => {
    $('#uid').val(uid);
    $('.modal-title').text('修改');
    $('#server-modal').modal();
};

// 点击删除
window.delServer = uid => {
    swal({
        title: '确定要删除吗？',
        icon: 'warning',
        buttons: {
            btnCancel: {
                text: '取消',
                className: 'btn btn-default'
            },
            btnConfirm: {
                text: '确认删除',
                className: 'btn btn-danger'
            }
        },
        dangerMode: true
    }).then(value => {
        if (value === 'btnConfirm') {
            $.post('/nodeProxy/delServer', {
                uid
            }).done(data => {
                if (data.code === 1) {
                    swal({
                        text: '删除成功',
                        icon: 'success',
                        buttons: false,
                        timer: 1000
                    });
                    $(`#${data.data._id}`).remove();
                } else {
                    swal({
                        title: '删除失败',
                        text: data.message,
                        icon: 'error',
                        button: {
                            text: '关闭',
                            className: 'btn btn-primary'
                        }
                    });
                }
            }).fail(resp => {
                swal({
                    title: '删除失败',
                    text: resp.responseText,
                    icon: 'error',
                    button: {
                        text: '关闭',
                        className: 'btn btn-primary'
                    }
                });
            })
        }
    });
}

// 服务器名称 文本框变化
$('#input-name').on('input', () => {
    $('#input-name').removeClass('is-invalid');
});

// 服务器地址 文本框变化
$('#input-hosts').on('input', () => {
    $('#input-hosts').removeClass('is-invalid');
});

// 点击保存按钮
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
        // 验证是否以 http(s) 开头
        const invalidHost = hosts.split(/\r|\n/).some(host => !/^https?:\/\//.test(host));
        if (invalidHost) {
            inputHosts.addClass('is-invalid');
            inputHosts.focus();
            return;
        }
    }

    $('#btn-save').attr('disabled', 'disabled');
    const uid = $('#uid').val();
    $.post('/nodeProxy/saveServer', {
        uid,
        name,
        hosts: hosts.split(/\r|\n/).join(','),
        remarks: $('#input-remarks').val()
    }).done(data => {
        if (data.code === 1) {
            let updatedItem;
            if (!uid) {
                // 新增
                $('.servers').append(data.data);
                updatedItem = $('.servers div:last');
            } else {
                // 修改
                $(`#${uid}`).replaceWith(data.data);
                updatedItem = $(`#${uid}`);
            }
            updatedItem.find('[data-toggle="popover"]').popover(popoverOptions);
            $('#server-modal').modal('hide');
            swal({
                text: '保存成功',
                icon: 'success',
                buttons: false,
                timer: 1000
            });
        } else {
            swal({
                title: '保存失败',
                text: data.message,
                icon: 'error',
                button: {
                    text: '关闭',
                    className: 'btn btn-primary'
                }
            });
        }
    }).fail(resp => {
        swal({
            title: '保存失败',
            text: resp.responseText,
            icon: 'error',
            button: {
                text: '关闭',
                className: 'btn btn-primary'
            }
        });
    }).always(() => {
        $('#btn-save').removeAttr('disabled');
    });
});

// 模态框显示之前填充数据
$('#server-modal').on('show.bs.modal', () => {
    const uid = $('#uid').val();
    if (!uid) {
        // 新增
        $('#input-name').val('');
        $('#input-name').removeClass('is-invalid');
        $('#input-hosts').val('');
        $('#input-hosts').removeClass('is-invalid');
        $('#input-remarks').val('');
    } else {
        // 修改
        const data = $(`#${uid}`).data();
        $('#input-name').val(data.name);
        $('#input-hosts').val(data.hosts.replace(/,/g, '\n'));
        $('#input-remarks').val(data.remarks);
    }
});

// 模态框显示之后聚焦
$('#server-modal').on('shown.bs.modal', () => {
    $('#input-name').focus();
});
