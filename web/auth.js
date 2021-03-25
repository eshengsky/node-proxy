/*
 * @Author: Sky.Sun 
 * @Date: 2018-02-13 09:46:39 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2021-03-24 15:30:36
 */
const configPath = require('../getConfigPath')();
const config = require(configPath);
const editableUsers = config.auth.editableUsers;

/**
 * 检查当前用户是否有编辑权限
 * @param {object} req - 请求对象
 */
const canEdit = req => {
    // 如果配置项包含了*，则所有用户可编辑
    if (editableUsers.includes('*')) {
        return true;
    }

    const user = req.user;
    return editableUsers.includes(user.username);
};

module.exports.canEdit = canEdit;
module.exports.authMw = (req, res, next) => {
    if (canEdit(req)) {
        next();
        return;
    }
    res.status(403).send('你没有权限进行此操作！');
};
