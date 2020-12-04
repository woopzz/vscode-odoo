import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';

export class ModelProvider implements vscode.TreeDataProvider<ModelTreeItem> {

    private data: any = {};
    private regex: RegExp = /^\s*_(name|inherit) *= *[\'\"](.*)[\'\"]\s*$/;

    private _onDidChangeTreeData: vscode.EventEmitter<ModelTreeItem | undefined | null | void> = new vscode.EventEmitter<ModelTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ModelTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    /* Tree Data Provider's overridden methods */

    refresh(): void {
        const self = this;

        const config = vscode.workspace.getConfiguration('vscode-odoo');
        const addons_path = <string>config.get('addons_path');
        if (!addons_path) return;

        const cmd = `egrep -Rn "${self.regex.toString().slice(1, -1)}" ${addons_path.split(',').join(' ')}`;
        child_process.exec(cmd, {maxBuffer: 200000000}, function(err, stdout, stderr) {
            if (!stdout) {
                vscode.window.showWarningMessage('No Odoo models found!');
                if (err) console.error(`egrep error with code ${err.code || '(unset)'}.`);
                return;
            }

            self.data = {};

            let fpath, lineNo, dirtyModelName, match, modelName;
            stdout.split('\n').forEach(function (line) {
                if (!line || !line.length) return;
                [fpath, lineNo, dirtyModelName] = line.split(':');

                match = self.regex.exec(dirtyModelName);
                modelName = match ? match[2] : '=_=';

                lineNo = parseInt(lineNo);

                if (self.data[modelName] === undefined) {
                    self.data[modelName] = [{fpath, lineNo}];
                } else {
                    self.data[modelName].push({fpath, lineNo});
                }
            });

            self._onDidChangeTreeData.fire();
        });
    }

    getTreeItem(element: ModelTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ModelTreeItem): Array<ModelTreeItem>|null {
        const modelNames = Object.keys(this.data);

        if (element === undefined) {
            // the root element
            return modelNames.map(item => new ModelTreeItem(item, '', 0, vscode.TreeItemCollapsibleState.Collapsed));
        } else if (modelNames.includes(element.label)) {
            // second level elements
            let label;
            return this.data[element.label].map(function (item: any) {
                label = item.fpath.split(path.sep).slice(-4).join(path.sep);
                return new ModelTreeItem(label, item.fpath, item.lineNo, vscode.TreeItemCollapsibleState.None);
            });
        } else {
            /* *_* */
            return null;
        }
    }
}


class ModelTreeItem extends vscode.TreeItem {

    constructor(
        public readonly label: string,
        public readonly fpath: string,
        public readonly lineNo: number,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }

    command: vscode.Command = {
        command: 'vscode-odoo.show-model-declaration',
        title: '',
        arguments: [this.fpath, this.lineNo]
    }
}
