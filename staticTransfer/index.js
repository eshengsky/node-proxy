/**
 * modified from serve_static
 * Major changes: support server-side cache(just for html file), support try_file(like nginx try_files)
 */
const staticTransfer = require('./serve_static');
module.exports = staticTransfer;
