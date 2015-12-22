"use strict";
// This tool provides basic connection pool management that can be used by connectors.

var clc                 = require('../cli/clc');
var customError         = require('./custom-error');
var promiseOption       = require('./promise-option');
var timeoutQueue        = require('./timeout-queue');

var PoolErr = customError('ConnectionPool', {
    limit: 'limit',
    terminated: 'term',
    timeout: 'timeout'
});

module.exports = pool;

function pool(connect, disconnect, connConfiguration, poolConfiguration) {
    var available;
    var factory = {};
    var growing = 0;
    var poolConfig = clc.options.camelCase(clc.options.normalize(pool.options, poolConfiguration, true));
    var pending;
    var terminate;
    var unavailable = [];

    //manage available connections and idle timeout
    available = timeoutQueue(poolConfig.poolTimeout ? poolConfig.poolTimeout * 1000 : -1, function(conn) {
        disconnect(conn, noop);
    });

    //manage pending requests and request timeout
    pending = timeoutQueue(poolConfig.connectTimeout * 1000, function(callback) {
        callback(new PoolErr.timeout('Get database connection timed out.'), null);
    });

    /**
     * Get a database connection through a promise or a callback paradigm.
     * @param {function} [callback] A callback to call (instead of returning a promise) when the connection is made.
     */
    factory.connect = promiseOption(factory, function(callback) {
        var conn;
        var diff;
        var i;
        var poolSize = factory.poolSize;
        var size;

        //if terminated then throw an error
        if (terminate) {
            callback(new PoolErr.terminated('The database connection pool has been terminated.'), null);

            //if a connection is available then return it
        } else if (available.length > 0) {
            conn = available.get();
            unavailable.push(conn);
            callback(null, conn);

            //if this request will overflow the pool then throw an error
        } else if (poolSize - growing + pending.length >= poolConfig.poolMax) {
            callback(new PoolErr.limit('Database connection pool exhausted.'), null);

            //if a connection is about to be available then add callback to pending
        } else {
            pending.add(callback);

            if (pending.length > growing) {

                //determine the new pool size
                size = poolSize + poolConfig.poolIncrement;
                if (size > poolConfig.poolMax) size = poolConfig.poolMax;

                //add to the growth difference
                diff = size - poolSize;
                growing += diff;

                //add connections
                for (i = 0; i < diff; i++) {
                    connect(connConfiguration, function (err, conn) {
                        growing--;
                        if (terminate) {
                            disconnect(conn, terminate);

                        } else if (pending.length > 0) {
                            if (!err) unavailable.push(conn);
                            pending.get()(err, conn);

                        } else if (!err) {
                            available.add(conn);
                        }
                    });
                }
            }
        }
    });

    /**
     * Release a connection back into the connection pool.
     * @param {object} conn
     */
    factory.disconnect = promiseOption(factory, function(conn, callback) {
        var index = unavailable.indexOf(conn);
        if (index !== -1) unavailable.splice(index, 1);
        if (!terminate) {
            available.add(conn);
            callback(null);
        } else {
            disconnect(conn, function(err) {
                callback(err);
                terminate(err);
            });
        }
    });

    /**
     * Get multiple connections at once.
     * @params {number} count The number of connections to get.
     * @params {function} [callback] A callback function to return results to. If omitted then a
     * promise is returned.
     * @returns {undefined|Promise}
     */
    factory.multiConnect = promiseOption(factory, function(count, callback) {
        var i;
        var results = [];
        for (i = 0; i < count; i++) {
            factory.connect(function(err, conn) {
                if (err) return callback(err, null);
                results.push(conn);
                if (results.length === count) callback(null, results);
            });
        }
    });

    /**
     * Terminate the connection pool so that it will no longer hand out connections.
     * Also close connections as they are released. Use hard to close connections in use.
     * @param {boolean} [hard=false] Use true to immediately close connections in use.
     * @params {function} [callback] A callback function to return results to. If omitted then a
     * promise is returned.
     * @returns {undefined|Promise}
     */
    factory.terminate = promiseOption(factory, function(hard, callback) {
        var conn;
        var errors = [];
        var count = factory.poolSize + 1;
        var graceTimeoutId;

        if (arguments.length === 1 && typeof arguments[0] === 'function') {
            callback = arguments[0];
            hard = false;
        }

        //set a timeout that will do hard disconnects
        if (!hard) {
            graceTimeoutId = setTimeout(function () {
                while (conn = unavailable.shift()) disconnect(conn, terminate);
            }, poolConfig.terminateGrace * 1000);
        }

        terminate = function(err) {
            count--;
            if (err) errors.push(err.message);
            if (count === 0 && typeof callback === 'function') {
                clearTimeout(graceTimeoutId);
                callback(errors.length > 0 ?
                    new PoolErr.terminated('Some connections could not close: \n\t' + errors.join('\n\t')) :
                    null
                );
            }
        };

        while (conn = available.get()) disconnect(conn, terminate);
        if (hard) {
            while (conn = unavailable.shift()) disconnect(conn, terminate);
        }
        terminate();
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

    function getter(name, callback) {
        Object.defineProperty(factory, name, {
            enumerable: true,
            get: callback
        });
    }

    return factory;
}

pool.options = {
    'connect-timeout': {
        type: Number,
        question_type: 'input',
        message: 'Connect timeout:',
        description: 'The number of seconds to wait for a connection before resulting in a timeout error.',
        defaultValue: 30,
        validate: function(v) { return v > 0; }
    },
    'pool-increment': {
        type: Number,
        question_type: 'input',
        message: 'Pool increment:',
        description: 'The number of connections to increment when the pool is exhausted.',
        defaultValue: 1,
        transform: function(v) { return Math.round(v); },
        validate: function(v) { return Math.round(v) > 0; }
    },
    'pool-max': {
        type: Number,
        question_type: 'input',
        message: 'Maximum pool size:',
        description: 'The maximum number of connections to which a connection pool can grow.',
        defaultValue: 4,
        transform: function(v) { return Math.round(v); }
    },
    'pool-min': {
        type: Number,
        question_type: 'input',
        message: 'Minimum pool size:',
        description: 'The minimum number of connections a connection pool maintains.',
        defaultValue: 0,
        transform: function(v) { return Math.round(v); }
    },
    'pool-timeout': {
        type: Number,
        question_type: 'input',
        message: 'Pool timeout (in seconds):',
        description: 'The number of seconds after which idle connections (unused in the pool) are terminated. ' +
        'Set to 0 to never terminate idle connections.',
        defaultValue: 60,
        validate: function(v) { return Math.round(v) >= 0; }
    },
    'terminate-grace': {
        type: Number,
        question_type: 'input',
        message: 'Terminate disconnect timeout (in seconds):',
        description: 'The number of seconds a soft terminate will wait before forcibly closing connections.',
        defaultValue: 60,
        validate: function(v) { return Math.round(v) >= 0; }
    }
};

function noop() {};