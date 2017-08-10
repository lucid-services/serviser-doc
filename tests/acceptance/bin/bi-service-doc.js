var fs           = require('fs');
var path         = require('path');
var sinon        = require('sinon');
var chai         = require('chai');
var sinonChai    = require("sinon-chai");
var childProcess = require('child_process');

function spawn(args, options) {
    options = options || {};
    var cmd = path.normalize(__dirname + '/../../../bin/bi-service-doc.js');
    args.unshift(cmd);

    var result = childProcess.spawnSync('node', args, {
        cwd: options.cwd,
        env: { NODE_ENV: 'development' }
    });

    if (result.error) {
        throw result.error;
    }

    return result;
}

describe('bin/bi-service-doc', function() {

    it('should dump to stdout json swagger specification for all apps (app1 & app2)', function() {
        var result = spawn([
            'get:swagger',
            '--config',
            path.resolve(__dirname + '/../../app/config.json5'),
            '-f',
            './index.js'
        ], {
            cwd: path.resolve(__dirname + '/../../app')
        });

        result.status.should.be.equal(0);
        result.stderr.toString().should.be.equal("");
        var specs = JSON.parse(result.stdout.toString());
        specs.should.be.a('object');
        specs.should.have.property('app1');
        specs.should.have.property('app2');
    });

    it('should dump to stdout json swagger specification for all apps (app1 & app2) (2)', function() {
        var result = spawn([
            'get:swagger',
            '--config',
            path.resolve(__dirname + '/../../app/config.json5'),
            '-f',
            path.resolve(__dirname + '/../../app/index.js'),
        ]);

        result.status.should.be.equal(0);
        result.stderr.toString().should.be.equal("");
        var specs = JSON.parse(result.stdout.toString());
        specs.should.be.a('object');
        specs.should.have.property('app1');
        specs.should.have.property('app2');
    });

    it('should dump to stdout json swagger specification for app1 only', function() {
        var result = spawn([
            'get:swagger',
            '--config',
            path.resolve(__dirname + '/../../app/config.json5'),
            '-f',
            path.resolve(__dirname + '/../../app/index.js'),
            '-a',
            'app1'
        ]);

        result.status.should.be.equal(0);
        result.stderr.toString().should.be.equal("");
        var specs = JSON.parse(result.stdout.toString());
        specs.should.be.a('object');
        specs.should.have.property('app1');
        specs.should.not.have.property('app2');
    });

    it('should fail with exit code: 66 when no bi-service app enterence file is found', function() {
        var result = spawn([
            'get:swagger',
            '--config',
            path.resolve(__dirname + '/../../app/config.json5'),
            '-f',
            path.resolve(__dirname + '/some/path/which/does/not/exit.js')
        ]);

        result.status.should.be.equal(66);
        result.stderr.toString().should.match(/File\ .+ not found/);
    });

    it('should fail with exit code: 65 when provided bi-service app enterence file does not implement required interface', function() {
        var result = spawn([
            'get:swagger',
            '--config',
            path.resolve(__dirname + '/../../app/config.json5'),
            '-f',
            path.resolve(__dirname + '/../../../index.js')
        ]);

        result.status.should.be.equal(65);
        result.stderr.toString().should.match(/The provided module must export `Service` or `AppManager` object/);
    });
});
