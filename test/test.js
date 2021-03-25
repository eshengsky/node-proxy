const { should } = require('chai');
const { fork } = require('child_process');
const path = require('path');
const rp = require('request-promise-native');
const mongoose = require('../db').mongoose;
const routeModel = require('../models/routes').routeModel;
const domainModel = require('../models/domains').domainModel;
const serverModel = require('../models/servers').serverModel;
const port = 8900;
should();

describe('node-proxy test', function () {
    this.timeout(5000);
    let stdout = '';
    let child;

    before(done => {
        const scriptPath = path.join(__dirname, '../server.js');
        child = fork(scriptPath, {
            env: {
                NODE_ENV: 'production',
                config: 'test',
                PORT: port
            },
            stdio: 'pipe'
        });
        child.on('error', err => console.log(err));
        child.stderr.on('data', err => console.error(err.toString()));
        child.stdout.on('data', data => {
            stdout += data;
            // console.log(data)
        });

        // set timeout to wait for db/redis ready
        setTimeout(() => {
            if (mongoose.connection.readyState !== 1) {
                return done(new Error('MongoDB connect failed!'));
            }
            Promise.all([
                routeModel.remove().exec(),
                domainModel.remove().exec(),
                serverModel.remove().exec()
            ]).then(() => {
                done();
            }).catch(err => {
                done(err);
            });
        }, 3000);
    });

    after(done => {
        child.kill();
        mongoose.disconnect(err => {
            done();
        });
    });

    describe('base', () => {
        it('should startup server successfully', () => {
            stdout.should.contains(`Node Proxy listening on port ${port}`);
            stdout.should.contains('Redis connected');
            stdout.should.contains('MongoDB connected');
        });

        it('should return 404 if not exist routes', done => {
            rp({
                url: `http://127.0.0.1:${port}/no-route`,
                simple: false,
                resolveWithFullResponse: true
            }).then(res => {
                res.statusCode.should.eq(404);
                done();
            }).catch(err => {
                done(err);
            });
        });
    });

    describe('match type', () => {
        it('should handle properly when match type is start and no tail slash', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/startUri1',
                process: 'static',
                content: 'index.html',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/startUri1`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/starturi1`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/startUri1/`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/startUri1/test`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/startUri1test`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(200);
                        results[1].statusCode.should.eq(404);
                        results[2].statusCode.should.eq(200);
                        results[3].statusCode.should.eq(200);
                        results[4].statusCode.should.eq(404);
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when match type is start and has tail slash', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/startUri2/',
                process: 'static',
                content: 'index.html',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/startUri2`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/starturi2`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/startUri2/`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/startUri2/test`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/startUri2test`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(200);
                        results[1].statusCode.should.eq(404);
                        results[2].statusCode.should.eq(200);
                        results[3].statusCode.should.eq(200);
                        results[4].statusCode.should.eq(404);
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when match type is exact and no tail slash', done => {
            const route = new routeModel({
                type: 'exact',
                uri: '/exactUri1',
                process: 'static',
                content: 'index.html',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/exactUri1`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/exacturi1`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/exactUri1/`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/exactUri1/test`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/exactUri1test`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(200);
                        results[1].statusCode.should.eq(404);
                        results[2].statusCode.should.eq(200);
                        results[3].statusCode.should.eq(404);
                        results[4].statusCode.should.eq(404);
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when match type is exact and has tail slash', done => {
            const route = new routeModel({
                type: 'exact',
                uri: '/exactUri2',
                process: 'static',
                content: 'index.html',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/exactUri2`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/exacturi2`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/exactUri2/`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/exactUri2/test`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/exactUri2test`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(200);
                        results[1].statusCode.should.eq(404);
                        results[2].statusCode.should.eq(200);
                        results[3].statusCode.should.eq(404);
                        results[4].statusCode.should.eq(404);
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when match type is regular expression', done => {
            const route = new routeModel({
                type: 'regexp',
                uri: '\\/reg\\/\\d+',
                process: 'static',
                content: 'index.html',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/reg/123`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/reg/123test`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/reg/test`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                    ]).then(results => {
                        results[0].statusCode.should.eq(200);
                        results[1].statusCode.should.eq(200);
                        results[2].statusCode.should.eq(404);
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });
    })

    describe('request method', () => {
        it('should handle properly when request method allows all', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/methodAll',
                process: 'static',
                content: 'index.html',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            method: 'GET',
                            url: `http://127.0.0.1:${port}/methodAll`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            method: 'POST',
                            url: `http://127.0.0.1:${port}/methodAll`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(200);
                        results[1].statusCode.should.eq(200);
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when request method only allows post', done => {
            const route = new routeModel({
                method: 'post',
                type: 'start',
                uri: '/methodPost',
                process: 'static',
                content: 'index.html',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            method: 'GET',
                            url: `http://127.0.0.1:${port}/methodPost`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            method: 'POST',
                            url: `http://127.0.0.1:${port}/methodPost`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(404);
                        results[1].statusCode.should.eq(200);
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });
    });

    describe('match domain', () => {
        it('should handle properly when no domain is specified', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/noDomain',
                process: 'static',
                content: 'index.html',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/noDomain`,
                            headers: {
                                host: `127.0.0.1:${port}`
                            },
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/noDomain`,
                            headers: {
                                host: `example.com`
                            },
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                    ]).then(results => {
                        results[0].statusCode.should.eq(200);
                        results[1].statusCode.should.eq(200);
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when domain is specified', done => {
            const domain = new domainModel({
                domainPath: 'node-proxytest1.com'
            });
            domain.save((err, item) => {
                if (err) {
                    return done(err);
                }

                const route = new routeModel({
                    domainId: item.id,
                    type: 'start',
                    uri: '/hasDomain',
                    process: 'static',
                    content: 'index.html',
                    tryFile: 'N',
                    sequence: 1
                });
                route.save(err => {
                    if (err) {
                        return done(err);
                    }

                    // job receive config data each 1 second
                    setTimeout(() => {
                        Promise.all([
                            rp({
                                url: `http://127.0.0.1:${port}/hasDomain`,
                                headers: {
                                    host: 'node-proxytest1.com'
                                },
                                simple: false,
                                resolveWithFullResponse: true
                            }),
                            rp({
                                url: `http://127.0.0.1:${port}/hasDomain`,
                                headers: {
                                    host: 'node-proxytest2.com'
                                },
                                simple: false,
                                resolveWithFullResponse: true
                            }),
                        ]).then(results => {
                            results[0].statusCode.should.eq(200);
                            results[1].statusCode.should.eq(404);
                            done();
                        }).catch(err => {
                            done(err);
                        });
                    }, 1000);
                })
            });

        });
    });

    describe('process type: static file', () => {
        it('should handle properly when set to file, and file not exist', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/staticNoFile',
                process: 'static',
                content: 'notfound.html',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    rp({
                        url: `http://127.0.0.1:${port}/staticNoFile`,
                        simple: false,
                        resolveWithFullResponse: true
                    }).then(data => {
                        data.statusCode.should.eq(404);
                        data.headers['content-type'].should.contains('text/plain');
                        data.body.should.eq('Not Found');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when set to file, and file exist', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/staticFile',
                process: 'static',
                content: 'index.html',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/staticFile`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFile/`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFilenotfound`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(200);
                        results[0].headers['content-type'].should.contains('text/html');
                        results[0].body.should.eq('<h3>hello node-proxy</h3>');
                        results[1].statusCode.should.eq(200);
                        results[1].headers['content-type'].should.contains('text/html');
                        results[1].body.should.eq('<h3>hello node-proxy</h3>');
                        results[2].statusCode.should.eq(404);
                        results[2].headers['content-type'].should.contains('text/plain');
                        results[2].body.should.eq('Not Found');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when set to folder, and folder not exist', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/staticNoFolder',
                process: 'static',
                content: 'notFoundDir',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    rp({
                        url: `http://127.0.0.1:${port}/staticNoFolder`,
                        simple: false,
                        resolveWithFullResponse: true
                    }).then(data => {
                        data.statusCode.should.eq(404);
                        data.headers['content-type'].should.contains('text/plain');
                        data.body.should.eq('Not Found');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when set to folder, and folder exist, and has index.html', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/staticFolderIndex',
                process: 'static',
                content: '',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderIndex`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderIndex/`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderIndex/index.html`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderIndex/notFound.html`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(200);
                        results[0].headers['content-type'].should.contains('text/html');
                        results[0].body.should.eq('<h3>hello node-proxy</h3>');
                        results[1].statusCode.should.eq(200);
                        results[1].headers['content-type'].should.contains('text/html');
                        results[1].body.should.eq('<h3>hello node-proxy</h3>');
                        results[2].statusCode.should.eq(200);
                        results[2].headers['content-type'].should.contains('text/html');
                        results[2].body.should.eq('<h3>hello node-proxy</h3>');
                        results[3].statusCode.should.eq(404);
                        results[3].headers['content-type'].should.contains('text/plain');
                        results[3].body.should.eq('Not Found');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when set to folder, and folder exist, and no index.html', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/staticFolderNoIndex',
                process: 'static',
                content: 'subDir',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderNoIndex`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderNoIndex/`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderNoIndex/index.html`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderNoIndex/test.html`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(404);
                        results[0].headers['content-type'].should.contains('text/plain');
                        results[0].body.should.eq('Not Found');
                        results[1].statusCode.should.eq(404);
                        results[1].headers['content-type'].should.contains('text/plain');
                        results[1].body.should.eq('Not Found');
                        results[2].statusCode.should.eq(404);
                        results[2].headers['content-type'].should.contains('text/plain');
                        results[2].body.should.eq('Not Found');
                        results[3].statusCode.should.eq(200);
                        results[3].headers['content-type'].should.contains('text/html');
                        results[3].body.should.eq('<h3>test</h3>');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when folder has not index.html and enable tryFile', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/staticFolderNoIndexTryfile',
                process: 'static',
                content: 'subDir',
                tryFile: 'Y',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderNoIndexTryfile`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderNoIndexTryfile/`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderNoIndexTryfile/index.html`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderNoIndexTryfile/test.html`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderNoIndexTryfile/a/b/c.html`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(404);
                        results[0].headers['content-type'].should.contains('text/plain');
                        results[0].body.should.eq('Not Found');
                        results[1].statusCode.should.eq(404);
                        results[1].headers['content-type'].should.contains('text/plain');
                        results[1].body.should.eq('Not Found');
                        results[2].statusCode.should.eq(404);
                        results[2].headers['content-type'].should.contains('text/plain');
                        results[2].body.should.eq('Not Found');
                        results[3].statusCode.should.eq(200);
                        results[3].headers['content-type'].should.contains('text/html');
                        results[3].body.should.eq('<h3>test</h3>');
                        results[4].statusCode.should.eq(404);
                        results[4].headers['content-type'].should.contains('text/plain');
                        results[4].body.should.eq('Not Found');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should handle properly when folder has index.html and enable tryFile', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/staticFolderTryfile',
                process: 'static',
                content: '',
                tryFile: 'Y',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    Promise.all([
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderTryfile`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderTryfile/`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderTryfile/index.html`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderTryfile/notFound.html`,
                            simple: false,
                            resolveWithFullResponse: true
                        }),
                        rp({
                            url: `http://127.0.0.1:${port}/staticFolderTryfile/a/b/c.html`,
                            simple: false,
                            resolveWithFullResponse: true
                        })
                    ]).then(results => {
                        results[0].statusCode.should.eq(200);
                        results[0].headers['content-type'].should.contains('text/html');
                        results[0].body.should.eq('<h3>hello node-proxy</h3>');
                        results[1].statusCode.should.eq(200);
                        results[1].headers['content-type'].should.contains('text/html');
                        results[1].body.should.eq('<h3>hello node-proxy</h3>');
                        results[2].statusCode.should.eq(200);
                        results[2].headers['content-type'].should.contains('text/html');
                        results[2].body.should.eq('<h3>hello node-proxy</h3>');
                        results[3].statusCode.should.eq(200);
                        results[3].headers['content-type'].should.contains('text/html');
                        results[3].body.should.eq('<h3>hello node-proxy</h3>');
                        results[4].statusCode.should.eq(200);
                        results[4].headers['content-type'].should.contains('text/html');
                        results[4].body.should.eq('<h3>hello node-proxy</h3>');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });
    });

    describe('process type: rewrite', () => {
        it('should return 301 when redirect to relative url without $query', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/rewrite1',
                process: 'rewrite',
                content: '/destUrl',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    rp({
                        url: `http://127.0.0.1:${port}/rewrite1?a=1&b=2`,
                        followRedirect: false,
                        simple: false,
                        resolveWithFullResponse: true
                    }).then(data => {
                        data.statusCode.should.eq(301);
                        data.headers['location'].should.eq('/destUrl');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should return 301 when redirect to relative url with $query', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/rewrite2',
                process: 'rewrite',
                content: '/destUrl$query',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    rp({
                        url: `http://127.0.0.1:${port}/rewrite2?a=1&b=2`,
                        followRedirect: false,
                        simple: false,
                        resolveWithFullResponse: true
                    }).then(data => {
                        data.statusCode.should.eq(301);
                        data.headers['location'].should.eq('/destUrl?a=1&b=2');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });

        it('should return 301 when redirect with regular express', done => {
            const route = new routeModel({
                type: 'regexp',
                uri: '\\/regRewrite\\/product\\/(\\d+)',
                process: 'rewrite',
                content: '/prod-$1$query',
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    rp({
                        url: `http://127.0.0.1:${port}/regRewrite/product/123?a=1&b=2`,
                        followRedirect: false,
                        simple: false,
                        resolveWithFullResponse: true
                    }).then(data => {
                        data.statusCode.should.eq(301);
                        data.headers['location'].should.eq('/prod-123?a=1&b=2');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        });
    });

    describe('process type: forward', () => {
        let serverId;
        let child;
        before(done => {
            const scriptPath = path.join(__dirname, './reverseServer.js');
            child = fork(scriptPath, {
                stdio: 'pipe'
            });
            child.stderr.on('data', err => console.error(err.toString()));
            child.stdout.on('data', data => {
                stdout += data;
                // console.log(data)
            });
    
            const server = new serverModel({
                name: 'server1',
                addresses: [{
                    weight: 1,
                    address: 'http://127.0.0.1:8901'
                }]
            });
            server.save((err, item) => {
                if (err) {
                    return done(err);
                }
                serverId = item.id;
                setTimeout(() => {
                    done();
                }, 3000);
                
            });
        });

        after(() => {
            child.kill();
        });

        it('should return 200 when forward request', done => {
            const route = new routeModel({
                type: 'start',
                uri: '/forward',
                process: 'forward',
                content: serverId,
                tryFile: 'N',
                sequence: 1
            });
            route.save(err => {
                if (err) {
                    return done(err);
                }

                // job receive config data each 1 second
                setTimeout(() => {
                    rp({
                        url: `http://127.0.0.1:${port}/forward/foo/bar`,
                        simple: false,
                        resolveWithFullResponse: true
                    }).then(data => {
                        data.statusCode.should.eq(200);
                        data.headers['content-type'].should.contains('text/html');
                        data.body.should.eq('<h3>reverse server</h3>');
                        done();
                    }).catch(err => {
                        done(err);
                    });
                }, 1000);
            })
        })
    });
});