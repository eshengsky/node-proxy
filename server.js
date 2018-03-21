/*
 * @Author: Sky.Sun 
 * @Date: 2018-01-17 16:07:30 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-03-15 18:43:51
 */
const express = require('express');
const app = express();
app.set('view engine', 'pug');
app.set('views', './web/views');
const i18n = require('i18n');
i18n.configure({
    locales: ['en', 'zh'],
    directory: __dirname + '/locales'
});
const favicon = require('serve-favicon');
const path = require('path');
const http = require('http');
const httpProxy = require('http-proxy');
const request = require('request');
const cookieParser = require('cookie-parser');
app.use(cookieParser());
const log4js = require('log4js');
log4js.configure({
    appenders: [{
        type: 'console'
    }]
});
const logger = log4js.getLogger('proxy');
const staticTransfer = require('./staticTransfer');
const webRoute = require('./web/route');
const schedule = require('./schedule');
const common = require('./utilities/common');
const defaultPort = 5000;
const auth_wechat = 'wechat';
const auth_lvmm = 'lvmm';

/**
 * 创建一个 keep-alive 代理，这样 httpProxy 内部调用 http.request 时就无需每次都新建 TCP 连接
 */
const keepAliveAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 5000
});
const proxy = httpProxy.createProxyServer({
    agent: keepAliveAgent,
    xfwd: true,
    secure: false,
    preserveHeaderKeyCase: true
});

/**
 * 路由列表，初始是一个空数组
 */
const routeList = [];

/**
 * 服务器列表，初始是一个空数组
 */
const serverList = [];

/**
 * 立即获取并更新一次路由和服务器的数据，然后按计划任务持续自动更新
 */
schedule.getLatest(routeList, serverList);

/**
 * 轮询（round robin）获取服务器以进行转发
 * 
 * @param {object} req - 请求
 * @param {object} res - 响应
 * @param {string} serverName - 要转发到的服务器名
 * @param {string} logMsg - 前置日志内容
 */
function robinProxy(req, res, serverName, logMsg) {
    // 每次请求会获取列表中的首个服务器
    const server = serverList.find(server => server.name === serverName);
    if (server) {
        const hostArray = server.hostArray;
        if (hostArray && Array.isArray(hostArray) && hostArray.length > 0) {
            const target = {
                target: hostArray.shift()
            };

            // 请求转发至对应服务器
            proxy.web(req, res, target);

            // 将刚刚使用过的服务器添加到列表末尾，实现轮询
            hostArray.push(target.target);

            logMsg += `（host: ${target.target}）`;
            logger.info(logMsg);
        } else {
            logger.error('转发服务器配置异常！');
        }
    } else {
        logger.error('转发服务器配置异常！');
    }
}

/**
 * 错误处理函数
 * 
 * @param {object} err - 错误对象
 * @param {object} req - 请求
 * @param {object} res - 响应
 */
function errHandler(err, req, res) {
    logger.error('ERROR:', err);
    res.sendStatus(500);
}

/**
 * 修正 req 的 baseUrl 和 url，使得能正确拼凑出静态文件真实路径
 * 
 * @param {object} route - 路由规则
 * @param {object} req - 请求
 */
function reqHandler(route) {
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
    const serv = staticTransfer(route.content, {
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

/**
 * 生成一个筛选函数
 * 筛选函数返回是否能找到对应的规则
 * 
 * @param {object} req - 请求
 * @returns {function} - 筛选函数
 */
function routeFilter(req) {
    return item => {
        if (item.active && !item.deleted) {
            let reqPath = req.path;
            let uri = item.uri;

            // 正则匹配
            if (item.type === 'regexp') {
                uri = new RegExp(uri);
                return uri.test(reqPath);
            }

            // 对于没有后缀的 req.path，尝试加上末尾斜杠（/）后再判断，提高容错
            if (!path.extname(reqPath) && reqPath.substr(-1) !== '/') {
                reqPath = `${reqPath}/`;
            }

            // 对于没有后缀的 uri，尝试加上末尾斜杠（/）后再判断，提高容错
            if (!path.extname(uri) && uri.substr(-1) !== '/') {
                uri = `${uri}/`;
            }

            // 精确匹配
            if (item.type === 'exact') {
                return reqPath === uri;
            }

            // 匹配开头
            if (item.type === 'start') {
                return reqPath.startsWith(uri);
            }

            return false;
        }
        return false;
    };
}

/**
 * 配置页面（http://127.0.0.1/nodeProxy）请求
 */
app.use('/nodeProxy', webRoute);

/**
 * 处理普通请求
 */
app.use((req, res, next) => {
    let logMsg = `${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl} --> `;

    // 尝试匹配路由规则
    const route = routeList.find(routeFilter(req));

    // 找不到匹配的规则
    if (!route) {
        logMsg += '无匹配路由规则';
        logger.info(logMsg);
        next();
        return;
    }

    logMsg += `命中路由规则 {${route._id}} --> `;

    let redirect = route.content;
    switch (route.process) {
        // 处理转发
        case 'forward':
            logMsg += `转发至${route.content}`;
            robinProxy(req, res, route.content, logMsg);
            break;

        // URL 重写
        case 'rewrite':
            // 如果是正则，支持替换子表达式（用变量 $1, $2...）
            if (route.type === 'regexp') {
                redirect = req.path.replace(new RegExp(route.uri, 'g'), redirect);
            }
            logMsg += `URL重写：${redirect}`;
            logger.info(logMsg);
            res.redirect(301, redirect);
            break;

        // 处理静态文件
        default:
            logMsg += '处理静态文件';
            if (path.extname(route.content)) {
                // 配置的是文件
                logMsg += ` --> 尝试发送指定文件：${route.content}`;
                logger.info(logMsg);
                res.sendFile(route.content, err => {
                    if (err) {
                        logger.error(`文件：${route.content} 发送失败！`, err.message);
                        next();
                    }
                });
            } else {
                // 配置的是目录
                staticHandler(route, req, res, next, logMsg);
            }
    }
});

/**
 * 404
 * 未配置兜底规则时会走到这里
 */
app.use((req, res) => {
    logger.error(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl} 404`);
    res.sendStatus(404);
});

/**
 * 错误处理
 */
app.use(errHandler);

/**
 * 代理转发的错误处理
 */
proxy.on('error', errHandler);

app.set('port', process.env.PORT || defaultPort);
const server = app.listen(app.get('port'), () => {
    logger.info('Proxy server listening on port', server.address().port, 'with pid', process.pid);
});
