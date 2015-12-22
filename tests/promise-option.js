"use strict";
var promiseOption   = require('../bin/modules/promise-option');
var test            = require('tape');

test('can use callback', function(t) {
    var fn1;
    var fn2;

    t.plan(4);

    fn1 = promiseOption(foo);
    fn1(function(err, data) {
        t.equal(err, null, 'error 1');
        t.equal(data, 'foo', 'value 1');
    });

    fn2 = promiseOption(fooErr);
    fn2(function(err, data) {
        t.ok(err instanceof Error, 'error 2');
        t.equal(data, null, 'value 2');
    });
});

test('can use promise', function(t) {
    var fn1;
    var fn2;

    t.plan(2);

    fn1 = promiseOption(foo);
    fn1()
        .then(function(data) {
            t.equal(data, 'foo', 'value');
        })
        .catch(function(err) {
            t.fail('Unexpected error: ' + err.message);
        });

    fn2 = promiseOption(fooErr);
    fn2()
        .then(function(data) {
            t.fail('Unexpected data: ' + data);
        })
        .catch(function(err) {
            t.ok(err instanceof Error, 'error');
        });
});

function foo(callback) {
    callback(null, 'foo');
}

function fooErr(callback) {
    callback(new Error(''), 'foo');
}