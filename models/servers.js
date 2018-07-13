const mongoose = require('../db').mongoose;
const serverSchemaObj = {
    // 服务器名称
    name: {
        type: String,
        required: true
    },

    // 服务器地址
    addresses: {
        type: Array,
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
const serverSchema = mongoose.Schema(serverSchemaObj);

exports.serverSchemaObj = serverSchemaObj;
exports.serverModel = mongoose.model('servers', serverSchema); 