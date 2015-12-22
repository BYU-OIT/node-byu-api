"use strict";
var connector       = require('../bin/modules/connector');
var test            = require('tape');

test('valid definition', function(t) {
    var item;
    var config = {};

    connector.define('foo', connect, disconnect, config);
    item = connector.get('foo');

    t.equal(connector.exists('foo'), true, 'exists');
    t.equal(item.connect, connect, 'connect');
    t.equal(item.disconnect, disconnect, 'disconnect');
    t.equal(item.configuration, config, 'config');
    t.equal(connector.list().length, 1, '1 definition');

    t.end();
});

test('invalid definition', function(t) {

    if (!connector.exists('foo')) {
        connector.define('foo', connect, disconnect, {});
    }

    try {
        connector.define('foo', connect, disconnect, {});
    } catch (e) {
        t.equal(e.name, 'Connector', 'error type 1');
        t.equal(e.code, 'ECREATE', 'error code 1');
    }

    try {
        connector.define('bar', '', disconnect, {});
    } catch (e) {
        t.equal(e.name, 'Connector', 'error type 2');
        t.equal(e.code, 'ECREATE', 'error code 2');
    }

    try {
        connector.define('baz', connect, '', {});
    } catch (e) {
        t.equal(e.name, 'Connector', 'error type 3');
        t.equal(e.code, 'ECREATE', 'error code 3');
    }

    try {
        connector.define('bur', connect, disconnect, null);
    } catch (e) {
        t.equal(e.name, 'Connector', 'error type 4');
        t.equal(e.code, 'ECREATE', 'error code 4');
    }

    t.end();
});


function connect() {}
function disconnect() {}