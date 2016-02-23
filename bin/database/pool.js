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
Err.terminated = CustomError(Err, { code: 'ETERM', message: 'The database connection pool has been terminated.' });
Err.timeout = CustomError(Err, { code: 'ETIME', message: 'Get database connection timed out.' });
Err.revoked = CustomError(Err, { code: 'ERVOK', message: 'Connection unavailable' });

module.exports = Pool;

/**
 * Set up a connect function to use pooling.
 * @param {function} connect The original connect function.
 * @param {object} configuration The pool configuration.
 * @param {object} [connConfig] The connection configuration to use for all connections.
 * @returns {{ available: number, immediate: number, poolSize: number, terminate: function }, function, poolConnect}
 * @constructor
 */
function Pool(connect, configuration, connConfig) {
    var available;
    var growing = 0;
    var poolConfig = Pool.schema.normalize(configuration || {});
    var pending;
    var terminate;
    var terminatePromise;
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

    /**
     * Terminate the connection pool.
     * @param {boolean} [hard=false] Set to true to terminate in use connections immediately.
     * @returns {Promise}
     */
    poolConnect.terminate = function(hard) {
        if (!terminatePromise) {
            terminate = [];
            terminatePromise = new Promise(function (resolve, reject) {
                var conn;

                function settle() {
                    var promises = terminate.filter(promiseLike);
                    return Promise.settle(promises)
                        .then(function (results) {
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

                // if hard is set to true then hard terminate in use connections
                if (hard) while (conn = unavailable.shift()) terminate.push(conn.manager.disconnect());

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
        }
        return terminatePromise;
    };

    // if the process begins to exit then close all open database connections
    exit.listen(poolConnect.terminate);

    // initialize to the pool min size
    grow(poolConfig.poolMin);




    function getter(name, callback) {
        Object.defineProperty(poolConnect, name, {
            enumerable: true,
            get: callback,
            set: function() {}
        });
    }

    function grow(quantity) {
        var i;
        var promise;
        var promises = [];

        //add to the growth difference
        growing += quantity;

        //add connections
        for (i = 0; i < quantity; i++) {
            promise = promiseWrap(() => connect(connConfig))
                .then(function(conn) {
                    growing--;

                    if (terminate) {
                        terminate.push(conn.manager.disconnect());

                    } else {
                        if (pending.length === 0) {
                            available.add(conn);
                        } else {
                            pending.get().resolve(lease(conn));
                        }
                    }
                })
                .catch(function(err) {
                    if (pending.length > 0) pending.get().reject(err);
                });
            promises.push(promise);
        }

        return Promise.settle(promises);
    }

    function lease(conn) {
        var disconnect;

        // if a connection wasn't supplied then get the next available connection
        if (!conn) conn = available.get();

        // add connection to unavailable
        unavailable.push(conn);

        // store the old disconnect and overwrite it
        disconnect = conn.manager.disconnect;
        conn.manager.disconnect = function() {
            var index;
            if (!terminate) {
                conn.manager.reset();
                conn.manager.disconnect = disconnect;
                index = unavailable.indexOf(conn);
                unavailable.splice(index, 1);
                available.add(conn);
                if (pending.length > 0) pending.get().resolve(lease());
            } else {
                disconnect();
            }
        };

        return conn;
    }

    /**
     * Get a connection from the pool.
     * @returns {Promise}
     */
    function poolConnect() {
        var diff;
        var i;
        var poolSize = poolConnect.poolSize;
        var poolLimitReached;
        var deferred;
        var size;

        // if terminated then reject the promise
        if (terminate) return Promise.reject(new Err.terminated());

        // if an idle connection is available then return it
        if (available.length > 0) return Promise.resolve(lease());

        // if a connection is about to be available then add callback to pending
        deferred = defer();
        pending.add(deferred);

        // determine if the max pool size has been reached
        poolLimitReached = poolSize - growing + pending.length > poolConfig.poolMax;

        // if there are more items pending then connections being made (growing the pool) then grow some more
        if (!poolLimitReached && pending.length > growing) {

            // determine the new pool size
            size = poolSize + poolConfig.poolIncrement;
            if (size > poolConfig.poolMax) size = poolConfig.poolMax;

            // determine the difference
            diff = size - poolSize;

            // grow the pool
            grow(diff);
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
        transform: function(value) {
            return Math.round(parseFloat(value) * 1000) / 1000;
        },
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

function promiseLike(value) {
    return value && typeof value.then === 'function';
}

function round(value) {
    return Math.round(parseFloat(value));
}