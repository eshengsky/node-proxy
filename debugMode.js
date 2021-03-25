/*
 * @Author: Sky.Sun 
 * @Date: 2018-07-06 11:52:09 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-07-12 15:52:53
 */
const cheerio = require('cheerio');
const configPath = require('./getConfigPath')();
const config = require(configPath);
const debugParam = config.debugParam;

/**
 * 调试模式下根据日志生成服务端日志 HTML
 * @param {Array} logs - 日志对象
 */
function generateServerLogHtml(logs) {
    const $ = cheerio.load(`<div id="server-log-data" style="display: none;">
    <div class="server-log-warn">
        <div class="eruda-icon-container">
            <span class="eruda-icon eruda-icon-exclamation-triangle"></span>
        </div>
        <p>注意：这里仅显示当前文档请求所对应的后端日志，若要查看所有页面资源及Ajax请求的后端日志，请在PC端安装 <a href="https://github.com/eshengsky/chrome-extension-server-log" target="_blank" style="color: #444;">ServerLog</a> 插件查看。</p>
    </div>
    <ul class="server-log-list"></ul>
</div>`);
    logs.forEach(logObj => {
        const msgArr = logObj.message;
        let msgStr = '';
        const type = logObj.type ? logObj.type.toLowerCase() : 'info';

        // 将数组转为字符串形式显示
        msgArr.forEach(msg => {
            // 错误对象
            if (msg && msg.message && msg.stack) {
                if (msg.stack.indexOf(msg.message) >= 0) {
                    msgStr += msg.stack.replace(/\n/g, '<br>')
                        .replace(/ /g, '&nbsp;');
                } else {
                    msgStr += `${msg.message}<br>${msg.stack.replace(/\n/g, '<br>')
                        .replace(/ /g, '&nbsp;')}`;
                }
            } else if (typeof msg === 'object') {
                msgStr += JSON.stringify(msg);
            } else {
                msgStr += msg;
            }
            msgStr += ' ';
        });

        // 将链接包装成a标签
        msgStr = msgStr.replace(/(https?:\/\/|www\.)\S+/g, url => `<a href="${url}" target="_blank">${url}</a>`);

        // 超过一定时长的请求加重显示
        const tooSlow = 2000;
        msgStr = msgStr.replace(/请求耗时: (\d+)ms/g, (m, s1) => {
            if (Number(s1) >= tooSlow) {
                return `请求耗时: <span style="color: #f80; font-weight: bold;">${s1}ms</span>`;
            } else {
                return m;
            }
        });

        const html = [
            `<li class="${type} log-li">`,
            `<span class="log-content"><span class="time">[${logObj.time.split(' ')[1]}]</span> `,
            `<span class="type">[${logObj.type}]</span> `
        ];

        if (logObj.category) {
            html.push(
                `<span class="category">${logObj.category}</span> `);
        }

        html.push(
            '<span class="split">- </span>',
            `<span class="message">${msgStr}</span></span>`,
            '</li>');

        $('#server-log-data ul').append(html.join(''));
    });
    return $.html();
}

/**
 * 生成完整的调试文档
 * @param {String} sourceHtml - 原始文档
 * @param {Array} logs - 后端日志数组
 */
function getDebugHtml(sourceHtml, logs) {
    const $ = cheerio.load(sourceHtml);
    const serverlogHtml = generateServerLogHtml(logs);

    // 使用 prepend 添加到 body 顶部，使得 console 重写等功能提前于其它脚本
    $('body').prepend(`<script src="/node-proxy/static/js/debug.js"></script>`);
    $('body').prepend('<script src="//cdn.jsdelivr.net/npm/eruda"></script>');
    $('body').prepend(serverlogHtml);
    return $.html();
}

/**
 * 获取日志数组
 * @param {Object} res - response
 */
function getLogArray(res) {
    let logs = [];
    try {
        const serverLog = res.get('X-Server-Log');
        if (serverLog) {
            logs = JSON.parse(decodeURIComponent(serverLog));
        }
    } catch (err) {
        
    }
    return logs;
}

module.exports = {
    getDebugHtml,
    getLogArray,
    debugParam
};
