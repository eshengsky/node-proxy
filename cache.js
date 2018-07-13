/*
 * @Author: Sky.Sun 
 * @Date: 2018-02-07 16:36:29 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-07-12 15:25:46
 */
const Redis = require('ioredis');
const configPath = require('./getConfigPath')();
const config = require(configPath);
const redisConnect = config.db.redisConnect;
const log4js = require('./lib/log4js');
const logger = log4js.getLogger('redis');

let redis;
if (Array.isArray(redisConnect)) {
    // 如果配成数组，则认为是集群模式
    redis = new Redis.Cluster(redisConnect, {
        enableOfflineQueue: false
    });
} else {
    redis = new Redis('redis://127.0.0.1:6379');
}

redis.on('connect', () => {
    logger.info('Redis connected!');
});

redis.on('error', err => {
    logger.error('Redis connect error:', err);
});

redis.on('end', () => {
    logger.error('Redis connection closed！');
});

module.exports.cacheClient = redis;
