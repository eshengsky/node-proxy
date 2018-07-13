const searcher = new QuickSearch({
    inputSelector: '[type=search]',
    findSelector: '.servers .col-md-4',
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
    }
});

const popoverOptions = {
    trigger: 'hover',
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
    window.location.href = '/noginx/exportServers';
});

// 点击导入
$('#btn-import').on('change', () => {
    const file = $('#btn-import')[0].files[0];
    const reader = new FileReader();
    reader.onload = () => {
        $.post('/noginx/importServers', {
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
            $.post('/noginx/delServer', {
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
            })
        }
    });
}

// 服务器名称 文本框变化
$('#input-name').on('input', () => {
    $('#input-name').removeClass('is-invalid');
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

    // 检查地址是否为空或格式错误
    const invalidAddrs = $('.exclude-group input').filter(function () {
        if (!this.value) {
            return true;
        } else if (!/^https?:\/\//.test(this.value)) {
            return true;
        } else {
            return false;
        }
    });
    if (invalidAddrs.length > 0) {
        $(invalidAddrs[0]).addClass('is-invalid');
        $(invalidAddrs[0]).focus();
        return;
    }

    // 构造要传输的地址数据
    const addresses = [];
    $('.exclude-group').each((i, item) => {
        const weight = $(item).find('select').val();
        const address = $(item).find('input').val();
        addresses.push({
            weight,
            address
        });
    })

    $('#btn-save').attr('disabled', 'disabled');
    const uid = $('#uid').val();
    $.post('/noginx/saveServer', {
        uid,
        name,
        addresses: JSON.stringify(addresses),
        remarks: $('#input-remarks').val()
    }).done(data => {
        if (data.code === 1) {
            let updatedItem;
            if (!uid) {
                // 新增
                $('.servers').append(data.data);
                updatedItem = $('.servers .server-item:last');
            } else {
                // 修改
                $(`#${uid}`).replaceWith(data.data);
                updatedItem = $(`#${uid}`);
            }
            generateChart(updatedItem.find('.chart')[0]);
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

function addNewAddress(show = true) {
    $('#host-container').append(`
<div class="input-group mb-1 exclude-group">
    <div class="input-group-prepend">
        <select class="custom-select form-control prepend-select">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
        </select>
    </div>
    <input class="form-control" placeholder="请以http(s)开头" spellcheck="false" oninput="addrInput(this);">
    <div class="input-group-append">
        <button class="btn btn-info btn-sm btn-remove-exc ${show ? '' : 'remove-hidden'}" type="button" title="移除" onclick="removeAddr(this);">
            <i class="iconfont icon-minus"></i>
        </button>
    </div>
</div>
    `);
}

// 添加新项
$('#btn-new-address').on('click', () => {
    addNewAddress();
    $('.btn-remove-exc').removeClass('remove-hidden');
});

window.addrInput = el => {
    $(el).removeClass('is-invalid');
};

// 移除排除项
window.removeAddr = el => {
    const $group = $(el).parent().parent();
    $group.remove();
    if ($('.exclude-group').length === 1) {
        $('.btn-remove-exc').addClass('remove-hidden');
    }
};

// 生成饼图
function generateChart(chartEl) {
    const container = $(chartEl).parent().parent();
    const containerWidth = container.width();
    const addresses = container.data('addresses');
    const list = addresses.map(t => t.address);
    $(chartEl).css('height', (containerWidth / 2 * 0.7 * 2) + list.length * 28 + 10);
    const data = addresses.map(t => {
        return {
            name: t.address,
            value: Number(t.weight)
        }
    });
    const myChart = echarts.init(chartEl, 'light');
    option = {
        tooltip: {
            trigger: 'item',
            formatter: "服务器 {b} <br/>命中 {d}%"
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            // selectedMode: false,
            textStyle: {
                fontSize: 14
            },
            data: list
        },
        series: [
            {
                type:'pie',
                // radius : [containerWidth / 2 * 0.35, containerWidth / 2 * 0.7],
                radius : [0, containerWidth / 2 * 0.7],
                center: ['50%', (containerWidth / 2 * 0.7) + (28 * list.length)],
                hoverOffset: 6,
                selectedOffset: 6,
                itemStyle: {
                    emphasis: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
                // avoidLabelOverlap: false,
                selectedMode: 'single',
                label: {
                    normal: {
                        show: false
                    },
                    emphasis: {
                        show: false
                    }
                },
                labelLine: {
                    normal: {
                        show: false
                    }
                },
                data: data
            }
        ]
    };
    myChart.setOption(option);
}

document.querySelectorAll('.chart').forEach(chart => {
    generateChart(chart);
});

// 模态框显示之前填充数据
$('#server-modal').on('show.bs.modal', () => {
    const uid = $('#uid').val();
    $('.exclude-group').remove();
    if (!uid) {
        // 新增
        $('#input-name').val('');
        $('#input-name').removeClass('is-invalid');
        addNewAddress(false);
        $('#input-remarks').val('');
    } else {
        // 修改
        const data = $(`#${uid}`).data();
        $('#input-name').val(data.name);
        const addresses = data.addresses;
        if (addresses.length > 0) {
            addresses.forEach(item => {
                addNewAddress();
                const appended = $('#host-container').children(".exclude-group:last-child");
                $(appended).find('select').val(item.weight);
                $(appended).find('input').val(item.address);
            });
            if ($('.exclude-group').length === 1) {
                $('.btn-remove-exc').addClass('remove-hidden');
            }
        } else {
            addNewAddress(false);
        }
        $('#input-remarks').val(data.remarks);
    }
});

// 模态框显示之后聚焦
$('#server-modal').on('shown.bs.modal', () => {
    $('#input-name').focus();
});
