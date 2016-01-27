"use strict";
var connector           = require('../modules/connector');
var is                  = require('../util/is');
var oracledb 	        = {};//require('oracledb');
var Promise             = require('bluebird');

connector.define('oracle', 'release',
    {
        user: {
            type: 'input',
            message: 'User:',
            help: 'This value must be a string.',
            validate: is.string,
            required: true
        },
        password: {
            type: 'password',
            message: 'Password:',
            help: 'This value must be a string.',
            validate: is.string,
            required: true
        },
        'connection-string': {
            type: 'input',
            message: 'Connection string:',
            help: 'This value must be a string.',
            validate: is.string,
            required: true
        },
        'auto-commit': {
            type: 'confirm',
            message: 'Auto commit:',
            help: 'This value must be a boolean.',
            validate: is.boolean,
            defaultValue: false
        },
        'connection-class': {
            type: 'input',
            message: 'Connection class:',
            help: 'This value must be a string.',
            validate: is.string,
            defaultValue: ''
        },
        'external-auth': {
            type: 'confirm',
            message: 'External authorization?',
            help: 'This value must be a boolean.',
            validate: is.boolean,
            defaultValue: false
        },
        'fetch-as-string': {
            type: 'checkbox',
            message: 'Fetch as string:',
            choices: ['Date', 'Number'],
            help: 'This value must be either "Array" or "Number".',
            validate: is.arrayEach(is.string),
            defaultValue: []
        },
        'max-rows': {
            type: 'input',
            message: 'Maximum rows:',
            filter: parseInt,
            help: 'This value must be a non-negative number.',
            validate: is.nonNegativeNumber,
            defaultValue: 100
        },
        'out-format': {
            type: 'list',
            message: 'Row format:',
            choices: ['Array', 'Object'],
            help: 'This value must be either "Array" or "Object".',
            validate: is.oneOf(['Array', 'Object']),
            defaultValue: 'Array'
        },
        'prefetch-rows': {
            type: 'input',
            message: 'Prefetch rows:',
            filter: parseInt,
            help: 'This value must be a non-negative number.',
            validate: is.nonNegativeNumber,
            defaultValue: 100
        },
        'statement-cache': {
            type: 'input',
            message: 'Statement cache:',
            filter: parseInt,
            help: 'This value must be a non-negative number.',
            validate: is.nonNegativeNumber,
            defaultValue: 30
        }
    },
    function connect(config) {
        return new Promise(function (resolve, reject) {
            try {
                oracledb.getConnection(config, function (err, conn) {
                    if (err) return reject(err);

                    var factory = {};

                    factory.break = Promise.promisify(conn.break, {context: oracledb});
                    factory.commit = Promise.promisify(conn.commit, {context: oracledb});
                    factory.execute = Promise.promisify(conn.execute, {context: oracledb});
                    factory.release = Promise.promisify(conn.release, {context: oracledb});
                    factory.rollback = Promise.promisify(conn.rollback, {context: oracledb});

                    factory.executeWithCommit = function () {
                        var results;
                        return factory.execute.apply(oracledb, arguments)
                            .then(function (data) {
                                results = data;
                                return factory.commit();
                            })
                            .then(function () {
                                return results;
                            });
                    };

                    resolve(factory);
                });
            } catch (e) {
                reject(e);
            }
        });
    }
);