"use strict";
var CustomError     = require('custom-error-instance');
var defineGetter    = require('../util/define-getter');
var is              = require('../util/is');
var Promise         = require('bluebird');
var promiseWrap     = require('../util/promise-wrap');
var schemata        = require('object-schemata');
var uniqueId        = require('../util/unique-id');

var Err = CustomError('ReqHandleError');
Err.interface = CustomError(Err, { code: 'EIFCE' });
Err.s400 = CustomError(Err, { code: 'E400', message: 'Bad request' });
Err.s404 = CustomError(Err.s400, { code: 'E404', message: 'Not found' });
Err.s405 = CustomError(Err.s400, { code: 'E405', message: 'Method not supported' });
Err.s500 = CustomError(Err, { code: 'E500', message: 'Server error' });
Err.s501 = CustomError(Err, { code: 'E501', message: 'Not implemented' });
Err.status = CustomError(Err, { code: 'ESTAT', message: 'Invalid status code.' });

var httpStatusCodes = [
    100, 101, 102,
    200, 201, 202, 203, 204, 205, 206, 207, 208, 226,
    300, 301, 302, 303, 304, 305, 306, 307, 308,
    400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 426, 428, 429, 431, 451,
    500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511
];

module.exports = Handler;

function Handler(interfaces) {
    var manager;
    var resource;

    // validate that all needed interfaces are present
    if (!interfaces) throw Err.interface('Invalid interface description.');
    if (!interfaces.hasOwnProperty('manager')) throw Err.interface('Missing required database manager interface.');
    if (!interfaces.hasOwnProperty('resource')) throw Err.interface('Missing required resource interface.');

    manager = interfaces.manager;
    resource = interfaces.resources;

    return function(configuration) {
        try {
            var config = Handler.schema.normalize(configuration);
            var dbConnNames;
            var dbInterface;
            var defaultCode;
            var deferred = defer();
            var id;
            var match;
            var o;
            var params;
            var resourceDef;
            var request;
            var response;

            // separate any query parameters from the url and add them to the query object
            o = separateQueryFromUrl(config.url);
            config.url = o.url.replace(/^\/+/, '').replace(/\/+$/, '');
            config.query = Object.assign({}, o.query, config.query);

            // get the url components
            match = /^(?:(meta)\/)?([ \S]+?)(?:\/([ \S]+?))?(?:\/([ \S]+?))?(?:\/([ \S]+?))?$/.exec(config.url);
            if (!match) return reject(Err.s404());

            // build initial params object
            params = {
                fieldset: void 0,
                meta: !!match[1],
                method: config.method,
                resource: resource.get(match[2]),
                resource_def: null,
                resource_id: match[3] ? match[3].split(',') : void 0,
                resource_name: match[2],
                sub_resources: {},
                sub_resources_def: {},
                sub_resource_id: match[3] && match[4] ? match[4].split(',') : void 0,
                sub_resource_name: match[3] || void 0
            };

            // if the resource isn't defined or the method isn't supported then reject
            if (!params.resource) return reject(Err.s404('Resource not found: ' + params.resource_name));
            if (!params.resource.hasOwnProperty(params.method)) return reject(Err.s405());

            // determine field sets from params and definition file
            params.fieldset = getFieldSets(params, resource);

            // build resource definition instance and getter
            resourceDef = resource.definition(params.resource_name).instance();
            resourceDef.applyQueryParameters(config.query);
            defineGetter(params, 'resource_def', () => resourceDef.data);

            // define getters for sub-resources
            Object.keys(params.fieldset).forEach(function (subResourceName) {
                var def = resource.definition(params.resource_name).instance();
                defineGetter(params.sub_resources, subResourceName, () => resource.get(params.resource_name, subResourceName));
                defineGetter(params.sub_resources_def, subResourceName, () => def.data);
            });

            // get a unique array of database connection names from the definition files
            dbConnNames = [];
            getDefinitionDbNames(dbConnNames, params.resource_def);
            Object.keys(params.sub_resources_def).forEach(function(name) {
                getDefinitionDbNames(dbConnNames, params.sub_resources_def[name]);
            });

            // get the database interface
            id = uniqueId();
            dbInterface = manager.connections(id, dbConnNames);

            // build the request object
            request = Object.assign({}, config);
            delete request.timeout;
            Object.freeze(request);

            // determine the default status code
            switch (config.method) {
                case 'post':    defaultCode = 201; break;
                case 'delete':  defaultCode = 204; break;
                default:        defaultCode = 200;
            }

            // build the response object
            response = getResponseObject(defaultCode, deferred, config.timeout);

            // call the resource
            promiseWrap(() => params.resource(dbInterface.connections, params, request, response))
                .then(response.send)
                .catch(function(e) {
                    response.status(500);
                    response.send('Internal server error.');
                });

            // return the deferred promise
            return deferred.promise;

        } catch (e) {
            return Promise.reject(e);
        }
    };
}

Handler.methods = ['get', 'head', 'post', 'put', 'delete', 'trace', 'options', 'connect', 'path'];

Handler.schema = schemata({
    body: {
        defaultValue: '',
        help: 'The body must be a string.',
        validate: is.string
    },
    cookie: {
        defaultValue: {},
        help: 'The cookie must be a non-null object.',
        validate: is.object
    },
    header: {
        defaultValue: {},
        help: 'The header must be a non-null object.',
        validate: is.object
    },
    method: {
        defaultValue: 'get',
        help: 'The method must be one of: ' + Handler.methods.join(', '),
        transform: (value) => value.toLowerCase(),
        validate: (value) => Handler.methods.indexOf(value.toLowerCase()) !== -1
    },
    query: {
        defaultValue: {},
        help: 'The query must be a non-null object.',
        validate: is.object
    },
    timeout: {
        defaultValue: 30000,
        help: 'The timeout must be a non-negative number.',
        validate: is.nonNegativeNumber
    },
    url: {
        required: true,
        help: 'The url must be a string.',
        validate: is.string
    }
});

/**
 * Get the names of database connections to use from a definition object.
 * @param {string[]} store The store to save unique names to.
 * @param {object} def The definition object.
 * @returns {string[]}
 */
function getDefinitionDbNames(store, def) {
    if (def && def.metadata && Array.isArray(def.db_names)) {
        def.db_names.forEach(function(name) {
            if (store.indexOf(name) === -1) store.push(name);
        });
    }
    return store;
}

/**
 * Get the names of all field sets to use based on the query and definition file.
 * @param {object} params
 * @param {object} resource
 * @returns {string[]}
 */
function getFieldSets(params, resource) {
    var def;
    var i;
    var metadata;
    var result = [];

    // if there is no sub-resource name and we're not in meta then we need to determine the field sets
    if (!params.sub_resource_name && !params.meta) {
        result = [];
        def = resource.definition(params.resource_name);
        metadata = def.metadata;

        //if the query defines context then attempt to match context to field set
        if (config.query.context) {
            result = def.context(config.query.context);
            if (!result) throw Err.s400('Invalid context specified: ' + config.query.context);
        }

        //add to the field sets
        if (config.query.fieldset) {
            config.query.fieldset.split(',').forEach(function (name) {
                if (result.indexOf(name) === -1) result.push(name);
            });
        }

        //if there is no context and there is no field set then use the default field set
        if (!config.query.context && !config.query.fieldset) {
            result = metadata.default_field_sets;
        }

        // validate field sets that will be used
        for (i = 0; i < result.length; i++) {
            name = result[i];
            if (metadata.field_sets_available.indexOf(name) === -1) throw Err.s404('Sub resource not available: ' + params.resource_name + '/' + name);
            if (!resource.get(params.resource, name)) throw Err.s501('Sub resource does not exist: ' + params.resource_name + '/' + name);
        }
    }

    return result.slice(0);
}

/**
 * Get a response object that will be sent to the resource handler.
 * @param defaultCode
 * @param deferred
 * @param timeout
 * @returns {object}
 */
function getResponseObject(defaultCode, deferred, timeout) {
    var data = {
        body: void 0,
        code: defaultCode,
        headers: {}
    };
    var factory = {};
    var timeoutId;

    /**
     * Mark the request as handled.
     */
    factory.end = function() {
        deferred.resolve(data);
    };

    /**
     * Get a set header.
     * @param {string} key
     */
    factory.get = function(key) {
        return data.headers[key.toLowerCase()];
    };

    factory.resetTimeout = function() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(function () {
            if (q.isPending(deferred.promise)) {
                factory.status(408);
                deferred.resolve('Request timeout');
            }
        }, timeout);
    };

    /**
     * Specify content to send and end the handler.
     * @param {*} content
     */
    factory.send = function(content) {
        data.body = content;
        factory.end();
    };

    /**
     * Set one or more headers.
     * @param {string, object} key
     * @param {string} [value]
     */
    factory.set = function(key, value) {
        if (typeof key === 'object' && key) {
            Object.keys(key).forEach(function(k) {
                data.headers[k.toLowerCase()] = key[k];
            });
        } else {
            data.headers[key.toLowerCase()] = value;
        }
    };

    /**
     * Set the status code.
     * @param {number} code
     * @returns {number}
     */
    factory.status = function(code) {
        if (arguments.length > 0) {
            if (httpStatusCodes.indexOf(code) === -1) throw Err.status();
            data.code = value;
        }
        return data.code;
    };

    /**
     * Tell the result processor that progress is being made and to reset timeout.
     */
    factory.working = function() {
        if (timeout >= 0) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(function () {
                if (q.isPending(deferred.promise)) {
                    factory.status(408);
                    factory.send('Request timed out');
                }
            }, timeout);
        }
    };

    return factory;
}

/**
 * Pull the query string off of the URL and generate an object map of query values. Return both the url without query
 * and the query object map.
 * @param {string} url
 * @returns {object}
 */
function separateQueryFromUrl(url) {
    var ar;
    var result = {};

    ar = url.split('?');
    result.url = ar[0];

    result.query = {};
    if (ar[1]) {
        ar = ar[1].split('#')[0];
        result.query = ar
            .split('&')
            .reduce(function(prev, current) {
                var ar = current.split('=');
                var value = ar[1] || '';
                prev[ar[0]] = value;
                return prev;
            }, {});
    }

    return result;
}