var jsonInspector = require('bi-json-inspector');
var toSwagger     = require('bi-json-inspector-swagger').toSwagger;
var _             = require('lodash');

var Validator        = jsonInspector.Validator;
var ValidatorManager = jsonInspector.ValidatorManager;

module.exports.generate = generate;

/**
 * @param {App} app
 *
 * @return {Object}
 */
function generate(app) {
    var specs = {};
    var routers = groupRoutersByVersion(app.routers);
    var validatorManager = jsonInspectorToSwagger(app.options.validator.definitions);

    Object.keys(routers).forEach(function(version) {
        var basePath = findCommonBasePath(_.clone(routers[version]));

        specs[version] = buildSwaggerSpec(routers[version], app, validatorManager, {
            basePath: normalizeUrlParameters(basePath),
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
 * @param {ValidatorManager} validatorManager
 * @param {Object} options
 * @param {String} options.baseUrl
 * @param {String|Integer} options.version
 *
 * @return {Object}
 */
function buildSwaggerSpec(routers, app, validatorManager, options) {
    var spec = {
        swagger: '2.0',
        info: {
            title: app.options && app.options.name || 'default',
            description: '',
            version: options.version,
        },
        host: (app.config.get('baseUrl') || '').replace(/^.+:\/\//, ''),
        basePath: options.basePath,
        schemes: ['https','http'], //TODO
        paths: {},
        securityDefinitions: {},
        parameters: {},
        definitions: {}
    };

    routers.forEach(function(router) {
        var routes = groupRoutesByUrl(router.routes);

        Object.keys(routes).forEach(function(url) {
            var relativeUrl = url.substr(options.basePath.length);
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
                //custom field
                routeDef.sdkMethodName = route.description.sdkMethodName;
                routeDef.produces      = ["application/json"];
                routeDef.consumes      = ["application/json"];
                routeDef.parameters    = describeRouteParameters(valMiddlewares, validatorManager);
                routeDef.responses     = describeRouteResponses(route.description.responses, validatorManager);

                ensureAllPathParamsIncluded(routeDef.parameters, relativeUrl);
                sortUrlPathParameters(routeDef.parameters, relativeUrl);
            });
        });
    });

    return spec;
}


/**
 *
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
 *
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
 * @param {Object<name, jsonInspectorSchema>} definitions - validator schema definitions
 *
 * @return {ValidatorManager}
 */
function jsonInspectorToSwagger(definitions) {
    var valManager = new ValidatorManager();
    var valNames = Object.keys(definitions);
    var fakeReq = {
        getData: function noop() {},
        query: {},
        body: {},
        params: {}
    };

    for (var i = 0, len = valNames.length; i < len; i++) {
        var name = valNames[i]
        ,   def = definitions[valNames[i]]
        ,   validator = def;

        if (   !(def instanceof Validator)
            && ['object', 'function'].indexOf(typeof def) !== -1
        ) {
            validator = new Validator(def, {}, valManager);
            validator.options.context.req = fakeReq;
        }

        if (validator instanceof Validator) {
            valManager.add(name, validator);
        }
    }

    //additional loop is required as only at this point all validators are registered
    //in valManager. So any validator can see other validator definitions
    Object.keys(valManager.validators).forEach(function(name) {
        var validator = valManager.validators[name];
        validator.toSwagger = toSwagger(validator); //returns factory fn
    });

    return valManager;
}

/**
 *
 * @param {Array} steps - collection of route's validator middlewares
 * @param {ValidatorManager} validatorManager
 *
 * @return {Array} - swagger schema
 */
function describeRouteParameters(steps, validatorManager) {
    var out = [];
    var paramNames = [];

    //map of express validator targets (keys) to swagger targets
    var targets = {
        body: 'formData',
        headers: 'header',
        query: 'query',
        params: 'path'
    };

    steps.forEach(function(step) {
        var args = step.args;

        if (!args) {
            return;
        }

        var schema        = args[0] //can be schema definition, or name of registered validator
        ,   target        = args[1] // possible values 'query', 'body', 'params'
        ,   customSchema  = args[2]
        ,   options       = args[3]
        ,   validatorName = null
        ,   validator     = null;

        if (typeof schema === 'string') {
            validatorName = schema;
            validator = validatorManager.get(validatorName);
        }

        var fakeReq = {
            getData: function noop() {},
            query: {},
            body: {},
            params: {}
        };

        if (!validator) {
            validator = new Validator(schema, options, validatorManager);
            validator.options.context.req = fakeReq;
            validator.toSwagger = toSwagger(validator);
        }
        //we need to (re)build in some cases
        if (_.isPlainObject(customSchema)) {
            //merge custom schema
            schema = validator.getSchema(customSchema);

            validator = new Validator(schema, options, validatorManager);
            validator.options.context.req = fakeReq;
            validator.toSwagger = toSwagger(validator);
        } else if (validatorName) {
            validator = validatorManager.get(validatorName);
        }

        out = out.concat(validator.toSwagger({in: targets[target]}));
    });

    /*
     * filter out duplicate definitions, higher priority has a parameter
     * which was defined first
     */
    out = out.filter(function(param) {
        var key = `${param.name}&${param.in}`;
        if (!~paramNames.indexOf(key)) {
            paramNames.push(key);
            return true;
        }
        return false;
    });

    let body = out.find(findCb);

    if (body) {
        for (var i = 0; i < out.length; i++) {
            let param = out[i];
            if (param.in  === 'body' && param !== body) {
                _.merge(body, param);
                out.splice(i, 1);
            } else if (param.in === 'formData') {
                body.schema.properties = body.schema.properties || {};
                let p = _.cloneDeep(param);

                delete p.name;
                delete p.in;
                delete p.required;

                body.schema.properties[param.name] = p;

                if (param.required) {
                    body.schema.required = body.schema.required || [];
                    if (!~body.schema.required.indexOf(param.name)) {
                        body.schema.required.push(param.name);
                    }
                }
                out.splice(i, 1);
            }
        }
    }

    return out;

    function findCb(item) {
        return item.in === 'body';
    }
}


/**
 *
 * @param {Object} responses
 * @param {ValidatorManager} validatorManager
 *
 * @return {Object}
 */
function describeRouteResponses(responses, validatorManager) {
    var out = {};

    Object.keys(responses).forEach(function(code) {
        out[code] = responses[code].reduce(function(schema, descriptor) {
            descriptor = descriptor.schema;

            if (descriptor instanceof Error
               && descriptor.toSwagger instanceof Function
            ) {
                return _.mergeWith(schema, descriptor.toSwagger(), mergeStrategy);
            //We've got (Error) constructor object
            } else if (   descriptor instanceof Function
                && Error.prototype.isPrototypeOf(descriptor.prototype)
                || descriptor.prototype instanceof Error
            ) {
                var e = new descriptor;
                if (e.toSwagger instanceof Function) {
                    return _.mergeWith(schema, e.toSwagger(), mergeStrategy);
                }
            //we've got json-inspector schema definition
            } else if (descriptor) {
                var validatorName
                ,   valOptions = {}
                ,   inspector;

                if (typeof descriptor === 'string') {
                    validatorName = descriptor;
                    inspector = validatorManager.get(validatorName);
                }

                if (!inspector) {
                    inspector = new Validator(descriptor, valOptions, validatorManager);
                }

                if (!inspector.hasOwnProperty('toSwagger')) {
                    inspector.toSwagger = toSwagger(inspector);
                }

                return _.mergeWith(
                    schema,
                    inspector.toSwagger({in: 'body'})[0],
                    mergeStrategy
                );
            }

            return schema;
        }, {});

        if (_.isPlainObject(out[code]) && !out[code].description) {
            out[code].description = " "; //required by some apps
        }
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

/**
 *
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
 *
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
 *
 * @param {Array} steps - route's middlewares
 *
 * @return {Array}
 */
function findValidatorMiddlewares(steps) {
    return steps.filter(function(val) {
        return val.name === 'validator';
    });
}
