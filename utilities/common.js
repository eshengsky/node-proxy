module.exports = {
    /**
     * get full request url
     * @param {object} req
     * @returns 
     */
    getFullUrl(req) {
        return `${req.protocol}://${req.get('Host')}${req.originalUrl}`;
    },
    
    /**
     * encode to base64
     * @param str
     * @returns {String}
     */
    encodeBase64(str) {
        return new Buffer(str, 'utf8').toString('base64');
    },

    /**
     * decode from base64
     * @param str
     * @returns {String}
     */
    decodeBase64(str) {
        return new Buffer(str, 'base64').toString('utf8');
    }
}