const chai = require('chai');

const renderer = require('../../lib/renderer.js');

const expect = chai.expect;

chai.should();

describe('renderer', function() {
    describe('readme', function() {

        it('should return rendered route list in markdown', function() {
            const urlList = [
                {
                    url: '/api/v1.0/readme1',
                    method: 'get',
                    uid: 'getReadme1_v1.0'
                },
                {
                    url: '/api/v1.0/readme1',
                    method: 'post',
                    uid: 'postReadme1_v1.0'
                },
                {
                    url: '/api/v1.0/readme3',
                    method: 'delete',
                    uid: 'deleteReadme3_v1.0'
                },
            ];

            let expected =
            '\n' +
            '<details>\n' +
            '    <summary>\n' +
            '        URL summary\n' +
            '    </summary>\n' +
            '\n' +
            '    GET&ensp;&ensp;&ensp; [/api/v1.0/readme1](#operation/getReadme1_v1.0)  \n' +
            '    POST&ensp;&ensp; [/api/v1.0/readme1](#operation/postReadme1_v1.0)  \n' +
            '    DELETE [/api/v1.0/readme3](#operation/deleteReadme3_v1.0)  \n' +
            '</details>\n';

            renderer.renderMarkdownReadme(urlList).should.be.eql(expected);
        });
    });

    describe('code snippets', function() {
        before(function() {
            this.data = {
                query: {
                    param1: 'test',
                    param2: 'abcd',
                    param3: 'test@test.test',
                },
                path: {
                    id: 12345
                },
                header: {
                    'content-type': 'application/json'
                },
                body: {
                    username: 'test',
                    country: {
                        code_2: 'US'
                    }
                }
            };
        });

        describe('curl', function() {

            it('should generate valid curl command example', function() {
                const expectedCurl =
                    'curl -X POST http://127.0.0.1/api/v1.0/curl/12345?param1=test&param2=abcd&param3=test%40test.test \\\n' +
                    '-H "content-type: application/json" \\\n' +
                    '-d @- << EOF\n' +
                    '{\n' +
                    '  "username": "test",\n' +
                    '  "country": {\n' +
                    '    "code_2": "US"\n' +
                    '  }\n' +
                    '}\n' +
                    'EOF\n';

                let url = 'http://127.0.0.1/api/v1.0/curl/12345?param1=test&param2=abcd&param3=test%40test.test';
                let curl = renderer.renderCurlExample('post', url, this.data);
                curl.should.eql(expectedCurl)
            });
        });

        describe('JavaScript', function() {

            it('should generate valid curl command example', function() {
                const expected =
                     '\n' +
                     'const axios = require(\'axios\');\n' +
                     '\n' +
                     'return axios.post({\n' +
                     '  url: \'http://127.0.0.1/api/v1.0/curl/12345\',\n' +
                     '  headers: {\n' +
                     '    \'content-type\': \'application/json\',\n' +
                     '  },\n' +
                     '  params: {\n' +
                     '    param1: \'test\',\n' +
                     '    param2: \'abcd\',\n' +
                     '    param3: \'test@test.test\',\n' +
                     '  },\n' +
                     '  data: {\n' +
                     '    username: \'test\',\n' +
                     '    country: {\n' +
                     '      code_2: \'US\',\n' +
                     '    },\n' +
                     '  },\n' +
                     '}).then(function(response) {\n' +
                     '  console.log(response.data);\n' +
                     '  console.log(response.status);\n' +
                     '  console.log(response.headers);\n' +
                     '}).catch(function(err) {\n' +
                     '  if(err.response) {\n' +
                     '    console.log(err.response.data);\n' +
                     '    console.log(err.response.status);\n' +
                     '    console.log(err.response.headers);\n' +
                     '  }\n' +
                     '});\n';

                let url = 'http://127.0.0.1/api/v1.0/curl/12345';
                let curl = renderer.renderJavaScriptExample('post', url, this.data);
                curl.should.eql(expected)
            });
        });
    });

});
