"use strict";
// A volatile in memory database for key value pairs. On disconnect all data is lost.

var Connector           = require('../database/connector');
var is                  = require('../util/is');
var noop                = require('../util/noop');

var allStores = {};

Connector.define({
    name: 'volatile',                               // the name of the connector
    pool: false,                                    // specify that the pool manager will not be used with this connector
    connect: connect,                               // specify how to get a connection
    options: {}                                     // configuration options specific to this connector
});

function connect(config) {
    var client;
    var manager;
    var store;

    client = {
        del: (key) => delete store[key],
        get: (key) => store[key],
        exists: (key) => store.hasOwnProperty(key),
        list: () => Object.keys(store),
        set: (key, value) => store[key] = value,
        wipe: () => store = {}
    };

    manager = {
        disconnect: () => store = void 0,
        preRequest: () => store = {},
        postRequest: () => store = void 0,
        query: (key) => client.get(key)
    };

    return {
        client: client,
        manager: manager
    }
}