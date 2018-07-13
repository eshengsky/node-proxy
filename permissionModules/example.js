/*
 * @Author: Sky.Sun 
 * @Date: 2018-07-12 18:08:22 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-07-13 10:20:11
 */

/**
 * 验证demo
 * 假定：当客户端Cookie中存在session_id，就认为用户已登录，允许访问，否则重定向到登录页（百度）
 * 约定：该模块必须返回一个函数，该函数会接收 req, res, next 3个参数，并返回一个promise，验证通过resolve，验证失败reject。
 * 
 * @param {object} req - request
 * @param {object} res - response
 * @param {*} next - next
 */
const common = require('../utilities/common');
module.exports = (req, res, next) => {
    return new Promise((resolve, reject) => {
        const sessionid = req.cookies['session_id'];
        if (sessionid) {
            // 用户已登录，按照约定返回 resolve
            return resolve();
        }
        // 未登录，进行重定向，并按照约定返回 reject
        const callbackUrl = common.encodeBase64(common.getFullUrl(req));
        res.redirect(302, `https://www.baidu.com?callback=${callbackUrl}`);
        return reject();
    });
};
