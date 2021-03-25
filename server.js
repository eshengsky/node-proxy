/*
 * @Author: Sky.Sun 
 * @Date: 2018-01-17 16:07:30 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2021-03-24 15:57:16
 */
const express = require('express');
const app = express();
app.set('view engine', 'pug');
app.set('views', './web/views');
const favicon = require('serve-favicon');
const path = require('path');
const fs = require('fs');
const version = require('./package.json').version;
const configPath = require('./getConfigPath')();
const config = require(configPath);
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const serverlog = require('serverlog-node');
serverlog.config(config.serverlog);
const logger = serverlog.getLogger('node-proxy');
const webRoute = require('./web/route');
const schedule = require('./schedule');
const common = require('./utilities/common');
const url = require('url');
const querystring = require('querystring');
const debugMode = require('./debugMode');
const cacheClient = require('./cache').cacheClient;
const cacheKeyPrefix = config.db.redisKeyPrefix;
const staticDirPath = config.staticDirPath;
const settings = require('./settings');
const staticHandler = require('./staticHandler');
const proxyWeb = require('./proxyWeb');
const isDebug = process.argv[2] === '--debug';
const defaultPort = 9000;
const permissionModules = {};
const permissionDir = path.join(__dirname, './permissionModules');
fs.readdir(permissionDir, (err, files) => {
    if (err) {
        logger.error('读取permissionModules出错！', err);
        return;
    }
    files.forEach(file => {
        const filePath = path.join(permissionDir, file);
        fs.stat(filePath, (err, stats) => {
            if (err) {
                logger.error(`读取${filePath}出错！`, err);
                return;
            }
            if (stats.isFile()) {
                if (path.extname(file) === '.js') {
                    permissionModules[file] = require(filePath);
                }
            }
        })
    });
})

/**
 * 记录未捕获异常
 */
process.on('uncaughtException', err => {
    console.error('[Uncaught Exception]', err);
});

/**
 * 记录未处理的Promise失败
 */
process.on('unhandledRejection', reason => {
    console.error('[Unhandled Rejection]', reason);
});

/**
 * 立即获取并更新一次路由、服务器、身份验证、缓存设置及域名的数据，然后按计划任务持续自动更新
 */
schedule.startJob();

/**
 * 从所配规则中，找出最匹配的那个规则并返回
 * 
 * @param {*} rules - 规则数组
 * @param {*} req - 请求对象
 */
function getMatchedRule (rules, req) {
    if (!rules || !rules.length) {
        return null;
    }

    // 临时匹配数组，最多只可能有2条，其中开头匹配最多1条，正则匹配最多1条
    const arr = [];

    // 使用for而非forEach是为了方便continue流程控制
    for (let i = 0; i < rules.length; i++) {
        const item = rules[i];
        if (item.active && !item.deleted) {
            // 匹配域名
            let domainMatch = false;
            if (!item.domainId) {
                domainMatch = true;
            } else {
                const domains = settings.getDomains();
                const domain = domains.find(t => t.id === item.domainId);
                if (!domain) {
                    domainMatch = false;
                } else {
                    domainMatch = req.hostname === domain.domainPath;
                }
            }
            if (!domainMatch) {
                continue;
            }

            // 匹配请求方式
            if (item.method && item.method.toUpperCase() !== req.method.toUpperCase()) {
                continue;
            }

            // 匹配请求参数
            if (item.params) {
                const query = req.query;
                const body = req.body;
                const cookies = req.cookies;
                try {
                    if (!Boolean(eval(item.params))) {
                        continue;
                    }
                } catch (err) {
                    logger.error('匹配参数异常！params:', item.params);
                    continue;
                }
            }

            // 匹配路径
            let reqPath = req.path;
            let uri = item.uri;
            if (item.type !== 'regexp') {
                // 对于没有后缀的 req.path，尝试加上末尾斜杠（/）后再判断，提高容错
                if (!path.extname(reqPath) && reqPath.substr(-1) !== '/') {
                    reqPath = `${reqPath}/`;
                }

                // 对于没有后缀的 uri，尝试加上末尾斜杠（/）后再判断，提高容错
                if (!path.extname(uri) && uri.substr(-1) !== '/') {
                    uri = `${uri}/`;
                }

                if (item.type === 'exact') {
                    // 精确匹配
                    if (reqPath === uri) {
                        // 精确匹配成功的话，终止遍历，直接返回结果
                        return item;
                    }
                    continue;
                } else {
                    // 开头匹配
                    if (reqPath.startsWith(uri)) {
                        // 开头匹配成功的话，看数组中是否已经存在开头匹配的项了
                        const existsIdx = arr.findIndex(t => t.type === 'start');
                        if (existsIdx >= 0) {
                            // 如果存在，再比较uri长度
                            let existsItemUri = arr[existsIdx].uri;
                            if (!path.extname(existsItemUri) && existsItemUri.substr(-1) !== '/') {
                                existsItemUri = `${existsItemUri}/`;
                            }
                            if (uri.length > existsItemUri.length) {
                                // 删除之前存在的规则，并在末尾存入uri更长的那条规则
                                arr.splice(existsIdx, 1);
                                arr.push(item);
                            }
                        } else {
                            // 不存在，直接加入
                            arr.push(item);
                        }
                    }
                }
            } else {
                // 正则表达式匹配
                uri = new RegExp(uri);
                if (uri.test(reqPath)) {
                    // 如果匹配成功，看下数组中是否已经存在正则匹配的项，如果不存在才存入
                    if (!arr.some(t => t.type === 'regexp')) {
                        arr.push(item);
                    }
                }
            }
        }
    }

    // 精确匹配成功会直接返回，所以走到这一步时，一定只剩下开头匹配和正则匹配了，数组长度只可能有3种情况：0, 1, 2
    if (!arr.length) {
        return null;
    }
    if (arr.length === 1) {
        return arr[0];
    }

    // 数组长度为2，说明一定是1条开头匹配，1条正则匹配，此时需要再判断下开头匹配是否是兜底规则
    const bottomRuleIdx = arr.findIndex(t => (t.type === 'start' && t.uri === '/'));
    if (bottomRuleIdx >= 0) {
        arr.splice(bottomRuleIdx, 1);
    }

    // 此时，一定不存在兜底规则了，则取数组中的第一项返回，因为第一项规则必定是排序靠前的
    return arr[0];
}

/**
 * 注册serverlog中间件
 */
app.use(serverlog.middleware());

/**
 * Cookie Parser
 */
app.use(cookieParser());

/**
 * 安全性
 */
app.use(helmet());

/**
 * 添加Server头
 */
app.use((req, res, next) => {
    res.setHeader('Server', `node-proxy v${version}`);
    next();
});

/**
 * 配置界面
 */
app.use('/node-proxy', webRoute);

/**
 * 处理网站icon请求
 */
app.use(favicon(path.join(__dirname, 'favicon.ico')));

/**
 * 处理普通请求
 */
app.use((req, res, next) => {
    let logMsg = `${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl} --> `;

    // 2. 缓存处理，在身份验证之后进行
    function cacheHandler() {
        // 尝试匹配缓存配置
        const cacheConf = getMatchedRule(settings.getCaches(), req);
        if (cacheConf) {
            logMsg += `命中缓存规则 {${cacheConf._id}} --> `;

            if (req.query[debugMode.debugParam] === 'true') {
                // 调试模式绕过缓存
                logMsg += '不走缓存 (调试模式绕过缓存) --> ';
                routeHandler();
            } else if (Number(cacheConf.expired) <= 0) {
                // 过期时间配置为非正数，不走缓存
                logMsg += '不走缓存 (过期时间为非正数) --> ';
                routeHandler();
            } else {
                // 走缓存
                const body = req.body;
                const cookie = req.cookies;
                let cacheKey = cacheConf.keyType === 'Custom' ? cacheConf.keyContent : '{{url}}';
                cacheKey = cacheKey.replace(/{{url}}/g, common.getFullUrl(req))
                    .replace(/{{(body.+)}}/g, (full, sub) => {
                        let ret = '';
                        try {
                            ret = eval(sub);
                        } catch (e) {
                            logger.error(`{${cacheConf.id}} eval 错误！`);
                        }
                        return ret;
                    })
                    .replace(/{{(cookie.+)}}/g, (full, sub) => {
                        let ret = '';
                        try {
                            ret = eval(sub);
                        } catch (e) {
                            logger.error(`{${cacheConf.id}} eval 错误！`);
                        }
                        return ret;
                    });
                cacheKey = cacheKeyPrefix + cacheKey;
                cacheClient.get(cacheKey, (err, str) => {
                    // 如果读取缓存出错了，则绕过缓存，且不给req附加redisKey属性，以防止写缓存过于频繁
                    if (err) {
                        logger.error('Redis Get Error:', err.message);
                        logMsg += '不走缓存 (Redis Get Error) --> ';
                        routeHandler();
                        return;
                    }

                    // 如果读到的是null，说明缓存过期了，此时才给req附加redisKey属性，以便响应时写入缓存
                    if (str == null) {
                        req.redisKey = cacheKey;
                        req.redisExpired = cacheConf.expired;
                        logMsg += '不走缓存 (未找到缓存) --> ';
                        routeHandler();
                        return;
                    }

                    logMsg += '返回缓存数据';
                    logger.info(logMsg);
                    res.setHeader('X-Redis-Cache', 'on');
                    res.setHeader('X-Redis-Key', cacheKey);
                    res.send(str);
                });
            }
        } else {
            // 不走缓存
            routeHandler();
        }
    }

    // 3. 路由处理，在缓存处理之后进行
    function routeHandler() {
        /**
         * 内置路由规则，以 /h5node_:server 开头的转发到 server 服务器，且转发后的 url 不包含 /h5node_:server
         * 如：/h5node_node_pro 转到 node_pro，/h5node_ssr 转到 ssr
         */
        if (/^\/h5node_\w+/.test(req.path)) {
            // 符合内置路由规则，尝试继续匹配
            logMsg += ` 命中内置路由规则 --> `;
            const matched = req.path.match(/^\/h5node_(\w+)/);
            const server = matched[1];
            if (settings.getServers().some(t => t.name === server)) {
                // 服务器存在
                req.url = req.url.substring(matched[0].length);
                proxyWeb({
                    req,
                    res,
                    serverName: server,
                    logMsg
                });
                return;
            } else {
                // 服务器不存在
                logMsg += `服务器${server}不存在`;
                logger.info(logMsg);
                res.sendStatus(500);
                return;
            }
        }

        // 尝试匹配普通路由规则
        const route = getMatchedRule(settings.getRoutes(), req);

        // 找不到匹配的规则
        if (!route) {
            logMsg += '无匹配路由规则';
            logger.info(logMsg);
            next();
            return;
        }

        if (route.type === 'start' && route.uri === '/') {
            logMsg += `命中兜底规则 {${route._id}} --> `;
        } else {
            logMsg += `命中路由规则 {${route._id}} --> `;
        }

        let redirect = route.content;
        switch (route.process) {
            // 处理转发
            case 'forward':
                proxyWeb({
                    req,
                    res,
                    serverId: route.content,
                    logMsg
                });
                break;

            // URL 重写
            case 'rewrite':
                // 如果是正则，支持替换子表达式（用变量 $1, $2...）
                if (route.type === 'regexp') {
                    redirect = req.path.replace(new RegExp(route.uri, 'g'), redirect);
                }

                if (redirect.includes('$query')) {
                    let qs = querystring.stringify(req.query);
                    let symbol = '?';
                    if (url.parse(redirect).search) {
                        if (url.parse(redirect).search.charAt(0) === '?') {
                            symbol = '&';
                        }
                    }
                    qs = qs ? `${symbol}${qs}` : '';
                    redirect = redirect.replace('$query', qs);
                }
                logMsg += `URL重写：${redirect}`;
                logger.info(logMsg);
                res.redirect(301, redirect);
                break;

            case 'custom':
                logMsg += '自定义响应';
                logger.info(logMsg);
                res.status(route.customStatus);
                res.type(route.customContentType);
                res.end(route.customBody);
                break;

            // 处理静态文件
            default:
                logMsg += '处理静态文件';
                const filePath = `${staticDirPath}/${route.content}`;

                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        logMsg += ` --> 服务器文件路径：${filePath} 不存在`;
                        logger.error(logMsg);
                        next();
                        return;
                    }
                    if (stats.isFile()) {
                        // 配置了一个文件路径
                        logMsg += ` --> 尝试发送指定文件：${filePath}`;
                        logger.info(logMsg);
                        if (req.query[debugMode.debugParam] === 'true') {
                            fs.readFile(filePath, (err, content) => {
                                if (err) {
                                    logger.error(`文件：${filePath} 发送失败！`, err.message);
                                    next();
                                } else {
                                    const html = debugMode.getDebugHtml(content, debugMode.getLogArray(res));
                                    res.send(html);
                                }
                            });
                        } else {
                            res.sendFile(filePath, err => {
                                if (err) {
                                    logger.error(`文件：${filePath} 发送失败！`, err.message);
                                    next();
                                }
                            });
                        }
                    } else if (stats.isDirectory()) {
                        // 配置的是目录
                        staticHandler(route, req, res, next, logMsg);
                    } else {
                        // 既不是文件也不是目录
                        logMsg += ` --> 服务器路径：${filePath} 不是一个合法的文件或目录`;
                        logger.error(logMsg);
                        next();
                    }
                })
        }
    }

    // 1. 尝试匹配身份验证规则
    const permission = getMatchedRule(settings.getPermissions(), req);
    if (permission) {
        logMsg += `命中身份验证规则 {${permission._id}} --> `;

        // 找到了规则，继续判断是否在排除项中
        const excludes = permission.excludes;

        //TODO:
        const exclude = null;

        // 无符合的排除项，说明必须走身份验证
        if (!exclude) {
            const moduleFn = permissionModules[permission.auth];
            if (moduleFn && typeof moduleFn === 'function') {
                const promise = moduleFn(req, res, next);
                if (promise instanceof Promise) {
                    promise.then(() => {
                        // 验证通过
                        logMsg += '验证通过 --> ';
                        cacheHandler();
                    }, () => {
                        logMsg += '准备跳转验证页面';
                        logger.info(logMsg);
                    });
                } else {
                    logger.error(`验证规则 ${permission.auth} 未返回 Promise`);
                    logMsg += `验证规则 ${permission.auth} 未返回 Promise，显示 403`;
                    logger.info(logMsg);
                    res.sendStatus(403);
                }
            } else {
                logger.error(`验证规则 ${permission.auth} 异常`);
                logMsg += `验证规则 ${permission.auth} 异常，显示 403`;
                logger.info(logMsg);
                res.sendStatus(403);
            }
            return;
        } else {
            logMsg += `在排除项中不做身份验证 --> `;
        }
    }
    cacheHandler();
});

/**
 * 404
 * 未配置兜底规则（以 '/' 开头的路由规则），或者静态文件处理时未找到文件
 */
app.use((req, res) => {
    logger.warn(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl} 404 Not Found!`);
    if (req.query[debugMode.debugParam] === 'true') {
        const html = debugMode.getDebugHtml('Not Found', debugMode.getLogArray(res));
        res.send(html);
    } else {
        res.sendStatus(404);
    }
});

/**
 * 错误处理
 */
app.use((err, req, res) => {
    logger.error(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl} Internal Server Error! Error: ${err.message}`);
    if (req.query[debugMode.debugParam] === 'true') {
        const html = debugMode.getDebugHtml('Internal Server Error', debugMode.getLogArray(res));
        res.send(html);
    } else {
        res.sendStatus(500);
    }
});

app.set('port', process.env.PORT || defaultPort);

let server;
if (config.ssl.enable) {
    const https = require('https');
    try {
        const privateKey  = fs.readFileSync(config.ssl.key, 'utf8');
        const certificate = fs.readFileSync(config.ssl.cert, 'utf8');
        server = https.createServer({
            key: privateKey,
            cert: certificate
        }, app);
    } catch (err) {
        logger.error('未能成功读取SSL私钥或证书文件！Error:', err);
        process.exit(1);
    }
} else {
    const http = require('http');
    server = http.createServer(app);
}
server.listen(app.get('port'), () => {
    const port = server.address().port;
    logger.info(`Node Proxy listening on port ${port} with pid ${process.pid}, Admin URL: ${config.ssl.enable ? 'https' : 'http'}://localhost:${port}/node-proxy`);
});
