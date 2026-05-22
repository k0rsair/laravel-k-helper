import path from "node:path";
import { readTextFile, toPosixPath, walkFiles } from "../utils/files";
import type { IndexedItem, LaravelIndexKind, RouteControllerScope, SourceLocation } from "./types";
import type { Logger } from "../logging/logger";

export interface DatabaseSchemaIndex {
  tables: IndexedItem[];
  columns: IndexedItem[];
}

export interface EloquentIndex {
  models: IndexedItem[];
  fields: IndexedItem[];
  relations: IndexedItem[];
  scopes: IndexedItem[];
  factoryStates: IndexedItem[];
}

export interface EcosystemIndex {
  livewireComponents: IndexedItem[];
  inertiaPages: IndexedItem[];
  filamentResources: IndexedItem[];
  novaResources: IndexedItem[];
}

interface PhpClassInfo {
  file: string;
  text: string;
  namespace: string;
  className: string;
  classIndex: number;
  classNameIndex: number;
  fqn: string;
  extendsClass?: string;
  uses: Map<string, string>;
}

const BUILT_IN_VALIDATION_RULES = [
  "accepted",
  "accepted_if",
  "active_url",
  "after",
  "after_or_equal",
  "alpha",
  "alpha_dash",
  "alpha_num",
  "array",
  "bail",
  "before",
  "before_or_equal",
  "between",
  "boolean",
  "confirmed",
  "current_password",
  "date",
  "date_equals",
  "date_format",
  "decimal",
  "declined",
  "declined_if",
  "different",
  "digits",
  "digits_between",
  "dimensions",
  "distinct",
  "doesnt_start_with",
  "doesnt_end_with",
  "email",
  "ends_with",
  "enum",
  "exclude",
  "exclude_if",
  "exclude_unless",
  "exclude_with",
  "exclude_without",
  "exists",
  "file",
  "filled",
  "gt",
  "gte",
  "image",
  "in",
  "in_array",
  "integer",
  "ip",
  "ipv4",
  "ipv6",
  "json",
  "lt",
  "lte",
  "lowercase",
  "mac_address",
  "max",
  "max_digits",
  "mimes",
  "mimetypes",
  "min",
  "min_digits",
  "missing",
  "missing_if",
  "missing_unless",
  "missing_with",
  "missing_with_all",
  "multiple_of",
  "not_in",
  "not_regex",
  "nullable",
  "numeric",
  "password",
  "present",
  "prohibited",
  "prohibited_if",
  "prohibited_unless",
  "prohibits",
  "regex",
  "required",
  "required_array_keys",
  "required_if",
  "required_if_accepted",
  "required_if_declined",
  "required_unless",
  "required_with",
  "required_with_all",
  "required_without",
  "required_without_all",
  "same",
  "size",
  "sometimes",
  "starts_with",
  "string",
  "timezone",
  "unique",
  "uppercase",
  "url",
  "ulid",
  "uuid",
];

export async function scanRoutes(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const routesRoot = path.join(projectRoot, "routes");
  const routeFiles = await walkFiles(routesRoot, (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];

  for (const file of routeFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const routeNames = scanRegex(text, /\.name\(\s*['"]([^'"]+)['"]\s*\)/g);
    const namedRoutes = scanRegex(text, /Route::(?:get|post|put|patch|delete|options|any|match|resource|apiResource)\([^;]+?->name\(\s*['"]([^'"]+)['"]\s*\)/gs);
    for (const match of [...routeNames, ...namedRoutes]) {
      items.push(createItem("route", match.value, file, text, match.index));
    }
  }

  logger.debug("[LaravelIndex.scanRoutes] completed", { files: routeFiles.length, items: items.length });
  return uniqueItems(items);
}

export async function scanHttpRoutes(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const routesRoot = path.join(projectRoot, "routes");
  const routeFiles = await walkFiles(routesRoot, (file) => file.endsWith(".php"));
  const routeFilePrefixes = await scanRouteFilePrefixes(projectRoot, logger);
  const items: IndexedItem[] = [];

  for (const file of routeFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    for (const route of scanHttpRouteDeclarations(text, routeFilePrefixes.get(file) ?? "")) {
      const item = createItem("http-route", normalizeRouteUriForIndex(route.uri), file, text, route.uriIndex);
      items.push({
        ...item,
        label: `${route.method} ${route.uri}`,
        detail: route.routeName ? `${route.method} ${route.uri} (${route.routeName})` : `${route.method} ${route.uri}`,
        uri: route.uri,
        httpMethod: route.method,
        routeName: route.routeName,
      });
    }
  }

  logger.debug("[LaravelIndex.scanHttpRoutes] completed", {
    files: routeFiles.length,
    routeFilePrefixes: routeFilePrefixes.size,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanViews(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const viewsRoot = path.join(projectRoot, "resources", "views");
  const viewFiles = await walkFiles(viewsRoot, (file) => file.endsWith(".blade.php"));
  const items = viewFiles.map((file) => {
    const relative = toPosixPath(path.relative(viewsRoot, file));
    const key = relative.replace(/\.blade\.php$/, "").replace(/\//g, ".");
    return createItemFromLine("view", key, file, 0, 0);
  });

  logger.debug("[LaravelIndex.scanViews] completed", { files: viewFiles.length, items: items.length });
  return items;
}

export async function scanConfig(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const configRoot = path.join(projectRoot, "config");
  const configFiles = await walkFiles(configRoot, (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];

  for (const file of configFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const configName = path.basename(file, ".php");
    const keys = scanPhpArrayKeyPaths(text);
    for (const key of keys) {
      items.push(createItem("config", `${configName}.${key.value}`, file, text, key.index));
    }
  }

  logger.debug("[LaravelIndex.scanConfig] completed", { files: configFiles.length, items: items.length });
  return uniqueItems(items);
}

export async function scanFilesystemDisks(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const file = path.join(projectRoot, "config", "filesystems.php");
  const text = await readTextFile(file);
  if (!text) {
    logger.debug("[LaravelIndex.scanFilesystemDisks] config file not found", { file });
    return [];
  }

  const items = scanFilesystemDiskKeys(text).map((match) =>
    createItem("filesystem-disk", match.value, file, text, match.index),
  );

  logger.debug("[LaravelIndex.scanFilesystemDisks] completed", {
    file,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanDatabaseSchema(projectRoot: string, logger: Logger): Promise<DatabaseSchemaIndex> {
  const migrationsRoot = path.join(projectRoot, "database", "migrations");
  const migrationFiles = await walkFiles(migrationsRoot, (file) => file.endsWith(".php"));
  const tables: IndexedItem[] = [];
  const columns: IndexedItem[] = [];

  for (const file of migrationFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    for (const table of scanMigrationTableBlocks(text)) {
      tables.push({
        ...createItem("database-table", table.name, file, text, table.index),
        table: table.name,
      });

      for (const column of scanMigrationColumns(table.body, table.bodyOffset)) {
        columns.push({
          ...createItem("database-column", column.name, file, text, column.index),
          detail: `${table.name} column (${column.type})`,
          table: table.name,
          columnType: column.type,
        });
      }
    }
  }

  logger.debug("[LaravelIndex.scanDatabaseSchema] completed", {
    files: migrationFiles.length,
    tables: tables.length,
    columns: columns.length,
  });

  return {
    tables: uniqueItems(tables),
    columns: uniqueItems(columns),
  };
}

export async function scanEloquentModels(
  projectRoot: string,
  logger: Logger,
  databaseColumns: IndexedItem[],
): Promise<EloquentIndex> {
  const appFiles = await walkFiles(path.join(projectRoot, "app"), (file) => file.endsWith(".php"));
  const phpClasses: PhpClassInfo[] = [];
  const models: IndexedItem[] = [];
  const fields: IndexedItem[] = [];
  const relations: IndexedItem[] = [];
  const scopes: IndexedItem[] = [];
  const factoryStates: IndexedItem[] = [];
  const columnsByTable = new Map<string, IndexedItem[]>();
  const composerPackages = await readComposerPackageNames(projectRoot);

  for (const column of databaseColumns) {
    if (!column.table) {
      continue;
    }
    columnsByTable.set(column.table, [...(columnsByTable.get(column.table) ?? []), column]);
  }

  for (const file of appFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }
    const classInfo = scanPhpClassInfo(file, text);
    if (classInfo) {
      phpClasses.push(classInfo);
    }
  }

  const classesByName = new Map(phpClasses.map((phpClass) => [phpClass.fqn, phpClass]));
  const eloquentClassCache = new Map<string, boolean>();

  logger.debug("[FIX:eloquent-inheritance] resolved PHP classes for Eloquent scan", {
    files: appFiles.length,
    classes: phpClasses.length,
  });

  for (const classInfo of phpClasses) {
    if (!isEloquentClassInfo(classInfo, projectRoot, classesByName, eloquentClassCache)) {
      continue;
    }

    const modelClass = classInfo.fqn;
    const table = explicitModelTable(classInfo.text) ?? inferTableName(classInfo.className);
    models.push({
      ...createItem("eloquent-model", modelClass, classInfo.file, classInfo.text, classInfo.classNameIndex),
      detail: table,
      modelClass,
      table,
    });

    const fieldKeys = new Set<string>();
    for (const column of columnsByTable.get(table) ?? []) {
      fieldKeys.add(column.key);
      fields.push({
        ...column,
        kind: "eloquent-field",
        detail: column.columnType ? `${modelClass} field (${table}, ${column.columnType})` : `${modelClass} field (${table})`,
        modelClass,
        table,
      });
    }

    for (const castField of scanEloquentCastFields(classInfo.text, classInfo.file, modelClass)) {
      if (fieldKeys.has(castField.key)) {
        continue;
      }
      fieldKeys.add(castField.key);
      fields.push(castField);
    }

    relations.push(...scanEloquentRelations(classInfo.text, classInfo.file, modelClass, classInfo.namespace, classInfo.uses));
    relations.push(...scanPackageEloquentRelations(classInfo.text, classInfo.file, modelClass, composerPackages));
    scopes.push(...scanEloquentScopes(classInfo.text, classInfo.file, modelClass));
  }

  factoryStates.push(...(await scanEloquentFactoryStates(projectRoot, logger)));

  logger.debug("[LaravelIndex.scanEloquentModels] completed", {
    files: appFiles.length,
    models: models.length,
    fields: fields.length,
    relations: relations.length,
    scopes: scopes.length,
    factoryStates: factoryStates.length,
  });

  return {
    models: uniqueItems(models),
    fields: uniqueItems(fields),
    relations: uniqueItems(relations),
    scopes: uniqueItems(scopes),
    factoryStates: uniqueItems(factoryStates),
  };
}

export async function scanTranslations(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const langRoot = path.join(projectRoot, "lang");
  const translationFiles = await walkFiles(langRoot, (file) => file.endsWith(".php") || file.endsWith(".json"));
  const items: IndexedItem[] = [];

  for (const file of translationFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const relative = toPosixPath(path.relative(langRoot, file));
    if (file.endsWith(".json")) {
      for (const match of scanJsonKeys(text)) {
        items.push(createItem("translation", match.value, file, text, match.index));
      }
      continue;
    }

    const parts = relative.replace(/\.php$/, "").split("/");
    const group = parts.slice(1).join(".");
    for (const key of scanPhpArrayKeyPaths(text)) {
      items.push(createItem("translation", group ? `${group}.${key.value}` : key.value, file, text, key.index));
    }
  }

  logger.debug("[LaravelIndex.scanTranslations] completed", {
    files: translationFiles.length,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanEnvKeys(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const files = [path.join(projectRoot, ".env.example"), path.join(projectRoot, ".env")];
  const items: IndexedItem[] = [];

  for (const file of files) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const matches = scanRegex(text, /^([A-Z0-9_]+)=.*$/gm);
    for (const match of matches) {
      items.push(createItem("env", match.value, file, text, match.index));
    }
  }

  logger.debug("[LaravelIndex.scanEnvKeys] completed", { files: files.length, items: items.length });
  return uniqueItems(items);
}

export async function scanBladeComponents(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const viewComponentsRoot = path.join(projectRoot, "resources", "views", "components");
  const classComponentsRoot = path.join(projectRoot, "app", "View", "Components");
  const viewFiles = await walkFiles(viewComponentsRoot, (file) => file.endsWith(".blade.php"));
  const classFiles = await walkFiles(classComponentsRoot, (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];

  for (const file of viewFiles) {
    const relative = toPosixPath(path.relative(viewComponentsRoot, file));
    const key = relative.replace(/\.blade\.php$/, "").replace(/\//g, ".");
    items.push(createItemFromLine("blade-component", key, file, 0, 0, `<x-${key.replace(/\./g, "-")}>`));
  }

  for (const file of classFiles) {
    const relative = toPosixPath(path.relative(classComponentsRoot, file));
    const key = relative
      .replace(/\.php$/, "")
      .replace(/\//g, ".")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase();
    items.push(createItemFromLine("blade-component", key, file, 0, 0, `<x-${key.replace(/\./g, "-")}>`));
  }

  logger.debug("[LaravelIndex.scanBladeComponents] completed", {
    viewFiles: viewFiles.length,
    classFiles: classFiles.length,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanEcosystemItems(projectRoot: string, logger: Logger): Promise<EcosystemIndex> {
  const livewireComponents = await scanLivewireComponents(projectRoot, logger);
  const inertiaPages = await scanInertiaPages(projectRoot, logger);
  const filamentResources = await scanFilamentResources(projectRoot, logger);
  const novaResources = await scanNovaResources(projectRoot, logger);

  logger.debug("[LaravelIndex.scanEcosystemItems] completed", {
    livewireComponents: livewireComponents.length,
    inertiaPages: inertiaPages.length,
    filamentResources: filamentResources.length,
    novaResources: novaResources.length,
  });

  return {
    livewireComponents,
    inertiaPages,
    filamentResources,
    novaResources,
  };
}

async function scanLivewireComponents(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const roots = [path.join(projectRoot, "app", "Livewire"), path.join(projectRoot, "app", "Http", "Livewire")];
  const viewRoot = path.join(projectRoot, "resources", "views", "livewire");
  const items: IndexedItem[] = [];

  for (const root of roots) {
    const files = await walkFiles(root, (file) => file.endsWith(".php"));
    for (const file of files) {
      const relative = toPosixPath(path.relative(root, file)).replace(/\.php$/, "");
      const key = relative
        .split("/")
        .map((segment) => segment.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase())
        .join(".");
      items.push(createItemFromLine("livewire-component", key, file, 0, 0, "Livewire component"));
    }
  }

  const viewFiles = await walkFiles(viewRoot, (file) => file.endsWith(".blade.php"));
  for (const file of viewFiles) {
    const key = toPosixPath(path.relative(viewRoot, file)).replace(/\.blade\.php$/, "").replace(/\//g, ".");
    items.push(createItemFromLine("livewire-component", key, file, 0, 0, "Livewire view component"));
  }

  logger.debug("[LaravelIndex.scanLivewireComponents] completed", { viewFiles: viewFiles.length, items: items.length });
  return uniqueItems(items);
}

async function scanInertiaPages(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const pagesRoot = path.join(projectRoot, "resources", "js", "Pages");
  const pageFiles = await walkFiles(pagesRoot, (file) => /\.(vue|jsx|tsx|svelte)$/.test(file));
  const items = pageFiles.map((file) => {
    const relative = toPosixPath(path.relative(pagesRoot, file)).replace(/\.(vue|jsx|tsx|svelte)$/, "");
    return createItemFromLine("inertia-page", relative, file, 0, 0, "Inertia page");
  });

  logger.debug("[LaravelIndex.scanInertiaPages] completed", { files: pageFiles.length, items: items.length });
  return uniqueItems(items);
}

async function scanFilamentResources(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const resourcesRoot = path.join(projectRoot, "app", "Filament", "Resources");
  const resourceFiles = await walkFiles(resourcesRoot, (file) => file.endsWith("Resource.php"));
  const items: IndexedItem[] = [];

  for (const file of resourceFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const namespace = /namespace\s+([^;]+);/.exec(text)?.[1];
    const classMatch = /class\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(text);
    if (!namespace || !classMatch?.[1] || classMatch.index === undefined) {
      continue;
    }

    const resourceClass = `${namespace}\\${classMatch[1]}`;
    items.push({
      ...createItem("filament-resource", resourceClass, file, text, classMatch.index),
      label: classMatch[1],
      detail: "Filament resource",
    });
  }

  logger.debug("[LaravelIndex.scanFilamentResources] completed", { files: resourceFiles.length, items: items.length });
  return uniqueItems(items);
}

async function scanNovaResources(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const resourcesRoot = path.join(projectRoot, "app", "Nova");
  const resourceFiles = await walkFiles(resourcesRoot, (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];

  for (const file of resourceFiles) {
    const text = await readTextFile(file);
    if (!text || !/\bextends\s+(?:\\?Laravel\\Nova\\)?Resource\b/.test(text)) {
      continue;
    }

    const namespace = /namespace\s+([^;]+);/.exec(text)?.[1];
    const classMatch = /class\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(text);
    if (!namespace || !classMatch?.[1] || classMatch.index === undefined) {
      continue;
    }

    const resourceClass = `${namespace}\\${classMatch[1]}`;
    items.push({
      ...createItem("nova-resource", resourceClass, file, text, classMatch.index),
      label: classMatch[1],
      detail: "Nova resource",
    });
  }

  logger.debug("[LaravelIndex.scanNovaResources] completed", { files: resourceFiles.length, items: items.length });
  return uniqueItems(items);
}

export async function scanValidationRules(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const composerFile = path.join(projectRoot, "composer.json");
  const items = BUILT_IN_VALIDATION_RULES.map((rule) =>
    createItemFromLine("validation-rule", rule, composerFile, 0, 0, "Laravel validation rule"),
  );

  const rulesRoot = path.join(projectRoot, "app", "Rules");
  const ruleFiles = await walkFiles(rulesRoot, (file) => file.endsWith(".php"));
  for (const file of ruleFiles) {
    const className = path.basename(file, ".php");
    const ruleKey = className.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
    items.push(createItemFromLine("validation-rule", ruleKey, file, 0, 0, `Custom rule ${className}`));
  }

  logger.debug("[LaravelIndex.scanValidationRules] completed", {
    builtIn: BUILT_IN_VALIDATION_RULES.length,
    customFiles: ruleFiles.length,
    items: items.length,
  });

  return uniqueItems(items);
}

export async function scanRequestFields(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const files = [
    ...(await walkFiles(path.join(projectRoot, "app"), (file) => file.endsWith(".php"))),
    ...(await walkFiles(path.join(projectRoot, "routes"), (file) => file.endsWith(".php"))),
  ];
  const items: IndexedItem[] = [];

  for (const file of files) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    for (const match of scanValidationFieldKeys(text)) {
      items.push(createItem("request-field", match.value, file, text, match.index));
    }
  }

  logger.debug("[LaravelIndex.scanRequestFields] completed", { files: files.length, items: items.length });
  return uniqueItems(items);
}

export async function scanRouteMiddleware(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const items: IndexedItem[] = [];

  for (const file of [path.join(projectRoot, "app", "Http", "Kernel.php"), path.join(projectRoot, "bootstrap", "app.php")]) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    for (const alias of scanRouteMiddlewareAliases(text)) {
      items.push({
        ...createItem("route-middleware", alias.key, file, text, alias.index),
        detail: alias.middlewareClass ? `Middleware ${alias.middlewareClass}` : "Route middleware",
        middlewareClass: alias.middlewareClass,
      });
    }
  }

  const referenceFiles = [
    ...(await walkFiles(path.join(projectRoot, "routes"), (file) => file.endsWith(".php"))),
    ...(await walkFiles(path.join(projectRoot, "app", "Http", "Controllers"), (file) => file.endsWith(".php"))),
  ];
  for (const file of referenceFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    for (const reference of scanRouteMiddlewareReferences(text)) {
      items.push({
        ...createItem("route-middleware", reference.key, file, text, reference.index),
        detail: "Route middleware reference",
      });
    }
  }

  logger.debug("[LaravelIndex.scanRouteMiddleware] completed", {
    files: referenceFiles.length + 2,
    items: items.length,
  });

  return uniqueItems(items);
}

export async function scanControllerMethods(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const controllersRoot = path.join(projectRoot, "app", "Http", "Controllers");
  const controllerFiles = await walkFiles(controllersRoot, (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];

  for (const file of controllerFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const namespace = /namespace\s+([^;]+);/.exec(text)?.[1];
    const className = /class\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(text)?.[1];
    if (!namespace || !className) {
      continue;
    }

    const controllerClass = `${namespace}\\${className}`;
    for (const match of text.matchAll(/\bpublic\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
      const method = match[1];
      if (!method || (method.startsWith("__") && method !== "__invoke") || match.index === undefined) {
        continue;
      }
      items.push({
        ...createItem("controller-method", `${controllerClass}::${method}`, file, text, match.index),
        controllerClass,
        method,
      });
    }
  }

  logger.debug("[LaravelIndex.scanControllerMethods] completed", {
    files: controllerFiles.length,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanRouteActions(
  projectRoot: string,
  logger: Logger,
  controllerMethods: IndexedItem[],
  routeControllerScopes: RouteControllerScope[],
): Promise<IndexedItem[]> {
  const routesRoot = path.join(projectRoot, "routes");
  const routeFiles = await walkFiles(routesRoot, (file) => file.endsWith(".php"));
  const methodsByKey = new Map(controllerMethods.map((item) => [item.key, item]));
  const items: IndexedItem[] = [];

  for (const file of routeFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const uses = scanUseStatements(text);
    for (const action of scanStringRouteActions(text)) {
      const group = findNearestControllerGroup(routeControllerScopes, file, action.index);
      if (!group) {
        continue;
      }

      items.push(createRouteActionItem(action.method, group.controllerClass, file, text, action.index, methodsByKey));
    }

    for (const action of scanArrayRouteActions(text, uses)) {
      items.push(createRouteActionItem(action.method, action.controllerClass, file, text, action.index, methodsByKey));
    }

    for (const action of scanControllerStringRouteActions(text, uses)) {
      items.push(createRouteActionItem(action.method, action.controllerClass, file, text, action.index, methodsByKey));
    }

    for (const action of scanInvokableRouteActions(text, uses)) {
      items.push(createRouteActionItem("__invoke", action.controllerClass, file, text, action.index, methodsByKey));
    }
  }

  logger.debug("[LaravelIndex.scanRouteActions] completed", {
    files: routeFiles.length,
    items: items.length,
  });
  return uniqueItems(items);
}

export async function scanRouteControllerScopes(projectRoot: string, logger: Logger): Promise<RouteControllerScope[]> {
  const routesRoot = path.join(projectRoot, "routes");
  const routeFiles = await walkFiles(routesRoot, (file) => file.endsWith(".php"));
  const scopes: RouteControllerScope[] = [];

  for (const file of routeFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }
    scopes.push(...scanRouteControllerGroups(text, scanUseStatements(text), file));
  }

  logger.debug("[LaravelIndex.scanRouteControllerScopes] completed", {
    files: routeFiles.length,
    items: scopes.length,
  });
  return scopes;
}

function scanPhpArrayKeyPaths(text: string): Array<{ value: string; index: number }> {
  const keys: Array<{ value: string; index: number }> = [];
  const stack: Array<{ indent: number; key: string }> = [];
  const keyRegex = /^(\s*)(?:['"]([A-Za-z0-9_.-]+)['"]|(-?\d+))\s*=>\s*(\[|array\s*\()?/;
  let offset = 0;

  for (const line of text.split(/\r?\n/)) {
    const match = keyRegex.exec(line);
    if (match) {
      const indent = match[1]?.length ?? 0;
      const key = match[2] ?? match[3] ?? "";

      while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
        stack.pop();
      }

      const value = [...stack.map((entry) => entry.key), key].join(".");
      keys.push({ value, index: offset + line.indexOf(key) });

      const opensArray = match[4] !== undefined;
      if (opensArray) {
        stack.push({ indent, key });
      }
    }

    offset += line.length + 1;
  }

  return keys;
}

function scanJsonKeys(text: string): Array<{ value: string; index: number }> {
  return scanRegex(text, /"([^"]+)"\s*:/g);
}

function scanFilesystemDiskKeys(text: string): Array<{ value: string; index: number }> {
  const disksMatch = /['"]disks['"]\s*=>\s*\[/.exec(text);
  if (disksMatch?.index === undefined) {
    return [];
  }

  const openBracket = text.indexOf("[", disksMatch.index);
  const closeBracket = findMatchingSquareBracket(text, openBracket, text.length);
  if (openBracket < 0 || closeBracket < 0) {
    return [];
  }

  const body = text.slice(openBracket + 1, closeBracket);
  const keys: Array<{ value: string; index: number }> = [];
  const diskRegex = /^(\s*)['"]([A-Za-z0-9_.-]+)['"]\s*=>\s*\[/gm;
  for (const match of body.matchAll(diskRegex)) {
    if (match[2] !== undefined && match.index !== undefined) {
      keys.push({
        value: match[2],
        index: openBracket + 1 + match.index + match[0].indexOf(match[2]),
      });
    }
  }

  return keys;
}

function scanMigrationTableBlocks(text: string): Array<{ name: string; index: number; body: string; bodyOffset: number }> {
  const tables: Array<{ name: string; index: number; body: string; bodyOffset: number }> = [];
  const regex = /Schema::(?:create|table)\(\s*['"]([A-Za-z0-9_]+)['"]\s*,\s*function\s*\([^)]*\)\s*\{/g;

  for (const match of text.matchAll(regex)) {
    if (match[1] === undefined || match.index === undefined) {
      continue;
    }
    const openBrace = match.index + match[0].length - 1;
    const closeBrace = findMatchingBrace(text, openBrace, text.length);
    if (closeBrace < 0) {
      continue;
    }

    tables.push({
      name: match[1],
      index: match.index + match[0].indexOf(match[1]),
      body: text.slice(openBrace + 1, closeBrace),
      bodyOffset: openBrace + 1,
    });
  }

  return tables;
}

function scanMigrationColumns(body: string, bodyOffset: number): Array<{ name: string; index: number; type: string }> {
  const columns: Array<{ name: string; index: number; type: string }> = [];
  const columnMethods =
    "bigInteger|binary|boolean|char|date|dateTime|dateTimeTz|decimal|double|enum|float|foreignId|integer|ipAddress|json|jsonb|longText|macAddress|mediumInteger|mediumText|morphs|nullableMorphs|rememberToken|set|smallInteger|string|text|time|timeTz|timestamp|timestampTz|tinyInteger|ulid|uuid|year";
  const namedColumnRegex = new RegExp(`\\$table->(?:${columnMethods})\\(\\s*['"]([A-Za-z0-9_]+)['"]`, "g");

  for (const match of body.matchAll(namedColumnRegex)) {
    if (match[1] === undefined || match.index === undefined) {
      continue;
    }
    const methodCall = match[0];
    const methodName = /\$table->([A-Za-z_][A-Za-z0-9_]*)/.exec(methodCall)?.[1];
    const baseIndex = bodyOffset + match.index + methodCall.lastIndexOf(match[1]);

    if (methodName === "morphs" || methodName === "nullableMorphs") {
      columns.push({ name: `${match[1]}_id`, index: baseIndex, type: "unsignedBigInteger" });
      columns.push({ name: `${match[1]}_type`, index: baseIndex, type: "string" });
      continue;
    }

    columns.push({ name: match[1], index: baseIndex, type: methodName ?? "column" });
  }

  for (const match of body.matchAll(/\$table->id\(\s*\)/g)) {
    if (match.index !== undefined) {
      columns.push({ name: "id", index: bodyOffset + match.index, type: "id" });
    }
  }

  for (const match of body.matchAll(/\$table->timestamps\(\s*\)/g)) {
    if (match.index !== undefined) {
      columns.push({ name: "created_at", index: bodyOffset + match.index, type: "timestamp" });
      columns.push({ name: "updated_at", index: bodyOffset + match.index, type: "timestamp" });
    }
  }

  for (const match of body.matchAll(/\$table->softDeletes\(\s*\)/g)) {
    if (match.index !== undefined) {
      columns.push({ name: "deleted_at", index: bodyOffset + match.index, type: "timestamp" });
    }
  }

  for (const match of body.matchAll(/\$table->rememberToken\(\s*\)/g)) {
    if (match.index !== undefined) {
      columns.push({ name: "remember_token", index: bodyOffset + match.index, type: "string" });
    }
  }

  return columns;
}

function scanPhpClassInfo(file: string, text: string): PhpClassInfo | undefined {
  const namespace = /namespace\s+([^;]+);/.exec(text)?.[1];
  const classMatch = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+extends\s+([A-Za-z_\\][A-Za-z0-9_\\]*))?/.exec(text);
  const className = classMatch?.[1];
  if (!namespace || !className || classMatch.index === undefined) {
    return undefined;
  }

  const uses = scanUseStatements(text);
  return {
    file,
    text,
    namespace,
    className,
    classIndex: classMatch.index,
    classNameIndex: classMatch.index + classMatch[0].indexOf(className),
    fqn: `${namespace}\\${className}`,
    extendsClass: classMatch[2] ? resolveExtendsClass(classMatch[2], namespace, uses) : undefined,
    uses,
  };
}

function isEloquentClassInfo(
  classInfo: PhpClassInfo,
  projectRoot: string,
  classesByName: Map<string, PhpClassInfo>,
  cache: Map<string, boolean>,
): boolean {
  const cached = cache.get(classInfo.fqn);
  if (cached !== undefined) {
    return cached;
  }

  const modelsRoot = path.join(projectRoot, "app", "Models");
  if (classInfo.file.startsWith(modelsRoot + path.sep)) {
    cache.set(classInfo.fqn, true);
    return true;
  }

  if (!classInfo.extendsClass) {
    cache.set(classInfo.fqn, false);
    return false;
  }

  if (isKnownEloquentBaseClass(classInfo.extendsClass)) {
    cache.set(classInfo.fqn, true);
    return true;
  }

  const parent = classesByName.get(classInfo.extendsClass);
  const inheritsFromEloquent = parent ? isEloquentClassInfo(parent, projectRoot, classesByName, cache) : false;
  cache.set(classInfo.fqn, inheritsFromEloquent);
  return inheritsFromEloquent;
}

function isKnownEloquentBaseClass(className: string): boolean {
  return (
    className === "Illuminate\\Database\\Eloquent\\Model" ||
    className === "Illuminate\\Foundation\\Auth\\User" ||
    className === "Illuminate\\Foundation\\Auth\\Authenticatable"
  );
}

async function scanEloquentFactoryStates(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const factoryFiles = await walkFiles(path.join(projectRoot, "database", "factories"), (file) => file.endsWith(".php"));
  const states: IndexedItem[] = [];

  for (const file of factoryFiles) {
    const text = await readTextFile(file);
    if (!text || !/\bclass\s+[A-Za-z_][A-Za-z0-9_]*Factory\s+extends\s+Factory\b/.test(text)) {
      continue;
    }

    const uses = scanUseStatements(text);
    const modelClass = factoryModelClass(text, file, uses);
    if (!modelClass) {
      continue;
    }

    const methodRegex = /\bpublic\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    for (const match of text.matchAll(methodRegex)) {
      if (match[1] === undefined || match.index === undefined || isIgnoredFactoryMethod(match[1])) {
        continue;
      }

      states.push({
        ...createItem("eloquent-factory-state", match[1], file, text, match.index + match[0].indexOf(match[1])),
        detail: `${modelClass} factory state`,
        modelClass,
        method: match[1],
      });
    }
  }

  logger.debug("[LaravelIndex.scanEloquentFactoryStates] completed", {
    files: factoryFiles.length,
    items: states.length,
  });

  return states;
}

function factoryModelClass(text: string, file: string, uses: Map<string, string>): string | undefined {
  const propertyModel = /\bprotected\s+\$model\s*=\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*;/.exec(text)?.[1];
  if (propertyModel) {
    if (propertyModel.includes("\\")) {
      return propertyModel;
    }
    return uses.get(propertyModel) ?? `App\\Models\\${propertyModel}`;
  }

  const factoryClass = path.basename(file, ".php");
  if (!factoryClass.endsWith("Factory")) {
    return undefined;
  }

  return `App\\Models\\${factoryClass.slice(0, -"Factory".length)}`;
}

function isIgnoredFactoryMethod(method: string): boolean {
  return method === "definition" || method === "configure";
}

function scanEloquentRelations(
  text: string,
  file: string,
  modelClass: string,
  namespace: string,
  uses: Map<string, string>,
): IndexedItem[] {
  const relations: IndexedItem[] = [];
  const methodRegex = /\bpublic\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/g;
  const relationCallRegex =
    /\$this->(hasOne|hasMany|hasOneThrough|hasManyThrough|belongsTo|belongsToMany|morphOne|morphMany|morphTo|morphToMany|morphedByMany)\s*\(\s*(?:\\?([A-Za-z_][A-Za-z0-9_\\]*)::class)?/;

  for (const match of text.matchAll(methodRegex)) {
    if (match[1] === undefined || match.index === undefined) {
      continue;
    }
    const openBrace = match.index + match[0].length - 1;
    const closeBrace = findMatchingBrace(text, openBrace, text.length);
    if (closeBrace < 0) {
      continue;
    }
    const methodBody = text.slice(openBrace + 1, closeBrace);
    const relationCall = relationCallRegex.exec(methodBody);
    if (!relationCall?.[1]) {
      continue;
    }
    const relatedModelClass = relationCall[2] ? resolveModelClass(relationCall[2], namespace, uses) : undefined;

    relations.push({
      ...createItem("eloquent-relation", match[1], file, text, match.index + match[0].indexOf(match[1])),
      detail: `${modelClass} ${relationCall[1]} relation`,
      modelClass,
      relatedModelClass,
      method: match[1],
    });
  }

  return relations;
}

function scanPackageEloquentRelations(
  text: string,
  file: string,
  modelClass: string,
  composerPackages: Set<string>,
): IndexedItem[] {
  const relations: IndexedItem[] = [];

  if (composerPackages.has("laravel/sanctum") && /\buse\s+(?:\\?Laravel\\Sanctum\\)?HasApiTokens\s*;/.test(text)) {
    const match = /\buse\s+(?:\\?Laravel\\Sanctum\\)?HasApiTokens\s*;/.exec(text);
    relations.push({
      ...createItem("eloquent-relation", "tokens", file, text, match?.index ?? 0),
      detail: `${modelClass} Laravel Sanctum tokens relation`,
      modelClass,
      relatedModelClass: "Laravel\\Sanctum\\PersonalAccessToken",
      method: "tokens",
    });
  }

  return relations;
}

function scanEloquentScopes(text: string, file: string, modelClass: string): IndexedItem[] {
  const scopes: IndexedItem[] = [];
  const scopeRegex = /\bpublic\s+function\s+scope([A-Z][A-Za-z0-9_]*)\s*\(/g;

  for (const match of text.matchAll(scopeRegex)) {
    if (match[1] === undefined || match.index === undefined) {
      continue;
    }

    const scopeName = match[1].charAt(0).toLowerCase() + match[1].slice(1);
    scopes.push({
      ...createItem("eloquent-scope", scopeName, file, text, match.index + match[0].indexOf(match[1])),
      detail: `${modelClass} scope`,
      modelClass,
      method: `scope${match[1]}`,
    });
  }

  return scopes;
}

function scanEloquentCastFields(text: string, file: string, modelClass: string): IndexedItem[] {
  const fields: IndexedItem[] = [];

  for (const block of scanEloquentCastBlocks(text)) {
    const keys = scanPhpArrayKeys(block.body, block.offset);
    for (const key of keys) {
      fields.push({
        ...createItem("eloquent-field", key.value, file, text, key.index),
        detail: `${modelClass} cast attribute`,
        modelClass,
      });
    }
  }

  return fields;
}

function scanEloquentCastBlocks(text: string): Array<{ body: string; offset: number }> {
  const blocks: Array<{ body: string; offset: number }> = [];
  const propertyRegex = /\bprotected\s+\$casts\s*=\s*\[/g;

  for (const match of text.matchAll(propertyRegex)) {
    if (match.index === undefined) {
      continue;
    }
    const openBracket = text.indexOf("[", match.index);
    const closeBracket = findMatchingSquareBracket(text, openBracket, text.length);
    if (openBracket < 0 || closeBracket < 0) {
      continue;
    }
    blocks.push({
      body: text.slice(openBracket + 1, closeBracket),
      offset: openBracket + 1,
    });
  }

  const methodRegex = /\b(?:protected|public)\s+function\s+casts\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/g;
  for (const match of text.matchAll(methodRegex)) {
    if (match.index === undefined) {
      continue;
    }
    const openBrace = match.index + match[0].length - 1;
    const closeBrace = findMatchingBrace(text, openBrace, text.length);
    if (closeBrace < 0) {
      continue;
    }
    const body = text.slice(openBrace + 1, closeBrace);
    const returnMatch = /return\s*\[/.exec(body);
    if (returnMatch?.index === undefined) {
      continue;
    }
    const openBracket = openBrace + 1 + body.indexOf("[", returnMatch.index);
    const closeBracket = findMatchingSquareBracket(text, openBracket, closeBrace);
    if (openBracket < 0 || closeBracket < 0) {
      continue;
    }
    blocks.push({
      body: text.slice(openBracket + 1, closeBracket),
      offset: openBracket + 1,
    });
  }

  return blocks;
}

function scanPhpArrayKeys(text: string, offset: number): Array<{ value: string; index: number }> {
  const keys: Array<{ value: string; index: number }> = [];
  const keyRegex = /['"]([A-Za-z0-9_.-]+)['"]\s*=>/g;

  for (const match of text.matchAll(keyRegex)) {
    if (match[1] === undefined || match.index === undefined) {
      continue;
    }
    keys.push({
      value: match[1],
      index: offset + match.index + match[0].indexOf(match[1]),
    });
  }

  return keys;
}

function resolveModelClass(className: string, namespace: string, uses: Map<string, string>): string {
  const normalized = className.replace(/^\\/, "");
  if (normalized.includes("\\")) {
    return normalized;
  }
  return uses.get(normalized) ?? `${namespace}\\${normalized}`;
}

function resolveExtendsClass(className: string, namespace: string, uses: Map<string, string>): string {
  const normalized = className.replace(/^\\/, "");
  if (normalized.includes("\\")) {
    return normalized;
  }
  const imported = uses.get(normalized);
  if (imported) {
    return imported;
  }
  if (normalized === "Model") {
    return "Illuminate\\Database\\Eloquent\\Model";
  }
  if (normalized === "Authenticatable") {
    return "Illuminate\\Foundation\\Auth\\Authenticatable";
  }
  return `${namespace}\\${normalized}`;
}

function explicitModelTable(text: string): string | undefined {
  return /protected\s+\$table\s*=\s*['"]([A-Za-z0-9_]+)['"]\s*;/.exec(text)?.[1];
}

function inferTableName(className: string): string {
  const snake = className.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  if (snake.endsWith("y")) {
    return `${snake.slice(0, -1)}ies`;
  }
  if (snake.endsWith("s")) {
    return snake;
  }
  return `${snake}s`;
}

function findMatchingSquareBracket(text: string, openBracket: number, end: number): number {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;

  for (let index = openBracket; index < end; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function scanUseStatements(text: string): Map<string, string> {
  const uses = new Map<string, string>();
  for (const match of text.matchAll(/^use\s+([^;]+);/gm)) {
    const fqcn = match[1]?.trim();
    if (!fqcn) {
      continue;
    }
    const aliasMatch = /\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/i.exec(fqcn);
    const className = aliasMatch?.[1] ?? fqcn.split("\\").pop();
    if (className) {
      uses.set(className, fqcn.replace(/\s+as\s+[A-Za-z_][A-Za-z0-9_]*$/i, ""));
    }
  }
  return uses;
}

function scanRouteControllerGroups(
  text: string,
  uses: Map<string, string>,
  file: string,
): RouteControllerScope[] {
  const groups: RouteControllerScope[] = [];
  collectRouteControllerGroups(text, uses, file, 0, text.length, undefined, groups);
  return groups;
}

function collectRouteControllerGroups(
  text: string,
  uses: Map<string, string>,
  file: string,
  start: number,
  end: number,
  inheritedController: string | undefined,
  groups: RouteControllerScope[],
): void {
  let cursor = start;

  while (cursor < end) {
    const group = findNextRouteGroup(text, cursor, end);
    if (!group) {
      return;
    }

    const controller = extractControllerClass(text.slice(group.callStart, group.bodyStart), uses) ?? inheritedController;
    if (controller) {
      groups.push({
        file,
        controllerClass: controller,
        bodyStart: group.bodyStart,
        bodyEnd: group.bodyEnd,
      });
    }

    collectRouteControllerGroups(text, uses, file, group.bodyStart, group.bodyEnd, controller, groups);
    cursor = group.bodyEnd + 1;
  }
}

function findNextRouteGroup(
  text: string,
  start: number,
  end: number,
): { callStart: number; bodyStart: number; bodyEnd: number } | undefined {
  const routeGroupIndex = boundedIndexOf(text, "Route::group", start, end);
  const chainedGroupIndex = boundedIndexOf(text, "->group", start, end);
  const candidates = [routeGroupIndex, chainedGroupIndex].filter((index) => index >= 0);
  if (candidates.length === 0) {
    return undefined;
  }

  const groupIndex = Math.min(...candidates);
  const callStart = groupIndex === chainedGroupIndex ? Math.max(text.lastIndexOf("Route::", groupIndex), start) : groupIndex;
  const body = findFunctionBody(text, groupIndex, end);
  if (!body || callStart < start) {
    return findNextRouteGroup(text, groupIndex + 1, end);
  }

  return {
    callStart,
    bodyStart: body.start,
    bodyEnd: body.end,
  };
}

function boundedIndexOf(text: string, search: string, start: number, end: number): number {
  const index = text.indexOf(search, start);
  return index >= 0 && index < end ? index : -1;
}

function findFunctionBody(text: string, start: number, end: number): { start: number; end: number } | undefined {
  const functionIndex = boundedIndexOf(text, "function", start, end);
  if (functionIndex < 0) {
    return undefined;
  }

  const openBrace = boundedIndexOf(text, "{", functionIndex, end);
  if (openBrace < 0) {
    return undefined;
  }

  const closeBrace = findMatchingBrace(text, openBrace, end);
  if (closeBrace < 0) {
    return undefined;
  }

  return {
    start: openBrace + 1,
    end: closeBrace,
  };
}

function findMatchingBrace(text: string, openBrace: number, end: number): number {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;

  for (let index = openBrace; index < end; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractControllerClass(callText: string, uses: Map<string, string>): string | undefined {
  const arrayController = /['"]controller['"]\s*=>\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class/.exec(callText)?.[1];
  const chainedController = /->controller\(\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*\)/.exec(callText)?.[1];
  const controller = arrayController ?? chainedController;
  return controller ? resolveControllerClass(controller, uses) : undefined;
}

function resolveControllerClass(controller: string, uses: Map<string, string>): string {
  if (controller.includes("\\")) {
    return controller;
  }
  return uses.get(controller) ?? controller;
}

function scanStringRouteActions(body: string): Array<{ method: string; index: number }> {
  const actions: Array<{ method: string; index: number }> = [];
  const regex =
    /Route::(?:get|post|put|patch|delete|options|any|match)\s*\(\s*(?:\[[^\]]+\]\s*,\s*)?['"][^'"]*['"]\s*,\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g;

  for (const match of body.matchAll(regex)) {
    if (match[1] !== undefined && match.index !== undefined) {
      actions.push({ method: match[1], index: match.index + match[0].lastIndexOf(match[1]) });
    }
  }

  return actions;
}

function scanArrayRouteActions(
  text: string,
  uses: Map<string, string>,
): Array<{ controllerClass: string; method: string; index: number }> {
  const actions: Array<{ controllerClass: string; method: string; index: number }> = [];
  const regex =
    /Route::(?:get|post|put|patch|delete|options|any|match)\s*\(\s*(?:\[[^\]]+\]\s*,\s*)?['"][^'"]*['"]\s*,\s*\[\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*,\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g;

  for (const match of text.matchAll(regex)) {
    if (match[1] !== undefined && match[2] !== undefined && match.index !== undefined) {
      actions.push({
        controllerClass: resolveControllerClass(match[1], uses),
        method: match[2],
        index: match.index + match[0].lastIndexOf(match[2]),
      });
    }
  }

  return actions;
}

function scanControllerStringRouteActions(
  text: string,
  uses: Map<string, string>,
): Array<{ controllerClass: string; method: string; index: number }> {
  const actions: Array<{ controllerClass: string; method: string; index: number }> = [];
  const regex =
    /Route::(?:get|post|put|patch|delete|options|any|match)\s*\(\s*(?:\[[^\]]+\]\s*,\s*)?['"][^'"]*['"]\s*,\s*['"]\\?([A-Za-z_][A-Za-z0-9_\\]*)@([A-Za-z_][A-Za-z0-9_]*)['"]/g;

  for (const match of text.matchAll(regex)) {
    if (match[1] !== undefined && match[2] !== undefined && match.index !== undefined) {
      actions.push({
        controllerClass: resolveControllerClass(match[1], uses),
        method: match[2],
        index: match.index + match[0].lastIndexOf(match[2]),
      });
    }
  }

  return actions;
}

function scanInvokableRouteActions(
  text: string,
  uses: Map<string, string>,
): Array<{ controllerClass: string; index: number }> {
  const actions: Array<{ controllerClass: string; index: number }> = [];
  const regex =
    /Route::(?:get|post|put|patch|delete|options|any|match)\s*\(\s*(?:\[[^\]]+\]\s*,\s*)?['"][^'"]*['"]\s*,\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*\)/g;

  for (const match of text.matchAll(regex)) {
    if (match[1] !== undefined && match.index !== undefined) {
      actions.push({
        controllerClass: resolveControllerClass(match[1], uses),
        index: match.index + match[0].lastIndexOf(match[1]),
      });
    }
  }

  return actions;
}

function createRouteActionItem(
  method: string,
  controllerClass: string,
  routeFile: string,
  routeText: string,
  actionOffset: number,
  methodsByKey: Map<string, IndexedItem>,
): IndexedItem {
  const methodKey = `${controllerClass}::${method}`;
  const controllerMethod = methodsByKey.get(methodKey);
  const routeSource = offsetToSourceLocation(routeFile, routeText, actionOffset);

  if (!controllerMethod) {
    return {
      ...createItem("route-action", method, routeFile, routeText, actionOffset),
      detail: methodKey,
      routeSource,
      controllerClass,
      method,
    };
  }

  return {
    ...controllerMethod,
    key: method,
    label: method,
    kind: "route-action",
    detail: methodKey,
    routeSource,
    controllerClass,
    method,
  };
}

function findNearestControllerGroup(
  groups: RouteControllerScope[],
  file: string,
  actionOffset: number,
): RouteControllerScope | undefined {
  return groups
    .filter((group) => group.file === file && actionOffset >= group.bodyStart && actionOffset <= group.bodyEnd)
    .sort((a, b) => b.bodyStart - a.bodyStart)[0];
}

function scanValidationFieldKeys(text: string): Array<{ value: string; index: number }> {
  const matches: Array<{ value: string; index: number }> = [];
  const validationRuleStart =
    "(?:required|nullable|sometimes|string|email|integer|numeric|array|boolean|date|confirmed|unique|exists|min|max|size|in|url|uuid|ulid)";
  const stringRuleRegex = new RegExp(`['"]([A-Za-z0-9_.-]+)['"]\\s*=>\\s*['"][^'"]*${validationRuleStart}`, "g");
  const arrayRuleRegex = new RegExp(`['"]([A-Za-z0-9_.-]+)['"]\\s*=>\\s*\\[\\s*['"]${validationRuleStart}`, "g");

  for (const regex of [stringRuleRegex, arrayRuleRegex]) {
    for (const match of text.matchAll(regex)) {
      if (match[1] !== undefined && match.index !== undefined) {
        matches.push({ value: match[1], index: match.index });
      }
    }
  }

  return matches;
}

function scanRouteMiddlewareAliases(text: string): Array<{ key: string; index: number; middlewareClass?: string }> {
  const aliases: Array<{ key: string; index: number; middlewareClass?: string }> = [];

  for (const block of scanRouteMiddlewareAliasBlocks(text)) {
    const aliasRegex = /['"]([A-Za-z0-9_.-]+)['"]\s*=>\s*(?:\\?([A-Za-z_][A-Za-z0-9_\\]*)::class)?/g;
    for (const match of block.body.matchAll(aliasRegex)) {
      if (match[1] === undefined || match.index === undefined) {
        continue;
      }
      aliases.push({
        key: match[1],
        index: block.offset + match.index + match[0].indexOf(match[1]),
        middlewareClass: match[2],
      });
    }
  }

  return aliases;
}

function scanRouteMiddlewareAliasBlocks(text: string): Array<{ body: string; offset: number }> {
  const blocks: Array<{ body: string; offset: number }> = [];
  const propertyRegex = /\bprotected\s+\$(?:routeMiddleware|middlewareAliases)\s*=\s*\[/g;

  for (const match of text.matchAll(propertyRegex)) {
    if (match.index === undefined) {
      continue;
    }
    const openBracket = text.indexOf("[", match.index);
    const closeBracket = findMatchingSquareBracket(text, openBracket, text.length);
    if (openBracket < 0 || closeBracket < 0) {
      continue;
    }
    blocks.push({
      body: text.slice(openBracket + 1, closeBracket),
      offset: openBracket + 1,
    });
  }

  const aliasRegex = /->alias\(\s*\[/g;
  for (const match of text.matchAll(aliasRegex)) {
    if (match.index === undefined) {
      continue;
    }
    const openBracket = text.indexOf("[", match.index);
    const closeBracket = findMatchingSquareBracket(text, openBracket, text.length);
    if (openBracket < 0 || closeBracket < 0) {
      continue;
    }
    blocks.push({
      body: text.slice(openBracket + 1, closeBracket),
      offset: openBracket + 1,
    });
  }

  return blocks;
}

function scanRouteMiddlewareReferences(text: string): Array<{ key: string; index: number }> {
  const references: Array<{ key: string; index: number }> = [];
  const middlewareCallRegex = /(?:Route::|->|\$this->)middleware\s*\(([\s\S]*?)\)/g;

  for (const match of text.matchAll(middlewareCallRegex)) {
    if (match[1] === undefined || match.index === undefined) {
      continue;
    }

    const argsOffset = match.index + match[0].indexOf(match[1]);
    const stringRegex = /['"]([A-Za-z0-9_.:-]+)['"]/g;
    for (const stringMatch of match[1].matchAll(stringRegex)) {
      if (stringMatch[1] === undefined || stringMatch.index === undefined) {
        continue;
      }
      const key = middlewareNameFromReference(stringMatch[1]);
      references.push({
        key,
        index: argsOffset + stringMatch.index + stringMatch[0].indexOf(stringMatch[1]),
      });
    }
  }

  return references;
}

async function scanRouteFilePrefixes(projectRoot: string, logger: Logger): Promise<Map<string, string>> {
  const prefixes = new Map<string, string>();
  const providerFiles = await walkFiles(path.join(projectRoot, "app", "Providers"), (file) => file.endsWith(".php"));

  for (const file of providerFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }
    for (const routeFilePrefix of scanRouteFilePrefixReferences(text)) {
      prefixes.set(path.join(projectRoot, "routes", routeFilePrefix.file), routeFilePrefix.prefix);
    }
  }

  const bootstrapText = await readTextFile(path.join(projectRoot, "bootstrap", "app.php"));
  if (bootstrapText) {
    for (const routeFilePrefix of scanBootstrapRouteFilePrefixes(bootstrapText)) {
      prefixes.set(path.join(projectRoot, "routes", routeFilePrefix.file), routeFilePrefix.prefix);
    }
  }

  logger.debug("[LaravelIndex.scanRouteFilePrefixes] completed", {
    providerFiles: providerFiles.length,
    items: prefixes.size,
  });

  return prefixes;
}

function scanRouteFilePrefixReferences(text: string): Array<{ file: string; prefix: string }> {
  const references: Array<{ file: string; prefix: string }> = [];
  for (const statement of routeGroupStatements(text)) {
    const file = routeFileFromGroupStatement(statement);
    if (!file) {
      continue;
    }

    references.push({
      file,
      prefix: extractRoutePrefix(statement) ?? "",
    });
  }
  return references;
}

function routeGroupStatements(text: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === ";") {
      const statement = text.slice(start, index + 1);
      if (statement.includes("->group") || statement.includes("Route::group")) {
        statements.push(statement);
      }
      start = index + 1;
    }
  }
  return statements;
}

function routeFileFromGroupStatement(statement: string): string | undefined {
  return (
    /base_path\(\s*['"]routes\/([^'"]+\.php)['"]\s*\)/.exec(statement)?.[1] ??
    /routes_path\(\s*['"]([^'"]+\.php)['"]\s*\)/.exec(statement)?.[1] ??
    /__DIR__\s*\.\s*['"]\/\.\.\/routes\/([^'"]+\.php)['"]/.exec(statement)?.[1]
  );
}

function scanBootstrapRouteFilePrefixes(text: string): Array<{ file: string; prefix: string }> {
  const references: Array<{ file: string; prefix: string }> = [];
  const withRouting = /->withRouting\(([\s\S]*?)\)\s*;/.exec(text)?.[1];
  if (!withRouting) {
    return references;
  }

  const apiFile =
    /\bapi\s*:\s*__DIR__\s*\.\s*['"]\/\.\.\/routes\/([^'"]+\.php)['"]/.exec(withRouting)?.[1] ??
    /\bapi\s*:\s*base_path\(\s*['"]routes\/([^'"]+\.php)['"]\s*\)/.exec(withRouting)?.[1];
  if (apiFile) {
    references.push({
      file: apiFile,
      prefix: /\bapiPrefix\s*:\s*['"]([^'"]+)['"]/.exec(withRouting)?.[1] ?? "api",
    });
  }

  const webFile =
    /\bweb\s*:\s*__DIR__\s*\.\s*['"]\/\.\.\/routes\/([^'"]+\.php)['"]/.exec(withRouting)?.[1] ??
    /\bweb\s*:\s*base_path\(\s*['"]routes\/([^'"]+\.php)['"]\s*\)/.exec(withRouting)?.[1];
  if (webFile) {
    references.push({ file: webFile, prefix: "" });
  }

  return references;
}

function scanHttpRouteDeclarations(text: string, filePrefix = ""): Array<{ method: string; uri: string; uriIndex: number; routeName?: string }> {
  const routes: Array<{ method: string; uri: string; uriIndex: number; routeName?: string }> = [];
  const prefixScopes = scanRoutePrefixScopes(text, filePrefix);
  const directRouteRegex = /Route::(get|post|put|patch|delete|options|any)\(\s*(['"])([^'"]+)\2/g;

  for (const match of text.matchAll(directRouteRegex)) {
    if (match.index === undefined || !match[1] || !match[3]) {
      continue;
    }

    const statement = routeStatementAfter(text, match.index);
    const uriIndex = match.index + match[0].lastIndexOf(match[3]);
    routes.push({
      method: match[1].toUpperCase(),
      uri: joinRouteUri(nearestRoutePrefix(prefixScopes, uriIndex) || filePrefix, match[3]),
      uriIndex,
      routeName: routeNameFromStatement(statement),
    });
  }

  const matchRouteRegex = /Route::match\(\s*\[([^\]]+)\]\s*,\s*(['"])([^'"]+)\2/g;
  for (const match of text.matchAll(matchRouteRegex)) {
    if (match.index === undefined || !match[1] || !match[3]) {
      continue;
    }

    const statement = routeStatementAfter(text, match.index);
    const uriIndex = match.index + match[0].lastIndexOf(match[3]);
    const methods = [...match[1].matchAll(/['"]([A-Za-z]+)['"]/g)].map((methodMatch) => methodMatch[1]?.toUpperCase()).filter(Boolean);
    for (const method of methods) {
      routes.push({
        method,
        uri: joinRouteUri(nearestRoutePrefix(prefixScopes, uriIndex) || filePrefix, match[3]),
        uriIndex,
        routeName: routeNameFromStatement(statement),
      });
    }
  }

  return routes;
}

function scanRoutePrefixScopes(text: string, filePrefix = ""): Array<{ bodyStart: number; bodyEnd: number; prefix: string }> {
  const scopes: Array<{ bodyStart: number; bodyEnd: number; prefix: string }> = [];
  collectRoutePrefixScopes(text, 0, text.length, filePrefix, scopes);
  return scopes;
}

function collectRoutePrefixScopes(
  text: string,
  start: number,
  end: number,
  inheritedPrefix: string,
  scopes: Array<{ bodyStart: number; bodyEnd: number; prefix: string }>,
): void {
  let cursor = start;

  while (cursor < end) {
    const group = findNextRouteGroup(text, cursor, end);
    if (!group) {
      return;
    }

    const callText = text.slice(group.callStart, group.bodyStart);
    const prefix = joinRouteUri(inheritedPrefix, extractRoutePrefix(callText) ?? "");
    if (prefix) {
      scopes.push({
        bodyStart: group.bodyStart,
        bodyEnd: group.bodyEnd,
        prefix,
      });
    }

    collectRoutePrefixScopes(text, group.bodyStart, group.bodyEnd, prefix, scopes);
    cursor = group.bodyEnd + 1;
  }
}

function extractRoutePrefix(callText: string): string | undefined {
  return (
    /['"]prefix['"]\s*=>\s*['"]([^'"]+)['"]/.exec(callText)?.[1] ??
    /(?:Route::|->)prefix\(\s*['"]([^'"]+)['"]\s*\)/.exec(callText)?.[1]
  );
}

function nearestRoutePrefix(scopes: Array<{ bodyStart: number; bodyEnd: number; prefix: string }>, offset: number): string {
  return (
    scopes
      .filter((scope) => offset >= scope.bodyStart && offset <= scope.bodyEnd)
      .sort((a, b) => b.bodyStart - a.bodyStart)[0]?.prefix ?? ""
  );
}

function joinRouteUri(prefix: string, uri: string): string {
  const parts = [prefix, uri]
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ""))
    .filter((part) => part.length > 0);
  return parts.length > 0 ? `/${parts.join("/")}` : "/";
}

function routeStatementAfter(text: string, start: number): string {
  const end = text.indexOf(";", start);
  return text.slice(start, end >= 0 ? end : undefined);
}

function routeNameFromStatement(statement: string): string | undefined {
  return /->name\(\s*['"]([^'"]+)['"]\s*\)/.exec(statement)?.[1];
}

function normalizeRouteUriForIndex(uri: string): string {
  const normalized = uri.trim().split(/[?#]/)[0]?.replace(/^\/+|\/+$/g, "") ?? "";
  return normalized ? `/${normalized}` : "/";
}

function middlewareNameFromReference(value: string): string {
  return value.split(":")[0] ?? value;
}

function scanRegex(text: string, regex: RegExp): Array<{ value: string; index: number }> {
  const matches: Array<{ value: string; index: number }> = [];
  for (const match of text.matchAll(regex)) {
    if (match[1] !== undefined && match.index !== undefined) {
      matches.push({ value: match[1], index: match.index });
    }
  }
  return matches;
}

async function readComposerPackageNames(projectRoot: string): Promise<Set<string>> {
  const text = await readTextFile(path.join(projectRoot, "composer.json"));
  if (!text) {
    return new Set();
  }

  try {
    const composer = JSON.parse(text) as { require?: Record<string, string>; "require-dev"?: Record<string, string> };
    return new Set([...Object.keys(composer.require ?? {}), ...Object.keys(composer["require-dev"] ?? {})]);
  } catch {
    return new Set();
  }
}

function createItem(kind: LaravelIndexKind, key: string, file: string, text: string, index: number): IndexedItem {
  const location = offsetToSourceLocation(file, text, index);
  return createItemFromLine(kind, key, file, location.line, location.character, undefined, location.offset);
}

function createItemFromLine(
  kind: LaravelIndexKind,
  key: string,
  file: string,
  line: number,
  character: number,
  detail?: string,
  offset?: number,
): IndexedItem {
  return {
    key,
    label: key,
    kind,
    source: { file, line, character, offset },
    detail,
  };
}

function offsetToSourceLocation(file: string, text: string, offset: number): SourceLocation {
  const before = text.slice(0, offset);
  const lines = before.split(/\r?\n/);
  return {
    file,
    line: lines.length - 1,
    character: lines[lines.length - 1]?.length ?? 0,
    offset,
  };
}

function uniqueItems(items: IndexedItem[]): IndexedItem[] {
  const seen = new Set<string>();
  const unique: IndexedItem[] = [];

  for (const item of items) {
    const key = [
      item.kind,
      item.key,
      item.modelClass ?? "",
      item.table ?? "",
      item.httpMethod ?? "",
      item.uri ?? "",
      item.source.file,
      item.routeSource?.file ?? "",
      item.routeSource?.offset ?? "",
    ].join(":");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  unique.sort((a, b) => a.key.localeCompare(b.key));
  return unique;
}
