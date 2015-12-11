var Promise             = require('bluebird');

module.exports = promiseOption;

function promiseOption(scope, callback) {
    return function() {
        var args = Array.prototype.slice.call(arguments, 0);

        //if using callback paradigm
        if (typeof args[args.length - 1] === 'function') {
            return callback.apply(scope, args);

            //using the promise paradigm
        } else {
            return new Promise(function(resolve, reject) {
                args.push(function(err, data) {
                    if (err) return reject(err);
                    return resolve(data);
                });
                return callback.apply(scope, args);
            });
        }
    }
}