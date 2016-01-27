"use strict";
// This file is used to run the server that listens for requests via0 http.

var bodyParser          = require('body-parser');
var clc                 = require('../cli/clc');
var cliServer           = require('../cli/cli-server');
var connector           = require('./../../bin/connection/connector');
var cookieParser        = require('cookie-parser');
var express             = require('express');
var Promise             = require('bluebird');
var requestHandler      = require('./request-handler');

module.exports = server;

function server(configuration) {
    var resources;

    if (configuration.help) return;

    return requestHandler(configuration)
        .then(function(request) {
            var app = express();
            var config = clc.options.normalize({}, cliServer.options, configuration, true);
            var server;

            //add server middleware
            app.use(cookieParser());
            app.use(bodyParser.json());

            app.all('*', function (req, res) {
                request(req, res)
                    .then(function(result) {
                        res.json(result);
                    })
                    .catch(function(e) {

                    });
            });

            server = app.listen(config.port, function () {
                var host = server.address().address;
                var port = server.address().config.port;
                console.log('Server listening at http://%s:%s', host, port);
            });
        });


    return Promise
        .all([
            resource(configuration).then(function(results) { resources = results; }),
            connector.load()
        ])
        .then(function() {

        });
}

server.options = {
    port: {
        alias: 'p',
        type: Number,
        defaultValue: 9000,
        description: 'The port on which to run the web server. Defaults to 9000.',
        group: 'server'
    }
};