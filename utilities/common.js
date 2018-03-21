/*
 * @Author: Sky.Sun 
 * @Date: 2018-02-27 12:03:39 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-03-02 10:06:12
 */
module.exports = {
    /**
     * 判断对象中是否存在指定属性（或属性路径）
     * 
     * @param {object} object  - 对象
     * @param {string} path - 属性值，可以是路径，如：'a.b.c[0].d'
     * @returns {boolean} 判断结果
     * @example 
     * const obj = {a: {b: {c: [{d: 123}]}}};
     * console.log(hasPath(obj, 'a.b.c[0].d'));
     */
    hasPath(object, path) {
        if (typeof object !== 'object' || typeof path !== 'string') {
            return false;
        }
        path = path.split(/[\.\[\]]/).filter(n => n != '');
        let index = -1;
        const len = path.length;
        let key;
        let result = true;
        while (++index < len) {
            key = path[index];
            if (!Object.prototype.hasOwnProperty.call(object, key)) {
                result = false;
                break;
            }
            object = object[key];
        }
        return result;
    },

    /**
     * 获取对象的指定属性的值（或属性路径）
     * 
     * @param {object} object - 对象
     * @param {string} path - 属性值，可以是路径，如：'a.b.c[0].d'
     * @param {any} [defaultVal=''] - 获取不到值时返回的默认值，可不传
     * @returns {any} 指定属性的值
     * @example 
     * const obj = {a: {b: {c: [{d: 123}]}}};
     * console.log(getPathValue(obj, 'a.b.c[0].d'));
     */
    getPathValue(object, path, defaultVal = '') {
        let ret = defaultVal;
        if (object === null || typeof object !== 'object' || typeof path !== 'string') {
            return ret;
        }
        path = path.split(/[\.\[\]]/).filter(n => n != '');
        let index = -1;
        const len = path.length;
        let key;
        let result = true;
        while (++index < len) {
            key = path[index];
            if (!Object.prototype.hasOwnProperty.call(object, key)) {
                result = false;
                break;
            }
            object = object[key];
        }
        if (result) {
            ret = object;
        }
        return ret;
    },
    
    /**
     * 获取完整的请求链接
     * @param {object} req - 请求
     * @returns 
     */
    getFullUrl(req) {
        return `${req.protocol}://${req.get('Host')}${req.originalUrl}`;
    },
    
    /**
     * 将utf8字符串编码为base64字符串
     * @param str - 待编码字符串
     * @returns {String}
     */
    encodeBase64(str) {
        return new Buffer(str, 'utf8').toString('base64');
    },

    /**
     * 将base64字符串解码为utf8字符串
     * @param str - 待解码字符串
     * @returns {String}
     */
    decodeBase64(str) {
        return new Buffer(str, 'base64').toString('utf8');
    }
}