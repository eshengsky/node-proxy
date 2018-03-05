const mongoose = require('mongoose');
const dbPath = require('./config/db.json').mongodb;
const log4js = require('log4js');
const logger = log4js.getLogger('proxy');

// mongoose.set('bufferCommands', false);
mongoose.connect(dbPath, { keepAlive: 120 }).then(() => {
    logger.info(`MongoDB connect successfully: ${dbPath}`);
}).catch(err => {
    logger.error('MongoDB connect error!', err);
});;

exports.mongoose = mongoose;
