/*
 * @Author: Sky.Sun 
 * @Date: 2018-02-07 16:09:43 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-07-12 15:27:13
 */
const schedule = require('node-schedule');
const configPath = require('./getConfigPath')();
const config = require(configPath);
const job = config.job;
const routeModel = require('./models/routes').routeModel;
const serverModel = require('./models/servers').serverModel;
const permissionModel = require('./models/permissions').permissionModel;
const cacheModel = require('./models/caches').cacheModel;
const domainModel = require('./models/domains').domainModel;
const log4js = require('./lib/log4js');
const logger = log4js.getLogger('proxy-schedule');
const common = require('./utilities/common');
const settings = require('./settings');

/**
 * 从数据库获取最新数据，若有变更则更新内存中的数组
 */
const updateSettings = () => {
    Promise.all([
        routeModel.find({ deleted: false }, '-createTime -createUser -modifyTime -modifyUser').sort({ sequence: 1 }).exec(),
        serverModel.find({ deleted: false }, '-createTime -createUser -modifyTime -modifyUser').sort({ sequence: 1 }).exec(),
        permissionModel.find({ deleted: false }, '-createTime -createUser -modifyTime -modifyUser').sort({ sequence: 1 }).exec(),
        cacheModel.find({ deleted: false }, '-createTime -createUser -modifyTime -modifyUser').sort({ sequence: 1 }).exec(),
        domainModel.find({ deleted: false }, '-createTime -createUser -modifyTime -modifyUser').sort({ sequence: 1 }).exec()
    ]).then(values => {
        const routes = values[0];
        const servers = values[1];
        const permissions = values[2];
        const caches = values[3];
        const domains = values[4];
        if (Array.isArray(routes)) {
            if (routes.length > 0) {
                if (JSON.stringify(settings.getRoutes()) === JSON.stringify(routes)) {
                    // logger.info('获取到的routes无变化，不做更新操作！');
                } else {
                    settings.setRoutes(routes);
                    logger.info('成功获取并更新routes！');
                }
            }
        } else {
            logger.error('获取到的routes数据异常，不做更新操作！routes:', routes);
        }

        if (Array.isArray(servers)) {
            if (JSON.stringify(settings.getServers()) === JSON.stringify(servers)) {
                // logger.info('获取到的servers无变化，不做更新操作！');
            } else {
                settings.setServers(servers);
                logger.info('成功获取并更新servers！');
            }
        } else {
            logger.error('获取到的servers数据异常，不做更新操作！servers:', servers);
        }

        if (Array.isArray(permissions)) {
            if (permissions.length > 0) {
                // 给排除项加上 active/deleted 两项
                permissions.forEach(permission => {
                    if (permission.excludes.length > 0) {
                        permission.excludes.forEach(exc => {
                            exc.active = true;
                            exc.deleted = false;
                        });
                    }
                });
                if (JSON.stringify(settings.getPermissions()) === JSON.stringify(permissions)) {
                    // logger.info('获取到的permissions无变化，不做更新操作！');
                } else {
                    settings.setPermissions(permissions);
                    logger.info('成功获取并更新permissions！');
                }
            }
        } else {
            logger.error('获取到的permissions数据异常，不做更新操作！permissions:', permissions);
        }

        if (Array.isArray(caches)) {
            if (caches.length > 0) {
                if (JSON.stringify(settings.getCaches()) === JSON.stringify(caches)) {
                    // logger.info('获取到的caches无变化，不做更新操作！');
                } else {
                    settings.setCaches(caches);
                    logger.info('成功获取并更新caches！');
                }
            }
        } else {
            logger.error('获取到的caches数据异常，不做更新操作！caches:', caches);
        }

        if (Array.isArray(domains)) {
            if (domains.length > 0) {
                if (JSON.stringify(settings.getDomains()) === JSON.stringify(domains)) {
                    // logger.info('获取到的domains无变化，不做更新操作！');
                } else {
                    settings.setDomains(domains);
                    logger.info('成功获取并更新domains！');
                }
            }
        } else {
            logger.error('获取到的domains数据异常，不做更新操作！domains:', domains);
        }
    }).catch(err => {
        logger.error('获取routes/servers/permissions/caches/domains出错！', err);
    });
};
const startJob = () => {
    updateSettings();
    schedule.scheduleJob(job, () => {
        updateSettings();
    });
};

exports.startJob = startJob;
exports.updateSettings = updateSettings;
