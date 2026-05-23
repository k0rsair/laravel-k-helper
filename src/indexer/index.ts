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
  scanEcosystemItems,
  scanFilesystemDisks,
  scanHttpRoutes,
  scanRequestFields,
  scanRouteMiddleware,
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
      routeMiddleware,
      controllerMethods,
      filesystemDisks,
      ideJsonRules,
      databaseSchema,
      ecosystemItems,
    ] = await Promise.all([
      scanRoutes(this.projectRoot, this.logger),
      scanViews(this.projectRoot, this.logger),
      scanConfig(this.projectRoot, this.logger),
      scanTranslations(this.projectRoot, this.logger),
      scanEnvKeys(this.projectRoot, this.logger),
      scanBladeComponents(this.projectRoot, this.logger),
      scanValidationRules(this.projectRoot, this.logger),
      scanRequestFields(this.projectRoot, this.logger),
      scanRouteMiddleware(this.projectRoot, this.logger),
      scanControllerMethods(this.projectRoot, this.logger),
      scanFilesystemDisks(this.projectRoot, this.logger),
      scanIdeJsonRules(this.projectRoot, this.logger),
      scanDatabaseSchema(this.projectRoot, this.logger),
      scanEcosystemItems(this.projectRoot, this.logger),
    ]);
    const eloquentIndex = await scanEloquentModels(this.projectRoot, this.logger, databaseSchema.columns);
    const routeControllerScopes = await scanRouteControllerScopes(this.projectRoot, this.logger);
    const httpRoutes = await scanHttpRoutes(this.projectRoot, this.logger, controllerMethods, routeControllerScopes);
    const routeActions = await scanRouteActions(this.projectRoot, this.logger, controllerMethods, routeControllerScopes);

    this.snapshot = {
      projectRoot: this.projectRoot,
      indexedAt: Date.now(),
      routes,
      httpRoutes,
      views,
      config,
      translations,
      env,
      bladeComponents,
      validationRules,
      requestFields,
      routeMiddleware,
      controllerMethods,
      routeActions,
      routeControllerScopes,
      filesystemDisks,
      eloquentModels: eloquentIndex.models,
      databaseTables: databaseSchema.tables,
      databaseColumns: databaseSchema.columns,
      eloquentFields: eloquentIndex.fields,
      eloquentRelations: eloquentIndex.relations,
      eloquentScopes: eloquentIndex.scopes,
      eloquentFactoryStates: eloquentIndex.factoryStates,
      livewireComponents: ecosystemItems.livewireComponents,
      inertiaPages: ecosystemItems.inertiaPages,
      filamentResources: ecosystemItems.filamentResources,
      novaResources: ecosystemItems.novaResources,
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
      httpRoutes: this.snapshot?.httpRoutes.length ?? 0,
      views: this.snapshot?.views.length ?? 0,
      config: this.snapshot?.config.length ?? 0,
      translations: this.snapshot?.translations.length ?? 0,
      env: this.snapshot?.env.length ?? 0,
      bladeComponents: this.snapshot?.bladeComponents.length ?? 0,
      validationRules: this.snapshot?.validationRules.length ?? 0,
      requestFields: this.snapshot?.requestFields.length ?? 0,
      routeMiddleware: this.snapshot?.routeMiddleware.length ?? 0,
      controllerMethods: this.snapshot?.controllerMethods.length ?? 0,
      routeActions: this.snapshot?.routeActions.length ?? 0,
      filesystemDisks: this.snapshot?.filesystemDisks.length ?? 0,
      eloquentModels: this.snapshot?.eloquentModels.length ?? 0,
      databaseTables: this.snapshot?.databaseTables.length ?? 0,
      databaseColumns: this.snapshot?.databaseColumns.length ?? 0,
      eloquentFields: this.snapshot?.eloquentFields.length ?? 0,
      eloquentRelations: this.snapshot?.eloquentRelations.length ?? 0,
      eloquentScopes: this.snapshot?.eloquentScopes.length ?? 0,
      eloquentFactoryStates: this.snapshot?.eloquentFactoryStates.length ?? 0,
      livewireComponents: this.snapshot?.livewireComponents.length ?? 0,
      inertiaPages: this.snapshot?.inertiaPages.length ?? 0,
      filamentResources: this.snapshot?.filamentResources.length ?? 0,
      novaResources: this.snapshot?.novaResources.length ?? 0,
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
      case "http-route":
        return snapshot.httpRoutes;
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
      case "route-middleware":
        return snapshot.routeMiddleware;
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
      case "eloquent-scope":
        return snapshot.eloquentScopes;
      case "eloquent-factory-state":
        return snapshot.eloquentFactoryStates;
      case "livewire-component":
        return snapshot.livewireComponents;
      case "inertia-page":
        return snapshot.inertiaPages;
      case "filament-resource":
        return snapshot.filamentResources;
      case "nova-resource":
        return snapshot.novaResources;
    }
  }

  public find(kind: LaravelIndexKind, key: string): IndexedItem | undefined {
    return this.all(kind).find((item) => item.key === key);
  }

  public findHttpRouteByRequest(uri: string, method?: string): IndexedItem | undefined {
    const normalizedUri = normalizeHttpUri(uri);
    const normalizedMethod = method?.toUpperCase();
    const candidates = this.all("http-route")
      .filter((item) => {
        if (normalizedMethod && item.httpMethod && item.httpMethod !== "ANY" && item.httpMethod !== normalizedMethod) {
          return false;
        }
        return item.uri ? routeUriMatches(item.uri, normalizedUri) : item.key === normalizedUri;
      })
      .sort((a, b) => routeMatchScore(b, normalizedUri, normalizedMethod) - routeMatchScore(a, normalizedUri, normalizedMethod));

    return candidates[0];
  }

  public findHttpRouteByName(routeName: string): IndexedItem | undefined {
    return this.all("http-route").find((item) => item.routeName === routeName);
  }

  public routeActionCompletions(file: string, offset: number, prefix: string, controllerReference?: string): IndexedItem[] {
    if (controllerReference) {
      const controller = this.findControllerClassByReference(controllerReference);
      if (!controller) {
        return [];
      }

      return this.all("controller-method")
        .filter((item) => item.controllerClass === controller && (item.method ?? item.key).startsWith(prefix))
        .map((item) => ({
          ...item,
          key: item.method ?? item.key.split("::").pop() ?? item.key,
          label: item.method ?? item.label,
          kind: "route-action",
          detail: item.key,
        }));
    }

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

  public eloquentCastTypeCompletions(
    file: string,
    prefix: string,
    attribute: string,
    modelReference?: string,
  ): IndexedItem[] {
    const model = modelReference ? this.findEloquentModelByReference(modelReference) : this.findEloquentModelForFile(file);
    const field = model
      ? this.all("eloquent-field").find((item) => item.modelClass === model.modelClass && item.key === attribute)
      : undefined;
    const source = field?.source ?? { file, line: 0, character: 0 };
    const columnType = field?.columnType;
    return castTypesForColumn(columnType)
      .filter((castType) => castType.value.startsWith(prefix))
      .map((castType) => ({
        key: castType.value,
        label: castType.value,
        kind: "eloquent-field",
        source,
        detail: columnType ? `${attribute} ${columnType} column: ${castType.detail}` : castType.detail,
        modelClass: model?.modelClass,
        table: model?.table,
        columnType,
      }));
  }

  public eloquentRelationCompletions(
    file: string,
    prefix: string,
    modelReference?: string,
    relationPath: string[] = [],
  ): IndexedItem[] {
    const model = this.findRelationPathModel(file, modelReference, relationPath);
    if (!model) {
      return [];
    }
    const relations = this.all("eloquent-relation").filter((item) => item.modelClass === model.modelClass);
    return relations.filter((item) => item.key.startsWith(prefix));
  }

  public databaseColumnCompletions(prefix: string, table?: string): IndexedItem[] {
    const columns = table ? this.all("database-column").filter((item) => item.table === table) : this.all("database-column");
    return columns.filter((item) => item.key.startsWith(prefix));
  }

  public eloquentScopeCompletions(file: string, prefix: string, modelReference?: string): IndexedItem[] {
    const model = modelReference ? this.findEloquentModelByReference(modelReference) : this.findEloquentModelForFile(file);
    if (modelReference && !model) {
      return [];
    }
    const scopes = model ? this.all("eloquent-scope").filter((item) => item.modelClass === model.modelClass) : this.all("eloquent-scope");
    return scopes.filter((item) => item.key.startsWith(prefix));
  }

  public eloquentFactoryStateCompletions(file: string, prefix: string, modelReference?: string): IndexedItem[] {
    const model = modelReference ? this.findEloquentModelByReference(modelReference) : this.findEloquentModelForFile(file);
    if (modelReference && !model) {
      return [];
    }
    const states = model
      ? this.all("eloquent-factory-state").filter((item) => item.modelClass === model.modelClass)
      : this.all("eloquent-factory-state");
    return states.filter((item) => item.key.startsWith(prefix));
  }

  public ideJsonCompletions(rule: IdeJsonCompletionRule, prefix: string): IndexedItem[] {
    const items = this.itemsForIdeJsonKind(rule.kind, rule.values);
    return items.filter((item) => item.key.startsWith(prefix));
  }

  public filamentResourceCompletions(prefix: string): IndexedItem[] {
    return this.all("filament-resource").filter((item) => {
      const shortName = item.key.split("\\").pop() ?? item.key;
      return item.key.startsWith(prefix) || shortName.startsWith(prefix);
    });
  }

  public findFilamentResourceByReference(reference: string): IndexedItem | undefined {
    const normalized = reference.replace(/^\\/, "").replace(/::class$/, "");
    return this.all("filament-resource").find((item) => {
      const shortName = item.key.split("\\").pop() ?? item.key;
      return item.key === normalized || shortName === normalized || item.key.endsWith(`\\${normalized}`);
    });
  }

  public novaResourceCompletions(prefix: string): IndexedItem[] {
    return this.all("nova-resource").filter((item) => {
      const shortName = item.key.split("\\").pop() ?? item.key;
      return item.key.startsWith(prefix) || shortName.startsWith(prefix);
    });
  }

  public findNovaResourceByReference(reference: string): IndexedItem | undefined {
    const normalized = reference.replace(/^\\/, "").replace(/::class$/, "");
    return this.all("nova-resource").find((item) => {
      const shortName = item.key.split("\\").pop() ?? item.key;
      return item.key === normalized || shortName === normalized || item.key.endsWith(`\\${normalized}`);
    });
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

  private findControllerClassByReference(reference: string): string | undefined {
    const normalized = reference.replace(/^\\/, "");
    const controllers = new Set(
      this.all("controller-method")
        .map((item) => item.controllerClass)
        .filter((controllerClass): controllerClass is string => controllerClass !== undefined),
    );
    for (const controllerClass of controllers) {
      const shortName = controllerClass.split("\\").pop();
      if (controllerClass === normalized || shortName === normalized || controllerClass.endsWith(`\\${normalized}`)) {
        return controllerClass;
      }
    }
    return undefined;
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

function castTypesForColumn(columnType: string | undefined): Array<{ value: string; detail: string }> {
  const normalized = columnType?.toLowerCase();
  const generic = [
    { value: "array", detail: "Laravel cast type" },
    { value: "boolean", detail: "Laravel cast type" },
    { value: "collection", detail: "Laravel cast type" },
    { value: "date", detail: "Laravel cast type" },
    { value: "datetime", detail: "Laravel cast type" },
    { value: "decimal:2", detail: "Laravel cast type" },
    { value: "double", detail: "Laravel cast type" },
    { value: "encrypted", detail: "Laravel cast type" },
    { value: "float", detail: "Laravel cast type" },
    { value: "integer", detail: "Laravel cast type" },
    { value: "object", detail: "Laravel cast type" },
    { value: "string", detail: "Laravel cast type" },
    { value: "timestamp", detail: "Laravel cast type" },
  ];

  const preferred = preferredCastTypesForColumn(normalized);
  const byValue = new Map<string, { value: string; detail: string }>();
  for (const castType of [...preferred, ...generic]) {
    byValue.set(castType.value, castType);
  }
  return [...byValue.values()];
}

function normalizeHttpUri(uri: string): string {
  let value = uri.trim();
  try {
    if (/^https?:\/\//i.test(value)) {
      value = new URL(value).pathname;
    }
  } catch {
    // Keep the original value when URL parsing fails; route matching will simply miss.
  }
  value = value.split(/[?#]/)[0] ?? value;
  value = value.replace(/^\/+|\/+$/g, "");
  return value ? `/${value}` : "/";
}

function routeUriMatches(routeUri: string, requestUri: string): boolean {
  const normalizedRoute = normalizeHttpUri(routeUri);
  if (normalizedRoute === requestUri) {
    return true;
  }

  const pattern = normalizedRoute
    .split("/")
    .map((segment) => {
      if (/^\{[^}]+\}$/.test(segment)) {
        return "[^/]+";
      }
      return escapeRegex(segment);
    })
    .join("/");

  return new RegExp(`^${pattern}/?$`).test(requestUri);
}

function routeMatchScore(item: IndexedItem, requestUri: string, method?: string): number {
  let score = 0;
  if (item.uri && normalizeHttpUri(item.uri) === requestUri) {
    score += 10;
  }
  if (item.uri) {
    score += item.uri.split("/").filter((segment) => segment !== "" && !/^\{[^}]+\}$/.test(segment)).length;
  }
  if (method && item.httpMethod === method) {
    score += 5;
  }
  if (item.httpMethod === "ANY") {
    score += 1;
  }
  return score;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preferredCastTypesForColumn(columnType: string | undefined): Array<{ value: string; detail: string }> {
  switch (columnType) {
    case "boolean":
      return [{ value: "boolean", detail: "Recommended for boolean migration columns" }];
    case "biginteger":
    case "foreignid":
    case "id":
    case "integer":
    case "mediuminteger":
    case "smallinteger":
    case "tinyinteger":
    case "unsignedbiginteger":
    case "year":
      return [{ value: "integer", detail: "Recommended for integer-like migration columns" }];
    case "decimal":
      return [{ value: "decimal:2", detail: "Recommended for decimal migration columns; adjust scale if needed" }];
    case "double":
      return [{ value: "double", detail: "Recommended for double migration columns" }];
    case "float":
      return [{ value: "float", detail: "Recommended for float migration columns" }];
    case "json":
    case "jsonb":
      return [
        { value: "array", detail: "Recommended for JSON migration columns" },
        { value: "object", detail: "Alternative JSON cast" },
        { value: "collection", detail: "Alternative JSON cast" },
      ];
    case "date":
      return [{ value: "date", detail: "Recommended for date migration columns" }];
    case "datetime":
    case "datetimetz":
    case "timestamp":
    case "timestamptz":
      return [{ value: "datetime", detail: "Recommended for date-time migration columns" }];
    case "time":
    case "timetz":
      return [{ value: "string", detail: "Recommended for time migration columns" }];
    case "binary":
    case "char":
    case "enum":
    case "ipaddress":
    case "longtext":
    case "macaddress":
    case "mediumtext":
    case "set":
    case "string":
    case "text":
    case "ulid":
    case "uuid":
      return [{ value: "string", detail: "Recommended for string-like migration columns" }];
    default:
      return [];
  }
}
