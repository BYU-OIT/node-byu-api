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

    config.connect = function(config) {
        var connected = true;
        var result = {
            client: {
                run: function() {
                    if (!connected) throw Error('Not connected');
                    return promises ? Promise.resolve('Ran') : 'Ran';
                }
            },
            manager: {
                disconnect: function() {
                    connected = false;
                    if (promises) return Promise.resolve();
                },
                query: function() {
                    return promises ? Promise.resolve('Ran query') : 'Ran query';
                }
            }
        };
        return promises ? Promise.resolve(result) : result;
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