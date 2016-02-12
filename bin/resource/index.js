"use strict";
var details         = require('../log/index').details;
var path            = require('path');

exports.options = {
    def: {
        type: String,
        description: 'The name of each resource definition file.',
        defaultValue: 'def.json',
        group: 'resource'
    },
    logConsoleResource: {
        type: String,
        description: 'The level of details to log resource output with. The value must be one of: ' + details.join(', '),
        defaultValue: 'none',
        validate: (v) => details.indexOf(v) !== -1,
        group: 'log'
    },
    logFileResource: {
        type: String,
        description: 'The file path to log resource logs to. Use an empty string to not log to a file.',
        defaultValue: '',
        group: 'log'
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
    srcFilter: {
        type: String,
        description: 'The resource name to limit loaded resources to. The greatest benefit of this option is to ' +
        'reduce the initial startup time of the application.',
        multiple: true,
        group: 'resource'
    },
    srcIndex: {
        type: String,
        description: 'The name of the file to call for each resource or sub-resource to bootstrap the functionality ' +
        'for that resource or sub-resource. The file specified must be executable as JavaScript.',
        defaultValue: 'index.js',
        group: 'resource'
    }
};
