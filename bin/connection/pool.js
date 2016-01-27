"use strict";
var Connector           = require('./connector');
var CustomError         = require('custom-error-instance');
var is                  = require('../util/is');
var Promise             = require('bluebird');
var schemata            = require('object-schemata');
var timeoutQueue        = require('../util/timeout-queue');

var Err = CustomError('ConnPoolError');
Err.limit = CustomError(Err, { code: 'ELIMIT', message: 'Database connection pool exhausted.' });
Err.terminated = CustomError(Err, { code: 'ETERM', message: 'The database connection pool has been terminated.' });
Err.timeout = CustomError(Err, { code: 'ETIME', message: 'Get database connection timed out.' });
Err.revoked = CustomError(Err, { code: 'ERVOK', message: 'Connection unavailable' });

module.exports = Pool;

function Pool(connectorName, connectorConfiguration, poolConfiguration) {
    var available;
    var connector = Connector.get(connectorName);
    var factory = {};
    var growing = 0;
    var poolConfig = Pool.options.normalize(poolConfiguration);
    var pending;
    var terminate;
    var unavailable = [];

    //manage available connections and idle timeout
    available = timeoutQueue(poolConfig.poolTimeout * 1000, function(conn) {
        // if the pool can strink then shrink it, otherwise add the connection back to available list
        if (available.length + unavailable.length >= poolConfig.poolMin) {
            conn[connector.disconnect]();
        } else {
            available.add(conn);
        }
    });

    //manage pending requests and request timeout
    pending = timeoutQueue(poolConfig.connectTimeout * 1000, function(deferred) {
        return deferred.reject(new Err.timeout());
    });

    /**
     * Get a database connection.
     * @returns {Promise}
     */
    factory.connect = function() {
        var conn;
        var diff;
        var i;
        var poolSize = factory.poolSize;
        var deferred;
        var size;

        // if terminated then reject the promise
        if (terminate) return Promise.reject(new Err.terminated());

        // if an idle connection is available then return it
        if (available.length > 0) {
            conn = available.get();
            unavailable.push(conn);
            return Promise.resolve(conn);
        }

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
                connector.connect(connectorConfiguration)
                    .then(function(conn) {
                        growing--;

                        if (terminate) {
                            conn[connector.disconnect]();       // TODO: track when terminate ready

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
    };

    /**
     * Terminate the connection pool, closing all connects and removing the ability to add any more.
     * @param {boolean} [hard=false] Set to true to force connections to disconnect immediately.
     */
    factory.terminate = function(hard) {
        var conn;
        var disconnect = connector.disconnect;
        var graceTimeoutId;
        var errors = [];

        function settle() {
            var promises = terminate
                .map(function(promise) {
                    return promise.reflect();
                })
                .each(function(inspection) {
                    if (inspection.isRejected()) errors.push(inspection.reason());
                });

            return Promise.all(promises);
        }

        // initialize terminate
        terminate = [];

        // inform all pending of failure to connect
        while (pending.length > 0) pending.get().reject(Err.terminated);

        // terminate available connections first
        while (conn = available.get()) {
            terminate.push(conn[disconnect]());
        }

        // if doing hard disconnects then disconnect them now
        if (hard) {
            while (conn = unavailable.shift()) terminate.push(conn[disconnect]());
            return settle();
        }

        //set a timeout that will do hard disconnects
        graceTimeoutId = setTimeout(function () {
            while (conn = unavailable.shift()) terminate.push(conn[connector.disconnect]());

        }, poolConfig.terminateGrace * 1000);
        return settle();
    };

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




    function getter(name, callback) {
        Object.defineProperty(factory, name, {
            enumerable: true,
            get: callback
        });
    }

    function lease() {
        var conn = available.get();
        var deferred = defer();
        var result = {};
        var revoked = false;

        function revoke() {
            var index;
            if (!revoked) {
                revoked = true;
                index = unavailable.indexOf(deferred.promise);
                unavailable.splice(index, 1);
                deferred.resolve(conn);
            }
        }

        // add promise to unavailable
        unavailable.push(deferred.promise);

        // create a copy of the object
        Object.keys(conn).forEach(function(key) {
            var value = conn[key];
            var config = Object.getOwnPropertyDescriptor(conn, key);
            Object.defineProperty(result, key, {
                enumerable: config.enumerable,
                configurable: true,
                get: function() {
                    if (revoked) throw new Err.revoked();
                    return config.hasOwnProperty('value') ? value : conn[key];
                },
                set: function(v) {
                    if (revoked) throw new Err.revoked();
                    if (!config.hasOwnProperty('value')) throw new Err('Cannot set property value');
                    value = v;
                }
            });
        });

        Object.defineProperty(result, connector.disconnect, {
            enumerable: true,
            configurable: true,
            value: function() {
                if (revoked) throw new Err.revoked();
                revoke();
                return Promise.resolve();
            },
            writable: false
        });

        deferred.promise.then(function(conn) {
            if (!terminate) {
                available.add(conn);
                if (pending.length > 0) pending.get().resolve(lease());
            }
        });

        Object.freeze(result);
        return result;
    }

    // build connections up to the min pool size
    (function() {
        var i;
        for (i = 0; i < poolConfig.poolMin; i++) {
            factory.connect().then(function(conn) {
                conn[connector.disconnect]();
            });
        }
    })();

    return factory;
}

Pool.options = schemata({
    connectTimeout: {
        type: 'input',
        message: 'Connect timeout:',
        help: 'This value must be a non-negative number.',
        defaultValue: 30,
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
        validate: is.nonNegativeNumber
    },
    terminateGrace: {    // The number of seconds a soft terminate will wait before forcibly closing connections
        type: 'input',
        message: 'Terminate disconnect timeout (in seconds):',
        defaultValue: 60,
        validate: is.nonNegativeNumber
    }
});

Object.defineProperty(Pool, 'error', {
    enumerable: false,
    configurable: true,
    value: Err,
    writable: false
});


/**
 * Get a deferred object.
 * @returns {object}
 */
function defer() {
    var resolve
    var reject;
    var promise = new Promise(function() {
        resolve = arguments[0];
        reject = arguments[1];
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
}

function noop() {}

function round(value) {
    return Math.round(value);
}