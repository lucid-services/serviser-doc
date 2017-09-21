#!/bin/sh
":" //# http://sambal.org/?p=1014 ; exec /usr/bin/env node --preserve-symlinks "$0" "$@"

//disable parse-pos-args shell option of bi-config module
//does not apply for bi-service>=1.0.0-alpha
//@deprecated
process.argv.push('--parse-pos-args');
process.argv.push('false');

const _      = require('lodash');
const path   = require('path');
const yargs  = require('yargs');
const config = require('bi-config');

const swagger = require('../lib/swagger.js');

const argv = yargs
.usage('$0 <command> [option]...')
.command('get:swagger', 'Generates swagger json specification of given apps', {
    file: {
        alias: 'f',
        describe: 'Input nodejs module which exports a Service or AppManager object',
        required: true,
        coerce: path.resolve,
        type: 'string'
    },
    app: {
        alias: 'a',
        describe: 'app name restrictions',
        type: 'string',
        default: [],
        array: true,
    },
    config: {
        describe: 'Config file destination',
        global: true,
        type: 'string'
    }
}, cmdGetSwagger)
.example('$0 get:swagger -f index.js --config /path/to/apps/config.json5',
    'Generates specs for each app found in `appManager` of the service')
.help('h', false).alias('h', 'help').argv;

function cmdGetSwagger(argv) {
    try {
        require.resolve(argv.file);
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') {
            throw e;
        }
        console.error(`File ${argv.file} not found.`);
        process.exit(66);
    }
    config.initialize({fileConfigPath: argv.config});

    var file = require(argv.file);

    if (file && Object.getPrototypeOf(file).constructor.name === 'Service') {
        var service = file;
        //project root correction as otherwise it would point to the cwd
        //the bin/bi-service-doc was executed from
        service.$setProjectRoot(path.dirname(argv.file));
        //project name = package.json -> name ... thus needs to be updated
        //after project root correction
        service.$setProjectName();
        return service.$setup().then(function() {
            //required - wait until all apps are initialized
            return process.nextTick(function() {
                return getDoc(service.appManager);
            });
        });
    } else if (file && Object.getPrototypeOf(file).constructor.name === 'AppManager') {
        return getDoc(file);
    } else {
        console.error('The provided module must export `Service` or `AppManager` object');
        process.exit(65);
    }


    function getDoc(appManager) {
        if (!argv.app.length) {
            //no specific apps were listed by an user so generate specs
            //for all available apps
            argv.app = _.map(appManager.apps, 'options.name');
        }

        var specs = {};

        appFilter(appManager.apps, argv.app).reduce(function(specs, app) {
            specs[app.options.name] = swagger.generate(app);
            return specs;
        }, specs);

        process.stdout.write(JSON.stringify(specs));
        process.exit(0);
    }
}

function appFilter(apps, whitelist) {
    return apps.filter(function(app) {
        return app && whitelist.indexOf(app.options.name) !== -1;
    });
}
