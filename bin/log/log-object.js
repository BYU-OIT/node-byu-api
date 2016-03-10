"use strict";

module.exports = LogObject;

function LogObject(message, type, data) {
    var result = Object.create(LogObject.prototype);
    if (!data) data = {};

    result.message = injectParameters(message, data);
    result.data = data;
    result.data.type = type;

    return result;
}

function injectParameters(str, data) {
    var index = 0;
    var match;
    var result = '';
    var rx = /(?:^|(\W)):(\w+)/g;

    while (match = rx.exec(str)) {
        result += str.substring(index, match.index);
        result += data.hasOwnProperty(match[2]) ? (typeof match[1] !== 'undefined' ? match[1] : '') + data[match[2]] : match[0];
        index = match.index + match[0].length;
    }

    result += str.substr(index);
    return result;
}