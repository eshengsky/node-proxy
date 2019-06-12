/*
 * @Author: Sky.Sun 
 * @Date: 2018-03-01 11:31:49 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2019-05-15 14:18:00
 */
const mongoose = require('../db').mongoose;
const permissionSchemaObj = {
    // 验证方式
    auth: {
        type: String,
        required: true
    },

    // uri类型，start - 匹配开头，exact - 精确匹配，regexp - 正则匹配
    type: {
        type: String,
        required: true
    },

    // 请求方式
    method: {
        type: String
    },

    // 要匹配的路由
    uri: {
        type: String,
        required: true
    },

    // 要匹配的请求参数
    params: {
        type: String
    },

    // 要匹配的域名ID
    domainId: {
        type: String
    },

    // 排除的路径
    excludes: [],

    // 是否启用（默认是）
    active: {
        type: Boolean,
        required: true,
        default: true
    },

    // 是否已被软删除（默认否）
    deleted: {
        type: Boolean,
        required: true,
        default: false
    },

    // 创建时间（默认当前时间）
    createTime: {
        type: Date,
        default: Date.now
    },

    // 创建人
    createUser: String,

    // 修改时间（默认当前时间）
    modifyTime: {
        type: Date,
        default: Date.now
    },

    // 修改人
    modifyUser: String
};
const permissionSchema = mongoose.Schema(permissionSchemaObj);

exports.permissionSchemaObj = permissionSchemaObj
exports.permissionModel = mongoose.model('permissions', permissionSchema);
