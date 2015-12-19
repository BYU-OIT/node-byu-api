
module.exports = function(timeoutDelay, timeoutCallback) {
    var factory = {};
    var store = [];

    factory.add = function(value) {
        var i;
        var item;

        for (i = 0; i < arguments.length; i++) {
            item = {};
            item.value = arguments[i];
            if (timeoutDelay >= 0) {
                item.timeoutId = setTimeout(function () {
                    var index = store.indexOf(item);
                    if (index !== -1) {
                        store.splice(index, 1);
                        timeoutCallback(value)
                    }
                }, timeoutDelay);
            }
            store.push(item);
        }
    };

    factory.get = function() {
        var item;
        if (store.length > 0) {
            item = store.shift();
            clearTimeout(item.timeoutId);
            return item.value;
        }
    };

    Object.defineProperty(factory, 'length', {
        enumerable: true,
        get: function() {
            return store.length;
        }
    });


    return factory;
};