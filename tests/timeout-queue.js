"use strict";
var timeoutQueue    = require('../bin/modules/timeout-queue');
var test            = require('tape');

test('has timeout', function(t) {
    var queue = timeoutQueue(0, function(value) {
        t.pass('timed out ' + value);
    });

    t.plan(3);

    queue.add(1);
    queue.add(2);
    queue.add(3);
});

test('before timeout', function(t) {
    var queue = timeoutQueue(60, function(value) {
        t.equal(value, 3, 'third');
    });

    t.plan(3);

    queue.add(1);
    queue.add(2);
    queue.add(3);

    setTimeout(function() {
        var value = queue.get();
        t.equal(value, 1, 'first');
    }, 25);

    setTimeout(function() {
        var value = queue.get();
        t.equal(value, 2, 'second');
    }, 45);
});