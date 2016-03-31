# Resource

A *Resource* (a.k.a. *Top Level Resource*) defines a definitive set of business logic that can be called through [Resource Request Handlers](#resource-request-handler). A resource may have multiple associated *Sub-Resources*. A *Sub-Resource* defines a subset of business logic that the *Top Level Resource* can call upon to enact its full set of business logic.

Both *Resources* and *Sub Resources* must define one or more [Resource Request Handlers](#resource-request-handler).

## Resource Request Handler

**A *Resource Request Handler* is a function that can be called to perform a specific action. It is the business logic, and as such is the only piece of indispensable code in the system.**



The [node-byu-api](../README.md) application is used to analyze requests, to prepare and manage database connections, and to call a *Resource Request Handler* with standardized parameters as input.

## How to Build a Resource

Resources and sub-resource must define an `index.js` file and a `def.json` file within the same parent directory. The [node-byu-api](../README.md) application looks for those files to identify resources and to call [Resource Request Handlers](#resource-request-handler) with standardized parameters.

### index.js

This file defines the [Resource Request Handlers](#resource-request-handler) that will be called by the [node-byu-api](../README.md) application. The [Resource Request Handlers](#resource-request-handler) must be assigned to the `exports` object to be usable by the [node-byu-api](../README.md) application and they must use lowercase HTTP methods (GET, POST, PUT, DELETE, etc.) as their property names.

Below is an sample `index.js` file for a resource that supports the HTTP methods: GET, PUT, and DELETE.

**index.js Example**

```js
exports.get = function(connection, resources, req, res) {
    // business logic here
}

exports.post = function(connection, resources, req, res) {
    // business logic here
}

exports.put = function(connection, resources, req, res) {
    // business logic here
}

exports.delete = function(connection, resources, req, res) {
    // business logic here
}
```

### def.json


## Resource Request Handler

A *Resource Request Handler* is a function that is called by the [node-byu-api](../README.md) application through one of the accepted HTTP methods, exposed on the `exports` object. See [index.js](#index.js) for details.

A *Resource Request Handler* receives four parameters which are explained in detail below. The parameters are:

1. connection
2. resources
3. request
4. response

### connection

This parameter provides a map of data store connections. The map is derived from two sources:

1. The [def.json file](./def.json.md).
2. The [data store configuration file](./datastore-configuration-file.md).

The [def.json file](./def.json.md) can define any number of data store names. Those names must correspond with the name of a connector in the [database configuration file](./database-configuration-file.md).

If a name corresponds between the [def.json file](./def.json.md) and the [database configuration file](./datastore-configuration-file.md) then a property is added to the *connection* object with that name. The value of that property is the connector.

The connector object has two interfaces:

1. **Persistent Interface**

  Available through `connections.own`, the persistent interface should be used if you require a single data store connection to do the work. That persistent interface connection is reserved for the duration of the [Resource Request Handler](#resource-request-handler) operation. Other [Resource Request Handlers](#resource-request-handler) will not be able to use this connection until after the [Resource Request Handler](#resource-request-handler) that owns this connection releases it.

2. **Transient Interface**

  Available through `connections.any`, the transient interface will use whatever data store connection is first available. This allows you to potentially run multiple requests against the data store simultaneously, enabling higher performance for the [Resource Request Handler](#resource-request-handler).

#### Connection Example

**Connector File**

```js
module.exports = {
    name: 'people',
    pool: false,
    connect: function(config) {
        var store = [];

        return {
            client: {
                add: function(firstName, lastName) {
                    store.push(firstName + ' ' + lastName);
                }
            },
            manager: {
                disconnect: conn => store = null,
                preRequest: conn => void 0,
                postRequest: (conn, success) => void 0
            }
        }
    }
}
```

**Datastore Configuration File**

```json
{
  "peeps": {
    "connector": "people",
    "config": {},
    "pool": null
  }
}
```

**def.json**

```json
{
  "metadata": {
      "databases": ["peeps"]
  }
}
```

**index.js**

```js
exports.get = function(connection, resources, req, res) {

    // use the persistent interface functions
    connection.own.peeps.add('Bob', 'Smith');

    // use the transient interface functions
    connection.any.peeps.add('Jack', 'Johnson');
}
```


### resource

This parameter is an object with the following properties and values:


  ```js
  {
      fieldset: undefined,          // or string[]
      meta: boolean,
      resource: object
      resource_def: object,
      resource_id: void 0           // or string[]
      resource_name: string,
      sub_resources: object,
      sub_resources_def: object,
      sub_resource_id: undefined,   // or string[]
      sub_resource_name: undefined  // or string[]
  }
  ```

* **fieldset** - This value will be undefined if this is a meta request, if a sub-resource is specified, or if the query parameters don't define a fieldset / context to use. Otherwise it will be an array of strings.
* **meta** - If the request is a meta request then this value will be set to `true` otherwise it will be set to `false`.
* **resource** - The value of this property is the module (the included index.js file) for the resource.
* **resource_def** - This value is a getter for the resource definition file. You can make changes to the object returned without altering the original definition object.
* **resource_id** - If no resource ID was specified in the request URL then this value will be undefined, otherwise it will be an array of strings.
* **resource_name** - The name of the resource, as specified by the request URL.
* **sub_resources** - An object map that maps the name of each sub-resource to be included in the request to it's module.
* **sub_resource_id** - If a sub-resource ID was not specified in the request URL then this will be undefined, otherwise it will be an array of strings.
* **sub_resource_name** - If not using sub-resource then this will be empty, otherwise it will be an array of strings for each sub-resource that was requested by the request URL.

### request

This parameter represents the request object. It contains the following properties:

```js
{
    body: string,       // or object
    cookie: object,
    header: object,
    method: string,
    query: object,
    url: string
}
```

* **body** - The body will be contain any body information sent with the request. If the body is a JSON string and a content-type header is set to `application/json` then the body will automatically be converted into an Object representing the JSON string.
* **cookie** - This will be an object map that maps cookie names to values.
* **header** - This will be an object map that maps header properties to their values.
* **method** - This is the HTTP method used in lower case.
* **query** - This is an object map that maps query parameters to their values.
* **url** - This is the url, minus query parameters and hashes and without a leading or trailing slash.

### response

There are multiple ways [Resource Request Handler](#resource-request-handler) to return a response.

If the [Resource Request Handler](#resource-request-handler) doesn't specifically set the response status code then the node-byu-api framework will automatically determine what the status code is.

1. If the [Resource Request Handler](#resource-request-handler) returns a Promise then when that promise resolves it's resolved value will be sent as the response body. If the promise is rejected then a standard 500 response will be sent and the details on the error will be logged.

    **Success Example**

    Sends status code `200` with body `OK`

    ```js
    exports.get = function(connection, resource, req, res) {
        return new Promise(function(resolve, reject) {
            resolve('OK');
        })
    };
    ```

    **Error Example**

    Sends status code `500` with body `Internal Server Error` with Error stack logged.

    ```js
    exports.get = function(connection, resource, req, res) {
        return new Promise(function(resolve, reject) {
            reject(Error('An error occurred'));
        })
    };
    ```

2. If the [Resource Request Handler](#resource-request-handler) returns anything other than a promise then the node-byu-api will interpret this as a success and the value will be returned in the body.

    **String Response**

    Sends status code `200` with body `OK`

    ```js
    exports.get = function(connection, resource, req, res) {
        return 'OK';
    };
    ```

    **Empty Response**

    Sends status code `204` with empty body.

    ```js
    exports.get = function(connection, resource, req, res) {
        // return nothing
    };
    ```

    **Object Response**

    Sends status code `200` with body `{ "success": true, "data": "Hello, World" }` and header `Content-type: application/json`

    ```js
    exports.get = function(connection, resource, req, res) {
        return {
            success: true,
            data: 'Hello, World'
        }
    };
    ```

3. If the [Resource Request Handler](#resource-request-handler) throws an Error then the node-byu-api will interpret this as an Error.

    **Thrown Error**

    Sends status code `500` with body `Internal Server Error` with Error stack logged.

    ```js
    exports.get = function(connection, resource, req, res) {
        throw Error('An error occurred');
    };
    ```

4. The [Resource Request Handler](#resource-request-handler) can also manually control the response by using the response object. For full details of how to use the response object, look to the Response API section.

    **Manual Response Control**

    ```js
    const fs = require('fs');
    exports.get = function(connection, resource, req, res) {
        fs.readFile('./image.jpg', function(err, data) {
            if (err) {
                res.send(err);
            } else {
                res.set('Content-type', 'image/jpeg');
                res.send(data);
            }
        });
        return res.promise;
    };
    ```

#### Response API

* **response.end() : Response** - This function takes no parameters and returns the response object.
* **response.get( key: String ) : String | undefined** - Get a set response header.


## Basic Sub Resource