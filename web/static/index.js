/**
 * 当前用户是否有编辑权限
 */
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

            // 需要重新排序的列表
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
            }).done(data => {
                if (data.code === 1) {
                    seqList.forEach(item => {
                        $(`#${item.uid}`).data('sequence', item.seq);
                        $(`#${item.uid}`).attr('data-sequence', item.seq);
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
        // 显示查找到了多少个结果
        let num = '';
        if (text) {
            num = `${find}个`;
        }
        $('.search-count').text(num);

        // 无数据时显示表足
        const empty = find === 0;
        if (empty) {
            setTimeout(() => {
                $('tfoot').css('display', 'table-row-group');
            }, 0);
        } else {
            $('tfoot').css('display', 'none');
        }

        // 当查找到的结果数!==总条数，禁用排序功能
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
            $('#input-uri').attr('placeholder', '正则匹配');
            $('#group-uri').addClass('group-regexp');
            break;
        case 'exact':
            $('#input-uri').attr('placeholder', '完全匹配');
            $('#group-uri').removeClass('group-regexp');
            break;
        default:
            $('#input-uri').attr('placeholder', '匹配开头');
            $('#group-uri').removeClass('group-regexp');
    }
});

// 处理内容 文本框变化
$('#input-content').on('input', () => {
    $('#input-content').removeClass('is-invalid');
});

// 转发服务器 选择项变化
$('#select-content').on('change', () => {
    $('#select-content').removeClass('is-invalid');
});

// 切换处理方式
$('#select-process').on('change', () => {
    const process = $('#select-process').val();
    $('#input-content').removeClass('is-invalid');
    $('#select-content').removeClass('is-invalid');
    if (process === 'forward') {
        $('#input-content-addon').text('服务器：');
        $('#input-content').hide();
        $('#group-tryFile').hide();
        $('#select-content').show();

        // 没有服务器则显示alert
        if ($('#select-content option').length === 1) {
            $('#alert-server').show();
        }
    } else {
        if (process === 'static') {
            $('#input-content-addon').text('目录：/data/nfsroot/client/static/');
            $('#input-content').attr('placeholder', '剩余路径');
            $('#group-tryFile').show();
        } else {
            $('#input-content-addon').text('地址：');
            $('#input-content').attr('placeholder', '可以不加域名');
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

// 点击新增按钮
$('#btn-new-route').on('click', () => {
    $('#uid').val('');
    $('.modal-title').text('新增');
    $('#route-modal').modal();
});

// 点击导出
$('#btn-export').on('click', () => {
    window.location.href = '/nodeProxy/exportRoutes';
});

// 点击导入
$('#btn-import').on('change', () => {
    const file = $('#btn-import')[0].files[0];
    const reader = new FileReader();
    reader.onload = () => {
        $.post('/nodeProxy/importRoutes', {
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
window.editRoute = uid => {
    $('#uid').val(uid);
    $('.modal-title').text('修改');
    $('#route-modal').modal();
};

// 点击切换启用
window.activeRoute = (el, uid) => {
    const active = el.checked;
    $.post('/nodeProxy/active', {
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
    });
};

// 点击删除
window.delRoute = uid => {
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
            $.post('/nodeProxy/del', {
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

    const process = $('#select-process').val();
    const inputContent = $('#input-content');
    const selectContent = $('#select-content');
    let content = inputContent.val().trim();
    if (process === 'rewrite') {
        if (!content) {
            inputContent.addClass('is-invalid');
            inputContent.focus();
            return;
        }
    } else if (process === 'forward') {
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
            updatedItem.find('[data-toggle="popover"]').popover(popoverOptions);
            draggerInit();
            $('#route-modal').modal('hide');
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
$('#route-modal').on('show.bs.modal', () => {
    const uid = $('#uid').val();
    if (!uid) {
        // 新增
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
        // 修改
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

// 模态框显示之后聚焦
$('#route-modal').on('shown.bs.modal', () => {
    $('#input-uri').focus();
});

window.onpageshow = evt => {
    if (evt.persisted) {
        location.reload();
    }
};
