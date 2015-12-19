"use strict";
// This file provides logging and profiling utilities.
var clc                 = require('../cli/clc');
var LogError            = require('./custom-error')('Log')('exists');
var rollingFile         = require('./rolling-file');

var isWindows = /^win/.test(process.platform);
var logger;

module.exports = function(configuration) {
    if (logger) throw new LogError('Logger has already been created');
    logger = log(configuration);
    return logger;
};

function log(configuration) {
    var config = clc.options.camelCase(clc.options.normalize(log.options, configuration, true));
    var file;
    var origin = {};

    origin.stdout = process.stdout.write;
    origin.stderr = process.stderr.write;

    if (config.logFile) file = rollingFile(config.logFile, config.logSize);

    process.stdout.write = intercept('stdout');
    process.stderr.write = intercept('stderr');

    function intercept(type) {
        return function(content) {
            var item;
            var source;

            if (file) {
                item = {
                    content: content,
                    pid: process.pid,
                    time: Date.now(),
                    type: type === 'stderr' ? 'error' : 'log'
                };
                if (config.logSource) {
                    source = get_source();
                    item.source = source.file;
                    item.line = source.line;
                }
                file.write(JSON.stringify(item));
            }

            origin[type].call(process[type], content);
        }
    }

}

log.options = {
    'log-file': {
        alias: 'l',
        type: String,
        description: 'The path of where to save logs. If omitted then logs will be output to the console.',
        group: 'log'
    },
    'log-size': {
        type: String,
        description: 'The size to allow log files to reach before creating a new log file.',
        help: 'This value should be a number with a byte size indicator. For example: 2GB.',
        defaultValue: '2GB',
        group: 'log'
    },
    'log-source': {
        type: Boolean,
        description: 'Include the file and line number in the log that produced log entry.',
        help: 'Enabling this option will cause a substantial performance penalty.',
        defaultValue: false,
        group: 'log'
    }
};

function get_source() {
    var ar;
    var line = (new Error()).stack.split('\n')[4];
    var source = /\(([\S]+)\)/.exec(line);
    if (source) {
        ar = source[1].split(':');
        return {
            line: ar[1],
            file: ar[0]
        }
    }
}

function get_stack() {
    return (new Error()).stack.split('\n');
/*
    var orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack){ return stack; };
    var err = new Error;
    Error.captureStackTrace(err, arguments.callee);
    var stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;*/
}