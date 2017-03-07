var _ = require('lodash');

module.exports.generate = generate;


/**
 * @param {App} app
 *
 * @return {Object}
 */
function generate(app) {
    var specs = {};
    var routers = groupRoutersByVersion(app.routers);

    Object.keys(routers).forEach(function(version) {
        var basePath = findCommonBasePath(_.clone(routers[version]));

        specs[version] = buildSwaggerSpec(routers[version], app, {
            basePath: basePath,
            version: version
        });
    });

    return specs;
}


/**
 * builds API specifications for given version of routers
 *
 * @param {Array<Router>} routers
 * @param {App} app
 * @param {Object} options
 * @param {String} options.baseUrl
 * @param {String|Integer} options.version
 *
 * @return {Object}
 */
function buildSwaggerSpec(routers, app, options) {
    var spec = {
        swagger: '2.0',
        info: {
            title: '',
            description: '',
            version: options.version,
        },
        host: app.config.get('baseUrl'),
        basePath: options.basePath,
        schemes: ['https','http'], //TODO
        paths: {},
        securityDefinitions: {},
        parameters: {},
        definitions: {},
        externalDocs: {
            description: "",
            url: ""
        }
    };

    routers.forEach(function(router) {
        var routes = groupRoutesByUrl(router.routes);

        Object.keys(routes).forEach(function(url) {
            var relativeUrl = url.substr(options.basePath.length);
            if (relativeUrl !== '/') {
                relativeUrl = router.$normalizeUrl(relativeUrl);
            }

            routes[url].forEach(function(route) {
                var routeDef = {};
                spec.paths[relativeUrl] = {};
                spec.paths[relativeUrl][route.options.type] = routeDef;

                routeDef.operationId = route.uid;
                routeDef.summary     = route.description.summary;
                routeDef.description = route.description.description;
                routeDef.produces    = ["application/json"];
                routeDef.consumes    = ["application/json"];
                routeDef.parameters  = [];
                routeDef.responses   = describeRouteResponses(route.description.responses);
            });
        });
    });

    return spec;
}


/**
 *
 * @param {Object} responses
 *
 * @return {undefined}
 */
function describeRouteResponses(responses) {
    var out = {};

    Object.keys(responses).forEach(function(code) {
        var descriptor = responses[code].schema;

        //We've got (Error) constructor object
        if (descriptor instanceof Function) {
            var e = new descriptor;
            if (e.toSwagger instanceof Function) {
                out[code] = e.toSwagger();
            }
        } else if (descriptor instanceof Error
           && descriptor.toSwagger.instanceof Function
        ) {
            out[code] = descriptor.toSwagger();
        }
    });

    return out;
}

/**
 * @param {Array<Router>} routers
 *
 * @return {Object<version, collection>}
 */
function groupRoutersByVersion(routers) {
    var out = {};

    routers.forEach(function(router) {
        var version = router.$getVersionString();

        if (!version) {
            version = 'default';
        }

        if (!out.hasOwnProperty(version)) {
            out[version] = [];
        }

        out[version].push(router);
    });

    return out;
}


/**
 *
 * @param {Array<Route>} routes
 *
 * @return {Object}
 */
function groupRoutesByUrl(routes) {
    var out = {};

    routes.forEach(function(route) {
        var url = route.Router.options.url + route.options.url;

        if (!route.options.url) {
            url += '/';
        }

        if (!out.hasOwnProperty(url)) {
            out[url] = [];
        }

        out[url].push(route);
    });

    return out;
}


/**
 * @param {Array<Router>} routers
 *
 * @return {String}
 */
function findCommonBasePath(routers) {
    var router = routers.shift();
    var base = router.options.url.split('/');
    for (var i = 0, url = null, len = routers.length; i < len; i++) {
        url = routers[i].options.url.split('/');
        for (var y = 0, leng = base.length; y < leng; y++) {
            if (base[y] !== url[y]) {
                base.splice(y);
                break;
            }
        }

        if (!base.length) {
            break;
        }
    }

    return router.$normalizeUrl(base.join('/'));
}
