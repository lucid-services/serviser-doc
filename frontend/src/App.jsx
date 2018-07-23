import React, { Component } from 'react';
import { RedocStandalone } from 'redoc';
import Select, {Option} from 'rc-select';
import QueryString from 'query-string';
import axios from 'axios';
import 'rc-select/assets/index.css';
import './App.css';

class App extends Component {
    constructor(props) {
        super(props);
        const query = QueryString.parse(window.location.search);

        this.state = {
            versions: [],
            apis: {},
            version: query.api_version || null
        };

    }

    async componentDidMount() {
        const response = await axios.get('/specs');
        const versions = Object.keys(response.data);
        const version = this.state.version || versions[0];

        if (!this.state.version) {
            let query = QueryString.stringify({api_version: version});
            window.history.pushState({}, '', '?' + query);
        }

        this.setState({
            apis: response.data,
            versions: versions,
            version: version
        });

        this.changeWindowTitle(response.data[version].info.title);
    }

    changeWindowTitle(title) {
        window.document.title = title;
    }

    onVersionChange(e) {
        let value, query;
        if (e && e.target) {
            value = e.target.value;
        } else {
            value = e;
        }

        query = QueryString.stringify({api_version: value});
        window.history.pushState( {}, '', '?' + query);
        this.setState({
            version: value
        });
    }

    render() {
        if (!this.state.versions.length) {
            return null;
        }

        return (
            <div>
                <RedocStandalone
                    spec={this.state.apis[this.state.version]}
                    specUrl={`/specs/${this.state.version}`}
                    options={{
                        scrollYOffset: '#nav-bar',
                        suppressWarnings: true,
                        expandResponses: '200',
                        requiredPropsFirst: true,
                        pathInMiddlePanel: true
                    }}
                />
                <nav id="nav-bar">
                    <Select
                        id="version-select"
                        onChange={this.onVersionChange.bind(this)}
                        placeholder="Select API version"
                        dropdownMenuStyle={{maxHeight: 200}}
                        defaultValue={this.state.version}
                        style={{width: 260}}
                    >
                        {
                            this.state.versions.map(function(version) {
                                return <Option key={version} value={version}>{version}</Option>
                            })
                        }
                    </Select>
                </nav>
            </div>
        );
    }
}

export default App;
