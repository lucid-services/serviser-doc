/**
 * this file represents serviser based app
 * and its purpose is to help test the bin/serviser-doc
 * shell executable
 */

var Service = require('serviser');
var config = require('serviser-config');

var service = module.exports = new Service(config);

service.on('set-up', function() {
    //app1
    this.buildApp('app1').buildRouter({
        url: '/',
        version: 1
    }).buildRoute({
        url: '/',
        type: 'get'
    }).validate({
        type: 'object',
        properties: {
            id: {type: 'integer'}
        }
    }, 'query');

    //app2
    service.buildApp('app2').buildRouter({
        url: '/',
        version: 2
    }).buildRoute({
        url: '/:id',
        type: 'put'
    }).validate({
        type: 'object',
        properties: {
            id: {type: 'integer'}
        }
    }, 'params');
});
