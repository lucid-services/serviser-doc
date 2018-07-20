const chai    = require('chai');
const Service = require('bi-service');
const Config  = require('bi-config');

const faker    = require('../../lib/faker.js');
const swagger  = require('../../lib/swagger.js');

const expect = chai.expect;

chai.should();

const config = Config.createMemoryProvider({
    apps: {
        test: {baseUrl: 'http://127.0.0.1'}
    }
});
const service = new Service(config);
const app = service.buildApp('test');

describe('faker', function() {
    describe('generateRoutePrameters', function() {
        before(function() {
            this.router = app.buildRouter({
                url: '/api/{version}/',
                version: 1
            });

            this.route = this.router.buildRoute({
                type: 'post',
                url: '/curl/:id'
            }).acceptsContentType(
                'application/json'
            ).validate({
                required: ['id'],
                properties: {
                    id: {type: 'integer', minimum: 0}
                }
            }, 'params').validate({
                required: ['param1', 'param2', 'param3'],
                properties: {
                    param1: {type: 'string', minLength: 2,  maxLength: 10},
                    param2: {type: 'string', pattern: '^[a-z]{2,9}$'},
                    param3: {type: 'string', format: 'email'}
                }
            }, 'query').validate({
                required: ['content-type'],
                properties: {
                    'content-type': {type: 'string', enum: [
                        'application/json'
                    ]}
                }
            }, 'headers').validate({
                required: ['username', 'country'],
                properties: {
                    username: {type: 'string'},
                    country: {
                        type: "object",
                        required: ['code_2'],
                        properties: {
                            code_2: {type: 'string', pattern: '^[A-Z]{2}$'}
                        }
                    }
                }
            }, 'body');
        });

        it('should generate valid request parameters', function() {
            const route = this.route;
            let validators = route.steps.filter(function(middleware) {
                return middleware.name == 'validator';
            });

            let parameters = swagger.describeRouteParameters(
                validators,
                app.getValidator(),
                route
            );

            return faker.generateRoutePrameters(
                parameters.parameters,
                parameters.requestBody.content['application/json'].schema
            ).then(function(data) {
                data.query.param1.should.match(/^.{2,10}$/);
                data.query.param2.should.match(/^[a-z]{2,9}$/);
                data.query.param3.should.match(/^.+@.+\..+$/);
                data.path.id.should.be.a('number');
                data.header['content-type'].should.be.equal('application/json');
                data.body.username.should.be.a('string');
                data.body.country.should.have.property('code_2').that.match(/^[A-Z]{2}$/);
            });
        });
    });
});
