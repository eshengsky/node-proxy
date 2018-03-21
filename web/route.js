/*
 * @Author: Sky.Sun 
 * @Date: 2018-02-07 12:02:40 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-03-15 17:46:17
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const passport = require('passport');
const Strategy = require('passport-local').Strategy;
const ensureLogin = require('connect-ensure-login');
const log4js = require('log4js');
const logger = log4js.getLogger('proxy-web');
const pug = require('pug');
const routeCompiledFunc = pug.compileFile('./web/views/route-tr.pug');
const serverCompiledFunc = pug.compileFile('./web/views/server-item.pug');
const mongoose = require('../db').mongoose;
const routeModel = require('../models/routes').routeModel;
const serverModel = require('../models/servers').serverModel;
const userConfig = require('../config/auth.json').users;
const canEdit = require('./auth').canEdit;
const authMw = require('./auth').authMw;
const common = require('../utilities/common');

/**
 * 获取当前操作人
 * @param {object} req - 请求对象
 */
const getCurrentUser = req => {
    return `${req.user} [${req.ip}]`;
}

passport.use(new Strategy(
    (username, password, cb) => {
        // 判断用户是否有效
        if (userConfig[username] && userConfig[username] === password) {
            // 验证通过
            return cb(null, username);
        }

        // 验证失败
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

/**
 * 解析 urlencode 的请求到 req.body
 */
router.use(express.urlencoded({
    extended: true
}));

router.use(session({
    secret: 'lvmamah5nodeproxybyskysun',
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
                let returnTo = '/nodeProxy/';
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
    res.redirect('/nodeProxy/login');
});

/**
 * 这之后的路由需要登录后才允许访问
 */
router.use(ensureLogin.ensureLoggedIn('/nodeProxy/login'));

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
        serverModel.find({ deleted: false }).exec()
    ]).then(values => {
        routeList = values[0];
        serverList = values[1];
        res.render('route-list', {
            routeList,
            serverList,
            user,
            editable: canEdit(req),
            title: '路由处理',
            path: req.path
        });
    }, err => {
        logger.error('获取routes/servers出错！', err);
        res.status(500).send(err.message);
    }).catch(err => {
        logger.error('获取routes/servers出错！', err);
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
    const process = req.body.process;
    const content = req.body.content;
    const tryFile = req.body.tryFile;
    const remarks = req.body.remarks;
    if (!req.body.uid) {
        // 新增
        routeModel.findOne({
            type,
            uri,
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
                        process,
                        content,
                        tryFile,
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
            uri,
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
                process,
                content,
                tryFile,
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
        res.setHeader('Content-disposition', 'attachment; filename=node_proxy_routes.json');
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
    const hosts = req.body.hosts;
    const remarks = req.body.remarks;

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
                hosts,
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
                hosts,
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
        const name = doc.name;
        routeModel.find({
            process: 'forward',
            content: name,
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
                    message: '有路由规则正在使用该服务器，请先删除相关路由配置！'
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
        res.setHeader('Content-disposition', 'attachment; filename=node_proxy_servers.json');
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

module.exports = router;
