/*
 * @Author: Sky.Sun 
 * @Date: 2018-02-07 10:45:41 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-03-21 14:45:32
 */
const mongoose = require('mongoose');
let dbPath = require('./config/db.json').mongodb;
const log4js = require('log4js');
const logger = log4js.getLogger('proxy');

// 启动服务器时传入 --debug，则自动启用本地MongoDB，以方便调试
if (process.argv[2] === '--debug') {
    dbPath = 'mongodb://127.0.0.1:27017/nodeProxy';
}

// mongoose.set('bufferCommands', false);
mongoose.connect(dbPath, { keepAlive: 120 }).then(() => {
    logger.info(`MongoDB已成功连接：${dbPath}`);
}).catch(err => {
    logger.error('MongoDB连接失败！', err);
});

exports.mongoose = mongoose;
