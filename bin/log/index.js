"use strict";
var chalk           = require('chalk');
var log             = require('./log');
var path            = require('path');

var cliRun = false;

/**
 * Configure logging for "all", "framework", and custom directives. Logging for resources will
 * be handled by the resource loader.
 * @param {object} config
 */
exports.cli = function(config) {
    var filter;

    // only allow this to be run once
    if (cliRun) return;
    cliRun = true;

    if (config.logConsoleAll !== 'none') {
        log({ detail: config.logConsoleAll, filter: '/', output: '', type: 'both' });
    }

    if (config.logConsoleFramework !== 'none') {
        filter = path.resolve(__dirname, '../../');
        log({ detail: config.logConsoleAll, filter: filter, output: '', type: 'both' });
    }

    if (config.logFileAll) {
        log({ detail: 'verbose', filter: '/', output: config.logFileAll, type: 'both' });
    }

    if (config.logFileFramework) {
        filter = path.resolve(__dirname, '../../');
        log({ detail: 'verbose', filter: filter, output: config.logFileFramework, type: 'both' });
    }

    if (config.log) {
        config.log.forEach(function(config) {
            log(config);
        });
    }
};

exports.details = ['none', 'minimal', 'developer', 'verbose'];

exports.options = {
    log: {
        type: Object,
        description: 'A log output directive with specific instructions. This should be formatted as JSON and takes ' +
        'the following pattern: { "detail": "developer", "filter": "/", "output": "", "type: "both" }.\n\nThe ' +
        chalk.bold('detail') + ' property can be one of "minimal", "developer", or "verbose".\n\nThe ' + chalk.bold('filter') +
        ' property is used to match the file paths of what is being logged. Only file paths that fall within this path ' +
        'will output with these log instructions.\n\nThe ' + chalk.bold('output') + ' property specifies where logs should ' +
        'be output. Specifying a file path will write logs to a file or leaving this as a blank string will output the ' +
        'log to the console.\n\nThe ' + chalk.bold('type') + ' property can be one of "stderr", "stdout", or "both".',
        defaultValue: {
            detail: 'developer',
            filter: '/',
            output: '',
            type: 'both'
        },
        validate: (v) => log.schema.validate(v),
        transform: (v) => log.schema.normalize(v),
        multiple: true,
        group: 'log'
    },
    logConsoleAll: {
        type: String,
        description: 'The level of details to log all output with. The value must be one of: ' + exports.details.join(', '),
        defaultValue: 'developer',
        validate: (v) => exports.details.indexOf(v) !== -1,
        group: 'log'
    },
    logConsoleFramework: {
        type: String,
        description: 'The level of details to log framework output with. The value must be one of: ' + exports.details.join(', '),
        defaultValue: 'none',
        validate: (v) => exports.details.indexOf(v) !== -1,
        group: 'log'
    },
    logFileAll: {
        type: String,
        description: 'The file path to log all logs to. Use an empty string to not log to a file.',
        defaultValue: '',
        group: 'log'
    },
    logFileFramework: {
        type: String,
        description: 'The file path to log framework logs to. Use an empty string to not log to a file.',
        defaultValue: '',
        group: 'log'
    }
};