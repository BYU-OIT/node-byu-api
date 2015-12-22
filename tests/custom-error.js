"use strict";
var customError     = require('../bin/modules/custom-error');
var test            = require('tape');

test('stack trace limit', function(t) {
    var limit;

    limit = customError.stackTraceLimit;

    t.equal(typeof limit, 'number', 'trace limit data type');

    customError.stackTraceLimit = 5;
    t.equal(customError.stackTraceLimit, 5, 'modified default trace limit');

    customError.stackTraceLimit = -5;
    t.equal(customError.stackTraceLimit, 5, 'un-modified default trace limit 1');

    customError.stackTraceLimit = 'hello';
    t.equal(customError.stackTraceLimit, 5, 'un-modified default trace limit 2');

    customError.stackTraceLimit = limit;

    t.end();
});

test('define an error namespace', function(t) {
    var e;
    var Foo;

    Foo = customError('foo', {
        x: 'code'
    });

    e = new Foo.x('Error message');
    t.equal(e.name, 'foo', 'name');
    t.equal(e.code, 'ECODE', 'code');

    try {
        customError('foo', {});
    } catch (e) {
        t.equal(e.name, 'CustomError', 'error type');
        t.equal(e.code, 'EEXISTS', 'error code');
    }

    t.end();
});
