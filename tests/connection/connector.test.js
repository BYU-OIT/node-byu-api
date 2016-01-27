"use strict";
var connector       = require('../../bin/connection/connector');
var expect          = require('chai').expect;
var is              = require('../../bin/util/is');
var Promise         = require('bluebird');
var schemata        = require('object-schemata');

describe('connection/connector', function() {

    describe('#define', function() {

        before(clear);
        afterEach(clear);

        it('empty name', function() {
            expect(function() {
                connector.define('', '', {}, function() {});
            }).to.throw(connector.error.create);
        });

        it('invalid name', function() {
            expect(function() {
                connector.define(5, '', {}, function() {});
            }).to.throw(connector.error.create);
        });

        it('empty disconnect name', function() {
            expect(function() {
                connector.define('a', '', {}, function() {});
            }).to.throw(connector.error.create);
        });

        it('invalid disconnect name', function() {
            expect(function() {
                connector.define('a', 5, {}, function() {});
            }).to.throw(connector.error.create);
        });

        it('invalid configuration', function() {
            expect(function() {
                connector.define('a', 'x', null, function() {});
            }).to.throw(connector.error.create);
        });

        it('invalid connect function', function() {
            expect(function() {
                connector.define('a', 'x', {}, {});
            }).to.throw(connector.error.create);
        });

        it('valid', function() {
            connector.define('a', 'x', {}, function() {});
            expect(function() {
                connector.get('a');
            }).to.not.throw(Error);
        });

        it('duplicate', function() {
            connector.define('a', 'x', {}, function() {});
            expect(function() {
                connector.define('a', 'x', {}, function() {});
            }).to.throw(connector.error.exists);
        })

    });

    describe('#get', function() {

        before(clear);
        afterEach(clear);

        it('can get', function() {
            defineConnector('foo');
            expect(connector.get('foo')).to.be.an('object');
            clear();
        });

        it('connect sync returns promise', function() {
            defineConnector('foo', false);
            var c = connector.get('foo');
            var conn = c.connect({ user: '' });
            expect(conn).to.be.instanceof(Promise);
        });

        it('connect sync missing required', function() {
            defineConnector('foo', false);
            var c = connector.get('foo');
            return c.connect()
                .then(function() {
                    throw new Error('Should have failed');
                })
                .catch(function(e) {
                    expect(e).to.be.instanceof(schemata.error.required);
                });
        });

        it('connect sync wrong password', function() {
            defineConnector('foo', false);
            var c = connector.get('foo');
            return c.connect({ user: 'Bob', password: '' })
                .then(function() {
                    throw new Error('Should have failed');
                })
                .catch(function(e) {
                    expect(e).to.be.instanceof(Error);
                    expect(e.message).to.be.equal('Incorrect password');
                });
        });

        it('connect sync ok', function() {
            defineConnector('foo', false);
            var c = connector.get('foo');
            return c.connect({ user: 'Bob' })
                .then(function(factory) {
                    expect(factory).to.be.an('object');
                });
        });

        it('connect async returns promise', function() {
            defineConnector('foo', false, false);
            var c = connector.get('foo');
            var conn = c.connect({ user: '' });
            expect(conn).to.be.instanceof(Promise);
        });

        it('connect sync missing required', function() {
            defineConnector('foo', true);
            var c = connector.get('foo');
            return c.connect()
                .then(function() {
                    throw new Error('Should have failed');
                })
                .catch(function(e) {
                    expect(e).to.be.instanceof(schemata.error.required);
                });
        });

        it('connect async wrong password', function() {
            defineConnector('foo', true);
            var c = connector.get('foo');
            return c.connect({ user: 'Bob', password: '' })
                .then(function() {
                    throw new Error('Should have failed');
                })
                .catch(function(e) {
                    expect(e).to.be.instanceof(Error);
                    expect(e.message).to.be.equal('Incorrect password');
                });
        });

        it('connect async ok', function() {
            defineConnector('foo', true);
            var c = connector.get('foo');
            return c.connect({ user: 'Bob' })
                .then(function(factory) {
                    expect(factory).to.be.an('object');
                });
        });

        it('test pass', function() {
            defineConnector('foo', false);
            var c = connector.get('foo');
            return c.test({ user: 'Bob' })
                .then(function(value) {
                    expect(value).to.be.equal(true);
                });
        });

        it('test fail user', function() {
            defineConnector('foo', false);
            var c = connector.get('foo');
            return c.test()
                .then(function(value) {
                    expect(value).to.be.instanceof(Error);
                });
        });

        it('test fail password', function() {
            defineConnector('foo', false);
            var c = connector.get('foo');
            return c.test({ user: '', password: '' })
                .then(function(value) {
                    expect(value).to.be.instanceof(Error);
                });
        });


    });

});

function clear() {
    connector.list().forEach(function(name) {
        connector.remove(name);
    });
}


function defineConnector(name, promises) {
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
            validate: is.string,
            defaultValue: 'pass'
        }
    };

    connector.define(name, 'letGo', configuration, function(config) {
        var disconnected = false;
        var factory = {};
        var err = new Error('Incorrect password');

        factory.password = config.password;

        factory.letGo = function() {
            disconnected = true;
        };

        if (factory.password !== 'pass') {
            if (promises) {
                return Promise.reject(err);
            } else {
                throw err;
            }
        }

        if (!promises) {
            return factory;
        } else {
            return Promise.resolve(factory);
        }
    });
}