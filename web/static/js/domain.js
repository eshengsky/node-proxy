/**
 * 当前用户是否有编辑权限
 */
const editable = $('#editable').val() === 'true';

const popoverOptions = {
    trigger: 'hover',
    container: 'body',
    placement: 'top'
};
$('[data-toggle="popover"]').popover(popoverOptions);

const searcher = new QuickSearch({
    inputSelector: '[type=search]',
    findSelector: '.results tr',
    input: ({ text, find }) => {
        // 显示查找到了多少个结果
        let num = '';
        if (text) {
            num = `${find}个`;
            $('.search-count').css('opacity', '1');
        } else {
            $('.search-count').css('opacity', '0');
        }
        $('.search-count span').text(num);

        // 无数据时显示表足
        const empty = find === 0;
        if (empty) {
            setTimeout(() => {
                $('tfoot').css('display', 'table-row-group');
            }, 0);
        } else {
            $('tfoot').css('display', 'none');
        }
    }
});

// 域名 文本框变化
$('#input-domainPath').on('input', () => {
    $('#input-domainPath').removeClass('is-invalid');
});

// 点击新增按钮
$('#btn-new-domain').on('click', () => {
    $('#uid').val('');
    $('.modal-title').text('新增');
    $('#domain-modal').modal();
});

// 点击导出
$('#btn-export').on('click', () => {
    window.location.href = '/noginx/exportDomains';
});

// 点击导入
$('#btn-import').on('change', () => {
    const file = $('#btn-import')[0].files[0];
    const reader = new FileReader();
    reader.onload = () => {
        $.post('/noginx/importDomains', {
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
                        className: 'btn btn-info'
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
                        className: 'btn btn-info'
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
                    className: 'btn btn-info'
                }
            });
        });
    };
    reader.readAsDataURL(file);
});

// 点击修改按钮
window.editDomain = uid => {
    $('#uid').val(uid);
    $('.modal-title').text('修改');
    $('#domain-modal').modal();
};

// 点击删除
window.delDomain = uid => {
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
            $.post('/noginx/delDomain', {
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
                    if ($('.results tr').length === 0) {
                        $('tfoot').css('display', 'table-row-group');
                    }

                    // 重新触发一次搜索
                    searcher.triggerSearch();
                } else {
                    swal({
                        title: '删除失败',
                        text: data.message,
                        icon: 'error',
                        button: {
                            text: '关闭',
                            className: 'btn btn-info'
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
                        className: 'btn btn-info'
                    }
                });
            });
        }
    });
};

// 点击保存按钮
$('#btn-save').on('click', () => {
    const inputDomainPath = $('#input-domainPath');
    const domainPath = inputDomainPath.val().trim();
    if (!domainPath) {
        inputDomainPath.addClass('is-invalid');
        inputDomainPath.focus();
        return;
    }

    $('#btn-save').attr('disabled', 'disabled');
    const uid = $('#uid').val();
    $.post('/noginx/saveDomain', {
        uid,
        domainPath,
        remarks: $('#input-remarks').val()
    }).done(data => {
        if (data.code === 1) {
            let updatedItem;
            if (!uid) {
                // 新增
                $('.results').append(data.data);
                updatedItem = $('.results tr:last');
                $('tfoot').css('display', 'none');
            } else {
                // 修改
                $(`#${uid}`).replaceWith(data.data);
                updatedItem = $(`#${uid}`);
            }

            // 重新触发一次搜索
            searcher.triggerSearch();

            updatedItem.find('[data-toggle="popover"]').popover(popoverOptions);
            $('#domain-modal').modal('hide');
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
                    className: 'btn btn-info'
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
                className: 'btn btn-info'
            }
        });
    }).always(() => {
        $('#btn-save').removeAttr('disabled');
    });
});

// 模态框显示之前填充数据
$('#domain-modal').on('show.bs.modal', () => {
    const uid = $('#uid').val();
    if (!uid) {
        // 新增
        $('#input-domainPath').val('');
        $('#input-domainPath').removeClass('is-invalid');
        $('#input-remarks').val('');
    } else {
        // 修改
        const data = $(`#${uid}`).data();
        $('#input-domainPath').val(data.domainpath);
        $('#input-remarks').val(data.remarks);
    }
});

// 模态框显示之后聚焦
$('#domain-modal').on('shown.bs.modal', () => {
    $('#input-domainPath').focus();
});

window.onpageshow = evt => {
    if (evt.persisted) {
        location.reload();
    }
};
