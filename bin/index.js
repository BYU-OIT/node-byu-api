"use strict";
var Command         = require('command-line-callback');

require('./database/index');
require('./request/index');
require('./resource/index');

Command.evaluate();