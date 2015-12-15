var clc             = require('./clc');
var cliConnector    = require('./cli-connector');
var requestHandler  = require('../modules/request-handler');
var resource        = require('../modules/resource');

var methods = ['get', 'head', 'post', 'put', 'delete', 'trace', 'options', 'connect', 'path'];

module.exports = cliRequestHandler;

function cliRequestHandler(options) {
    return clc.execute('request', options);
}

cliRequestHandler.options = {
    body: {
        alias: 'b',
        type: String,
        description: 'The body to send with the request.',
        defaultValue: '',
        group: 'request'
    },
    cookie: {
        alias: 'c',
        type: String,
        description: 'A key value pair that is separated by an equals. You can add multiple cookies by using multiple flags.',
        help: 'Example usage: [APPLICATION] [COMMAND] --cookie foo=value1 --cookie bar=value2',
        transform: transformKvArgument,
        validate: isKvArgument,
        group: 'request'
    },
    header: {
        alias: 'h',
        type: Object,
        description: 'A key value pair that is separated by an equals. You can add multiple headers by using multiple flags.',
        help: 'Example usage: [APPLICATION] [COMMAND] --header foo=value1 --header bar=value2',
        transform: transformKvArgument,
        validate: isKvArgument,
        group: 'request'
    },
    method: {
        alias: 'm',
        type: String,
        description: 'The HTTP method to use with the request.',
        help: 'This must be one of the following values: \n"' + methods.join('", "') + '"',
        defaultValue: 'get',
        group: 'request',
        transform: function(value) { return value.toLowerCase(); },
        validator: function(value) { return methods.indexOf(value.toLowerCase()) !== -1; }
    },
    query: {
        alias: 'q',
        type: String,
        description: 'A key value pair that is separated by an equals. You can add multiple query string parameters by using multiple flags.',
        help: 'Example usage: [APPLICATION] [COMMAND] --query-string foo=value1 --query-string bar=value2',
        transform: transformKvArgument,
        validate: isKvArgument,
        group: 'request'
    },
    url: {
        alias: 'u',
        type: String,
        description: 'The request URL. If you want to send query string parameters, you can add them here.',
        required: true,
        group: 'request'
    }
};

clc.define('request', clc.exitOnErrorHandler(requestHandler), {
    description: 'Perform a REST request from the command line.',
    defaultOption: 'url',
    synopsis: [
        '[OPTIONS]... [URL]'
    ],
    groups: {
        connector: 'Connector Options',
        request: 'Request Options',
        resource: 'Resource Options'
    },
    options: Object.assign({}, cliRequestHandler.options, cliConnector.options, resource.options)
});

function isKvArgument(value) {
    return typeof value === 'object' && value && Object.keys(value).length === 1;
}

function transformKvArgument(value) {
    var ar = value.split('=');
    var result;
    if (ar.length === 2) {
        result = {};
        result[ar[0]] = ar[1];
    }
    return result;
}

