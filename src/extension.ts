import * as vscode from 'vscode';
import { SearchModelsViewProvider } from './search-models';

export function activate(context: vscode.ExtensionContext) {
    _activate_search_models(context);
}

export function deactivate() {}

function _activate_search_models(context: vscode.ExtensionContext) {
    const provider = new SearchModelsViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SearchModelsViewProvider.viewType, provider));
}
