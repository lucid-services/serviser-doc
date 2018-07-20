const fs       = require('fs');
const path     = require('path');
const mustache = require('mustache');
const json5    = require('json5');

const cache = {};

module.exports = render;
module.exports.renderMarkdownReadme = renderMarkdownReadme;
module.exports.renderCurlExample = renderCurlExample;
module.exports.renderJavaScriptExample = renderJavaScriptExample;


/**
 * @param {String} template
 * @param {Object} context
 *
 * @return {String}
 */
function render(template, context) {

    let pth = path.resolve(__dirname + `/templates/${template}.mustache`);
    let tmpl;

    if (cache.hasOwnProperty(pth)) {
        tmpl = cache[pth];
    } else {
        tmpl = fs.readFileSync(pth).toString();
        cache[pth] = tmpl;
    }

    return mustache.render(tmpl, context);
}

/**
 * @param {Array<Route>}
 * @return {String}
 */
function renderMarkdownReadme(urlList) {

    return render('readme', {
        urlList: urlList,
        pad: _pad,
        toUpperCase: _toUpperCase
    });
}

/**
 * @param {String} httpVerb
 * @param {String} url
 * @param {Object} params
 * @param {Object} params.query
 * @param {Object} params.path
 * @param {Object} params.header
 * @param {Object} [params.body]
 * @return {String}
 */
function renderCurlExample(httpVerb, url, params) {
    return render('code_snippets/curl', {
        httpVerb: httpVerb,
        url: url,
        headers: _toList(params.header || {}),
        body: JSON.stringify(params.body, null, 2),
        toUpperCase: _toUpperCase
    });
}

/**
 * @param {String} httpVerb
 * @param {String} url
 * @param {Object} params
 * @param {Object} params.query
 * @param {Object} params.path
 * @param {Object} params.header
 * @param {Object} [params.body]
 * @return {String}
 */
function renderJavaScriptExample(httpVerb, url, params) {
    return render('code_snippets/JavaScript', {
        httpVerb: httpVerb,
        options: json5.stringify({
            url: url,
            headers: params.header,
            params: params.query,
            data: params.body
        }, null, 2),
        toLowerCase: _toLowerCase
    });
}

function _toList(obj) {
    let out = [];

    Object.keys(obj).forEach(function(key) {
        out.push({name: key, value: obj[key]})
    });

    return out;
}

function _pad(str) {
    return function pad(text, render) {
        let str = render(text);
        if (str.length < 6) {
            for (let i = 0, len = 6-str.length; i < len; i++) {
                str += '&ensp;';
            }
        }

        return str;
    }
}

function _toUpperCase() {
    return function toUpperCase(text, render) {
        return render(text).toUpperCase();
    }
}

function _toLowerCase() {
    return function toLowerCase(text, render) {
        return render(text).toLowerCase();
    }
}
