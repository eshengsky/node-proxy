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
        
        if (Array.isArray(routes) && routes.length > 0) {
            if (JSON.stringify(routeList) === JSON.stringify(routes)) {
                logger.info('The obtained routes does not change, do not do the update!');
            } else {
                routeList.length = 0;
                routeList.push(...routes);
                logger.info('Get and update routes successfully!');
            }
        } else {
            logger.warn('The obtained routes may not be correct, do not do the update!', routes);
        }

        if (Array.isArray(servers) && servers.length > 0) {
            servers.forEach(server => server.hostArray = server.hosts.split(','));
            if (JSON.stringify(serverList) === JSON.stringify(servers)) {
                logger.info('The obtained servers does not change, do not do the update!');
            } else {
                serverList.length = 0;
                serverList.push(...servers);
                logger.info('Get and update servers successfully!');
            }
        } else {
            logger.warn('The obtained servers may not be correct, do not do the update!', servers);
        }
    }).catch(err => {
        logger.error('Error when getting routes/servers!', err);
    });
};
const getLatest = (routeList, serverList) => {
    getDataFromMongo(routeList, serverList);
    schedule.scheduleJob(job, () => {
        getDataFromMongo(routeList, serverList);
    });
};

exports.getLatest = getLatest;
