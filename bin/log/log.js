"use strict";
const defineGetter  = require('../util/define-getter');
const exit          = require('../util/exit');
const is            = require('../util/is');
const rollingFile   = require('rolling-file');
const schemata      = require('object-schemata');
const source        = require('../util/source');
const noop          = require('../util/noop');
const path          = require('path');

const original_write = {
    stderr: process.stderr.write,
    stdout: process.stdout.write
};
var sorted = false;
var store = [];


module.exports = log;



/**
 * Specify log output instructions for a specific path.
 * @param {object} configuration The log configuration instructions.
 */
function log(configuration) {
    var config;
    var dirName;
    var fileName;
    var ext;

    // get the normalized configuration
    config = log.schema.normalize(configuration);

    // if a path exists then set up a rolling file stream
    if (config.path) {
        ext = path.extname(config.path);
        fileName = path.basename(config.path, ext);
        dirName = path.dirname(config.path);
        config.stream = rollingFile(dirName, {
            fileName: fileName,
            fileExtension: ext.substr(1),
            interval: '1 day'
        });
    }

    // determine the depth of the filter path
    config.depth = config.filter.split(path.sep).length;

    store.push(config);
    sorted = false;
}

log.schema = schemata({
    detail: {
        defaultValue: 'verbose',
        description: 'The level of detail to display in the log.',
        help: 'The detail level must be one of: "none", "minimal", "developer", "verbose".',
        validate: (v) => ['none', 'minimal', 'developer', 'verbose'].indexOf(v) !== -1
    },
    filter: {
        required: true,
        description: 'The absolute file path to specify which paths are logged.',
        help: 'The filter must be a string.',
        validate: is.string
    },
    output: {
        defaultValue: '',
        description: 'The file path of where to output logs. The path must include the file name. Set to an empty ' +
        'string to log to the console.',
        help: 'The filter must be a string.',
        validate: is.string
    },
    terminal: {
        defaultValue: false,
        description: 'Set to true to make this the last log.'
    },
    type: {
        defaultValue: 'both',
        description: 'What type of messages to log.',
        help: 'The type must be one of: "stderr", "stdout", "both".',
        validate: (v) => ['stderr', 'stdout', 'both'].indexOf(v) !== -1
    }
});

log.STDOUT = defineGetter(log, 'STDOUT', () => 'stdout');
log.STDERR = defineGetter(log, 'STDERR', () => 'stderr');
log.BOTH = defineGetter(log, 'BOTH', () => 'both');

log.MINIMAL = defineGetter(log, 'MINIMAL', () => 'minimal');
log.DEVELOPER = defineGetter(log, 'DEVELOPER', () => 'developer');
log.VERBOSE = defineGetter(log, 'VERBOSE', () => 'verbose');



// overwrite stderr and stdout write functions
['stderr', 'stdout'].forEach(function(type) {
    process[type].write = function(chunk, encoding, cb) {
        var args = arguments;
        var data;
        var developer;
        var logged = false;
        var minimal;
        var obj = null;
        var s = source(2);
        var verbose;

        // check to see if the store needs to be sorted by depth
        if (sorted === false) {
            store.sort(function(a, b) { return a.depth > b.depth ? 1 : -1 });
            sorted = true;
        }

        // if there is no chunk then exit
        if (typeof chunk === 'string' && !chunk) {
            if (typeof cb === 'function') cb();
            return;
        }

        // build the data object
        data = {
            chunk: chunk,
            data: void 0,
            pid: process.pid,
            source: s.source,
            time: Date.now(),
            type: type
        };

        // if the chunk is a log-object then the chunk should have data based on the detail level
        if (/^LogObject {/.test(chunk)) {
            eval('obj = ' + chunk.substr(10));
            data.chunk = obj.message + '\n';
            data.data = obj.data;
        } else {
            delete data.data;
        }

        // process each log hook
        store.forEach(function(item) {
            var message;
            var none;

            if (!/^\.\./.test(path.relative(item.filter, s.file))) {
                if (!logged) {

                    // determine the message to log
                    switch (item.detail) {
                        case 'none':
                            none = true;
                            break;
                        case 'minimal':
                            if (!minimal) minimal = data.chunk;
                            message = minimal;
                            break;
                        case 'developer':
                            if (!developer) developer = data.chunk + '  at ' + data.source + '\n\n';
                            message = developer;
                            break;
                        case 'verbose':
                            if (!verbose) verbose = JSON.stringify(data) + '\n';
                            message = verbose;
                            break;
                    }

                    if (item.stream) {
                        item.stream.write(message);
                    } else if (!none) {
                        if (message) args[0] = message;
                        original_write[type].apply(process[type], args);
                    }
                }
                logged = true;
            }
        });

        // if not logged then log to the console
        if (!logged) original_write[type].apply(process[type], args);
    };
});

// when the exit event is triggered, close the write streams
exit.listen(function() {
    process.stderr.write = noop;
    process.stdout.write = noop;
});

// if an uncaught error occurs then log it and exit
process.on('uncaughtException', function(err) {
    console.error(err.stack);
    process.exit(1);
});

// if a promise has an unhandled rejection then log it and exit
process.on('unhandledRejection', (reason, p) => {
    console.error("Unhandled Rejection at: Promise ", p, " reason: ", reason);
    process.exit(1);
});
