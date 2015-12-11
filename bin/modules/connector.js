"use strict";
var file            = require('./file');
var path            = require('path');

var store = {};
var loadPromise;

/**
 * Make a database connection for a connector.
 * @param {string} name The connector name.
 * @param {object} options The connection options.
 * @returns {Promise}
 */
exports.connect = function(name, options) {
    if (!exports.exists(name)) return Promise.reject(new Error('Cannot connect to undefined connector: ' + name));
    return store[name].connect(options);
};

/**
 * Define a connector.
 * @param {string} name The name of the connector
 * @param {function} connect The function to call with configuration
 * data to create a connection.
 * @param {function} disconnect The function to call to disconnect.
 * @param {object[]} questions An array of questions to pass to the inquirer cli to manage connections.
 */
exports.define = function(name, connect, disconnect, questions) {

    //validate parameters
    if (exports.exists(name)) throw new Error('A Connector with this name already exists: ' + name);
    if (typeof name !== 'string') throw new Error('connector.define expects the first parameter to be a string. Received: ' + name);
    if (typeof connect !== 'function') throw new Error('connector.define expects the second parameter to be a function. Received: ' + connect);
    if (typeof disconnect !== 'function') throw new Error('connector.define expects the third parameter to be a function. Received: ' + disconnect);
    if (typeof questions !== 'object') throw new Error('connector.define expects the fourth parameter to be an object. Received: ' + config);

    //store the connector
    store[name] = {
        connect: connect,
        disconnect: disconnect,
        questions: questions
    }
};

/**
 * Disconnect a database connection for a connector.
 * @param {string} name The name of the connector to disconnect from.
 * @param {object} connection The database connection.
 * @returns {*}
 */
exports.disconnect = function(name, connection) {
    if (!exports.exists(name)) return Promise.reject(new Error('Cannot disconnect from undefined connector: ' + name));
    return store[name].disconnect(connection);
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
 * Require every file in the connectors directory.
 * @returns {Promise}
 */
exports.load = function() {
    var dirPath;
    if (!loadPromise) {
        dirPath = path.resolve(__dirname, '../connectors');
        loadPromise = file.readdirStats(dirPath)
            .then(function(statMap) {
                Object.keys(statMap).forEach(function(filePath) {
                    var stat = statMap[filePath];
                    if (stat.isFile() && /\.js$/.test(filePath)) require(filePath);
                });
            });
    }
    return loadPromise;
};

Object.defineProperty(exports, 'loaded', {
    enumerable: true,
    configurable: false,
    get: function() {
        if (!loadPromise) return false;
        return loadPromise.isFulfilled;
    }
});

/**
 * Get formatted settings for a connector configuration.
 * @param {string} connector
 * @param {object} configuration
 * @returns {object}
 */
exports.settings = function(connector, configuration) {
    var item = exports.get(connector);
    var result = {};
    if (!item) return void 0;

    item.questions.forEach(function(question) {
        if (configuration.hasOwnProperty(question.name)) {
            result[question.name] = question.type === 'password' ? '**********' : configuration[question.name];
        }
    });

    return result;
};

/**
 * Test a configuration for a connector.
 * @param {string} connector
 * @param {object} configuration
 * @returns {Promise}
 */
exports.test = function(connector, configuration) {
    return exports.connect(connector, configuration)
        .then(function(connection) {
            exports.disconnect(connector, connection);
        });
};