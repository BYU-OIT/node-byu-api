"use strict";
var Connector           = require('../database/connector');
var is                  = require('../util/is');
var oracleDb 	        = {};//require('oracledb');
var Promise             = require('bluebird');

module.exports = OracleConnection;

function OracleConnection(config) {
    return new Promise(function (resolve, reject) {
        try {
            oracleDb.createPool(config, function(err, pool) {
                var factory;
                if (err) return reject(err);

                factory = {};

                factory.getConnection = function() {
                    return new Promise(function(resolve, reject) {
                        pool.getConnection(function(err, conn) {
                            if (err) return reject(err);
                            var factory = {};

                            factory.break = Promise.promisify(conn.break, {context: oracleDb});
                            factory.commit = Promise.promisify(conn.commit, {context: oracleDb});
                            factory.execute = Promise.promisify(conn.execute, {context: oracleDb});
                            factory.release = Promise.promisify(conn.release, {context: oracleDb});
                            factory.rollback = Promise.promisify(conn.rollback, {context: oracleDb});

                            resolve(factory);
                        });
                    });
                };

                factory.terminate = Promise.promisify(pool.terminate, {context: oracleDb});

                resolve(factory);
            });
        } catch (e) {
            reject(e);
        }
    });
}

OracleConnection.options = {
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
    },
    poolIncrement: {
        type: 'input',
        message: 'Pool increment:',
        help: 'This value must be a positive number.',
        defaultValue: 1,
        transform: round,
        validate: function(v) { return is.positiveNumber(round(v)); }
    },
    poolMax: {
        type: 'input',
        message: 'Maximum pool size:',
        help: 'This value must be a non-negative number.',
        defaultValue: 4,
        transform: round,
        validate: is.nonNegativeNumber
    },
    poolMin: {
        type: 'input',
        message: 'Minimum pool size:',
        help: 'This value must be a non-negative number.',
        defaultValue: 0,
        transform: round,
        validate: is.nonNegativeNumber
    },
    poolTimeout: {
        type: 'input',
        message: 'Pool timeout (in seconds):',      // The number of seconds before an idle connection will be closed
        defaultValue: 60,
        transform: parseInt,
        validate: is.nonNegativeNumber
    }
};

function round(value) {
    return Math.round(parseFloat(value));
}

Connector.define({
    name: 'oracle',
    options: OracleConnection.options,
    factory: OracleConnection,
    connect: function() {
        return this.getConnection();
    },
    disconnect: function(conn) {
        return conn.release();
    },
    exit: function() {
        return this.terminate();
    }
});