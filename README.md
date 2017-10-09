[![Build Status](https://travis-ci.org/BohemiaInteractive/bi-service-doc.svg?branch=master)](https://travis-ci.org/BohemiaInteractive/bi-service-doc)  

This `bi-service` plugin generates documentation (`swagger-ui` like frontend) for `bi-service` Apps.  
Here is how it works in few steps:

* During service initialization, `App`s are fetched from `AppManager`
* Open API (OAS) REST API specification is generated from static route definitions
* For each `App` in `AppManager`, corresponding `Doc` app (which serves  the documentation frontend) is created and pushed into internal `AppManager` stack
* As `Doc` apps imlement the same interface of regular `App` object, the service initialization process continues as it would without any documentation being generated.

### USAGE

* Hook up the plugin into your application in your app's `index.js` file:

```javascript
const config  = require('bi-config');
const Service = require('bi-service');

//service initialization stuff...
const service = new Service(config);

//...

//hook-up the plugin
require('bi-service-doc');
```

* Enable automatic Doc app generation in your service `config.json5`:

```javascript
{
    apps: {
        appName: {
            // provide the doc configuration section for each app you want
            // the documentation to be generated for
            doc: {
                baseUrl: '127.0.0.1:3000',
                listen: 3000,
                name: 'docs',
                title: 'User API',
                stopOnError: true,
                tryItOut: true
            }
        }
    }
}
```
