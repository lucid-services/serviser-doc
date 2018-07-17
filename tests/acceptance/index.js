var service = require('bi-service');

before(function() {
    this.getInternalServerErrorResponseSpecs = function() {
        var specs = {
            description:"Please, contact official support. Don't repeat the request in the nearest future.",
            content: {
                'application/json': {
                    schema:{
                        type:"object",
                        required:["code","uid","message"],
                        properties:{
                            code:{type:"integer",format:"int64",example:500},
                            uid:{
                                type:"float"
                            },
                            message:{
                                type:"string",
                                format:"varchar(255)",
                                example:"Internal Server Error"
                            }
                        }
                    }
                }
            }
        };

        return specs;
    };

    this.getBadRequestErrorResponseSpecs = function() {
        return (new service.error.RequestError).toSwagger();
    };

    this.getValidationErrorResponseSpecs = function() {
        let specs = (new service.error.ValidationError).toSwagger();
        return {
            description: specs.description,
            content: {
                'application/json': {
                    schema: specs.schema
                }
            }
        };
    };
});
