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

    public updateBySearchString(text: string, callback: null | Function) {
        const self = this;
        self._reset();
        self._searchString = text;
        if (!text) return;

        const config = vscode.workspace.getConfiguration('vscode-odoo');
        const addons_path = <string>config.get('addons_path');
        if (!addons_path) {
            vscode.window.showErrorMessage('Invalid addons path!');
            return;
        }
        const addons_path_list = addons_path.split(',');

        const regex = new RegExp(`^\\s*_(name|inherit) *= *[\\'\\"].*${text}.*[\\'\\"]\\s*$`);
        const cmd = `egrep -Rn "${regex.toString().slice(1, -1)}" ${addons_path_list.join(' ')}`;
        child_process.exec(cmd, {maxBuffer: 200000000}, function(err, stdout, stderr) {
            if (!stdout) return;

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

            if (callback) callback();
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
            case 'search': {
                this._state.updateBySearchString(payload.text, this.repaint.bind(this));
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
                    .search-list {
                        padding: 0;
                        margin: 0;
                        list-style-type: none;
                    }
                    .search-list-item {
                        cursor: pointer;
                        padding: 0.5em 0;
                    }
                    .search-list-item:hover {
                        color: red;
                    }
                </style>
            </head>
            <body>
                <input id="search-input" value="${this._state.searchString}"/>
                <button id="search-button">Search</button>
                <ul class="search-list">
                    ${this._state.searchListItems.map((el, index) => `<li class="search-list-item" index="${index}">${el.label}</li>`).join('')}
                </ul>
                <script>
                    (function() {
                        const vscode = acquireVsCodeApi();
                        document.addEventListener('click', (e) => {
                            const target = e.target;
                            if (target.id === 'search-button') {
                                vscode.postMessage({
                                    command: 'search',
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
