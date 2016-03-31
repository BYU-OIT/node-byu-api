"use strict";
var path            = require('path');

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
        description: 'The directory that defines the top-level resource that has the code to handle the requests.',
        defaultValue: './',
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
