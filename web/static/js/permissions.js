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

$.fn.select2.defaults.set('width', '100%');
$.fn.select2.defaults.set('minimumResultsForSearch', Infinity);

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

// 切换验证方式
$('#select-auth').on('change', () => {
    $('#select-auth').removeClass('is-invalid');
});

function addNewExclude() {
    $('#exclude-container').append(`
<div class="input-group mb-1 exclude-group">
    <div class="input-group-prepend">
        <select class="custom-select form-control prepend-select" onchange="exChange(this);">
            <option value="start">开头</option>
            <option value="exact">精确</option>
            <option value="regexp">正则</option>
        </select>
    </div>
    <input class="form-control" placeholder="匹配开头" spellcheck="false" oninput="exInput(this);">
    <div class="input-group-append">
        <button class="btn btn-info btn-sm btn-remove-exc" type="button" title="移除" onclick="removeExclude(this);">
            <i class="iconfont icon-minus"></i>
        </button>
    </div>
</div>
    `);
}

// 添加新的排除项
$('#btn-new-exclude').on('click', () => {
    addNewExclude();
});

window.exInput = el => {
    $(el).removeClass('is-invalid');
};

// 切换排除项中的uri类型
window.exChange = el => {
    const type = $(el).val();
    const $input = $(el).parent().next();
    const $group = $(el).parent().parent();
    $input.removeClass('is-invalid');
    switch (type) {
        case 'regexp':
            $input.attr('placeholder', '正则表达式匹配');
            $group.addClass('group-regexp');
            break;
        case 'exact':
            $input.attr('placeholder', '精确匹配');
            $group.removeClass('group-regexp');
            break;
        default:
            $input.attr('placeholder', '匹配开头');
            $group.removeClass('group-regexp');
    }
};

// 移除排除项
window.removeExclude = el => {
    const $group = $(el).parent().parent();
    $group.remove();
};

// 打开排除项模态窗
window.openExcludes = uid => {
    const excludes = $(`#${uid}`).data().excludes;
    const modalBody = $('#excludes-modal .modal-body');
    modalBody.html('');
    let html = '';
    if (excludes.length > 0) {
        html += '<ul>';
        excludes.forEach(exclude => {
            let badge = '';
            if (exclude.type === 'regexp') {
                badge = '<span class="badge badge-secondary" title="正则表达式匹配">正则</span>';
            } else if (exclude.type === 'exact') {
                badge = '<span class="badge badge-info" title="精确匹配">精确</span>';
            }
            html += `<li>
                <span class="h6">${exclude.uri}</span>
                ${badge}
            </li>`;
        });
        html += '</ul>';
    }
    modalBody.html(html);
    $('#excludes-modal').modal('show');
};

// 点击新增按钮
$('#btn-new-permission').on('click', () => {
    $('#uid').val('');
    $('#permission-modal .modal-title').text('新增');
    $('#permission-modal').modal();
});

// 点击导出
$('#btn-export').on('click', () => {
    window.location.href = '/node-proxy/exportPermissions';
});

// 点击导入
$('#btn-import').on('change', () => {
    const file = $('#btn-import')[0].files[0];
    const reader = new FileReader();
    reader.onload = () => {
        $.post('/node-proxy/importPermissions', {
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
window.editPermission = uid => {
    $('#uid').val(uid);
    $('#permission-modal .modal-title').text('修改');
    $('#permission-modal').modal();
};

// 点击删除
window.delPermission = uid => {
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
            $.post('/node-proxy/delPermission', {
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
    const selectAuth = $('#select-auth');
    const auth = selectAuth.val();
    if (!auth) {
        selectAuth.addClass('is-invalid');
        return;
    }

    const inputUri = $('#input-uri');
    const uri = inputUri.val().trim();
    if (!uri) {
        inputUri.addClass('is-invalid');
        inputUri.focus();
        return;
    }

    // 检查是否添加了排除项但为空的
    const emptyExc = $('.exclude-group input').filter(function () {
        return this.value === ''
    });
    if (emptyExc.length > 0) {
        $(emptyExc[0]).addClass('is-invalid');
        $(emptyExc[0]).focus();
        return;
    }

    // 构造要传输的排除项
    const excludes = [];
    $('.exclude-group').each((i, item) => {
        const type = $(item).find('select').val();
        const uri = $(item).find('input').val();
        excludes.push({
            type,
            uri
        });
    })

    $('#btn-save').attr('disabled', 'disabled');
    const uid = $('#uid').val();
    $.post('/node-proxy/savePermission', {
        uid,
        auth,
        type: $('#select-type').val(),
        uri,
        params: $('#input-params').val(),
        method: $('#select-method').val(),
        domainId: $('#select-domain').val(),
        excludes: JSON.stringify(excludes)
    }).done(data => {
        if (data.code === 1) {
            let updatedItem;
            if (!uid) {
                // 新增
                $('.results').append(data.data);
                $('tfoot').css('display', 'none');
            } else {
                // 修改
                $(`#${uid}`).replaceWith(data.data);
            }

            // 重新触发一次搜索
            searcher.triggerSearch();
            $('#permission-modal').modal('hide');
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
$('#permission-modal').on('show.bs.modal', () => {
    const uid = $('#uid').val();
    $('.exclude-group').remove();
    if (!uid) {
        // 新增
        $('#select-auth').val('').change();
        $('#select-domain').val('').change();
        $('#select-type').val('start').change();
        $('#select-method').val('').change();
        $('#input-uri').val('');
        $('#input-uri').removeClass('is-invalid');
        $('#input-params').val('');
    } else {
        // 修改
        const data = $(`#${uid}`).data();
        $('#select-domain').val(data.domainid).change();
        $('#select-auth').val(data.auth).change();
        $('#select-type').val(data.type).change();
        $('#select-method').val(data.method).change();
        $('#input-uri').val(data.uri);
        $('#input-params').val(data.params);
        const excludes = data.excludes;
        if (excludes.length > 0) {
            excludes.forEach(item => {
                addNewExclude();
                const appended = $('#exclude-container').children(".exclude-group:last-child");
                $(appended).find('select').val(item.type).change();
                $(appended).find('input').val(item.uri);
            });
        }
    }
    $('#select-auth').removeClass('is-invalid');
});

window.onpageshow = evt => {
    if (evt.persisted) {
        location.reload();
    }
};

$('#select-auth').select2();

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