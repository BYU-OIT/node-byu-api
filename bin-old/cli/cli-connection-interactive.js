var cli             = require('./../../bin/util/cli');
var cliConnection   = require('./cli-connection');
var connector       = require('../../bin/connection/connector');
var inquirer        = require('inquirer');
var requireDir      = require('../../bin/util/require-directory');

/**
 * Set the terminal into interactive mode.
 * @param dbConn The connection file factory.
 * @returns {Promise}
 */
module.exports = function(dbConn) {
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
                if (item) throw new Error('A connection configuration with that name already exists.');
                return menu.edit(answers.name);
            });
    };

    menu.edit = function(name, connectorConfig) {
        var connectorName;

        function test(config) {
            return cliConnection.connectionTest(name, config)
                .then(function() {
                    console.log('Connection successful');
                })
                .catch(function(e) {
                    var message = 'Could not connect: ' + e.message;
                    return cli.choices(message, ['Re-enter', 'Retry', 'Ignore'])
                        .then(function(answer) {
                            switch (answer.toLowerCase()) {
                                case 're-enter': return menu.edit(name, config);
                                case 'retry': return test(config);
                                case 'ignore': return;
                            }
                        });
                });
        }

        return cli.choices('Connector:', connector.list())
            .then(function(connectorName) {
                return cli.prompt(cliConnection.questions(connectorName, connectorConfig))
                    .then(function(config) {
                        dbConn.set(name, connectorName, config);
                        changes = true;
                        return test(config);
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
        return cliConnection.connectionStatus(dbConn)
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
};