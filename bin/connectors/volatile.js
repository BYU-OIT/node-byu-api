"use strict";
// A volatile in memory database for key value pairs. After request all data is lost.

module.exports = {
    name: 'volatile',
    pool: false,
    connect: function connect() {
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
    },
    options: {}
};

