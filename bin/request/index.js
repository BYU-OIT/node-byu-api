"use strict";
var Command         = require('command-line-callback');
var Database        = require('../database/index');
var Handler         = require('./handler');
var Manager         = require('../database/manager');
var Resource        = require('../resource/index');
var ResourceLoader  = require('../resource/loader');

exports.options = {
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
        description: 'A key value pair that is separated by an equals. You can add multiple cookies by ' +
        'using multiple flags. Example usage: [APPLICATION] [COMMAND] --cookie foo=value1 --cookie bar=value2',
        multiple: true,
        transform: transformKvArgument,
        validate: isKvArgument,
        group: 'request'
    },
    header: {
        alias: 'h',
        type: Object,
        description: 'A key value pair that is separated by an equals. You can add multiple headers by ' +
        'using multiple flags. Example usage: [APPLICATION] [COMMAND] --header foo=value1 --header bar=value2',
        multiple: true,
        transform: transformKvArgument,
        validate: isKvArgument,
        group: 'request'
    },
    method: {
        alias: 'm',
        type: String,
        description: 'The HTTP method to use with the request. This must be one of the following ' +
        'values: \n"' + Handler.methods.join('", "') + '"',
        defaultValue: 'get',
        group: 'request',
        transform: function(value) { return value.toLowerCase(); },
        validate: function(value) { return Handler.methods.indexOf(value.toLowerCase()) !== -1; }
    },
    query: {
        alias: 'q',
        type: String,
        description: 'A key value pair that is separated by an equals. You can add multiple query string ' +
        'parameters by using multiple flags. Example usage: ' +
        '[APPLICATION] [COMMAND] --query foo=value1 --query bar=value2',
        multiple: true,
        transform: transformKvArgument,
        validate: isKvArgument,
        group: 'request'
    },
    timeout: {
        alias: 't',
        type: Number,
        description: 'The number of milliseconds to run a request for before timeout.',
        defaultValue: 30000,
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

Command.define('request',
    function(configuration) {
        var promises = [];

        if (configuration.cookie) configuration.cookie = Object.assign.apply(Object, configuration.cookie);
        if (configuration.header) configuration.header = Object.assign.apply(Object, configuration.header);
        if (configuration.query) configuration.query = Object.assign.apply(Object, configuration.query);

        promises.push(Manager.load(configuration));
        promises.push(ResourceLoader(configuration));

        return Promise.all(promises)
            .then(function(results) {
                var handler = Handler({
                    database: results[0],
                    resource: results[1]
                });
                return handler(configuration);
            });
    },
    {
        brief: 'Make a single REST request to API',
        defaultOption: 'url',
        synopsis: [
            '[OPTIONS]...'
        ],
        groups: {
            database: 'Database File Options',
            request: 'Request Options',
            resource: 'Resource Options'
        },
        options: options()
    });



function isKvArgument(value) {
    return value.split('=').length === 2;
}

function options() {
    var result = Object.assign({}, exports.options, Database.options, Resource.options);
    result['db-file'].hidden = false;
    result['db-file'].required = false;
    return result;
}

function transformKvArgument(value) {
    var ar = value.split('=');
    var result = {};
    result[ar[0]] = ar[1];
    return result;
}