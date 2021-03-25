/*
 * @Author: Sky.Sun 
 * @Date: 2018-07-09 16:23:41 
 * @Last Modified by: Sky.Sun
 * @Last Modified time: 2021-03-24 16:43:45
 */

/**
 * 测试用配置
 */
const path = require('path');
module.exports = {
    /**
     * SSL 设置
     */
    ssl: {
        /**
         * 是否开启 HTTPS
         */
        enable: false,

        /**
         * 私钥文件路径
         */
        key: '/ssl/website.key',

        /**
         * 证书文件路径
         */
        cert: '/ssl/website.crt'
    },
    
    /**
     * 反向代理的超时时长，单位毫秒
     */
    proxyTimeout: 60000,

    /**
     * 反向代理keep-alive时长，单位毫秒
     */
    keepAlive: 5000,

    /**
     * 调度规则，测试环境设置为每秒触发
     * 格式：https://github.com/node-schedule/node-schedule#cron-style-scheduling
     */
    job: '*/1 * * * * *',

    /**
     * 文件选择器中的静态文件根目录
     */
    staticDirPath:  path.join(process.cwd(), './test/staticTest'),

    /**
     * 调试模式的参数名
     */
    debugParam: 'h5debug',

    /**
     * 请求方式
     */
    methods: ['Get', 'Post', 'Put', 'Delete', 'Options'],

    /**
     * 页面的身份验证
     * 这是一个数组，元素类型为对象，对象属性包含：file: 文件名，在permissions目录下创建文件；title: 验证规则名称，显示在新增或修改身份验证的模态框
     */
    permissions: [{
        title: '示例验证',
        file: 'example.js'
    }],

    /**
     * node-proxy系统的访问权限
     */
    auth: {
        /**
         * 用户名密码方式的用户列表
         * 密码必须经过md5加密
         */
         local: [{
            username: 'admin',
            password: 'e10adc3949ba59abbe56e057f20f883e'
        }],

        /**
         * Gitlab - OAuth2方式登录
         */
        gitlab: {
            enable: true,
            baseURL: 'http://10.0.13.97:58888/',
            clientID: '1cd7928d7262b102ac042dbc929d6cb5e10e5e8f4260d94fb772f888f695a789',
            clientSecret: '2008b8cb5e5c3a04a3db8d74d9a1c25fa23a98453961fa2d630e17a8785f35f1',
            callbackURL: 'http://localhost:9000/node-proxy/auth/gitlab/callback',
        },

        /**
         * 拥有编辑权限的用户，如：['user1', 'user2']，配置为 ['*'] 则所有用户都有编辑权限
         */
        editableUsers: ['*']
    },

    /**
     * 静态资源服务端缓存设置
     */
    serverFileCache: {
        /**
         * 是否开启服务端缓存
         */
        enable: false,

        /**
         * 所有缓存值的总大小限制
         */
        max: 1024 * 1024 * 50,

        /**
         * 缓存过期时间，单位毫秒
         */
        maxAge: 1000 * 60 * 5
    },

    /**
     * 数据库配置
     */
    db: {
        /**
         * MongoDB 连接字符串，支持集群
         */
        mongodb: 'mongodb://127.0.0.1:27017/node-proxytest',

        /**
         * Redis 键前缀
         */
        redisKeyPrefix: 'Node-Proxytest:',

        /**
         * Redis 连接信息，如果配置为一个数组则视为集群
         */
        redisConnect: 'redis://127.0.0.1:6379'
    },

    /**
     * 日志配置
     */
    serverlog: {
        console: {
            colors: true,
            depth: null,
            appendUrl: true,
            forceSingleLine: false
        },
        extension: {
            enable: true,
            key: 'node-proxy_secret_key'
        }
    }
};
