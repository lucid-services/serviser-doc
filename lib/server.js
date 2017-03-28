var path               = require('path');
var express            = require('express');
var config             = require('bi-config');
var service            = require('bi-service');
var serviceInitializer = require('bi-service/bin/www');

var swagger = require('./swagger');

var App        = service.App;
var AppManager = service.AppManager;

module.exports.build = build;

/**
 * buildDoc
 *
 * @param {Provider} cfg - config
 * @param {Object}   options - see {App} options for more details
 * @param {App}      options.app - related App object the documentation should be builded for
 *
 * @return {App}
 */
AppManager.prototype.buildDoc = function(cfg, options) {
    options = options || {};
    if (!(options.app instanceof App)) {
        throw new Error('Expected `options.app` to be instanceof `App`');
    }

    var app = build(options.app, cfg);
    app.on('error', this.$buildAppErrorListener(app));

    return app;
};

//register DOC server initialization listener
serviceInitializer.on('app', function(app) {
    if (app.config.get('doc:listen')) {
        app.appManager.buildDoc(
            config.createLiteralProvider(app.config.get('doc')),
            {app: app}
        );
    }
});

/**
 * build
 *
 * @param {App} app - documented server
 * @param {Config} cfg
 *
 * @return {App}
 */
function build(app, cfg) {
    var options = {
        name: cfg.get('name'),
        validator: {
            definitions: {
                "#appConfiguration": {
                    listen: {
                        $isInt: {min: 1}
                    },
                    name: { $is: String },
                    title: { $is: String, $required: false},
                    tryItOut: {$is: Boolean, $required: false}
                }
            }
        }
    };

    var specs;
    var docApp = app.appManager.buildApp(cfg, options);

    app.doc = docApp;

    docApp.once('pre-init', function(docApp) {
        docApp.expressApp.set('views', path.join(__dirname, '/../views'));
        docApp.expressApp.set('view engine', 'ejs');
        docApp.use('/public', express.static(path.join(__dirname, '/../public')));
    });

    docApp.once('post-init', function(docApp) {
        try{
            specs = swagger.generate(app);
        } catch(e) {
            docApp.emit('error', e);
        }
    })

    var router = docApp.buildRouter({
        routeNameFormat: '{method}{Name}',
        url: '/'
    });

    router.buildRoute({
        type: 'get',
        url: '/'
    }).main(function(req, res) {
        res.render('index.ejs', {
            title: cfg.get('title') || 'API documentation',
            tryItOut: cfg.get('tryItOut') || false
        });
    });

    router.buildRoute({
        type: 'get',
        url: '/specs'
    }).main(function(req, res) {
        res.json(specs);
    });

    return docApp;
}
