"use strict";
var expect          = require('chai').expect;
var Pool            = require('../../bin/database/pool');
var Promise         = require('bluebird');


describe('database/pool', function() {

    describe('pool', function() {

        it('is a function', function() {
            var p = Pool(connect, {});
            expect(p).to.be.a('function');
        });

        it('has available', function() {
            var p = Pool(connect, {});
            expect(p.available).to.be.a('number');
        });

        it('has immediate', function() {
            var p = Pool(connect, {});
            expect(p.immediate).to.be.a('number');
        });

        it('has poolSize', function() {
            var p = Pool(connect, {});
            expect(p.poolSize).to.be.a('number');
        });

        it('returns a promise 1', function() {
            var p = Pool(connect, {});
            expect(p()).to.be.instanceof(Promise);
        });

        it('returns a promise 2', function() {
            var p = Pool(connectPromise(0), {});
            expect(p()).to.be.instanceof(Promise);
        });

    });

    describe('timeout', function() {

        it('time out', function() {
            var p = Pool(connectPromise(100), { connectTimeout: .05 });
            return p()
                .catch(function(e) {
                    expect(e).to.be.instanceof(Pool.error.timeout);
                });
        });

        it('does not time out', function() {
            var p = Pool(connectPromise(50), { connectTimeout: .1 });
            return p()
                .then(function(conn) {
                    expect(conn.disconnect).to.be.a('function');
                });
        });

    });

});

function connect() {
    var connected = true;
    var client = {
        run: function(input) {
            if (!connected) throw Error('Disconnected');
            return 'Ran ' + input;
        }
    };
    var manager = {
        disconnect: function() {
            connected = false;
        },
        query: client.run
    };

    return {
        client: client,
        manager: manager
    }
}

function connectPromise(delay) {
    return function() {
        return Promise.delay(delay).then(() => connect());
    }
}


/*
var connector       = require('../../bin/connection/connector');
var expect          = require('chai').expect;
var Pool            = require('../../bin/connection/pool');
var Promise         = require('bluebird');

describe('database/pool', function() {





    describe('pool size', function() {

        before(function() {
            connector.define('size', 'disconnect', {}, function(config) {
                var factory = {};
                factory.disconnect = function() {};
                return factory;
            });
        });

        after(function() {
            connector.remove('size');
        });

        it('increment 1', function() {
            var p = Pool('size', {}, { poolIncrement: 1, poolMax: 4 });
            return p.connect()
                .then(function(conn) {
                    expect(p.available).to.be.equal(3);
                    expect(p.immediate).to.be.equal(0);
                    return conn.disconnect();
                })
                .then(function(conn) {
                    expect(p.available).to.be.equal(4);
                    expect(p.immediate).to.be.equal(1);
                });
        });

        it('increment 2', function() {
            var p = Pool('size', {}, { poolIncrement: 2, poolMax: 4 });
            return p.connect()
                .then(function(conn) {
                    expect(p.available).to.be.equal(3);
                    expect(p.immediate).to.be.equal(1);
                    return conn.disconnect();
                })
                .then(function() {
                    expect(p.available).to.be.equal(4);
                    expect(p.immediate).to.be.equal(2);
                });
        });

        it('increment 3', function() {
            var p = Pool('size', {}, { poolIncrement: 3, poolMax: 4 });
            return p.connect()
                .then(function() {
                    expect(p.available).to.be.equal(3);
                    expect(p.immediate).to.be.equal(2);
                    return Promise.join(p.connect(), p.connect());
                })
                .then(function() {
                    expect(p.available).to.be.equal(1);
                    expect(p.immediate).to.be.equal(0);
                    return p.connect();
                })
                .then(function() {
                    expect(p.available).to.be.equal(0);
                    expect(p.immediate).to.be.equal(0);
                });
        });

    });

    describe('max size', function() {

        before(function () {
            connector.define('max', 'disconnect', {}, function (config) {
                var factory = {};
                factory.disconnect = function () {
                };
                return factory;
            });
        });

        after(function () {
            connector.remove('max');
        });

        it('within max', function() {
            var p = Pool('max', {}, { poolMax: 2 });
            return p.connect()
                .then(function() {
                    expect(p.available).to.be.equal(1);
                    return p.connect();
                })
                .then(function() {
                    expect(p.available).to.be.equal(0);
                });
        });

        it('overflow max', function() {
            var p = Pool('max', {}, { poolMax: 1 });
            return p.connect()
                .then(function() {
                    expect(p.available).to.be.equal(0);
                    return p.connect();
                })
                .catch(function(e) {
                    expect(e).to.be.instanceof(Pool.error.limit);
                });
        });

    });

    describe('min and pool timeout', function() {
        before(function () {
            connector.define('min', 'disconnect', {}, function (config) {
                var factory = {};
                factory.disconnect = function () {
                };
                return factory;
            });
        });

        after(function () {
            connector.remove('min');
        });

        it('initialize to min', function() {
            var p = Pool('min', {}, { poolMin: 2, poolMax: 4 });
            return Promise.delay(5)
                .then(function() {
                    expect(p.available).to.be.equal(4);
                    expect(p.immediate).to.be.equal(2);
                });
        });

        it('idle timeout', function() {
            var p = Pool('min', {}, { poolMin: 1, poolMax: 4, poolIncrement: 3, poolTimeout: .05 });
            return Promise.delay(5)
                .then(function() {
                    expect(p.available).to.be.equal(4);
                    expect(p.immediate).to.be.equal(3);
                    return Promise.delay(100);
                })
                .then(function() {
                    expect(p.available).to.be.equal(4);
                    expect(p.immediate).to.be.equal(1);
                });
        });
    });

    describe('terminate', function() {
        before(function () {
            connector.define('terminate', 'disconnect', {}, function (config) {
                var factory = {};
                factory.add = function(a, b) { return a + b; };
                factory.disconnect = function () {};
                return factory;
            });
        });

        after(function () {
            connector.remove('terminate');
        });

        it('soft', function() {
            var p = Pool('terminate', {}, { poolIncrement: 2, terminateGrace: .1 });
            var conn;
            return p.connect()
                .then(function(c) {
                    conn = c;
                    expect(p.immediate).to.be.equal(1);
                    expect(conn.add(3, 5)).to.be.equal(8);
                    p.terminate();
                    return Promise.delay(50);
                })
                .then(function() {
                    expect(conn.add(1, 2)).to.be.equal(3);
                    return Promise.delay(75);
                })
                .then(function() {
                    expect(function() { conn.add(1, 2) }).to.throw(Pool.error.revoked);
                });
        });

        it('hard', function() {
            var p = Pool('terminate', {}, { poolIncrement: 2, terminateGrace: 1 });
            var conn;
            return p.connect()
                .then(function(c) {
                    conn = c;
                    expect(p.immediate).to.be.equal(1);
                    expect(conn.add(3, 5)).to.be.equal(8);
                    p.terminate(true);
                    return Promise.delay(1);
                })
                .then(function() {
                    expect(function() { conn.add(1, 2) }).to.throw(Pool.error.revoked);
                });
        });
    });

    describe('disconnect', function() {
        before(function () {
            connector.define('disconnect', 'disconnect', {}, function (config) {
                var factory = {};
                factory.add = function(a, b) { return a + b; };
                factory.disconnect = function () {};
                return factory;
            });
        });

        after(function () {
            connector.remove('disconnect');
        });

        it('disconnect', function() {
            var p = Pool('disconnect', {}, { poolIncrement: 2, terminateGrace: .1 });
            var conn;
            return p.connect()
                .then(function(c) {
                    conn = c;
                    expect(p.immediate).to.be.equal(1);
                    return conn.disconnect();
                })
                .then(function() {
                    expect(function() { conn.add(1, 2) }).to.throw(Pool.error.revoked);
                });
        });
    });

});*/
