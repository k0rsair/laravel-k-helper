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

    const stringContext =
      resolveStringContext(line.slice(0, Math.min(position.character, quoted.end)), document.languageId) ??
      resolveStringContext(line.slice(0, quoted.start), document.languageId);
    const kind = stringContext?.kind ?? inferKindFromLine(line.slice(0, quoted.start), document.languageId);
    if (!kind) {
      return undefined;
    }

    const relationSegment = kind === "eloquent-relation" ? relationSegmentAtOffset(quoted.value, position.character - quoted.start) : undefined;
    const item =
      kind === "route-action"
        ? index.findRouteActionAt(document.uri.fsPath, document.offsetAt(position), quoted.value)
        : kind === "eloquent-field"
          ? index
              .eloquentFieldCompletions(document.uri.fsPath, quoted.value, stringContext?.modelClass)
              .find((field) => field.key === quoted.value)
          : kind === "eloquent-relation"
            ? index
                .eloquentRelationCompletions(
                  document.uri.fsPath,
                  relationSegment?.name ?? quoted.value,
                  stringContext?.modelClass,
                  relationSegment?.path ?? [],
                )
                .find((relation) => relation.key === (relationSegment?.name ?? quoted.value))
            : kind === "database-column"
              ? index.databaseColumnCompletions(quoted.value, stringContext?.table).find((column) => column.key === quoted.value)
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

function relationSegmentAtOffset(value: string, offset: number): { name: string; path: string[] } {
  const boundedOffset = Math.max(0, Math.min(offset, value.length));
  const parts = value.split(".");
  let cursor = 0;
  const path: string[] = [];

  for (const part of parts) {
    const start = cursor;
    const end = start + part.length;
    if (boundedOffset <= end) {
      return { name: part, path };
    }
    if (part.length > 0) {
      path.push(part);
    }
    cursor = end + 1;
  }

  return {
    name: parts[parts.length - 1] ?? value,
    path: parts.slice(0, -1).filter((part) => part.length > 0),
  };
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
  if (/\b(?:Schema::(?:create|table)|DB::table)\(\s*['"]?$/.test(linePrefix)) {
    return "database-table";
  }
  if (/\b[A-Za-z_\\][A-Za-z0-9_\\]*::(?:query\(\)(?:->[A-Za-z_][A-Za-z0-9_]*\([^)]*\))*->|)(?:where|orWhere|whereDate|whereTime|whereNull|whereNotNull|whereIn|whereNotIn|orderBy|latest|oldest|select|addSelect|pluck|value|groupBy|having|orHaving)\(\s*(?:\[[^\]]*)?['"]?$/.test(linePrefix)) {
    return "eloquent-field";
  }
  if (/\b[A-Za-z_\\][A-Za-z0-9_\\]*::(?:query\(\)->)?with\(\s*(?:\[[^\]]*)?['"]?$/.test(linePrefix) || /->with\(\s*(?:\[[^\]]*)?['"]?$/.test(linePrefix)) {
    return "eloquent-relation";
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
