"use strict";
const Path          = require('path');
const source        = require('../util/source');

const originalConsole = Object.assign({}, console);
const originalWrite = {
    stderr: process.stderr.write,
    stdout: process.stdout.write
};
const store = [];


/**
 * Add a log filter.
 * @param {string} path The file path to filter off of.
 * @param {string} detail The amount of detail to display, one of: 'none', 'minimal', 'developer', 'verbose'.
 * @param {string} stdout Where to output stdout. If an empty string then the console is used, otherwise it should specify a file path.
 * @param {string} stderr Where to output stderr. If an empty string then the console is used, otherwise it should specify a file path.
 */
exports.filter = function(path, detail, stdout, stderr) {
    store.push({
        depth: Path.resolve(process.cwd(), path).split(Path.sep).length,
        path: path,
        detail: detail,
        stdout: stdout,
        stderr: stderr
    });
    store.sort(function(a, b) {
        if (a.depth === b.depth) return a.path < b.path ? -1 : 1;
        return a.depth < b.depth ? -1 : 1;
    });
};

//TODO: working here - rewriting how log works

exports.getLogObject = function(level, depth, args) {
    var data = args[2] || {};
    var message = args[0];
    var s = source(depth);
    var type = args[1];
    return {
        message: injectParameters(message, data),
        type: type,
        data: data,
        level: level,
        pid: process.pid,
        source: s.source,
        time: Date.now()
    };
};





function formatLogObject(obj) {

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