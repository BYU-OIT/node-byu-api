"use strict";
var CustomError         = require('custom-error-instance');
var defer               = require('../util/defer');
var exit                = require('../util/exit');
var is                  = require('../util/is');
var Promise             = require('bluebird');
var promiseWrap         = require('../util/promise-wrap');
var schemata            = require('object-schemata');
var timeoutQueue        = require('../util/timeout-queue');

var Err = CustomError('ConnectionPoolError');
Err.limit = CustomError(Err, { code: 'ELIMIT', message: 'Database connection pool exhausted.' });
Err.terminated = CustomError(Err, { code: 'ETERM', message: 'The database connection pool has been terminated.' });
Err.timeout = CustomError(Err, { code: 'ETIME', message: 'Get database connection timed out.' });
Err.revoked = CustomError(Err, { code: 'ERVOK', message: 'Connection unavailable' });

module.exports = Pool;

function Pool(connect, configuration) {
    var available;
    var growing = 0;
    var poolConfig = Pool.schema.normalize(configuration || {});
    var pending;
    var terminate;
    var unavailable = [];

    //manage available connections and idle timeout
    available = timeoutQueue(poolConfig.poolTimeout * 1000, function(conn) {
        // if the pool can shrink then shrink it, otherwise add the connection back to available list
        if (available.length + unavailable.length >= poolConfig.poolMin) {
            conn.manager.disconnect();
        } else {
            available.add(conn);
        }
    });

    //manage pending requests and request timeout
    pending = timeoutQueue(poolConfig.connectTimeout * 1000, function(deferred) {
        return deferred.reject(new Err.timeout());
    });

    /**
     * Get the number of connections that are either immediately available or can be made
     * available by growing the connection pool.
     * @readonly
     * @type {number}
     */
    getter('available', () => poolConfig.poolMax - unavailable.length);

    /**
     * Get the number of connections that are immediately available.
     * @readonly
     * @type {number}
     */
    getter('immediate', () => available.length);

    /**
     * Get the current pool size.
     * @readonly
     * @type {number}
     */
    getter('poolSize', () => available.length + growing + unavailable.length);

    exit.listen(function() {
        terminate = [];
        return new Promise(function(resolve, reject) {
            var conn;

            function settle() {
                return Promise.settle(terminate)
                    .then(function(results) {
                        var errors = results.filter((r) => r.isRejected());
                        if (errors.length > 0) {
                            reject(new Err('One or more connections could not disconnect:\n\t' + e.join('\n\t')));
                        } else {
                            resolve();
                        }
                    });
            }

            // inform all pending of failure to connect
            while (pending.length > 0) pending.get().reject(Err.terminated);

            // terminate available connections first
            while (conn = available.get()) terminate.push(conn.manager.disconnect());

            //set a timeout that will do hard disconnects
            if (unavailable.length > 0) {
                setTimeout(function () {
                    var conn;
                    while (conn = unavailable.shift()) terminate.push(conn.manager.disconnect());
                    settle();
                }, poolConfig.terminateGrace * 1000);
            } else {
                settle();
            }
        });
    });




    function getter(name, callback) {
        Object.defineProperty(poolConnect, name, {
            enumerable: true,
            get: callback
        });
    }

    function lease() {
        var conn = available.get();
        var disconnect;

        // add connection to unavailable
        unavailable.push(conn);

        // store the old disconnect and overwrite it
        disconnect = conn.manager.disconnect;
        conn.manager.disconnect = function() {
            if (!terminate) {
                conn.manager.disconnect = disconnect;
                available.add(conn);
                if (pending.length > 0) pending.get().resolve(lease());
            } else {
                disconnect();
            }
        };

        return conn;
    }

    function poolConnect(connConfig) {
        var diff;
        var i;
        var poolSize = poolConnect.poolSize;
        var deferred;
        var size;

        // if terminated then reject the promise
        if (terminate) return Promise.reject(new Err.terminated());

        // if an idle connection is available then return it
        if (available.length > 0) return Promise.resolve(lease());

        // if this request will overflow the max pool size then throw an error
        if (poolSize - growing + pending.length >= poolConfig.poolMax) return Promise.reject(new Err.limit());

        // if a connection is about to be available then add callback to pending
        deferred = defer();
        pending.add(deferred);

        // if there are more items pending then connections being made (growing the pool) then grow some more
        if (pending.length > growing) {

            //determine the new pool size
            size = poolSize + poolConfig.poolIncrement;
            if (size > poolConfig.poolMax) size = poolConfig.poolMax;

            //add to the growth difference
            diff = size - poolSize;
            growing += diff;

            //add connections
            for (i = 0; i < diff; i++) {
                promiseWrap(() => connect(connConfig))
                    .then(function(conn) {
                        growing--;

                        if (terminate) {
                            terminate.push(conn.manager.disconnect());

                        } else {
                            available.add(conn);
                            if (pending.length > 0) pending.get().resolve(lease());
                        }
                    })
                    .catch(function(err) {
                        if (pending.length > 0) pending.get().reject(err);
                    });
            }

        }

        return deferred.promise;
    }


    return poolConnect;
}

Pool.schema = schemata({
    connectTimeout: {                               // The number of seconds a connection request should wait before being rejected
        type: 'input',
        message: 'Connect timeout:',
        help: 'This value must be a non-negative number.',
        defaultValue: 30,
        transform: parseInt,
        validate: is.nonNegativeNumber
    },
    poolIncrement: {
        type: 'input',
        message: 'Pool increment:',
        help: 'This value must be a positive number.',
        defaultValue: 1,
        transform: round,
        validate: function(v) {
            return is.positiveNumber(round(v));
        }
    },
    poolMax: {
        type: 'input',
        message: 'Maximum pool size:',
        help: 'This value must be a non-negative number.',
        defaultValue: 4,
        transform: round,
        validate: is.nonNegativeNumber
    },
    poolMin: {
        type: 'input',
        message: 'Minimum pool size:',
        help: 'This value must be a non-negative number.',
        defaultValue: 0,
        transform: round,
        validate: is.nonNegativeNumber
    },
    poolTimeout: {
        type: 'input',
        message: 'Pool timeout (in seconds):',      // The number of seconds before an idle connection will be closed
        defaultValue: 60,
        transform: parseInt,
        validate: is.nonNegativeNumber
    },
    terminateGrace: {    // The number of seconds a soft terminate will wait before forcibly closing connections
        type: 'input',
        message: 'Terminate disconnect timeout (in seconds):',
        defaultValue: 60,
        transform: parseInt,
        validate: is.nonNegativeNumber
    }
});

Object.defineProperty(Pool, 'error', {
    enumerable: false,
    configurable: true,
    value: Err,
    writable: false
});

function round(value) {
    return Math.round(parseFloat(value));
}