"use strict";
var connectorUtil   = require('../../test-utils/database-connector');
var chai            = require('chai');
var chaiAsPromised  = require('chai-as-promised');
var is              = require('../../bin/util/is');
var Promise         = require('bluebird');
var Manager         = require('../../bin/database/manager');
var schemata        = require('object-schemata');

var expect          = chai.expect;
chai.use(chaiAsPromised);

describe('database/manager', function() {
    var config = {
        foo: {
            connector: 'bar',
            config: {
                user: 'Bob'
            },
            pool: null
        }
    };

    before(function() {
        connectorUtil.define('bar');
    });

    after(connectorUtil.clear);

    it('returns a factory', function() {
        expect(Manager(config)).to.be.an('object');
    });

    describe('#connections', function() {

        it('is a function', function() {
            expect(Manager(config).connections).to.be.a('function');
        });

        it('returns a promise', function() {
            expect(Manager(config).connections([])).to.be.instanceof(Promise);
        });

        it('resolves to an object', function() {
            return expect(Manager(config).connections([])).to.eventually.be.an('object');
        });

        it('resolves to an object with done function', function() {
            return Manager(config).connections([])
                .then(function(result) {
                    expect(result.done).to.be.a('function');
                });
        });

        it('resolves to an object with connections map', function() {
            return Manager(config).connections(['foo'])
                .then(function(result) {
                    expect(result.connections).to.be.an('object');
                    expect(result.connections.foo.run).to.be.a('function');
                });
        });

    });

    describe('#query', function() {

        it('is a function', function() {
            expect(Manager(config).query).to.be.a('function');
        });

        it('returns a promise', function() {
            expect(Manager(config).query('foo')).to.be.instanceof(Promise);
        });

        it('resolves to Ran query', function() {
            expect(Manager(config).query('foo')).to.eventually.be.equal('Ran query');
        });

    });

    describe('#test', function() {

        it('is a function', function() {
            expect(Manager(config).test).to.be.a('function');
        });

        it('returns a promise', function() {
            expect(Manager(config).test('foo')).to.be.instanceof(Promise);
        });

        it('resolves to true', function() {
            expect(Manager(config).test('foo')).to.eventually.be.equal(true);
        });

    });

});