import * as vscode from "vscode";
import {
  resolveBladeComponentPrefix,
  resolveEloquentCastTypeContext,
  resolveEloquentModelAttributeContext,
  resolveEloquentRelationConstraintContext,
  resolveIdeJsonStringContext,
  resolveLivewireComponentPrefix,
  resolveStringContext,
} from "../context/completionContext";
import type { LaravelIndex } from "../indexer";
import type { Logger } from "../logging/logger";

export class LaravelCompletionProvider implements vscode.CompletionItemProvider {
  public constructor(
    private readonly getIndex: () => LaravelIndex | undefined,
    private readonly logger: Logger,
  ) {}

  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const index = this.getIndex();
    if (!index) {
      return [];
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
    const documentPrefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    if (document.languageId === "blade") {
      const componentContext = resolveBladeComponentPrefix(linePrefix);
      if (componentContext) {
        const items = index
          .all("blade-component")
          .filter((item) => item.key.startsWith(componentContext.prefix))
          .map((item) => {
        const completion = new vscode.CompletionItem(item.key.replace(/\./g, "-"), vscode.CompletionItemKind.Class);
        completion.detail = item.detail ?? "Laravel Blade component";
        completion.range = new vscode.Range(position.line, componentContext.start, position.line, position.character);
        return completion;
      });
        this.logger.debug("[LaravelCompletionProvider.provide] blade components", {
          prefix: componentContext.prefix,
          count: items.length,
        });
        return items;
      }

      const livewireContext = resolveLivewireComponentPrefix(linePrefix);
      if (livewireContext) {
        const items = index
          .all("livewire-component")
          .filter((item) => item.key.startsWith(livewireContext.prefix))
          .map((item) => {
            const completion = new vscode.CompletionItem(item.key, vscode.CompletionItemKind.Method);
            completion.detail = item.detail ?? "Livewire component";
            completion.range = new vscode.Range(position.line, livewireContext.start, position.line, position.character);
            return completion;
          });
        this.logger.debug("[LaravelCompletionProvider.provide] livewire tags", {
          prefix: livewireContext.prefix,
          count: items.length,
        });
        return items;
      }
    }

    const stringContext =
      document.languageId === "php"
        ? resolveEloquentCastTypeContext(documentPrefix, linePrefix) ??
          resolveEloquentModelAttributeContext(documentPrefix, linePrefix) ??
          resolveStringContext(linePrefix, document.languageId)
        : resolveStringContext(linePrefix, document.languageId);
    if (!stringContext) {
      const ideJsonContext = resolveIdeJsonStringContext(linePrefix);
      const rule = ideJsonContext
        ? index.ideJsonRuleFor(ideJsonContext.target, ideJsonContext.name, ideJsonContext.parameter)
        : undefined;
      if (!rule || !ideJsonContext) {
        return [];
      }

      const items = index.ideJsonCompletions(rule, ideJsonContext.prefix).map((item) => {
        const completion = new vscode.CompletionItem(item.key, vscode.CompletionItemKind.Value);
        completion.detail = item.detail ?? `ide.json ${rule.kind}`;
        completion.range = new vscode.Range(
          position.line,
          position.character - ideJsonContext.prefix.length,
          position.line,
          position.character,
        );
        completion.sortText = item.key;
        return completion;
      });

      this.logger.debug("[LaravelCompletionProvider.provide] ide.json context", {
        languageId: document.languageId,
        target: ideJsonContext.target,
        name: ideJsonContext.name,
        parameter: ideJsonContext.parameter,
        kind: rule.kind,
        prefix: ideJsonContext.prefix,
        count: items.length,
      });
      return items;
    }

    const relationConstraintContext =
      stringContext.kind === "eloquent-relation" && !stringContext.modelClass
        ? resolveEloquentRelationConstraintContext(
            document.getText(new vscode.Range(new vscode.Position(0, 0), position)),
            linePrefix,
          )
        : undefined;

    const indexedItems =
      stringContext.kind === "route-action"
        ? index.routeActionCompletions(document.uri.fsPath, document.offsetAt(position), stringContext.prefix, stringContext.controllerClass)
        : stringContext.kind === "eloquent-field"
          ? stringContext.castAttribute
            ? index.eloquentCastTypeCompletions(document.uri.fsPath, stringContext.prefix, stringContext.castAttribute, stringContext.modelClass)
            : index.eloquentFieldCompletions(document.uri.fsPath, stringContext.prefix, stringContext.modelClass)
          : stringContext.kind === "eloquent-relation"
            ? index.eloquentRelationCompletions(
                document.uri.fsPath,
                stringContext.prefix,
                stringContext.modelClass ?? relationConstraintContext?.modelClass,
                stringContext.modelClass
                  ? stringContext.relationPath
                  : [...(relationConstraintContext?.relationPath ?? []), ...(stringContext.relationPath ?? [])],
              )
            : stringContext.kind === "database-column"
              ? index.databaseColumnCompletions(stringContext.prefix, stringContext.table)
              : stringContext.kind === "eloquent-scope"
                ? index.eloquentScopeCompletions(document.uri.fsPath, stringContext.prefix, stringContext.modelClass)
                : stringContext.kind === "eloquent-factory-state"
                  ? index.eloquentFactoryStateCompletions(document.uri.fsPath, stringContext.prefix, stringContext.modelClass)
                  : stringContext.kind === "filament-resource"
                    ? index.filamentResourceCompletions(stringContext.prefix)
                    : stringContext.kind === "nova-resource"
                      ? index.novaResourceCompletions(stringContext.prefix)
          : index.all(stringContext.kind).filter((item) => item.key.startsWith(stringContext.prefix));

    const items = indexedItems
      .map((item) => {
        const completion = new vscode.CompletionItem(
          item.label,
          stringContext.castAttribute ? vscode.CompletionItemKind.Value : toCompletionKind(stringContext.kind),
        );
        completion.insertText =
          stringContext.kind === "filament-resource" || stringContext.kind === "nova-resource" ? `\\${item.key}::class` : item.key;
        completion.detail = item.detail ?? `Laravel ${stringContext.kind}`;
        completion.range = new vscode.Range(position.line, stringContext.rangeStart, position.line, stringContext.rangeEnd);
        completion.sortText = item.key;
        return completion;
      });

    this.logger.debug("[LaravelCompletionProvider.provide] string context", {
      languageId: document.languageId,
      kind: stringContext.kind,
      prefix: stringContext.prefix,
      count: items.length,
    });

    return items;
  }
}

function toCompletionKind(kind: string): vscode.CompletionItemKind {
  switch (kind) {
    case "route":
      return vscode.CompletionItemKind.Reference;
    case "view":
      return vscode.CompletionItemKind.File;
    case "config":
      return vscode.CompletionItemKind.Property;
    case "translation":
      return vscode.CompletionItemKind.Value;
    case "env":
      return vscode.CompletionItemKind.Variable;
    case "blade-component":
      return vscode.CompletionItemKind.Class;
    case "validation-rule":
      return vscode.CompletionItemKind.Keyword;
    case "request-field":
      return vscode.CompletionItemKind.Field;
    case "route-middleware":
      return vscode.CompletionItemKind.Value;
    case "controller-method":
      return vscode.CompletionItemKind.Method;
    case "route-action":
      return vscode.CompletionItemKind.Method;
    case "filesystem-disk":
      return vscode.CompletionItemKind.Value;
    case "eloquent-model":
      return vscode.CompletionItemKind.Class;
    case "database-table":
      return vscode.CompletionItemKind.Struct;
    case "database-column":
    case "eloquent-field":
      return vscode.CompletionItemKind.Field;
    case "eloquent-relation":
      return vscode.CompletionItemKind.Method;
    case "eloquent-scope":
    case "eloquent-factory-state":
    case "livewire-component":
      return vscode.CompletionItemKind.Method;
    case "inertia-page":
      return vscode.CompletionItemKind.File;
    case "filament-resource":
    case "nova-resource":
      return vscode.CompletionItemKind.Class;
    default:
      return vscode.CompletionItemKind.Text;
  }
}
