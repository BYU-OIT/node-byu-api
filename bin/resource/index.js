"use strict";
//var Command         = require('command-line-callback');

exports.options = {
    def: {
        type: String,
        description: 'The name of each resource definition file.',
        defaultValue: 'def.json',
        group: 'resource'
    },
    src: {
        alias: 's',
        type: String,
        description: 'The directory that has the code to handle the request.',
        defaultValue: './',
        group: 'resource'
    },
    srcErrorIgnore: {
        type: Boolean,
        description: 'If a syntax error is encountered on a resource then it will throw an error unless this option ' +
        'is set. If this option is set then the resource will simply not be registered without throwing an error.',
        group: 'resource'
    },
    srcLimit: {
        type: String,
        description: 'The resource name to limit loaded resources to.',
        help: 'The greatest benefit of this option is to reduce the initial startup time of the application.',
        multiple: true,
        group: 'resource'
    },
    srcIndex: {
        type: String,
        description: 'The name of the file to call for each resource or sub-resource to bootstrap the functionality ' +
        'for that resource or sub-resource.',
        help: 'The file specified must be executable as JavaScript.',
        defaultValue: 'index.js',
        group: 'resource'
    }
};


/*
Command.define('resource',
    function(configuration) {

    },
    {
        brief: 'Make a single REST request to API',
        defaultOption: 'url',
        synopsis: [
            '[OPTIONS]...'
        ],
        groups: {
            database: 'Database File Options',
            request: 'Request Options'
        },
        options: options()
    });
*/
