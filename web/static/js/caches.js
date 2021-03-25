/**
 * 当前用户是否有编辑权限
 */
const editable = $('#editable').val() === 'true';

function switcherInit(el) {
    const switchery = new Switchery(el, {
        color: '#56CC9D',
        size: 'small'
    });
    if (!editable) {
        switchery.disable();
    }
}
document.querySelectorAll('[name="active-checkbox"]').forEach(el => switcherInit(el));

$.fn.select2.defaults.set('width', '100%');
$.fn.select2.defaults.set('minimumResultsForSearch', Infinity);

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

// uri 文本框变化
$('#input-uri').on('input', () => {
    $('#input-uri').removeClass('is-invalid');
});

// 切换类型
$('#select-type').on('change', () => {
    const type = $('#select-type').val();
    $('#input-uri').removeClass('is-invalid');
    switch (type) {
        case 'regexp':
            $('#input-uri').attr('placeholder', '正则表达式匹配');
            $('#group-uri').addClass('group-regexp');
            break;
        case 'exact':
            $('#input-uri').attr('placeholder', '精确匹配');
            $('#group-uri').removeClass('group-regexp');
            break;
        default:
            $('#input-uri').attr('placeholder', '匹配开头');
            $('#group-uri').removeClass('group-regexp');
    }
    setTimeout(() => {
        $('#input-uri').focus();
    }, 200);
});

// 缓存key
$('#radio-url').on('change', () => {
    $('#custom-key-block').hide();
});

$('#radio-custom').on('change', () => {
    $('#custom-key-block').show();
    $('#input-keyContent').focus();
});

// 过期时间仅允许数字
$('#input-expired').on('keydown', e => {
    if (!((e.keyCode > 95 && e.keyCode < 106)
        || (e.keyCode > 47 && e.keyCode < 58)
        || e.keyCode == 8)) {
        return false;
    }
});

// 过期时间 文本框变化
$('#input-expired').on('input', () => {
    $('#input-expired').removeClass('is-invalid');
});

// 清除缓存的key 文本框变化
$('#input-clear-key').on('input', () => {
    $('#input-clear-key').removeClass('is-invalid');
});

// 点击新增按钮
$('#btn-new-cache').on('click', () => {
    $('#uid').val('');
    $('#cache-modal .modal-title').text('新增');
    $('#cache-modal').modal();
});

// 点击导出
$('#btn-export').on('click', () => {
    window.location.href = '/node-proxy/exportCaches';
});

// 点击导入
$('#btn-import').on('change', () => {
    const file = $('#btn-import')[0].files[0];
    const reader = new FileReader();
    reader.onload = () => {
        $.post('/node-proxy/importCaches', {
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

// 清除缓存模态框显示之前
$('#clear-modal').on('show.bs.modal', () => {
    $('#input-clear-key').val('*');
    $('#input-clear-key').removeClass('is-invalid');
});

// 清除缓存模态框显示之后聚焦
$('#clear-modal').on('shown.bs.modal', () => {
    $('#input-clear-key').focus();
});

// 点击确认清除
$('#btn-confirm-clear').on('click', () => {
    const inputkey = $('#input-clear-key');
    const key = inputkey.val().trim();
    if (!key) {
        inputkey.addClass('is-invalid');
        inputkey.focus();
        return;
    }
    $.post('/node-proxy/clearAllCache', {
        key
    }).done(data => {
        if (data.code === 1) {
            $('#clear-modal').modal('hide');
            swal({
                title: data.num === 0 ? '已完成' : '清除成功',
                text: data.num === 0 ? '没有缓存可供清除！' : `共清除 ${data.num} 条缓存！`,
                icon: 'success',
                button: {
                    text: '关闭',
                    className: 'btn btn-info'
                }
            });
        } else {
            swal({
                title: '清除失败',
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
            title: '清除失败',
            text: resp.responseText,
            icon: 'error',
            button: {
                text: '关闭',
                className: 'btn btn-info'
            }
        });
    });
});

// 点击清除缓存按钮
$('#btn-clear-cache').on('click', () => {
    $('#clear-modal').modal('show');
});

// 点击修改按钮
window.editCache = uid => {
    $('#uid').val(uid);
    $('#cache-modal .modal-title').text('修改');
    $('#cache-modal').modal();
};

// 点击切换启用
window.activeCache = (el, uid) => {
    const active = el.checked;
    $.post('/node-proxy/activeCache', {
        uid,
        active
    }).done(data => {
        if (data.code === 1) {
            if (data.data.active) {
                $(`#${uid} td`).removeClass('inactive');
            } else {
                $(`#${uid} td`).addClass('inactive');
            }
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
    });
};

// 点击删除
window.delCache = uid => {
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
            $.post('/node-proxy/delCache', {
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
    const inputUri = $('#input-uri');
    const uri = inputUri.val().trim();
    if (!uri) {
        inputUri.addClass('is-invalid');
        inputUri.focus();
        return;
    }

    const inputkeyContent = $('#input-keyContent');
    let keyContent = inputkeyContent.val().trim();
    if ($('#radio-custom').prop('checked')) {
        if (!keyContent) {
            inputkeyContent.addClass('is-invalid');
            inputkeyContent.focus();
            return;
        }
    } else {
        keyContent = '';
    }

    const inputExpired = $('#input-expired');
    const expired = inputExpired.val().trim();
    if (!expired) {
        inputExpired.addClass('is-invalid');
        inputExpired.focus();
        return;
    }

    $('#btn-save').attr('disabled', 'disabled');
    const uid = $('#uid').val();
    $.post('/node-proxy/saveCache', {
        uid,
        type: $('#select-type').val(),
        uri,
        params: $('#input-params').val(),
        method: $('#select-method').val(),
        domainId: $('#select-domain').val(),
        keyType: $('#radio-custom').prop('checked') ? 'Custom' : 'Url',
        keyContent,
        expired
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

            switcherInit(updatedItem.find('[name="active-checkbox"]')[0]);
            $('#cache-modal').modal('hide');
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
$('#cache-modal').on('show.bs.modal', () => {
    const uid = $('#uid').val();
    if (!uid) {
        // 新增
        $('#select-domain').val('').change();
        $('#select-type').val('start').change();
        $('#input-uri').val('');
        $('#input-uri').removeClass('is-invalid');
        $('#input-params').val('');
        $('#select-method').val('').change();
        $('#radio-url').click();
        $('#input-keyContent').val('');
        $('#input-expired').val('300');
    } else {
        // 修改
        const data = $(`#${uid}`).data();
        $('#select-domain').val(data.domainid).change();
        $('#select-type').val(data.type).change();
        $('#input-uri').val(data.uri);
        $('#input-params').val(data.params);
        $('#select-method').val(data.method).change();
        const keyType = data.keytype;
        if (keyType === 'Custom') {
            $('#input-keyContent').val(data.keycontent);
            $('#radio-custom').click();
        } else {
            $('#radio-url').click();
        }
        $('#input-expired').val(data.expired);
    }
});

// 模态框显示之后聚焦
$('#cache-modal').on('shown.bs.modal', () => {
    $('#input-uri').focus();
});

$('#select-method').select2();

$('#select-domain').select2({
    width: 'calc(100% - 38px)'
});

$('#select-type').select2({
    width: '74px'
});

tippy('.tip', {
    arrow: true,
    theme: 'light-border'
});

window.onpageshow = evt => {
    if (evt.persisted) {
        location.reload();
    }
};
