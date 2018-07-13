/*
 * @Author: Sky.Sun
 * @Date: 2018-06-20 16:02:57
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-07-11 10:20:30
 */
let routes = [];
let servers = [];
let caches = [];
let permissions = [];
let domains = [];
module.exports = {
    getRoutes: () => routes,

    setRoutes: data => {
        routes = data;
    },

    getServers: () => servers,

    setServers: data => {
        servers = data;
    },

    getCaches: () => caches,

    setCaches: data => {
        caches = data;
    },

    getPermissions: () => permissions,

    setPermissions: data => {
        permissions = data;
    },

    getDomains: () => domains,

    setDomains: data => {
        domains = data;
    }
};
