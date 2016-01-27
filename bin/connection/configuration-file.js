"use strict";
// This file has tools for managing the database connection configuration files.

var CustomError     = require('custom-error-instance');
var crypto          = require('crypto');
var file            = require('./../util/file');
var path            = require('path');
var schemata        = require('object-schemata');

const algorithm = 'aes-256-ctr';
const ConnFileError = CustomError('ConnectionFileError');
ConnFileError.path = CustomError({ code: 'EPATH', message: 'Required connection file path not specified.' });
ConnFileError.pass = CustomError({ code: 'EPASS' });
ConnFileError.corrupt = CustomError({ code: 'ECRPT', message: 'The specified connector file is corrupt.' });

module.exports = configurationFile;

/**
 * Create a connection factory.
 * @params {object} A connection file configuration.
 * @returns {Promise}
 */
function configurationFile(configuration) {
    var config = configurationFile.schema.normalize(configuration);
    var factory = {};
    var filePath;
    var password = '';
    var store = {};

    //get file path and password
    if (config.hasOwnProperty('password')) password = config.password;
    filePath = path.resolve(process.cwd(), config.file);

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
        content = encrypt(store, password);
        return file.writeFile(filePath, content, 'utf8');
    };

    /**
     * Set a connection's configuration.
     * @param {string} connectionName
     * @param {object} configuration
     */
    factory.set = function(connectionName, configuration) {
        store[connectionName] = configuration;
    };

    //attempt to load the file and decrypt it
    return file.readFile(filePath, 'utf8')
        .catch(function(e) {
            if (e.code === 'ENOENT') return null;
            throw e;
        })
        .then(function(content) {
            store = content ? decrypt(content, password) : {};
            return factory;
        });
}

configurationFile.schema = schemata({
    file: {
        help: 'This value must be a string.',
        required: true,
        validate: function(value, is) {
            return is.string(value) && value.length > 0;
        }
    },
    password: {
        help: 'This value must be a string.',
        required: false,
        validate: function(value, is) {
            return is.string(value);
        }
    }
});

Object.defineProperty(configurationFile, 'error', {
    enumerable: false,
    configurable: true,
    value: ConnFileError,
    writable: false
});
















function decrypt(content, password) {
    var encrypted = /^[0-9a-f]+$/.test(content);
    var decipher;
    var decrypted;
    var rxStr = '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z';

    if (encrypted && !password) {
        throw new ConnFileError.pass('File is encrypted and needs a password.');
    }

    //decrypt the file if a password is provided
    if (password) {
        decipher = crypto.createDecipher(algorithm, password);
        try {
            decrypted = decipher.update(content, 'hex', 'utf8') + decipher.final('utf8');
        } catch (e) {
            throw new ConnFileError.pass('Connection store password is incorrect.');
        }

        if (!RegExp('^' + rxStr).test(decrypted) || !RegExp(rxStr + '$').test(decrypted)) {
            throw new ConnFileError.pass('Connection store password is incorrect.');
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
        throw new ConnFileError.corrupt();
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