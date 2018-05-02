function filterBox() {
    var input = $('#filterBox').attr('value');
    var re = new RegExp(input);

    Object.keys(window.swaggerUi.api.apis).map(function(group) {
        window.Docs.expandEndpointListForResource(group);
    });


    if (typeof filterBox.prevInput === 'string') {
        if (filterBox.prevInput === input) {
            return;
        }
    }

    var operations = window.swaggerUi.api.apisArray.reduce(function(out, api) {
        api.operationsArray.forEach(function(op) {
            out.push(op);
        });

        return out;
    }, []);

    var toBeHiddenOperationIds = [];
    var toBeDisplayedOperationIds = [];

    operations.forEach(function(op) {
        var url = op.host + op.basePath + op.path;
        var ids = [];
        (op.operation.tags || []).forEach(function(tag) {
            ids.push('#' + tag + '_' + op.nickname);
        });

        if (   !url.match(re)
            && !op.operation.summary.match(re)
            && !((op.vendorExtensions['x-sdkMethodName'] || '').match(re))
            && !op.operation.description.match(re)
        ) {
            toBeHiddenOperationIds = toBeHiddenOperationIds.concat(ids);
        } else {
            toBeDisplayedOperationIds = toBeDisplayedOperationIds.concat(ids);
        }
    });

    $(toBeHiddenOperationIds.join(', ')).css('display', 'none');
    $(toBeDisplayedOperationIds.join(', ')).css('display', 'block');
}

(function($) {
    $.QueryString = (function(paramsArray) {
        let params = {};

        for (let i = 0; i < paramsArray.length; ++i)
        {
            let param = paramsArray[i]
                .split('=', 2);

            if (param.length !== 2)
                continue;

            params[param[0]] = decodeURIComponent(param[1].replace(/\+/g, " "));
        }

        return params;
    })(window.location.search.substr(1).split('&'))
})(jQuery);

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
        var apiVersion = versions.indexOf($.QueryString.api_version || versions[0]);

        $('select').selectBox();
        $('select').selectBox("options", versions);
        $('select').selectBox('value', apiVersion);

        $('select').selectBox().change(function () {
            var spec = specs[versions[$(this).val()]];
            window.swaggerUi.setOption("spec", spec);
            window.swaggerUi.updateSwaggerUi({spec: spec});
            $.QueryString.api_version = versions[$(this).val()];
            history.pushState({}, '', '?' + $.param($.QueryString));
        });

        window.swaggerUi = new SwaggerUi({
            url: '',
            spec: specs[versions[apiVersion]],
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
