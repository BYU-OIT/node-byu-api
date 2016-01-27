"use strict";
var CustomError     = require('custom-error-instance');
var schemata        = require('object-schemata');
var Promise         = require('bluebird');

var ConnectorError = CustomError('ConnectorError');
ConnectorError.exists = CustomError(ConnectorError, { code: 'EEXIST' });
ConnectorError.create = CustomError(ConnectorError, { code: 'ECREATE' });
ConnectorError.undefined = CustomError(ConnectorError, { code: 'EUDEF' });

var store = {};


Object.defineProperty(exports, 'error', {
    enumerable: false,
    configurable: true,
    value: ConnectorError,
    writable: false
});

/**
 * Define a connector.
 * @param {string} name The name of the connector
 * @param {string} disconnect The name of the property on the connection to use to disconnect.
 * @param {object} configuration An object map of command line args and questions, used by the inquirer
 * @param {function} connect The function to call with configuration
 * data to create a connection.
 */
exports.define = function(name, disconnect, configuration, connect) {
    var item;
    var schema;

    // validate parameters
    if (exports.exists(name)) throw new ConnectorError.exists('A Connector with this name already exists: ' + name);
    if (typeof name !== 'string' || !name) throw new ConnectorError.create('connector.define expects the first parameter to be a non-empty string. Received: ' + name);
    if (typeof disconnect !== 'string' || !disconnect) throw new ConnectorError.create('connector.define expects the second parameter to be a non-empty string. Received: ' + name);
    if (typeof configuration !== 'object' || !configuration) throw new ConnectorError.create('connector.define expects the third parameter to be an object. Received: ' + configuration);
    if (typeof connect !== 'function') throw new ConnectorError.create('connector.define expects the forth parameter to be a function. Received: ' + connect);

    // build the schema
    schema = schemata(configuration);

    // generate the connector item
    store[name] = item = {};

    /**
     * Get a database connection using the configuration.
     * @param {object} configuration
     * @returns {Promise}
     */
    item.connect = function(configuration) {
        try {
            var config = schema.normalize(configuration || {});
            return Promise.resolve(connect(config));
        } catch (e) {
            return Promise.reject(e);
        }
    };

    item.disconnect = disconnect;

    /**
     * Test a configuration against the connector.
     * @param {object} configuration
     * @returns {Promise}
     */
    item.test = function(configuration) {
        var result = true;
        return item.connect(configuration)
            .then(function(connection) {
                return connection[disconnect]();
            })
            .catch(function(err) {
                result = err;
            })
            .then(function() {
                return result;
            });
    };

    // store questions array (for inquirer)
    item.questions = [];
    Object.keys(configuration).forEach(function(key) {
        var question = Object.assign({ name: key }, configuration[key]);
        if (question.hasOwnProperty('transform')) {
            question.filter = question.transform;
            delete question.transform;
        }
        item.questions.push(question);
    });
};

/**
 * Determine if a connector is defined.
 * @param {string} name The name of the connector.
 * @returns {boolean}
 */
exports.exists = function(name) {
    return store.hasOwnProperty(name);
};

/**
 * Get an existing connector object.
 * @param {string} name The name of the connector to get.
 * @returns {object}
 */
exports.get = function(name) {
    if (!store.hasOwnProperty(name)) throw new ConnectorError.undefined('Connector not defined: ' + name);
    return store[name];
};

/**
 * List all of the connectors that have been defined.
 * @returns {string[]}
 */
exports.list = function() {
    return Object.keys(store);
};

/**
 * Delete an existing connector.
 * @param {string} name
 */
exports.remove = function(name) {
    if (!store.hasOwnProperty(name)) throw new ConnectorError.undefined('Connector not defined: ' + name);
    delete store[name];
};