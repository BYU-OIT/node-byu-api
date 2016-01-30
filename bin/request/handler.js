"use strict";
var CustomError         = require('custom-error-instance');
var is                  = require('../util/is');
var schemata            = require('object-schemata');

var Err = CustomError('ReqHandleError');
Err.interface = CustomError(Err, { code: 'EIFCE' });

module.exports = Handler;

function Handler(interfaces) {

    // validate that all needed interfaces are present
    if (!interfaces) throw Err.interface('Invalid interface description.');
    if (!interfaces.hasOwnProperty('database')) throw Err.interface('Missing required database interface.');
    if (!interfaces.hasOwnProperty('resource')) throw Err.interface('Missing required resource interface.');

    return function(configuration) {
        var config = Handler.schema.normalize(configuration);
        // TODO:
    };
}

Handler.methods = ['get', 'head', 'post', 'put', 'delete', 'trace', 'options', 'connect', 'path'];

Handler.schema = schemata({
    body: {
        defaultValue: '',
        help: 'The body must be a string.',
        validate: is.string
    },
    cookie: {
        defaultValue: {},
        help: 'The cookie must be a non-null object.',
        validate: is.object
    },
    header: {
        defaultValue: {},
        help: 'The header must be a non-null object.',
        validate: is.object
    },
    method: {
        defaultValue: 'get',
        help: 'The method must be one of: ' + Handler.methods.join(', '),
        transform: (value) => value.toLowerCase(),
        validate: (value) => Handler.methods.indexOf(value.toLowerCase()) !== -1
    },
    query: {
        defaultValue: {},
        help: 'The query must be a non-null object.',
        validate: is.object
    },
    timeout: {
        defaultValue: 30000,
        help: 'The timeout must be a non-negative number.',
        validate: is.nonNegativeNumber
    },
    url: {
        required: true,
        help: 'The url must be a string.',
        validate: is.string
    }
});