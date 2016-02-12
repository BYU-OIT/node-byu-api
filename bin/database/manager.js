"use strict";
var Configuration   = require('./configuration');
var Connector       = require('./connector');
var CustomError     = require('custom-error-instance');
var defineGetter    = require('../util/define-getter');
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
 * @returns {{ connections: function, query: function }}
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
            .map(names, (name) => connect(name, id))
            .then(function(connections) {
                var map = names
                    .reduce(function(map, key, index) {
                        map[key] = Object.assign({}, connections[index].client);
                        return map;
                    }, {});

                return {
                    done: () => connections.forEach((conn) => conn.manager.disconnect()),
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
        return connect(name, '')
            .then(function(c) {
                conn = c;
                return conn.manager.query(args);
            })
            .then(function(result) {
                return result;
            })
            .finally(function() {
                if (conn) conn.manager.disconnect();
            });
    };

    function connect(name, id) {
        if (!store.hasOwnProperty(name)) throw Err.input('Connection name not defined: ' + name);
        return store[name].then((fn) => fn(id));
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
 * @param {boolean} [poolConfig] Set to true to have the connection use pooling.
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
            return function(id) {
                return promiseWrap(() => connect(id, normalizedConfig))
                    .then(function (conn) {
                        var disconnect;
                        var query;

                        // validate that the connection is formatted appropriately
                        if (!conn.hasOwnProperty('client') || !conn.client || typeof conn.client !== 'object') throw Err.connector('Missing client object.');
                        if (!conn.hasOwnProperty('manager') || !conn.manager || typeof conn.manager !== 'object') throw Err.connector('Missing manager object.');
                        if (!conn.manager.hasOwnProperty('disconnect') || typeof conn.manager.disconnect !== 'function') throw Err.connector('Manager disconnect property must be a function.');
                        if (!conn.manager.hasOwnProperty('query') || typeof conn.manager.query !== 'function') throw Err.connector('Manager query property must be a function.');

                        // wrap disconnect in a promise
                        disconnect = conn.manager.disconnect;
                        conn.manager.disconnect = function() {
                            var args = arguments;
                            return promiseWrap(() => disconnect.apply(disconnect, args));
                        };

                        // wrap query in a promise
                        query = conn.manager.query;
                        conn.manager.query = function() {
                            var args = arguments;
                            return promiseWrap(() => query.apply(query, args));
                        };

                        return conn;
                    });
            }
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