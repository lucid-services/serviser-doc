const _       = require('lodash');
const path    = require('path');
const express = require('express');
const service = require('serviser');
const fs      = require('fs');

const swagger = require('./swagger');

const App = service.App;
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

    this.app = options.app;
    //must be deleted as the App object would get corrupted by parent constructor
    delete options.app;

    cfg.setInspectionSchema({
        type: 'object',
        properties: {
            listen: {type: ['integer', 'string']},
            title: {type: 'string'},
            readme: {
                type: 'object',
                additionalProperties: {
                    oneOf: [
                        {type: 'string'},
                        {type: 'array', items: {type: 'string'}}
                    ]
                }
            },
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
 * loads markdown files from `readme` config section
 * @return {Object}
 */
Doc.prototype.$fetchReadme = function $fetchReadme() {
    let source = this.config.get('readme');
    const projectRoot = this.service.config.getOrFail('root');

    return _.reduce(source, function(out, pth, apiVersion) {
        out[apiVersion] = '';

        if (pth instanceof Array) {
            out[apiVersion] += pth.map(load).join('\n');
        } else {
            out[apiVersion] += load(pth);
        }
        return out;
    }, {});

    function load(pth) {
        if (pth[0] !== '/') {
            pth = '/' + pth;
        }

        return fs.readFileSync(path.resolve(projectRoot + pth)).toString();
    }
};

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
            let readme = this.$fetchReadme();
            var specs = swagger.generate(app, readme);
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
