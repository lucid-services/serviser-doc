const faker    = require('json-schema-faker');
const Promise  = require('bluebird');

module.exports.generateRoutePrameters = generateRoutePrameters;

faker.option({
    failOnInvalidTypes: false,
    defaultInvalidTypeProduct: 'string',
    failOnInvalidFormat: false,
    alwaysFakeOptionals: false
});

/**
 * @param {Array} oaParameters - query,path,header request parameters in OAS
 * @param {Object} oaRequestBody - request payload in OAS
 * @param {Promise<Object>}
 */
function generateRoutePrameters(oaParameters, oaRequestBody) {
    const params = {
        query: {},
        path: {},
        header: {}
    };

    return Promise.reduce(oaParameters, function(out, param) {
        return faker.resolve(param).then(function(data) {
            out[param.in][param.name] = data;
            return out
        });
    }, params).then(function(params) {
        if (oaRequestBody) {
            return faker.resolve(oaRequestBody).then(function(data) {
                params.body = data;
                return params;
            });
        }
        return params;
    });
}
