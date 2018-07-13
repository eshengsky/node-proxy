/*
 * @Author: Sky.Sun
 * @Date: 2018-02-07 10:45:41
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-07-12 15:26:06
 */
const mongoose = require('mongoose');
const configPath = require('./getConfigPath')();
const config = require(configPath);
const dbPath = config.db.mongodb;
const log4js = require('./lib/log4js');
const logger = log4js.getLogger('noginx');

// mongoose.set('bufferCommands', false);
mongoose.connect(dbPath, {
    keepAlive: 120,
    useNewUrlParser: true
}).then(() => {
    logger.info(`MongoDB connected：${dbPath}`);
}).catch(err => {
    logger.error('MongoDB connect error:', err);
});

exports.mongoose = mongoose;
