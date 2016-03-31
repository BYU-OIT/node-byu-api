"use strict";
// This file defines the command line interface for requests.

var clc             = require('./clc');
var connFile        = require('../../bin/database/configuration-file');
var log             = require('../modules/log');
var requestHandler  = require('../modules/request-handler');
var resource        = require('../modules/resource');

clc.define('request', cliRequestHandler, {
    description: 'Perform a REST request from the command line.',
    defaultOption: 'url',
    synopsis: [
        '[OPTIONS]... [URL]'
    ],
    groups: {
        connection: 'Connection Options',
        log: 'Log Options',
        request: 'Request Options',
        resource: 'Resource Options'
    },
    options: Object.assign({}, requestHandler.options, connFile.options, log.options, resource.options)
});

function cliRequestHandler(err, configuration) {
    if (err || configuration.help) return;

    requestHandler(configuration)
        .then(function(request) {
            var config;
            var query;
            var res;
            var store = {};
            var urlParts;

            //get query string off URL
            urlParts = configuration.url.split('?');
            query = {};
            if (urlParts[1]) {
                urlParts[1].split('&').forEach(function(pair) {
                    var data = pair.split('=');
                    query[data[0]] = query[data[1]];
                });
            }

            //build request object
            config = {};
            config.body = configuration.body;
            config.cookies = buildMapFromKvArguments(configuration.cookie);
            config.headers = buildMapFromKvArguments(configuration.header);
            config.method = configuration.method;
            config.query = Object.assign(query, buildMapFromKvArguments(configuration.query));
            config.url = urlParts[0];

            //build a response object
            res = {
                send: function(data) {
                    console.log('Status Code: ' + store.status);
                    console.log(data);
                    return res;
                },
                status: function(code) {
                    store.status = code;
                    return res;
                }
            };

            return request(config, res);
        })
        .then(function(result) {
            //console.log(result);
        });
}

function buildMapFromKvArguments(array) {
    var result = {};
    if (Array.isArray(array)) {
        array.forEach(function (kvArg) {
            Object.assign(result, kvArg);
        });
    }
    return result;
}
