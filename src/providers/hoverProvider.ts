import * as vscode from "vscode";
import { resolveFrontendResponseFieldContext } from "../context/frontendResponseContext";
import type { LaravelIndex } from "../indexer";
import type { Logger } from "../logging/logger";

const FRONTEND_RESPONSE_LANGUAGES = new Set(["javascript", "javascriptreact", "typescript", "typescriptreact", "vue", "svelte"]);

export class LaravelHoverProvider implements vscode.HoverProvider {
  public constructor(
    private readonly getIndex: () => LaravelIndex | undefined,
    private readonly logger: Logger,
  ) {}

  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    if (!FRONTEND_RESPONSE_LANGUAGES.has(document.languageId)) {
      return undefined;
    }

    const index = this.getIndex();
    if (!index) {
      return undefined;
    }

    const fieldContext = resolveFrontendResponseFieldContext(document.getText(), document.offsetAt(position));
    if (fieldContext.kind !== "response-field") {
      this.logger.debug("[LaravelHoverProvider.provide] no frontend response field context", {
        file: document.uri.fsPath,
        reason: fieldContext.reason,
      });
      return undefined;
    }

    const item = index.frontendResponseField(fieldContext.request, fieldContext.fieldPath);
    if (!item) {
      this.logger.debug("[LaravelHoverProvider.provide] no frontend response field match", {
        file: document.uri.fsPath,
        requestKind: fieldContext.request.kind,
        requestValue: fieldContext.request.value,
        method: fieldContext.request.method,
        fieldPath: fieldContext.fieldPath,
      });
      return undefined;
    }

    this.logger.debug("[LaravelHoverProvider.provide] frontend response field hover", {
      file: document.uri.fsPath,
      requestKind: fieldContext.request.kind,
      requestValue: fieldContext.request.value,
      method: fieldContext.request.method,
      fieldPath: fieldContext.fieldPath,
      responseSourceKind: item.responseSourceKind,
      responseSourceClass: item.responseSourceClass,
    });

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**Laravel response field** \`${item.key}\`\n\n`);
    markdown.appendMarkdown(`Route: \`${item.responseHttpMethod ?? "ANY"} ${item.responseRouteUri ?? item.uri ?? item.key}\`\n\n`);
    if (item.responseRouteName) {
      markdown.appendMarkdown(`Route name: \`${item.responseRouteName}\`\n\n`);
    }
    if (item.responseSourceClass) {
      markdown.appendMarkdown(`Source: \`${item.responseSourceClass}\`${item.responseSourceKind ? ` (${item.responseSourceKind})` : ""}`);
    } else if (item.responseSourceKind) {
      markdown.appendMarkdown(`Source: \`${item.responseSourceKind}\``);
    }

    return new vscode.Hover(
      markdown,
      new vscode.Range(
        document.positionAt(fieldContext.rangeStart),
        document.positionAt(fieldContext.rangeEnd),
      ),
    );
  }
}
