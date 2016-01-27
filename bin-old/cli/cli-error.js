var customError = require('../modules/custom-error');

module.exports = customError('CLIError', {
    connector: 'conn'
});

module.exports.catch = function(e) {
    console.error('Error: ' + e.message);
};