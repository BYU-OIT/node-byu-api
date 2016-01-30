"use strict";
var Configuration   = require('./configuration');
var Connector       = require('./connector');
var Promise         = require('bluebird');
var schemata        = require('object-schemata');

module.exports = Manager;

/**
 * Take a database configuration object and get back an object that will allow you to connect and test connections or
 * call the exit function.
 * @param {object} config
 * @returns {Promise}
 */
function Manager(config) {
    var promises = [];
    var store = {};

    Object.keys(config).forEach(function(key) {
        var value = config[key];
        var connector = Connector.get(value.connector);
        var schema = schemata(connector.options);
        var promise;

        promise = promiseWrap(() => connector.factory(value.config))
            .then(function(factory) {
                var item = {};

                // get a connection object through a promise
                item.connect = function() {
                    return promiseWrap(() => connector.connect.call(factory));
                };

                // execute the exit function
                item.exit = function() {
                    return promiseWrap(() => connector.exit.call(factory));
                };

                // test the connection
                item.test = function() {
                    var result = true;
                    return item.connect()
                        .then(function(conn) {
                            return conn.disconnect.call(factory, conn);
                        })
                        .catch(function(e) {
                            result = e;
                        })
                        .then(function() {
                            return result;
                        });
                };

                store[key] = item;
            });

        promises.push(promise);
    });

    return Promise.all(promises)
        .then(function() {
            var connect = {};
            var test = {};

            function exit() {
                var promises = [];
                Object.keys(store).forEach(function(key) {
                    promises.push(store[key].exit());
                });
            }

            Object.keys(store).forEach(function(key) {
                connect[key] = store[key].connect;
                test[key] = store[key].test;
            });

            return {
                connect: connect,
                exit: exit,
                test: test
            };
        });
}

Manager.load = function(config) {
    return Connector.load()
        .then(Configuration(config).load)
        .then(function(config) {
            return Manager(config);
        });
};

function promiseWrap(callback) {
    var result;
    try {
        result = callback();
        return !result || typeof result !== 'object' || typeof result.then !== 'function' ?
            Promise.resolve(result) :
            result;
    } catch (e) {
        return Promise.reject(e);
    }
}