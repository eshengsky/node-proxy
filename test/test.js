const { expect, should } = require('chai');
const { exec } = require('child_process');
const rp = require('request-promise-native');
const routeModel = require('../models/routes').routeModel;
const port = 8900;
should();

describe('noginx test', function () {
    this.timeout(5000);
    let stdout = '';

    before(done => {
        let child = exec(`set NODE_ENV=development&&set config=test&&set PORT=${port}&&node server.js`);
        child.stderr.on('data', err => console.error(err.toString()));
        child.stdout.on('data', data => {
            stdout += data;
            // console.log(data)
        });

        // set timeout to wait for db/redis ready
        setTimeout(() => {
            Promise.all([
                routeModel.remove({}).exec()
            ]).then(() => {
                done();
            }).catch(err => {
                done(err);
            });
        }, 3000);
    });

    it('should startup server successfully', () => {
        stdout.should.contains(`Noginx listening on port ${port}`);
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

    it('should handle properly when match type is start', done => {
        const route = new routeModel({
            type: 'start',
            uri: '/startUri',
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
                        url: `http://127.0.0.1:${port}/startUri`,
                        simple: false,
                        resolveWithFullResponse: true
                    }),
                    rp({
                        url: `http://127.0.0.1:${port}/starturi`,
                        simple: false,
                        resolveWithFullResponse: true
                    }),
                    rp({
                        url: `http://127.0.0.1:${port}/startUri/`,
                        simple: false,
                        resolveWithFullResponse: true
                    }),
                    rp({
                        url: `http://127.0.0.1:${port}/startUri/test`,
                        simple: false,
                        resolveWithFullResponse: true
                    }),
                    rp({
                        url: `http://127.0.0.1:${port}/startUritest`,
                        simple: false,
                        resolveWithFullResponse: true
                    })
                ]).then(results => {
                    results[0].statusCode.should.eq(200);
                    results[0].body.should.eq('<h3>hello noginx</h3>');
                    results[1].statusCode.should.eq(404);
                    results[1].body.should.eq('Not Found');
                    results[2].statusCode.should.eq(200);
                    results[2].body.should.eq('<h3>hello noginx</h3>');
                    results[3].statusCode.should.eq(200);
                    results[3].body.should.eq('<h3>hello noginx</h3>');
                    results[4].statusCode.should.eq(404);
                    results[4].body.should.eq('Not Found');
                    done();
                }).catch(err => {
                    done(err);
                });
            }, 1000);
        }, () => {
            done(new Error('save routes failed'));
        })
    });

    it('should handle properly when match type is exact', done => {
        const route = new routeModel({
            type: 'exact',
            uri: '/exactUri',
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
                        url: `http://127.0.0.1:${port}/exactUri`,
                        simple: false,
                        resolveWithFullResponse: true
                    }),
                    rp({
                        url: `http://127.0.0.1:${port}/exacturi`,
                        simple: false,
                        resolveWithFullResponse: true
                    }),
                    rp({
                        url: `http://127.0.0.1:${port}/exactUri/`,
                        simple: false,
                        resolveWithFullResponse: true
                    }),
                    rp({
                        url: `http://127.0.0.1:${port}/exactUri/test`,
                        simple: false,
                        resolveWithFullResponse: true
                    }),
                    rp({
                        url: `http://127.0.0.1:${port}/exactUritest`,
                        simple: false,
                        resolveWithFullResponse: true
                    })
                ]).then(results => {
                    results[0].statusCode.should.eq(200);
                    results[0].body.should.eq('<h3>hello noginx</h3>');
                    results[1].statusCode.should.eq(404);
                    results[1].body.should.eq('Not Found');
                    results[2].statusCode.should.eq(200);
                    results[2].body.should.eq('<h3>hello noginx</h3>');
                    results[3].statusCode.should.eq(404);
                    results[3].body.should.eq('Not Found');
                    results[4].statusCode.should.eq(404);
                    results[4].body.should.eq('Not Found');
                    done();
                }).catch(err => {
                    done(err);
                });
            }, 1000);
        }, () => {
            done(new Error('save routes failed'));
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
                    results[0].body.should.eq('<h3>hello noginx</h3>');
                    results[1].statusCode.should.eq(200);
                    results[1].body.should.eq('<h3>hello noginx</h3>');
                    results[2].statusCode.should.eq(404);
                    results[2].body.should.eq('Not Found');
                    done();
                }).catch(err => {
                    done(err);
                });
            }, 1000);
        }, () => {
            done(new Error('save routes failed'));
        })
    });

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
                    results[0].body.should.eq('<h3>hello noginx</h3>');
                    results[1].statusCode.should.eq(200);
                    results[1].body.should.eq('<h3>hello noginx</h3>');
                    done();
                }).catch(err => {
                    done(err);
                });
            }, 1000);
        }, () => {
            done(new Error('save routes failed'));
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
                    results[0].body.should.eq('Not Found');
                    results[1].statusCode.should.eq(200);
                    results[1].body.should.eq('<h3>hello noginx</h3>');
                    done();
                }).catch(err => {
                    done(err);
                });
            }, 1000);
        }, () => {
            done(new Error('save routes failed'));
        })
    });
});