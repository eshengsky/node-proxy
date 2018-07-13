/*
 * @Author: Sky.Sun 
 * @Date: 2018-07-09 16:29:18 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2018-07-12 15:53:37
 */

/**
 * Returns the corresponding config file 
 * based on the incoming config parameter or the NODE_ENV environment variable
 */
const fs = require('fs');
const path = require('path');
let modulePath;
module.exports = () => {
    if (modulePath) {
        return modulePath;
    }
    let configName = process.env.config || process.env.NODE_ENV || 'development';
    if (path.extname(configName) !== '.js') {
        configName = `${configName}.js`;
    }
    const configPath = path.join(__dirname, './config', configName);
    console.info(`Required config file: ${configPath}`);
    try {
        const stats = fs.statSync(configPath);
        if (stats.isFile()) {
            modulePath = configPath;
            return modulePath;
        }
        console.error(`Config file: ${configPath} is not a file!`);
        process.exit(1);
    } catch (err) {
        console.error(`Get config file: ${configPath} error!`, err);
        process.exit(1);
    }
}
