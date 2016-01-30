"use strict";
var Connector           = require('../bin/database/connector');
var is                  = require('../bin/util/is');

exports.clear = function () {
    Connector.list().forEach(function(name) {
        Connector.remove(name);
    });
};

/**
 * Generate a connector configuration object.
 * @param {string} name The name of the connector.
 * @param {boolean} [promises=false] Set to true to use promises in all aspects of the connector's definition. (For testing.)
 */
exports.configuration = function(name, promises) {
    var config = {};

    config.connect = function() {
        return this.connect();
    };

    config.disconnect = function(conn) {
        return conn.disconnect();
    };

    config.factory = function(config) {
        var factory = {};

        factory.connect = function() {
            var factory = {};
            var err;

            factory.connect = function() {
                var conn = {
                    disconnect: function() {
                        return promises ? Promise.resolve() : void 0;
                    }
                };
                return promises ? Promise.resolve(conn) : conn;
            };

            if (factory.password !== 'pass') {
                err = new Error('Incorrect password');
                if (promises) {
                    return Promise.reject(err);
                } else {
                    throw err;
                }
            }

            if (!promises) {
                return factory;
            } else {
                return Promise.resolve(factory);
            }
        };

        return factory;
    };

    config.name = name;

    config.options = {
        user: {
            type: 'input',
            message: 'User:',
            help: 'This value must be a string.',
            validate: is.string,
            required: true
        },
        password: {
            type: 'input',
            message: 'Password:',
            help: 'This value must be a string.',
            validate: is.string,
            defaultValue: 'pass'
        }
    };

    return config;
};

/**
 * Create a connector.
 * @param {string} name The name of the connector.
 * @param {boolean} [promises=false] Set to true to use promises in all aspects of the connector's definition. (For testing.)
 * @param {object} [configuration] An object with properties to overwrite those specified by default by this factory.
 */
exports.define = function(name, promises, configuration) {
    var config = exports.configuration(name, promises);

    if (configuration && is.object(configuration)) {
        Object.keys(config).forEach(function (key) {
            if (configuration.hasOwnProperty(key)) config[key] = configuration[key];
        });
    }

    return Connector.define(config);
};