import * as vscode from "vscode";
import type { LaravelIndex } from "../indexer";
import type { Logger } from "../logging/logger";

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

    const lenses = index.controllerMethodsInFile(document.uri.fsPath).flatMap((method) => {
      const references = index.routeReferencesForControllerMethod(method.key);
      if (references.length === 0) {
        return [];
      }

      const title = references.length === 1 ? "1 route" : `${references.length} routes`;
      return [
        new vscode.CodeLens(new vscode.Range(method.source.line, 0, method.source.line, 0), {
          title,
          command: "laravelAware.openRouteReference",
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
}
