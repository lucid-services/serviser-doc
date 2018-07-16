var _       = require('lodash');
var path    = require('path');
var express = require('express');
var service = require('bi-service');

var swagger = require('./swagger');

var App = service.App;
module.exports.Doc = Doc;

/**
* @param {AppManager} appManager
* @param {Config} cfg - config
* @param {Object} [options]
* @param {App} [options.app] - the app object a Doc is created for
*
* @constructor
**/
function Doc(appManager, cfg, options) {

    options = _.assign({
        name: cfg.get('name'),
    }, options || {});

    this.app = options.app;
    //must be deleted as the App object would get corrupted by parent constructor
    delete options.app;

    cfg.setInspectionSchema({
        type: 'object',
        required: ['name'],
        properties: {
            listen: {type: ['integer', 'string']},
            name: {type: 'string'},
            title: {type: 'string'},
            tryItOut: {type: 'boolean'}
        }
    });

    if (!cfg.get('bodyParser')) {
        cfg.set('bodyParser', {
            // dont allow complex json data structures encoded in url
            json: {extended: false}
        });
    }

    App.call(this, appManager, cfg, options);
}

Doc.prototype = Object.create(App.prototype);
Doc.prototype.constructor = Doc;
Doc.prototype._super = App.prototype;

/**
 * @return {undefined}
 */
Doc.prototype.$init = function() {

    this._super.$init.call(this);

    this.on('post-init', function() {
        var docApp  = this,
            app     = this.app;

        app.doc = docApp;

        this.use('/static', express.static(
            path.join(__dirname, '/../public/static')
        ));

        try{
            var specs = swagger.generate(app);
        } catch(e) {
            this.emit('error', e);
        }

        var router = docApp.buildRouter({
            routeNameFormat: '{method}{Name}',
            url: '/'
        });

        router.buildRoute({
            type: 'get',
            url: '/'
        }).main(function(req, res) {
            res.sendFile(path.resolve(__dirname + '/../public/index.html'));
        });

        router.buildRoute({
            type: 'get',
            url: '/specs'
        }).main(function(req, res) {
            res.json(specs);
        });

        router.buildRoute({
            type: 'get',
            name: 'specsByVersion',
            url: '/specs/:version'
        }).validate({
            additionalProperties: false,
            properties: {
                version: {
                    type: 'string',
                    pattern: 'v?\\d+(\\.\\d+)?',
                    maxLength: 20
                }
            }
        }, 'params').main(function(req, res) {
            if (specs.hasOwnProperty(req.params.version)) {
                return res.json(specs[req.params.version]);
            }

            throw new service.error.RequestError({
                message: `API specification version ${req.params.version} does not exist`,
                apiCode: 'specs.notFound'
            });
        });
    });
};
