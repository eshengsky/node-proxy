/*
 * @Author: Sky.Sun 
 * @Date: 2018-05-17 16:48:38 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-05-21 11:21:53
 */
const mongoose = require('../db').mongoose;
const domainSchemaObj = {
    // 域名
    domainPath: {
        type: String,
        required: true
    },

    // 备注信息
    remarks: String,

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
const domainSchema = mongoose.Schema(domainSchemaObj);

exports.domainSchemaObj = domainSchemaObj;
exports.domainModel = mongoose.model('domains', domainSchema);
