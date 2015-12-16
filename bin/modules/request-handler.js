var clc                 = require('../cli/clc');
var dbConnection        = require('./db-connection');
var Promise             = require('bluebird');
var resource            = require('./resource');

var methods = ['get', 'head', 'post', 'put', 'delete', 'trace', 'options', 'connect', 'path'];

module.exports = requestHandler;

function requestHandler(configuration) {
    var factory = {};
    var config = clc.options.normalize(requestHandler.options, configuration, true);
    var promises = [];

    promises.push(dbConnection(configuration).then(v => factory.dbConnManager = v));
    promises.push(resource(configuration).then(v => factory.resource = v));

    return Promise.all(promises).then(function() {
        return function(req, res, next) {
            var error;

            //check for and respond to pre-flight errors
            error = preFlightError(params);
            if (error) return res.status(error.status, error.message);

            try {
                result = param.resource[param.method](
                    factory.dbConnManager.connections,
                    params,
                    request(req),
                    response(res, config, factory.dbConnManager)
                );
            } catch (e) {
                factory.dbConnManager.destroy();
            }
        }
    });
}

requestHandler.options = {
    body: {
        alias: 'b',
        type: String,
        description: 'The body to send with the request.',
        defaultValue: '',
        group: 'request'
    },
    cookie: {
        alias: 'c',
        type: String,
        description: 'A key value pair that is separated by an equals. You can add multiple cookies by using multiple flags.',
        help: 'Example usage: [APPLICATION] [COMMAND] --cookie foo=value1 --cookie bar=value2',
        multiple: true,
        transform: transformKvArgument,
        validate: isKvArgument,
        group: 'request'
    },
    header: {
        alias: 'h',
        type: Object,
        description: 'A key value pair that is separated by an equals. You can add multiple headers by using multiple flags.',
        help: 'Example usage: [APPLICATION] [COMMAND] --header foo=value1 --header bar=value2',
        multiple: true,
        transform: transformKvArgument,
        validate: isKvArgument,
        group: 'request'
    },
    method: {
        alias: 'm',
        type: String,
        description: 'The HTTP method to use with the request.',
        help: 'This must be one of the following values: \n"' + methods.join('", "') + '"',
        defaultValue: 'get',
        group: 'request',
        transform: function(value) { return value.toLowerCase(); },
        validator: function(value) { return methods.indexOf(value.toLowerCase()) !== -1; }
    },
    query: {
        alias: 'q',
        type: String,
        description: 'A key value pair that is separated by an equals. You can add multiple query string parameters by using multiple flags.',
        help: 'Example usage: [APPLICATION] [COMMAND] --query foo=value1 --query bar=value2',
        multiple: true,
        transform: transformKvArgument,
        validate: isKvArgument,
        group: 'request'
    },
    timeout: {
        alias: 't',
        type: Number,
        description: 'The number of milliseconds to run a request for before timeout.',
        defaultValue: 30000,
        group: 'request'
    },
    url: {
        alias: 'u',
        type: String,
        description: 'The request URL. If you want to send query string parameters, you can add them here.',
        required: true,
        group: 'request'
    }
};

function isKvArgument(value) {
    return typeof value === 'object' && value && Object.keys(value).length === 1;
}

/**
 * Extract from the URL and the query string all of the information that is needed to
 * execute the query.
 * @param {object} resource The resource factory.
 * @param {string} url
 * @param {object} query
 * @returns {object}
 */
function parameters(resource, url, query) {
    var ar;
    var def;
    var contexts;
    var is_meta = false;
    var list;
    var params;

    //strip slashes off the front and end of the URL
    url = url.replace(/^\/+/, '').replace(/\/+$/, '');

    //split the URL
    ar = url.split('/');

    //if this is a meta request then the parameters need shifting
    if (/^meta$/i.test(ar[0])) {
        is_meta = true;
        ar[3] = ar[2];
        ar[2] = ar[1];
        ar[1] = void 0;
    }

    //build the initial params object
    params = {
        fieldset: void 0,
        meta: is_meta,
        method: req.method.toLowerCase(),
        resource: resource.get(ar[0]),
        resource_def: null,
        resource_id: ar[1] ? ar[1].split(',') : void 0,
        resource_name: ar[0],
        sub_resources: {},
        sub_resources_def: {},
        sub_resource_id: ar[2] && ar[3] ? ar[3].split(',') : void 0,
        sub_resource_name: ar[2] || void 0
    };

    //add resource definition getter that get's a new object with each call
    Object.defineProperty(params, 'resource_def', {
        enumerable: true,
        configurable: false,
        get: function() {
            return resource.definition(params.resource_name)
        }
    });

    //add sub-resource definition getters that get's a new object with each call
    Object.keys(params.sub_resources).forEach(function(subResourceName) {
        Object.defineProperty(params.sub_resources_def, subResourceName, {
            enumerable: true,
            configurable: false,
            get: function() {
                return resource.definition(params.resource_name, subResourceName);
            }
        });
    });

    //get the names of all sub modules to automatically load based on fieldset and context
    if (!params.sub_resource_name && !params.meta) {
        params.fieldset = [];

        //get the definition object
        def = resource.definition(params.resource_name);

        //if the query defines context then attempt to match content to fieldset
        if (query.context) {
            contexts = def.metadata.contexts_available;
            if (contexts && query.context in contexts) params.fieldset = def.metadata.contexts_available[query.context];
        }

        //add to the fieldset
        if (query.fieldset) {
            query.fieldset.split(',').forEach(function(name) {
                if (params.fieldset.indexOf(name) === -1) params.fieldset.push(name);
            });
        }

        //if there is no context and there is no fieldset then use the default fieldset
        if (!query.context && !query.fieldset && def.metadata.default_field_sets) {
            params.fieldset = def.metadata.default_field_sets;
        }
    }

    //get sub resource modules
    list = (params.sub_resource_name ? [params.sub_resource_name] : params.fieldset);
    list.forEach(function(subResourceName) {
        params.sub_resources[subResourceName] = resource.get(params.resource_name, subResourceName);
    });

    return params;
}

function preFlightError(params) {
    var missing;

    //404 errors
    if (!params.resource) {
        return { status: 404, message: 'Resource not found: ' + params.resource_name };
    } else {
        missing = [];
        Object.keys(params.sub_resources).forEach(function(subResourceName) {
            if (!params.sub_resources[subResourceName]) missing.push(subResourceName);
        });
        if (missing.length === 1) {
            return {
                status: 404,
                message: 'Sub-resource not found: ' + missing[0]
            };
        } else if (missing.length > 1) {
            return {
                status: 404,
                message: 'Sub-resources not found: \n\t' + missing.join('\n\t')
            };
        }
    }

    //405 errors
    if (!params.resource.hasOwnProperty(params.method)) {
        return {
            status: 405,
            message: 'Method not supported by resource: ' + params.resource_name
        };
    }
}

function response(res, config, dbConnManager) {
    var factory = Object.assign({}, res);
    var timeoutId;
    var sent = false;

    //wrap response functions that end the response with additional functionality
    ['download', 'end', 'json', 'jsonp', 'redirect', 'send', 'sendFile', 'sendStatus'].forEach(function(name) {
        var callback = res[name];
        factory[name] = function() {
            var args;
            var i;
            if (!sent) {
                args = [];
                for (i = 0; i < arguments.length; i++) {
                    args.push(arguments[i]);
                }
                callback.apply(res, args);
                clearTimeout(timeoutId);
                dbConnManager.destroy();
                sent = true;
            }
        }
    });

    /**
     * Reset the timeout countdown clock.
     * @param message
     */
    factory.resetTimeout = function() {
        if (config.timeout >= 0) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(function () {
                factory.sendStatus(408);
            }, config.timeout);
        }
    };

    //start the timeout timer
    factory.resetTimeout();

    return factory;
}

function request(req) {
    var factory = Object.assign({}, req);

    return factory;
}

function transformKvArgument(value) {
    var ar = value.split('=');
    var result;
    if (ar.length === 2) {
        result = {};
        result[ar[0]] = ar[1];
    }
    return result;
}