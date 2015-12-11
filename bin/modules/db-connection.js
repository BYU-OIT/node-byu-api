var crypto              = require('crypto');
var connector           = require('./connector');
var file                = require('./file');
var path                = require('path');

var algorithm = 'aes-256-ctr';
var configPath = path.resolve(__dirname, '../db-connections');
var loadPromise;
var password = '4I%qvB$1@DTJ';
var store = {};


/**
 * Get a defined database connection.
 * @param {string} name
 * @returns {object}
 */
exports.get = function(name) {
    return store.hasOwnProperty(name) ? store[name] : void 0;
};

/**
 * Get a list of names for defined connections.
 * @returns {Array}
 */
exports.list = function() {
    return Object.keys(store);
};

/**
 * Load connections.
 * @returns {Promise}
 */
exports.load = function() {
    if (!loadPromise) {
        loadPromise = file.readFile(configPath, 'utf8')
            .then(function(encryptedData) {
                var decipher = crypto.createDecipher(algorithm, password);
                var dec = decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8');
                store = JSON.parse(dec);
            })
            .catch(function(e) {
                return {};
            });
    }
    return loadPromise;
};

/**
 * Check to see if the connection file has loaded.
 */
Object.defineProperty(exports, 'loaded', {
    enumerable: true,
    configurable: false,
    get: function() {
        if (!loadPromise) return false;
        return loadPromise.isFulfilled;
    }
});

/**
 * Delete a defined connection from the store.
 * @param {string} connectionName
 */
exports.remove = function(connectionName) {
    delete store[connectionName];
};

/**
 * Set a connection's configuration.
 * @param {string} connectionName
 * @param {string} connectorName
 * @param {object} connectorConfig
 */
exports.set = function(connectionName, connectorName, connectorConfig) {
    store[connectionName] = {
        connector: connectorName,
        config: connectorConfig
    };
};

/**
 * Save the current store of connection configurations.
 * @returns {Promise|undefined}
 */
exports.save = function() {
    var content = JSON.stringify(store);
    var cipher = crypto.createCipher(algorithm, password);
    var crypted = cipher.update(content, 'utf8', 'hex') + cipher.final('hex');
    return file.writeFile(configPath, crypted, 'utf8');
};

/**
 * Test a defined connection.
 * @param {string} connectionName
 * @returns {Promise} that resolves to true or false.
 */
exports.test = function(connectionName) {
    var item = exports.get(name);
    if (!item) return Promise.resolve(false);
    return connector.test(item.connector, item.config);
};