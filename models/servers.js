const mongoose = require('../db').mongoose;
const serverSchema = mongoose.Schema({
    // server name
    name: {
        type: String,
        required: true
    },

    // is fallback server
    fallback: {
        type: String,
        required: true
    },

    // server host list
    hosts: {
        type: String,
        required: true
    },

    // remarks info
    remarks: String,

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

exports.serverModel = mongoose.model('servers', serverSchema); 