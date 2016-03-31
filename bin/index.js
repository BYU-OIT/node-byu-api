"use strict";
const Command       = require('command-line-callback');
const log           = require('./log/log');

// prevent log output
log.addEventListener(function(e, data) {
    e.preventDefault();
});

require('./database/index');
require('./request/index');
require('./resource/index');

Command.evaluate();