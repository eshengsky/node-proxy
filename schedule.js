/*
 * @Author: Sky.Sun 
 * @Date: 2018-02-07 16:09:43 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-03-15 15:44:30
 */
const schedule = require('node-schedule');
const job = require('./config/job');
const routeModel = require('./models/routes').routeModel;
const serverModel = require('./models/servers').serverModel;
const log4js = require('log4js');
const logger = log4js.getLogger('proxy-schedule');
const getDataFromMongo = (routeList, serverList) => {
    Promise.all([
        routeModel.find({ deleted: false }).sort({sequence: 1}).exec(),
        serverModel.find({ deleted: false }).exec()
    ]).then(values => {
        const routes = values[0];
        const servers = values[1];
        
        if (Array.isArray(routes)) {
            if (JSON.stringify(routeList) === JSON.stringify(routes)) {
                logger.info('获取到的routes无变化，不做更新操作！');
            } else {
                routeList.length = 0;
                routeList.push(...routes);
                logger.info('成功获取并更新routes！');
            }
        } else {
            logger.warn('获取到的routes数据异常，不做更新操作！', routes);
        }

        if (Array.isArray(servers)) {
            // 将server的hosts转换为数组
            servers.forEach(server => server.hostArray = server.hosts.split(','));
            if (JSON.stringify(serverList) === JSON.stringify(servers)) {
                logger.info('获取到的servers无变化，不做更新操作！');
            } else {
                serverList.length = 0;
                serverList.push(...servers);
                logger.info('成功获取并更新servers！');
            }
        } else {
            logger.warn('获取到的servers数据异常，不做更新操作！', servers);
        }
    }).catch(err => {
        logger.error('获取routes/servers出错！', err);
    });
};
const getLatest = (routeList, serverList) => {
    getDataFromMongo(routeList, serverList);
    schedule.scheduleJob(job, () => {
        getDataFromMongo(routeList, serverList);
    });
};

exports.getLatest = getLatest;
