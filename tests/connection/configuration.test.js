"use strict";
var Configuration       = require('../../bin/connection/configuration');
var Connector           = require('../../bin/connection/connector');
var expect              = require('chai').expect;
var is                  = require('../../bin/util/is');

describe('connection/configuration', function() {

    describe('init', function() {

        beforeEach(defineConnector);
        afterEach(clearConnector);

        it('empty', function() {
            expect(function() { Configuration().init(); }).to.throw(Configuration.error.init);
        });

        it('plain', function() {
            expect(function() { Configuration().init({}); }).to.not.throw(Error);
        });

        it('missing connector', function() {
            var config = fullConfig();
            delete config.foo.connector;
            expect(function() { Configuration().init(config); }).to.throw(Configuration.error.init);
        });

        it('missing connector name', function() {
            var config = fullConfig();
            delete config.foo.connector.name;
            expect(function() { Configuration().init(config); }).to.throw(Configuration.error.init);
        });

        it('missing connector config', function() {
            var config = fullConfig();
            delete config.foo.connector.config;
            expect(function() { Configuration().init(config); }).to.throw(Error);
        });

        it('missing pool', function() {
            var config = fullConfig();
            delete config.foo.pool;
            expect(function() { Configuration().init(config); }).to.throw(Configuration.error.init);
        });

        it('connector config error', function() {
            var config = fullConfig();
            config.foo.connector.name = null;
            expect(function() { Configuration().init(config); }).to.throw(Error);
        });

    });

    describe('set', function() {
        var config;

        beforeEach(function() {
            config = Configuration();
            defineConnector();
        });

        afterEach(clearConnector);

        it('ok', function() {
            expect(function() { config.set('foo', 'bar', { user: 'Bob' }, {}); }).to.not.throw(Error);
        });

        it('empty string name', function() {
            expect(function() { config.set('', 'bar', { user: 'Bob' }, {}); }).to.throw(Configuration.error.set);
        });

        it('wrong data type name', function() {
            expect(function() { config.set({}, 'bar', { user: 'Bob' }, {}); }).to.throw(Configuration.error.set);
        });

        it('empty string connector name', function() {
            expect(function() { config.set('foo', '', { user: 'Bob' }, {}); }).to.throw(Configuration.error.set);
        });

        it('wrong data type connector name', function() {
            expect(function() { config.set({}, {}, { user: 'Bob' }, {}); }).to.throw(Configuration.error.set);
        });

        it('connector name not defined', function() {
            expect(function() { config.set({}, 'baz', { user: 'Bob' }, {}); }).to.throw(Error);
        });

        it('wrong data type connector config', function() {
            expect(function() { config.set({}, 'baz', '', {}); }).to.throw(Error);
        });

        it('missing required connector config', function() {
            expect(function() { config.set({}, 'baz', {}, {}); }).to.throw(Error);
        });

        it('invalid type pool config', function() {
            expect(function() { config.set({}, 'baz', { user: 'Bob' }, null); }).to.throw(Error);
        });

    });

});

function fullConfig() {
    return {
        foo: {
            connector: {
                name: 'bar',
                config: {
                    user: 'Bob',
                    password: 'pass'
                }
            },
            pool: {}
        }
    }
}

function defineConnector() {
    var configuration = {
        user: {
            type: 'input',
            message: 'User:',
            help: 'This value must be a string.',
            validate: is.string,
            required: true
        },
        password: {
            type: 'input',
            message: 'Password:',
            help: 'This value must be a string.',
            validate: is.string
        }
    };

    Connector.define('bar', 'disconnect', configuration, function() {
        var factory = {};
        factory.disconnect = function() {};
        return factory;
    });
}

function clearConnector() {
    Connector.remove('bar');
}