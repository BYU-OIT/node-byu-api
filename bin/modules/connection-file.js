"use strict";
// This file has tools for managing the database connection configuration files.

var clc             = require('../cli/clc');
var chalk           = require('chalk');
var connector       = require('./connector');
var customError     = require('./custom-error');
var crypto          = require('crypto');
var file            = require('./file');
var format          = require('cli-format');
var path            = require('path');

const algorithm = 'aes-256-ctr';
const ConnFileError = customError('ConnectionFile', {
    corrupt: 'corrupt',
    path: 'path',
    password: 'pass'
});

module.exports = connectionFile;

/**
 * Create a connection factory.
 * @params {object} A connection file configuration.
 * @returns {Promise}
 */
function connectionFile(configuration) {
    var config = clc.options.camelCase(clc.options.normalize(connectionFile.options, configuration, true));
    var factory = {};
    var filePath;
    var fileDoesNotExist = false;
    var hasFilePath = config.hasOwnProperty('connectionFile');
    var password = '';
    var store = {};

    //get file path and password
    if (config.hasOwnProperty('connectionPass')) password = config.connectionPass;
    filePath = config.connectionFile;

    /**
     * Change the password on the configuration store file.
     * @param {string} newPassword
     */
    factory.changePassword = function(newPassword) {
        password = newPassword;
    };

    /**
     * Get a defined database connection.
     * @param {string} name
     * @returns {object}
     */
    factory.get = function(name) {
        return store.hasOwnProperty(name) ? store[name] : void 0;
    };

    /**
     * Get a list of names for defined connections.
     * @returns {string[]}
     */
    factory.list = function() {
        return Object.keys(store);
    };

    /**
     * Determine whether this file existed when the factory was returned.
     * @returns {boolean}
     */
    factory.noFile = function() {
        return fileDoesNotExist;
    };

    /**
     * Delete a defined connection from the store.
     * @param {string} connectionName
     */
    factory.remove = function(connectionName) {
        delete store[connectionName];
    };

    /**
     * Save the file.
     * @returns {Promise}
     */
    factory.save = function() {
        var content;
        if (!hasFilePath) throw new ConnFileError.path('Required connection file path not specified.');
        content = encrypt(store, password);
        return file.writeFile(filePath, content, 'utf8');
    };

    /**
     * Set a connection's configuration.
     * @param {string} connectionName
     * @param {string} connectorName
     * @param {object} connectorConfig
     */
    factory.set = function(connectionName, connectorName, connectorConfig) {
        store[connectionName] = {
            connector: connectorName,
            config: connectorConfig
        };
    };

    //attempt to load the file and decrypt it
    return !hasFilePath ?
        Promise.resolve(factory) :
        file.readFile(filePath, 'utf8')
            .catch(function(e) {
                if (e.code === 'ENOENT') {
                    fileDoesNotExist = true;
                    return null;
                }
                throw e;
            })
            .then(function(content) {
                store = content ? decrypt(content, password) : {};
                return factory;
            });
}

connectionFile.options = {
    'connection-file': {
        alias: 'd',
        type: String,
        description: 'The path to the database connection configuration file. If omitted then there will be no ' +
        'automated database connection handling.',
        group: 'connection'
    },
    'connection-pass': {
        alias: 'e',
        type: String,
        description: 'If the database connection configuration file is encrypted then you can provide the ' +
        'decrypt password with this argument.',
        group: 'connection'
    }
};



function decrypt(content, password) {
    var encrypted = /^[0-9a-f]+$/.test(content);
    var decipher;
    var decrypted;
    var rxStr = '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z';

    if (encrypted && !password) {
        throw new ConnFileError.password('File is encrypted and needs a password.');
    }

    //decrypt the file if a password is provided
    if (password) {
        decipher = crypto.createDecipher(algorithm, password);
        try {
            decrypted = decipher.update(content, 'hex', 'utf8') + decipher.final('utf8');
        } catch (e) {
            throw new ConnFileError.password('Connection store password is incorrect.');
        }

        if (!RegExp('^' + rxStr).test(decrypted) || !RegExp(rxStr + '$').test(decrypted)) {
            throw new ConnFileError.password('Connection store password is incorrect.');
        } else {
            decrypted = decrypted.substring(24, decrypted.length - 24);
        }

    } else {
        decrypted = content;
    }

    //parse the content as JSON
    try {
        return JSON.parse(decrypted);
    } catch (e) {
        throw new ConnFileError.corrupt('The specified connector file is corrupt.');
    }
}

function encrypt(config, password) {
    var cipher;
    var content = JSON.stringify(config);
    var date = new Date().toISOString();
    var output;

    if (password) {
        cipher = crypto.createCipher(algorithm, password);
        output = cipher.update(date + content + date, 'utf8', 'hex') + cipher.final('hex');
    } else {
        output = content;
    }

    return output;
}