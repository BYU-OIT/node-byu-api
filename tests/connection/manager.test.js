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
            }
        }
    };

    before(function() {
        connectorUtil.define('bar');
    });

    after(connectorUtil.clear);

    it('returns a promise', function() {
        expect(Manager(config)).to.be.instanceof(Promise);
    });

    it('resolves to an object', function() {
        return expect(Manager(config)).to.eventually.be.an('object');
    });

    it('has connect, exit, and test', function() {
        return Manager(config)
            .then(function(factory) {
                expect(factory.connect.foo).to.be.a('function');
                expect(factory.exit).to.be.a('function');
                expect(factory.test.foo).to.be.a('function');
            });
    });

});