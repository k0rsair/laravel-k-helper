import * as vscode from "vscode";
import type { LaravelIndex } from "../indexer";
import type { Logger } from "../logging/logger";
import { resolveBoundImplementationLinks } from "./boundDefinitionLinks";

export class LaravelDocumentLinkProvider implements vscode.DocumentLinkProvider {
  public constructor(
    private readonly getIndex: () => LaravelIndex | undefined,
    private readonly logger: Logger,
  ) {}

  public provideDocumentLinks(document: vscode.TextDocument): vscode.ProviderResult<vscode.DocumentLink[]> {
    const index = this.getIndex();
    if (!index) {
      return [];
    }

    const text = document.getText();
    const links = resolveBoundImplementationLinks(index, this.logger, text).map((link) => {
      const start = document.positionAt(link.start);
      const end = document.positionAt(link.end);
      return new vscode.DocumentLink(
        new vscode.Range(start, end),
        vscode.Uri.file(link.source.file).with({ fragment: `L${link.source.line + 1},${link.source.character + 1}` }),
      );
    });

    this.logger.debug("[LaravelDocumentLinkProvider.provide] bound implementation links", {
      file: document.uri.fsPath,
      count: links.length,
    });

    return links;
  }
}
