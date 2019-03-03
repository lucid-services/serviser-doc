const _       = require('lodash');
const jsf     = require('json-schema-faker');
const faker   = require('faker');
const uuid    = require('uuid/v4');
const Promise = require('bluebird');

module.exports.generateRoutePrameters = generateRoutePrameters;

jsf.extend('faker', () => require('faker'));

jsf.option({
    failOnInvalidTypes: false,
    defaultInvalidTypeProduct: 'string',
    failOnInvalidFormat: false,
    optionalsProbability: 0,
    ignoreMissingRefs: true,
    alwaysFakeOptionals: false
});

jsf.format('uuid', function() {
    return uuid();
});

jsf.format('date', function() {
    return (new Date()).toISOString();
});

jsf.format('time', function() {
    let match = (new Date()).toISOString().match(/^\d+-\d{2}-\d{2}T(.+)\..*$/);
    if (match) {
        return match[1];
    }

    return '00:00:00';
});

jsf.format('url', function() {
    return 'http://127.0.0.1';
});

jsf.format('regex', function() {
    return '^.*$';
});

jsf.format('json-pointer', function() {
    return '';
});

jsf.format('relative-json-pointer', function() {
    return '';
});

jsf.format('media-type', function(container, schema) {
    if (schema.pattern) {
        return container.randexp(schema.pattern);
    }
    return 'application/json';
});

/**
 * @param {Array} oaParameters - query,path,header request parameters in OAS
 * @param {Object} oaRequestBody - request payload in OAS
 * @param {Object}
 */
function generateRoutePrameters(oaParameters, oaRequestBody) {
    const params = {
        query: {},
        path: {},
        header: {}
    };

    const data = _.reduce(oaParameters, function(out, param) {
        out[param.in][param.name] = jsf.generate(param.schema || {type: 'string'});
        return out;
    }, params);

    if (oaRequestBody) {
        data.body = jsf.generate(oaRequestBody);
    }

    return data;
}
