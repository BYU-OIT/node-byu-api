"use strict";
const defer             = require('../util/defer');
const httpStatusCodes   = require('http-status-code');
const is                = require('../util/is');
const uniqueId          = require('../util/unique-id');
const log               = require('../log/log');
const schemata          = require('object-schemata');

module.exports = Response;


/**
 * @class
 * @param configuration
 * @returns {Response}
 * @constructor
 */
function Response(configuration) {
    const config = Response.schema.normalize(configuration || {});
    const deferred = defer();
    const data = {
        body: void 0,
        headers: {},
        status: 0
    };
    const factory = Object.create(Response.prototype);
    const start = Date.now();
    const requestId = uniqueId();
    var timeoutId;

    function error(err) {
        log.error('error', 'Request [:id] error: :stack', {
            id: requestId,
            stack: err.stack
        });
        if (!factory.sent) factory.sendStatus(500);
        return false;
    }


    /**
     * Mark the request as handled.
     * @name Response#end
     * @returns {Response}
     */
    factory.end = function() {
        if (!factory.sent) {
            updateStatusCode(data, config);
            deferred.resolve(Object.assign({}, data));
            log.info('completed', 'Request [:id] completed with :status in :duration milliseconds', {
                id: requestId,
                duration: Date.now() - start,
                status: data.status
            });
        } else {
            error(Error('Response already sent.'));
        }
        return factory;
    };

    /**
     * Get a set header.
     * @name Response#get
     * @param {string} key
     * @returns {string, undefined}
     */
    factory.get = function(key) {
        return data.headers[key.toLowerCase()];
    };

    /**
     * @name Response#promise
     * @type Promise
     * @readonly
     */
    Object.defineProperty(factory, 'promise', {
        enumerable: true,
        configurable: false,
        get: () => deferred.promise
    });

    /**
     * Specify content to send and end the handler.
     * @name Response#send
     * @param {number} [code]
     * @param {string, Error, Object, *} content
     * @returns {Response}
     */
    factory.send = function(code, content) {
        if (arguments.length > 0 && !factory.sent) {
            let contentType = factory.get('content-type');

            if (arguments.length > 1) {
                factory.status(code);
            } else {
                content = arguments[0];
            }

            if (content instanceof Error) {
                return error(content);

            } else if (typeof content === 'object' && (!contentType || contentType.toLowerCase() === 'application/json')) {
                try {
                    data.body = JSON.stringify(content);
                    if (!factory.get('content-type')) factory.set('content-type', 'application/json');
                } catch (err) {
                    return error(err)
                }
            } else {
                data.body = '' + content;
            }

        }
        factory.end();
        return factory;
    };

    /**
     * Set the status code with default message.
     * @name Response#sendStatus
     * @param {number} code The status code.
     * @returns {Response}
     */
    factory.sendStatus = function(code) {
        factory.set('content-type', 'text/plain');
        if (statusCodeIsValid(code)) {
            factory.status(code);
            data.body = getStatsMessage(code);
        } else {
            error(Error('Invalid status code: ' + code));
        }
        factory.end();
        return factory;
    };

    /**
     * @name Response#sent
     * @type boolean
     * @readonly
     */
    Object.defineProperty(factory, 'sent', {
        enumerable: true,
        configurable: false,
        get: () => !deferred.promise.isPending()
    });

    /**
     * Set one or more headers.
     * @name Response#set
     * @param {string, object} key
     * @param {string} [value]
     * @returns {object}
     */
    factory.set = function(key, value) {
        if (typeof key === 'object' && key) {
            Object.keys(key).forEach(function(k) {
                data.headers[k.toLowerCase()] = key[k];
            });
        } else {
            data.headers[key.toLowerCase()] = value;
        }
        return factory;
    };

    /**
     * Set the status code.
     * @name Response#status
     * @param {number} code
     * @returns {number, Response}
     */
    factory.status = function(code) {
        if (arguments.length > 0) {
            if (!statusCodeIsValid(code)) {
                log.error('status', 'Unknown status code :code at :stack', {
                    code: code,
                    stack: Error().stack
                });
            } else {
                data.status = code;
            }
            return factory;
        } else {
            return data.status;
        }
    };

    /**
     * Tell the result processor that progress is being made and to reset timeout.
     * @returns {Response}
     */
    factory.working = function() {
        if (config.timeout >= 0) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(function () {
                if (!factory.sent) factory.sendStatus(408);
            }, config.timeout);
        }
        return factory;
    };




    // log the start of the request
    log.info('received', 'Request [:id] received :method :url at :time', {
        id: requestId,
        method: config.method,
        time: start,
        url: config.url
    });


    // start timeout
    factory.working();

    return factory;
}

Response.schema = schemata({
    method: {
        defaultValue: 'get',
        help: 'The method must be a string.',
        transform: (value) => value.toLowerCase(),
        validate: is.string
    },
    timeout: {
        defaultValue: 30000,
        help: 'The timeout must be a non-negative number.',
        validate: is.nonNegativeNumber
    },
    url: {
        defaultValue: '',
        help: 'The url must be a string.',
        validate: is.string
    }
});

function getStatsMessage(code) {
    return httpStatusCodes.getMessage(code, null);
}

// determine the default status code
function updateStatusCode(data, config) {
    if (!statusCodeIsValid(data.status)) {
        if (config.method === 'post') {
            data.status = 201;
        } else if (data.body && data.body.length > 0) {
            data.status = 200;
        } else {
            data.status = 204;
        }
    }
}

/**
 * Determine if a status code is valid.
 * @param {number} code
 * @returns {boolean}
 */
function statusCodeIsValid(code) {
    return httpStatusCodes.getMessage(code, null) !== 'Unknown';
}