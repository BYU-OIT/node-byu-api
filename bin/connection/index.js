"use strict";
var chalk           = require('chalk');
var cli             = require('../util/cli');
var Command         = require('command-line-callback');
var Configuration   = require('./configuration');
var connFile        = require('./configuration-file');
var Connector       = require('./connector');
var format          = require('cli-format');
var inquirer        = require('inquirer');
var requireDir      = require('../util/require-directory');
var Table           = require('cli-table2');

Command.define('connection-file',
    function(config) {
        return connFile(config).then(cfInterface);
    },
    {
        brief: 'Create or update a connection file.',
        defaultOption: 'file',
        synopsis: [
            '[FILE]'
        ],
        options: {
            file: {
                type: String,
                description: 'The path to the file to load.',
                hidden: true,
                required: true
            }
        }
    });

/**
 * Set the terminal into interactive mode.
 * @param dbConn The connection file factory.
 * @returns {Promise}
 */
function cfInterface(dbConn) {
    var menu = {};
    var changes = false;
    var store = Configuration(dbConn);

    menu.changePassword = function() {
        return cli
            .prompt([
                {
                    type: 'password',
                    name: 'password',
                    message: 'Enter password:'
                },{
                    type: 'password',
                    name: 'password2',
                    message: 'Re-enter password:'
                }
            ])
            .then(function(answers) {
                if (answers.password !== answers.password2) {
                    return cli.choices('Passwords did not match:', ['Re-enter', 'Abort'])
                        .then(function(value) {
                            if (value === 'Re-enter') return menu.changePassword();
                            return menu.root();
                        });
                } else {
                    dbConn.changePassword(answers.password);
                    console.log('Password changed.');
                    changes = true;
                }
            });
    };

    menu.create = function() {
        return cli
            .prompt([{
                type: 'input',
                name: 'name',
                message: 'Connection name:',
                validate: function(v) { return v.length > 0; }
            }])
            .then(function(answers) {
                var item = dbConn.get(answers.name);
                if (item) throw Error('A connection configuration with that name already exists.');
                return menu.edit(answers.name);
            });
    };

    menu.edit = function(name, connectorConfig) {

        function test(connector, config) {
            return connector.test(config)
                .then(function(result) {
                    if (result === true) {
                        console.log('Connection successful');
                    } else {
                        var message = 'Could not connect: ' + result.message;
                        return cli.choices(message, ['Re-enter', 'Retry', 'Ignore'])
                            .then(function(answer) {
                                switch (answer.toLowerCase()) {
                                    case 're-enter': return menu.edit(name, config);
                                    case 'retry': return test(connector, config);
                                    case 'ignore': return;
                                }
                            });
                    }
                });
        }

        return cli.choices('Connector:', Connector.list())
            .then(function(connectorName) {
                var connector = Connector.get(connectorName);
                var questions = getQuestionsFromConfiguration(connector.configuration, connectorConfig);
                return cli.prompt(questions)
                    .then(function(config) {
                        dbConn.set(name, connectorName, config);
                        changes = true;
                        return test(connector, config);
                    });
            });
    };

    menu.exit = function() {
        if (changes) {
            return cli
                .prompt([{
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Exit without saving?'
                }])
                .then(function(answers) {
                    if (!answers.confirm) return menu.root();
                })
        }
    };

    menu.list = function() {
        return connectionStatus(dbConn)
            .then(function(output) {
                console.log(output);
            });
    };

    menu.root = function() {
        var choicesArray = [
            'Create',
            'Update',
            'List',
            'Delete',
            new inquirer.Separator(),
            'Change Password',
            'Exit'
        ];
        if (changes) choicesArray.splice(choicesArray.length - 1, 0, 'Save', 'Save and Exit');
        return cli.choices('Connection configuration:', choicesArray)
            .then(function(choice) {
                switch (choice.toLowerCase()) {
                    case 'create': return menu.create().then(menu.root);
                    case 'update': return menu.update().then(menu.root);
                    case 'list': return menu.list().then(menu.root);
                    case 'delete': return menu.remove().then(menu.root);
                    case 'change password': return menu.changePassword().then(menu.root);
                    case 'save': return menu.save().then(menu.root);
                    case 'save and exit': return menu.save().then(menu.exit);
                    case 'exit': return menu.exit();
                }
            })
            .catch(function(e) {
                console.log(e.stack);
                return menu.root();
            });
    };

    menu.remove = function() {
        return cli.choices('Connection name:', dbConn.list())
            .then(function(name) {
                dbConn.remove(name);
                changes = true;
            });
    };

    menu.save = function() {
        return dbConn.save()
            .then(function() {
                console.log('Changes saved');
                changes = false;
            })
            .catch(function(e) {
                console.log('Unable to save changes: ' + e.message);
            });
    };

    menu.update = function() {
        return cli.choices('Connection name:', dbConn.list())
            .then(function(name) {
                var item = dbConn.get(name);
                return menu.edit(name, item.config);
            });
    };

    return requireDir('connectors')
        .then(menu.root);
}

function connectionStatus(dbConn) {
    var list;
    var headings;
    var promises = [];
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
        return Promise.resolve(format.wrap(chalk.italic('There are no defined connections.')) + '\n');
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
}

function getQuestionsFromConfiguration(config, prevValues) {
    return Object.keys(config)
        .map(function(key) {
            var o = Object.assign({ name: key }, config[key]);
            if (o.hasOwnProperty('defaultValue')) {
                o.default = o.defaultValue;
                delete o.defaultValue;
            }
            if (prevValues.hasOwnProperty(key)) {
                o.default = prevValues[key];
            }
            return o;
        });
}