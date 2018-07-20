const _       = require('lodash');
const faker   = require('json-schema-faker');
const Promise = require('bluebird');

module.exports.generateRoutePrameters = generateRoutePrameters;

faker.option({
    failOnInvalidTypes: false,
    defaultInvalidTypeProduct: 'string',
    failOnInvalidFormat: false,
    alwaysFakeOptionals: false
});

faker.format('uuid', function() {
    return '';
})

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
        out[param.in][param.name] = faker(param);
        return out;
    }, params);

    if (oaRequestBody) {
        data.body = faker(oaRequestBody);
    }

    return data;
}
