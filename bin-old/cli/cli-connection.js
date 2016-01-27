var chalk           = require('chalk');
var clc             = require('./clc');
var cliConnection   = require('./cli-connection-interactive');
var cliError        = require('./cli-error');
var connector       = require('connector.js');
var format          = require('cli-format');
var connFile        = require('connection-file');
var pool            = require('../modules/connection-pool');
var requireDir      = require('../../bin/util/require-directory');
var Table           = require('cli-table2');

var options = {
    connector: {
        alias: 'c',
        type: String,
        description: 'The name of the connector to use the database connection configuration with.',
        required: true
    },
    'connector-settings': {
        alias: 'd',
        type: Object,
        description: 'The settings needed by the connector to establish a database connection.',
        help: 'You probably shouldn\'t use this from the command line because any sensitive information will be ' +
        'stored in your command line history. Instead, use the interactive session.',
        required: true
    },
    name: {
        alias: 'n',
        type: String,
        description: 'The name associated with the database connection configuration.',
        required: true
    },
    'old-password': {
        alias: 'o',
        type: String,
        description: 'The old password that was used to encrypt and decrypt the store.',
        help: 'You probably shouldn\'t use this from the command line because any sensitive information will be ' +
        'stored in your command line history. Instead, use the interactive session.',
        required: true
    },
    password: {
        alias: 'p',
        type: String,
        description: 'The password to use to encrypt and decrypt the store.',
        help: 'You probably shouldn\'t use this from the command line because any sensitive information will be ' +
        'stored in your command line history. Instead, use the interactive session.'
    },
    store: {
        alias: 's',
        type: String,
        description: 'The file path of where the database configurations are stored.',
        required: true
    }
};

exports.connectionStatus = function(dbConn) {
    var headings;
    var table;
    var settingsWidth;
    var widths;

    headings = [
        chalk.white.bold('Name'),
        chalk.white.bold('Type'),
        chalk.white.bold('OK'),
        chalk.white.bold('Settings')
    ];

    widths = [16, 16, 7, null];

    settingsWidth = widths.reduce(function(prev, curr) {
        return prev - (curr || 0) - 1;
    }, format.config.config.availableWidth - 3);

    table = new Table({
        head: headings,
        colWidths: widths
    });

    return exports.loadConnectors()
        .then(function() {
            var list;
            var promises = [];

            //get a list of defined connections
            list = dbConn.list()
                .map(function(name) {
                    var item = dbConn.get(name);
                    return {
                        name: name,
                        connector: item.connector,
                        config: item.config
                    };
                });

            //if there are no connections then output result and exit
            if (list.length === 0) {
                console.log(format.wrap(chalk.italic('There are no defined connections.')) + '\n');
                return;
            }

            //test each connection
            list.forEach(function(item, index) {
                var promise = exports.connectionTest(item.connector, item.config)
                    .then(function() {
                        list[index].connected = chalk.green('\u2714 Yes');
                    })
                    .catch(function() {
                        list[index].connected = chalk.red('\u2718 NO');
                    });
                promises.push(promise);
            });

            return Promise.all(promises)
                .then(function() {
                    list.forEach(function(item) {
                        table.push([
                            format.wrap(item.name, { width: widths[0] - 3 }),
                            format.wrap(item.connector, { width: widths[1] - 3 }),
                            format.wrap(item.connected, { width: widths[2] - 3 }),
                            format.wrap(JSON.stringify(connectorSettings(item.connector, item.config) || {}, null, 2), { width: settingsWidth, hardBreak: '' })
                        ]);
                    });
                    return table.toString();
                });
        });
};

/**
 * Test a configuration for a connector.
 * @param {string} connectorName
 * @param {object} configuration
 * @returns {Promise} that resolves if the connection and disconnection is successful, otherwise it rejects the promise.
 */
exports.connectionTest = function(connectorName, configuration) {
    var item = connector.get(connectorName);
    var manager;

    if (!item) return Promise.reject(new cliError.connector('Cannot connect to undefined connector: ' + connectorName, 0));
    manager = pool(item.connect, item.disconnect, configuration, {});
    return manager.connect().then(manager.disconnect);
};

/**
 * Get an inquirer questions the connector's configuration. Optionally
 * include a configuration object that has already set values (default values)
 * for one or more of the questions.
 * @param {string} connectorName
 * @param {object} [configuration]
 * @returns {object[]}
 */
exports.questions = function(connectorName, configuration) {
    var item = connector.get(connectorName);
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
    Object.keys(pool.options).forEach(function(key) {
        addQuestion(pool.options, key);
    });

    return questions;
};

exports.loadConnectors = function() {
    return requireDir('connectors');
};


//////////////////////////////////////
//      DEFINE CLI COMMANDS         //
//////////////////////////////////////

clc.define('connection', interactiveTerminal, {
    description: 'Start an interactive session that allows you to manage connections.',
    defaultOption: 'store',
    options: optSelect('password', 'store')
});

clc.define('connection-define', define, {
    description: 'Define a connection configuration.',
    defaultOption: 'store',
    options: optSelect('connector', 'connector-settings', 'name', 'password', 'store')
});

clc.define('connection-delete', remove, {
    description: 'Delete a connection configuration.',
    defaultOption: 'store',
    options: optSelect('name', 'password', 'store')
});

clc.define('connection-list', list, {
    description: 'List saved connection configurations.',
    defaultOption: 'store',
    options: optSelect('password', 'store')
});

clc.define('connection-password', password, {
    description: 'Change the password for a connection configuration file.',
    defaultOption: 'store',
    options: optSelect('old-password', 'password', 'store')
});


function catcher(e) {
    console.log(e.message);
}

function configFromOptions(options) {
    var config = {};
    if (options.hasOwnProperty('store')) config['connection-file'] = options.store;
    if (options.hasOwnProperty('password')) config['connection-pass'] = options.password;
    return config;
}

function connectorSettings(connectorName, configuration) {
    var item = connector.get(connectorName);
    var questions;
    var result = {};
    if (!item) return void 0;

    questions = exports.questions(connectorName, configuration);
    questions.forEach(function(question) {
        if (configuration.hasOwnProperty(question.name)) {
            result[question.name] = question.type === 'password' ? '**********' : configuration[question.name];
        }
    });

    return result;
}

function define(err, options) {
    if (err || options.help) return;
    connFile(configFromOptions(options))
        .then(function(dbConn) {
            dbConn.set(options.name, options.connector, options['connector-settings']);
            return dbConn.save()
                .then(function() {
                    console.log('Connection configuration "' + options.name + '" saved.');
                    return dbConn.test(options.name);
                })
                .then(function() {
                    console.log('Connection configuration connected to the database.');
                });
        })
        .catch(catcher);
}

function interactiveTerminal(err, options) {
    if (err || options.help) return;
    console.log(configFromOptions(options));
    connFile(configFromOptions(options))
        .catch(function(e) {
            if (e.name === 'ConnectionFile') {
                console.error(e.message);
                process.exit(1);
            } else {
                throw e;
            }
        })
        .then(function(dbConn) {
            return cliConnection(dbConn);
        })
        .then(function(changes) {
            if (changes) {
                dbConn.save();
                console.log('Connection configuration saved.');
            }
        });
}

function list(err, options) {
    if (err) return;
    return connFile(configFromOptions(options))
        .then(exports.connectionStatus);
}

function password(err, options) {
    var config = {};
    if (err || options.help) return;

    if (options.hasOwnProperty('store')) config['connection-file'] = options.store;
    if (options.hasOwnProperty('old-password')) config['connection-password'] = options['old-password'];

    connFile(config)
        .then(function(dbConn) {
            dbConn.changePassword(options.password);
            return dbConn.save();
        })
        .then(function() {
            console.log('Password changed.');
        })
        .catch(catcher);
}

function remove(err, options) {
    if (err || options.help) return;
    connFile(configFromOptions(options))
        .then(function(dbConn) {
            dbConn.remove(options.name);
            return dbConn.save();
        })
        .then(function() {
            console.log('Connection configuration deleted.');
        });

}

function optSelect() {
    var i;
    var key;
    var result = {};
    for (i = 0; i < arguments.length; i++) {
        key = arguments[i];
        if (options.hasOwnProperty(key)) {
            result[key] = Object.assign({}, options[key]);
        }
    }
    return result;
}