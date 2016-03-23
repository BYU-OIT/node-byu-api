"use strict";
var Configuration   = require('./configuration');
var Connector       = require('./connector');
var CustomError     = require('custom-error-instance');
var defineGetter    = require('../util/define-getter');
var defer           = require('../util/defer');
var Promise         = require('bluebird');
var promiseWrap     = require('../util/promise-wrap');
var Pool            = require('./pool');

var Err = CustomError('DbManagerError');
Err.connector = CustomError(Err, { code: 'EMCNR' });
Err.connect = CustomError(Err, { code: 'EMCNT' });
Err.input = CustomError(Err, { code: 'EMINPT' });

module.exports = Manager;

/**
 *
 * @param {object} configuration A database configuration map or a database configuration object.
 * @returns {Manager}
 */
function Manager(configuration) {
    var dbConfig;
    var factory = Object.create(Manager.prototype);
    var store = {};

    // if the input parameter is not a map but instead is a database configuration factory then separate the two
    if (configuration instanceof Configuration) {
        dbConfig = configuration;
        configuration = dbConfig.get();
    }

    // loosely validate configuration parameter
    if (!configuration || typeof configuration !== 'object') throw Err.input('Cannot create manager with invalid configuration. Expected a connection configuration object map.');

    /**
     * Make a request for persistent connections. Once they are all available the promise will
     * resolve with the connections.
     * @param {string} id The request ID
     * @param {string[]} names An array of connections to get.
     * @returns {Promise} that resolves to an object with a done() function and the connections map.
     */
    factory.connections = function(id, names) {
        if (typeof id !== 'string') return Promise.reject(Err.input('Expected the id to be a string.'));
        if (!Array.isArray(names)) return Promise.reject(Err.input('Expected the name to be an array of strings.'));

        // make sure that there are no duplicate names
        names = names
            .reduce(function(p, c) {
                if (p.indexOf(c) === -1) p.push(c);
                return p;
            }, []);

        // build the connection map
        return Promise
            .map(names, (name) => connect(name))
            .then(function(connections) {
                var map = {};

                names.forEach(function(name, index) {
                    var conn = connections[index];

                    // set up a race between the persistent connection and a new connection to see who
                    // is ready to fulfill the query first
                    var query = function() {
                        var activePromise = conn.manager.activePromise();
                        var args = arguments;
                        var deferred = defer();
                        var newConnectionPromise = connect(name);

                        activePromise.then(function() {
                            if (!newConnectionPromise.isPending()) {
                                conn.manager.query.apply(null, args)
                                    .then(deferred.resolve, deferred.reject);
                            }
                        });

                        newConnectionPromise.then(function(conn) {
                            if (!activePromise.isPending()) {
                                conn.manager.query.apply(null, args)
                                    .then(deferred.resolve, deferred.reject);
                            }
                            conn.manager.disconnect();
                        });

                        return deferred.promise;
                    };

                    map[name] = Object.assign(query, conn.client);

                });

                return {
                    done: function(success) {
                        var promises = [];
                        connections.forEach(function(conn) {
                            var promise = conn.manager.done(success)
                                .then(() => conn.manager.disconnect());
                            promises.push(promise);
                        });
                        return Promise.all(promises);
                    },
                    connections: map
                };
            });
    };

    /**
     * Get the database configuration factory that was passed in with the manager. This parameter
     * is optional so this may return undefined.
     * @type {object, undefined}
     */
    factory.dbConfig = defineGetter(factory, 'dbConfig', () => dbConfig);

    /**
     * Get a connection, make a query, disconnect, and return the query response.
     * @param {string} name The connection name to use.
     * @param {*[]} args An array like object with arguments to pass to the query.
     */
    factory.query = function(name, args) {
        var conn;
        return connect(name)
            .then(function(c) {
                conn = c;
                return conn.manager.query(c, args);
            })
            .then(function(result) {
                return result;
            })
            .finally(function() {
                if (conn) conn.manager.disconnect();
            });
    };

    function connect(name) {
        if (!store.hasOwnProperty(name)) throw Err.input('Connection name not defined: ' + name);
        return store[name].then((fn) => fn());
    }

    // build the map of connector functions to connection names
    Object.keys(configuration).forEach(function(key) {
        var config = configuration[key];
        store[key] = Manager.connect(config.connector, config.config, config.pool);
    });

    return factory;
}

/**
 * Get a function that will get a connection when called.
 * @param {string} connector The name of the connector to use.
 * @param {object} config The connector configuration to use to connect to the database.
 * @param {object} [poolConfig] The pool configuration to use.
 * @returns {Promise} that resolves to a function
 */
Manager.connect = function(connector, config, poolConfig) {
    var normalizedConfig;
    return Connector.load()
        .then(function() {
            var c = Connector.get(connector);
            normalizedConfig = c.schema.normalize(config);
            Object.freeze(normalizedConfig);
            return c.connect
        })
        .then((connect) => poolConfig ? Pool(connect, poolConfig || {}, config) : connect)
        .then(function(connect) {
            return function() {
                return promiseWrap(() => connect(normalizedConfig))
                    .then(connectionTransform);
            };
        });
};

Manager.load = function(config) {
    if (!config.dbFile) return Promise.resolve(Manager({}));
    return Connector.load()
        .then(Configuration(config).load)
        .then((dbConfig) => Manager(dbConfig));
};

/**
 * Test a connection configuration against against a connector.
 * @param {string} connector The connector's name.
 * @param {object} config The connection configuration to test.
 * @returns {Promise} that resolves to true or an Error object.
 */
Manager.test = function(connector, config) {
    return Manager.connect(connector, config)
        .then((fn) => fn())
        .then((conn) => conn.manager.disconnect())
        .then(() => true)
        .catch((e) => e);
};

/**
 * Take the connection object (from a connected database connection) and transform it for use within the framework
 * @param conn
 * @returns {*}
 */
function connectionTransform(conn) {
    var disconnect;
    var done;
    var lastPromise;
    var query;

    console.log('hello\nhello\nhello\nhello\nhello\nhello\n');

    // validate that the connection is formatted appropriately
    if (!conn.hasOwnProperty('client') || !conn.client || typeof conn.client !== 'object') throw Err.connector('Missing client object.');
    if (!conn.hasOwnProperty('manager') || !conn.manager || typeof conn.manager !== 'object') throw Err.connector('Missing manager object.');
    if (!conn.manager.hasOwnProperty('disconnect') || typeof conn.manager.disconnect !== 'function') throw Err.connector('Manager disconnect property must be a function.');
    if (!conn.manager.hasOwnProperty('preRequest') || typeof conn.manager.preRequest !== 'function') throw Err.connector('Manager preRequest property must be a function.');
    if (!conn.manager.hasOwnProperty('postRequest') || typeof conn.manager.postRequest !== 'function') throw Err.connector('Manager postRequest property must be a function.');
    if (!conn.manager.hasOwnProperty('query') || typeof conn.manager.query !== 'function') throw Err.connector('Manager query property must be a function.');

    // wrap client functions in a promise
    Object.keys(conn.client).forEach(function(key) {
        var fn = conn.client[key];
        if (typeof value === 'function') {
            conn.client[key] = function() {
                var args = arguments;
                lastPromise = promiseWrap(() => fn.apply(fn, args));
                return lastPromise;
            }
        }
    });

    // get the current available promise
    conn.manager.activePromise = function() {
        return lastPromise;
    };

    // wrap disconnect in a promise
    disconnect = conn.manager.disconnect;
    conn.manager.disconnect = function() {
        var args = arguments;
        return promiseWrap(() => disconnect.apply(disconnect, args));
    };

    // wrap done in a promise
    done = conn.manager.done;
    conn.manager.done = function(success) {
        return promiseWrap(() => done.call(done, success));
    };

    // wrap query in a promise
    query = conn.manager.query;
    conn.manager.query = function() {
        var args = arguments;
        return promiseWrap(() => query.apply(query, args));
    };

    // add a start function
    conn.manager.reset = function() {
        lastPromise = null;
    };

    return conn;
}