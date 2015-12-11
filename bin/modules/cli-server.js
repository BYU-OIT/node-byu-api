var clc             = require('./clc');
var cliConnector    = require('./cli-connector');
var resource        = require('./resource');
var server          = require('./server');

module.exports = cliServer;

function cliServer(config) {
    return clc.execute('server', config);
}

cliServer.options = {
    debug: {
        type: Number,
        description: 'The port to run the debugger on. You will need another tool, like node-inspector, to control debugging. Omit this value to run without debug.',
        defaultValue: 0,
        group: 'server'
    },
    'log-append': {
        alias: 'a',
        type: Boolean,
        description: 'If a log file is specified then true will cause logs to append to the file and false will overwrite the file. Defaults to true',
        defaultValue: true,
        group: 'server'
    },
    logfile: {
        alias: 'l',
        type: String,
        description: 'The path of where to save logs. If omitted then logs will be output to the console.',
        group: 'server'
    },
    port: {
        alias: 'p',
        type: Number,
        defaultValue: 9000,
        description: 'The port on which to run the web server. Defaults to 9000.',
        group: 'server'
    },
    timeout: {
        alias: 't',
        type: Number,
        description: 'The number of milliseconds to run a request for before timeout. This timeout will not apply if debugging.',
        group: 'server'
    }
};

clc.define('server', clc.exitOnErrorHandler(server), {
    description: 'Start a server listening for REST requests.',
    synopsis: [
        '[OPTIONS]... [DIRECTORY]'
    ],
    defaultOption: 'src',
    groups: {
        connector: 'Connector Options',
        resource: 'Resource Options',
        server: 'Server Options'
    },
    options: Object.assign({}, cliServer.options, cliConnector.options, resource.options)
});