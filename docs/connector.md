# Database Connector

A connector is a definition that tells the Node BYU API how to configure and manage database connections. All connectors must reside within the framework at `bin/connectors`. The name of the JavaScript file the defines the connector is irrelevant.

## Starter Template

The following starter template has examples and some pseudo-code. Details on how to modify this starter template to your needs can be found in the [Explanation section](#explanation).

```js
const db = require('some-db');

module.exports = {
    name: 'connectorName',
    pool: true,
    connect: function(config) {
        return new Promise(function(resolve, reject) {
            db.connect(config, function(err, conn) {
                var client;
                var manager;

                if (err) return reject(err);

                client = {

                };

                manager = {
                    disconnect: conn => conn.release(),
                    preRequest: conn => void 0,
                    postRequest: (conn, success) => success ? conn.commit() : conn.rollback(),
                    query: (conn, args) => conn.execute.apply(conn, args)
                };

                resolve({
                    client: client,
                    manager: manager
                });
            });
        });
    },
    options: {
        user: {
            type: 'input',
            message: 'User:',
            validate: value => typeof value === 'string'
        },
        password: {
            type: 'password',
            message: 'Password:',
            validate: value => typeof value === 'string'
        },
        connectionString: {
            type: 'input',
            message: 'Connection string:',
            validate: value => typeof value === 'string'
        }
    }
};
```

## Explanation

The connector file must define the connector on the `module.exports` as an object with these required properties:

### connect

This property must define a function that will take a configuration object. The properties that this configuration object will receive are those from the *options* property. The values will be supplied by the [Database Configuration File](./database-configuration-file.md).

If the connecting to the database is an asynchronous operation then you should return a promise that resolves once the database connection has been established.

The value returned from the connect function (or the value that is resolved to by the promise) must contain two properties: *client* and *manager*.

* **client** - The value from this property will be injected into the database object for the [Request Handler](./request-handler.md). You should not provide a way through the client value for the [Request Handler](./request-handler.md) to make new connections or disconnect from existing connections since this will be handled automatically through the database manager.

* **manager** - The value for this property must be an object that defines each of these required properties: *disconnect*, *preRequest*, *postRequest*, and *query*.

  **manager.disconnect ( connection )** - This function receives a connection object that should be disconnected from the database. If the disconnect happens asynchronously then this function should return a promise that resolves once the connection has been disconnected.

  **manager.preRequest ( connection )** - This function receives a connection object. Before a [Request Handler](./request-handler.md) is given the *client* value this function will be executed. If the function needs to process asynchronously then it must return a promise.

   **manager.postRequest ( connection, success )** - This function receives a connection object and a boolean indicating the success of the [Request Handler](./request-handler.md). After a [Request Handler](./request-handler.md) completes, before this connection becomes available for other [Request Handlers](./request-handler.md) to use, this function will be executed. If the function needs to process asynchronously then it must return a promise.

   **manager.query ( connection, args )** - This function receives a connection object and the arguments used to invoke the query interface. A query interface is accessible within a [Request Handler](./request-handler.md) for any connector definition and serves the purpose of allowing the [Request Handler](./request-handler.md) to make multiple simultaneous database queries (using multiple connections). This can provide significant performance boosts, but note that the connections used can be either idle database connections or the dedicated connection provided to this specific [Request Handler](./request-handler.md).

### name

This is the name of the connector, not the name being used by developers to access the database that this connector will link to. If you are defining a connector for an Oracle database you would probably name this "oracle" or for a MySQL database you could name it "mysql". What you specify for the name is important insofar as it defines what type of database the connector will be connecting to.

### options

The options are used to:

1. Define what properties are required for the database configuration.
2. Define restrictions on what the value can be for each property (via *validate*).
3. Specify how the interface should present the option for input (via *type* and *message*).

The properties for each option are used by [inquirer](https://www.npmjs.com/package/inquirer) to display the interface that is used to generate a [Database Configuration File](./database-configuration-file.md) and it is used in part to validate configurations read from the [Database Configuration File](./database-configuration-file.md) when the database manager is starting to make database connections.

### pool

This property defines whether the framework should handle connection pooling for database connections for this connector. It is recommended that you set this value to `true` for most cases.