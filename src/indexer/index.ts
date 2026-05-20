import type { Logger } from "../logging/logger";
import type {
  IdeJsonCompletionKind,
  IdeJsonCompletionRule,
  IndexStats,
  IndexedItem,
  LaravelIndexKind,
  LaravelIndexSnapshot,
  RouteControllerScope,
} from "./types";
import { scanIdeJsonRules } from "./ideJson";
import {
  scanBladeComponents,
  scanConfig,
  scanControllerMethods,
  scanDatabaseSchema,
  scanEnvKeys,
  scanEloquentModels,
  scanFilesystemDisks,
  scanRequestFields,
  scanRouteActions,
  scanRouteControllerScopes,
  scanRoutes,
  scanTranslations,
  scanValidationRules,
  scanViews,
} from "./scanners";

export class LaravelIndex {
  private snapshot: LaravelIndexSnapshot | undefined;

  public constructor(
    private readonly projectRoot: string,
    private readonly logger: Logger,
  ) {}

  public async reindex(): Promise<LaravelIndexSnapshot> {
    const startedAt = Date.now();
    this.logger.info("[LaravelIndex.reindex] started", { projectRoot: this.projectRoot });

    const [
      routes,
      views,
      config,
      translations,
      env,
      bladeComponents,
      validationRules,
      requestFields,
      controllerMethods,
      filesystemDisks,
      ideJsonRules,
      databaseSchema,
    ] = await Promise.all([
      scanRoutes(this.projectRoot, this.logger),
      scanViews(this.projectRoot, this.logger),
      scanConfig(this.projectRoot, this.logger),
      scanTranslations(this.projectRoot, this.logger),
      scanEnvKeys(this.projectRoot, this.logger),
      scanBladeComponents(this.projectRoot, this.logger),
      scanValidationRules(this.projectRoot, this.logger),
      scanRequestFields(this.projectRoot, this.logger),
      scanControllerMethods(this.projectRoot, this.logger),
      scanFilesystemDisks(this.projectRoot, this.logger),
      scanIdeJsonRules(this.projectRoot, this.logger),
      scanDatabaseSchema(this.projectRoot, this.logger),
    ]);
    const eloquentIndex = await scanEloquentModels(this.projectRoot, this.logger, databaseSchema.columns);
    const routeControllerScopes = await scanRouteControllerScopes(this.projectRoot, this.logger);
    const routeActions = await scanRouteActions(this.projectRoot, this.logger, controllerMethods, routeControllerScopes);

    this.snapshot = {
      projectRoot: this.projectRoot,
      indexedAt: Date.now(),
      routes,
      views,
      config,
      translations,
      env,
      bladeComponents,
      validationRules,
      requestFields,
      controllerMethods,
      routeActions,
      routeControllerScopes,
      filesystemDisks,
      eloquentModels: eloquentIndex.models,
      databaseTables: databaseSchema.tables,
      databaseColumns: databaseSchema.columns,
      eloquentFields: eloquentIndex.fields,
      eloquentRelations: eloquentIndex.relations,
      ideJsonRules,
    };

    this.logger.info("[LaravelIndex.reindex] completed", {
      durationMs: Date.now() - startedAt,
      stats: this.stats(),
    });

    return this.snapshot;
  }

  public current(): LaravelIndexSnapshot | undefined {
    return this.snapshot;
  }

  public stats(): IndexStats {
    return {
      routes: this.snapshot?.routes.length ?? 0,
      views: this.snapshot?.views.length ?? 0,
      config: this.snapshot?.config.length ?? 0,
      translations: this.snapshot?.translations.length ?? 0,
      env: this.snapshot?.env.length ?? 0,
      bladeComponents: this.snapshot?.bladeComponents.length ?? 0,
      validationRules: this.snapshot?.validationRules.length ?? 0,
      requestFields: this.snapshot?.requestFields.length ?? 0,
      controllerMethods: this.snapshot?.controllerMethods.length ?? 0,
      routeActions: this.snapshot?.routeActions.length ?? 0,
      filesystemDisks: this.snapshot?.filesystemDisks.length ?? 0,
      eloquentModels: this.snapshot?.eloquentModels.length ?? 0,
      databaseTables: this.snapshot?.databaseTables.length ?? 0,
      databaseColumns: this.snapshot?.databaseColumns.length ?? 0,
      eloquentFields: this.snapshot?.eloquentFields.length ?? 0,
      eloquentRelations: this.snapshot?.eloquentRelations.length ?? 0,
    };
  }

  public all(kind: LaravelIndexKind): IndexedItem[] {
    const snapshot = this.snapshot;
    if (!snapshot) {
      return [];
    }

    switch (kind) {
      case "route":
        return snapshot.routes;
      case "view":
        return snapshot.views;
      case "config":
        return snapshot.config;
      case "translation":
        return snapshot.translations;
      case "env":
        return snapshot.env;
      case "blade-component":
        return snapshot.bladeComponents;
      case "validation-rule":
        return snapshot.validationRules;
      case "request-field":
        return snapshot.requestFields;
      case "controller-method":
        return snapshot.controllerMethods;
      case "route-action":
        return snapshot.routeActions;
      case "filesystem-disk":
        return snapshot.filesystemDisks;
      case "eloquent-model":
        return snapshot.eloquentModels;
      case "database-table":
        return snapshot.databaseTables;
      case "database-column":
        return snapshot.databaseColumns;
      case "eloquent-field":
        return snapshot.eloquentFields;
      case "eloquent-relation":
        return snapshot.eloquentRelations;
    }
  }

  public find(kind: LaravelIndexKind, key: string): IndexedItem | undefined {
    return this.all(kind).find((item) => item.key === key);
  }

  public routeActionCompletions(file: string, offset: number, prefix: string): IndexedItem[] {
    const scope = this.findNearestRouteControllerScope(file, offset);
    if (!scope) {
      return this.all("route-action").filter((item) => item.key.startsWith(prefix));
    }

    return this.all("controller-method")
      .filter((item) => item.controllerClass === scope.controllerClass && (item.method ?? item.key).startsWith(prefix))
      .map((item) => ({
        ...item,
        key: item.method ?? item.key.split("::").pop() ?? item.key,
        label: item.method ?? item.label,
        kind: "route-action",
        detail: item.key,
      }));
  }

  public eloquentFieldCompletions(file: string, prefix: string, modelReference?: string): IndexedItem[] {
    const model = modelReference ? this.findEloquentModelByReference(modelReference) : this.findEloquentModelForFile(file);
    const fields = model ? this.all("eloquent-field").filter((item) => item.modelClass === model.modelClass) : this.all("eloquent-field");
    return fields.filter((item) => item.key.startsWith(prefix));
  }

  public eloquentRelationCompletions(
    file: string,
    prefix: string,
    modelReference?: string,
    relationPath: string[] = [],
  ): IndexedItem[] {
    const model = this.findRelationPathModel(file, modelReference, relationPath);
    if (!model && relationPath.length > 0) {
      return [];
    }
    const relations = model
      ? this.all("eloquent-relation").filter((item) => item.modelClass === model.modelClass)
      : this.all("eloquent-relation");
    return relations.filter((item) => item.key.startsWith(prefix));
  }

  public databaseColumnCompletions(prefix: string, table?: string): IndexedItem[] {
    const columns = table ? this.all("database-column").filter((item) => item.table === table) : this.all("database-column");
    return columns.filter((item) => item.key.startsWith(prefix));
  }

  public ideJsonCompletions(rule: IdeJsonCompletionRule, prefix: string): IndexedItem[] {
    const items = this.itemsForIdeJsonKind(rule.kind, rule.values);
    return items.filter((item) => item.key.startsWith(prefix));
  }

  public ideJsonRuleFor(target: IdeJsonCompletionRule["target"], name: string, parameter: number): IdeJsonCompletionRule | undefined {
    return this.snapshot?.ideJsonRules.find((rule) => {
      if (rule.target !== target || rule.parameter !== parameter) {
        return false;
      }
      if (rule.name === name || rule.name === "*") {
        return true;
      }
      return target === "method" && name.endsWith(`::${rule.name}`);
    });
  }

  public findRouteActionAt(file: string, offset: number, method: string): IndexedItem | undefined {
    const actions = this.all("route-action").filter((item) => item.key === method && item.routeSource?.file === file);
    return actions.sort((a, b) => {
      const aDistance = Math.abs((a.routeSource?.offset ?? 0) - offset);
      const bDistance = Math.abs((b.routeSource?.offset ?? 0) - offset);
      return aDistance - bDistance;
    })[0];
  }

  public controllerMethodAt(file: string, line: number): IndexedItem | undefined {
    return this.all("controller-method").find((item) => item.source.file === file && item.source.line === line);
  }

  public controllerMethodsInFile(file: string): IndexedItem[] {
    return this.all("controller-method").filter((item) => item.source.file === file);
  }

  public routeReferencesForControllerMethod(controllerMethodKey: string): IndexedItem[] {
    return this.all("route-action").filter((item) => item.detail === controllerMethodKey && item.routeSource);
  }

  private findNearestRouteControllerScope(file: string, offset: number): RouteControllerScope | undefined {
    return (this.snapshot?.routeControllerScopes ?? [])
      .filter((scope) => scope.file === file && offset >= scope.bodyStart && offset <= scope.bodyEnd)
      .sort((a, b) => b.bodyStart - a.bodyStart)[0];
  }

  private findEloquentModelForFile(file: string): IndexedItem | undefined {
    return this.all("eloquent-model").find((item) => item.source.file === file);
  }

  private findEloquentModelByReference(reference: string): IndexedItem | undefined {
    const normalized = reference.replace(/^\\/, "");
    return this.all("eloquent-model").find((item) => {
      const modelClass = item.modelClass ?? item.key;
      const shortName = modelClass.split("\\").pop();
      return modelClass === normalized || shortName === normalized || modelClass.endsWith(`\\${normalized}`);
    });
  }

  private findRelationPathModel(file: string, modelReference: string | undefined, relationPath: string[]): IndexedItem | undefined {
    let model = modelReference ? this.findEloquentModelByReference(modelReference) : this.findEloquentModelForFile(file);
    for (const relationName of relationPath) {
      if (!model) {
        return undefined;
      }
      const relation = this
        .all("eloquent-relation")
        .find((item) => item.modelClass === model?.modelClass && item.key === relationName);
      if (!relation?.relatedModelClass) {
        return undefined;
      }
      model = this.findEloquentModelByReference(relation.relatedModelClass);
    }
    return model;
  }

  private itemsForIdeJsonKind(kind: IdeJsonCompletionKind, values: string[] | undefined): IndexedItem[] {
    switch (kind) {
      case "routeName":
        return this.all("route");
      case "configKey":
        return this.all("config");
      case "viewName":
        return this.all("view");
      case "translationKey":
        return this.all("translation");
      case "environmentVariable":
        return this.all("env");
      case "filesystemDisk":
        return this.all("filesystem-disk");
      case "staticStrings":
        return (values ?? []).map((value) => ({
          key: value,
          label: value,
          kind: "config",
          source: { file: this.snapshot?.projectRoot ?? "", line: 0, character: 0 },
          detail: "ide.json static string",
        }));
    }
  }
}
