/*
 * @Author: Sky.Sun 
 * @Date: 2018-07-11 15:41:00 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-07-12 15:27:24
 */

const staticTransfer = require('./lib/staticTransfer');
const configPath = require('./getConfigPath')();
const config = require(configPath);
const staticDirPath = config.staticDirPath;
/**
 * 修正 req 的 baseUrl 和 url，使得能正确拼凑出静态文件真实路径
 * 
 * @param {object} route - 路由规则
 * @param {object} req - 请求
 */
function reqHandler(route, req) {
    let baseUrl = '';
    if (route.type === 'regexp') {
        const matched = req.path.match(new RegExp(route.uri));
        if (matched && matched.length > 0) {
            baseUrl = matched[0];
        }
    } else {
        baseUrl = route.uri;
    }

    // 配置规则中的 uri 作为 baseUrl
    req.baseUrl = baseUrl;

    // 从请求路径中剔除 baseUrl 后剩余部分作为 url
    req.url = req.path.substring(baseUrl.length) || '/';
}

/**
 * 静态文件处理
 * @param {object} route - 路由规则
 * @param {object} req - 请求
 * @param {object} res - 响应
 * @param {function} next - 下一个中间件
 * @param {string} logMsg - 日志拼接字符串
 */
function staticHandler(route, req, res, next, logMsg) {
    reqHandler(route, req);
    const dirPath = `${staticDirPath}/${route.content}`;

    const serv = staticTransfer(dirPath, {
        // 如果访问的是一个目录，则返回目录下的文件
        index: ['index.html', 'index.htm'],

        // 如果找不到文件，尝试从所配置的根路径下发送 index.html 文件，一般用于前端修改路由的单页应用
        tryFile: route.tryFile,

        // 前置日志，在后续完成拼接并打印
        logMsg
    });
    serv(req, res, next);

    /**
     * 因为经过了 reqHandler 的处理，这里要将请求的 url 替换成原始 url
     * 这样后续的处理才能拿到正确的 url
     */
    req.url = req.originalUrl;
}

module.exports = staticHandler;
