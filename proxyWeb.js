/*
 * @Author: Sky.Sun 
 * @Date: 2018-07-11 15:09:50 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2019-05-14 10:55:01
 */
const httpProxy = require('http-proxy');
const cacheClient = require('./cache').cacheClient;
const configPath = require('./getConfigPath')();
const config = require(configPath);
const settings = require('./settings');
const debugMode = require('./debugMode');
const serverlog = require('serverlog-node');
const logger = serverlog.getLogger('node-proxy-webui');

const proxy = httpProxy.createProxyServer({
    xfwd: true,
    secure: false,
    preserveHeaderKeyCase: true,
    proxyTimeout: config.proxyTimeout
});

/**
 * 代理转发的错误处理
 */
proxy.on('error', (err, req, res) => {
    if (req) {
        logger.error(`Proxy Server Error! URL: ${req.protocol}://${req.get('Host')}${req.originalUrl} Error: ${err.message}`);
        if (req.query[debugMode.debugParam] === 'true') {
            const html = debugMode.getDebugHtml('Internal Server Error', debugMode.getLogArray(res));
            res.send(html);
        } else {
            res.sendStatus(500);
        }
    } else {
        logger.error(`Proxy Server Error! Error: ${err.message}`);
    }
});

/**
 * 接收到转发服务器响应的后续处理
 */
proxy.on('proxyRes', (proxyRes, req, res) => {
    const serverLog = res.get('X-Server-Log');

    // URL 中存在调试参数
    if (req.query[debugMode.debugParam] === 'true') {
        // 判断是否是 html 类型响应，或者 404/500
        const mimeType = proxyRes.headers['Content-Type'] || proxyRes.headers['content-type'] || '';
        if (mimeType.includes('text/html') || ((proxyRes.statusCode === 404 || proxyRes.statusCode === 500) && mimeType.includes('text/plain'))) {
            // 修正响应头为200，否则 nginx 会处理 404/500 错误而丢弃响应内容
            proxyRes.statusCode = 200;

            // 尝试获取所有后端日志
            let logs = [];
            if (serverLog) {
                let logData = JSON.parse(decodeURIComponent(serverLog));
                const currentHeader = proxyRes.headers['X-Server-Log'] || proxyRes.headers['x-server-log'];
                if (currentHeader) {
                    logs = JSON.parse(decodeURIComponent(currentHeader));
                    logs = logData.concat(logs);
                } else {
                    logs = logData;
                }
            }

            // 保存原始方法
            const _writeHead = res.writeHead;
            let _writeHeadArgs;
            const _end = res.end;
            let body = '';

            proxyRes.on('data', (data) => {
                data = data.toString();
                body += data;
            });

            // 重写内置方法
            res.writeHead = (...writeHeadArgs) => {
                _writeHeadArgs = writeHeadArgs;
            };
            res.write = () => { };
            res.end = (...endArgs) => {
                const output = debugMode.getDebugHtml(body, logs);

                // 一定要重新设置 Content-Length，且不能使用 output.length，因为可能包含中文
                if (proxyRes.headers && proxyRes.headers['content-length']) {
                    res.setHeader('content-length', Buffer.byteLength(output));
                }

                res.setHeader('content-type', 'text/html; charset=utf-8');

                res.setHeader('transfer-encoding', '');

                res.setHeader('cache-control', 'no-cache');

                _writeHead.apply(res, _writeHeadArgs);

                if (body.length) {
                    _end.apply(res, [output]);
                } else {
                    _end.apply(res, endArgs);
                }
            }
        }
    }

    // 如果 proxy 存在日志头且有数据，且客户端安装了 ServerLog 并开启了日志监听
    if (serverLog && req.headers['request-server-log'] === 'enabled') {
        let logData = JSON.parse(decodeURIComponent(serverLog));

        /**
         * 转发到的服务器（如 node_pro）返回的日志头
         * 这里要兼容下大小写
         */
        const currentHeader = proxyRes.headers['X-Server-Log'] || proxyRes.headers['x-server-log'];

        let updateHeader = '';
        if (currentHeader) {
            updateHeader = JSON.parse(decodeURIComponent(currentHeader));
            updateHeader = logData.concat(updateHeader);
            updateHeader = encodeURIComponent(JSON.stringify(updateHeader));
        } else {
            updateHeader = encodeURIComponent(JSON.stringify(logData));
        }

        proxyRes.headers['X-Server-Log'] = updateHeader;
    }

    // 如果 redisKey 存在，且返回状态码为 200，且内容类型为 html，且接口调用正常，才设置缓存
    const mimeType = proxyRes.headers['Content-Type'] || proxyRes.headers['content-type'] || '';
    const hasServiceError = proxyRes.headers['X-Service-Error'] || proxyRes.headers['x-service-error'];
    if (req.redisKey && proxyRes.statusCode === 200 && mimeType.includes('text/html')) {
        if (hasServiceError) {
            logger.warn('服务端存在接口调用异常，本次数据将不会缓存！');
        } else if (req.query[debugMode.debugParam] === 'true') {
            logger.warn('调试模式不设置缓存！');
        } else {
            let resBody = '';
            proxyRes.on('data', chunk => {
                resBody += chunk.toString();
            });
            proxyRes.on('end', () => {
                cacheClient.set(req.redisKey, resBody, 'EX', req.redisExpired, err => {
                    if (err) {
                        logger.error('Redis Set Error:', err.message);
                    }
                });
            })
        }
    }
});

/**
 * 生成随机数
 *
 * @param {Number} min 随机数下限
 * @param {Number} max 随机数上限
 * @returns
 */
function rand(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * 按权重随机选取一项
 *
 * @param {Array} list 要随机的数组
 * @param {Array} weight 权重数组
 * @returns
 */
function getRandomItem(list, weight) {
    // 必须是非空且数量一致的数组
    if (Array.isArray(list) && Array.isArray(weight) && list.length > 0 && list.length === weight.length) {
        // 权重数组必须都是数字
        if (weight.every(t => typeof t === 'number')) {
            const totalWeight = weight.reduce((prev, cur) => {
                return prev + cur;
            });

            const randomNum = rand(0, totalWeight);
            let weightSum = 0;

            for (let i = 0; i < list.length; i++) {
                weightSum += weight[i];
                if (randomNum <= weightSum) {
                    return list[i];
                }
            }
        } else {
            return null;
        }
    } else {
        return null;
    }
}

/**
 * 根据配置的服务器权重分配服务器转发
 *
 * @param {object} { req, res, serverId, serverName, logMsg }
 * @returns
 */
function proxyWeb({ req, res, serverId, serverName, logMsg }) {
    const servers = settings.getServers();
    let server;
    if (serverId) {
        server = servers.find(t => t.id === serverId);
    } else if (serverName) {
        server = servers.find(t => t.name === serverName);
    }
    if (server) {
        logMsg += `转发至${server.name}`;
        const addresses = server.addresses;
        if (addresses && Array.isArray(addresses) && addresses.length > 0) {
            const list = addresses.map(t => t.address);
            const weight = addresses.map(t => Number(t.weight));
            const proxyAddress = getRandomItem(list, weight);

            // 如果没有获取到随机服务器，说明配置异常
            if (!proxyAddress) {
                logMsg += ` --> 错误：list或weight数据格式不正确！list: ${JSON.stringify(list)} weight: ${JSON.stringify(weight)}`
                logger.error(logMsg);
                res.sendStatus(500);
                return;
            }
            
            // proxy 参数
            const option = {
                target: proxyAddress
            };

            // URL 中存在调试参数，设置为允许修改响应
            if (req.query[debugMode.debugParam] === 'true') {
                option.selfHandleResponse = true;
            }

            logMsg += ` (host: ${proxyAddress})`;
            setImmediate(() => {
                logger.info(logMsg);
            })

            // 进行转发
            proxy.web(req, res, option);
        } else {
            logMsg += ` --> 错误：服务器${serverName}配置异常！servers: ${JSON.stringify(servers)}`;
            logger.error(logMsg);
            res.sendStatus(500);
        }
    } else {
        logMsg += `错误：未找到服务器！serverId: ${serverId}, serverName: ${serverName}, servers: ${JSON.stringify(servers)}`;
        logger.error(logMsg);
        res.sendStatus(500);
    }
}

module.exports = proxyWeb;
