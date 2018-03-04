const mongoose = require('../db').mongoose;
const routeSchema = mongoose.Schema({
    // uri type, start(match start), exact(match exact uri), regexp(regexp expression match)
    type: {
        type: String,
        required: true
    },

    // to matched uri
    uri: {
        type: String,
        required: true
    },

    // process method, static(static file), rewrite(URL rewrite), forward(forward to another server)
    process: {
        type: String,
        required: true
    },

    /**
     * process content
     * directory path if process is static
     * redirect uri if process is rewrite
     * server name if process is forward
     */
    content: {
        type: String,
        required: true
    },

    /**
     * When process is static, if can't find files, try sending index.html files from the configured root path, which is generally used for single page application
     */
    tryFile: {
        type: String,
        required: true
    },

    // remarks info
    remarks: String,

    // is active
    active: {
        type: Boolean,
        required: true,
        default: true
    },

    // sequence
    sequence: {
        type: Number,
        required: true
    },

    // is soft deleted
    deleted: {
        type: Boolean,
        required: true,
        default: false
    },

    // create time
    createTime: {
        type: Date,
        default: Date.now
    },

    // create user(username + ip)
    createUser: String,

    // modify time
    modifyTime: {
        type: Date,
        default: Date.now
    },

    // modify user(username + ip)
    modifyUser: String
});

exports.routeModel = mongoose.model('routes', routeSchema);
