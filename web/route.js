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

/**
 * get current login user
 * @param {object} req
 */
const getCurrentUser = req => {
    return `${req.user} [${req.ip}]`;
}

passport.use(new Strategy(
    (username, password, cb) => {
        // check if user is valid
        if (userConfig[username] && userConfig[username] === password) {
            // pass
            return cb(null, username);
        }

        // invalid
        return cb(null, false);
    }));

passport.serializeUser((username, cb) => {
    cb(null, username);
});

passport.deserializeUser((username, cb) => {
    if (userConfig[username]) {
        return cb(null, username);
    }
    return cb(new Error('User name or password is wrong!'));
});

/**
 * web static source
 */
router.use('/static', express.static(path.resolve(__dirname, '../node_modules/')));
router.use('/static', express.static(path.resolve(__dirname, '../web/static')));

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
 * login page
 */
router.get('/login', (req, res) => {
    res.render('login');
});

/**
 * login post request
 */
router.post('/login', (req, res) => {
    passport.authenticate('local', (err, user) => {
        if (err) {
            logger.error('User login failed!');
            res.json({
                valid: false,
                message: 'Internal Server Error!'
            });
        } else if (!user) {
            logger.error('User login failed! User name or password is wrong：', req.body);
            res.json({
                valid: false,
                message: 'User name or password is wrong!'
            });
        } else {
            // go to login
            req.logIn(user, err => {
                let returnTo = '/nodeProxy/';
                if (err) {
                    logger.error(err);
                    res.json({
                        valid: false,
                        message: 'Internal Server Error!'
                    });
                } else {
                    // try to redirect to preview page
                    if (req.session.returnTo) {
                        returnTo = req.session.returnTo;
                    }
                    res.json({
                        valid: true,
                        returnTo
                    });
                }
            });
        }
    })(req, res);
});

/**
 * logout
 */
router.post('/logout', (req, res) => {
    req.logout();
    res.redirect('/nodeProxy/login');
});

/**
 * the routes after this need to be logged in to access
 */
router.use(ensureLogin.ensureLoggedIn('/nodeProxy/login'));

/**
 * homepage(route list page)
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
        res.render('route-list', { routeList, serverList, user, editable: canEdit(req) });
    }, err => {
        logger.error('get routes/servers error!', err);
        res.status(500).send(err.message);
    }).catch(err => {
        logger.error('get routes/servers error!', err);
        res.status(500).send(err.message);
    });
});

/**
 * save new or modify
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
        // new
        routeModel.findOne({
            type,
            uri,
            deleted: false
        }, (err, doc) => {
            if (err) {
                logger.error('Add failed!', err);
                res.status(500).send(err.message);
                return;
            }
            if (doc) {
                logger.error('Add failed! The same matching path already exists!');
                res.status(500).send('The same matching path already exists!');
                return;
            }
            routeModel.findOne({
                deleted: false
            }).sort('-sequence')
                .exec((err, doc) => {
                    if (err) {
                        logger.error('Get max sequence failed!', err);
                        res.status(500).send(err.message);
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
                            logger.error('Add failed!', err);
                            res.status(500).send(err.message);
                            return;
                        }
                        const template = routeCompiledFunc({
                            route: item,
                            editable: canEdit(req)
                        });
                        res.send(template);
                    });
                });
        });
    } else {
        // modify
        routeModel.findOne({
            type,
            uri,
            deleted: false,
            _id: { $ne: req.body.uid }
        }, (err, doc) => {
            if (err) {
                logger.error('Modify failed!', err);
                res.status(500).send(err.message);
                return;
            }
            if (doc) {
                logger.error('Modify failed! The same matching path already exists!');
                res.status(500).send('The same matching path already exists!');
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
                    logger.error('Modify failed!', err);
                    res.status(500).send(err.message);
                    return;
                }
                const template = routeCompiledFunc({
                    route: item,
                    editable: canEdit(req)
                });
                res.send(template);
            });
        });
    }
});

/**
 * modify active status
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
            logger.error('Modify active failed!', err);
            res.status(500).send(err.message);
            return;
        }
        res.json(item);
    });
});

/**
 * soft delete
 */
router.post('/del', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    routeModel.findByIdAndUpdate(req.body.uid, {
        deleted: true,
        modifyUser: getCurrentUser(req),
        modifyTime: new Date()
    }, { new: true }, (err, item) => {
        if (err) {
            logger.error('Delete failed!', err);
            res.status(500).send(err.message);
            return;
        }
        res.json(item);
    });
});

/**
 * modify sequence
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
        res.end();
    }, err => {
        logger.error('Modify sequence failed!', err);
        res.status(500).send(err.message);
    }).catch(err => {
        logger.error('Modify sequence failed!', err);
        res.status(500).send(err.message);
    });
});

/**
 * servers page
 */
router.get('/servers', (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const user = req.user;
    let serverList = [];
    serverModel.find({ deleted: false }).exec((err, servers) => {
        if (err) {
            logger.error('Get servers error!', err);
            res.status(500).send(err.message);
            return;
        }
        if (servers) {
            serverList = servers;
        }
        res.render('server-list', { serverList, user, editable: canEdit(req) });
    });
});

/**
 * add or modify server
 */
router.post('/saveServer', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    const name = req.body.name;
    const fallback = req.body.fallback;
    const hosts = req.body.hosts;
    const remarks = req.body.remarks;

    function done() {
        if (!req.body.uid) {
            // new
            serverModel.findOne({
                name,
                deleted: false
            }, (err, doc) => {
                if (err) {
                    logger.error('Add failed!', err);
                    res.status(500).send(err.message);
                    return;
                }
                if (doc) {
                    logger.error('Add failed! Duplicate name!');
                    res.status(500).send(`Server name ${name} already exists!`);
                    return;
                }
                const server = new serverModel({
                    name,
                    fallback,
                    hosts,
                    remarks,
                    createUser: getCurrentUser(req),
                    modifyUser: getCurrentUser(req)
                });
                server.save((err, item) => {
                    if (err) {
                        logger.error('Add failed!', err);
                        res.status(500).send(err.message);
                        return;
                    }
                    const template = serverCompiledFunc({
                        server: item,
                        editable: canEdit(req)
                    });
                    res.send(template);
                });
            });
        } else {
            // modify
            serverModel.findOne({
                name,
                deleted: false,
                _id: { $ne: req.body.uid }
            }, (err, doc) => {
                if (err) {
                    logger.error('Modify failed!', err);
                    res.status(500).send(err.message);
                    return;
                }
                if (doc) {
                    logger.error('Mdd failed! Duplicate name!');
                    res.status(500).send(`Server name ${name} already exists!`);
                    return;
                }
                serverModel.findByIdAndUpdate(req.body.uid, {
                    name,
                    fallback,
                    hosts,
                    remarks,
                    modifyUser: getCurrentUser(req),
                    modifyTime: new Date()
                }, { new: true }, (err, item) => {
                    if (err) {
                        logger.error('modify failed!', err);
                        res.status(500).send(err.message);
                        return;
                    }
                    const template = serverCompiledFunc({
                        server: item,
                        editable: canEdit(req)
                    });
                    res.send(template);
                });
            });
        }
    }

    // if fallback is true, change exists fallback server to false
    if (fallback === 'Y') {
        serverModel.findOneAndUpdate({ fallback: 'Y', deleted: false }, { fallback: 'N' }, err => {
            if (err) {
                logger.error('Operate failed!', err);
                res.status(500).send(err.message);
                return;
            }
            done();
        });
    } else {
        done();
    }
});

/**
 * soft delete server
 */
router.post('/delServer', authMw, (req, res) => {
    logger.info(`${req.method.toUpperCase()}: ${req.protocol}://${req.get('Host')}${req.originalUrl}`, req.body);
    serverModel.findById(req.body.uid, (err, doc) => {
        if (err) {
            logger.error('Delete failed!', err);
            res.status(500).send(err.message);
            return;
        }
        const name = doc.name;
        routeModel.find({
            process: 'forward',
            content: name,
            deleted: false
        }, (err, docs) => {
            if (err) {
                logger.error('Delete failed!', err);
                res.status(500).send(err.message);
                return;
            }
            if (docs.length > 0) {
                logger.error('Delete failed! There are routing rules in use for this server!');
                res.status(500).send('There are routing rules in use for this server, please delete the related route rules!');
                return;
            }
            serverModel.findByIdAndUpdate(req.body.uid, {
                deleted: true,
                modifyUser: getCurrentUser(req),
                modifyTime: new Date()
            }, { new: true }, (err, item) => {
                if (err) {
                    logger.error('Delete failed!', err);
                    res.status(500).send(err.message);
                    return;
                }

                // if deleted server is fallback, auto set another server to fallback
                if (item.fallback === 'Y') {
                    serverModel.findOneAndUpdate({ deleted: false }, { fallback: 'Y' }, { new: true }, (err, doc) => {
                        if (err) {
                            logger.error('Auto fallback error!', err);
                            res.status(500).send(err.message);
                            return;
                        }

                        if (doc) {
                            const template = serverCompiledFunc({
                                server: doc,
                                editable: canEdit(req)
                            });
                            res.json({
                                _id: item.id,
                                updateId: doc.id,
                                template
                            });
                        } else {
                            res.json(item);
                        }
                    });
                } else {
                    res.json(item);
                }
            });
        });
    });
});

module.exports = router;
