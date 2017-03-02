$(function () {
    $.get( "/specs", function( data ) {
        console.log(typeof data);
        console.log(data);
    });

    var supportedSubmitMethods = [];

    if (window.docSettings.tryItOut) {
        supportedSubmitMethods = ['get', 'post', 'put', 'delete', 'patch'];
    }


    // Pre load translate...
    if(window.SwaggerTranslator) {
        window.SwaggerTranslator.translate();
    }
    window.swaggerUi = new SwaggerUi({
        url: window.docSettings.url,
        jsonEditor: false,
        dom_id: "swagger-ui-container",
        supportedSubmitMethods: supportedSubmitMethods,
        onComplete: function(swaggerApi, swaggerUi){
            if(typeof initOAuth == "function") {
                initOAuth({
                    clientId: "your-client-id",
                    clientSecret: "your-client-secret-if-required",
                    realm: "your-realms",
                    appName: "your-app-name",
                    scopeSeparator: ",",
                    additionalQueryStringParams: {}
                });
            }

            if(window.SwaggerTranslator) {
                window.SwaggerTranslator.translate();
            }

            $('pre code').each(function(i, e) {
                hljs.highlightBlock(e)
            });

            addApiKeyAuthorization();
        },
        onFailure: function(data) {
            console.log("Unable to Load SwaggerUI");
        },
        docExpansion: "none",
        apisSorter: "alpha",
        defaultModelRendering: 'schema',
        showRequestHeaders: false
    });

    $('#input_apiKey').change(addApiKeyAuthorization);
    window.swaggerUi.load();

    function addApiKeyAuthorization(){
        //var key = encodeURIComponent($('#input_apiKey')[0].value);
        var key = '';
        if(key && key.trim() != "") {
            var apiKeyAuth = new SwaggerClient.ApiKeyAuthorization("api_key", key, "query");
            window.swaggerUi.api.clientAuthorizations.add("api_key", apiKeyAuth);
            console.log("added key " + key);
        }
    }
});
