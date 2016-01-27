"use strict";
var configFile          = require('../connection/configuration-file');
var Connector           = require('../connection/connector');
var CustomError         = require('custom-error-instance');
var Pool                = require('../connection/pool');

var Err = CustomError('ReqConnError');
Err.dne = CustomError(Err, { code: 'EDNE' });

module.exports = function(configuration) {

    // load the configuration file
    return configFile(configuration)

        .then(function(config) {
            return function() {
                var factory = {};

                factory.connect = function(name, quantity) {
                };

                return factory;
            };
        });
};