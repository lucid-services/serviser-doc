# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) 
and this project adheres to [Semantic Versioning](http://semver.org/).

## v0.9.0

[CHANGED] - minimum required dependency of `bi-service@0.15.0`

## v0.8.3

[FIXED] - cli - a failure with projects which contain symlinked dependencies
[FIXED] - cli - misleading & incorrect error was being presented to an user when any module (file) other than the main app entry file was not found

## v0.8.2

[FIXED] - global variable leak - caused overwritings generated swagger specs object for bi-service apps

## v0.8.1

[FIXED] - It should be ensured that all parameters which are part of an url, are described (should be included in `parameters` array)

## v0.8.0

[ADDED] - dynamic url path segments sorting - ensures the swagger json output is deterministic in that regard
[ADDED] - `bi-service-doc` shell script
[ADDED] - custom `sdkMethodName` to swagger schema
[CHANGED] - the API this module exports to an user has been changed. A `Doc` app is no longer dirrect instance of `App` but rather `Doc` (expected to be compatible with `bi-service` >0.10.x)

## v0.7.1

[FIXED] - failure when building inplace validator schema in form of a function

## v0.7.0

[ADDED] - request "header" parameters support
[CHANGED] - route response descriptors come in form of an array for each response code since bi-service@0.10.x, the array is merged into one response schema. This allows a route to describe multiple "variations" of same error response (eg. all api codes the route responds with).
[FIXED] - don't overwrite default `json-inspector` options as they should be same as for request parameters validators
[FIXED] - the module requires `bi-service@0.10.0` or higher

## v0.6.4

[FIXED] - missing support for `function` schema definition & schema references. Response schemas share common context with request validator definitions.

## v0.6.3

[FIXED] - swagger specification inconsistencies
[FIXED] - `additionalProperties` of object were not being rendered for response bodies

## v0.6.2

[FIXED] - undeclared variables

## v0.6.1

[CHANGED] - rename the module from `bi-docs` to `bi-service-doc`

## v0.6.0

[ADDED] - makes from this module a plugin which registers itself ones required to the application (since `bi-service@0.9.0`)

## 0.5.4

[FIXED] - filter out regex pattern in express url segments Eg: /url/:id(\d+) => /url/:id

## 0.5.3

[FIXED] - bugs in validator build logic causing the swagger schema build process to fail completely
[FIXED] - incorrect url tagging algorithm
[REMOVED] - unused `semver` module

## 0.5.2

[FIXED] - swagger schema was being builded too soon as not all valdators were not registered yet

## 0.5.1

[FIXED] - incorrect nonexistent module `json-inspector` required instead of `bi-json-inspector`

## 0.5.0

[ADDED] - first "stable" release
