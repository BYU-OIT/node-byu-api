"use strict";
var chalk           = require('chalk');
var cli             = require('../util/cli');
var Command         = require('command-line-callback');
var Configuration   = require('./configuration');
var Connector       = require('./connector');
var format          = require('cli-format');
var inquirer        = require('inquirer');
var Manager         = require('./manager');
var Table           = require('cli-table2');

exports.options = {
    file: {
        type: String,
        description: 'The path to the database file.',
        hidden: true,
        required: true,
        group: 'database'
    },
    password: {
        type: String,
        description: 'The password to use to encrypt or decrypt the database file.',
        group: 'database'
    }
};

Command.define('database-file',
    function(configuration) {
        return loadConfigurationFile(configuration)
            .catch(function(e) {
                if (e instanceof Configuration.error.noPass) return authInterface(configuration);
                throw e;
            })
            .then(cfInterface)
            .catch(function(e) {
                if (e instanceof Configuration.error.pass) console.error(e.message);
            });
    },
    {
        brief: 'Create or update a connection file.',
        defaultOption: 'file',
        synopsis: [
            '[OPTIONS]... [FILE]'
        ],
        options: exports.options
    });

/**
 * Set the terminal to interactive mode to ask for the password.
 * @param dbConn
 */
function authInterface(config) {
    return cli
        .prompt([
            {
                type: 'password',
                name: 'password',
                message: 'File encrypted. Enter password:'
            }
        ])
        .then(function(answers) {
            config.password = answers.password;
            return loadConfigurationFile(config)
        });
}

/**
 * Set the terminal into interactive mode.
 * @param dbConn The connection file factory.
 * @returns {Promise}
 */
function cfInterface(dbConn) {
    var menu = {};
    var changes = false;

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
        changes = true;

        function test(connector, config) {
            return connector.test(config)
                .then(function(result) {
                    var message;
                    if (result === true) {
                        console.log('Connection successful');
                    } else {
                        message = 'Could not connect: ' + result.message;
                        return cli.choices(message, ['Re-enter', 'Retry', 'Ignore'])
                            .then(function(answer) {
                                switch (answer.toLowerCase()) {
                                    case 're-enter': return connectorQuestions(connector, config);
                                    case 'retry': return test(connector, config);
                                    case 'ignore': return;
                                }
                            });
                    }
                });
        }

        function connectorQuestions(connector, config) {
            var questions = getQuestionsFromConfiguration(connector.schema.configuration, config);
            return cli.prompt(questions)
                .then(function(answers) {
                    return test(connector, answers)
                        .then(function() {
                            dbConn.set(name, connector.name, answers);
                            return answers;
                        });
                });
        }

        return cli.choices('Connector:', Connector.list())
            .then(function(connectorName) {
                var connector = Connector.get(connectorName);
                return connectorQuestions(connector, connectorConfig);
            });
    };

    menu.exit = function() {
        if (changes) {
            return cli
                .prompt([{
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Exit without saving?',
                    default: false
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

    return menu.root();
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
        var connector =  Connector.get(item.connector);
        var promise = connector.test(item.config)
            .then(function(result) {
                list[index].connected = result === true ?
                    chalk.green('\u2714 Yes') :
                    chalk.red('\u2718 NO');
            });
        promises.push(promise);
    });

    return Promise.all(promises)
        .then(function() {
            list.forEach(function(item) {
                var connector = Connector.get(item.connector);
                var settingsStr = [];

                Object.keys(item.config).forEach(function(key) {
                    var value = item.config[key];
                    var isPassword = connector.schema.configuration[key].type === 'password';

                    if (isPassword) value = '*******';
                    if (typeof value === 'string') value = '"' + value + '"';
                    settingsStr.push(key + ': ' + value);
                });

                table.push([
                    format.wrap(item.name, { width: widths[0] - 3 }),
                    format.wrap(item.connector, { width: widths[1] - 3 }),
                    format.wrap(item.connected, { width: widths[2] - 3 }),
                    format.wrap(settingsStr.join('\n'), { width: settingsWidth, hardBreak: '' })//JSON.stringify(settings, null, 2), { width: settingsWidth, hardBreak: '' })
                ]);
            });
            return table.toString();
        });
}

function getQuestionsFromConfiguration(config, prevValues) {
    return Object.keys(config)
        .map(function(key) {
            var o = Object.assign({ name: key }, config[key]);
            if (o.type !== 'password') {
                if (o.hasOwnProperty('defaultValue')) {
                    o.default = o.defaultValue;
                    delete o.defaultValue;
                }
                if (prevValues && prevValues.hasOwnProperty(key)) o.default = prevValues[key];
            }
            return o;
        });
}

function loadConfigurationFile(config) {
    return Manager.loadConnectors().then(Configuration(config).load);
}