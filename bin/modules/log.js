"use strict";
// This file provides logging and profiling utilities.

module.exports = log;

function log(configuration) {

}

log.options = {
    'log-append': {
        alias: 'a',
        type: Boolean,
        description: 'If a log file is specified then true will cause logs to append to the file and false will overwrite the file. Defaults to true',
        defaultValue: true,
        group: 'log'
    },
    logfile: {
        alias: 'l',
        type: String,
        description: 'The path of where to save logs. If omitted then logs will be output to the console.',
        group: 'log'
    },
    verbose: {
        alias: 'v',
        type: Boolean,
        description: 'Use this flag to provide in depth data logs, including profiling and stack information.',
        help: 'There is a substantial performance penalty for turning this on, so you may not want to use it in production.',
        group: 'log'
    }
};