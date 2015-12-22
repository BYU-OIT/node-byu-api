
var customError     = require('./custom-error');

var ConnectorError = customError('Connector', {
    cantCreate: 'create'
});

var store = {};

/**
 * Define a connector.
 * @param {string} name The name of the connector
 * @param {function} connect The function to call with configuration
 * data to create a connection.
 * @param {function} disconnect The function to call to disconnect.
 * @param {object} configuration An object map of command line args and questions, used by the inquirer
 * cli to manage connections and by the command-line-usage to output help.
 */
exports.define = function(name, connect, disconnect, configuration) {

    //validate parameters
    if (exports.exists(name)) throw new ConnectorError.cantCreate('A Connector with this name already exists: ' + name);
    if (typeof name !== 'string') throw new ConnectorError.cantCreate('connector.define expects the first parameter to be a string. Received: ' + name);
    if (typeof connect !== 'function') throw new ConnectorError.cantCreate('connector.define expects the second parameter to be a function. Received: ' + connect);
    if (typeof disconnect !== 'function') throw new ConnectorError.cantCreate('connector.define expects the third parameter to be a function. Received: ' + disconnect);
    if (typeof configuration !== 'object' || !configuration) throw new ConnectorError.cantCreate('connector.define expects the fourth parameter to be an object. Received: ' + configuration);

    //store the connector
    store[name] = {
        connect: connect,
        disconnect: disconnect,
        configuration: configuration
    };
};

/**
 * Determine if a connector is defined.
 * @param {string} name The name of the connector.
 * @returns {boolean}
 */
exports.exists = function(name) {
    return store.hasOwnProperty(name);
};

/**
 * Get an existing connector object.
 * @param {string} name The name of the connector to get.
 * @returns {object}
 */
exports.get = function(name) {
    return store[name];
};

/**
 * List all of the connectors that have been defined.
 * @returns {string[]}
 */
exports.list = function() {
    return Object.keys(store);
};