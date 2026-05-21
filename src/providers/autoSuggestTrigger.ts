import * as vscode from "vscode";
import { isCompletionInsertion, shouldAutoTriggerLaravelSuggest } from "../context/autoSuggestContext";
import type { Logger } from "../logging/logger";

const SUGGEST_DEBOUNCE_MS = 80;
const SUPPORTED_LANGUAGES = new Set(["php", "blade"]);

export class LaravelAutoSuggestTrigger implements vscode.Disposable {
  private readonly disposable: vscode.Disposable;
  private timer: ReturnType<typeof setTimeout> | undefined;

  public constructor(
    private readonly readEnabled: () => boolean,
    private readonly logger: Logger,
  ) {
    this.disposable = vscode.workspace.onDidChangeTextDocument((event) => this.onDidChangeTextDocument(event));
  }

  public dispose(): void {
    this.disposable.dispose();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
    if (!this.readEnabled()) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== event.document || !SUPPORTED_LANGUAGES.has(event.document.languageId)) {
      return;
    }

    const change = event.contentChanges[event.contentChanges.length - 1];
    if (!change || !isCompletionInsertion(change.text)) {
      return;
    }

    const position = change.range.start.translate(0, change.text.length);
    const linePrefix = event.document.lineAt(position.line).text.slice(0, position.character);
    const documentPrefix = event.document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    if (
      !shouldAutoTriggerLaravelSuggest({
        languageId: event.document.languageId,
        insertedText: change.text,
        linePrefix,
        documentPrefix,
      })
    ) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.logger.debug("[LaravelAutoSuggestTrigger] triggerSuggest", {
        languageId: event.document.languageId,
        line: position.line,
        character: position.character,
      });
      void vscode.commands.executeCommand("editor.action.triggerSuggest");
    }, SUGGEST_DEBOUNCE_MS);
  }
}
