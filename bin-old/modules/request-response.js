"use strict";

module.exports = response;

function response() {
    var coreValues = {
        contentType: 'text/plain',
        status: 200
    };
    var delegateValues = {};
    var factory = {};


    factory.core = {};

    factory.core.contentType = function(type) {
        coreValues.contentType = type;
        return factory.core;
    };

    factory.core.get = function() {
        return {
            contentType: delegateValues.contentType || coreValues.contentType,
            status: delegateValues.status || coreValues.status
        };
    };

    factory.core.status = function(code) {
        coreValues.status = code;
        return factory.core;
    };



    factory.delegate = {};

    factory.delegate.contentType = function(type) {
        delegateValues.contentType = type;
        return factory.delegate;
    };

    factory.delegate.status = function(code) {
        delegateValues.status = code;
        return factory.delegate;
    };

    return factory;
}