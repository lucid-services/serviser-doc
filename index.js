

var config             = require('bi-config');
var service            = require('bi-service');
var Doc                = require('./lib/doc.js').Doc;

module.exports.Doc     = Doc;
module.exports.swagger = require('./lib/swagger.js');

var App        = service.App;
var AppManager = service.AppManager;

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

    var doc = new Doc(this, cfg, options);
    doc.on('error', this.$buildAppErrorListener(doc));
    this.emit('build-app', doc);
    this.add(doc);

    return doc;
};

//register DOC server initialization listener
service.Service.on('app', function(app) {
    //run doc server
    if (app.config.get('doc:listen')) {
        app.appManager.buildDoc(
            config.createLiteralProvider(app.config.get('doc')),
            {app: app}
        );
    }
});
