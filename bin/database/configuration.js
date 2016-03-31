"use strict";
// This file has tools for managing the database database configuration files.
const Connector     = require('./connector');
const CustomError   = require('custom-error-instance');
const crypto        = require('crypto');
const file          = require('./../util/file');
const log           = require('../log/log');
const path          = require('path');
const Pool          = require('./pool');
const schemata      = require('object-schemata');

const algorithm = 'aes-256-ctr';
const Err = CustomError('DbConfigError');
Err.path = CustomError(Err, { code: 'EPATH', message: 'Required database file path not specified.' });
Err.pass = CustomError(Err, { code: 'EPASS' });
Err.noPass = CustomError(Err.pass, { message: 'File is encrypted and needs a password.' });
Err.wrongPass = CustomError(Err.pass, { message: 'Connection store password is incorrect.' });
Err.corrupt = CustomError(Err, { code: 'ECRPT', message: 'The specified connector file is corrupt.' });
Err.set = CustomError(Err, { code: 'ESET' });

module.exports = Configuration;

/**
 * Create a database factory.
 * @params {object} A database file configuration.
 * @returns {{ changePassword: function, get: function, list: function, load: function, remove: function, save: function, set: function }}
 */
function Configuration(configuration) {
    var config = Configuration.schema.normalize(configuration || {});
    var factory = Object.create(Configuration.prototype);
    var filePath;
    var password = '';
    var store = {};

    //get file path and password
    if (config.hasOwnProperty('password')) password = config.password;
    filePath = path.resolve(process.cwd(), config.dbFile);

    /**
     * Change the password on the configuration store file.
     * @param {string} newPassword
     * @returns {object}
     */
    factory.changePassword = function(newPassword) {
        password = newPassword;
        return factory;
    };

    /**
     * Get the entire configuration object or a single database configuration.
     * @param {string} [name] The name of the configuration to get.
     * @returns {object, undefined}
     */
    factory.get = function(name) {
        if (arguments.length === 0) return copy(store);
        return store.hasOwnProperty(name) ? copy(store[name]) : void 0;
    };

    /**
     * Get a list of names for defined configurations.
     * @returns {string[]}
     */
    factory.list = function() {
        return Object.keys(store);
    };

    /**
     * Load the configuration file.
     * @returns {Promise} that resolves to the factory.
     */
    factory.load = function() {
        return file.readFile(filePath, 'utf8')
            .catch(function(e) {
                if (e.code === 'ENOENT') return null;
                throw e;
            })
            .then(function(content) {
                const configuration = content ? decrypt(content, password) : {};
                log.info(content ? 'load' : 'create', filePath);
                store = {};
                Object.keys(configuration).forEach(function(name) {
                    var config = configuration[name];
                    factory.set(name, config.connector, config.config);
                });
                return factory;
            });
    };

    /**
     * Delete a defined configuration from the store.
     * @param {string} name
     * @returns {object}
     */
    factory.remove = function(name) {
        delete store[name];
        return factory;
    };

    /**
     * Save the file.
     * @returns {Promise} that resolves to the factory.
     */
    factory.save = function() {
        var content;
        content = encrypt(store, password);
        return file.writeFile(filePath, content, 'utf8')
            .then(function() {
                return factory;
            });
    };

    /**
     * Set a configuration.
     * @param {string} name The name of the configuration.
     * @param {string} connectorName The name of the connector.
     * @param {object} config A valid connector configuration for the connector specified.
     * @param {object} [poolConfig] A valid pool configuration.
     * @returns {object}
     */
    factory.set = function(name, connectorName, config, poolConfig) {
        var connector;

        if (!name || typeof name !== 'string') throw Err.set('Configuration name must be a string.');
        if (!connectorName || typeof connectorName !== 'string') throw Err.set('Configuration connectorName must be a string.');
        if (!config || typeof config !== 'object') throw Err.set('Property "config" must be an object for database: ' + name);
        if (poolConfig && typeof poolConfig !== 'object') throw Err.set('Property "poolConfig" must be an object for database: ' + name);

        connector = Connector.get(connectorName);
        config = connector.schema.normalize(config);
        poolConfig = poolConfig ? Pool.schema.normalize(poolConfig) : null;

        store[name] = {
            connector: connectorName,
            config: config,
            pool: poolConfig
        };

        return factory;
    };

    return factory;
}

Configuration.schema = schemata({
    dbFile: {
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

/**
 * Validate a full configuration object's format.
 * @param {object} config
 * @returns {boolean, Error} True on valid, error object if invalid.
 */
Configuration.validateFormat = function(config) {
    try {
        Object.keys(config).forEach(function (name) {
            var o = config[name];
            var connectorName = o.connector;
            var connectorConfig = o.config;
            var connector;

            if (!name || typeof name !== 'string') throw Err.set('Configuration name must be a string for: ' + name);
            if (!connectorName || typeof connectorName !== 'string') throw Err.set('Configuration connectorName must be a string for: ' + name);
            if (!connectorConfig || typeof connectorConfig !== 'object') throw Err.set('Property "config" must be an object for database: ' + name);

            connector = Connector.get(connectorName);
            connector.schema.normalize(connectorConfig);
        });
    } catch (e) {
        return e;
    }
    return true;
};

Object.defineProperty(Configuration, 'error', {
    enumerable: false,
    configurable: true,
    value: Err,
    writable: false
});



function copy(o) {
    return JSON.parse(JSON.stringify(o));
}

function decrypt(content, password) {
    var encrypted = /^[0-9a-f]+$/.test(content);
    var decipher;
    var decrypted;
    var rxStr = '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z';

    if (encrypted && !password) {
        throw new Err.noPass();
    }

    //decrypt the file if a password is provided
    if (password) {
        decipher = crypto.createDecipher(algorithm, password);
        try {
            decrypted = decipher.update(content, 'hex', 'utf8') + decipher.final('utf8');
        } catch (e) {
            throw new Err.wrongPass();
        }

        if (!new RegExp('^' + rxStr).test(decrypted) || !new RegExp(rxStr + '$').test(decrypted)) {
            throw new Err.wrongPass();
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
        throw new Err.corrupt();
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