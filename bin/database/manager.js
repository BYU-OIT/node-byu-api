"use strict";
var Configuration   = require('./configuration');
var Connector       = require('./connector');
var CustomError     = require('custom-error-instance');
var Promise         = require('bluebird');
var promiseWrap     = require('../util/promise-wrap');
var Pool            = require('./pool');

var Err = CustomError('DbManagerError');
Err.connector = CustomError(Err, { code: 'EMCN' });
Err.input = CustomError(Err, { code: 'EMINPT' });

module.exports = Manager;

/**
 *
 * @param configuration
 * @constructor
 */
function Manager(configuration) {
    var factory = {};
    var store = {};

    /**
     * Make a request for persistent connections. Once they are all available the promise will
     * resolve with the connections.
     * @param {string[]} names
     */
    factory.connections = function(names) {
        if (!Array.isArray(names)) throw Err.input('Expected an array of strings.');
        return Promise
            .map(names, function(name) {
                return connect(name);
            })
            .then(function(connections) {
                var map = {};
                names.forEach(function(name, i) {
                    map[name] = Object.assign({}, connections[i].client);
                });
                return {
                    done: () => connections.forEach((conn) => conn.manager.disconnect()),
                    connections: map
                };
            });
    };

    /**
     * Get a connection, make a query, disconnect, and return the query response.
     * @param name
     */
    factory.query = function(name, args) {
        var conn;
        return connect(name)
            .then(function(c) {
                conn = c;
                return conn.manager.query(conn.client, args);
            })
            .then(function(result) {
                return result;
            })
            .finally(function() {
                if (conn) conn.manager.disconnect();
            });
    };

    /**
     * Test if a connection works.
     * @param {string} name The name of the connection.
     * @returns {Promise} that resolves to true or to an Error if the test failed.
     */
    factory.test = function(name) {
        var result = true;
        return connect(name)
            .then(function(conn) {
                return conn.manager.disconnect();
            })
            .catch(function(e) {
                result = e;
            })
            .then(function() {
                return result;
            });
    };

    function connect(name) {
        if (!store.hasOwnProperty(name)) throw Err.input('Connection name not defined: ' + name);
        return store[name]();
    }

    // build the map of connector functions to connection names
    Object.keys(configuration).forEach(function(key) {
        var config = configuration[key];
        var connector = Connector.get(config.connector);
        var connect = connector.pool ? Pool(connector.connect, config.pool) : connector.connect;
        store[key] = function () {
            return promiseWrap(() => connect(config.config))
                .then(function (conn) {

                    // validate that the connection is formatted appropriately
                    if (!conn.hasOwnProperty('client') || !conn.client || typeof conn.client !== 'object') throw Err.connector('Missing client object.');
                    if (!conn.hasOwnProperty('manager') || !conn.manager || typeof conn.manager !== 'object') throw Err.connector('Missing manager object.');
                    if (!conn.manager.hasOwnProperty('disconnect') || typeof conn.manager.disconnect !== 'function') throw Err.connector('Manager disconnect property must be a function.');
                    if (!conn.manager.hasOwnProperty('disconnect') || typeof conn.manager.disconnect !== 'function') throw Err.connector('Manager query property must be a function.');

                    return conn;
                });
        };
    });


    return factory;
}

Manager.load = function(config) {
    if (!config.dbFile) return Promise.resolve(Manager({}));
    return Connector.load()
        .then(Configuration(config).load)
        .then(function(dbConfig) {
            return Manager(dbConfig.get());
        });
};