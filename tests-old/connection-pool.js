"use strict";
var manager             = require('./modules/connection-pool');
var Promise             = require('bluebird');
var test                = require('tape');

var options = {
    'fail-connect': {
        type: Boolean,
        question_type: 'confirm',
        message: 'Fail:',
        description: 'Set to true to fail when attempting to connect.',
        defaultValue: false
    }
};

function connect(config, callback) {
    setTimeout(function() {
        if (config.fail) {
            callback(new Error('Failed to connect'), null);
        } else {
            callback(null, {
                add: function(a, b) { return a + b }
            });
        }
    }, config.timeout || 100);
}

function disconnect(conn, callback) {
    delete conn.add;
    callback(null);
}


test('Manager has accessors', function(t) {

    var m = manager(connect, disconnect, { fail: false }, {});
    t.equal(typeof m.available, 'number', 'has available property');
    t.equal(typeof m.connect, 'function', 'has connect function');
    t.equal(typeof m.disconnect, 'function', 'has disconnect function');
    t.equal(typeof m.immediate, 'number', 'has immediate property');
    t.equal(typeof m.multiConnect, 'function', 'has multiConnect function');
    t.equal(typeof m.terminate, 'function', 'has connect function');

    t.end();
});

test('Manager accessor functions accept callbacks', function(t) {
    var m = manager(connect, disconnect, { fail: false }, {});

    t.plan(3);

    m.connect(function(err, conn) {
        t.pass('connected');

        m.disconnect(conn, function(err) {
            t.ok(!err, 'disconnected');
        });

        m.terminate(function(err) {
            t.ok(!err, 'terminated');
        });
    });
});

test('Manager accessor functions return promises', function(t) {
    var m = manager(connect, disconnect, { fail: false }, {});

    t.plan(3);

    m.connect()
        .then(function(conn) {
            t.pass('connected');
            m.disconnect(conn).then(function() {
                t.pass('disconnected');
            });
            m.terminate().then(function() {
                t.pass('terminated');
            });
        });
});



test('Manager connection availability and pooling', function(t) {
    var m = manager(connect, disconnect, { fail: false }, {
        'pool-min': 2,
        'pool-max': 8,
        'pool-increment': 2,
        'terminate-grace': 1
    });

    t.plan(9);

    t.equal(m.available, 8, 'All available');

    m.connect()
        .then(function(conn) {
            t.equal(m.available, 7, '7 available');
            return m.multiConnect(4);
        })
        .then(function(connAr) {
            t.equal(m.available, 3, '3 available');
            return m.multiConnect(3);
        })
        .then(function(connAr) {
            t.equal(m.available, 0, '0 available');
            return m.disconnect(connAr[0]);
        })
        .then(function() {
            t.equal(m.available, 1, '1 available');
            return m.multiConnect(2);
        })
        .catch(function(e) {
            t.equal(e.name, 'ConnectionPool', 'error type');
            t.equal(e.code, 'ELIMIT', 'ELIMIT code');
        })
        .then(function() {
            return m.terminate();
        })
        .then(function() {
            return m.connect();
        })
        .catch(function(e) {
            t.equal(e.name, 'ConnectionPool', 'error type');
            t.equal(e.code, 'ETERM', 'ETERM code');
        });
});

test('Manager connection timeout', function(t) {
    var m = manager(connect, disconnect, { timeout: 100, fail: false }, {
        'connect-timeout': .05
    });

    t.plan(2);

    m.connect()
        .then(function(conn) {
            t.fail('should have timed out');
        })
        .catch(function(e) {
            t.equal(e.name, 'ConnectionPool', 'error type');
            t.equal(e.code, 'ETIMEOUT', 'error code');
        })
        .then(function() {
            return m.terminate();
        });
});

test('Manager connection fail', function(t) {
    var m = manager(connect, disconnect, { fail: true }, {
        'pool-min': 2,
        'pool-max': 8,
        'pool-increment': 2
    });

    t.plan(1);

    m.connect()
        .then(function(conn) {
            t.fail('should have failed');
        })
        .catch(function(e) {
            t.equal(e.message, 'Failed to connect', 'expected error');
        })
        .then(function() {
            return m.terminate();
        });
});

test('Manager idle connection disconnect', function(t) {
    var m = manager(connect, disconnect, { }, {
        'pool-increment': 1,
        'pool-timeout': .05
    });

    t.plan(3);

    m.connect()
        .then(function(conn) {
            t.pass(m.immediate, 0, 'connection made');
            return m.disconnect(conn);
        })
        .then(function() {
            t.equal(m.immediate, 1, 'connection released');
            return Promise.delay(100);
        })
        .then(function() {
            t.equal(m.immediate, 0, 'idle disconnected');
        })
        .then(function() {
            return m.terminate();
        });
});

test('Manager can terminate while in use', function(t) {
    var m1 = manager(connect, disconnect, { fail: false }, {});
    var m2 = manager(connect, disconnect, { fail: false }, {});

    t.plan(4);

    m1.connect()
        .then(function(conn) {
            var promise;
            t.pass('connected');
            promise = m1.terminate();
            setTimeout(function() {
                t.ok(conn.add, 'still connected after soft terminate');
                m1.disconnect(conn);
            }, 100);
            return promise;
        });

    m2.connect()
        .then(function(conn) {
            t.pass('connected');
            return m2.terminate(true)
                .then(function() {
                    return conn;
                });
        })
        .then(function(conn) {
            t.ok(!conn.add, 'not connected after hard terminate');
        });
});
