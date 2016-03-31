# Database Configuration File

A database configuration file contains all of the configuration parameters needed for connectors to establish database connections. Although it is possible to write the configuration find yourself as plain JSON, each connector has its own required configuration options that are only documented within the connector's code.

## The Easy Way

From a terminal:

```sh
$ node-byu-api db-config ./path/to/file
```

This will put the terminal into an interactive terminal tool that will guide you through the steps of defining database configurations. It will also test database connections for the configurations made.

## Options

To see what options this command provides, issue this command from the terminal:

```sh
$ node-byu-api db-config --help
```