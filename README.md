[![Build Status](https://travis-ci.org/lucid-services/serviser-doc.svg?branch=master)](https://travis-ci.org/lucid-services/serviser-doc)   

This `serviser` plugin generates documentation (`swagger-ui` like frontend) for `serviser` Apps.  
Here is how it works in few steps:

* During service initialization, available `App`s are fetched from `AppManager`
* Open API (OAS) REST API specification is generated from static route definitions
* For each `App` in `AppManager`, corresponding (additional) `Doc` http app (which serves  the documentation frontend) is created and pushed into internal `AppManager` stack
* As `Doc` http apps implement the same interface of generic http `App` object, the service initialization process continues as it would without any documentation being generated.

![OpenAPI front-end screenshot](/public/openAPI-frontend.png?raw=true)

### USAGE

* Hook up the plugin into your application in your app's `index.js` file:

```javascript
const config  = require('serviser-config');
const Service = require('serviser');

//service initialization stuff...
const service = new Service(config);

//...

//hook-up the plugin
require('serviser-doc');
```

* Enable automatic Doc app generation in your service `config.json5`:

```javascript
{
    apps: {
        appName: {
            // provide the doc configuration section for each app you want
            // the documentation to be generated for
            doc: {
                baseUrl: 'http://127.0.0.1:3000',
                listen: 3000,
                title: 'User API', //optional
                stopOnError: true, //optional
                //allows us to include hand-crafted API description for each version
                readme: { //optional
                    'v2.0': 'lib/routes/v2.0/README.md'
                }
            }
        }
    }
}
```

### From what the docs are generated?

- [Router](https://lucid-services.github.io/serviser/Router.html) & [Route](https://lucid-services.github.io/serviser/Route.html) definitions - more specifically `desc` & `summary` constructor options.
- Validation schema definitions provided to the [route.validate](https://lucid-services.github.io/serviser/Route.html#validate) & [route.respondsWith](https://lucid-services.github.io/serviser/Route.html#respondsWith) methods.
- Supported request `content-type(s)` as defined via [route.acceptsContentType](https://lucid-services.github.io/serviser/Route.html#acceptsContentType)
- Custom `Ajv` keyword `$desc` which `serviser` provides, can be used to describe individual request/response data properties in user defined `Route` validation schemas.
    ```javascript
    route.respondsWith({ //200 - OK response
        type: 'object',
        properties: {
            is_active: {
                type: 'boolean',
                $desc: 'Whether the user has been online within a period of last 7 days'
            }
        }
    });

    //
    route.validate({
        username: {type: 'string'}
    }, 'params');
    ```
- Possible route error responses can be described also by the `route.respondsWith` method:
    ```javascript
    route.respondsWith(RequestError);
    route.respondsWith(new RequestError({
        apiCode: 'tag.alreadyExists'
        message: 'Tag already exists'
    }));
    route.respondsWith(UnauthorizedError);
    ```

Also see `serviser` [Error management](https://lucid-services.github.io/serviser/tutorial-1b.ErrorManagement.html)
