"use strict";
var connFile        = require('../bin/modules/connection-file');
var fs              = require('fs');
var test            = require('tape');

var tempFilePath = require('path').resolve(__dirname, 'connfile.temp');

test('empty read and write non-encrypted', function(t) {
    var factory;

    fileRemove();

    t.plan(3);

    connFile(getConfig())
        .then(function(result) {
            factory = result;
            t.equal(factory.list.length, 0, 'non existent file');
            return factory.save();
        })
        .then(function() {
            t.equal(fileExists(), true, 'empty save');
            return connFile(getConfig());
        })
        .then(function(factory2) {
            t.equal(factory2.list.length, 0, 'empty file');
            fileRemove();
        });

});

test('empty read and write encrypted', function(t) {
    var factory;

    fileRemove();

    t.plan(3);

    connFile(getConfig('password'))
        .then(function(result) {
            factory = result;
            t.equal(factory.list.length, 0, 'non existent file');
            return factory.save();
        })
        .then(function() {
            t.equal(fileExists(), true, 'empty save');
            return connFile(getConfig('password'));
        })
        .then(function(factory2) {
            t.equal(factory2.list.length, 0, 'empty file');
            fileRemove();
        });

});

test('decrypt errors', function(t) {
    fileRemove();

    t.plan(4);

    connFile(getConfig('password'))
        .then(function(factory) {
            return factory.save();
        })
        .then(function() {
            return connFile(getConfig());
        })
        .catch(function(e) {
            t.equal(e.name, 'ConnectionFile', 'error type 1');
            t.equal(e.code, 'EPASS', 'error code 1');
            return connFile(getConfig('password2'));
        })
        .catch(function(e) {
            t.equal(e.name, 'ConnectionFile', 'error type 2');
            t.equal(e.code, 'EPASS', 'error code 2');
            fileRemove();
        });

});

test('get and set', function(t) {
    fileRemove();

    t.plan(10);

    connFile(getConfig())
        .then(function(factory) {
            var item;

            factory.set('foo', 'foo1', { x: 'foo1' });
            factory.set('foo', 'foo2', { y: 'foo2' });
            factory.set('bar', 'bar1', { y: 'bar1' });

            item = factory.get('foo');
            t.equal(item.connector, 'foo2', 'connector name 1');
            t.equal(item.config.y, 'foo2', 'connector config 1');

            item = factory.get('bar');
            t.equal(item.connector, 'bar1', 'connector name 2');
            t.equal(item.config.y, 'bar1', 'connector config 2');

            return factory.save();
        })
        .then(function() {
            return connFile(getConfig());
        })
        .then(function(factory) {
            var item;

            factory.set('baz', 'baz1', { y: 'baz1' });

            item = factory.get('foo');
            t.equal(item.connector, 'foo2', 'connector name 3');
            t.equal(item.config.y, 'foo2', 'connector config 3');

            item = factory.get('bar');
            t.equal(item.connector, 'bar1', 'connector name 4');
            t.equal(item.config.y, 'bar1', 'connector config 4');

            item = factory.get('baz');
            t.equal(item.connector, 'baz1', 'connector name 5');
            t.equal(item.config.y, 'baz1', 'connector config 5');
            fileRemove();
        });

});

test('change password', function(t) {
    fileRemove();

    t.plan(4);

    connFile(getConfig('password1'))
        .then(function(factory) {
            factory.changePassword('password2');
            factory.set('foo', 'bar', { x: 'y' });
            return factory.save();
        })
        .then(function() {
            return connFile(getConfig('password1'));
        })
        .catch(function(e) {
            t.equal(e.name, 'ConnectionFile', 'error type');
            t.equal(e.code, 'EPASS', 'error code');
            return connFile(getConfig('password2'));
        })
        .then(function(factory) {
            var item = factory.get('foo');
            t.equal(item.connector, 'bar', 'connector name');
            t.equal(item.config.x, 'y', 'connector config');
            fileRemove();
        });

});


function getConfig(password) {
    var config = { 'connection-file': tempFilePath };
    if (arguments.length > 0) config['connection-pass'] = password;
    return config;
}

function fileExists() {
    try {
        fs.statSync(tempFilePath);
        return true;
    } catch (e) {
        if (e.code === 'ENOENT') return false;
        throw e;
    }
}

function fileRemove() {
    if (fileExists()) fs.unlinkSync(tempFilePath);
}