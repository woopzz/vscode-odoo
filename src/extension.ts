// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ModelProvider } from './odoo-models';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-odoo" is now active!');

    // used to prevent the target line overlay
    const LINE_OFFSET = 3

    const modelProvider = new ModelProvider();
    vscode.window.registerTreeDataProvider('vscode-odoo-models', modelProvider);
    modelProvider.refresh();

    context.subscriptions.push(vscode.commands.registerCommand(
        'vscode-odoo.show-model-declaration',
        function (fpath: string, lineNo: number) {
            // do nothing when you click on a fist level item
            if (!fpath) return;

            const furi = vscode.Uri.file(fpath);
            const openingPromise = vscode.window.showTextDocument(furi);

            let offset = lineNo - LINE_OFFSET;
            if (offset < 1) offset = 1;

            openingPromise.then(() => vscode.commands.executeCommand('revealLine', {'lineNumber': offset, 'at': 'top'}));
        }
    ));

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('vscode-odoo.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from vscode-odoo!');
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
