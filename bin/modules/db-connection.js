"use strict";
// This file produces the database connection manager.
var connector           = require('./connector');
var connectionConfig    = require('./connection-config');
var NoStackError        = require('./no-stack-error');
var Promise             = require('bluebird');

module.exports = connection;

function connection(configuration) {
    var config = clc.options.normalize(connection.options, configuration, true);
    var connConfig;
    var filePath = config['db-config-file'];
    var filePass = config['db-config-pass'];
    var promises = [];

    if (filePath) promises.push(connectionConfig(filePath, filePass).then(v => connConfig = v));
    promises.push(connector.load());

    return Promise.all(promises)
        .then(function() {
            var store = {};

            // fill store with connection configuration data
            if (connConfig && !connConfig.noFile()) {
                connConfig.list().forEach(function(name) {
                    var item = connConfig.get(name);
                    store[name] = {
                        name: name,
                        connector: item.connector,
                        config: Object.assign({}, item.config)
                    };
                });
            }

            //build a map of connection configuration from the passed in db-connection argument
            if (config['db-connection']) {
                config['db-connection'].forEach(function(item) {
                    store[item.name] = item;;
                });
            }

            return connectionManager(store);
        });
}

connection.options = {
    'db-connection': {
        alias: 'n',
        type: Object,
        description: 'A database connection configuration. This will overwrite any connection with the same ' +
            'name that is found in an included db-config-file.',
        help: 'The object must be formatted as follows. The config property is the configuration that will ' +
            'be passed to the connector:\n' +
            '{\n' +
            '  name: "connection_name",\n' +
            '  connector: "connector_name",\n' +
            '  config: {}\n' +
            '}',
        group: 'connection',
        multiple: true,
        validate: function(value) {
            return value.hasOwnProperty('name') &&
                typeof value.name === 'string' &&
                value.name.length > 0 &&

                value.hasOwnProperty('connector') &&
                typeof value.connector === 'string' &&
                value.connector.length > 0 &&

                value.hasOwnProperty('config') &&
                typeof value.config === 'object' &&
                value.config;
        }
    },
    'db-config-file': {
        alias: 'd',
        type: String,
        description: 'The path to the database connection configuration file. If omitted then there will be no ' +
        'automated database connection handling.',
        group: 'connection'
    },
    'db-config-pass': {
        alias: 'e',
        type: String,
        description: 'If the database connection configuration file is encrypted then you can provide the ' +
        'decrypt password with this argument.',
        group: 'connection'
    }
};