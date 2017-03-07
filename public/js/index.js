$(function () {
    var supportedSubmitMethods = [];

    if (window.docSettings.tryItOut) {
        supportedSubmitMethods = ['get', 'post', 'put', 'delete', 'patch'];
    }

    // Pre load translate...
    if(window.SwaggerTranslator) {
        window.SwaggerTranslator.translate();
    }

    $.get( "/specs", function( specs ) {
        var versions = Object.keys(specs);

        $('select').selectBox();
        $('select').selectBox("options", versions);

        $('select').selectBox().change(function () {
            var spec = specs[versions[$(this).val()]];
            window.swaggerUi.setOption("spec", spec);
            window.swaggerUi.updateSwaggerUi({spec: spec});
        });

        window.swaggerUi = new SwaggerUi({
            url: '',
            spec: specs[versions[0]],
            jsonEditor: false,
            showOperationIds: true,
            validatorUrl: null,
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
    });

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
