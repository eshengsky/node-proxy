/**
 * static source server-side cache settings
 */
module.exports = {
    /**
     * enable server-side cache
     */
    enable: true,

    /**
     * all cache length
     * original is 50M
     */
    max: 1024 * 1024 * 50,

    /**
     * cache expires time (millisecond)
     */
    maxAge: 1000 * 60 * 5
};
