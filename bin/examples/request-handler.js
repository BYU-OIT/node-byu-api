require('../modules/cli-request-handler');

var handler             = require('../modules/request-handler');


handler({ url: 'www.google.com', cookie: '"bob=true"' });