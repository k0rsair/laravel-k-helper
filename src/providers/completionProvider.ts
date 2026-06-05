import * as vscode from "vscode";
import {
  resolveBladeComponentAttributeContext,
  resolveBladeComponentPrefix,
  resolveBladeComponentSlotPrefix,
  resolveEloquentCastTypeContext,
  resolveEloquentModelAttributeContext,
  resolveEloquentRelationConstraintContext,
  resolveIdeJsonStringContext,
  resolveLivewireDirectiveContext,
  resolveLivewireComponentPrefix,
  resolveStringContext,
} from "../context/completionContext";
import { resolveFrontendResponseCompletionContext } from "../context/frontendResponseContext";
import { resolvePhpTypedMemberReferenceContext } from "../context/phpDefinitionContext";
import type { LaravelIndex } from "../indexer";
import type { Logger } from "../logging/logger";

const FRONTEND_RESPONSE_LANGUAGES = new Set(["javascript", "javascriptreact", "typescript", "typescriptreact", "vue", "svelte"]);

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

    if (FRONTEND_RESPONSE_LANGUAGES.has(document.languageId)) {
      const responseContext = resolveFrontendResponseCompletionContext(document.getText(), document.offsetAt(position));
      if (responseContext.kind === "response") {
        const responseItems = index.frontendResponseCompletions(responseContext.request, responseContext.prefix, responseContext.path);
        const items = responseItems.map((item) => {
          const completion = new vscode.CompletionItem(item.label, vscode.CompletionItemKind.Field);
          completion.insertText = item.key;
          completion.detail = item.detail ?? "Laravel response field";
          completion.range = new vscode.Range(
            document.positionAt(responseContext.rangeStart),
            document.positionAt(responseContext.rangeEnd),
          );
          completion.sortText = responseCompletionSortText(item);
          return completion;
        });

        this.logger.debug("[LaravelCompletionProvider.provide] frontend response fields", {
          file: document.uri.fsPath,
          requestKind: responseContext.request.kind,
          requestValue: responseContext.request.value,
          method: responseContext.request.method,
          prefix: responseContext.prefix,
          path: responseContext.path,
          count: items.length,
        });
        return items;
      }

      this.logger.debug("[LaravelCompletionProvider.provide] no frontend response context", {
        file: document.uri.fsPath,
        reason: responseContext.reason,
      });
    }

    if (document.languageId === "blade") {
      const bladeAttributeContext = resolveBladeComponentAttributeContext(linePrefix);
      if (bladeAttributeContext) {
        const items = index
          .bladeComponentPropCompletions(bladeAttributeContext.componentName, bladeAttributeContext.prefix)
          .map((item) => {
            const completion = new vscode.CompletionItem(item.key, vscode.CompletionItemKind.Property);
            completion.detail = item.detail ?? "Blade component prop";
            completion.range = new vscode.Range(position.line, bladeAttributeContext.start, position.line, position.character);
            return completion;
          });

        this.logger.debug("[LaravelCompletionProvider.provide] blade component props", {
          componentName: bladeAttributeContext.componentName,
          prefix: bladeAttributeContext.prefix,
          count: items.length,
        });
        return items;
      }

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

      const slotContext = resolveBladeComponentSlotPrefix(linePrefix);
      if (slotContext) {
        const items = index
          .all("blade-component-slot")
          .filter((item) => item.key.startsWith(slotContext.prefix))
          .map((item) => {
            const completion = new vscode.CompletionItem(item.key, vscode.CompletionItemKind.Field);
            completion.detail = item.detail ?? "Blade component slot";
            completion.range = new vscode.Range(position.line, slotContext.start, position.line, position.character);
            return completion;
          });

        this.logger.debug("[LaravelCompletionProvider.provide] blade component slots", {
          prefix: slotContext.prefix,
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

      const livewireDirectiveContext = resolveLivewireDirectiveContext(linePrefix);
      const livewireComponent = livewireDirectiveContext ? index.findLivewireComponentForFile(document.uri.fsPath) : undefined;
      if (livewireDirectiveContext && livewireComponent?.key) {
        const indexedItems =
          livewireDirectiveContext.kind === "property"
            ? index.livewirePropertyCompletions(livewireComponent.key, livewireDirectiveContext.prefix)
            : index.livewireActionCompletions(livewireComponent.key, livewireDirectiveContext.prefix);
        const items = indexedItems.map((item) => {
          const completion = new vscode.CompletionItem(item.key, toCompletionKind(item.kind));
          completion.detail = item.detail ?? `Livewire ${livewireDirectiveContext.kind}`;
          completion.range = new vscode.Range(
            position.line,
            livewireDirectiveContext.rangeStart,
            position.line,
            livewireDirectiveContext.rangeEnd,
          );
          return completion;
        });

        this.logger.debug("[LaravelCompletionProvider.provide] livewire directive members", {
          componentName: livewireComponent.key,
          kind: livewireDirectiveContext.kind,
          prefix: livewireDirectiveContext.prefix,
          count: items.length,
        });
        return items;
      }
    }

    if (document.languageId === "php") {
      const phpMemberContext = resolvePhpTypedMemberReferenceContext(document.getText(), document.offsetAt(position));
      if (phpMemberContext) {
        const items = index.eloquentMemberCompletions(
          document.uri.fsPath,
          phpMemberContext.prefix,
          phpMemberContext.abstractClass,
        ).map((item) => {
          const completion = new vscode.CompletionItem(item.key, toCompletionKind(item.kind));
          completion.detail = item.detail ?? (item.kind === "eloquent-relation" ? "Eloquent relation" : "Eloquent field");
          completion.range = new vscode.Range(
            document.positionAt(phpMemberContext.rangeStart),
            document.positionAt(phpMemberContext.rangeEnd),
          );
          completion.sortText = `${item.kind === "eloquent-field" ? "0" : "1"}-${item.key}`;
          return completion;
        });

        if (items.length > 0) {
          this.logger.debug("[LaravelCompletionProvider.provide] php eloquent members", {
            file: document.uri.fsPath,
            receiver: phpMemberContext.receiver,
            abstractClass: phpMemberContext.abstractClass,
            prefix: phpMemberContext.prefix,
            count: items.length,
          });
          return items;
        }
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
                    : stringContext.kind === "filament-field"
                      ? index.filamentFieldCompletions(stringContext.prefix)
                      : stringContext.kind === "filament-action"
                        ? index.filamentActionCompletions(stringContext.prefix)
                        : stringContext.kind === "inertia-prop"
                          ? index.inertiaPropCompletions(
                              index.findInertiaPageForFile(document.uri.fsPath)?.key ?? "",
                              stringContext.prefix,
                              stringContext.relationPath,
                            )
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

function responseCompletionSortText(item: { key: string; responseFieldPath?: string[] }): string {
  const depth = item.responseFieldPath?.length ?? item.key.split(".").length;
  return `${String(depth).padStart(2, "0")}:${item.key}`;
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
    case "blade-component-prop":
      return vscode.CompletionItemKind.Property;
    case "blade-component-slot":
      return vscode.CompletionItemKind.Field;
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
    case "artisan-command":
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
    case "livewire-property":
      return vscode.CompletionItemKind.Field;
    case "livewire-action":
      return vscode.CompletionItemKind.Method;
    case "livewire-event":
      return vscode.CompletionItemKind.Event;
    case "inertia-page":
      return vscode.CompletionItemKind.File;
    case "inertia-prop":
      return vscode.CompletionItemKind.Field;
    case "filament-resource":
    case "filament-page":
    case "nova-resource":
      return vscode.CompletionItemKind.Class;
    case "filament-field":
      return vscode.CompletionItemKind.Field;
    case "filament-action":
      return vscode.CompletionItemKind.Method;
    default:
      return vscode.CompletionItemKind.Text;
  }
}
