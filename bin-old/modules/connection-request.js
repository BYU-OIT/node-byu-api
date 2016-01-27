"use strict";
// The purpose of this file is to manage database connection requests and releases.
var connector       = require('./../../bin/connection/connector');
var pool            = require('./connection-pool');

var store = {};

module.exports = function(dbConfig) {
    var connectionMap = {};

    // TODO: separate the database configuration from the connection pool configuration when saving to the config file
    // TODO: set up pooling for each connection from the database configuration

    //get a connection pool for each defined connection in the configuration
    dbConfig.list().forEach(function(name) {
        var config = dbConfig.get(name);
        var conn = connector.get(config.connector);
        var connectConfig = connector.normalizeConfiguration(config.connector, config.config);

        connectionMap[name] = pool(item.connect, item.disconnect, item.connectConfig, item.poolConfig);
    });

    return function(requestId) {
        var factory = {};

        //register this ID
        store[requestId] = factory;

        factory.connectionMap = function() {
            //TODO: create a map that will put the user into an indefinite pending state until their request is ready
            //The connection request is to be prioritized not by when it was made, but by when the creation of the
            //factory occurred. This will prevent unfulfilled dependency lock when two requests are asking for the
            //same resource and waiting on the other to release those resources
        };

        factory.done = function() {
            delete store[requestId];

            //TODO: release connections
        };

        return factory;
    }
};