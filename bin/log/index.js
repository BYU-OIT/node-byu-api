"use strict";
var chalk           = require('chalk');
var log             = require('./log');
var path            = require('path');

var cliRun = false;
var details = ['none', 'minimal', 'developer', 'verbose'];
var descriptionHelp = 'See the section ' + chalk.italic('Log Options Explanation') + ' for more details.';

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

    // set up logging for error, framework, and profile
    exports.processOption(config.logError.detail, config.logError.location, log.STDERR, '/');
    exports.processOption(config.logFramework.detail, config.logFramework.location, log.BOTH, '/');
    exports.processOption(config.logProfile.detail, config.logProfile.location, log.BOTH, '/');
};

/**
 * Build a command line option object.
 * @params {string} description A description to prefix the extra help for the option.
 * @returns {{type: String, description: string, defaultValue: string, transform: function, validate: function, group: string}}
 */
exports.buildOption = function(description) {
    return {
        type: String,
        description: description + descriptionHelp,
        defaultValue: ':developer',
        transform: transform,
        validate: validate,
        group: 'log'
    }
};

exports.details = function() {
    return details.slice(0);
};

exports.helpSection = function() {
    return {
        title: 'Log Options Explanation',
        body: 'For each log option you can specify where to log output as well as at what level of detail. ' +
        'This is done by separating the two values by a colon (:). The string before the colon (:) represents '
        + chalk.bold('where') + ' to output logs and the string after the colon (:) specifies the '
        + chalk.bold('level of detail') + '. For example: ' + chalk.italic('--log-framework [LOCATION]:[DETAIL]') + '\n\n' +
        chalk.bold('Where:') + ' If the where is an empty string it will log to the console, otherwise it will ' +
        'interpret the string as a file system path and save to the location specified.\n\n' +
        chalk.bold('Level of Detail:') + ' This value can be one of: "' + details.join('", "') + '".',
        beforeOptions: false
    }
};

// define the command line options
exports.options = {
    logError: {
        type: String,
        description: 'Errors are logged along side non-errors for each log type. Additionally just errors ' +
            'can also be logged to a second specific location. ' + descriptionHelp,
        defaultValue: ':none',
        transform: transform,
        validate: validate,
        group: 'log'
    },
    logFramework: {
        type: String,
        description: 'For framework logs. ' + descriptionHelp,
        defaultValue: ':minimal',
        transform: transform,
        validate: validate,
        group: 'log'
    },
    logProfile: {
        type: String,
        description: 'For profile logs. ' + descriptionHelp,
        defaultValue: ':minimal',
        transform: transform,
        validate: validate,
        group: 'log'
    },
    logResource: {
        type: String,
        description: 'For resource logs. ' + descriptionHelp,
        defaultValue: ':developer',
        transform: transform,
        validate: validate,
        group: 'log'
    }
};

/**
 * Process an option and tell the logger how to log it.
 * @param {string} detail The level of detail to acquire.
 * @param {string} output Where to put the output.
 * @param {string} type The type of output: stdout, stderr, both
 * @param {string} filter A file path to match before logging.
 */
exports.processOption = function(detail, output, type, filter) {
    if (detail !== 'none') {
        log({
            detail: detail,
            filter: filter,
            output: output,
            type: type
        });
    }
};


function transform(value) {
    var ar = value.split(':');
    return { location: ar[0], detail: ar[1] || 'developer' };
}

function validate(value) {
    var ar = value.split(':');
    var detail = ar[1] || 'developer';
    return details.indexOf(detail) !== -1;
}