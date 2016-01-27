var requireDir = require('./modules/require-directory');
requireDir(__dirname, -1, function(path) {
    return path !== __filename;
});