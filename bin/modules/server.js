var bodyParser          = require('body-parser');
var clc                 = require('./clc');
var connector           = require('./connector');
var cookieParser        = require('cookie-parser');
var express             = require('express');
var file                = require('./file');
var path                = require('path');
var Promise             = require('bluebird');
var resource            = require('./resource');

module.exports = server;

function server(configuration) {
    var promises = [];

    promises.push(resource.load(configuration));
    promises.push(connector.load(configuration));

    return Promise.all(promises)
        .then(function() {
            var app = express();
            var cliServer = require('./cli-server');
            var config = clc.options.normalize(cliServer.options, configuration, true);

            //add server middleware
            app.use(cookieParser());
            app.use(bodyParser.json());

            app.get('*', function (req, res) {
                res.send('Hello World!');
            });

            app.listen(config.port, function () {
                var host = server.address().address;
                var port = server.address().config.port;
                console.log('Server listening at http://%s:%s', host, port);
            });
        });
}

