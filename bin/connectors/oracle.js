"use strict";
var is                  = require('../util/is');
var oracleDb 	        = {};//require('oracledb');

module.exports = {
    name: 'oracle',
    pool: true,
    connect: function(config) {
        return new Promise(function(resolve, reject) {
            oracleDb.getConnection(config, function(err, conn) {
                var client;
                var manager;

                if (err) return reject(err);

                client = {                    
                    break: Promise.promisify(conn.break, {context: oracleDb}),
                    commit: Promise.promisify(conn.commit, {context: oracleDb}),
                    execute: Promise.promisify(conn.execute, {context: oracleDb}),
                    rollback: Promise.promisify(conn.rollback, {context: oracleDb})
                };

                manager = {
                    disconnect: conn => Promise.promisify(conn.release, {context: oracleDb}),
                    preRequest: conn => void 0,
                    postRequest: (conn, success) => success ? client.commit() : client.rollback(),
                    query: (conn, args) => conn.execute.apply(conn, args)
                };

                resolve({
                    client: client,
                    manager: manager
                });
            });
        });
    },
    options: {
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
        connectionString: {
            type: 'input',
            message: 'Connection string:',
            help: 'This value must be a string.',
            validate: is.string,
            required: true
        },
        externalAuth: {
            type: 'confirm',
            message: 'External authorization?',
            help: 'This value must be a boolean.',
            validate: is.boolean,
            defaultValue: false
        },
        stmtCacheSize: {
            type: 'input',
            message: 'Statement cache size:',
            help: 'This value must be a non-negative number.',
            defaultValue: 30,
            transform: round,
            validate: is.nonNegativeNumber
        }
    }
};

function round(value) {
    return Math.round(parseFloat(value));
}