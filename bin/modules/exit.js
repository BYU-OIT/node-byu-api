"use strict";
var Promise         = require('bluebird');

var store = [];

exports.listen = function(callback) {
    store.push(callback);
};

exports.unlisten = function(callback) {
    var index = store.indexOf(callback);
    if (index !== -1) store.splice(index, 1);
};


//overwrite the process.exit function
process.exit = (function(exit) {
    return function(code) {
        var promises;
        console.log('Process exit invoked');

        //create promises from the results of each callback
        promises = [];
        store.forEach(function(callback) {
            var result;
            try {
                callback();
                promises.push(Promise.resolve(result).reflect());
            } catch (e) {
                promises.push(Promise.resolve());
            }
        });

        Promise.all(promises).then(function() {
            exit(code);
        });
    }
})(process.exit);

process.on('SIGINT', function() {
    console.log('SIGINT signal received');
    process.exit(0);
});

process.on('exit', function() {
    console.log('Process exit inevitable');
});