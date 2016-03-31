"use strict";
const CustomError       = require('custom-error-instance');
const defineGetter      = require('../util/define-getter');
const is                = require('../util/is');
const log               = require('../log/log');
const Promise           = require('bluebird');
const promiseWrap       = require('../util/promise-wrap');
const Response          = require('./response');
const schemata          = require('object-schemata');

const Err = CustomError('ReqHandleError');
Err.interface = CustomError(Err, { code: 'EIFCE' });


module.exports = Handler;

/**
 *
 * @param {{ manager: object, resource: object }} interfaces
 * @returns {Function}
 */
function Handler(interfaces) {
    var manager;
    var resource;

    // validate that all needed interfaces are present
    if (!interfaces) throw Err.interface('Invalid interface description.');
    if (!interfaces.hasOwnProperty('manager')) throw Err.interface('Missing required database manager interface.');
    if (!interfaces.hasOwnProperty('resource')) throw Err.interface('Missing required resource interface.');

    manager = interfaces.manager;
    resource = interfaces.resources;

    /**
     * Make a request.
     * @params {object} configuration
     * @returns {Promise} Resolves to the response data.
     */
    return function(configuration) {
        try {
            var config = Handler.schema.normalize(configuration);
            var dbConnNames;
            var dbInterface;
            var match;
            var o;
            var params;
            var resourceDef;
            var request;
            var response = Response(config);

            // separate any query parameters from the url and add them to the query object
            o = separateQueryFromUrl(config.url);
            config.url = o.url.replace(/^\/+/, '').replace(/\/+$/, '');
            config.query = Object.assign({}, o.query, config.query);

            // make sure that the method is lower case
            config.method = config.method.toLowerCase();

            // turn all headers to lower case
            let headers = {};
            Object.keys(config.header).forEach(function(key) {
                var lcKey = key.toLowerCase();
                headers[lcKey] = config.header[key];
            });
            config.header = headers;

            // if the content type is json then turn the body into an object
            if (config.header['content-type'].toLowerCase() === 'application/json') {
                try {
                    config.body = JSON.parse(config.body);
                } catch (e) {
                    return response.send(400, 'Invalid JSON body.');
                }
            }

            // get the url components
            match = /^(?:(meta)\/)?([ \S]+?)(?:\/([ \S]+?))?(?:\/([ \S]+?))?(?:\/([ \S]+?))?$/.exec(config.url);
            if (!match) return response.sendStatus(404);

            // build initial params object
            params = {
                fieldset: void 0,
                meta: !!match[1],
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
            if (!params.resource) return response.send(404, 'Resource not found: ' + params.resource_name);
            if (!params.resource.hasOwnProperty(config.method)) return response.sendStatus(405);

            // if there is no sub-resource name and we're not in meta then we need to determine the field sets
            if (!params.sub_resource_name && !params.meta) {
                let result = [];
                let def = resource.definition(params.resource_name);
                let metadata = def.metadata;

                //if the query defines context then attempt to match context to field set
                if (config.query.context) {
                    result = def.context(config.query.context);
                    if (!result) return response.send(400, 'Invalid context: ' + config.query.context);
                }

                //add to the field sets
                if (config.query.fieldset) {
                    config.query.fieldset.split(',').forEach(function (name) {
                        if (result.indexOf(name) === -1) result.push(name);
                    });
                }

                //if there is no context and there is no field set then use the default field set
                if (!config.query.context && !config.query.fieldset) result = metadata.default_field_sets;

                // validate field sets that will be used
                for (let i = 0; i < result.length; i++) {
                    let name = result[i];
                    if (metadata.field_sets_available.indexOf(name) === -1 || !resource.get(params.resource, name)) {
                        return response.send(404, 'Sub resource not found: ' + params.resource_name + '/' + name);
                    }
                }

                params.fieldset = result;
            }

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

            // get a unique array of database database names from the definition files
            dbConnNames = [];
            getDefinitionDbNames(dbConnNames, params.resource_def);
            Object.keys(params.sub_resources_def).forEach(function(name) {
                getDefinitionDbNames(dbConnNames, params.sub_resources_def[name]);
            });

            // get the database interface
            dbInterface = manager.connections(id, dbConnNames);

            // build the request object
            request = Object.assign({}, config);
            delete request.timeout;
            Object.freeze(request);

            // call the resource
            promiseWrap(() => params.resource(dbInterface.connections, params, request, response))
                .then(response.send, response.send);

            // return the response promise
            return response.promise;

        } catch (e) {
            return Promise.reject(e);
        }
    };
}

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
        validate: (value) => typeof value === 'string'
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

function curateConfiguration(config) {
    config.method = config.method.toLowerCase();

    let headers = {};
    Object.keys(config.headers).forEach(function(key) {
        var lcKey = key.toLowerCase();
        headers[lcKey] = config.headers[key];
    });
    config.headers = headers;

}

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
                prev[ar[0]] = ar[1] || '';
                return prev;
            }, {});
    }

    return result;
}