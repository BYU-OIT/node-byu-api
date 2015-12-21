var clc             = require('./clc');
var cliConnection   = require('./cli-connection-interactive');
var connFile        = require('../modules/connection-file');
var NoStackError    = require('../modules/no-stack-error');

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




function define(err, options) {
    if (err || options.help) return;
    connFile(options.store, options.password)
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
        .catch(NoStackError.catch);
}

function interactiveTerminal(err, options) {
    var dbConn;
    if (err || options.help) return;
    connFile(options.store, options.password)
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
    connFile(options.store, options.password)
        .then(function(dbConn) {
            return dbConn.status();
        })
        .then(function(status) {
            console.log(status);
        });
}

function password(err, options) {
    if (err || options.help) return;
    connFile(options.store, options['old-password'])
        .then(function(dbConn) {
            dbConn.changePassword(options.password);
            return dbConn.save();
        })
        .then(function() {
            console.log('Password changed.');
        })
        .catch(NoStackError.catch);
}

function remove(err, options) {
    if (err || options.help) return;
    connFile(options.store, options.password)
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