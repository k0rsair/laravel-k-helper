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
  scanContainerBindings,
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
  scanArtisanCommands,
  scanResponseFields,
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
      bladeComponentIndex,
      validationRules,
      requestFields,
      routeMiddleware,
      controllerMethods,
      filesystemDisks,
      ideJsonRules,
      databaseSchema,
      ecosystemItems,
      containerIndex,
      artisanCommands,
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
      scanContainerBindings(this.projectRoot, this.logger),
      scanArtisanCommands(this.projectRoot, this.logger),
    ]);
    const eloquentIndex = await scanEloquentModels(this.projectRoot, this.logger, databaseSchema.columns);
    const routeControllerScopes = await scanRouteControllerScopes(this.projectRoot, this.logger);
    const httpRoutes = await scanHttpRoutes(this.projectRoot, this.logger, controllerMethods, routeControllerScopes);
    const routeActions = await scanRouteActions(this.projectRoot, this.logger, controllerMethods, routeControllerScopes);
    const responseFields = await scanResponseFields(
      this.projectRoot,
      this.logger,
      httpRoutes,
      controllerMethods,
      routeControllerScopes,
      eloquentIndex.fields,
      eloquentIndex.models,
    );

    this.snapshot = {
      projectRoot: this.projectRoot,
      indexedAt: Date.now(),
      routes,
      httpRoutes,
      views,
      config,
      translations,
      env,
      bladeComponents: bladeComponentIndex.components,
      bladeComponentProps: bladeComponentIndex.props,
      bladeComponentSlots: bladeComponentIndex.slots,
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
      containerBindings: containerIndex.bindings,
      containerMethods: containerIndex.methods,
      artisanCommands,
      responseFields,
      livewireComponents: ecosystemItems.livewireComponents,
      livewireProperties: ecosystemItems.livewireProperties,
      livewireActions: ecosystemItems.livewireActions,
      livewireEvents: ecosystemItems.livewireEvents,
      inertiaPages: ecosystemItems.inertiaPages,
      inertiaProps: ecosystemItems.inertiaProps,
      filamentResources: ecosystemItems.filamentResources,
      filamentPages: ecosystemItems.filamentPages,
      filamentFields: ecosystemItems.filamentFields,
      filamentActions: ecosystemItems.filamentActions,
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
      bladeComponentProps: this.snapshot?.bladeComponentProps.length ?? 0,
      bladeComponentSlots: this.snapshot?.bladeComponentSlots.length ?? 0,
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
      containerBindings: this.snapshot?.containerBindings.length ?? 0,
      containerMethods: this.snapshot?.containerMethods.length ?? 0,
      artisanCommands: this.snapshot?.artisanCommands.length ?? 0,
      responseFields: this.snapshot?.responseFields.length ?? 0,
      livewireComponents: this.snapshot?.livewireComponents.length ?? 0,
      livewireProperties: this.snapshot?.livewireProperties.length ?? 0,
      livewireActions: this.snapshot?.livewireActions.length ?? 0,
      livewireEvents: this.snapshot?.livewireEvents.length ?? 0,
      inertiaPages: this.snapshot?.inertiaPages.length ?? 0,
      inertiaProps: this.snapshot?.inertiaProps.length ?? 0,
      filamentResources: this.snapshot?.filamentResources.length ?? 0,
      filamentPages: this.snapshot?.filamentPages.length ?? 0,
      filamentFields: this.snapshot?.filamentFields.length ?? 0,
      filamentActions: this.snapshot?.filamentActions.length ?? 0,
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
      case "blade-component-prop":
        return snapshot.bladeComponentProps;
      case "blade-component-slot":
        return snapshot.bladeComponentSlots;
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
      case "container-binding":
        return snapshot.containerBindings;
      case "container-method":
        return snapshot.containerMethods;
      case "artisan-command":
        return snapshot.artisanCommands;
      case "response-field":
        return snapshot.responseFields;
      case "livewire-component":
        return snapshot.livewireComponents;
      case "livewire-property":
        return snapshot.livewireProperties;
      case "livewire-action":
        return snapshot.livewireActions;
      case "livewire-event":
        return snapshot.livewireEvents;
      case "inertia-page":
        return snapshot.inertiaPages;
      case "inertia-prop":
        return snapshot.inertiaProps;
      case "filament-resource":
        return snapshot.filamentResources;
      case "filament-page":
        return snapshot.filamentPages;
      case "filament-field":
        return snapshot.filamentFields;
      case "filament-action":
        return snapshot.filamentActions;
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

  public frontendResponseCompletions(
    reference: { kind: "route-name" | "url"; value: string; method?: string },
    prefix: string,
    path: string[] = [],
  ): IndexedItem[] {
    const route =
      reference.kind === "route-name"
        ? this.findHttpRouteByName(reference.value)
        : this.findHttpRouteByRequest(reference.value, reference.method);
    if (!route) {
      this.logger.debug("[LaravelIndex.frontendResponseCompletions] no route match", {
        kind: reference.kind,
        value: reference.value,
        method: reference.method,
        prefix,
      });
      return [];
    }

    const fields = this.all("response-field").filter((item) => responseFieldBelongsToRoute(item, route));
    if (fields.length === 0) {
      this.logger.debug("[LaravelIndex.frontendResponseCompletions] no response fields indexed", {
        route: route.uri ?? route.key,
        routeName: route.routeName,
        method: route.httpMethod,
        prefix,
      });
      return [];
    }

    const seen = new Set<string>();
    return fields.flatMap((item) => {
      const fieldPath = item.responseFieldPath ?? item.key.split(".");
      if (!pathPrefixMatches(fieldPath, path)) {
        return [];
      }

      const remainingPath = fieldPath.slice(path.length);
      if (remainingPath.length === 0) {
        return [];
      }

      const key = remainingPath.join(".");
      if (!key.startsWith(prefix) || seen.has(key)) {
        return [];
      }
      seen.add(key);

      return [{
        ...item,
        key,
        label: key,
        detail: item.detail ?? `Laravel response: ${route.httpMethod ?? "ANY"} ${route.uri ?? route.key}`,
      }];
    }).sort((a, b) => responseFieldSortKey(a).localeCompare(responseFieldSortKey(b)));
  }

  public frontendResponseField(
    reference: { kind: "route-name" | "url"; value: string; method?: string },
    fieldPath: string[],
  ): IndexedItem | undefined {
    const route =
      reference.kind === "route-name"
        ? this.findHttpRouteByName(reference.value)
        : this.findHttpRouteByRequest(reference.value, reference.method);
    if (!route) {
      this.logger.debug("[LaravelIndex.frontendResponseField] no route match", {
        kind: reference.kind,
        value: reference.value,
        method: reference.method,
        fieldPath,
      });
      return undefined;
    }

    const key = fieldPath.join(".");
    const match = this
      .all("response-field")
      .find((item) => responseFieldBelongsToRoute(item, route) && (item.responseFieldPath ?? item.key.split(".")).join(".") === key);
    if (!match) {
      this.logger.debug("[LaravelIndex.frontendResponseField] no response field match", {
        route: route.uri ?? route.key,
        routeName: route.routeName,
        method: route.httpMethod,
        fieldPath,
      });
      return undefined;
    }

    return match;
  }

  public bladeComponentPropCompletions(componentReference: string, prefix: string): IndexedItem[] {
    return this
      .all("blade-component-prop")
      .filter((item) => bladeComponentNameMatches(item.componentName ?? "", componentReference) && item.key.startsWith(prefix));
  }

  public bladeComponentSlotCompletions(componentReference: string, prefix: string): IndexedItem[] {
    return this
      .all("blade-component-slot")
      .filter((item) => bladeComponentNameMatches(item.componentName ?? "", componentReference) && item.key.startsWith(prefix));
  }

  public findBladeComponentProp(componentReference: string, propName: string): IndexedItem | undefined {
    return this
      .all("blade-component-prop")
      .find((item) => bladeComponentNameMatches(item.componentName ?? "", componentReference) && item.key === propName);
  }

  public findBladeComponentSlot(componentReference: string, slotName: string): IndexedItem | undefined {
    return this
      .all("blade-component-slot")
      .find((item) => bladeComponentNameMatches(item.componentName ?? "", componentReference) && item.key === slotName);
  }

  public findLivewireComponentForFile(file: string): IndexedItem | undefined {
    return this.all("livewire-component").find((item) => item.source.file === file && item.detail === "Livewire view component");
  }

  public livewirePropertyCompletions(componentName: string, prefix: string): IndexedItem[] {
    return this.all("livewire-property").filter((item) => item.componentName === componentName && item.key.startsWith(prefix));
  }

  public livewireActionCompletions(componentName: string, prefix: string): IndexedItem[] {
    return this.all("livewire-action").filter((item) => item.componentName === componentName && item.key.startsWith(prefix));
  }

  public findLivewireProperty(componentName: string, propertyName: string): IndexedItem | undefined {
    return this.all("livewire-property").find((item) => item.componentName === componentName && item.key === propertyName);
  }

  public findLivewireAction(componentName: string, actionName: string): IndexedItem | undefined {
    return this.all("livewire-action").find((item) => item.componentName === componentName && item.key === actionName);
  }

  public findInertiaPageForFile(file: string): IndexedItem | undefined {
    return this.all("inertia-page").find((item) => item.source.file === file);
  }

  public inertiaPropCompletions(pageName: string, prefix: string, path: string[] = []): IndexedItem[] {
    const seen = new Set<string>();
    return this
      .all("inertia-prop")
      .filter((item) => item.componentName === pageName)
      .flatMap((item) => {
        const propPath = item.responseFieldPath ?? item.key.split(".");
        if (!pathPrefixMatches(propPath, path)) {
          return [];
        }
        const remainingPath = propPath.slice(path.length);
        if (remainingPath.length === 0) {
          return [];
        }
        const key = remainingPath.join(".");
        if (!key.startsWith(prefix) || seen.has(key)) {
          return [];
        }
        seen.add(key);
        return [{
          ...item,
          key,
          label: key,
        }];
      });
  }

  public findInertiaProp(pageName: string, fieldPath: string[]): IndexedItem | undefined {
    const key = fieldPath.join(".");
    return this
      .all("inertia-prop")
      .find((item) => item.componentName === pageName && (item.responseFieldPath ?? item.key.split(".")).join(".") === key);
  }

  public filamentFieldCompletions(prefix: string): IndexedItem[] {
    return this.all("filament-field").filter((item) => item.key.startsWith(prefix));
  }

  public filamentActionCompletions(prefix: string): IndexedItem[] {
    return this.all("filament-action").filter((item) => item.key.startsWith(prefix));
  }

  public findFilamentField(name: string): IndexedItem | undefined {
    return this.all("filament-field").find((item) => item.key === name);
  }

  public findFilamentAction(name: string): IndexedItem | undefined {
    return this.all("filament-action").find((item) => item.key === name);
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
    if (modelReference && !model) {
      return [];
    }
    const fields = model ? this.all("eloquent-field").filter((item) => item.modelClass === model.modelClass) : this.all("eloquent-field");
    return fields.filter((item) => item.key.startsWith(prefix));
  }

  public eloquentMemberCompletions(file: string, prefix: string, modelReference?: string): IndexedItem[] {
    const model = modelReference ? this.findEloquentModelByReference(modelReference) : this.findEloquentModelForFile(file);
    if (!model) {
      return [];
    }

    return [
      ...this.all("eloquent-field").filter((item) => item.modelClass === model.modelClass && item.key.startsWith(prefix)),
      ...this.all("eloquent-relation").filter((item) => item.modelClass === model.modelClass && item.key.startsWith(prefix)),
    ];
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

  public findEloquentField(modelReference: string, key: string): IndexedItem | undefined {
    const model = this.findEloquentModelByReference(modelReference);
    if (!model) {
      return undefined;
    }

    return this.all("eloquent-field").find((item) => item.modelClass === model.modelClass && item.key === key);
  }

  public findEloquentRelation(modelReference: string, key: string): IndexedItem | undefined {
    const model = this.findEloquentModelByReference(modelReference);
    if (!model) {
      return undefined;
    }

    return this.all("eloquent-relation").find((item) => item.modelClass === model.modelClass && item.key === key);
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

  public findContainerBindingByAbstract(reference: string): IndexedItem | undefined {
    const normalized = normalizeClassReference(reference);
    const candidates = this.all("container-binding").filter((item) => classReferenceMatches(item.abstractClass ?? item.key, normalized));
    if (candidates.length > 1) {
      this.logger.debug("[LaravelIndex.findContainerBindingByAbstract] multiple bindings found", {
        abstractClass: normalized,
        concreteClasses: candidates.map((item) => item.concreteClass),
      });
    }
    return candidates[0];
  }

  public findContainerMethodByAbstract(reference: string, method: string): IndexedItem | undefined {
    const normalized = normalizeClassReference(reference);
    const bindings = this.all("container-binding").filter((item) => classReferenceMatches(item.abstractClass ?? item.key, normalized));
    if (bindings.length === 0) {
      this.logger.debug("[LaravelIndex.findContainerMethodByAbstract] no binding found", {
        abstractClass: normalized,
        method,
      });
      return undefined;
    }

    const candidates = bindings.flatMap((binding) =>
      this.all("container-method").filter((item) => item.concreteClass === binding.concreteClass && item.method === method),
    );
    if (candidates.length === 0) {
      this.logger.debug("[LaravelIndex.findContainerMethodByAbstract] no concrete method found", {
        abstractClass: normalized,
        concreteClasses: bindings.map((binding) => binding.concreteClass),
        method,
      });
      return undefined;
    }
    if (candidates.length > 1) {
      this.logger.debug("[LaravelIndex.findContainerMethodByAbstract] multiple concrete methods found", {
        abstractClass: normalized,
        method,
        concreteClasses: candidates.map((item) => item.concreteClass),
      });
    }
    return candidates[0];
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

function normalizeClassReference(reference: string): string {
  return reference.replace(/^\\/, "").replace(/::class$/, "");
}

function normalizeBladeComponentName(reference: string): string {
  return reference.replace(/^x-/, "").replace(/:/g, ".");
}

function bladeComponentNameMatches(candidate: string, reference: string): boolean {
  const normalizedCandidate = normalizeBladeComponentName(candidate);
  const normalizedReference = normalizeBladeComponentName(reference);
  return (
    normalizedCandidate === normalizedReference ||
    normalizedCandidate.replace(/\./g, "-") === normalizedReference ||
    normalizedCandidate === normalizedReference.replace(/\./g, "-")
  );
}

function classReferenceMatches(candidate: string, normalizedReference: string): boolean {
  const normalizedCandidate = normalizeClassReference(candidate);
  const shortName = normalizedCandidate.split("\\").pop();
  const referenceShortName = normalizedReference.split("\\").pop();
  return (
    normalizedCandidate === normalizedReference ||
    shortName === normalizedReference ||
    (referenceShortName !== undefined && shortName === referenceShortName) ||
    normalizedCandidate.endsWith(`\\${normalizedReference}`)
  );
}

function responseFieldBelongsToRoute(field: IndexedItem, route: IndexedItem): boolean {
  if (route.routeName && field.responseRouteName === route.routeName) {
    return true;
  }

  return (
    field.responseRouteUri === route.uri &&
    (!route.httpMethod || !field.responseHttpMethod || field.responseHttpMethod === route.httpMethod)
  );
}

function pathPrefixMatches(value: string[], prefix: string[]): boolean {
  if (prefix.length > value.length) {
    return false;
  }
  return prefix.every((part, index) => value[index] === part);
}

function responseFieldSortKey(item: IndexedItem): string {
  const path = item.responseFieldPath ?? item.key.split(".");
  return `${String(path.length).padStart(2, "0")}:${item.key}`;
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
