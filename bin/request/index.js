"use strict";
const chalk             = require('chalk');
const Command           = require('command-line-callback');
const Database          = require('../database/index');
const Handler           = require('./handler');
const log               = require('../log/log');
const Manager           = require('../database/manager');
const Resource          = require('../resource/index');
const ResourceLoader    = require('../resource/loader');

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
        description: function(p) {
            return 'A key value pair that is separated by an equals. You can add multiple cookies by ' +
                'using multiple flags. Example usage: ' +
                chalk.italic(p.app + ' ' + p.command + ' --cookie foo=value1 --cookie bar=value2');
        },
        multiple: true,
        transform: transformKvArgument,
        validate: isKvArgument,
        group: 'request'
    },
    header: {
        alias: 'h',
        type: Object,
        description: function(p) {
            return 'A key value pair that is separated by an equals. You can add multiple headers by ' +
                'using multiple flags. Example usage: ' +
                chalk.italic(p.app + ' ' + p.command + ' --header foo=value1 --header bar=value2');
        },
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
        description: function(p) {
            return 'A key value pair that is separated by an equals. You can add multiple query string ' +
                'parameters by using multiple flags. Example usage: ' +
                chalk.italic(p.app + ' ' + p.command + ' --query foo=value1 --query bar=value2');
        },
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

        // join array of objects for cookies, headers, and query into a single object
        if (configuration.cookie) configuration.cookie = Object.assign.apply(Object, configuration.cookie);
        if (configuration.header) configuration.header = Object.assign.apply(Object, configuration.header);
        if (configuration.query) configuration.query = Object.assign.apply(Object, configuration.query);

        // load the database manager and resources
        promises.push(Manager.load(configuration));
        promises.push(ResourceLoader(configuration));

        // create a request handler and call it
        return Promise.all(promises)
            .then(function(results) {
                var interfaces = { manager: results[0], resource: results[1] };
                return Handler(interfaces)(configuration);
            });
    },
    {
        brief: 'Make a single REST request directly to API.',
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
    result.dbFile = Object.assign({}, result.dbFile);
    result.dbFile.hidden = false;
    result.dbFile.required = false;
    return result;
}

function transformKvArgument(value) {
    var ar = value.split('=');
    var result = {};
    result[ar[0]] = ar[1];
    return result;
}