import * as vscode from "vscode";
import {
  extractQuotedStringAtOffset,
  resolveEloquentRelationConstraintContext,
  resolveStringContext,
} from "../context/completionContext";
import { resolveFrontendResponseFieldContext } from "../context/frontendResponseContext";
import { resolvePhpTypedMemberReferenceContext } from "../context/phpDefinitionContext";
import type { LaravelIndex } from "../indexer";
import type { LaravelIndexKind } from "../indexer/types";
import type { Logger } from "../logging/logger";
import { resolveBoundImplementationDefinition } from "./boundDefinitionResolver";

const FRONTEND_RESPONSE_LANGUAGES = new Set(["javascript", "javascriptreact", "typescript", "typescriptreact", "vue", "svelte"]);

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

    if (FRONTEND_RESPONSE_LANGUAGES.has(document.languageId)) {
      const fieldContext = resolveFrontendResponseFieldContext(document.getText(), document.offsetAt(position));
      if (fieldContext.kind !== "response-field") {
        this.logger.debug("[LaravelDefinitionProvider.provide] no frontend response field context", {
          file: document.uri.fsPath,
          reason: fieldContext.reason,
        });
      } else {
        const item = index.frontendResponseField(fieldContext.request, fieldContext.fieldPath);
        if (!item) {
          this.logger.debug("[LaravelDefinitionProvider.provide] no frontend response field match", {
            file: document.uri.fsPath,
            requestKind: fieldContext.request.kind,
            requestValue: fieldContext.request.value,
            method: fieldContext.request.method,
            fieldPath: fieldContext.fieldPath,
          });
          return undefined;
        }

        this.logger.debug("[LaravelDefinitionProvider.provide] frontend response field match", {
          file: document.uri.fsPath,
          requestKind: fieldContext.request.kind,
          requestValue: fieldContext.request.value,
          method: fieldContext.request.method,
          fieldPath: fieldContext.fieldPath,
          targetFile: item.source.file,
          responseSourceKind: item.responseSourceKind,
          responseSourceClass: item.responseSourceClass,
        });

        return new vscode.Location(
          vscode.Uri.file(item.source.file),
          new vscode.Position(item.source.line, item.source.character),
        );
      }

      const inertiaPropReference = extractInertiaPropReferenceAtOffset(line, position.character);
      const inertiaPage = inertiaPropReference ? index.findInertiaPageForFile(document.uri.fsPath) : undefined;
      if (inertiaPropReference && inertiaPage?.key) {
        const item = index.findInertiaProp(inertiaPage.key, inertiaPropReference.fieldPath);
        if (!item) {
          this.logger.debug("[LaravelDefinitionProvider.provide] no inertia prop match", {
            file: document.uri.fsPath,
            page: inertiaPage.key,
            fieldPath: inertiaPropReference.fieldPath,
          });
          return undefined;
        }

        return new vscode.Location(
          vscode.Uri.file(item.source.file),
          new vscode.Position(item.source.line, item.source.character),
        );
      }

      return undefined;
    }
    if (document.languageId === "blade") {
      const bladeComponentPropReference = extractBladeComponentPropReferenceAtOffset(line, position.character);
      if (bladeComponentPropReference) {
        const item = index.findBladeComponentProp(bladeComponentPropReference.componentName, bladeComponentPropReference.attributeName);
        if (!item) {
          this.logger.debug("[LaravelDefinitionProvider.provide] no blade component prop match", bladeComponentPropReference);
          return undefined;
        }

        return new vscode.Location(
          vscode.Uri.file(item.source.file),
          new vscode.Position(item.source.line, item.source.character),
        );
      }

      const bladeSlotReference = extractBladeComponentSlotReferenceAtOffset(line, position.character);
      if (bladeSlotReference) {
        const item = index
          .all("blade-component-slot")
          .find((slot) => slot.key === bladeSlotReference.slotName);
        if (!item) {
          this.logger.debug("[LaravelDefinitionProvider.provide] no blade component slot match", bladeSlotReference);
          return undefined;
        }

        return new vscode.Location(
          vscode.Uri.file(item.source.file),
          new vscode.Position(item.source.line, item.source.character),
        );
      }

      const livewireDirectiveReference = extractLivewireDirectiveReferenceAtOffset(line, position.character);
      const livewireComponent = livewireDirectiveReference ? index.findLivewireComponentForFile(document.uri.fsPath) : undefined;
      if (livewireDirectiveReference && livewireComponent?.key) {
        const item =
          livewireDirectiveReference.kind === "property"
            ? index.findLivewireProperty(livewireComponent.key, livewireDirectiveReference.value)
            : index.findLivewireAction(livewireComponent.key, livewireDirectiveReference.value);
        if (!item) {
          this.logger.debug("[LaravelDefinitionProvider.provide] no livewire member match", {
            componentName: livewireComponent.key,
            ...livewireDirectiveReference,
          });
          return undefined;
        }

        return new vscode.Location(
          vscode.Uri.file(item.source.file),
          new vscode.Position(item.source.line, item.source.character),
        );
      }
    }

    if (document.languageId === "php") {
      const phpMemberContext = resolvePhpTypedMemberReferenceContext(document.getText(), document.offsetAt(position));
      if (phpMemberContext) {
        const item =
          index.findEloquentField(phpMemberContext.abstractClass, phpMemberContext.member)
          ?? index.findEloquentRelation(phpMemberContext.abstractClass, phpMemberContext.member);
        if (item) {
          this.logger.debug("[LaravelDefinitionProvider.provide] php eloquent member match", {
            file: document.uri.fsPath,
            receiver: phpMemberContext.receiver,
            abstractClass: phpMemberContext.abstractClass,
            member: phpMemberContext.member,
            targetFile: item.source.file,
          });

          return new vscode.Location(
            vscode.Uri.file(item.source.file),
            new vscode.Position(item.source.line, item.source.character),
          );
        }
      }
    }

    const boundSource = resolveBoundImplementationDefinition(index, this.logger, document.getText(), document.offsetAt(position));
    if (boundSource) {
      return new vscode.Location(
        vscode.Uri.file(boundSource.file),
        new vscode.Position(boundSource.line, boundSource.character),
      );
    }

    const factoryStateReference = extractFactoryStateReferenceAtOffset(line, position.character);
    if (factoryStateReference) {
      const item = index
        .eloquentFactoryStateCompletions(document.uri.fsPath, factoryStateReference.value, factoryStateReference.modelClass)
        .find((state) => state.key === factoryStateReference.value);
      if (!item) {
        this.logger.debug("[LaravelDefinitionProvider.provide] no factory state match", {
          key: factoryStateReference.value,
          modelClass: factoryStateReference.modelClass,
        });
        return undefined;
      }

      this.logger.debug("[LaravelDefinitionProvider.provide] factory state match", {
        key: factoryStateReference.value,
        file: item.source.file,
      });

      return new vscode.Location(
        vscode.Uri.file(item.source.file),
        new vscode.Position(item.source.line, item.source.character),
      );
    }

    const scopeReference = extractScopeReferenceAtOffset(line, position.character);
    if (scopeReference) {
      const item = index
        .eloquentScopeCompletions(document.uri.fsPath, scopeReference.value, scopeReference.modelClass)
        .find((scope) => scope.key === scopeReference.value);
      if (!item) {
        this.logger.debug("[LaravelDefinitionProvider.provide] no scope match", {
          key: scopeReference.value,
          modelClass: scopeReference.modelClass,
        });
        return undefined;
      }

      this.logger.debug("[LaravelDefinitionProvider.provide] scope match", {
        key: scopeReference.value,
        file: item.source.file,
      });

      return new vscode.Location(
        vscode.Uri.file(item.source.file),
        new vscode.Position(item.source.line, item.source.character),
      );
    }

    const filamentResourceReference = extractFilamentResourceReferenceAtOffset(line, position.character);
    if (filamentResourceReference) {
      const item = index.findFilamentResourceByReference(filamentResourceReference.value);
      if (!item) {
        this.logger.debug("[LaravelDefinitionProvider.provide] no filament resource match", {
          key: filamentResourceReference.value,
        });
        return undefined;
      }

      this.logger.debug("[LaravelDefinitionProvider.provide] filament resource match", {
        key: filamentResourceReference.value,
        file: item.source.file,
      });

      return new vscode.Location(
        vscode.Uri.file(item.source.file),
        new vscode.Position(item.source.line, item.source.character),
      );
    }

    const novaResourceReference = extractNovaResourceReferenceAtOffset(line, position.character);
    if (novaResourceReference) {
      const item = index.findNovaResourceByReference(novaResourceReference.value);
      if (!item) {
        this.logger.debug("[LaravelDefinitionProvider.provide] no nova resource match", {
          key: novaResourceReference.value,
        });
        return undefined;
      }

      this.logger.debug("[LaravelDefinitionProvider.provide] nova resource match", {
        key: novaResourceReference.value,
        file: item.source.file,
      });

      return new vscode.Location(
        vscode.Uri.file(item.source.file),
        new vscode.Position(item.source.line, item.source.character),
      );
    }

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
    const relationConstraintContext =
      kind === "eloquent-relation" && !stringContext?.modelClass
        ? resolveEloquentRelationConstraintContext(
            document.getText(new vscode.Range(new vscode.Position(0, 0), position)),
            line.slice(0, position.character),
          )
        : undefined;
    const routeAction = kind === "route-action" ? routeActionReferenceAtOffset(quoted.value, position.character - quoted.start) : undefined;
    const item =
      kind === "route-action"
        ? index.findRouteActionAt(document.uri.fsPath, document.offsetAt(position), routeAction?.method ?? quoted.value)
        : kind === "eloquent-field"
          ? index
              .eloquentFieldCompletions(document.uri.fsPath, quoted.value, stringContext?.modelClass)
              .find((field) => field.key === quoted.value)
          : kind === "eloquent-relation"
            ? index
                .eloquentRelationCompletions(
                  document.uri.fsPath,
                  relationSegment?.name ?? quoted.value,
                  stringContext?.modelClass ?? relationConstraintContext?.modelClass,
                  stringContext?.modelClass
                    ? (relationSegment?.path ?? [])
                    : [...(relationConstraintContext?.relationPath ?? []), ...(relationSegment?.path ?? [])],
                )
                .find((relation) => relation.key === (relationSegment?.name ?? quoted.value))
            : kind === "database-column"
              ? index.databaseColumnCompletions(quoted.value, stringContext?.table).find((column) => column.key === quoted.value)
              : kind === "route-middleware"
                ? index.find(kind, quoted.value.split(":")[0] ?? quoted.value)
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

function extractFilamentResourceReferenceAtOffset(line: string, offset: number): { value: string } | undefined {
  const wordRange = wordRangeAtOffset(line, offset);
  if (!wordRange) {
    return undefined;
  }

  const prefix = line.slice(0, wordRange.end);
  const call = /->(?:resources|resource)\(\s*(.*)$/.exec(prefix);
  const reference = call ? /\\?([A-Za-z_\\][A-Za-z0-9_\\]*)$/.exec(call[1] ?? "")?.[1] : undefined;
  if (!reference) {
    return undefined;
  }

  return { value: reference };
}

function extractNovaResourceReferenceAtOffset(line: string, offset: number): { value: string } | undefined {
  const wordRange = wordRangeAtOffset(line, offset);
  if (!wordRange) {
    return undefined;
  }

  const prefix = line.slice(0, wordRange.end);
  const call = /\bNova::resources?\(\s*(.*)$/.exec(prefix);
  const reference = call ? /\\?([A-Za-z_\\][A-Za-z0-9_\\]*)$/.exec(call[1] ?? "")?.[1] : undefined;
  if (!reference) {
    return undefined;
  }

  return { value: reference };
}

function routeActionReferenceAtOffset(value: string, offset: number): { controllerClass?: string; method: string } | undefined {
  const separator = value.lastIndexOf("@");
  if (separator < 0) {
    return undefined;
  }

  return {
    controllerClass: value.slice(0, separator),
    method: value.slice(separator + 1),
  };
}

function extractFactoryStateReferenceAtOffset(line: string, offset: number): { value: string; modelClass?: string } | undefined {
  const wordRange = wordRangeAtOffset(line, offset);
  if (!wordRange) {
    return undefined;
  }

  const prefix = line.slice(0, wordRange.end);
  const match =
    /\b([A-Za-z_\\][A-Za-z0-9_\\]*)::factory\([^)]*\)(?:->[A-Za-z_][A-Za-z0-9_]*\([^)]*\))*->([A-Za-z_][A-Za-z0-9_]*)$/.exec(
      prefix,
    );
  if (!match?.[2]) {
    return undefined;
  }

  return {
    value: match[2],
    modelClass: match[1],
  };
}

function extractScopeReferenceAtOffset(line: string, offset: number): { value: string; modelClass?: string } | undefined {
  const wordRange = wordRangeAtOffset(line, offset);
  if (!wordRange) {
    return undefined;
  }

  const prefix = line.slice(0, wordRange.end);
  const staticScopeMatch =
    /\b([A-Za-z_\\][A-Za-z0-9_\\]*)::(?:query\(\)(?:->[A-Za-z_][A-Za-z0-9_]*\([^)]*\))*->)?([A-Za-z_][A-Za-z0-9_]*)$/.exec(
      prefix,
    );
  if (staticScopeMatch?.[2]) {
    return {
      value: staticScopeMatch[2],
      modelClass: staticScopeMatch[1],
    };
  }

  const objectScopeMatch = /->([A-Za-z_][A-Za-z0-9_]*)$/.exec(prefix);
  if (objectScopeMatch?.[1]) {
    return {
      value: objectScopeMatch[1],
    };
  }

  return undefined;
}

function wordRangeAtOffset(line: string, offset: number): { start: number; end: number } | undefined {
  const boundedOffset = Math.max(0, Math.min(offset, line.length));
  let start = boundedOffset;
  let end = boundedOffset;

  while (start > 0 && /[A-Za-z0-9_]/.test(line[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < line.length && /[A-Za-z0-9_]/.test(line[end] ?? "")) {
    end += 1;
  }

  if (start === end) {
    return undefined;
  }

  return { start, end };
}

function wordRangeWithHyphenAtOffset(line: string, offset: number): { start: number; end: number } | undefined {
  const boundedOffset = Math.max(0, Math.min(offset, line.length));
  let start = boundedOffset;
  let end = boundedOffset;

  while (start > 0 && /[A-Za-z0-9_-]/.test(line[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < line.length && /[A-Za-z0-9_-]/.test(line[end] ?? "")) {
    end += 1;
  }

  if (start === end) {
    return undefined;
  }

  return { start, end };
}

function extractBladeComponentPropReferenceAtOffset(
  line: string,
  offset: number,
): { componentName: string; attributeName: string } | undefined {
  const wordRange = wordRangeWithHyphenAtOffset(line, offset);
  if (!wordRange) {
    return undefined;
  }

  const prefix = line.slice(0, wordRange.end);
  const match = /<x-([A-Za-z0-9_.:-]+)\b[^>]*\s:?\s*([A-Za-z_][A-Za-z0-9_-]*)$/.exec(prefix);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  return {
    componentName: match[1].replace(/-/g, "."),
    attributeName: match[2],
  };
}

function extractBladeComponentSlotReferenceAtOffset(line: string, offset: number): { slotName: string } | undefined {
  const wordRange = wordRangeWithHyphenAtOffset(line, offset);
  if (!wordRange) {
    return undefined;
  }

  const prefix = line.slice(0, wordRange.end);
  const match = /<x-slot:([A-Za-z0-9_-]+)$/.exec(prefix);
  if (!match?.[1]) {
    return undefined;
  }

  return { slotName: match[1] };
}

function extractLivewireDirectiveReferenceAtOffset(
  line: string,
  offset: number,
): { kind: "property" | "action"; value: string } | undefined {
  const quoted = extractQuotedStringAtOffset(line, offset);
  if (!quoted?.value) {
    return undefined;
  }

  const beforeQuote = line.slice(0, quoted.start);
  if (/wire:(?:model|key)(?:\.[A-Za-z0-9_.:-]+)?=\s*['"]$/.test(beforeQuote)) {
    return { kind: "property", value: quoted.value.split(".")[0] ?? quoted.value };
  }
  if (/wire:(?:click|submit|change|keydown|keyup)(?:\.[A-Za-z0-9_.:-]+)?=\s*['"]$/.test(beforeQuote)) {
    return { kind: "action", value: quoted.value.split("(")[0] ?? quoted.value };
  }

  return undefined;
}

function extractInertiaPropReferenceAtOffset(
  line: string,
  offset: number,
): { fieldPath: string[] } | undefined {
  const boundedOffset = Math.max(0, Math.min(offset, line.length));
  let start = boundedOffset;
  let end = boundedOffset;

  while (start > 0 && /[A-Za-z0-9_$.]/.test(line[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < line.length && /[A-Za-z0-9_$.]/.test(line[end] ?? "")) {
    end += 1;
  }

  const value = line.slice(start, end);
  const match = /\$?page\.props\.([A-Za-z0-9_.]+)$/.exec(value);
  if (!match?.[1]) {
    return undefined;
  }

  return {
    fieldPath: match[1].split(".").filter(Boolean),
  };
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
  if (/\bStorage::(?:disk|fake|persistentFake)\(\s*['"]?$/.test(linePrefix)) {
    return "filesystem-disk";
  }
  if (/->(?:store|storePublicly)\(\s*[^,]+,\s*['"]?$/.test(linePrefix)) {
    return "filesystem-disk";
  }
  if (/->(?:storeAs|storePubliclyAs)\(\s*[^,]+,\s*[^,]+,\s*['"]?$/.test(linePrefix)) {
    return "filesystem-disk";
  }
  if (/['"](?:default|cloud)['"]\s*=>\s*(?:env\([^,]+,\s*)?['"]?$/.test(linePrefix)) {
    return "filesystem-disk";
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
  if (/\bArtisan::(?:call|queue)\(\s*['"]?$/.test(linePrefix) || /\bartisan\(\s*['"]?$/.test(linePrefix)) {
    return "artisan-command";
  }
  if (/(?:\$this|\$[A-Za-z_][A-Za-z0-9_]*)->(?:command|call|callSilent|callQueued)\(\s*['"]?$/.test(linePrefix)) {
    return "artisan-command";
  }
  if (/\bLivewire::mount\(\s*['"]?$/.test(linePrefix) || /@livewire\(\s*['"]?$/.test(linePrefix)) {
    return "livewire-component";
  }
  if (/<livewire:/.test(linePrefix)) {
    return "livewire-component";
  }
  if (/\b(?:Inertia::render|inertia)\(\s*['"]?$/.test(linePrefix) || /\bRoute::inertia\(\s*['"][^'"]*['"]\s*,\s*['"]?$/.test(linePrefix)) {
    return "inertia-page";
  }
  if (/(?:Route::|->|\$this->)middleware\(\s*(?:\[[^\]]*)?['"]?$/.test(linePrefix)) {
    return "route-middleware";
  }
  if (/Route::(?:get|post|put|patch|delete|options|any|match)\s*\(\s*(?:\[[^\]]+\]\s*,\s*)?['"][^'"]*['"]\s*,\s*['"]?$/.test(linePrefix)) {
    return "route-action";
  }

  return undefined;
}
