"use strict";
var Configuration       = require('../../bin/database/configuration');
var Connector           = require('../../bin/database/connector');
var connectorUtil       = require('../../test-utils/database-connector');
var expect              = require('chai').expect;
var file                = require('../../bin/util/file');
var is                  = require('../../bin/util/is');
var Pool                = require('../../bin/database/pool');

describe('database/configuration', function() {
    var fs = fakeFs();
    var config = { dbFile: '/config', password: '' };

    describe('factory', function() {
        var config = Configuration({ dbFile: '/config' });

        it('requires file path', function() {
            expect(function() { Configuration(); }).to.throw(Error);
        });

        it('has function: changePassword', function() {
            expect(config.changePassword).to.be.a('function');
        });

        it('has function: get', function() {
            expect(config.get).to.be.a('function');
        });

        it('has function: list', function() {
            expect(config.list).to.be.a('function');
        });

        it('has function: load', function() {
            expect(config.load).to.be.a('function');
        });

        it('has function: remove', function() {
            expect(config.remove).to.be.a('function');
        });

        it('has function: save', function() {
            expect(config.save).to.be.a('function');
        });

        it('has function: set', function() {
            expect(config.set).to.be.a('function');
        });

    });

    describe('load', function() {

        beforeEach(defineConnector);
        afterEach(function() {
            clearConnector();
            fs.clear();
        });

        it('resolves to factory', function() {
            var factory = Configuration(config);
            return factory.load()
                .then(function(f) {
                    expect(f).to.be.equal(factory);
                });
        });

        it('populates store', function() {
            var factory = Configuration(config);
            return file.writeFile('/config', '{ "foo": { "connector": "bar", "config": { "user": "", "password": "" }, "pool": null } }')
                .then(function() {
                    return Configuration(config).load()
                })
                .then(function(factory) {
                    expect(factory.get('foo')).to.be.deep.equal({ connector: 'bar', config: { user: '', password: '' }, pool: null });
                });
        });

        it('validates', function() {
            var factory = Configuration(config);
            return file.writeFile('/config', '{ "foo": { "connector": "bar", "config": {}, "pool": null } }')
                .then(function() {
                    return Configuration(config).load()
                })
                .catch(function(e) {
                    expect(e).to.be.instanceof(Error);
                });
        });

    });

    describe('save', function() {
        beforeEach(function() {
            var config = connectorUtil.configuration('bar', false);
            config.options = { foo: {} };
            Connector.define(config);
        });

        afterEach(function() {
            Connector.remove('bar');
            fs.clear();
        });

        it('returns a promise', function() {
            expect(Configuration(config).save()).to.be.instanceof(Promise);
        });

        it('plain', function() {
            var expected = {
                foo: {
                    connector: 'bar',
                    config: { foo: 'bar'},
                    pool: null
                }
            };

            return Configuration(config)
                .set('foo', 'bar', { foo: 'bar' })
                .save()
                .then(function() {
                    return file.readFile('/config');
                })
                .then(function(content) {
                    var o = JSON.parse(content);
                    expect(o).to.be.deep.equal(expected);
                });
        });

        it('plain with pool', function() {
            var expected = {
                foo: {
                    connector: 'bar',
                    config: { foo: 'bar'},
                    pool: Pool.schema.normalize({})
                }
            };

            return Configuration(config)
                .set('foo', 'bar', { foo: 'bar' }, {})
                .save()
                .then(function() {
                    return file.readFile('/config');
                })
                .then(function(content) {
                    var o = JSON.parse(content);
                    expect(o).to.be.deep.equal(expected);
                });
        });

        it('encrypted', function() {
            var factory;
            return Configuration({ dbFile: '/config', password: 'pass' })
                .set('foo', 'bar', {})
                .save()
                .then(function() {
                    return file.readFile('/config');
                })
                .then(function(content) {
                    expect(/^[0-9a-f]+$/i.test(content)).to.be.true;
                });
        });

    });

    describe('set', function() {
        var config;

        beforeEach(function() {
            config = Configuration({ dbFile: '/config' });
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

    describe('validateFormat', function() {

        beforeEach(defineConnector);
        afterEach(clearConnector);

        it('valid format', function() {
            var o = {
                foo: {
                    connector: 'bar',
                    config: {user: 'Bob', password: ''}
                }
            };
            expect(Configuration.validateFormat(o)).to.be.equal(true);
        });

        it('requires that the connector name be a string', function() {
            var o = {
                foo: {
                    connector: 5,
                    config: {user: 'Bob', password: ''}
                }
            };
            expect(Configuration.validateFormat(o)).to.be.instanceof(Configuration.error.set);
        });

        it('requires that the connector be defined', function() {
            var o = {
                foo: {
                    connector: 'baz',
                    config: {user: 'Bob', password: ''}
                }
            };
            expect(Configuration.validateFormat(o)).to.be.instanceof(Connector.error);
        });

        it('requires that the connector configuration be valid', function() {
            var o = {
                foo: {
                    connector: 'bar',
                    config: {}
                }
            };
            expect(Configuration.validateFormat(o)).to.be.instanceof(Error);
        });

    });

});

function defineConnector() {
    connectorUtil.define('bar', false, {
        options: {
            user: {
                type: 'input',
                message: 'User:',
                help: 'This value must be a string.',
                validate: is.string,
                required: true
            },
            password: {
                type: 'password',
                message: 'Password:',
                help: 'This value must be a string.',
                validate: is.string
            }
        }
    });
}

function clearConnector() {
    Connector.remove('bar');
}

function fakeFs() {
    var factory = {};
    var originalRead = file.readFile;
    var originalWrite = file.writeFile;
    var store = {};

    file.readFile = function(path, encoding) {
        return new Promise(function(resolve, reject) {
            var error;
            if (store.hasOwnProperty(path)) return resolve(store[path]);
            error = new Error();
            error.code = 'ENOENT';
            reject(error);
        });
    };

    file.writeFile = function(path, content, encoding) {
        return new Promise(function(resolve) {
            store[path] = content;
            resolve();
        });
    };

    factory.clear = function() {
        store = {};
    };

    factory.restore = function() {
        file.readFile = originalRead;
        file.writeFile = originalWrite;
    };

    return factory;
}