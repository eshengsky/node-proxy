const editableUsers = require('../config/auth.json').editableUsers;

/**
 * check current user has auth to edit
 * @param {object} req
 */
const canEdit = req => {
    const user = req.user;

    // '*': all users can editable
    if (editableUsers.includes('*')) {
        return true;
    }
    
    return editableUsers.includes(user);
};

module.exports.canEdit = canEdit;
module.exports.authMw = (req, res, next) => {
    if (canEdit(req)) {
        next();
        return;
    }
    res.status(403).send('You have no authority to do this!');
};
