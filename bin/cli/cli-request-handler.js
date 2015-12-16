"use strict";
// This file defines the command line interface for requests.

var clc             = require('./clc');
var dbConnection    = require('../modules/db-connection');
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
        request: 'Request Options',
        resource: 'Resource Options'
    },
    options: Object.assign({}, requestHandler.options, dbConnection.options, resource.options)
});

function cliRequestHandler(err, configuration) {
    var config;
    var query;
    var urlParts;
    if (err || configuration.help) return;

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

    requestHandler(Object.assign({}, configuration, config))
        .then(function(request) {
            return request({
                body: configuration.body,
                cookies: buildMapFromKvArguments(configuration.cookie),
                headers: buildMapFromKvArguments(configuration.header),
                method: configuration.method,
                query: buildMapFromKvArguments(configuration.query),
                url: configuration.url
            });
        })
        .then(function(result) {
            console.log(result);
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
