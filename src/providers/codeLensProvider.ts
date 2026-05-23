import * as vscode from "vscode";
import { collectFrontendUrlAliases, extractFrontendHttpRequestsFromLine } from "../context/frontendHttpContext";
import type { LaravelIndex } from "../indexer";
import type { Logger } from "../logging/logger";

const FRONTEND_HTTP_LENS_LANGUAGES = new Set(["blade", "javascript", "javascriptreact", "typescript", "typescriptreact", "vue", "svelte"]);

export class LaravelCodeLensProvider implements vscode.CodeLensProvider {
  public constructor(
    private readonly getIndex: () => LaravelIndex | undefined,
    private readonly logger: Logger,
  ) {}

  public provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
    const index = this.getIndex();
    if (!index) {
      return [];
    }

    if (FRONTEND_HTTP_LENS_LANGUAGES.has(document.languageId)) {
      return this.provideFrontendHttpRouteCodeLenses(document, index);
    }

    const lenses = index.controllerMethodsInFile(document.uri.fsPath).flatMap((method) => {
      const references = index.routeReferencesForControllerMethod(method.key);
      if (references.length === 0) {
        return [];
      }

      const title = references.length === 1 ? "1 route" : `${references.length} routes`;
      return [
        new vscode.CodeLens(new vscode.Range(method.source.line, 0, method.source.line, 0), {
          title,
          command: "laravelKHelper.openRouteReference",
          arguments: [method.key],
        }),
      ];
    });

    this.logger.debug("[LaravelCodeLensProvider.provide] controller route lenses", {
      file: document.uri.fsPath,
      count: lenses.length,
    });

    return lenses;
  }

  private provideFrontendHttpRouteCodeLenses(document: vscode.TextDocument, index: LaravelIndex): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const lines = Array.from({ length: document.lineCount }, (_, lineNumber) => document.lineAt(lineNumber).text);
    const aliases = collectFrontendUrlAliases(lines);

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
      const line = lines[lineNumber] ?? "";
      for (const reference of extractFrontendHttpRequestsFromLine(line, aliases)) {
        const item =
          reference.kind === "route-name"
            ? index.findHttpRouteByName(reference.value) ?? index.find("route", reference.value)
            : index.findHttpRouteByRequest(reference.value, reference.method);
        if (!item) {
          this.logger.debug("[LaravelCodeLensProvider.provide] no frontend HTTP route match", {
            file: document.uri.fsPath,
            line: lineNumber,
            kind: reference.kind,
            value: reference.value,
            method: reference.method,
          });
          continue;
        }

        const method = item.httpMethod ? `${item.httpMethod} ` : "";
        const uri = item.uri ?? item.key;
        const title = reference.kind === "route-name"
          ? `Laravel route: ${reference.value}${item.uri ? ` -> ${method}${uri}` : ""}`
          : `Laravel route: ${method}${uri}`;
        lenses.push(
          new vscode.CodeLens(new vscode.Range(lineNumber, 0, lineNumber, 0), {
            title,
            command: "laravelKHelper.openSourceLocation",
            arguments: [item.source],
          }),
        );
        if (item.controllerSource) {
          const controller = item.controllerClass?.split("\\").pop() ?? item.controllerClass;
          const action = controller && item.method ? `${controller}@${item.method}` : item.detail ?? "controller";
          lenses.push(
            new vscode.CodeLens(new vscode.Range(lineNumber, 0, lineNumber, 0), {
              title: `Controller: ${action}`,
              command: "laravelKHelper.openSourceLocation",
              arguments: [item.controllerSource],
            }),
          );
        }
      }
    }

    this.logger.debug("[LaravelCodeLensProvider.provide] frontend HTTP route lenses", {
      file: document.uri.fsPath,
      languageId: document.languageId,
      count: lenses.length,
    });

    return lenses;
  }
}
