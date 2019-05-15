/*
 * @Author: Sky.Sun 
 * @Date: 2018-01-29 20:32:19 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-01-29 20:34:07
 */

/**
 * serve_static 模块修改升级版本
 * 主要改动：增加内存缓存（仅针对 HTML 文件）
 */
const staticTransfer = require('./serve_static');
module.exports = staticTransfer;
