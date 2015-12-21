"use strict";
// This file is the bridge between connectors and the rest of the code.

var connManager     = require('./connection-manager');
var customError     = require('./custom-error');
var file            = require('./file');
var NoStackError    = require('./no-stack-error');
var path            = require('path');

var ConnectorError = customError('Connector', {
    exists: 'exists',
    notExist: 'dnexist',
    name: 'name',
    connect: 'conn',
    disconnect: 'dconn',
    config: 'config'
});

var store = {};
var loadPromise;

/**
 * Define a connector.
 * @param {string} name The name of the connector
 * @param {function} connect The function to call with configuration
 * data to create a connection.
 * @param {function} disconnect The function to call to disconnect.
 * @param {object} configuration An object map of command line args and questions, used by the inquirer
 * cli to manage connections and by the command-line-usage to output help.
 */
exports.define = function(name, connect, disconnect, configuration) {

    //validate parameters
    if (exports.exists(name)) throw new ConnectorError.exists('A Connector with this name already exists: ' + name);
    if (typeof name !== 'string') throw new ConnectorError.name('connector.define expects the first parameter to be a string. Received: ' + name);
    if (typeof connect !== 'function') throw new ConnectorError.connect('connector.define expects the second parameter to be a function. Received: ' + connect);
    if (typeof disconnect !== 'function') throw new ConnectorError.disconnect('connector.define expects the third parameter to be a function. Received: ' + disconnect);
    if (typeof configuration !== 'object') throw new ConnectorError.config('connector.define expects the fourth parameter to be an object. Received: ' + configuration);

    //store the connector
    store[name] = {
        connect: connect,
        disconnect: disconnect,
        configuration: configuration
    };
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
    var root = path.resolve(__dirname, '../connectors');

    if (!loadPromise) {
        dirPath = path.resolve(__dirname, '../connectors');
        loadPromise = file.readdirStats(dirPath)
            .then(function(statMap) {
                Object.keys(statMap).forEach(function(filePath) {
                    var stat = statMap[filePath];
                    if (stat.isFile() && /\.js$/.test(filePath)) {
                        console.log('Loading connector file: ' + path.relative(root, filePath));
                        require(filePath);
                    }
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
 * Get an inquirer question object from the connector's configuration. Optionally
 * include a configuration object that has already set values (default values)
 * for one or more of the questions.
 * @param {string} connector
 * @param {object} [configuration]
 * @returns {object[]}
 */
exports.questions = function(connector, configuration) {
    var item = exports.get(connector);
    var questions = [];

    if (!item) return questions;
    if (!configuration) configuration = {};

    function addQuestion(map, key) {
        var question = Object.assign({}, map[key]);
        var defaultValue;
        var filter;

        //get the default value if there is one
        if (configuration.hasOwnProperty(key)) {
            defaultValue = configuration[key];
        } else if (question.hasOwnProperty('defaultValue')) {
            defaultValue = question.defaultValue;
        }

        //set up a formatter based on type
        switch(question.type) {
            case Number:
                filter = function(v) { return parseInt(v); };
                break;
        }

        question.name = key;
        question.type = question.question_type;
        if (typeof defaultValue !== 'undefined' && question.type !== 'password') question.default = defaultValue;

        questions.push(question);
    }

    //get connector configuration options
    Object.keys(item.configuration).forEach(function(key) {
        addQuestion(item.configuration, key);
    });

    //get connection manager configuration options
    Object.keys(connManager.options).forEach(function(key) {
        addQuestion(connManager.options, key);
    });

    return questions;
};

/**
 * Get formatted settings for a connector configuration.
 * @param {string} connector
 * @param {object} configuration
 * @returns {object}
 */
exports.settings = function(connector, configuration) {
    var item = exports.get(connector);
    var questions;
    var result = {};
    if (!item) return void 0;

    questions = exports.questions(connector, configuration);
    questions.forEach(function(question) {
        if (configuration.hasOwnProperty(question.name)) {
            result[question.name] = question.type === 'password' ? '**********' : configuration[question.name];
        }
    });

    return result;
};

/**
 * Test a configuration for a connector.
 * @param {string} connectorName
 * @param {object} configuration
 * @returns {Promise}
 */
exports.test = function(connectorName, configuration) {
    var manager;
    if (!exports.exists(name)) return Promise.reject(new ConnectorError.notExist('Cannot connect to undefined connector: ' + name));
    manager = connManager(store[name].connect, store[name].disconnect, configuration, {});
    return manager.connect().then(manager.disconnect);
};