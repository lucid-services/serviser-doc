var path    = require('path');
var express = require('express');
var Promise = require('bluebird');
var _       = require('lodash');

var swagger = require('./swagger');

module.exports.build = build;

/**
 * build
 *
 * @param {App} app - documented server
 * @param {Config} config
 * @param {Object} options - App options
 * @param {String} [options.title]
 * @param {String} [options.storageDir]
 * @param {Boolean} [options.tryItOut=false] - whether to include "Try it out!" button with form to the front-end
 *
 * @return {App}
 */
function build(app, config, options) {
    var defaults = {
        name:  `docserver-${Date.now()}`,
        title: 'API Documentation',
        tryItOut: false,
        storageDir: null
    };

    options = _.assign(defaults, options);

    if (!options.storageDir) {
        throw new Error('The `storageDir` option must be set');
    }

    var specs = swagger.generate(app);

    var docApp = app.appManager.buildApp(config, options);

    docApp.on('pre-init', function(docApp) {
        docApp.expressApp.set('views', path.join(__dirname, '/../views'));
        docApp.expressApp.set('view engine', 'ejs');
        docApp.use('/public', express.static(path.join(__dirname, '/../public')));
        docApp.use('/docs', express.static(path.join(__dirname, options.storageDir)));
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
            title: options.title,
            tryItOut: options.tryItOut,
            url: 'http://127.0.0.1:3003/public/test.json'
        });
    });

    router.buildRoute({
        type: 'get',
        url: '/specs'
    }).main(function(req, res) {
        res.json(specs);
    });

    router.buildRoute({
        type: 'post',
        url: '/regenerate'
    }).main(function(req, res) {
    });

    return docApp;
}
