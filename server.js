const express = require('express');
const app = express();
app.set('view engine', 'pug');
app.set('views', './web/views');
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
const defaultPort = 4000;
const auth_wechat = 'wechat';
const auth_lvmm = 'lvmm';

/**
 * create a keep-alive agent to share
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
 * route list
 */
const routeList = [];

/**
 * server list
 */
const serverList = [];

/**
 * get latest routes/servers, and start schedule
 */
schedule.getLatest(routeList, serverList);

/**
 * round robin servers to forward
 * 
 * @param {object} req
 * @param {object} res
 * @param {string} serverName
 * @param {string} logMsg
 */
function robinProxy(req, res, serverName, logMsg) {
    const server = serverList.find(server => server.name === serverName);
    if (server) {
        const hostArray = server.hostArray;
        if (hostArray && Array.isArray(hostArray) && hostArray.length > 0) {
            const target = {
                target: hostArray.shift()
            };
        
            proxy.web(req, res, target);
        
            hostArray.push(target.target);

            logMsg += `（host: ${target.target}）`;
            logger.info(logMsg);
        } else {
            logger.error('forward server invalid!');
        }
    } else {
        logger.error('forward server invalid!');
    }
}

/**
 * error handler
 * 
 * @param {object} err
 * @param {object} req
 * @param {object} res
 */
function errHandler(err, req, res) {
    logger.error('ERROR:', err);
    res.sendStatus(500);
}

/**
 * fix req.baseUrl, req.url, so that the true path of the static file can be properly patched out
 * 
 * @param {object} route
 * @param {object} req
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

    req.baseUrl = baseUrl;

    req.url = req.path.substring(baseUrl.length) || '/';
}

/**
 * static file handler
 * @param {object} route
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function staticHandler(route, req, res, next) {
    reqHandler(route, req);
    const serv = staticTransfer(route.content, {
        // return index if access to a directory
        index: ['index.html', 'index.htm'],

        // if can't find files, try sending index.html files from the configured root path, which is generally
        tryFile: route.tryFile
    });
    serv(req, res, next);
    req.url = req.originalUrl;
}

/**
 * generate a filter function
 * whether returns the corresponding rule
 * 
 * @param {object} req
 * @returns {function}
 */
function routeFilter(req) {
    return item => {
        if (item.active && !item.deleted) {
            let reqPath = req.path;
            let uri = item.uri;

            // regexp match
            if (item.type === 'regexp') {
                uri = new RegExp(uri);
                return uri.test(reqPath);
            }

            // if req.path has no extname, try to firstly add tail slash
            if (!path.extname(reqPath) && reqPath.substr(-1) !== '/') {
                reqPath = `${reqPath}/`;
            }

            // if uri has no extname, try to firstly add tail slash
            if (!path.extname(uri) && uri.substr(-1) !== '/') {
                uri = `${uri}/`;
            }
            
            // exact match
            if (item.type === 'exact') {
                return reqPath === uri;
            }

            // match start
            if (item.type === 'start') {
                return reqPath.startsWith(uri);
            }

            return false;
        }
        return false;
    };
}

/**
 * node-proxy web ui（http://localhost:4000/nodeProxy）request
 */
app.use('/nodeProxy', webRoute);

/**
 * common requst handler
 */
app.use((req, res, next) => {
    let logMsg = `${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl} --> `;

    // try to find route rule
    const route = routeList.find(routeFilter(req));

    // no matched rule, go to fallback
    if (!route) {
        logMsg += 'no matched route rule';
        logger.info(logMsg);
        next();
        return;
    }

    logMsg += `hit route rule {${route._id}} --> `;

    let redirect = route.content;
    switch (route.process) {
        // static file
        case 'static':
            logMsg += 'transfer static file';
            logger.info(logMsg);
            staticHandler(route, req, res, next);
            break;

        // URL rewrite
        case 'rewrite':
            // if regexp match, support sub expression replace(variables like: $1, $2...)
            if (route.type === 'regexp') {
                redirect = req.path.replace(new RegExp(route.uri, 'g'), redirect);
            }
            logMsg += `URL rewrite: ${redirect}`;
            logger.info(logMsg);
            res.redirect(301, redirect);
            break;

        // forward
        default:
            logMsg += `forward to ${route.content}`;
            robinProxy(req, res, route.content, logMsg);
    }
});

/**
 * fallback handler
 * no matched rule, farward to fallback server
 */
app.use((req, res, next) => {
    const fallbackServer = serverList.find(server => server.fallback === 'Y');
    if (!fallbackServer) {
        next();
        return;
    }
    const logMsg = `${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl} --> fallback --> forward to ${fallbackServer.name}`;
    robinProxy(req, res, fallbackServer.name, logMsg);
});

/**
 * 404
 * if not found and no fallback will hit this, but this situation should not be theory 
 */
app.use((req, res) => {
    res.status(404).send('No fallback server found!');
});

/**
 * route error handler
 */
app.use(errHandler);

/**
 * proxy error handler
 */
proxy.on('error', errHandler);

app.set('port', process.env.PORT || defaultPort);
const server = app.listen(app.get('port'), () => {
    logger.info('node-proxy server listening on port', server.address().port, 'with pid', process.pid);
});
