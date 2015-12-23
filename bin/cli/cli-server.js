var clc             = require('./clc');
var connFile        = require('../modules/connection-file');
var log             = require('../modules/log');
var resource        = require('../modules/resource');
var server          = require('../modules/server');

clc.define('server', cliServer, {
    description: 'Start a server listening for REST requests.',
    synopsis: [
        '[OPTIONS]... [DIRECTORY]'
    ],
    defaultOption: 'src',
    groups: {
        connection: 'Connection Options',
        log: 'Log Options',
        resource: 'Resource Options',
        server: 'Server Options'
    },
    options: Object.assign({}, server.options, connFile.options, log.options, resource.options)
});

function cliServer(err, config) {
    if (err || config.help) return;
    server(config);
}