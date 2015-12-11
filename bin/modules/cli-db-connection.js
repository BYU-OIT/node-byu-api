var chalk           = require('chalk');
var clc             = require('./clc');
var connector       = require('./connector');
var dbConnection    = require('./db-connection');
var format          = require('cli-format');
var inquirer        = require('inquirer');
var Promise         = require('bluebird');
var Table           = require('cli-table2');

chalk.enabled = true;

clc.define('db-connection', handler, {
    description: 'The database connection management interface.',
    help: 'All functionality for this tool is available through command line arguments. If you do not supply all of ' +
        'the arguments needed for your command then an interface will present itself where you can enter that ' +
        'information without it becoming part of the terminal\'s history. Any input provided to the db-connection ' +
        'interface will not be part of the terminal\'s history, which you might want if you\'re entering passwords.',
    options: {
        action: {
            alias: 'a',
            type: String,
            description: 'The action to take. One of: Create, Update, List, or Delete.'
        },
        connector: {
            alias: 'c',
            type: String,
            description: 'The name of the connector to use the database connection configuration with.'
        },

        name: {
            alias: 'n',
            type: String,
            description: 'The name to give this database connection configuration.'
        },
        update: {
            alias: 'u',
            type: Boolean,
            description: 'Set this flag to overwrite an old connection configuration with the same name, if there is one.'
        }
    }
});

clc.define('db-connection-list', listTable, {
    description: 'Get a list of database connections.'
});


function handler(err, config) {
    var questions = [];

    questions.push({
        type: 'list',
        name: 'action',
        message: 'Connection configuration:',
        choices: [
            'Create',
            'Update',
            'List',
            'Delete'
        ],
        when: function() {
            return !config.action;
        }
    });

    inquirer.prompt(questions, function(answers) {
        var action = answers.action || config.action;
        switch (action.toLowerCase()) {
            case 'create':
                createHandler(null, config);
                break;
            case 'update':
                updateHandler(null, config);
                break;
            case 'list':
                listTable();
                break;
                break;
            case 'delete':
                deleteHandler(null, config);
                break;
            default:
                console.log('Invalid action: ' + action);
                break;
        }
    });
}

/**
 * Create or update a connection configuration.
 * @param {Error} err
 * @param {object} options
 */
function createHandler(err, options) {
    Promise
        .all([
            dbConnection.load(),
            connector.load()
        ])
        .then(function() {
            var connectors = connector.list();
            var connections = dbConnection.list();
            var existing;
            var questions = [];

            //if there are no connectors then exit
            if (connectors.length === 0) {
                console.log(format.wrap('You cannot define a connection because there are no defined connectors.'));
                return;
            }

            //output a message if a bad connector was specified
            if (options.connector && connectors.indexOf(options.connector) === -1) {
                console.log('The connector your specified (' + options.connector + ') does not exist.');
            }

            //prompt for name if not provided
            if (!options.name) {
                questions.push({
                    type: 'input',
                    name: 'name',
                    message: 'Database connection name:',
                    validate: function(value) {
                        if (value) {
                            options.name = value;
                            existing = dbConnection.get(value);
                        }
                        return value.length > 0;
                    }
                });
            } else {
                existing = dbConnection.get(options.name);
            }

            //prompt for confirm update if name already exists
            questions.push({
                type: 'confirm',
                name: 'update_existing',
                message: 'Update existing?' + chalk.dim(' (' + options.name + ')'),
                when: function(answers) {
                    return connections.indexOf(options.name || answers.name) !== -1;
                }
            });

            //prompt for connector type if not provided
            if (!options.connector || connectors.indexOf(options.connector) === -1) {
                questions.push({
                    type: 'list',
                    name: 'connector',
                    message: function(answers) {
                        if (existing && !answers.update_existing) existing = null;
                        return 'Connector:' + (existing ? chalk.dim(' (' + existing.connector + ')') : '');
                    },
                    choices: connectors,
                    when: function(answers) {
                        return !existing || answers.update_existing;
                    }
                });
            }

            //run prompts specific to connector specified
            inquirer.prompt(questions, function(answers) {
                var connectorName = answers.connector || options.connector;
                var connectorItem = connector.get(connectorName);

                //if there is an existing and we shouldn't update it then exit
                if (existing && !answers.update_existing) {
                    console.log('Aborted');
                    return;
                }

                //if connector doesn't exist then output an error and exit
                if (!connectorItem) {
                    console.log('Connector ' + connectorName + ' does not exist');
                    return;
                }

                //run connector prompts until connection succeeds or until Ctrl-C
                function enterConnectionInfo(config) {
                    var questions;

                    //make a copy of the connectors questions and modify them
                    questions = connectorItem.questions.slice(0)
                        .map(function(q) {
                            var result = Object.assign({}, q);
                            if (config.hasOwnProperty(q.name) && q.type !== 'password') {
                                result.default = config[q.name];
                            }
                            return result;
                        });

                    inquirer.prompt(questions, function(config) {
                        console.log(format.wrap('Testing connection...'));
                        connector.test(connectorName, config)
                            .then(function() {
                                console.log('Connection successful');
                                dbConnection.set(answers.name || options.name, connectorName, config);
                                saveConnections();
                            })
                            .catch(function(err) {
                                console.error('Connection failed: ' + err.message);
                                console.log('Please try again or use Ctrl-C to exit.');
                                enterConnectionInfo(config);
                            });
                    });
                }

                enterConnectionInfo(existing ? existing.config : {});
            });
        });
}

function deleteHandler(err, config) {
    dbConnection.load()
        .then(function() {
            var connections = dbConnection.list();
            var questions = [];

            //prompt for name
            if (!config.name) {
                questions.push({
                    type: 'list',
                    name: 'name',
                    message: 'Connection to delete?',
                    choices: connections
                });
            }

            //confirm deletion
            questions.push({
                type: 'confirm',
                name: 'confirm',
                message: function(answers) {
                    return 'Confirm delete of ' + (answers.name || config.name) + ':';
                }
            });

            //run prompts specific to connector specified
            inquirer.prompt(questions, function (answers) {
                if (!answers.confirm) {
                    console.log('Delete cancelled');
                } else {
                    dbConnection.remove(answers.name);
                    //saveConnections();
                }
            });
        });
}

/**
 * Output a table with connections, their connector type, their connection status, and settings.
 */
function listTable() {
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

    Promise
        .all([
            dbConnection.load(),
            connector.load()
        ])
        .then(function() {
            var list;
            var promises = [];

            //get a list of defined connections
            list = dbConnection.list()
                .map(function(name) {
                    var item = dbConnection.get(name);
                    return {
                        name: name,
                        connector: item.connector,
                        config: item.config
                    };
                });

            //if there are no connections then output result and exit
            if (list.length === 0) {
                table.push({ colSpan: 3, content: chalk.italic('There are no defined connections.') });
                console.log(table.toString());
                return;
            }

            //test each connection
            list.forEach(function(item, index) {
                var promise = connector.test(item.connector, item.config)
                    .then(function(connectOk) {
                        list[index].connected = chalk.green('\u2714 Yes');
                    })
                    .catch(function() {
                        list[index].connected = chalk.red('\u2718 NO');
                    });
                promises.push(promise);
            });

            Promise.all(promises)
                .then(function() {
                    list.forEach(function(item) {
                        table.push([
                            format.wrap(item.name, { width: widths[0] - 3 }),
                            format.wrap(item.connector, { width: widths[1] - 3 }),
                            format.wrap(item.connected, { width: widths[2] - 3 }),
                            format.wrap(JSON.stringify(connector.settings(item.connector, item.config) || {}, null, 2), { width: settingsWidth, hardBreak: '' })
                        ]);
                    });
                    console.log(table.toString());
                });
        });
}

function saveConnections() {
    return dbConnection.save()
        .then(function() {
            console.log('Connection information saved.');
        })
        .catch(function(err) {
            console.log('Could not save connection information: ' + err.message);
        });
}

function updateHandler() {
    Promise
        .all([
            dbConnection.load(),
            connector.load()
        ])
        .then(function() {
            var connectors = connector.list();
            var connections = dbConnection.list();
            var questions = [];

            //if there are no connectors then exit
            if (connectors.length === 0) {
                console.log(format.wrap('You cannot update a connection because there are no defined connectors.'));
                return;
            }

            //prompt for name
            questions.push({
                type: 'list',
                name: 'name',
                message: 'Which connection would you like to update?',
                choices: connections
            });

            //run prompts specific to connector specified
            inquirer.prompt(questions, function (answers) {
                createHandler(null, { name: answers.name });
            });
        });
}