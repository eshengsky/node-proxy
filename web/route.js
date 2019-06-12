/*
 * @Author: Sky.Sun 
 * @Date: 2018-02-07 12:02:40 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2019-06-12 16:27:32
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const passport = require('passport');
const Strategy = require('passport-local').Strategy;
const ensureLogin = require('connect-ensure-login');
const serverlog = require('serverlog-node');
const logger = serverlog.getLogger('noginx-webui');
const pug = require('pug');
const routeCompiledFunc = pug.compileFile('./web/views/partials/route-tr.pug');
const serverCompiledFunc = pug.compileFile('./web/views/partials/server-item.pug');
const permissionCompiledFunc = pug.compileFile('./web/views/partials/permission-tr.pug');
const cacheCompiledFunc = pug.compileFile('./web/views/partials/cache-tr.pug');
const domainCompiledFunc = pug.compileFile('./web/views/partials/domain-tr.pug');
const mongoose = require('../db').mongoose;
const routeModel = require('../models/routes').routeModel;
const serverModel = require('../models/servers').serverModel;
const permissionModel = require('../models/permissions').permissionModel;
const cacheModel = require('../models/caches').cacheModel;
const domainModel = require('../models/domains').domainModel;
const configPath = require('../getConfigPath')();
const config = require(configPath);
const userConfig = config.auth.users;
const canEdit = require('./auth').canEdit;
const authMw = require('./auth').authMw;
const common = require('../utilities/common');
const cacheClient = require('../cache').cacheClient;
const cacheKeyPrefix = config.db.redisKeyPrefix;
const cacheConnect = config.db.redisConnect;
const methods = config.methods;
const staticDirPath = config.staticDirPath;
const staticCacheSettings = config.serverFileCache;
const showdown = require('showdown');
showdown.extension('headerlink', () => {
    return [{
        type: 'output',
        regex: /(<h(\d) id="(.+)">(.+?))(<\/h\2>)/g,
        replace: (wm, g1, g2, id, g4, g5) => {
            return g1 + ' <a href="#' + id + '"><i class="iconfont icon-pin"></i></a>' + g5;
        }
    }];
});
const fs = require('fs');
const package = require('../package.json');
const mongoUrl = config.db.mongodb;

/**
 * Get current operator
 * @param {object} req - request
 */
const getCurrentUser = req => {
    return `${req.user} [${req.ip}]`;
}

passport.use(new Strategy(
    (username, password, cb) => {
        // Check if user valid
        if (userConfig[username] && userConfig[username] === password) {
            // Pass
            return cb(null, username);
        }

        // Failure
        return cb(null, false);
    }));

passport.serializeUser((username, cb) => {
    cb(null, username);
});

passport.deserializeUser((username, cb) => {
    if (userConfig[username]) {
        return cb(null, username);
    }
    return cb(new Error('用户名或密码错误！'));
});

/**
 * 静态资源
 */
router.use('/static', express.static(path.resolve(__dirname, '../node_modules/')));
router.use('/static', express.static(path.resolve(__dirname, '../web/static')));
router.use('/static', express.static(path.resolve(__dirname, '../help')));

/**
 * 解析 urlencode 的请求到 req.body
 */
router.use(express.urlencoded({
    extended: true
}));

router.use(session({
    secret: 'noginxproxyserverbyskysun',
    saveUninitialized: true,
    resave: true,
    store: new MongoStore({
        mongooseConnection: mongoose.connection
    })
}));
router.use(passport.initialize());
router.use(passport.session());

/**
 * 登录页面
 */
router.get('/login', (req, res) => {
    res.render('login');
});

/**
 * 接收登录请求
 */
router.post('/login', (req, res) => {
    passport.authenticate('local', (err, user) => {
        if (err) {
            logger.error('用户登录失败！', err);
            res.json({
                code: -1,
                message: '服务器错误！'
            });
        } else if (!user) {
            logger.error('用户登录失败！用户名或密码错误：', req.body);
            res.json({
                code: -1,
                message: '用户名或密码错误！'
            });
        } else {
            // 登录操作
            req.logIn(user, err => {
                let returnTo = '/noginx/';
                if (err) {
                    logger.error(err);
                    res.json({
                        code: -1,
                        message: '服务器错误！'
                    });
                } else {
                    // 尝试跳转之前的页面
                    if (req.session.returnTo) {
                        returnTo = req.session.returnTo;
                    }
                    res.json({
                        code: 1,
                        data: returnTo
                    });
                }
            });
        }
    })(req, res);
});

/**
 * 退出登录
 */
router.post('/logout', (req, res) => {
    req.logout();
    res.redirect('/noginx/login');
});

/**
 * 这之后的路由需要登录后才允许访问
 */
router.use(ensureLogin.ensureLoggedIn('/noginx/login'));

/**
 * 首页
 */
router.get('/', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const user = req.user;
    let routeList = [];
    let serverList = [];
    Promise.all([
        routeModel.find({ deleted: false }).sort({ sequence: 1 }).exec(),
        serverModel.find({ deleted: false }).exec(),
        domainModel.find({ deleted: false }).exec()
    ]).then(values => {
        routeList = values[0];
        serverList = values[1];
        domainList = values[2];
        logger.infoE('route list:', routeList);
        logger.infoE('server list:', serverList);
        logger.infoE('domain list:', domainList);
        res.render('route-list', {
            routeList,
            serverList,
            domainList,
            methods,
            staticDirPath,
            user,
            editable: canEdit(req),
            title: '路由处理',
            path: req.path
        });
    }, err => {
        logger.error('获取routes/servers/domains出错！', err);
        res.status(500).send(err.message);
    }).catch(err => {
        logger.error('获取routes/servers/domains出错！', err);
        res.status(500).send(err.message);
    });
});

/**
 * 新增或修改保存
 */
router.post('/save', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const type = req.body.type;
    const uri = req.body.uri;
    const params = req.body.params;
    const method = req.body.method;
    const domainId = req.body.domainId;
    const process = req.body.process;
    const content = req.body.content;
    const forwardUrl = req.body.forwardUrl;
    const tryFile = req.body.tryFile;
    const customStatus = req.body.customStatus;
    const customContentType = req.body.customContentType;
    const customMode = req.body.customMode;
    const customBody = req.body.customBody;
    const remarks = req.body.remarks;
    Promise.all([
        domainModel.find({ deleted: false }).exec(),
        serverModel.find({ deleted: false }).exec()
    ]).then(values => {
        const domainList = values[0];
        const serverList = values[1];
        if (domainId && !domainList.find(t => t.id === domainId)) {
            logger.error('操作失败，域名配置异常！');
            res.json({
                code: -1,
                message: '域名配置异常！'
            });
            return;
        }
        if (process === 'forward' && !serverList.find(t => t.id === content)) {
            logger.error('操作失败，转发服务器配置异常！');
            res.json({
                code: -1,
                message: '转发服务器配置异常！'
            });
            return;
        }
        if (!req.body.uid) {
            // 新增
            routeModel.findOne({
                type,
                method,
                uri,
                params,
                domainId,
                deleted: false
            }, (err, doc) => {
                if (err) {
                    logger.error('新增失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                if (doc) {
                    logger.error('新增失败，已存在相同的匹配路径');
                    res.json({
                        code: -1,
                        message: '已存在相同的匹配路径！'
                    });
                    return;
                }
                routeModel.findOne({
                    deleted: false
                }).sort('-sequence')
                    .exec((err, doc) => {
                        if (err) {
                            logger.error('获取最大sequence失败！', err);
                            res.json({
                                code: -1,
                                message: err.message
                            });
                            return;
                        }
                        let sequence = 1;
                        if (doc) {
                            sequence = doc.sequence + 1;
                        }
                        const route = new routeModel({
                            type,
                            uri,
                            params,
                            method,
                            domainId,
                            process,
                            content,
                            forwardUrl,
                            tryFile,
                            customStatus,
                            customContentType,
                            customMode,
                            customBody,
                            remarks,
                            sequence,
                            createUser: getCurrentUser(req),
                            modifyUser: getCurrentUser(req)
                        });
                        route.save((err, item) => {
                            if (err) {
                                logger.error('新增失败！', err);
                                res.json({
                                    code: -1,
                                    message: err.message
                                });
                                return;
                            }
                            const template = routeCompiledFunc({
                                route: item,
                                domainList,
                                serverList,
                                staticDirPath,
                                editable: canEdit(req)
                            });
                            res.json({
                                code: 1,
                                data: template
                            });
                        });
                    });
            });
        } else {
            // 修改
            routeModel.findOne({
                type,
                method,
                uri,
                params,
                domainId,
                deleted: false,
                _id: { $ne: req.body.uid }
            }, (err, doc) => {
                if (err) {
                    logger.error('修改失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                if (doc) {
                    logger.error('修改失败，已存在相同的匹配路径');
                    res.json({
                        code: -1,
                        message: '已存在相同的匹配路径！'
                    });
                    return;
                }
                routeModel.findByIdAndUpdate(req.body.uid, {
                    type,
                    uri,
                    params,
                    method,
                    domainId,
                    process,
                    content,
                    forwardUrl,
                    tryFile,
                    customStatus,
                    customContentType,
                    customMode,
                    customBody,
                    remarks,
                    modifyUser: getCurrentUser(req),
                    modifyTime: new Date()
                }, { new: true }, (err, item) => {
                    if (err) {
                        logger.error('修改失败！', err);
                        res.json({
                            code: -1,
                            message: err.message
                        });
                        return;
                    }
                    const template = routeCompiledFunc({
                        route: item,
                        domainList,
                        serverList,
                        staticDirPath,
                        editable: canEdit(req)
                    });
                    res.json({
                        code: 1,
                        data: template
                    });
                });
            });
        }
    }).catch(err => {
        logger.error('操作失败！', err);
        res.json({
            code: -1,
            message: err.message
        });
    });
});

/**
 * 修改启用
 */
router.post('/active', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const active = req.body.active;
    routeModel.findByIdAndUpdate(req.body.uid, {
        active,
        modifyUser: getCurrentUser(req),
        modifyTime: new Date()
    }, { new: true }, (err, item) => {
        if (err) {
            logger.error('启用失败！', err);
            res.json({
                code: -1,
                message: err.message
            });
            return;
        }
        res.json({
            code: 1,
            data: item
        });
    });
});

/**
 * 软删除
 */
router.post('/del', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    routeModel.findByIdAndUpdate(req.body.uid, {
        deleted: true,
        modifyUser: getCurrentUser(req),
        modifyTime: new Date()
    }, { new: true }, (err, item) => {
        if (err) {
            logger.error('删除失败！', err);
            res.json({
                code: -1,
                message: err.message
            });
            return;
        }
        res.json({
            code: 1,
            data: item
        });
    });
});

/**
 * 修改排序
 */
router.post('/seq', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const promiseArray = [];
    const seqList = req.body.seqList;
    seqList.forEach(item => {
        const promise = routeModel.findByIdAndUpdate(item.uid, {
            sequence: item.seq,
            modifyUser: getCurrentUser(req),
            modifyTime: new Date()
        }).exec();
        promiseArray.push(promise);
    });
    Promise.all(promiseArray).then(() => {
        res.json({
            code: 1
        });
    }, err => {
        logger.error('修改排序失败！', err);
        res.json({
            code: -1,
            message: err.message
        });
    }).catch(err => {
        logger.error('修改排序失败！', err);
        res.json({
            code: -1,
            message: err.message
        });
    });
});

/**
 * 导出路由
 */
router.get('/exportRoutes', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    routeModel.find({ deleted: false }).exec((err, routes) => {
        if (err) {
            logger.error('导出routes出错！', err);
            res.status(500).send(err.message);
            return;
        }
        res.setHeader('Content-disposition', 'attachment; filename=noginx_routes.json');
        res.setHeader('Content-type', 'application/json');
        res.send(routes);
    });
});

/**
 * 导入路由
 */
router.post('/importRoutes', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    try {
        const data = req.body.data;
        const matches = data.match(/^data:(.*);base64,(.*)$/);
        let result = matches[2];
        result = JSON.parse(common.decodeBase64(result));
        result.forEach(item => {
            // 移除id，以防与库中已有数据重复
            delete item._id;
        });
        routeModel.updateMany({
            deleted: false
        }, {
                deleted: true,
                modifyUser: getCurrentUser(req),
                modifyTime: new Date()
            }).exec(err => {
                if (err) {
                    logger.error('导入routes出错！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                routeModel.insertMany(result, err => {
                    if (err) {
                        logger.error('导入routes出错！', err);
                        res.json({
                            code: -1,
                            message: err.message
                        });
                        return;
                    }
                    res.json({
                        code: 1,
                        data: result.length.toString()
                    });
                });
            });
    } catch (err) {
        logger.error('导入routes出错！', err);
        res.json({
            code: -1,
            message: err.message
        });
    }
});

/**
 * 服务器页面
 */
router.get('/servers', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const user = req.user;
    let serverList = [];
    serverModel.find({ deleted: false }).exec((err, servers) => {
        if (err) {
            logger.error('获取servers出错！', err);
            res.status(500).send(err.message);
            return;
        }
        if (servers) {
            serverList = servers;
        }
        res.render('server-list', {
            serverList,
            user,
            editable: canEdit(req),
            title: '服务器',
            path: req.path
        });
    });
});

/**
 * 新增或修改服务器
 */
router.post('/saveServer', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const name = req.body.name;
    const reqAddresses = req.body.addresses;
    const remarks = req.body.remarks;
    const addresses = JSON.parse(reqAddresses);
    if (!req.body.uid) {
        // 新增
        serverModel.findOne({
            name,
            deleted: false
        }, (err, doc) => {
            if (err) {
                logger.error('新增失败！', err);
                res.json({
                    code: -1,
                    message: err.message
                });
                return;
            }
            if (doc) {
                logger.error('新增失败，有名称重复项');
                res.json({
                    code: -1,
                    message: `服务器名称 ${name} 已存在！`
                });
                return;
            }
            const server = new serverModel({
                name,
                addresses,
                remarks,
                createUser: getCurrentUser(req),
                modifyUser: getCurrentUser(req)
            });
            server.save((err, item) => {
                if (err) {
                    logger.error('新增失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                const template = serverCompiledFunc({
                    server: item,
                    editable: canEdit(req)
                });
                res.json({
                    code: 1,
                    data: template
                });
            });
        });
    } else {
        // 修改
        serverModel.findOne({
            name,
            deleted: false,
            _id: { $ne: req.body.uid }
        }, (err, doc) => {
            if (err) {
                logger.error('修改失败！', err);
                res.json({
                    code: -1,
                    message: err.message
                });
                return;
            }
            if (doc) {
                logger.error('修改失败，有名称重复项');
                res.json({
                    code: -1,
                    message: `服务器名称 ${name} 已存在！`
                });
                return;
            }
            serverModel.findByIdAndUpdate(req.body.uid, {
                name,
                addresses,
                remarks,
                modifyUser: getCurrentUser(req),
                modifyTime: new Date()
            }, { new: true }, (err, item) => {
                if (err) {
                    logger.error('修改失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                const template = serverCompiledFunc({
                    server: item,
                    editable: canEdit(req)
                });
                res.json({
                    code: 1,
                    data: template
                });
            });
        });
    }
});

/**
 * 软删除服务器
 */
router.post('/delServer', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    serverModel.findById(req.body.uid, (err, doc) => {
        if (err) {
            logger.error('删除失败！', err);
            res.json({
                code: -1,
                message: err.message
            });
            return;
        }
        routeModel.find({
            process: 'forward',
            content: req.body.uid,
            deleted: false
        }, (err, docs) => {
            if (err) {
                logger.error('删除失败！', err);
                res.json({
                    code: -1,
                    message: err.message
                });
                return;
            }
            if (docs.length > 0) {
                logger.error('删除失败！有路由规则正在使用该服务器！');
                res.json({
                    code: -1,
                    message: '有路由规则正在使用该服务器，请先修改或删除相关路由配置！'
                });
                return;
            }
            serverModel.findByIdAndUpdate(req.body.uid, {
                deleted: true,
                modifyUser: getCurrentUser(req),
                modifyTime: new Date()
            }, { new: true }, (err, item) => {
                if (err) {
                    logger.error('删除失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }

                res.json({
                    code: 1,
                    data: item
                });
            });
        });
    });
});

/**
 * 导出服务器
 */
router.get('/exportServers', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    serverModel.find({ deleted: false }).exec((err, servers) => {
        if (err) {
            logger.error('导出servers出错！', err);
            res.status(500).send(err.message);
            return;
        }
        res.setHeader('Content-disposition', 'attachment; filename=noginx_servers.json');
        res.setHeader('Content-type', 'application/json');
        res.send(servers);
    });
});

/**
 * 导入服务器
 */
router.post('/importServers', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    try {
        const data = req.body.data;
        const matches = data.match(/^data:(.*);base64,(.*)$/);
        let result = matches[2];
        result = JSON.parse(common.decodeBase64(result));
        result.forEach(item => {
            // 移除id，以防与库中已有数据重复
            delete item._id;
        });
        serverModel.updateMany({
            deleted: false
        }, {
                deleted: true,
                modifyUser: getCurrentUser(req),
                modifyTime: new Date()
            }).exec(err => {
                if (err) {
                    logger.error('导入servers出错！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                serverModel.insertMany(result, err => {
                    if (err) {
                        logger.error('导入servers出错！', err);
                        res.json({
                            code: -1,
                            message: err.message
                        });
                        return;
                    }
                    res.json({
                        code: 1,
                        data: result.length.toString()
                    });
                });
            });
    } catch (err) {
        logger.error('导入servers出错！', err);
        res.json({
            code: -1,
            message: err.message
        });
    }
});

/**
 * 身份验证页面
 */
router.get('/permissions', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const user = req.user;
    let permissionList = [];
    Promise.all([
        permissionModel.find({ deleted: false }).exec(),
        domainModel.find({ deleted: false }).exec()
    ]).then(values => {
        permissionList = values[0];
        domainList = values[1];
        res.render('permission-list', {
            permissionList,
            domainList,
            methods,
            pms: config.permissions,
            user,
            editable: canEdit(req),
            title: '身份验证',
            path: req.path
        });
    }, err => {
        logger.error('获取permissions/domains出错！', err);
        res.status(500).send(err.message);
    }).catch(err => {
        logger.error('获取permissions/domains出错！', err);
        res.status(500).send(err.message);
    });
});

/**
 * 新增或修改保存身份验证
 */
router.post('/savePermission', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const auth = req.body.auth;
    const type = req.body.type;
    const uri = req.body.uri;
    const method = req.body.method;
    const params = req.body.params;
    const domainId = req.body.domainId;
    const excludes = JSON.parse(req.body.excludes);
    domainModel.find({ deleted: false }, (err, domainList) => {
        if (err) {
            logger.error('操作失败！', err);
            res.json({
                code: -1,
                message: err.message
            });
            return;
        }
        if (domainId && !domainList.find(t => t.id === domainId)) {
            logger.error('操作失败，域名配置异常！');
            res.json({
                code: -1,
                message: '域名配置异常！'
            });
            return;
        }
        if (!req.body.uid) {
            // 新增
            permissionModel.findOne({
                type,
                method,
                uri,
                params,
                domainId,
                deleted: false
            }, (err, doc) => {
                if (err) {
                    logger.error('新增失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                if (doc) {
                    logger.error('新增失败，已存在相同的匹配路径');
                    res.json({
                        code: -1,
                        message: '已存在相同的匹配路径！'
                    });
                    return;
                }
                const permission = new permissionModel({
                    auth,
                    type,
                    uri,
                    params,
                    method,
                    pms: config.permissions,
                    domainId,
                    excludes,
                    createUser: getCurrentUser(req),
                    modifyUser: getCurrentUser(req)
                });
                permission.save((err, item) => {
                    if (err) {
                        logger.error('新增失败！', err);
                        res.json({
                            code: -1,
                            message: err.message
                        });
                        return;
                    }
                    const template = permissionCompiledFunc({
                        permission: item,
                        domainList,
                        editable: canEdit(req)
                    });
                    res.json({
                        code: 1,
                        data: template
                    });
                });
            });
        } else {
            // 修改
            permissionModel.findOne({
                type,
                uri,
                params,
                method,
                domainId,
                deleted: false,
                _id: { $ne: req.body.uid }
            }, (err, doc) => {
                if (err) {
                    logger.error('修改失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                if (doc) {
                    logger.error('修改失败，已存在相同的匹配路径');
                    res.json({
                        code: -1,
                        message: '已存在相同的匹配路径！'
                    });
                    return;
                }
                permissionModel.findByIdAndUpdate(req.body.uid, {
                    auth,
                    type,
                    uri,
                    params,
                    method,
                    pms: config.permissions,
                    domainId,
                    excludes,
                    modifyUser: getCurrentUser(req),
                    modifyTime: new Date()
                }, { new: true }, (err, item) => {
                    if (err) {
                        logger.error('修改失败！', err);
                        res.json({
                            code: -1,
                            message: err.message
                        });
                        return;
                    }
                    const template = permissionCompiledFunc({
                        permission: item,
                        domainList,
                        editable: canEdit(req)
                    });
                    res.json({
                        code: 1,
                        data: template
                    });
                });
            });
        }
    });
});

/**
 * 软删除身份验证
 */
router.post('/delPermission', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    permissionModel.findByIdAndUpdate(req.body.uid, {
        deleted: true,
        modifyUser: getCurrentUser(req),
        modifyTime: new Date()
    }, { new: true }, (err, item) => {
        if (err) {
            logger.error('删除失败！', err);
            res.json({
                code: -1,
                message: err.message
            });
            return;
        }
        res.json({
            code: 1,
            data: item
        });
    });
});

/**
 * 导出身份验证
 */
router.get('/exportPermissions', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    permissionModel.find({ deleted: false }).exec((err, permissions) => {
        if (err) {
            logger.error('导出permissions出错！', err);
            res.status(500).send(err.message);
            return;
        }
        res.setHeader('Content-disposition', 'attachment; filename=noginx_permissions.json');
        res.setHeader('Content-type', 'application/json');
        res.send(permissions);
    });
});

/**
 * 导入身份验证
 */
router.post('/importPermissions', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    try {
        const data = req.body.data;
        const matches = data.match(/^data:(.*);base64,(.*)$/);
        let result = matches[2];
        result = JSON.parse(common.decodeBase64(result));
        result.forEach(item => {
            // 移除id，以防与库中已有数据重复
            delete item._id;
        });
        permissionModel.updateMany({
            deleted: false
        }, {
                deleted: true,
                modifyUser: getCurrentUser(req),
                modifyTime: new Date()
            }).exec(err => {
                if (err) {
                    logger.error('导入permissions出错！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                permissionModel.insertMany(result, err => {
                    if (err) {
                        logger.error('导入permissions出错！', err);
                        res.json({
                            code: -1,
                            message: err.message
                        });
                        return;
                    }
                    res.json({
                        code: 1,
                        data: result.length.toString()
                    });
                });
            });
    } catch (err) {
        logger.error('导入permissions出错！', err);
        res.json({
            code: -1,
            message: err.message
        });
    }
});

/**
 * 缓存配置
 */
router.get('/caches', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const user = req.user;
    let cacheList = [];
    Promise.all([
        cacheModel.find({ deleted: false }).exec(),
        domainModel.find({ deleted: false }).exec()
    ]).then(values => {
        cacheList = values[0];
        domainList = values[1];
        res.render('cache-list', {
            cacheList,
            cacheKeyPrefix,
            domainList,
            methods,
            user,
            editable: canEdit(req),
            title: '缓存配置',
            path: req.path
        });
    }, err => {
        logger.error('获取caches/domains出错！', err);
        res.status(500).send(err.message);
    }).catch(err => {
        logger.error('获取caches/domains出错！', err);
        res.status(500).send(err.message);
    });
});

/**
 * 新增或修改保存缓存配置
 */
router.post('/saveCache', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const type = req.body.type;
    const uri = req.body.uri;
    const params = req.body.params;
    const method = req.body.method;
    const domainId = req.body.domainId;
    const keyType = req.body.keyType;
    const keyContent = req.body.keyContent;
    const expired = req.body.expired;
    domainModel.find({ deleted: false }, (err, domainList) => {
        if (err) {
            logger.error('操作失败！', err);
            res.json({
                code: -1,
                message: err.message
            });
            return;
        }
        if (domainId && !domainList.find(t => t.id === domainId)) {
            logger.error('操作失败，域名配置异常！');
            res.json({
                code: -1,
                message: '域名配置异常！'
            });
            return;
        }
        if (!req.body.uid) {
            // 新增
            cacheModel.findOne({
                type,
                method,
                uri,
                params,
                domainId,
                deleted: false
            }, (err, doc) => {
                if (err) {
                    logger.error('新增失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                if (doc) {
                    logger.error('新增失败，已存在相同的匹配路径');
                    res.json({
                        code: -1,
                        message: '已存在相同的匹配路径！'
                    });
                    return;
                }
                const cache = new cacheModel({
                    type,
                    uri,
                    params,
                    method,
                    domainId,
                    keyType,
                    keyContent,
                    expired,
                    createUser: getCurrentUser(req),
                    modifyUser: getCurrentUser(req)
                });
                cache.save((err, item) => {
                    if (err) {
                        logger.error('新增失败！', err);
                        res.json({
                            code: -1,
                            message: err.message
                        });
                        return;
                    }
                    const template = cacheCompiledFunc({
                        cache: item,
                        domainList,
                        cacheKeyPrefix,
                        editable: canEdit(req)
                    });
                    res.json({
                        code: 1,
                        data: template
                    });
                });
            });
        } else {
            // 修改
            cacheModel.findOne({
                type,
                method,
                uri,
                params,
                domainId,
                deleted: false,
                _id: { $ne: req.body.uid }
            }, (err, doc) => {
                if (err) {
                    logger.error('修改失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                if (doc) {
                    logger.error('修改失败，已存在相同的匹配路径');
                    res.json({
                        code: -1,
                        message: '已存在相同的匹配路径！'
                    });
                    return;
                }
                cacheModel.findByIdAndUpdate(req.body.uid, {
                    type,
                    uri,
                    params,
                    method,
                    domainId,
                    keyType,
                    keyContent,
                    expired,
                    modifyUser: getCurrentUser(req),
                    modifyTime: new Date()
                }, { new: true }, (err, item) => {
                    if (err) {
                        logger.error('修改失败！', err);
                        res.json({
                            code: -1,
                            message: err.message
                        });
                        return;
                    }
                    const template = cacheCompiledFunc({
                        cache: item,
                        domainList,
                        cacheKeyPrefix,
                        editable: canEdit(req)
                    });
                    res.json({
                        code: 1,
                        data: template
                    });
                });
            });
        }
    });
});

/**
 * 修改启用
 */
router.post('/activeCache', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const active = req.body.active;
    cacheModel.findByIdAndUpdate(req.body.uid, {
        active,
        modifyUser: getCurrentUser(req),
        modifyTime: new Date()
    }, { new: true }, (err, item) => {
        if (err) {
            logger.error('启用失败！', err);
            res.json({
                code: -1,
                message: err.message
            });
            return;
        }
        res.json({
            code: 1,
            data: item
        });
    });
});

/**
 * 软删除缓存配置
 */
router.post('/delCache', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    cacheModel.findByIdAndUpdate(req.body.uid, {
        deleted: true,
        modifyUser: getCurrentUser(req),
        modifyTime: new Date()
    }, { new: true }, (err, item) => {
        if (err) {
            logger.error('删除失败！', err);
            res.json({
                code: -1,
                message: err.message
            });
            return;
        }
        res.json({
            code: 1,
            data: item
        });
    });
});

/**
 * 导出缓存配置
 */
router.get('/exportCaches', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    cacheModel.find({ deleted: false }).exec((err, caches) => {
        if (err) {
            logger.error('导出caches出错！', err);
            res.status(500).send(err.message);
            return;
        }
        res.setHeader('Content-disposition', 'attachment; filename=noginx_caches.json');
        res.setHeader('Content-type', 'application/json');
        res.send(caches);
    });
});

/**
 * 导入缓存配置
 */
router.post('/importCaches', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    try {
        const data = req.body.data;
        const matches = data.match(/^data:(.*);base64,(.*)$/);
        let result = matches[2];
        result = JSON.parse(common.decodeBase64(result));
        result.forEach(item => {
            // 移除id，以防与库中已有数据重复
            delete item._id;
        });
        cacheModel.updateMany({
            deleted: false
        }, {
                deleted: true,
                modifyUser: getCurrentUser(req),
                modifyTime: new Date()
            }).exec(err => {
                if (err) {
                    logger.error('导入caches出错！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                cacheModel.insertMany(result, err => {
                    if (err) {
                        logger.error('导入caches出错！', err);
                        res.json({
                            code: -1,
                            message: err.message
                        });
                        return;
                    }
                    res.json({
                        code: 1,
                        data: result.length.toString()
                    });
                });
            });
    } catch (err) {
        logger.error('导入caches出错！', err);
        res.json({
            code: -1,
            message: err.message
        });
    }
});

/**
 * 获取缓存key的数量，无需写入权限
 */
router.get('/getCacheKeyLen', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    if (Array.isArray(cacheConnect)) {
        // Cluster mode
        const nodes = cacheClient.nodes('master');
        let allKeys = [];
        Promise.all(nodes.map(node => {
            return node.keys(cacheKeyPrefix + '*');
        })).then(function (keys) {
            keys.forEach(item => {
                allKeys = allKeys.concat(item);
            });
            res.json({
                code: 1,
                data: allKeys.length
            });
        }).catch(err => {
            logger.error(err);
            res.json({
                code: -1
            });
        });
    } else {
        cacheClient.keys(cacheKeyPrefix + '*', (err, keys) => {
            if (err) {
                logger.error(err);
                res.json({
                    code: -1
                });
            } else {
                res.json({
                    code: 1,
                    data: keys.length
                });
            }
        })
    }
});

/**
 * 清除缓存
 */
router.post('/clearAllCache', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const delKeys = allKeys => {
        if (allKeys.length > 0) {
            Promise.all(allKeys.map(key => {
                return cacheClient.del(key);
            })).then(reply => {
                const allDel = reply.reduce((prev, next) => {
                    return prev + next;
                });
                if (allDel > 0) {
                    res.json({
                        code: 1,
                        num: allDel
                    });
                } else {
                    res.json({
                        code: -1,
                        message: '删除失败！'
                    });
                }
            }).catch(err => {
                logger.error('清除缓存出错！', err);
                res.json({
                    code: -1,
                    message: err.message
                });
            });
        } else {
            res.json({
                code: 1,
                num: 0
            });
        }
    }
    if (Array.isArray(config.redisConnect)) {
        // 如果配成数组，则认为是集群模式
        const nodes = cacheClient.nodes('master');
        let allKeys = [];
        Promise.all(nodes.map(node => {
            return node.keys(cacheKeyPrefix + req.body.key);
        })).then(function (keys) {
            keys.forEach(item => {
                allKeys = allKeys.concat(item);
            });
            delKeys(allKeys);
        }).catch(err => {
            logger.error('清除缓存出错！', err);
            res.json({
                code: -1,
                message: err.message
            });
        });
    } else {
        const key = cacheKeyPrefix + req.body.key;
        cacheClient.keys(key).then(keys => {
            delKeys(keys);
        }).catch(err => {
            logger.error('清除缓存出错！', err);
            res.json({
                code: -1,
                message: err.message
            });
        });
    }
});

/**
 * 域名配置页面
 */
router.get('/domains', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const user = req.user;
    let domainList = [];
    domainModel.find({ deleted: false }).exec((err, domains) => {
        if (err) {
            logger.error('获取domains出错！', err);
            res.status(500).send(err.message);
            return;
        }
        if (domains) {
            domainList = domains;
        }
        res.render('domain-list', {
            domainList,
            user,
            editable: canEdit(req),
            title: '域名配置',
            path: req.path
        });
    });
});

/**
 * 新增或修改保存域名
 */
router.post('/saveDomain', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const domainPath = req.body.domainPath;
    const remarks = req.body.remarks;
    if (!req.body.uid) {
        // 新增
        domainModel.findOne({
            domainPath,
            deleted: false
        }, (err, doc) => {
            if (err) {
                logger.error('新增失败！', err);
                res.json({
                    code: -1,
                    message: err.message
                });
                return;
            }
            if (doc) {
                logger.error('新增失败，已存在相同的域名');
                res.json({
                    code: -1,
                    message: '已存在相同的域名！'
                });
                return;
            }
            const domain = new domainModel({
                domainPath,
                remarks,
                createUser: getCurrentUser(req),
                modifyUser: getCurrentUser(req)
            });
            domain.save((err, item) => {
                if (err) {
                    logger.error('新增失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                const template = domainCompiledFunc({
                    domain: item,
                    editable: canEdit(req)
                });
                res.json({
                    code: 1,
                    data: template
                });
            });
        });
    } else {
        // 修改
        domainModel.findOne({
            domainPath,
            deleted: false,
            _id: { $ne: req.body.uid }
        }, (err, doc) => {
            if (err) {
                logger.error('修改失败！', err);
                res.json({
                    code: -1,
                    message: err.message
                });
                return;
            }
            if (doc) {
                logger.error('修改失败，已存在相同的域名');
                res.json({
                    code: -1,
                    message: '已存在相同的域名！'
                });
                return;
            }
            domainModel.findByIdAndUpdate(req.body.uid, {
                domainPath,
                remarks,
                modifyUser: getCurrentUser(req),
                modifyTime: new Date()
            }, { new: true }, (err, item) => {
                if (err) {
                    logger.error('修改失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                const template = domainCompiledFunc({
                    domain: item,
                    editable: canEdit(req)
                });
                res.json({
                    code: 1,
                    data: template
                });
            });
        });
    }
});

/**
 * 软删除域名
 */
router.post('/delDomain', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const domainId = req.body.uid;
    domainModel.findById(domainId, (err, doc) => {
        if (err) {
            logger.error('删除失败！', err);
            res.json({
                code: -1,
                message: err.message
            });
            return;
        }
        Promise.all([
            routeModel.find({ domainId: domainId, deleted: false }).exec(),
            cacheModel.find({ domainId: domainId, deleted: false }).exec(),
            permissionModel.find({ domainId: domainId, deleted: false }).exec()
        ]).then(values => {
            const all = values.reduce((prev, next) => prev.concat(next));
            if (all.length > 0) {
                // 说明路由、缓存、身份验证中使用到了该域名
                logger.error('删除失败！有路由、缓存或身份验证规则正在使用该配置！');
                res.json({
                    code: -1,
                    message: '有路由、缓存或身份验证规则正在使用该配置，请先修改或删除相关规则！'
                });
                return;
            }
            domainModel.findByIdAndUpdate(domainId, {
                deleted: true,
                modifyUser: getCurrentUser(req),
                modifyTime: new Date()
            }, { new: true }, (err, item) => {
                if (err) {
                    logger.error('删除失败！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }

                res.json({
                    code: 1,
                    data: item
                });
            });
        }).catch(err => {
            logger.error('删除失败！', err);
            res.json({
                code: -1,
                message: err.message
            });
        });
    });
});

/**
 * 导出域名
 */
router.get('/exportDomains', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    domainModel.find({ deleted: false }).exec((err, domains) => {
        if (err) {
            logger.error('导出domains出错！', err);
            res.status(500).send(err.message);
            return;
        }
        res.setHeader('Content-disposition', 'attachment; filename=noginx_domains.json');
        res.setHeader('Content-type', 'application/json');
        res.send(domains);
    });
});

/**
 * 导入域名
 */
router.post('/importDomains', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    try {
        const data = req.body.data;
        const matches = data.match(/^data:(.*);base64,(.*)$/);
        let result = matches[2];
        result = JSON.parse(common.decodeBase64(result));
        result.forEach(item => {
            // 移除id，以防与库中已有数据重复
            delete item._id;
        });
        domainModel.updateMany({
            deleted: false
        }, {
                deleted: true,
                modifyUser: getCurrentUser(req),
                modifyTime: new Date()
            }).exec(err => {
                if (err) {
                    logger.error('导入domains出错！', err);
                    res.json({
                        code: -1,
                        message: err.message
                    });
                    return;
                }
                domainModel.insertMany(result, err => {
                    if (err) {
                        logger.error('导入domains出错！', err);
                        res.json({
                            code: -1,
                            message: err.message
                        });
                        return;
                    }
                    res.json({
                        code: 1,
                        data: result.length.toString()
                    });
                });
            });
    } catch (err) {
        logger.error('导入domains出错！', err);
        res.json({
            code: -1,
            message: err.message
        });
    }
});

/**
 * 环境信息
 */
router.get('/info', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    const user = req.user;
    res.render('info', {
        info: {
            nodeVersion: process.version,
            nodeEnv: process.env.NODE_ENV || 'development',
            proxyVersion: package.version,
            mongoUrl,
            cacheKeyPrefix,
            cacheConnect: Array.isArray(cacheConnect) ? JSON.stringify(cacheConnect) : cacheConnect,
            config,
            staticCacheSettings
        },
        user,
        editable: canEdit(req),
        title: '信息',
        path: req.path
    });
});

/**
 * 帮助
 */
router.get('/help', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    const user = req.user;
    const converter = new showdown.Converter({
        extensions: ['headerlink'],
        ghCompatibleHeaderId: true
    });
    fs.readFile(path.join(__dirname, '../help/help.md'), (err, buff) => {
        if (err) {
            logger.error(err);
            res.sendStatus(500);
            return;
        }
        const html = converter.makeHtml(buff.toString());
        res.render('help', {
            html,
            user,
            editable: canEdit(req),
            title: '帮助',
            path: req.path
        });
    })
});

/**
 * 获取服务器文件目录
 * 前端配置页面静态文件选择用到
 */
router.get('/getFiles', (req, res) => {
    const prePath = req.query.path;
    const readDir = (dirPath, selected) => {
        fs.readdir(dirPath, (err, files) => {
            if (err) {
                logger.error('获取文件出错！', err.message);
                res.json({
                    code: '-1',
                    message: err.message
                });
                return;
            }
            const validFiles = [];
            files.forEach(file => {
                // 过滤以点号开头的文件
                if (file.charAt(0) === '.') {
                    return;
                }
                const filePath = path.join(dirPath, file);
                try {
                    const stat = fs.statSync(filePath);
                    let extname = '';
                    if (stat.isFile()) {
                        extname = path.extname(filePath);
                        if (extname) {
                            extname = extname.substring(1);
                        }
                    }
                    validFiles.push({
                        name: file,
                        isDir: stat.isDirectory(),
                        isFile: stat.isFile(),
                        extname,
                        selected: selected === file
                    });
                } catch (err) { }
            });

            res.json({
                code: '1',
                data: {
                    files: validFiles,
                    dirPath
                }
            });
        })
    };
    fs.stat(prePath, (err, stats) => {
        if (err) {
            logger.error('获取文件出错！', err.message);
            res.json({
                code: '-1',
                message: err.message
            });
            return;
        }
        if (stats.isDirectory()) {
            readDir(prePath);
        } else {
            const dirPath = path.resolve(prePath, '..').replace(/\\/g, '/');
            readDir(dirPath, prePath.substring(dirPath.length + 1));
        }
    })
});

router.get('/filePreview', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    const fileName = decodeURIComponent(req.query.path);
    if (!fileName) {
        return res.sendStatus(400);
    }

    let extname = path.extname(fileName);
    let cls = '';
    if (extname) {
        extname = extname.substring(1);
        cls = `file-${extname}`;
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    fs.stat(fileName, (err, stats) => {
        if (err) {
            // 文件不存在
            if (err.code === 'ENOENT') {
                return res.render('file-preview', {
                    errmsg: `文件 ${fileName} 不存在！`,
                    fileName,
                    cls
                });
            } else {
                logger.error(err);
                return res.sendStatus(500);
            }
        }
        if (!stats.isFile()) {
            return res.render('file-preview', {
                errmsg: `${fileName} 不是合法文件！`,
                fileName,
                cls
            });
        }

        // 图片的直接返回，让浏览器自己处理展示图片
        if (['jpg', 'jpeg', 'gif', 'bmp', 'ico', 'tiff', 'png', 'svg'].includes(extname)) {
            res.setHeader('Content-Type', mime.lookup(extname));
            return fs.createReadStream(fileName).pipe(res);
        }

        // 大于 30m 的文件不允许预览
        if (stats.size / (1024 * 1024) > 30) {
            return res.render('file-preview', {
                errmsg: '该文件太大了不支持预览！',
                fileName,
                cls
            });
        }


        res.render('file-preview', {
            fileName,
            cls
        });
    })
});

router.get('/getFileContent', (req, res) => {
    const filePath = req.query.path;
    fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
