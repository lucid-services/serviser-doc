#!/usr/bin/env node

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
        describe: 'Input nodejs module which exports an AppManager object',
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
    'Generates specs for each app found in exported `appManager` of the index.js module')
.help('h', false).argv;

yargs.showHelp('error');
process.exit(1);

function cmdGetSwagger(argv) {
    try {
        var file = require(argv.file);
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') {
            throw e;
        }
        console.error(`File ${argv.file} not found.`);
        process.exit(66);
    }

    var appManager = file.appManager;

    if (!appManager || Object.getPrototypeOf(appManager).constructor.name !== 'AppManager') {
        console.error('The provided module must export `appManager` object');
        process.exit(65);
    }

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

function appFilter(apps, whitelist) {
    //include only dirrect instances of App (excludes Doc & CLI apps etc)
    return apps.filter(function(app) {
        return app &&  Object.getPrototypeOf(app).constructor.name === 'App' && whitelist.indexOf(app.options.name) !== -1;
    });
}
