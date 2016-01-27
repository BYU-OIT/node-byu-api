"use strict";
var configFile      = require('../../bin/connection/configuration-file');
var Connector       = require('../../bin/connection/connector');
var expect          = require('chai').expect;
var file            = require('../../bin/util/file.js');
var Promise         = require('bluebird');

describe('connection/configuration-file', function() {
    var fs = fakeFs();
    var config = { file: '/config', password: '' };

    after(fs.restore);

    describe('load', function() {
        afterEach(fs.clear);

        it('returns a promise', function() {
            var value = configFile(config);
            expect(value).to.be.instanceof(Promise);
        });

        it('file doesn\'t exist resolves to factory', function() {
            return configFile(config)
                .then(function(factory) {
                    expect(factory).to.be.an('object');
                    expect(factory).to.be.ok;
                });
        });

        it('file does exist resolves to factory', function() {
            return file.writeFile('./config', '')
                .then(function() {
                    return configFile(config)
                })
                .then(function(factory) {
                    expect(factory).to.be.an('object');
                    expect(factory).to.be.ok;
                });
        });

    });

    describe('store', function() {
        var factory;

        beforeEach(function() {
            Connector.define('bar', 'disconnect', { foo: {} }, function() {});
            return configFile(config)
                .then(function(f) {
                    factory = f;
                });
        });

        afterEach(function() {
            Connector.remove('bar');
            factory.list().forEach(function(name) {
                factory.remove(name);
            });
        });

        it('get and set', function() {
            var config = { connector: { name: 'bar', config: { foo: 'bar' } }, pool: {} };
            var result;
            factory.set('foo', 'bar', { foo: 'bar' }, {});
            result = factory.get('foo');
            result.pool = {};
            expect(result).to.be.deep.equal(config);
        });

        it('list', function() {
            factory.set('foo', 'bar', {}, {});
            factory.set('baz', 'bar', {}, {});
            expect(factory.list()).to.be.deep.equal(['foo', 'baz']);
        });

    });

    describe('save', function() {
        var setConfig = { connector: { name: 'bar', config: { foo: 'bar' } } };

        beforeEach(function() {
            Connector.define('bar', 'disconnect', { foo: {} }, function() {});
        });

        afterEach(function() {
            Connector.remove('bar');
            fs.clear();
        });

        it('returns a promise', function() {
            return configFile(config)
                .then(function(factory) {
                    expect(factory.save()).to.be.instanceof(Promise);
                });
        });

        it('plain', function() {
            var factory;
            var expected = {
                foo: {
                    connector: {
                        name: 'bar',
                        config: { foo: 'bar'}
                    },
                    pool: {}
                }
            };

            return configFile(config)
                .then(function(f) {
                    factory = f;
                    factory.set('foo', 'bar', { foo: 'bar' }, {});
                    return factory.save();
                })
                .then(function() {
                    return file.readFile('/config');
                })
                .then(function(content) {
                    var o = JSON.parse(content);
                    o.foo.pool = {};
                    expect(o).to.be.deep.equal(expected);
                });
        });

        it('encrypted', function() {
            var factory;
            return configFile({ file: '/config', password: 'pass' })
                .then(function(f) {
                    factory = f;
                    factory.set('foo', 'bar', {}, {});
                    return factory.save();
                })
                .then(function() {
                    return file.readFile('/config');
                })
                .then(function(content) {
                    expect(/^[0-9a-f]+$/i.test(content)).to.be.true;
                });
        });

    });
});

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