import * as vscode from "vscode";
import type { LaravelIndex } from "../indexer";
import type { Logger } from "../logging/logger";

export class LaravelReferenceProvider implements vscode.ReferenceProvider {
  public constructor(
    private readonly getIndex: () => LaravelIndex | undefined,
    private readonly logger: Logger,
  ) {}

  public provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Location[]> {
    const index = this.getIndex();
    if (!index) {
      return [];
    }

    const method = index.controllerMethodAt(document.uri.fsPath, position.line);
    if (!method) {
      return [];
    }

    const references = index.routeReferencesForControllerMethod(method.key)
      .map((item) => item.routeSource)
      .filter((source): source is NonNullable<typeof source> => Boolean(source))
      .map((source) => new vscode.Location(vscode.Uri.file(source.file), new vscode.Position(source.line, source.character)));

    this.logger.debug("[LaravelReferenceProvider.provide] controller method references", {
      method: method.key,
      count: references.length,
    });

    return references;
  }
}
