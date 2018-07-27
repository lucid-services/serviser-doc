const service   = require('bi-service');
const toSwagger = require('bi-ajv2swagger').toSwagger;
const _         = require('lodash');

const renderer  = require('./renderer');
const faker     = require('./faker.js');

module.exports.generate = generate;
module.exports.describeRouteParameters = describeRouteParameters;

/**
 * @param {App} app
 * @param {Object} readme
 * @param {String} readme['<apiVersion>']
 *
 * @return {Object}
 */
function generate(app, readme) {
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

        if (readme && readme[version]) {
            specs[version].info.description += readme[version];
        }
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
            title: app.config.get('doc:title') || 'bi-service API documentation',
            description: '',
            version: options.version,
        },
        servers: [{
            url: `{protocol}{host}{basePath}`,
            variables: {
                protocol: {
                    default: options.protocol
                },
                host: {
                    default: options.host
                },
                basePath: {
                    default: options.basePath
                },
            }
        }],
        paths: {}
    };

    const tagHeatMap = _getTagHeatmap(routers);
    const urlList = [];

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

                urlList.push({
                    method: route.options.type,
                    url: relativeUrl,
                    uid: route.uid
                });

                routeDef.operationId   = route.uid;
                routeDef.tags          = getUrlTags(route.uid, tagHeatMap);
                routeDef.summary       = route.description.summary;
                routeDef.description   = route.description.description;
                routeDef.responses     = describeRouteResponses(
                    route.description.responses,
                    app.getValidator(),
                    route
                );

                Object.assign(
                    routeDef,
                    describeRouteParameters(valMiddlewares, app.getValidator(), route)
                );

                routeDef['x-sdkMethodName'] = route.description.sdkMethodName;
                routeDef['x-code-samples'] = generateCodeExamples(routeDef, route);
                //custom fields
                //in case AMQP route definition, include custom options
                if (   _.isPlainObject(route.options)
                    && route.options.hasOwnProperty('amqp')
                ) {
                    routeDef['x-amqp'] = _.cloneDeep(route.options.amqp);
                }

                ensureAllPathParamsIncluded(routeDef.parameters, relativeUrl);
                sortUrlPathParameters(routeDef.parameters, relativeUrl);
            });
        });
    });

    spec.info.description += renderer.renderMarkdownReadme(urlList);

    return spec;
}

/**
 * @param {Object} routeSchema
 * @param {Route} route
 * @return {Object} - x-code-samples value
 */
function generateCodeExamples(routeSchema, route) {

    let requestBody;
    let contentType;

    if (routeSchema.requestBody
        && _.isPlainObject(routeSchema.requestBody.content)
    ) {
        contentType = 'application/json';
        if (!routeSchema.requestBody.content.hasOwnProperty(contentType)) {
            contentType = Object.keys(routeSchema.requestBody.content).pop();
        }
        requestBody = _.get(
            routeSchema,
            ['requestBody', 'content', contentType, 'schema'],
            undefined
        );
    }

    const sampleData = faker.generateRoutePrameters(
        routeSchema.parameters,
        requestBody
    );

    if (contentType && !sampleData.header.hasOwnProperty('content-type')) {
        sampleData.header['content-type'] = contentType;
    }

    return [
        {
            lang: 'JavaScript',
            source: renderer.renderJavaScriptExample(
                route.options.type,
                route.getAbsoluteUrl(sampleData.path),
                sampleData
            )
        },
        {
            lang: 'Curl',
            source: renderer.renderCurlExample(
                route.options.type,
                route.getAbsoluteUrl(sampleData.path, sampleData.query),
                sampleData
            )
        }
    ];

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
                schema: {type: 'string'},
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
    const out = {
        parameters: []
    };

    //map of express validator targets (keys) to swagger targets
    const targets = {
        body: 'body',
        headers: 'header',
        query: 'query',
        params: 'path'
    };

    if (route.options.type !== 'trace') {
        //content property is required by OAS v3
        out.requestBody = {content: {}};
    }

    steps.forEach(function(step) {
        var args = step.args;

        if (!args) {
            return;
        }

        var schema           = args[0] //can be schema definition, or name of registered validator
        ,   target           = args[1] // possible values 'query', 'body', 'params', 'headers
        ,   validator = _getValidator(schema, validatorManager, route.uid, target);

        if (target === 'body' && out.requestBody !== undefined) {
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
    });

    out.parameters = _removeDuplicateParameters(out.parameters);

    return out;
}


/**
 * filter out duplicate definitions, higher priority has a parameter
 * which was defined first.
 * Duplicates may occur eg.: when a plugin defines its own validation rules
 * and at the same time a route which uses the plugin defines the same
 * validation rule(s) via explicit `validate(<schema>)` call
 *
 * @param {Array<Object>} parameters
 * @return {Array<Object>}
 */
function _removeDuplicateParameters(parameters) {
    const paramNames = [];

    return parameters.filter(function(param) {
        var key = `${param.name}&${param.in}`;
        if (!~paramNames.indexOf(key)) {
            paramNames.push(key);
            return true;
        }
        return false;
    });
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
                var validator = _getValidator(
                    descriptor,
                    validatorManager,
                    route.uid,
                    '_response_'
                );

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
 * @param {String|Object} schema
 * @param {Validator} validatorManager
 * @param {String} routeUID
 * @param {String} target - _response_|body|query|params|headers
 * @return {Object} - ajv validator schema
 */
function _getValidator(schema, validatorManager, routeUID, target) {
    let validatorName    = null
    ,   tmpValidatorName = null
    ,   validator        = null;

    if (typeof schema === 'string') {
        validatorName = schema;
        validator = validatorManager.getSchema(validatorName);
    } else if (_.isPlainObject(schema)) {
        tmpValidatorName = routeUID + '_' + target + '_' + Date.now();
        validatorManager.addSchema(schema, tmpValidatorName);
        validator = validatorManager.getSchema(tmpValidatorName);
    }

    if (!validator) {
        throw new Error(`Could not find validator schema: ${validatorName}`);
    }

    if (!validator.hasOwnProperty('toSwagger')) {
        validator.toSwagger = toSwagger(
            validatorName || tmpValidatorName,
            validatorManager,
            3 //OAS v3
        );
    }

    if (tmpValidatorName) {
        validatorManager.removeSchema(tmpValidatorName);
    }

    return validator;
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
        var url = route.getUrl();

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
 * returns a map of tags with number of occurances across all endpoints
 *
 * @param {Array<Router>} routers
 * @return {Object}
 */
function _getTagHeatmap(routers) {
    const out = {
        tags: {},
        heatmap: {}
    };

    routers.forEach(function(router) {
        router.routes.forEach(parse);
    });

    return out;

    function parse(route) {
        let url = route.getUrl();
        let tags = _.compact(url.split('/')).filter(tagFilter);

        out.tags[route.uid] = tags;

        tags.forEach(function(tag, index) {
            const key = `${tag}:${index}`;
            if (out.heatmap.hasOwnProperty(key)) {
                out.heatmap[key]++;
            } else {
                out.heatmap[key] = 1;
            }
        });

        return tags;
    }

    function tagFilter(tag) {
        return !isBannedTag(tag);
    }
}

/**
 * @param {String} routeUID
 * @param {Object} tagHeatMap
 * @param {Object} tagHeatMap.tags
 * @param {Array<String>} tagHeatMap.tags['<routeUID>']
 * @param {Object} tagHeatMap.heatmap
 * @param {Integer} tagHeatMap.heatmap['<tag:position>']
 *
 * @return {Array<String>}
 */
function getUrlTags(routeUID, tagHeatMap) {
    const out  = []
    ,   heatmap = tagHeatMap.heatmap
    ,   tags = tagHeatMap.tags[routeUID];


    for (let i = tags.length-1, len = 0; i >= 0; i--) {
        let tag = tags[i];
        let key = `${tag}:${i}`;
        if (heatmap.hasOwnProperty(key)
            && (heatmap[key] > 1 || i == 0)
        ) {
            out.push(tag);
            return out;
        }
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
        || tag.match('^:[a-zA-Z0-9-_]+$')
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
