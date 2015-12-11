var chalk           = require('chalk');
var clc             = require('./clc');
var connector       = require('./connector');
var format          = require('cli-format');
var inquirer        = require('inquirer');

module.exports = cliConnector;

function cliConnector(options) {
    return clc.execute('connector', options);
}

cliConnector.options = {
    'db-config': {
        alias: 'd',
        type: Object,
        description: 'The database configuration data. Use the connector --help command for details on how to format this object.',
        group: 'connector'
    },
    'db-env-name': {
        alias: 'e',
        type: String,
        defaultValue: 'node-byu-api',
        description: 'The environment variable name to look at for the database configuration data. If the default environment variable does not exist then it will be ignored, but if a different environement variable is specified and not found then an error will output. Defaults to "node-byu-api".',
        group: 'connector'
    }
};

clc.define('connector', handler, {
    description: 'Get information about defined connectors.',
    help: 'A connector is an interface for managing database connections. Through command ' +
        'arguments passed in on the command line interface you can define the ' +
        'information that is needed for a connector to actually establish database connections.\n\n' +
        'These connector arguments must be supplied when starting a request handler, so for ' +
        'details as to which arguments the request handler needs you\'ll want to look at the ' +
        'help for the ' + chalk.italic('request') + ' command.',
    defaultOption: 'name',
    groups: {
        '': 'Help Options',
        connector: 'Connector Options'
    },
    options: Object.assign({
        name: {
            alias: 'n',
            type: String,
            description: 'The name of the connector to get detailed instructions for.',
            multiple: true,
            required: true
        }
    }, cliConnector.options)
});

function getConnectorDetails(name) {
    var config;
    var str;

    if (!connector.exists(name)) {
        str = chalk.underline.bold(name) + '\n\n';
        str += chalk.italic('No connector with this name exists.');
        return format.wrap(str);
    } else {
        config = connector.get(name).configuration;
        config.title = 'Connector: ' + name;
        str = clc.getUsage(config);
        return str;
    }
}

function handler(err, options) {
    var questions;

    questions = [
        {
            type: 'input',
            name: 'colo'
        }
    ];

    inquirer.prompt(
        [
            'What is your favorite color?',
            'How old are you?'
        ],
        function(answers) {
            console.log(answers);
        }
    )
}


function handler2(err, options) {
    var result = '';
    if (err) {
        result += listConnectors();
    } else {
        options.name.forEach(function(name, index) {
            if (index > 0) result += '\n' + format.wrap('', { filler: '-'}) + '\n\n';
            result += getConnectorDetails(name);
        });
    }
    return result;
}

function listConnectors() {
    var connectors = connector.list();
    var result = '';

    if (connectors.length === 0) {
        result += format.wrap('There are no defined connectors.');
    } else {
        result += format.wrap('\u001b[1;4mAvailable Connectors\u001b[0m', { hangingIndent: '  ' }) + '\n\n';
        connectors.sort();
        connectors.forEach(function(name) {
            var description = connector.get(name).configuration.description || '';
            result += format.columns(chalk.bold(name), description, { width: [15, null], paddingLeft: '  ' }) + '\n';
        });
    }

    return result;
}