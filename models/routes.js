/*
 * @Author: Sky.Sun 
 * @Date: 2018-02-07 11:42:27 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2019-05-15 14:17:39
 */
const mongoose = require('../db').mongoose;
const routeSchemaObj = {
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

    // 处理方式，static（处理静态文件）、rewrite（URL重写）、forward（转发）或custom（自定义响应）
    process: {
        type: String,
        required: true
    },

    /**
     * 处理内容
     * 如果处理方式是static，则这里表示文件路径
     * 如果处理方式是rewrite，则表示重定向后的地址
     * 如果处理方式是forward，则表示要转发到的服务器名
     * 如果处理方式是custom，则为空
     */
    content: {
        type: String
    },

    // 当处理方式是static，如果找不到文件，尝试从所配置的根路径下发送 index.html 文件，一般用于前端修改路由的单页应用
    tryFile: {
        type: String,
        required: true
    },

    // 当处理方式是forward，且content值为url时，此字段存储要转发到的地址
    forwardUrl: {
        type: String
    },

    // 自定义响应的状态码
    customStatus: {
        type: String
    },

    // 自定义响应的类型
    customContentType: {
        type: String
    },

    // 自定义响应的语言模式
    customMode: {
        type: String
    },

    // 自定义响应的响应体
    customBody: {
        type: String
    },

    // 备注信息
    remarks: String,

    // 是否启用（默认是）
    active: {
        type: Boolean,
        required: true,
        default: true
    },

    // 排序序号
    sequence: {
        type: Number,
        required: true
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
const routeSchema = mongoose.Schema(routeSchemaObj);

exports.routeSchemaObj = routeSchemaObj;
exports.routeModel = mongoose.model('routes', routeSchema);
