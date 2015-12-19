"use strict";
var clc                 = require('../cli/clc');
var connector           = require('../modules/connector');
var oracledb 	        = {};//require('oracledb');
var Promise             = require('bluebird');
var promiseOption       = require('../modules/promise-option');

var oracleOptions = {
    user: {
        type: String,
        question_type: 'input',
        message: 'User:',
        description: 'The user name to use to connect to the database.',
        required: true
    },
    password: {
        type: String,
        question_type: 'password',
        message: 'Password:',
        description: 'The password to use to connect to the database.',
        required: true
    },
    'connection-string': {
        type: String,
        question_type: 'input',
        message: 'Connection string:',
        description: 'The database connection string.',
        required: true
    },
    'auto-commit': {
        type: Boolean,
        question_type: 'confirm',
        message: 'Auto commit:',
        description: 'If set to true then transactions are automatically committed at the end of statement execution.',
        defaultValue: false
    },
    'connection-class': {
        type: String,
        question_type: 'input',
        message: 'Connection class:',
        description: 'A logical name for connections, used to separate sessions.',
        defaultValue: ''
    },
    'external-auth': {
        type: Boolean,
        question_type: 'confirm',
        message: 'External authorization?',
        description: 'Whether to use external authorization.',
        defaultValue: false
    },
    'fetch-as-string': {
        type: Array,
        question_type: 'checkbox',
        message: 'Fetch as string:',
        description: 'Specify which data types to get as strings from the database.',
        choices: ['Date', 'Number'],
        defaultValue: []
    },
    'max-rows': {
        type: Number,
        question_type: 'input',
        message: 'Maximum rows:',
        description: 'The maximum number of rows to return from a query.',
        help: 'If you expect a large or unknown number of results, you may want to look into the ResultSet option.',
        defaultValue: 100
    },
    'out-format': {
        type: String,
        question_type: 'list',
        message: 'Row format:',
        description: 'The format of each row from a query.',
        choices: ['Array', 'Object'],
        defaultValue: 'Array'
    },
    'prefetch-rows': {
        type: Number,
        question_type: 'input',
        message: 'Prefetch rows:',
        description: 'The number rows to prefetch when using a ResultSet.',
        defaultValue: 100
    },
    'statement-cache': {
        type: Number,
        question_type: 'input',
        message: 'Statement cache:',
        description: 'The number statements that are cached in the statement cache of each connection.',
        defaultValue: 30
    }
};

connector.define('oracle', connect, disconnect, oracleOptions);

function connect(configuration, callback) {
    var config = {};
    oracledb.getConnection(config, function(err, conn) {
        if (err) return callback(err, null);

        var factory = {};

        factory.break = promiseOption(oracledb, conn.break);
        factory.commit = promiseOption(oracledb, conn.commit);
        factory.execute = promiseOption(oracledb, conn.execute);
        factory.rollback = promiseOption(oracledb, conn.rollback);

        factory.executeWithCommit = promiseOption(oracledb, function() {
            var args = [];
            var callback;
            var i;

            for (i = 0; i < arguments.length; i++) args.push(arguments[i]);
            callback = args.pop();
            args.push(function(err, data) {
                if (err) return callback(err, null);
                conn.commit(function(err) {
                    if (err) return callback(err, null);
                    callback(null, data);
                });
            });

            conn.execute.apply(oracledb, args)
        });

        Object.defineProperty(factory, '__connection', {
            enumerable: false,
            configurable: false,
            get: function() {
                return conn;
            }
        });

        callback(null, factory);
    });
}

function disconnect(conn, callback) {
    conn.__connection.release(callback);
}