const service   = require('bi-service');
const toSwagger = require('bi-ajv2swagger').toSwagger;
const _         = require('lodash');

module.exports.generate = generate;

/**
 * @param {App} app
 *
 * @return {Object}
 */
function generate(app) {
    const specs = {};
    const routers = groupRoutersByVersion(app.routers);

    Object.keys(routers).forEach(function(version) {
        let host = app.config.get('host') || '';
        let protocol = app.config.get('protocol') || '';
        let hostPathname = app.config.get('basePath') || '';
        let basePath = findCommonBasePath(_.clone(routers[version]));

        if (host && hostPathname && hostPathname !== '/') {
            /**
             * when pathname is set as part of app base url in service env config
             * it should be considered as such... the pathname should never be part of
             * individual API endpoints as it can change depending on ENV configuration
             */
            host += hostPathname;
            basePath = basePath.slice(
                basePath.indexOf(hostPathname) + hostPathname.length
            );
        }

        specs[version] = buildSwaggerSpec(routers[version], app, {
            basePath: normalizeUrlParameters(basePath),
            protocol: protocol ? protocol + '//': '',
            host: host,
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
 * @param {String} options.basePath
 * @param {String|Integer} options.version
 *
 * @return {Object}
 */
function buildSwaggerSpec(routers, app, options) {

    var spec = {
        openapi: '3.0.0',
        info: {
            title: app.name || 'bi-service API documentation',
            description: '',//TODO
            version: options.version,
        },
        servers: [{
            url: options.protocol + options.host + options.basePath
        }],
        paths: {}
    };

    routers.forEach(function(router) {
        var routes = groupRoutesByUrl(router.routes);

        Object.keys(routes).forEach(function(url) {
            let hostBasePath = app.config.get('basePath') || '';
            let relativeUrl;

            if (hostBasePath && hostBasePath !== '/') {
                relativeUrl = url.substr(hostBasePath.length);
            }

            relativeUrl = (relativeUrl || url).substr(options.basePath.length);

            if (relativeUrl !== '/') {
                relativeUrl = router.$normalizeUrl(relativeUrl);
                relativeUrl = normalizeUrlParameters(relativeUrl);
            }

            routes[url].forEach(function(route) {
                var valMiddlewares = findValidatorMiddlewares(route.steps);
                var routeDef = {};
                if (!_.isPlainObject(spec.paths[relativeUrl])) {
                    spec.paths[relativeUrl] = {};
                }
                spec.paths[relativeUrl][route.options.type] = routeDef;

                routeDef.operationId   = route.uid;
                routeDef.tags          = getUrlTags(relativeUrl, options.basePath);
                routeDef.summary       = route.description.summary;
                routeDef.description   = route.description.description;

                //custom fields

                //in case AMQP route definition, include custom options
                if (   _.isPlainObject(route.options)
                    && route.options.hasOwnProperty('amqp')
                ) {
                    routeDef['x-amqp'] = _.cloneDeep(route.options.amqp);
                }
                routeDef['x-sdkMethodName'] = route.description.sdkMethodName;

                routeDef.produces      = ["application/json"];
                routeDef.consumes      = ["application/json"];
                routeDef.responses     = describeRouteResponses(route.description.responses, app.getValidator(), route);
                Object.assign(
                    routeDef,
                    describeRouteParameters(valMiddlewares, app.getValidator(), route)
                );

                ensureAllPathParamsIncluded(routeDef.parameters, relativeUrl);
                sortUrlPathParameters(routeDef.parameters, relativeUrl);
            });
        });
    });

    return spec;
}

/**
 * @param {String} url
 *
 * @return {Array}
 */
function parsePathParamNames(url) {
    var regex = /(?:{)(\w+)(?:})/g;
    var matches, segments = [];
    while (matches = regex.exec(url)) {
        segments.push(matches[1]);
    }

    return segments;
}

/**
 * @param {Array} parameters
 * @param {String} url
 *
 * @return {Array}
 */
function ensureAllPathParamsIncluded(parameters, url) {
    var segments = parsePathParamNames(url);

    segments.forEach(function(name) {
        var param = _.find(parameters, {name: name, in: 'path'});

        if (!param) {
            param = {
                type: 'string',
                in: 'path',
                required: true,
                name: name
            };
            parameters.push(param);
        }
    });

    return parameters;
}

/**
 * sorts url path segments so that possition order is preserved, eg:
 * /user/{username}/apps/{app_id}
 * sorts so that the username parameter is sorted always before the app_id param
 *
 * @param {String} url
 *
 * @return {Array}
 */
function sortUrlPathParameters(parameters, url) {

    var segments = parsePathParamNames(url);

    return parameters.sort(function(a, b) {
        if (a.in === 'path' && b.in !== 'path') {
            return -1;
        } else if (b.in === 'path' && a.in !== 'path') {
            return 1;
        } else if (b.in === 'path' && a.in === 'path') {
            var bPosition = segments.indexOf(b.name);
            var aPosition = segments.indexOf(a.name);

            if (aPosition < bPosition) {
                return -1;
            } else {
                return 1;
            }
        } else {
            return 0;
        }
    });
}

/**
 * returns a map with route parameters & requestBody in OpenAPI format
 * @param {Array} steps - collection of route's validator middlewares
 * @param {Ajv} validatorManager - Ajv validator instance
 * @param {Route} route
 *
 * @return {Object} - {parameters: [], requestBody: {}}
 */
function describeRouteParameters(steps, validatorManager, route) {
    var out = {
        parameters: []
    };
    var paramNames = [];

    //map of express validator targets (keys) to swagger targets
    var targets = {
        body: 'body',
        headers: 'header',
        query: 'query',
        params: 'path'
    };

    if (route.options.type !== 'trace') {
        out.requestBody = {};
    }

    steps.forEach(function(step) {
        var args = step.args;

        if (!args) {
            return;
        }

        var schema           = args[0] //can be schema definition, or name of registered validator
        ,   target           = args[1] // possible values 'query', 'body', 'params', 'headers
        ,   validatorName    = null
        ,   tmpValidatorName = null
        ,   validator        = null;

        if (typeof schema === 'string') {
            validatorName = schema;
            validator = validatorManager.getSchema(validatorName);
        } else if (_.isPlainObject(schema)) {
            tmpValidatorName = route.uid + '_' + target + '_' + Date.now();
            validatorManager.addSchema(schema, tmpValidatorName);
            validator = validatorManager.getSchema(tmpValidatorName);
        }

        if (!validator.hasOwnProperty('toSwagger')) {
            validator.toSwagger = toSwagger(
                validatorName || tmpValidatorName,
                validatorManager,
                3 //OAS v3
            );
        }

        if (target === 'body' && out.requestBody !== undefined) {
            out.requestBody.content = {};

            var bodySchema = validator.toSwagger({in: targets[target]})[0];
            out.requestBody.description = bodySchema.description || '';
            out.requestBody.required = bodySchema.required || false;

            //oas v3 does not have these properties
            //TODO refactor after bi-ajv2swagger fully supports OAS v3
            delete bodySchema.in;
            delete bodySchema.description;
            delete bodySchema.required;
            delete bodySchema.name;

            route.acceptedContentTypes().forEach(function(mime) {
                out.requestBody.content[mime] = bodySchema;
            });
        } else {
            out.parameters = out.parameters.concat(
                validator.toSwagger({in: targets[target]})
            );
        }

        if (tmpValidatorName) {
            validatorManager.removeSchema(tmpValidatorName);
        }
    });

    /*
     * filter out duplicate definitions, higher priority has a parameter
     * which was defined first
     */
    out.parameters = out.parameters.filter(function(param) {
        var key = `${param.name}&${param.in}`;
        if (!~paramNames.indexOf(key)) {
            paramNames.push(key);
            return true;
        }
        return false;
    });

    return out;
}

/**
 * @param {Object} responses
 * @param {Ajv} validatorManager - Ajv validator instance
 * @param {Route} route
 *
 * @return {Object}
 */
function describeRouteResponses(responses, validatorManager, route) {
    //TODO refactor after bi-ajv2swagger fully supports OAS v3
    //also requires major `bi-service` update
    var responseMimeType = 'application/json';
    var out = {};

    Object.keys(responses).forEach(function(code) {
        out[code] = responses[code].reduce(function(schema, descriptor) {
            var responseSchema;
            var contentSchema;

            if (schema.content.hasOwnProperty(responseMimeType)) {
                contentSchema = schema.content[responseMimeType].schema;
            } else {
                contentSchema = {};
                schema.content[responseMimeType] = {schema: contentSchema};
            }

            descriptor = descriptor.schema;

            //we've got error instance object
            if (descriptor instanceof Error
               && descriptor.toSwagger instanceof Function
            ) {
                responseSchema = descriptor.toSwagger();
            //We've got (Error) constructor object
            } else if (   descriptor instanceof Function
                && Error.prototype.isPrototypeOf(descriptor.prototype)
                || descriptor.prototype instanceof Error
            ) {
                var e = new descriptor;
                if (e.toSwagger instanceof Function) {
                    responseSchema =  e.toSwagger();
                }
            //we've got ajv schema definition (schema string id or schema object)
            } else if (descriptor) {
                var validatorName
                ,   tmpValidatorName
                ,   validator;

                if (typeof descriptor === 'string') {
                    validatorName = descriptor;
                    validator = validatorManager.getSchema(validatorName);
                } else if (_.isPlainObject(descriptor)) {
                    tmpValidatorName = route.uid + '_response_' + Date.now();
                    validatorManager.addSchema(descriptor, tmpValidatorName);
                    validator = validatorManager.getSchema(tmpValidatorName);
                }

                if (!validator) {
                    throw new Error(`Could not find validator schema: ${validatorName}`);
                }

                if (!validator.hasOwnProperty('toSwagger')) {
                    validator.toSwagger = toSwagger(
                        validatorName || tmpValidatorName,
                        validatorManager,
                        3 //oas v3
                    );
                }

                if (tmpValidatorName) {
                    validatorManager.removeSchema(tmpValidatorName);
                }

                responseSchema = validator.toSwagger({in: 'body'})[0];
            }

            if (responseSchema) {
                _.mergeWith(contentSchema, responseSchema.schema, mergeStrategy);
            }

            //TODO refactor after bi-ajv2swagger fully supports OAS v3
            //needs major update of bi-service
            delete contentSchema.in;
            delete contentSchema.name;
            if (responseSchema && responseSchema.description) {
                schema.description = responseSchema.description;
            }

            return schema;
        }, {
            content: {},
            description: ' ' //required by OAS
        });
    });

    function mergeStrategy(obj, src) {
        if (obj instanceof Array && src instanceof Array) {
            return _.uniq(obj.concat(src));
        }
    }

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
 * convers express-like path parameters to swagger formater path parameters
 * eg.: /path/:id(\d+)    =>    /path/{id}
 *
 * @param {String} url
 * @return {String}
 */
function normalizeUrlParameters(url) {
    var segments = url.split('/');

    for (var i = 0, seg = null, len = segments.length; i < len; i++) {
        //remove tailing '?' characters & remove express-like regex
        //matching part of url segment
        seg = _.trim(segments[i], '?').replace(/\(.+\)/, '');

        if (seg.match(/^:[a-zA-Z0-9-_]+$/)) {
            segments[i] = '{' + seg.substr(1) + '}';
        }
    }

    return segments.join('/');
}

/**
 * @param {Array<Router>} routers
 *
 * @return {String}
 */
function findCommonBasePath(routers) {
    var router = routers.shift();
    var base = router.getUrl().split('/');
    for (var i = 0, url = null, len = routers.length; i < len; i++) {
        url = routers[i].getUrl().split('/');
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

/**
 * @param {String} url
 * @param {String} baseUrl
 *
 * @return {Array<String>}
 */
function getUrlTags(url, baseUrl) {
    var tags         = []
    ,   urlParts     = _.compact(url.split('/')).filter(tagFilter)
    ,   baseUrlParts = _.compact(baseUrl.split('/')).filter(tagFilter);


    if (urlParts.length) {
        var len = urlParts.length;
        if (len > 1) {
            urlParts = urlParts.splice(0, len -1);
        }
        tags = tags.concat(urlParts);
    } else if (baseUrlParts.length) {
        var index = baseUrlParts.length -2;
        if (index < 0) {
            index++;
        }
        tags.push(baseUrlParts[index]);
    }

    return tags;

    function tagFilter(tag) {
        return !isBannedTag(tag);
    }
}

/**
 * @param {String} tag
 *
 * @return {Boolean}
 */
function isBannedTag(tag) {
    tag = tag + '';
    var banned = ['s2s', 'api'];

    if (   ~banned.indexOf(tag)
        || tag.match(/^v{0,1}[0-9]+(\.[0-9]+){0,2}$/)
        || tag.match('^\{[a-zA-Z0-9-_]+\}$')
    ) {
        return true;
    }

    return false;
}

/**
 * @param {Array} steps - route's middlewares
 *
 * @return {Array}
 */
function findValidatorMiddlewares(steps) {
    return steps.filter(function(val) {
        return val.name === 'validator';
    });
}
