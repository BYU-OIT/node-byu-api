"use strict";
const expect        = require('chai').expect;
const log           = require('../../bin/log/log');
const response      = require('../../bin/request/response');

describe.only('request/response', function() {

    // don't output logs to the console
    log.addEventListener(function(e) {
        e.preventDefault();
    });
    
    it('is a function', function() {
        expect(response).to.be.a('function');
    });

    it('returns a response object', function() {
        expect(response()).to.be.instanceof(response);
    });
    
    describe('#end', function() {
        var res;
        
        beforeEach(function() {
            res = response();
        });

        it('resolves the promise', function() {
            expect(res.promise.isPending()).to.equal(true);
            res.end();
            expect(res.promise.isFulfilled()).to.equal(true);
        });

        it('returns true when resolved', function() {
            res.end();
            expect(res.end()).to.equal(true);
        });

        it('returns false if previously resolved', function() {
            res.end();
            expect(res.end()).to.equal(false);
        })
        
    });

    describe('#get', function() {
        var res;

        beforeEach(function() {
            res = response();
        });

        it('returns undefined for unset header', function() {
            expect(res.get('content-type')).to.equal(void 0);
        });

        it('returns value for set header', function() {
            res.set('content-type', 'application/json');
            expect(res.get('content-type')).to.be.equal('application/json');
        });

        it('ignores key case', function() {
            res.set('content-type', 'application/json');
            expect(res.get('Content-type')).to.be.equal('application/json');
        });

    });

    describe('#promise', function() {
        var res;

        beforeEach(function() {
            res = response();
        });

        it('is not a function', function() {
            expect(res.promise).to.not.be.a('function');
        });

        it('is a promise', function() {
            expect(res.promise.then).to.be.a('function');
        });

    });

    describe('#send', function() {
        var res;

        beforeEach(function() {
            res = response();
        });

        it('resolves the promise', function() {
            expect(res.promise.isPending()).to.equal(true);
            res.send();
            expect(res.promise.isFulfilled()).to.equal(true);
        });

        it('sets the body to parameter input', function() {
            res.send('foo');
            return res.promise.then(data => expect(data.body).to.equal('foo'));
        });

        it('returns true on success', function() {
            expect(res.send()).to.equal(true);
        });

        it('returns false on error', function() {
            var o = {};
            o.value = o;
            expect(res.send(o)).to.equal(false);
        });

    });

    describe('#sendStatus', function() {
        var res;

        beforeEach(function() {
            res = response();
        });

        it('sets content type to plain', function() {
            res.set('content-type', 'application/json');
            res.sendStatus(200);
            expect(res.get('content-type')).to.equal('text/plain');
        });

        it('returns true when resolved', function() {
            expect(res.sendStatus(200)).to.equal(true);
        });

        it('returns false if previously resolved', function() {
            res.sendStatus(200);
            expect(res.sendStatus(200)).to.equal(false);
        });

        it('returns false if invalid code', function() {
            expect(res.sendStatus(0)).to.equal(false);
        });

        it('resolves the promise if valid code', function() {
            expect(res.promise.isPending()).to.equal(true);
            res.sendStatus(200);
            expect(res.promise.isFulfilled()).to.equal(true);
            return res.promise.then(data => expect(data.status).to.equal(200));
        });

        it('resolves the promise if invalid code', function() {
            expect(res.promise.isPending()).to.equal(true);
            res.sendStatus(0);
            expect(res.promise.isFulfilled()).to.equal(true);
            return res.promise.then(data => expect(data.status).to.equal(500));
        });

    });

    describe('#sent', function() {
        var res;

        beforeEach(function () {
            res = response();
        });
        
        it('is false when pending', function() {
            expect(res.sent).to.equal(false);
        });

        it('is true when resolved', function() {
            res.send();
            expect(res.sent).to.equal(true);
        });
        
    });

    describe('#set', function() {
        var res;

        beforeEach(function() {
            res = response();
        });

        it('returns response instance', function() {
            expect(res.set('content-type', 'application/json')).to.be.instanceof(response);
        });

        it('ignores key case', function() {
            res.set('Content-type', 'application/json');
            expect(res.get('content-type')).to.be.equal('application/json');
        });

    });

    describe('#status', function() {
        var res;

        beforeEach(function() {
            res = response();
        });

        it('will set valid status', function() {
            res.status(200);
            expect(res.status()).to.equal(200);
        });

        it('will not set invalid status', function() {
            res.status(200);
            res.status(0);
            expect(res.status()).to.equal(200);
        });

    });

    describe('#working', function() {
        var res;

        beforeEach(function() {
            res = response({ timeout: 100 });
        });

        it('will time out', function() {
            return res.promise.then(function(data) {
                expect(data.status).to.equal(408);
            });
        });

        it('can extend timeout', function() {
            var i;
            for (i = 0; i < 5; i++) {
                setTimeout(res.working, i * 50);
            }
            setTimeout(res.send, 300);
            return res.promise.then(function(data) {
                expect(data.status).to.equal(204);
            });
        });

    });
    
});