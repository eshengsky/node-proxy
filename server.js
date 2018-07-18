/*
 * @Author: Sky.Sun 
 * @Date: 2018-01-17 16:07:30 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-07-13 11:08:06
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
app.use(cookieParser());
const log4js = require('./lib/log4js');
log4js.configure(config.log4js);
const logger = log4js.getLogger('noginx');
const webRoute = require('./web/route');
const schedule = require('./schedule');
const common = require('./utilities/common');
const url = require('url');
const querystring = require('querystring');
const uuid = require('uuid');
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
 * 生成一个筛选函数
 * 筛选函数返回是否能找到对应的规则
 * 
 * @param {object} req - 请求
 * @returns {function} - 筛选函数
 */
function routeFilter(req) {
    return item => {
        if (item.active && !item.deleted) {
            // 首先检测域名是否一致
            let domainMatch = false;
            if (!item.domainId) {
                domainMatch = true;
            } else {
                const domain = settings.getDomains().find(t => t.id === item.domainId);
                if (domain) {
                    domainMatch = req.hostname === domain.domainPath;
                    if (isDebug && req.query.__domain === domain.domainPath) {
                        // 链接参数中的 __domain 与规则一致也认为匹配成功，方便本地调试
                        domainMatch = true;
                    }
                }
            }
            if (!domainMatch) {
                return false;
            }

            // 判断请求方式
            if (item.method && item.method.toUpperCase() !== req.method.toUpperCase()) {
                return false;
            }

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
 * 避免点击劫持 (clickjacking)
 * 添加Server头
 */
app.use((req, res, next) => {
    res.header('server', `noginx v${version}`);
    res.header('x-frame-options', 'SAMEORIGIN');
    next();
});

/**
 * 配置界面
 */
app.use('/noginx', webRoute);

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
        const cacheConf = settings.getCaches().find(routeFilter(req));
        if (cacheConf) {
            logMsg += `命中缓存规则 {${cacheConf._id}} --> `;

            if (req.headers['redis-cache-ignore']) {
                // ServerLog 支持绕过缓存，方便开发和测试
                logMsg += '不走缓存 (通过 ServerLog 绕过缓存) --> ';
                routeHandler();
            } else if (req.query[debugMode.debugParam] === 'true') {
                // 调试模式绕过缓存
                logMsg += '不走缓存 (调试模式绕过缓存) --> ';
                routeHandler();
            } else if (Number(cacheConf.expired) <= 0) {
                // 过期时间配置为非正数，不走缓存
                logMsg += '不走缓存 (过期时间为非正数) --> ';
                routeHandler();
            } else if (cacheConf.station === 'Y' && !req.cookies['H5_CITY']) {
                // 客户端包没有站点信息，服务端需要ip定位，不走缓存
                logMsg += '不走缓存 (与站点关联但客户端无站点信息) --> ';
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
                    logger.info(logMsg, req);
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
                logger.info(logMsg, req);
                res.sendStatus(500);
                return;
            }
        }

        // 尝试匹配普通路由规则
        const route = settings.getRoutes().find(routeFilter(req));

        // 找不到匹配的规则
        if (!route) {
            logMsg += '无匹配路由规则';
            logger.info(logMsg, req);
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
                logger.info(logMsg, req);
                res.redirect(301, redirect);
                break;

            case 'custom':
                logMsg += '自定义响应';
                logger.info(logMsg, req);
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
                        logger.error(logMsg, req);
                        next();
                        return;
                    }
                    if (stats.isFile()) {
                        // 配置了一个文件路径
                        logMsg += ` --> 尝试发送指定文件：${filePath}`;
                        logger.info(logMsg, req);
                        if (req.query[debugMode.debugParam] === 'true') {
                            fs.readFile(filePath, (err, content) => {
                                if (err) {
                                    logger.error(`文件：${filePath} 发送失败！`, err.message, req);
                                    next();
                                } else {
                                    const html = debugMode.getDebugHtml(content, debugMode.getLogArray(res));
                                    res.send(html);
                                }
                            });
                        } else {
                            res.sendFile(filePath, err => {
                                if (err) {
                                    logger.error(`文件：${filePath} 发送失败！`, err.message, req);
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
                        logger.error(logMsg, req);
                        next();
                    }
                })
        }
    }

    // 1. 尝试匹配身份验证规则
    const permission = settings.getPermissions().find(routeFilter(req));
    if (permission) {
        logMsg += `命中身份验证规则 {${permission._id}} --> `;

        // 找到了规则，继续判断是否在排除项中
        const excludes = permission.excludes;
        const exclude = excludes.find(routeFilter(req));

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
                        logger.info(logMsg, req);
                    });
                } else {
                    logger.error(`验证规则 ${permission.auth} 未返回 Promise`, req);
                    logMsg += `验证规则 ${permission.auth} 未返回 Promise，显示 403`;
                    logger.info(logMsg, req);
                    res.sendStatus(403);
                }
            } else {
                logger.error(`验证规则 ${permission.auth} 异常`, req);
                logMsg += `验证规则 ${permission.auth} 异常，显示 403`;
                logger.info(logMsg, req);
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
    logger.warn(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl} 404 Not Found!`, req);
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
    logger.error(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl} Internal Server Error! Error: ${err.message}`, req);
    if (req.query[debugMode.debugParam] === 'true') {
        const html = debugMode.getDebugHtml('Internal Server Error', debugMode.getLogArray(res));
        res.send(html);
    } else {
        res.sendStatus(500);
    }
});

app.set('port', process.env.PORT || defaultPort);
const server = app.listen(app.get('port'), () => {
    logger.info('Noginx listening on port', server.address().port, 'with pid', process.pid);
});
