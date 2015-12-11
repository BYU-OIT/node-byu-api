#!/usr/bin/env node

require('./modules/cli-connector.js');
require('./modules/cli-db-connection.js');
require('./modules/cli-request-handler.js');
require('./modules/cli-server.js');

require('./modules/clc').evaluate();




/*
node-byu-api connectors
node-byu-api debug
node-byu-api run /resource/resourceId/subResource/subResourceId --header Content-Type=application/json --body blah
node-byu-api help
*/