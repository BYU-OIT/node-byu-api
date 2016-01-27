"use strict";
// Manages a file write stream that automatically creates a new file once the file size limit has been reached.
var fs          = require('fs');
var path        = require('path');

module.exports = rollingFile;

/**
 * Produce a rolling file write stream that will automatically close and open new
 * streams as file size limits are reached.
 * @param {string} filePath The path of where to save the file.
 * @param {string, number} fileSize The size limit of the file before splitting
 * to a new file.
 * @returns {object}
 */
function rollingFile(filePath, fileSize) {
    var bytesLimit = parseFileSize(fileSize || '2GB');
    var bytesWritten = 0;
    var documentPath = path.resolve(process.cwd(), filePath);
    var factory = {};
    var stream;

    /**
     * Write to the rolling file.
     * @param {string} content
     */
    factory.write = function(content) {
        var length = content.length + 1;
        var suffix = new Date().toISOString().replace('.', ':').replace('T', '-').replace(/Z$/, '');

        //if the file size has hit its limit then start a new stream
        if (!stream || length + bytesWritten > bytesLimit) {
            if (stream) factory.end();
            stream = fs.createWriteStream(documentPath + '-' + suffix, { flags: 'w', encoding: 'utf8' });
            bytesWritten = 0;
        }

        //write the stream
        stream.write(content + '\n', 'utf8');
        bytesWritten += length;
    };

    /**
     * End writing.
     * @returns {Promise}
     */
    factory.end = function() {
        return new Promise(function(resolve, reject) {
            stream.write('', 'utf8', function() {
                stream.end();
            });
            stream.write = function() {};
            factory.write = function() {};
        });
    };

    return factory;
}

function parseFileSize(size) {
    var i;
    var num = parseInt(size);
    var unit = size.substr(('' + num).length).toLowerCase();
    var opt;
    var options = ['', 'k', 'm', 'g', 't'];
    for (i = 0; i < options.length; i++) {
        opt = options[i];
        if (unit === opt || unit === opt + 'b') {
            return num * Math.pow(1000, i);
        }
    }
    return num;
}