var path    = require('path');
var express = require('express');

var swagger = require('./swagger');

module.exports.build = build;

/**
 * build
 *
 * @param {App} app - documented server
 * @param {Config} config
 *
 * @return {App}
 */
function build(app, config) {
    var options = {
        name: config.get('name'),
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

    var specs = swagger.generate(app);

    var docApp = app.appManager.buildApp(config, options);

    app.doc = docApp;

    docApp.on('pre-init', function(docApp) {
        docApp.expressApp.set('views', path.join(__dirname, '/../views'));
        docApp.expressApp.set('view engine', 'ejs');
        docApp.use('/public', express.static(path.join(__dirname, '/../public')));
    });

    var router = docApp.buildRouter({
        routeNameFormat: '{method}{Name}',
        url: '/'
    });

    router.buildRoute({
        type: 'get',
        url: '/'
    }).main(function(req, res) {
        res.render('index.ejs', {
            title: config.get('title') || 'API documentation',
            tryItOut: config.get('tryItOut') || false
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
