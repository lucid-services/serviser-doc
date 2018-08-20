[![Build Status](https://travis-ci.org/BohemiaInteractive/bi-service-doc.svg?branch=master)](https://travis-ci.org/BohemiaInteractive/bi-service-doc)   

This `bi-service` plugin generates documentation (`swagger-ui` like frontend) for `bi-service` Apps.  
Here is how it works in few steps:

* During service initialization, available `App`s are fetched from `AppManager`
* Open API (OAS) REST API specification is generated from static route definitions
* For each `App` in `AppManager`, corresponding (additional) `Doc` http app (which serves  the documentation frontend) is created and pushed into internal `AppManager` stack
* As `Doc` http apps implement the same interface of generic http `App` object, the service initialization process continues as it would without any documentation being generated.

![OpenAPI front-end screenshot](/public/openAPI-frontend.png?raw=true)

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
                baseUrl: 'http://127.0.0.1:3000',
                listen: 3000,
                title: 'User API',
                stopOnError: true
            }
        }
    }
}
```

### From what the docs are generated?

- [Router](https://bohemiainteractive.github.io/bi-service/Router.html) & [Route](https://bohemiainteractive.github.io/bi-service/Route.html) definitions.
- Validation schema definitions provided to the [route.validate](https://bohemiainteractive.github.io/bi-service/Route.html#validate) & [route.respondsWith](https://bohemiainteractive.github.io/bi-service/Route.html#respondsWith) methods.
- Supported request `content-type(s)` as defined via [route.acceptsContentType](https://bohemiainteractive.github.io/bi-service/Route.html#acceptsContentType)
- Custom `Ajv` keyword `$desc` which `bi-service` provides, can be used to describe individual request/response data properties in user defined `Route` validation schemas.
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

Also see `bi-service` [Error management](https://bohemiainteractive.github.io/bi-service/tutorial-1b.ErrorManagement.html)
