#!/usr/bin/env node

require('./cli/cli-connection.js');
require('./cli/cli-connector.js');
require('./cli/cli-request-handler.js');
require('./cli/cli-server.js');

require('./cli/clc').evaluate();




/*
node-byu-api connectors
node-byu-api debug
node-byu-api run /resource/resourceId/subResource/subResourceId --header Content-Type=application/json --body blah
node-byu-api help
*/