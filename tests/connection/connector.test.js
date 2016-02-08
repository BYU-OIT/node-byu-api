"use strict";
var Connector       = require('../../bin/database/connector');
var connectorUtil   = require('../../test-utils/database-connector');
var expect          = require('chai').expect;
var schemata        = require('object-schemata');

describe('database/connector', function() {

    describe('#define', function() {

        before(connectorUtil.clear);
        afterEach(connectorUtil.clear);

        it('valid definition', function() {
            expect(() => connectorUtil.define('a')).to.not.throw(Error);
        });

        it('duplicate definition', function() {
            connectorUtil.define('a');
            expect(() => connectorUtil.define('a')).to.throw(Connector.error.exists);
        });

        it('missing required connect', function() {
            var config = connectorUtil.configuration('a');
            delete config.connect;
            expect(() => Connector.define(config)).to.throw(schemata.error);
        });

        it('missing required name', function() {
            var config = connectorUtil.configuration('a');
            delete config.name;
            expect(() => Connector.define(config)).to.throw(schemata.error);
        });

    });

    describe('#exists', function() {

        before(connectorUtil.clear);
        afterEach(connectorUtil.clear);

        it('finds', function() {
            connectorUtil.define('a');
            expect(Connector.exists('a')).to.be.true;
        });

        it('doesn\'t find', function() {
            expect(Connector.exists('a')).to.be.false;
        });

    });

    describe('#get', function() {

        before(connectorUtil.clear);
        afterEach(connectorUtil.clear);

        it('can get', function() {
            connectorUtil.define('a');
            expect(Connector.get('a')).to.be.an('object');
        });

        it('can\'t find throws error', function() {
            expect(() => Connector.get('a')).to.throw(Connector.error.undefined);
        });

    });

    describe('#list', function() {

        before(function() {
            connectorUtil.clear();
            connectorUtil.define('a');
            connectorUtil.define('b');
            connectorUtil.define('c');
        });
        after(connectorUtil.clear);

        it('returns array of strings', function() {
            var result = Connector.list().sort();
            expect(result).to.be.instanceof(Array);
            expect(result[0]).to.be.equal('a');
            expect(result[1]).to.be.equal('b');
            expect(result[2]).to.be.equal('c');
        });

    });

    describe('#remove', function() {

        before(connectorUtil.clear);
        afterEach(connectorUtil.clear);

        it('removes existing', function() {
            connectorUtil.define('a');
            expect(() => Connector.remove('a')).to.not.throw(Error);
        });

        it('throws error for non-existing', function() {
            expect(() => Connector.remove('a')).to.throw(Connector.error.undefined);
        });

    });

});