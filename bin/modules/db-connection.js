var chalk           = require('chalk');
var connector       = require('./connector');
var crypto          = require('crypto');
var file            = require('./file');
var format          = require('cli-format');
var NoStackError    = require('./no-stack-error');
var path            = require('path');
var Table           = require('cli-table2');

const algorithm = 'aes-256-ctr';

module.exports = Connection;

/**
 * Create a connection factory.
 * @params {string} filePath The file path of the store to load data from and save data to.
 * @params {string} [password=''] The password to use to encrypt and decrypt data.
 * @returns {Promise}
 */
function Connection(filePath, password) {
    var factory = {};
    var store = {};

    if (!password) password = '';
    filePath = resolvePath(filePath);


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
     * @returns {Array}
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
        var content = encrypt(store, password);
        return file.writeFile(filePath, content, 'utf8');
    };

    /**
     * Get a formatted list of connections and their status.
     * @returns {Promise}
     */
    factory.status = function() {
        return status(factory);
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

    /**
     * Test if the connection works.
     * @param connectionName
     * @returns {*}
     */
    factory.test = function(connectionName) {
        if (!store.hasOwnProperty(connectionName)) return Promise.reject(new Error('Connection ' + connectionName + ' not defined.'));
        return connector.load()
            .then(function() {
                return connector.test(store[connectionName].connector, store[connectionName].config);
            });
    };

    //attempt to load the file and decrypt it
    return file.readFile(filePath, 'utf8')
        .catch(function(e) {
            if (e.code === 'ENOENT') return '{}';
            throw e;
        })
        .then(function(content) {
            store = decrypt(content, password);
            return factory;
        });
}



function decrypt(content, password) {
    var decipher;
    var decrypted;
    var rxStr = '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z';

    //decrypt the file if a password is provided
    if (password) {
        decipher = crypto.createDecipher(algorithm, password);
        try {
            decrypted = decipher.update(content, 'hex', 'utf8') + decipher.final('utf8');
        } catch (e) {
            throw new NoStackError('Connection store password is incorrect.');
        }

        if (!RegExp('^' + rxStr).test(decrypted) || !RegExp(rxStr + '$').test(decrypted)) {
            throw new NoStackError('Connection store password is incorrect.');
        } else {
            decrypted = decrypted.substring(24, decrypted.length - 24);
        }

    } else {
        decrypted = content;
    }

    //parse the content as JSON
    return JSON.parse(decrypted);
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

function status(dbConn) {
    var headings;
    var table;
    var settingsWidth;
    var widths;

    headings = [
        chalk.white.bold('Name'),
        chalk.white.bold('Type'),
        chalk.white.bold('OK'),
        chalk.white.bold('Settings')
    ];

    widths = [16, 16, 7, null];

    settingsWidth = widths.reduce(function(prev, curr) {
        return prev - (curr || 0) - 1;
    }, format.config.config.availableWidth - 3);

    table = new Table({
        head: headings,
        colWidths: widths
    });

    return connector.load()
        .then(function() {
            var list;
            var promises = [];

            //get a list of defined connections
            list = dbConn.list()
                .map(function(name) {
                    var item = dbConn.get(name);
                    return {
                        name: name,
                        connector: item.connector,
                        config: item.config
                    };
                });

            //if there are no connections then output result and exit
            if (list.length === 0) {
                console.log(format.wrap(chalk.italic('There are no defined connections.')) + '\n');
                return;
            }

            //test each connection
            list.forEach(function(item, index) {
                var promise = connector.test(item.connector, item.config)
                    .then(function() {
                        list[index].connected = chalk.green('\u2714 Yes');
                    })
                    .catch(function() {
                        list[index].connected = chalk.red('\u2718 NO');
                    });
                promises.push(promise);
            });

            return Promise.all(promises)
                .then(function() {
                    list.forEach(function(item) {
                        table.push([
                            format.wrap(item.name, { width: widths[0] - 3 }),
                            format.wrap(item.connector, { width: widths[1] - 3 }),
                            format.wrap(item.connected, { width: widths[2] - 3 }),
                            format.wrap(JSON.stringify(connector.settings(item.connector, item.config) || {}, null, 2), { width: settingsWidth, hardBreak: '' })
                        ]);
                    });
                    return table.toString();
                });
        });
}

/**
 * Take a file path and resolve it to it's absolute path.
 * @param {string} filePath
 * @returns {string}
 */
function resolvePath(filePath) {
    return path.resolve(process.cwd(), filePath)
}