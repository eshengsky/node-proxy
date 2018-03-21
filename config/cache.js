/*
 * @Author: Sky.Sun 
 * @Date: 2018-01-29 20:31:20 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-02-05 11:29:33
 */

/**
 * 静态资源缓存设置
 */
module.exports = {
    /**
     * 是否开启服务端缓存
     */
    enable: true,

    /**
     * 所有缓存值的总长度限制
     * 这里设置为50M
     */
    max: 1024 * 1024 * 50,

    /**
     * 缓存过期时间，单位毫秒
     */
    maxAge: 1000 * 60 * 5
};
