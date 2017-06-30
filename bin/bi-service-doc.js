#!/bin/sh
":" //# http://sambal.org/?p=1014 ; exec /usr/bin/env node --preserve-symlinks "$0" "$@"

//disable parse-pos-args shell option of bi-config module
process.argv.push('--parse-pos-args');
process.argv.push('false');

var _     = require('lodash');
var path  = require('path');
var yargs = require('yargs');

var swagger = require('../lib/swagger.js');

var argv = yargs
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
    }
}, cmdGetSwagger)
.example('$0 get:swagger -f index.js --config /path/to/apps/config.json5',
    'Generates specs for each app found in `appManager` of the service')
.help('h', false).argv;

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
    var file = require(argv.file);

    if (file && Object.getPrototypeOf(file).constructor.name === 'Service') {
        var service = file;
        service.$setProjectRoot(path.dirname(argv.file));
        return service.$setup().then(function() {
            return getDoc(service.appManager);
        });
    } else if (file && Object.getPrototypeOf(file).constructor.name === 'AppManager') {
        return getDoc(file);
    } else {
        console.error('The provided module must export `Service` or `AppManager` object');
        process.exit(65);
    }


    function getDoc(appManager) {
        if (!argv.app.length) {
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
    //include only dirrect instances of App (excludes Doc & CLI apps etc)
    return apps.filter(function(app) {
        return app &&  Object.getPrototypeOf(app).constructor.name === 'App' && whitelist.indexOf(app.options.name) !== -1;
    });
}
