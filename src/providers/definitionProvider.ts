import * as vscode from "vscode";
import { extractQuotedStringAtOffset, resolveStringContext } from "../context/completionContext";
import type { LaravelIndex } from "../indexer";
import type { LaravelIndexKind } from "../indexer/types";
import type { Logger } from "../logging/logger";

export class LaravelDefinitionProvider implements vscode.DefinitionProvider {
  public constructor(
    private readonly getIndex: () => LaravelIndex | undefined,
    private readonly logger: Logger,
  ) {}

  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Definition> {
    const index = this.getIndex();
    if (!index) {
      return undefined;
    }

    const line = document.lineAt(position.line).text;
    const quoted = extractQuotedStringAtOffset(line, position.character);
    if (!quoted) {
      return undefined;
    }

    const kind = inferKindFromLine(line.slice(0, quoted.start), document.languageId);
    if (!kind) {
      return undefined;
    }

    const item =
      kind === "route-action"
        ? index.findRouteActionAt(document.uri.fsPath, document.offsetAt(position), quoted.value)
        : index.find(kind, quoted.value);
    if (!item) {
      this.logger.debug("[LaravelDefinitionProvider.provide] no match", { kind, key: quoted.value });
      return undefined;
    }

    this.logger.debug("[LaravelDefinitionProvider.provide] match", {
      kind,
      key: quoted.value,
      file: item.source.file,
    });

    return new vscode.Location(
      vscode.Uri.file(item.source.file),
      new vscode.Position(item.source.line, item.source.character),
    );
  }
}

function inferKindFromLine(linePrefix: string, languageId: string): LaravelIndexKind | undefined {
  const context = resolveStringContext(linePrefix, languageId);
  if (context) {
    return context.kind;
  }

  if (/\broute\(\s*['"]?$/.test(linePrefix)) {
    return "route";
  }
  if (/\bview\(\s*['"]?$/.test(linePrefix) || /@(include|extends|component)\(\s*['"]?$/.test(linePrefix)) {
    return "view";
  }
  if (/\bconfig\(\s*['"]?$/.test(linePrefix)) {
    return "config";
  }
  if (/\b(?:__|trans)\(\s*['"]?$/.test(linePrefix) || /@lang\(\s*['"]?$/.test(linePrefix)) {
    return "translation";
  }
  if (/\benv\(\s*['"]?$/.test(linePrefix)) {
    return "env";
  }
  if (/\b(?:old|request)\(\s*['"]?$/.test(linePrefix)) {
    return "request-field";
  }
  if (/\$request->(?:input|get|string|boolean|integer|float|date|validated)\(\s*['"]?$/.test(linePrefix)) {
    return "request-field";
  }
  if (/Route::(?:get|post|put|patch|delete|options|any|match)\s*\(\s*(?:\[[^\]]+\]\s*,\s*)?['"][^'"]*['"]\s*,\s*['"]?$/.test(linePrefix)) {
    return "route-action";
  }

  return undefined;
}
