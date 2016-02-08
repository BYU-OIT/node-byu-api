"use strict";
var CustomError         = require('custom-error-instance');
var defineGetter        = require('../util/define-getter');

var Err = CustomError('DefinitionError', { code: 'EDEF' }, function(props) {
    var message;
    message = 'There is an error with the ';
    if (props.id) message += '"' + props.id + '" ';
    message += 'definition file: ' + this.message;
    this.message = message;
});

module.exports = Definition;


function Definition(type, json) {
    var data;
    var factory = {};

    try {
        data = JSON.parse(json);
    } catch (e) {
        throw Err('Invalid JSON: ' + e.message);
    }
    validate(data);

    factory.json = '';
    factory.links = {};
    factory.meta = {};
    factory.values = [];

    defineGetter(factory, 'json', () => json);
    defineGetter(factory, 'links', () => JSON.parse(json).links);
    defineGetter(factory, 'metadata', () => JSON.parse(json).metadata);
    defineGetter(factory, 'values', () => JSON.parse(json).values);

    factory.instance = function() {
        var data = JSON.parse(json);
        var factory = {};

        factory.applyQueryParameters = function(query) {
            var value;
            var metadata = data.metadata;

            // set page size for metadata
            metadata.page_size = metadata.default_page_size;
            if (query.hasOwnProperty('page_size')) {
                value = parseInt(query.page_size);
                if (!isNaN(value) && value >= 0) metadata.page_size = value;
            }
            if (metadata.page_size > metadata.max_page_size) metadata.page_size = metadata.max_page_size;


        };

        factory.data = data;

        return factory;
    };

    /**
     * Get the field sets associated with the specified resource and context.
     * @param {string} contextName
     * @returns {string[], undefined}
     */
    factory.context = function(contextName) {
        return data.metadata.contexts[contextName];
    };

    return factory;
}

Definition.BASIC = 'basic';
Definition.RESOURCE = 'resource';
Definition.SUB_RESOURCE = 'sub_resource';



function validate(data) {
    var meta;
    var required;

    if (!data.hasOwnProperty('links')) throw Err.def('Missing required property: links');
    if (!data.links || typeof data.links !== 'object') throw Err.def('Property "links" must be an object.');

    if (!data.hasOwnProperty('metadata')) throw Err.def('Missing required property: metadata');
    if (!data.metadata || typeof data.metadata !== 'object') throw Err.def('Property "metadata" must be an object.');

    required = [
        'collection_size',
        'page_start',
        'page_end',
        'page_size',
        'default_page_size',
        'max_page_size',
        'field_sets_returned'
    ];

    meta = data.metadata;
    //if (!meta.hasOwnProperty('collection_size'))
}