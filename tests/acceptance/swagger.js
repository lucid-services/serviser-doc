var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var Config    = require('bi-config');
var Service   = require('bi-service');

var swagger = require('../../lib/swagger.js');

var expect = chai.expect;

chai.use(sinonChai);
chai.should();

describe('generate', function() {
    before(function() {
        var service = new Service.Service(Config);
        var conf = new Config.Config();

        this.app = service.appManager.buildApp(conf, {name: 'appName'});
    });

    it('should return empty object when no routers are defined', function() {
        swagger.generate(this.app).should.be.eql({});
    });

    describe('user router', function() {
        before(function() {
            //router1
            this.router = this.app.buildRouter({
                url: '/user',
                version: 1
            });

            //
            this.updateUserRoute = this.router.buildRoute({
                url: '/:id',
                type: 'put',
                sdkMethodName: 'updateUser'
            });

            //
            this.registerUserRoute = this.router.buildRoute({
                url     : '/register',
                type    : 'post',
                desc    : 'User registration',
                summary : 'Creates new user'
            });

            this.specs = swagger.generate(this.app);
        });

        it('should include swagger specification skeleton for v1.0 API', function() {
            var specs = this.specs;

            specs.should.have.property('v1.0').that.is.a('object');
            specs = specs['v1.0'];
            specs.should.have.property('openapi', '3.0.0');
            specs.should.have.deep.property('info.title', 'bi-service API documentation');
            specs.should.have.deep.property('info.version', 'v1.0');
            specs.should.have.deep.property('servers').that.is.eql([{
                url: '/user'
            }]);
        });

        it('should include postUserRegister route in generated swagger specification', function() {
            var specs = this.specs['v1.0'];

            specs.should.have.deep.property('paths./register.post').that.is.eql({
                operationId: 'postUserRegister_v1.0',
                tags: [ 'user' ],
                summary: 'Creates new user',
                description: 'User registration',
                'x-sdkMethodName': 'postUserRegister',
                parameters: [],
                requestBody: {},
                responses: {
                    '500': this.getInternalServerErrorResponseSpecs()
                }
            });
        });

        it('should include putUser route in generated swagger specification', function() {
            var specs = this.specs['v1.0'];

            specs.should.have.deep.property('paths./{id}.put').that.is.eql({
                operationId: 'putUser_v1.0',
                tags: ['user'],
                summary: '',
                requestBody: {},
                description: '',
                'x-sdkMethodName': 'updateUser',
                parameters: [
                    {
                        in: "path",
                        name: "id",
                        required: true,
                        type: "string"
                    }
                ],
                responses: {
                    '500': this.getInternalServerErrorResponseSpecs()
                }
            });
        });

    });

    describe('article router', function() {
        before(function() {
            //router2
            this.router = this.app.buildRouter({
                url: '/article',
                version: 2.1
            });

            this.createArticleRoute = this.router.buildRoute({
                url: '/',
                sdkMethodName: 'createArticle',
                summary: 'Create an article',
                type: 'post'
            });

            this.createArticleRoute.respondsWith({
                type: 'object',
                properties: {
                    title: {type: 'string'},
                    content: {type: 'string'},
                }
            });

            this.createArticleRoute.acceptsContentType('application/x-www-form-urlencoded');
            this.createArticleRoute.validate({
                type: 'object',
                properties: {
                    title: {type: 'string'},
                    content: {type: 'string'},
                }
            }, 'body');

            //
            this.deleteArticleRoute = this.router.buildRoute({
                url: '/:id',
                type: 'delete'
            });

            this.specs = swagger.generate(this.app);
        });

        it('should include swagger specification skeleton for v2.1 API', function() {
            var specs = this.specs;

            specs.should.have.property('v2.1').that.is.a('object');
            specs = specs['v2.1'];
            specs.should.have.property('openapi', '3.0.0');
            specs.should.have.deep.property('info.title', 'bi-service API documentation');
            specs.should.have.deep.property('info.version', 'v2.1');
            specs.should.have.deep.property('servers').that.is.eql([{
                url: '/article'
            }]);
        });

        it('should include postArticle route in generated swagger specification', function() {
            var specs = this.specs['v2.1'];

            specs.should.have.deep.property('paths./.post').that.is.eql({
                operationId: 'postArticle_v2.1',
                tags: [ 'article' ],
                summary: 'Create an article',
                description: '',
                'x-sdkMethodName': 'createArticle',
                parameters: [],
                requestBody: {
                    required: false,
                    description: '',
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: {type: 'string'},
                                    content: {type: 'string'}
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: " ",
                        content: {
                            'application/json': {
                                schema: {
                                    properties: {
                                      content: {
                                        type: "string"
                                      },
                                      title: {
                                        type: "string"
                                      }
                                    },
                                    type: "object"
                                }
                            }
                        }
                    },
                    '400': this.getValidationErrorResponseSpecs(),
                    '500': this.getInternalServerErrorResponseSpecs()
                }
            });
        });

        it('should include deleteArticle route in generated swagger specification', function() {
            var specs = this.specs['v2.1'];

            specs.should.have.deep.property('paths./{id}.delete').that.is.eql({
                operationId: 'deleteArticle_v2.1',
                tags: [ 'article' ],
                summary: '',
                description: '',
                'x-sdkMethodName': 'deleteArticle',
                requestBody: {},
                parameters: [
                    {
                        in: "path",
                        name: "id",
                        required: true,
                        type: "string"
                    }
                ],
                responses: {
                    '500': this.getInternalServerErrorResponseSpecs()
                }
            });
        });
    });
});
