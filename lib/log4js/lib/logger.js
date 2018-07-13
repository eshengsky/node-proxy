"use strict";
var levels = require('./levels')
    , util = require('util')
    , events = require('events')
    , DEFAULT_CATEGORY = '[default]';

var logWritesEnabled = true;

/**
 * Models a logging event.
 * @constructor
 * @param {String} categoryName name of category
 * @param {Log4js.Level} level level of message
 * @param {Array} data objects to log
 * @param {Log4js.Logger} logger the associated logger
 * @author Seth Chisamore
 */
function LoggingEvent(categoryName, level, data, logger) {
    this.startTime = new Date();
    this.categoryName = categoryName;
    this.data = data;
    this.level = level;
    this.logger = logger;
}

/**
 * Logger to log messages.
 * use {@see Log4js#getLogger(String)} to get an instance.
 * @constructor
 * @param name name of category to log to
 * @author Stephan Strittmatter
 */
function Logger(name, level) {
    this.category = name || DEFAULT_CATEGORY;

    if (level) {
        this.setLevel(level);
    }
}
util.inherits(Logger, events.EventEmitter);
Logger.DEFAULT_CATEGORY = DEFAULT_CATEGORY;
Logger.prototype.level = levels.TRACE;

Logger.prototype.setLevel = function (level) {
    this.level = levels.toLevel(level, this.level || levels.TRACE);
};

Logger.prototype.removeLevel = function () {
    delete this.level;
};

Logger.prototype.log = function () {
    var logLevel = levels.toLevel(arguments[0], levels.INFO);
    if (!this.isLevelEnabled(logLevel)) {
        return;
    }
    var numArgs = arguments.length - 1;
    var args = new Array(numArgs);
    for (var i = 0; i < numArgs; i++) {
        args[i] = arguments[i + 1];
    }
    this._log(logLevel, args);
};

Logger.prototype.isLevelEnabled = function (otherLevel) {
    return this.level.isLessThanOrEqualTo(otherLevel);
};

['Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal', 'Mark'].forEach(addLevelMethods);
const debugMode = require('../../../debugMode');
function addLevelMethods(level) {
    level = levels.toLevel(level);

    var levelStrLower = level.toString().toLowerCase();
    var levelMethod = levelStrLower.replace(/_([a-z])/g, function (g) {
        return g[1].toUpperCase();
    });
    var isLevelMethod = levelMethod[0].toUpperCase() + levelMethod.slice(1);

    Logger.prototype['is' + isLevelMethod + 'Enabled'] = function () {
        return this.isLevelEnabled(level);
    };

    Logger.prototype[levelMethod] = function () {
        if (logWritesEnabled && this.isLevelEnabled(level)) {
            // var numArgs = arguments.length;
            // var args = new Array(numArgs);
            // for (var i = 0; i < numArgs; i++) {
            //   args[i] = arguments[i];
            // }
            var args = Array.prototype.slice.call(arguments);
            // 如果传入的参数多于 1 个，且最后一个参数是一个 IncomingMessage 对象
            var lastParam,
                currentHeader,
                updateHeader,
                msgArr,
                msgToSet;
            if (args.length > 1) {
                lastParam = args[args.length - 1];
                if (lastParam && lastParam.constructor && lastParam.constructor.name === 'IncomingMessage') {
                    // 弹出末尾的 req 对象
                    args.pop();
                    // 日志头部添加请求 id
                    if (lastParam.__id) {
                        args.unshift('{' + lastParam.__id + '}');
                    }
                    // 只有开启了回传日志且请求头包含request-server-log（即安装了ServerLog浏览器插件），或者启用了调试模式，才设置响应头
                    if ((lastParam.headers && lastParam.headers['request-server-log'] === 'enabled') || (lastParam.query && lastParam.query[debugMode.debugParam] === 'true')) {
                        try {
                            // 响应头设置
                            currentHeader = lastParam.res.get('X-Server-Log');
                            msgArr = [{
                                time: require('./date_format').asString(new Date()),
                                type: level.levelStr,
                                category: this.category,
                                message: args
                            }];
                            if (currentHeader) {
                                updateHeader = JSON.parse(decodeURIComponent(currentHeader));
                                updateHeader.push(msgArr[0]);
                                msgToSet = encodeURIComponent(JSON.stringify(updateHeader));
                            } else {
                                msgToSet = encodeURIComponent(JSON.stringify(msgArr));
                            }
                            // 各测试环境响应头长度有限制，如果大于30k就仅返回一行提示
                            if (msgToSet.length > 30000) {
                                lastParam.res.set('X-Server-Log', encodeURIComponent(JSON.stringify([{
                                    time: require('./date_format').asString(new Date()),
                                    type: 'ERROR',
                                    category: 'Server Log',
                                    message: ['日志太多，不支持直接展示，请登录服务器查看！']
                                }])));
                            } else {
                                lastParam.res.set('X-Server-Log', msgToSet);
                            }
                        } catch (e) {

                        }
                    }
                }
            }

            this._log(level, args);
        }
    };
}

Logger.prototype._log = function (level, data) {
    var loggingEvent = new LoggingEvent(this.category, level, data, this);
    this.emit('log', loggingEvent);
};

/**
 * Disable all log writes.
 * @returns {void}
 */
function disableAllLogWrites() {
    logWritesEnabled = false;
}

/**
 * Enable log writes.
 * @returns {void}
 */
function enableAllLogWrites() {
    logWritesEnabled = true;
}

exports.LoggingEvent = LoggingEvent;
exports.Logger = Logger;
exports.disableAllLogWrites = disableAllLogWrites;
exports.enableAllLogWrites = enableAllLogWrites;
exports.addLevelMethods = addLevelMethods;
