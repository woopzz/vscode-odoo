import * as vscode from 'vscode';
import * as child_process from 'child_process';

const LINE_OFFSET = 3;

class SearchListItem {
    constructor(
        public label: string,
        public path: string,
        public lineNo: number
    ) { }
}

class State {
    constructor (
        private _searchListItems: Array<SearchListItem>,
        private _searchString: string
    ) { }

    get searchListItems() {
        return this._searchListItems;
    }

    get searchString() {
        return this._searchString;
    }

    private _reset() {
        this._searchListItems = [];
        this._searchString = '';
    }

    public updateBySearchString(text: string, callback: null | Function, strictSearch: boolean) {
        const self = this;
        self._reset();

        return new Promise(function (resolve, reject) {
            self._searchString = text;
            if (!text) {
                resolve(null);
                return;
            }

            const config = vscode.workspace.getConfiguration('vscode-odoo');
            const addons_path = <string>config.get('addons_path');
            if (!addons_path) {
                reject('Invalid addons path!');
                return;
            }
            const addons_path_list = addons_path.split(',');

            const regex_text = strictSearch ? text : `.*${text}.*`;
            const regex = new RegExp(`^\\s*_(name|inherit) *= *[\\'\\"]${regex_text}[\\'\\"]\\s*$`);
            const cmd = `egrep -Rn "${regex.toString().slice(1, -1)}" ${addons_path_list.join(' ')}`;
            child_process.exec(cmd, {maxBuffer: 200000000}, function(err, stdout, stderr) {
                if (!stdout) {
                    resolve(null);
                    return;
                }

                stdout.split('\n').forEach(function (line) {
                    if (!line || !line.length) return;

                    const [fpath, lineNo, dirtyModelName] = line.split(':');

                    let label = fpath;
                    for (let i = 0; i < addons_path_list.length; i++)
                        if (fpath.startsWith(addons_path_list[i])) {
                            label = fpath.slice(addons_path_list[i].length);
                            break;
                        }

                    const item = new SearchListItem(label, fpath, parseInt(lineNo));
                    self._searchListItems.push(item);
                });

                resolve(null);
            });
        });
    }
}

export class SearchModelsViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'vscode-odoo.odoo-models';

    private _view?: vscode.WebviewView;

    private _state: State;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {
        this._state = new State([], '');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        const self = this;
        this._view = webviewView;

        webviewView.webview.options = {enableScripts: true};
        this.repaint();
        webviewView.webview.onDidReceiveMessage(this._manageMessage.bind(this));
    }

    public repaint() {
        if (this._view)
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    }

    private _manageMessage(payload: any) {
        switch (payload.command) {
            case 'strictSearch':
            case 'nonstrictSearch': {
                const strictSearch = payload.command === 'strictSearch';
                this._state.updateBySearchString(payload.text, this.repaint.bind(this), strictSearch)
                .then(() => this.repaint())
                .catch(msg => vscode.window.showErrorMessage(msg));
                break;
            }
            case 'openFile': {
                const placeInArray = parseInt(payload.index);
                const item = this._state.searchListItems[placeInArray];

                vscode.window.showTextDocument(vscode.Uri.file(item.path)).then(() => {
                    let offset: number = item.lineNo - LINE_OFFSET;
                    if (offset < 1) offset = 1;

                    vscode.commands.executeCommand('revealLine', {'lineNumber': offset, 'at': 'top'});
                });
                break;
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Odoo Models</title>
                <style>
                    #search-control {
                        display: flex;
                        width: 100%;
                    }
                    #search-control > * {
                        margin: 0 2px;
                        padding: 5px;
                        color: rgb(204, 204, 204);
                        background-color: rgb(66, 66, 66);
                        border: none;
                    }
                    #search-input {
                        min-width: 50px;
                        flex-grow: 2;
                        outline-color: #007fd4;
                    }
                    #strict-search-button, #nonstrict-search-button {
                        min-width: 40px;
                        cursor: pointer;
                    }
                    #strict-search-button:focus, #nonstrict-search-button:focus {
                        outline: 1px solid #007fd4;
                        outline-offset: -1px;
                    }
                    .search-list {
                        padding: 0;
                        margin: 0;
                        list-style-type: none;
                    }
                    .search-list-item {
                        padding: 0.5em 0;
                        cursor: pointer;
                    }
                    .search-list-item:hover {
                        color: red;
                    }
                </style>
            </head>
            <body>
                <div id="search-control">
                    <input id="search-input" value="${this._state.searchString}"/>
                    <button id="strict-search-button">S</button>
                    <button id="nonstrict-search-button">NS</button>
                </div>
                <ul class="search-list">
                    ${this._state.searchListItems.map((el, index) => `<li class="search-list-item" index="${index}">${el.label}</li>`).join('')}
                </ul>
                <script>
                    (function() {
                        const vscode = acquireVsCodeApi();
                        document.addEventListener('click', (e) => {
                            const target = e.target;
                            if (target.id === 'strict-search-button' || target.id === 'nonstrict-search-button') {
                                const command = target.id === 'strict-search-button' ? 'strictSearch' : 'nonstrictSearch';
                                vscode.postMessage({
                                    command: command,
                                    text: document.getElementById('search-input').value,
                                });
                            } else if (target.classList.contains('search-list-item')) {
                                vscode.postMessage({
                                    command: 'openFile',
                                    index: target.getAttribute('index'),
                                });
                            }
                        });
                    }())
                </script>
            </body>
        </html>`;
    }
}
