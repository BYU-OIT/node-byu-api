"use strict";
var Connector           = require('./connector');
var CustomError         = require('custom-error-instance');
var Pool                = require('./pool');

var Err = CustomError('ConnConfigError');
Err.init = CustomError(Err, { code: 'EINIT' }, function() {
    this.message = 'Invalid configuration provided: ' + this.message;
});
Err.set = CustomError(Err, { code: 'ESET' });

module.exports = function() {
    var factory = {};
    var store = {};

    /**
     * Get the entire configuration object or a single connection configuration.
     * @param {string} [name] The name of the configuration to get.
     * @returns {object, undefined}
     */
    factory.get = function(name) {
        if (arguments.length === 0) return copy(store);
        return store.hasOwnProperty(name) ? copy(store[name]) : void 0;
    };

    /**
     * Initialize the configuration
     * @param configuration
     */
    factory.init = function(configuration) {
        if (!configuration || typeof configuration !== 'object') throw Err.init('Initialization configuration must be an object.');
        store = copy(configuration);
        Object.keys(store).forEach(function(name) {
            var config = store[name];
            var connector;
            var error;

            if (!config.hasOwnProperty('connector')) throw Err.init('Missing required property "connector" for connection: ' + name);
            if (!config.connector || typeof config.connector !== 'object') throw Err.init('Property "connector" must be an object for connection: ' + name);
            if (!config.connector.name || typeof config.connector.name !== 'string') throw Err.init('Property "connector.name" must be a string for connection: ' + name);

            connector = Connector.get(config.connector.name);
            config.connector.config = connector.schema.normalize(config.connector.config);

            if (!config.hasOwnProperty('pool')) throw Err.init('Missing required property "pool" for connection: ' + name);
            config.pool = Pool.options.normalize(config.pool);
        });
    };

    /**
     * Get a list of names for defined configurations.
     * @returns {string[]}
     */
    factory.list = function() {
        return Object.keys(store);
    };

    /**
     * Delete a defined configuration from the store.
     * @param {string} name
     */
    factory.remove = function(name) {
        delete store[name];
    };

    /**
     * Set a configuration.
     * @param {string} name The name of the configuration.
     * @param {string} connectorName The name of the connector.
     * @param {object} connectorConfig A valid connector configuration for the connector specified.
     * @param {object} poolConfig A valid pool configuration.
     * @returns {object}
     */
    factory.set = function(name, connectorName, connectorConfig, poolConfig) {
        var connector;

        if (!name || typeof name !== 'string') throw Err.set('Configuration name must be a string.');
        if (!connectorName || typeof connectorName !== 'string') throw Err.set('Configuration connectorName must be a string.');

        connector = Connector.get(connectorName);
        connectorConfig = connector.schema.normalize(connectorConfig);

        poolConfig = Pool.options.normalize(poolConfig);

        store[name] = {
            connector: {
                name: connectorName,
                config: connectorConfig
            },
            pool: poolConfig
        };

        return copy(store[name]);
    };

    return factory;
};

Object.defineProperty(module.exports, 'error', {
    enumerable: true,
    configurable: true,
    value: Err,
    writable: false
});

function copy(obj) {
    return JSON.parse(JSON.stringify(obj));
}