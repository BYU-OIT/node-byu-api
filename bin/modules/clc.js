
module.exports = require('../../../command-line-callback/index');

/**
 * A command line handler that will not execute the passed in
 * success handler if an error occurs.
 * @param {function} successHandler
 * @returns {Function}
 */
module.exports.exitOnErrorHandler = function(successHandler) {
    return function(err, config) {
        if (err) return;
        successHandler(config);
    }
};