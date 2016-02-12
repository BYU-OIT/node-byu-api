"use strict";
// A volatile in memory database for key value pairs. On disconnect all data is lost.

var Connector           = require('../database/connector');
var is                  = require('../util/is');

var allStores = {};

Connector.define({
    name: 'volatile',                               // the name of the connector
    pool: false,                                    // specify that the pool manager will not be used with this connector
    connect: connect,                               // specify how to get a connection
    options: {}                                     // configuration options specific to this connector
});

function connect(id, config) {
    var client;
    var manager;
    var store;

    if (!allStores.hasOwnProperty(id)) allStores[id] = {};
    store = allStores[id];

    client = {
        del: (key) => delete store[key],
        get: (key) => store[key],
        exists: (key) => store.hasOwnProperty(key),
        list: () => Object.keys(store),
        set: (key, value) => store[key] = value,
        wipe: () => store = {}
    };

    manager = {
        disconnect: () => {
            store = void 0;
            delete allStores[id]
        },
        query: () => void 0         // this connector is tied to the id, so query cannot be used and returns undefined
    };

    return {
        client: client,
        manager: manager
    }
}