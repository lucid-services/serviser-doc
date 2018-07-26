const _       = require('lodash');
const faker   = require('json-schema-faker');
const uuid    = require('uuid/v4');
const Promise = require('bluebird');

module.exports.generateRoutePrameters = generateRoutePrameters;

faker.option({
    failOnInvalidTypes: false,
    defaultInvalidTypeProduct: 'string',
    failOnInvalidFormat: false,
    alwaysFakeOptionals: false
});

faker.format('uuid', function() {
    return uuid();
});

faker.format('date', function() {
    return (new Date()).toISOString();
});

faker.format('time', function() {
    let match = (new Date()).toISOString().match(/^\d+-\d{2}-\d{2}T(.+)\..*$/);
    if (match) {
        return match[1];
    }

    return '00:00:00';
});

faker.format('url', function() {
    return 'http://127.0.0.1';
});

faker.format('regex', function() {
    return '^.*$';
});

faker.format('json-pointer', function() {
    return '';
});

faker.format('relative-json-pointer', function() {
    return '';
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
        out[param.in][param.name] = faker(param.schema || {type: 'string'});
        return out;
    }, params);

    if (oaRequestBody) {
        data.body = faker(oaRequestBody);
    }

    return data;
}
