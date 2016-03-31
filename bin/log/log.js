"use strict";
const at            = require('console-at');
const chalk         = require('chalk');
const path          = require('path');

const listeners = [];
const map = {
    error: 'red',
    info: 'blue',
    log: 'green',
    warn: 'yellow'
};

/*
 * @exports
 * @type {{ error: function, info: function, warn: function }}
 */
Object.defineProperty(module.exports, 'exports', {
    enumerable: true,
    configurable: true,
    get: function() {
        const factory = {};
        const source = at(4);
        const name = path.relative(__dirname + '/../', source.file).replace(/\.[a-z0-9]+/i, '');

        ['error', 'info', 'warn'].forEach(function(key) {
            factory[key] = logger(false, name, key);
            factory[key].at = logger(true, name, key);
        });

        factory.addEventListener = addEventListener;
        factory.removeEventListener = removeEventListener;
        
        return factory;
    }
});


function addEventListener(callback) {
    listeners.push(callback);
}

function build(key, name, args) {
    var message;
    var params;
    var type;

    if (typeof args[0] === 'string' && typeof args[1] === 'string') {
        type = args[0];
        message = args[1];
        params = args[2] || null;
    } else {
        type = null;
        message = args[0] || '';
        params = typeof args[1] === 'object' ? args[1] : null;
    }

    const result = {
        level: key,
        message: message,
        params: params,
        source: name,
        type: type
    };
    result.detail = format(false, result);
    Object.freeze(result);

    return result;
}

function createEvent() {
    const result = {};
    var defaultPrevented = false;
    var sourceAdded = false;

    result.preventDefault = function() {
        defaultPrevented = true;
    };

    result.addSource = function() {
        sourceAdded = true;
    };

    Object.defineProperty(result, 'defaultPrevented', {
        enumerable: true,
        configurable: false,
        get: function() {
            return defaultPrevented;
        }
    });

    Object.defineProperty(result, 'sourceAdded', {
        enumerable: true,
        configurable: false,
        get: function() {
            return sourceAdded;
        }
    });

    return result;
}

function format(addSource, data) {
    var color = map[data.level];
    var line = addSource ? at(2).line : void 0;
    var title = data.level + ' ' + data.source + (line ? ':' + line : '') + (data.type ? ' ' + data.type : '');
    return chalk.bold[color]('[' + title.toUpperCase() + ']') + ' ' +
        injectParameters(data.message, data.params);
}

function injectParameters(str, data) {
    var index = 0;
    var match;
    var result = '';
    var rx = /(?:^|(\W)):(\w+)/g;

    if (!data) return str;

    while (match = rx.exec(str)) {
        result += str.substring(index, match.index);
        result += data.hasOwnProperty(match[2]) ? (typeof match[1] !== 'undefined' ? match[1] : '') + data[match[2]] : match[0];
        index = match.index + match[0].length;
    }

    result += str.substr(index);
    return result;
}

function logger(addSource, name, key) {
    return function(type, message, params) {
        const data = build(key, name, arguments);
        const e = createEvent();
        listeners.forEach(listener => listener(e, data));
        if (e.sourceAdded) addSource = true;
        if (!e.defaultPrevented) console[key](format(addSource, data));
    };
}

function removeEventListener(callback) {
    var index = listeners.indexOf(callback);
    if (index !== -1) listeners.splice(index, 1);
}