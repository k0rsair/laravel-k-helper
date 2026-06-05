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
  livewireProperties: IndexedItem[];
  livewireActions: IndexedItem[];
  livewireEvents: IndexedItem[];
  inertiaPages: IndexedItem[];
  inertiaProps: IndexedItem[];
  filamentResources: IndexedItem[];
  filamentPages: IndexedItem[];
  filamentFields: IndexedItem[];
  filamentActions: IndexedItem[];
  novaResources: IndexedItem[];
}

export interface BladeComponentIndex {
  components: IndexedItem[];
  props: IndexedItem[];
  slots: IndexedItem[];
}

export interface ContainerBindingIndex {
  bindings: IndexedItem[];
  methods: IndexedItem[];
}

interface ResponseFieldMatch {
  path: string[];
  index: number;
  source?: SourceLocation;
  responseSourceKind?: string;
  responseSourceClass?: string;
}

interface ResponseFieldScanContext {
  modelVariables: Map<string, string>;
  fieldsByModel: Map<string, IndexedItem[]>;
  namespace?: string;
  uses?: Map<string, string>;
  sourceFile?: string;
  resourceFieldResolver?: (className: string) => ResponseFieldMatch[] | undefined;
}

interface RawResponseResourceDefinition {
  className: string;
  file: string;
  text: string;
  namespace: string;
  uses: Map<string, string>;
  kind: "json-resource" | "resource-collection" | "anonymous-resource-collection";
  toArrayBody?: string;
  toArrayBodyOffset?: number;
  collectsResourceClass?: string;
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

interface RawContainerBinding {
  abstractClass: string;
  concreteClass: string;
  bindingKind: string;
  file: string;
  text: string;
  index: number;
}

const LARAVEL_CORE_CONTAINER_ALIASES: Record<string, string[]> = {
  "Illuminate\\Foundation\\Application": [
    "Illuminate\\Foundation\\Application",
    "Illuminate\\Contracts\\Container\\Container",
    "Illuminate\\Contracts\\Foundation\\Application",
    "Psr\\Container\\ContainerInterface",
  ],
  "Illuminate\\Auth\\AuthManager": ["Illuminate\\Auth\\AuthManager", "Illuminate\\Contracts\\Auth\\Factory"],
  "Illuminate\\Auth\\Passwords\\PasswordBrokerManager": [
    "Illuminate\\Auth\\Passwords\\PasswordBrokerManager",
    "Illuminate\\Contracts\\Auth\\PasswordBrokerFactory",
  ],
  "Illuminate\\Auth\\Passwords\\PasswordBroker": [
    "Illuminate\\Auth\\Passwords\\PasswordBroker",
    "Illuminate\\Contracts\\Auth\\PasswordBroker",
  ],
  "Illuminate\\Cache\\CacheManager": ["Illuminate\\Cache\\CacheManager", "Illuminate\\Contracts\\Cache\\Factory"],
  "Illuminate\\Cache\\Repository": [
    "Illuminate\\Cache\\Repository",
    "Illuminate\\Contracts\\Cache\\Repository",
    "Psr\\SimpleCache\\CacheInterface",
  ],
  "Illuminate\\Config\\Repository": ["Illuminate\\Config\\Repository", "Illuminate\\Contracts\\Config\\Repository"],
  "Illuminate\\Cookie\\CookieJar": [
    "Illuminate\\Cookie\\CookieJar",
    "Illuminate\\Contracts\\Cookie\\Factory",
    "Illuminate\\Contracts\\Cookie\\QueueingFactory",
  ],
  "Illuminate\\Database\\DatabaseManager": [
    "Illuminate\\Database\\DatabaseManager",
    "Illuminate\\Database\\ConnectionResolverInterface",
  ],
  "Illuminate\\Database\\Connection": ["Illuminate\\Database\\Connection", "Illuminate\\Database\\ConnectionInterface"],
  "Illuminate\\Encryption\\Encrypter": [
    "Illuminate\\Encryption\\Encrypter",
    "Illuminate\\Contracts\\Encryption\\Encrypter",
    "Illuminate\\Contracts\\Encryption\\StringEncrypter",
  ],
  "Illuminate\\Events\\Dispatcher": ["Illuminate\\Events\\Dispatcher", "Illuminate\\Contracts\\Events\\Dispatcher"],
  "Illuminate\\Filesystem\\FilesystemManager": [
    "Illuminate\\Filesystem\\FilesystemManager",
    "Illuminate\\Contracts\\Filesystem\\Factory",
  ],
  "Illuminate\\Contracts\\Filesystem\\Filesystem": ["Illuminate\\Contracts\\Filesystem\\Filesystem"],
  "Illuminate\\Contracts\\Filesystem\\Cloud": ["Illuminate\\Contracts\\Filesystem\\Cloud"],
  "Illuminate\\Contracts\\Hashing\\Hasher": ["Illuminate\\Contracts\\Hashing\\Hasher"],
  "Illuminate\\Log\\LogManager": ["Illuminate\\Log\\LogManager", "Psr\\Log\\LoggerInterface"],
  "Illuminate\\Mail\\MailManager": ["Illuminate\\Mail\\MailManager", "Illuminate\\Contracts\\Mail\\Factory"],
  "Illuminate\\Mail\\Mailer": [
    "Illuminate\\Mail\\Mailer",
    "Illuminate\\Contracts\\Mail\\Mailer",
    "Illuminate\\Contracts\\Mail\\MailQueue",
  ],
  "Illuminate\\Queue\\QueueManager": [
    "Illuminate\\Queue\\QueueManager",
    "Illuminate\\Contracts\\Queue\\Factory",
    "Illuminate\\Contracts\\Queue\\Monitor",
  ],
  "Illuminate\\Contracts\\Queue\\Queue": ["Illuminate\\Contracts\\Queue\\Queue"],
  "Illuminate\\Redis\\RedisManager": ["Illuminate\\Redis\\RedisManager", "Illuminate\\Contracts\\Redis\\Factory"],
  "Illuminate\\Redis\\Connections\\Connection": [
    "Illuminate\\Redis\\Connections\\Connection",
    "Illuminate\\Contracts\\Redis\\Connection",
  ],
  "Illuminate\\Http\\Request": ["Illuminate\\Http\\Request", "Symfony\\Component\\HttpFoundation\\Request"],
  "Illuminate\\Routing\\Router": [
    "Illuminate\\Routing\\Router",
    "Illuminate\\Contracts\\Routing\\Registrar",
    "Illuminate\\Contracts\\Routing\\BindingRegistrar",
  ],
  "Illuminate\\Session\\Store": ["Illuminate\\Session\\Store", "Illuminate\\Contracts\\Session\\Session"],
  "Illuminate\\Translation\\Translator": [
    "Illuminate\\Translation\\Translator",
    "Illuminate\\Contracts\\Translation\\Translator",
  ],
  "Illuminate\\Routing\\UrlGenerator": [
    "Illuminate\\Routing\\UrlGenerator",
    "Illuminate\\Contracts\\Routing\\UrlGenerator",
  ],
  "Illuminate\\Validation\\Factory": ["Illuminate\\Validation\\Factory", "Illuminate\\Contracts\\Validation\\Factory"],
  "Illuminate\\View\\Factory": ["Illuminate\\View\\Factory", "Illuminate\\Contracts\\View\\Factory"],
};

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

export async function scanHttpRoutes(
  projectRoot: string,
  logger: Logger,
  controllerMethods: IndexedItem[] = [],
  routeControllerScopes: RouteControllerScope[] = [],
): Promise<IndexedItem[]> {
  const routesRoot = path.join(projectRoot, "routes");
  const routeFiles = await walkFiles(routesRoot, (file) => file.endsWith(".php"));
  const routeFilePrefixes = await scanRouteFilePrefixes(projectRoot, logger);
  const methodsByKey = new Map(controllerMethods.map((item) => [item.key, item]));
  const items: IndexedItem[] = [];

  for (const file of routeFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    for (const route of scanHttpRouteDeclarations(text, file, routeControllerScopes, routeFilePrefixes.get(file) ?? "")) {
      const item = createItem("http-route", normalizeRouteUriForIndex(route.uri), file, text, route.uriIndex);
      const target = route.controllerTarget
        ? methodsByKey.get(`${route.controllerTarget.controllerClass}::${route.controllerTarget.method}`)
        : undefined;
      items.push({
        ...item,
        label: `${route.method} ${route.uri}`,
        detail: route.routeName ? `${route.method} ${route.uri} (${route.routeName})` : `${route.method} ${route.uri}`,
        uri: route.uri,
        httpMethod: route.method,
        routeName: route.routeName,
        controllerClass: route.controllerTarget?.controllerClass,
        method: route.controllerTarget?.method,
        controllerSource: target?.source,
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

export async function scanResponseFields(
  projectRoot: string,
  logger: Logger,
  httpRoutes: IndexedItem[],
  controllerMethods: IndexedItem[],
  routeControllerScopes: RouteControllerScope[] = [],
  eloquentFields: IndexedItem[] = [],
  eloquentModels: IndexedItem[] = [],
): Promise<IndexedItem[]> {
  const fieldsByModel = responseFieldsByModel(eloquentFields);
  const modelClasses = new Set(eloquentModels.map((item) => item.modelClass ?? item.key));
  const resourceFieldResolver = await scanResponseResources(projectRoot, logger, fieldsByModel, modelClasses);
  const routeFields = await scanRouteClosureResponseFields(
    projectRoot,
    logger,
    httpRoutes,
    routeControllerScopes,
    fieldsByModel,
    modelClasses,
    resourceFieldResolver,
  );
  const controllerFields = await scanControllerResponseFields(
    projectRoot,
    logger,
    httpRoutes,
    controllerMethods,
    fieldsByModel,
    modelClasses,
    resourceFieldResolver,
  );
  const items = uniqueItems([...routeFields, ...controllerFields]);

  logger.debug("[LaravelIndex.scanResponseFields] completed", {
    routeFields: routeFields.length,
    controllerFields: controllerFields.length,
    items: items.length,
  });

  return items;
}

async function scanRouteClosureResponseFields(
  projectRoot: string,
  logger: Logger,
  httpRoutes: IndexedItem[],
  routeControllerScopes: RouteControllerScope[],
  fieldsByModel: Map<string, IndexedItem[]>,
  modelClasses: Set<string>,
  resourceFieldResolver: (className: string) => ResponseFieldMatch[] | undefined,
): Promise<IndexedItem[]> {
  const routesRoot = path.join(projectRoot, "routes");
  const routeFiles = await walkFiles(routesRoot, (file) => file.endsWith(".php"));
  const routeFilePrefixes = await scanRouteFilePrefixes(projectRoot, logger);
  const items: IndexedItem[] = [];
  let skippedDynamic = 0;
  let attachmentMisses = 0;

  for (const file of routeFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const uses = scanUseStatements(text);
    for (const route of scanHttpRouteDeclarations(text, file, routeControllerScopes, routeFilePrefixes.get(file) ?? "")) {
      if (route.controllerTarget) {
        continue;
      }

      const statement = routeStatementAfter(text, route.uriIndex);
      const fields = scanResponseFieldsFromStatement(text, statement, route.uriIndex, {
        fieldsByModel,
        modelVariables: modelVariablesFromRouteClosure(statement, uses, modelClasses),
        namespace: "",
        uses,
        sourceFile: file,
        resourceFieldResolver,
      });
      if (fields.length === 0) {
        skippedDynamic += 1;
        continue;
      }

      const httpRoute = httpRoutes.find((item) => item.source.file === file && item.uri === route.uri && item.httpMethod === route.method);
      if (!httpRoute) {
        attachmentMisses += 1;
        continue;
      }

      items.push(...fields.map((field) => createResponseFieldItem(field, file, text, httpRoute)));
    }
  }

  logger.debug("[LaravelIndex.scanResponseFields] route closure scan", {
    files: routeFiles.length,
    items: items.length,
    skippedDynamic,
    attachmentMisses,
  });

  return items;
}

async function scanControllerResponseFields(
  projectRoot: string,
  logger: Logger,
  httpRoutes: IndexedItem[],
  controllerMethods: IndexedItem[],
  fieldsByModel: Map<string, IndexedItem[]>,
  modelClasses: Set<string>,
  resourceFieldResolver: (className: string) => ResponseFieldMatch[] | undefined,
): Promise<IndexedItem[]> {
  const controllersRoot = path.join(projectRoot, "app", "Http", "Controllers");
  const controllerFiles = await walkFiles(controllersRoot, (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];
  let skippedDynamic = 0;
  let attachmentMisses = 0;

  for (const file of controllerFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const classInfo = scanPhpClassInfo(file, text);
    const namespace = classInfo?.namespace ?? /namespace\s+([^;]+);/.exec(text)?.[1] ?? "";
    const uses = classInfo?.uses ?? scanUseStatements(text);
    for (const methodBody of scanControllerMethodBodies(text)) {
      const controllerMethod = controllerMethods.find((item) => item.source.file === file && item.method === methodBody.method);
      if (!controllerMethod?.controllerClass) {
        attachmentMisses += 1;
        continue;
      }

      const routes = httpRoutes.filter(
        (item) => item.controllerClass === controllerMethod.controllerClass && item.method === methodBody.method,
      );
      if (routes.length === 0) {
        attachmentMisses += 1;
        continue;
      }

      const fields = scanResponseFieldsFromStatement(text, methodBody.body, methodBody.bodyOffset, {
        fieldsByModel,
        modelVariables: modelVariablesFromParams(methodBody.params, namespace, uses, modelClasses),
        namespace,
        uses,
        sourceFile: file,
        resourceFieldResolver,
      });
      if (fields.length === 0) {
        skippedDynamic += 1;
        continue;
      }

      for (const route of routes) {
        items.push(...fields.map((field) => createResponseFieldItem(field, file, text, route)));
      }
    }
  }

  logger.debug("[LaravelIndex.scanResponseFields] controller scan", {
    files: controllerFiles.length,
    items: items.length,
    skippedDynamic,
    attachmentMisses,
  });

  return items;
}

async function scanResponseResources(
  projectRoot: string,
  logger: Logger,
  fieldsByModel: Map<string, IndexedItem[]>,
  modelClasses: Set<string>,
): Promise<(className: string) => ResponseFieldMatch[] | undefined> {
  const resourcesRoot = path.join(projectRoot, "app", "Http", "Resources");
  const resourceFiles = await walkFiles(resourcesRoot, (file) => file.endsWith(".php"));
  const resourceDefinitions = new Map<string, RawResponseResourceDefinition>();
  let resourceClasses = 0;
  let resourceToArrayMethods = 0;

  for (const file of resourceFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const classInfo = scanPhpClassInfo(file, text);
    if (!classInfo?.extendsClass) {
      continue;
    }

    const resourceKind = responseResourceKind(classInfo.extendsClass);
    if (!resourceKind) {
      continue;
    }

    resourceClasses += 1;
    const toArrayMethod = scanControllerMethodBodies(text).find((method) => method.method === "toArray");
    if (toArrayMethod) {
      resourceToArrayMethods += 1;
    }

    resourceDefinitions.set(classInfo.fqn, {
      className: classInfo.fqn,
      file,
      text,
      namespace: classInfo.namespace,
      uses: classInfo.uses,
      kind: resourceKind,
      toArrayBody: toArrayMethod?.body,
      toArrayBodyOffset: toArrayMethod?.bodyOffset,
      collectsResourceClass: scanCollectedResourceClass(text, classInfo.namespace, classInfo.uses),
    });
  }

  const resolvedFields = new Map<string, ResponseFieldMatch[]>();
  const building = new Set<string>();

  const resolveResourceFields = (className: string): ResponseFieldMatch[] | undefined => {
    const normalizedClass = normalizeClassReference(className);
    if (resolvedFields.has(normalizedClass)) {
      return resolvedFields.get(normalizedClass);
    }

    const definition = resourceDefinitions.get(normalizedClass);
    if (!definition) {
      return undefined;
    }
    if (building.has(normalizedClass)) {
      logger.debug("[LaravelIndex.scanResponseResources] circular resource reference", {
        className: normalizedClass,
      });
      return [];
    }

    building.add(normalizedClass);
    let fields: ResponseFieldMatch[] = [];

    if (definition.toArrayBody && definition.toArrayBodyOffset !== undefined) {
      fields = scanResponseFieldsFromStatement(definition.text, definition.toArrayBody, definition.toArrayBodyOffset, {
        fieldsByModel,
        modelVariables: modelVariablesFromParams("", definition.namespace, definition.uses, modelClasses),
        namespace: definition.namespace,
        uses: definition.uses,
        sourceFile: definition.file,
        resourceFieldResolver: resolveResourceFields,
      }).map((field) => ({
        ...field,
        responseSourceKind: field.responseSourceKind ?? definition.kind,
        responseSourceClass: field.responseSourceClass ?? definition.className,
      }));
    } else if (definition.kind !== "json-resource") {
      logger.debug("[LaravelIndex.scanResponseResources] unsupported collection shape", {
        className: definition.className,
        kind: definition.kind,
      });
    }

    resolvedFields.set(normalizedClass, uniqueResponseFields(fields));
    building.delete(normalizedClass);
    return resolvedFields.get(normalizedClass);
  };

  logger.debug("[LaravelIndex.scanResponseResources] discovered resources", {
    files: resourceFiles.length,
    resourceClasses,
    resourceToArrayMethods,
  });

  return resolveResourceFields;
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
          nullable: column.nullable,
          defaultValue: column.defaultValue,
          enumValues: column.enumValues,
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
        detail: column.columnType
          ? `${modelClass} field (${table}, ${column.columnType}${column.nullable ? ", nullable" : ""})`
          : `${modelClass} field (${table})`,
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

export async function scanContainerBindings(projectRoot: string, logger: Logger): Promise<ContainerBindingIndex> {
  const providerFiles = await collectServiceProviderFiles(projectRoot);
  const appFiles = await walkFiles(path.join(projectRoot, "app"), (file) => file.endsWith(".php"));
  const phpClasses: PhpClassInfo[] = [];
  const rawBindings: RawContainerBinding[] = [];
  let skippedUnsupported = 0;

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

  const presetBindings = await laravelCorePresetContainerBindings(projectRoot);

  for (const file of candidateConcreteClassFiles(projectRoot, presetBindings)) {
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

  for (const file of providerFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const namespace = /namespace\s+([^;]+);/.exec(text)?.[1] ?? "App\\Providers";
    const uses = scanUseStatements(text);
    const bindings = scanSimpleContainerBindings(text, file, namespace, uses);
    rawBindings.push(...bindings);

    const unsupported = countUnsupportedContainerBindingCalls(text, bindings);
    skippedUnsupported += unsupported;
    if (unsupported > 0) {
      logger.debug("[LaravelIndex.scanContainerBindings] skipped unsupported binding calls", {
        file,
        skipped: unsupported,
      });
    }
  }

  rawBindings.push(...presetBindings);

  const bindings: IndexedItem[] = rawBindings.map((binding) => {
    const concreteClass = classesByName.get(binding.concreteClass);
    if (!concreteClass) {
      logger.debug("[LaravelIndex.scanContainerBindings] concrete class not indexed", {
        abstractClass: binding.abstractClass,
        concreteClass: binding.concreteClass,
      });
    }

    return {
      ...createItem("container-binding", binding.abstractClass, binding.file, binding.text, binding.index),
      label: binding.abstractClass,
      detail: `${binding.bindingKind}: ${binding.abstractClass} -> ${binding.concreteClass}`,
      abstractClass: binding.abstractClass,
      concreteClass: binding.concreteClass,
      bindingKind: binding.bindingKind,
      concreteSource: concreteClass
        ? offsetToSourceLocation(concreteClass.file, concreteClass.text, concreteClass.classNameIndex)
        : undefined,
    };
  });

  const boundConcreteClasses = new Set(rawBindings.map((binding) => binding.concreteClass));
  const methods: IndexedItem[] = [];
  for (const classInfo of phpClasses) {
    if (!boundConcreteClasses.has(classInfo.fqn)) {
      continue;
    }

    for (const method of scanPublicPhpMethods(classInfo.text)) {
      methods.push({
        ...createItem("container-method", `${classInfo.fqn}::${method.name}`, classInfo.file, classInfo.text, method.index),
        label: method.name,
        detail: `${classInfo.fqn}::${method.name}`,
        concreteClass: classInfo.fqn,
        method: method.name,
      });
    }
  }

  logger.debug("[LaravelIndex.scanContainerBindings] completed", {
    providerFiles: providerFiles.length,
    appClasses: phpClasses.length,
    presetBindings: presetBindings.length,
    bindings: bindings.length,
    methods: methods.length,
    skippedUnsupported,
  });

  return {
    bindings: uniqueItems(bindings),
    methods: uniqueItems(methods),
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

export async function scanBladeComponents(projectRoot: string, logger: Logger): Promise<BladeComponentIndex> {
  const viewComponentsRoot = path.join(projectRoot, "resources", "views", "components");
  const classComponentsRoot = path.join(projectRoot, "app", "View", "Components");
  const viewFiles = await walkFiles(viewComponentsRoot, (file) => file.endsWith(".blade.php"));
  const classFiles = await walkFiles(classComponentsRoot, (file) => file.endsWith(".php"));
  const components: IndexedItem[] = [];
  const props: IndexedItem[] = [];
  const slots: IndexedItem[] = [];

  for (const file of viewFiles) {
    const relative = toPosixPath(path.relative(viewComponentsRoot, file));
    const key = relative.replace(/\.blade\.php$/, "").replace(/\//g, ".");
    const text = await readTextFile(file);
    components.push(createItemFromLine("blade-component", key, file, 0, 0, `<x-${key.replace(/\./g, "-")}>`));
    if (text) {
      const viewProps = scanBladeAnonymousProps(text, file, key);
      props.push(...viewProps);
      slots.push(...scanBladeSlotVariables(text, file, key, new Set(viewProps.map((item) => item.key))));
    }
  }

  for (const file of classFiles) {
    const relative = toPosixPath(path.relative(classComponentsRoot, file));
    const key = relative
      .replace(/\.php$/, "")
      .replace(/\//g, ".")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase();
    const text = await readTextFile(file);
    components.push(createItemFromLine("blade-component", key, file, 0, 0, `<x-${key.replace(/\./g, "-")}>`));
    if (text) {
      props.push(...scanBladeClassProps(text, file, key));
    }
  }

  logger.debug("[LaravelIndex.scanBladeComponents] completed", {
    viewFiles: viewFiles.length,
    classFiles: classFiles.length,
    components: components.length,
    props: props.length,
    slots: slots.length,
  });
  return {
    components: uniqueItems(components),
    props: uniqueItems(props),
    slots: uniqueItems(slots),
  };
}

export async function scanEcosystemItems(projectRoot: string, logger: Logger): Promise<EcosystemIndex> {
  const livewireIndex = await scanLivewireComponents(projectRoot, logger);
  const inertiaIndex = await scanInertiaPages(projectRoot, logger);
  const filamentIndex = await scanFilamentResources(projectRoot, logger);
  const novaResources = await scanNovaResources(projectRoot, logger);

  logger.debug("[LaravelIndex.scanEcosystemItems] completed", {
    livewireComponents: livewireIndex.components.length,
    livewireProperties: livewireIndex.properties.length,
    livewireActions: livewireIndex.actions.length,
    livewireEvents: livewireIndex.events.length,
    inertiaPages: inertiaIndex.pages.length,
    inertiaProps: inertiaIndex.props.length,
    filamentResources: filamentIndex.resources.length,
    filamentPages: filamentIndex.pages.length,
    filamentFields: filamentIndex.fields.length,
    filamentActions: filamentIndex.actions.length,
    novaResources: novaResources.length,
  });

  return {
    livewireComponents: livewireIndex.components,
    livewireProperties: livewireIndex.properties,
    livewireActions: livewireIndex.actions,
    livewireEvents: livewireIndex.events,
    inertiaPages: inertiaIndex.pages,
    inertiaProps: inertiaIndex.props,
    filamentResources: filamentIndex.resources,
    filamentPages: filamentIndex.pages,
    filamentFields: filamentIndex.fields,
    filamentActions: filamentIndex.actions,
    novaResources,
  };
}

async function scanLivewireComponents(
  projectRoot: string,
  logger: Logger,
): Promise<{ components: IndexedItem[]; properties: IndexedItem[]; actions: IndexedItem[]; events: IndexedItem[] }> {
  const roots = [path.join(projectRoot, "app", "Livewire"), path.join(projectRoot, "app", "Http", "Livewire")];
  const viewRoot = path.join(projectRoot, "resources", "views", "livewire");
  const components: IndexedItem[] = [];
  const properties: IndexedItem[] = [];
  const actions: IndexedItem[] = [];
  const events: IndexedItem[] = [];

  for (const root of roots) {
    const files = await walkFiles(root, (file) => file.endsWith(".php"));
    for (const file of files) {
      const text = await readTextFile(file);
      const relative = toPosixPath(path.relative(root, file)).replace(/\.php$/, "");
      const key = relative
        .split("/")
        .map((segment) => segment.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase())
        .join(".");
      components.push(createItemFromLine("livewire-component", key, file, 0, 0, "Livewire component"));
      if (text) {
        properties.push(...scanLivewireProperties(text, file, key));
        actions.push(...scanLivewireActions(text, file, key));
        events.push(...scanLivewireEvents(text, file, key));
      }
    }
  }

  const viewFiles = await walkFiles(viewRoot, (file) => file.endsWith(".blade.php"));
  for (const file of viewFiles) {
    const key = toPosixPath(path.relative(viewRoot, file)).replace(/\.blade\.php$/, "").replace(/\//g, ".");
    components.push(createItemFromLine("livewire-component", key, file, 0, 0, "Livewire view component"));
  }

  logger.debug("[LaravelIndex.scanLivewireComponents] completed", {
    viewFiles: viewFiles.length,
    components: components.length,
    properties: properties.length,
    actions: actions.length,
    events: events.length,
  });
  return {
    components: uniqueItems(components),
    properties: uniqueItems(properties),
    actions: uniqueItems(actions),
    events: uniqueItems(events),
  };
}

async function scanInertiaPages(projectRoot: string, logger: Logger): Promise<{ pages: IndexedItem[]; props: IndexedItem[] }> {
  const pagesRoot = path.join(projectRoot, "resources", "js", "Pages");
  const pageFiles = await walkFiles(pagesRoot, (file) => /\.(vue|jsx|tsx|svelte)$/.test(file));
  const pages = pageFiles.map((file) => {
    const relative = toPosixPath(path.relative(pagesRoot, file)).replace(/\.(vue|jsx|tsx|svelte)$/, "");
    return createItemFromLine("inertia-page", relative, file, 0, 0, "Inertia page");
  });

  const props: IndexedItem[] = [];
  const phpFiles = [
    ...(await walkFiles(path.join(projectRoot, "routes"), (file) => file.endsWith(".php"))),
    ...(await walkFiles(path.join(projectRoot, "app", "Http", "Controllers"), (file) => file.endsWith(".php"))),
  ];

  for (const file of phpFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    for (const match of text.matchAll(/\b(?:Inertia::render|inertia)\(\s*['"]([^'"]+)['"]\s*,\s*\[/g)) {
      if (!match[1] || match.index === undefined) {
        continue;
      }
      const openBracket = text.indexOf("[", match.index);
      const closeBracket = openBracket >= 0 ? findMatchingSquareBracket(text, openBracket, text.length) : -1;
      if (openBracket < 0 || closeBracket < 0) {
        continue;
      }

      for (const field of scanPhpArrayLiteralKeyPaths(text, openBracket, closeBracket, [])) {
        const key = field.path.join(".");
        props.push({
          ...createItem("inertia-prop", key, file, text, field.index),
          detail: `Inertia prop ${match[1]}`,
          componentName: match[1],
          responseFieldPath: field.path,
        });
      }
    }
  }

  logger.debug("[LaravelIndex.scanInertiaPages] completed", {
    files: pageFiles.length,
    pages: pages.length,
    props: props.length,
  });
  return {
    pages: uniqueItems(pages),
    props: uniqueItems(props),
  };
}

function scanBladeClassProps(text: string, file: string, componentName: string): IndexedItem[] {
  const items: IndexedItem[] = [];
  const constructorMatch = /\bfunction\s+__construct\s*\(([\s\S]*?)\)/.exec(text);
  if (constructorMatch?.[1]) {
    for (const match of constructorMatch[1].matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)) {
      if (!match[1] || match.index === undefined) {
        continue;
      }
      items.push({
        ...createItem("blade-component-prop", match[1], file, text, constructorMatch.index + constructorMatch[0].indexOf(match[0])),
        detail: `Blade component prop <x-${componentName.replace(/\./g, "-")}>`,
        componentName,
      });
    }
  }

  for (const match of text.matchAll(/\bpublic\s+(?!function\b)[^$]*\$([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (!match[1] || match.index === undefined) {
      continue;
    }
    items.push({
      ...createItem("blade-component-prop", match[1], file, text, match.index + match[0].indexOf(match[1])),
      detail: `Blade component prop <x-${componentName.replace(/\./g, "-")}>`,
      componentName,
    });
  }

  return items;
}

function scanBladeAnonymousProps(text: string, file: string, componentName: string): IndexedItem[] {
  const items: IndexedItem[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(/@props\s*\(\s*\[([\s\S]*?)\]\s*\)/g)) {
    if (!match[1] || match.index === undefined) {
      continue;
    }

    const block = match[1];
    for (const keyMatch of block.matchAll(/['"]([A-Za-z_][A-Za-z0-9_-]*)['"]\s*(?:=>|,|$)/g)) {
      if (!keyMatch[1] || seen.has(keyMatch[1])) {
        continue;
      }
      seen.add(keyMatch[1]);
      items.push({
        ...createItem("blade-component-prop", keyMatch[1], file, text, match.index + match[0].indexOf(keyMatch[1])),
        detail: `Blade component prop <x-${componentName.replace(/\./g, "-")}>`,
        componentName,
      });
    }
  }

  return items;
}

function scanBladeSlotVariables(text: string, file: string, componentName: string, propNames: Set<string>): IndexedItem[] {
  const excluded = new Set(["attributes", "component", "errors", "loop", "slot", ...propNames]);
  const items: IndexedItem[] = [];

  for (const match of text.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (!match[1] || match.index === undefined || excluded.has(match[1])) {
      continue;
    }
    items.push({
      ...createItem("blade-component-slot", match[1], file, text, match.index + match[0].indexOf(match[1])),
      detail: `Blade component slot <x-slot:${match[1]}>`,
      componentName,
    });
  }

  return items;
}

function scanLivewireProperties(text: string, file: string, componentName: string): IndexedItem[] {
  const items: IndexedItem[] = [];
  for (const match of text.matchAll(/\bpublic\s+(?!function\b)[^$]*\$([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (!match[1] || match.index === undefined) {
      continue;
    }
    items.push({
      ...createItem("livewire-property", match[1], file, text, match.index + match[0].indexOf(match[1])),
      detail: `Livewire property ${componentName}`,
      componentName,
    });
  }
  return items;
}

function scanLivewireActions(text: string, file: string, componentName: string): IndexedItem[] {
  const lifecyclePrefixes = ["boot", "hydrate", "dehydrate", "mount", "render", "updating", "updated"];
  return scanPublicPhpMethods(text)
    .filter((method) => !lifecyclePrefixes.some((prefix) => method.name === prefix || method.name.startsWith(prefix)))
    .map((method) => ({
      ...createItem("livewire-action", method.name, file, text, method.index),
      detail: `Livewire action ${componentName}`,
      componentName,
      method: method.name,
    }));
}

function scanLivewireEvents(text: string, file: string, componentName: string): IndexedItem[] {
  const items: IndexedItem[] = [];
  const eventRegex = /(?:->dispatch|->emit|dispatchBrowserEvent)\(\s*['"]([A-Za-z0-9_.:-]+)['"]/g;
  for (const match of text.matchAll(eventRegex)) {
    if (!match[1] || match.index === undefined) {
      continue;
    }
    items.push({
      ...createItem("livewire-event", match[1], file, text, match.index + match[0].indexOf(match[1])),
      detail: `Livewire event ${componentName}`,
      componentName,
    });
  }
  return items;
}

function scanFilamentNamedElements(
  text: string,
  file: string,
  kind: "field" | "action",
): IndexedItem[] {
  const items: IndexedItem[] = [];
  const fieldRegex = /\b(?:TextInput|Textarea|Toggle|Checkbox|Select|DatePicker|TextColumn|IconColumn|BadgeColumn|ViewColumn)::make\(\s*['"]([^'"]+)['"]/g;
  const actionRegex = /\b(?:Action|BulkAction)::make\(\s*['"]([^'"]+)['"]/g;
  const regex = kind === "field" ? fieldRegex : actionRegex;

  for (const match of text.matchAll(regex)) {
    if (!match[1] || match.index === undefined) {
      continue;
    }
    items.push({
      ...createItem(kind === "field" ? "filament-field" : "filament-action", match[1], file, text, match.index + match[0].indexOf(match[1])),
      detail: kind === "field" ? "Filament field" : "Filament action",
    });
  }

  return items;
}

async function scanFilamentResources(
  projectRoot: string,
  logger: Logger,
): Promise<{ resources: IndexedItem[]; pages: IndexedItem[]; fields: IndexedItem[]; actions: IndexedItem[] }> {
  const resourcesRoot = path.join(projectRoot, "app", "Filament", "Resources");
  const resourceFiles = await walkFiles(resourcesRoot, (file) => file.endsWith("Resource.php"));
  const resources: IndexedItem[] = [];
  const pages: IndexedItem[] = [];
  const fields: IndexedItem[] = [];
  const actions: IndexedItem[] = [];

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
    resources.push({
      ...createItem("filament-resource", resourceClass, file, text, classMatch.index),
      label: classMatch[1],
      detail: "Filament resource",
    });
    fields.push(...scanFilamentNamedElements(text, file, "field"));
    actions.push(...scanFilamentNamedElements(text, file, "action"));
  }

  const pageFiles = await walkFiles(resourcesRoot, (file) => /[/\\]Pages[/\\].+\.php$/.test(file));
  for (const file of pageFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }
    const classInfo = scanPhpClassInfo(file, text);
    if (!classInfo) {
      continue;
    }

    pages.push({
      ...createItem("filament-page", classInfo.fqn, file, text, classInfo.classNameIndex),
      label: classInfo.className,
      detail: "Filament page",
    });
    fields.push(...scanFilamentNamedElements(text, file, "field"));
    actions.push(...scanFilamentNamedElements(text, file, "action"));
  }

  logger.debug("[LaravelIndex.scanFilamentResources] completed", {
    files: resourceFiles.length,
    resources: resources.length,
    pages: pages.length,
    fields: fields.length,
    actions: actions.length,
  });
  return {
    resources: uniqueItems(resources),
    pages: uniqueItems(pages),
    fields: uniqueItems(fields),
    actions: uniqueItems(actions),
  };
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

export async function scanArtisanCommands(projectRoot: string, logger: Logger): Promise<IndexedItem[]> {
  const appFiles = await walkFiles(path.join(projectRoot, "app"), (file) => file.endsWith(".php"));
  const items: IndexedItem[] = [];

  for (const file of appFiles) {
    const text = await readTextFile(file);
    if (!text) {
      continue;
    }

    const classInfo = scanPhpClassInfo(file, text);
    if (!classInfo || !isArtisanCommandClass(classInfo)) {
      continue;
    }

    for (const command of scanArtisanCommandDeclarations(text)) {
      items.push({
        ...createItem("artisan-command", command.name, file, text, classInfo.classNameIndex),
        detail: `Artisan command ${classInfo.fqn}`,
        commandClass: classInfo.fqn,
      });
    }
  }

  logger.debug("[LaravelIndex.scanArtisanCommands] completed", {
    files: appFiles.length,
    items: items.length,
  });
  return uniqueItems(items);
}

function scanControllerMethodBodies(text: string): Array<{ method: string; params: string; body: string; bodyOffset: number }> {
  const methods: Array<{ method: string; params: string; body: string; bodyOffset: number }> = [];
  for (const match of text.matchAll(/\bpublic\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\{/g)) {
    if (!match[1] || match.index === undefined) {
      continue;
    }

    const openBrace = match.index + match[0].length - 1;
    const closeBrace = findMatchingBrace(text, openBrace, text.length);
    if (closeBrace < 0) {
      continue;
    }

    methods.push({
      method: match[1],
      params: match[2] ?? "",
      body: text.slice(openBrace + 1, closeBrace),
      bodyOffset: openBrace + 1,
    });
  }
  return methods;
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

function scanResponseFieldsFromStatement(
  fileText: string,
  statement: string,
  statementOffset: number,
  context?: ResponseFieldScanContext,
): ResponseFieldMatch[] {
  const fields: ResponseFieldMatch[] = [];

  for (const match of statement.matchAll(/response\(\)->json\(\s*\[/g)) {
    if (match.index === undefined) {
      continue;
    }
    const openBracket = statementOffset + match.index + match[0].lastIndexOf("[");
    const closeBracket = findMatchingSquareBracket(fileText, openBracket, fileText.length);
    if (closeBracket >= 0) {
      fields.push(...scanPhpArrayLiteralKeyPaths(fileText, openBracket, closeBracket, [], context));
    }
  }

  for (const match of statement.matchAll(/\breturn\s*\[/g)) {
    if (match.index === undefined) {
      continue;
    }
    const openBracket = statementOffset + match.index + match[0].lastIndexOf("[");
    const closeBracket = findMatchingSquareBracket(fileText, openBracket, fileText.length);
    if (closeBracket >= 0) {
      fields.push(...scanPhpArrayLiteralKeyPaths(fileText, openBracket, closeBracket, [], context));
    }
  }

  for (const match of statement.matchAll(/\bcollect\(\s*\[/g)) {
    if (match.index === undefined) {
      continue;
    }
    const openBracket = statementOffset + match.index + match[0].lastIndexOf("[");
    const closeBracket = findMatchingSquareBracket(fileText, openBracket, fileText.length);
    if (closeBracket >= 0) {
      fields.push(...scanPhpArrayLiteralKeyPaths(fileText, openBracket, closeBracket, [], context));
    }
  }

  for (const match of statement.matchAll(/\bfn\s*\([^)]*\)\s*=>\s*\[/g)) {
    if (match.index === undefined) {
      continue;
    }
    const openBracket = statementOffset + match.index + match[0].lastIndexOf("[");
    const closeBracket = findMatchingSquareBracket(fileText, openBracket, fileText.length);
    if (closeBracket >= 0) {
      fields.push(...scanPhpArrayLiteralKeyPaths(fileText, openBracket, closeBracket, [], context));
    }
  }

  fields.push(...scanTopLevelResourceResponseFields(fileText, statement, statementOffset, context));

  return uniqueResponseFields(fields);
}

function scanPhpArrayLiteralKeyPaths(
  text: string,
  openBracket: number,
  closeBracket: number,
  parentPath: string[] = [],
  context?: ResponseFieldScanContext,
): ResponseFieldMatch[] {
  const fields: ResponseFieldMatch[] = [];
  let index = openBracket + 1;

  while (index < closeBracket) {
    const key = phpArrayLiteralKeyAt(text, index, closeBracket);
    if (!key) {
      index += 1;
      continue;
    }

    const pathParts = [...parentPath, key.value];
    fields.push({ path: pathParts, index: key.index });

    const valueStart = skipWhitespace(text, key.valueStart, closeBracket);
    if (text[valueStart] === "[") {
      const nestedClose = findMatchingSquareBracket(text, valueStart, closeBracket);
      if (nestedClose > valueStart) {
        fields.push(...scanPhpArrayLiteralKeyPaths(text, valueStart, nestedClose, pathParts, context));
        index = nestedClose + 1;
        continue;
      }
    }

    fields.push(...responseModelFieldMatches(text, valueStart, closeBracket, pathParts, key.index, context));
    fields.push(...responseNestedResourceMatches(text, valueStart, closeBracket, pathParts, key.index, context));
    index = key.valueStart + 1;
  }

  return fields;
}

function responseFieldsByModel(eloquentFields: IndexedItem[]): Map<string, IndexedItem[]> {
  const fieldsByModel = new Map<string, IndexedItem[]>();
  for (const field of eloquentFields) {
    if (!field.modelClass) {
      continue;
    }
    fieldsByModel.set(field.modelClass, [...(fieldsByModel.get(field.modelClass) ?? []), field]);
  }
  return fieldsByModel;
}

function responseModelFieldMatches(
  text: string,
  valueStart: number,
  end: number,
  parentPath: string[],
  fallbackIndex: number,
  context?: ResponseFieldScanContext,
): ResponseFieldMatch[] {
  if (!context) {
    return [];
  }

  const variable = phpVariableAt(text, valueStart, end);
  const modelClass = variable ? context.modelVariables.get(variable) : undefined;
  if (!modelClass) {
    return [];
  }

  const fields = context.fieldsByModel.get(modelClass) ?? [];
  return fields.map((field) => ({
    path: [...parentPath, field.key],
    index: field.source.offset ?? fallbackIndex,
    source: field.source,
    responseSourceKind: "eloquent-model",
    responseSourceClass: modelClass,
  }));
}

function responseResourceMatchAt(
  text: string,
  valueStart: number,
  end: number,
  context?: ResponseFieldScanContext,
): { className: string; responseSourceKind: string } | undefined {
  if (!context?.resourceFieldResolver) {
    return undefined;
  }

  const slice = text.slice(valueStart, end);
  const directNew = /^\s*new\s+\\?([A-Za-z_][A-Za-z0-9_\\]*)\s*\(/.exec(slice)?.[1];
  const directMake = /^\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::make\s*\(/.exec(slice)?.[1];
  const directCollection = /^\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::collection\s*\(/.exec(slice)?.[1];
  const bareNew = /^\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)\s*\(/.exec(slice)?.[1];
  const classReference = directNew ?? directMake ?? directCollection ?? bareNew;
  if (!classReference) {
    return undefined;
  }

  const className = resolvePhpClassReference(classReference, context.namespace ?? "", context.uses ?? new Map());
  const resourceFields = context.resourceFieldResolver(className);
  if (!resourceFields || resourceFields.length === 0) {
    return undefined;
  }

  return {
    className,
    responseSourceKind: directCollection ? "anonymous-resource-collection" : "json-resource",
  };
}

function responseNestedResourceMatches(
  text: string,
  valueStart: number,
  end: number,
  parentPath: string[],
  fallbackIndex: number,
  context?: ResponseFieldScanContext,
): ResponseFieldMatch[] {
  const resourceMatch = responseResourceMatchAt(text, valueStart, end, context);
  if (!resourceMatch) {
    return [];
  }

  const fields = context?.resourceFieldResolver?.(resourceMatch.className) ?? [];
  return fields.map((field) => ({
    ...field,
    path: [...parentPath, ...(field.path ?? [])],
    index: field.source?.offset ?? field.index ?? fallbackIndex,
    responseSourceKind: field.responseSourceKind ?? resourceMatch.responseSourceKind,
    responseSourceClass: field.responseSourceClass ?? resourceMatch.className,
  }));
}

function scanTopLevelResourceResponseFields(
  fileText: string,
  statement: string,
  statementOffset: number,
  context?: ResponseFieldScanContext,
): ResponseFieldMatch[] {
  const fields: ResponseFieldMatch[] = [];
  const topLevelPatterns = [
    /\bfn\s*\([^)]*\)\s*=>\s*new\s+\\?([A-Za-z_][A-Za-z0-9_\\]*)\s*\(/g,
    /\bfn\s*\([^)]*\)\s*=>\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::make\s*\(/g,
    /\bfn\s*\([^)]*\)\s*=>\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::collection\s*\(/g,
    /\breturn\s+new\s+\\?([A-Za-z_][A-Za-z0-9_\\]*)\s*\(/g,
    /\breturn\s+\\?([A-Za-z_][A-Za-z0-9_\\]*)::make\s*\(/g,
    /\breturn\s+\\?([A-Za-z_][A-Za-z0-9_\\]*)::collection\s*\(/g,
    /response\(\)->json\(\s*new\s+\\?([A-Za-z_][A-Za-z0-9_\\]*)\s*\(/g,
    /response\(\)->json\(\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::make\s*\(/g,
    /response\(\)->json\(\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::collection\s*\(/g,
  ];

  for (const pattern of topLevelPatterns) {
    for (const match of statement.matchAll(pattern)) {
      if (!match[1] || match.index === undefined) {
        continue;
      }

      const valueStart = statementOffset + match.index + match[0].lastIndexOf(match[1]);
      const resourceMatch = responseResourceMatchAt(fileText, valueStart, fileText.length, context);
      if (!resourceMatch) {
        continue;
      }

      const resourceFields = context?.resourceFieldResolver?.(resourceMatch.className) ?? [];
      fields.push(
        ...resourceFields.map((field) => ({
          ...field,
          responseSourceKind: field.responseSourceKind ?? resourceMatch.responseSourceKind,
          responseSourceClass: field.responseSourceClass ?? resourceMatch.className,
        })),
      );
    }
  }

  return fields;
}

function responseResourceKind(
  extendsClass: string,
): RawResponseResourceDefinition["kind"] | undefined {
  if (extendsClass === "Illuminate\\Http\\Resources\\Json\\JsonResource") {
    return "json-resource";
  }
  if (extendsClass === "Illuminate\\Http\\Resources\\Json\\ResourceCollection") {
    return "resource-collection";
  }
  if (extendsClass === "Illuminate\\Http\\Resources\\Json\\AnonymousResourceCollection") {
    return "anonymous-resource-collection";
  }
  return undefined;
}

function scanCollectedResourceClass(text: string, namespace: string, uses: Map<string, string>): string | undefined {
  const classReference = /\$(?:collects)\s*=\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*;/.exec(text)?.[1];
  return classReference ? resolvePhpClassReference(classReference, namespace, uses) : undefined;
}

function phpVariableAt(text: string, index: number, end: number): string | undefined {
  const match = /^\$([A-Za-z_][A-Za-z0-9_]*)\b/.exec(text.slice(index, end));
  return match?.[1];
}

function modelVariablesFromRouteClosure(statement: string, uses: Map<string, string>, modelClasses: Set<string>): Map<string, string> {
  const params =
    /\bfn\s*\(([^)]*)\)\s*=>/.exec(statement)?.[1] ??
    /\bfunction\s*\(([^)]*)\)/.exec(statement)?.[1] ??
    "";

  return modelVariablesFromParams(params, "", uses, modelClasses);
}

function modelVariablesFromParams(
  params: string,
  namespace: string,
  uses: Map<string, string>,
  modelClasses: Set<string>,
): Map<string, string> {
  const variables = new Map<string, string>();
  for (const param of params.split(",")) {
    const match = /(?:^|\s)(?:\?)?\\?([A-Za-z_][A-Za-z0-9_\\]*)(?:\|null)?\s+\$([A-Za-z_][A-Za-z0-9_]*)\b/.exec(param.trim());
    if (!match?.[1] || !match[2]) {
      continue;
    }

    const modelClass = resolvePhpClassReference(match[1], namespace, uses);
    if (modelClasses.has(modelClass)) {
      variables.set(match[2], modelClass);
    }
  }
  return variables;
}

function phpArrayLiteralKeyAt(
  text: string,
  index: number,
  end: number,
): { value: string; index: number; valueStart: number } | undefined {
  let cursor = skipWhitespace(text, index, end);
  const quote = text[cursor];
  if (quote !== "'" && quote !== '"') {
    return undefined;
  }

  const keyStart = cursor + 1;
  cursor += 1;
  let escaped = false;
  while (cursor < end) {
    const char = text[cursor];
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === quote) {
      break;
    }
    cursor += 1;
  }

  if (cursor >= end || text[cursor] !== quote) {
    return undefined;
  }

  const value = text.slice(keyStart, cursor);
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value)) {
    return undefined;
  }

  cursor = skipWhitespace(text, cursor + 1, end);
  if (text[cursor] !== "=" || text[cursor + 1] !== ">") {
    return undefined;
  }

  return {
    value,
    index: keyStart,
    valueStart: cursor + 2,
  };
}

function skipWhitespace(text: string, index: number, end: number): number {
  let cursor = index;
  while (cursor < end && /\s/.test(text[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor;
}

function uniqueResponseFields(fields: ResponseFieldMatch[]): ResponseFieldMatch[] {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = field.path.join(".");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

function scanMigrationColumns(
  body: string,
  bodyOffset: number,
): Array<{ name: string; index: number; type: string; nullable?: boolean; defaultValue?: string; enumValues?: string[] }> {
  const columns: Array<{ name: string; index: number; type: string; nullable?: boolean; defaultValue?: string; enumValues?: string[] }> = [];
  const columnMethods =
    "bigInteger|binary|boolean|char|date|dateTime|dateTimeTz|decimal|double|enum|float|foreignId|integer|ipAddress|json|jsonb|longText|macAddress|mediumInteger|mediumText|morphs|nullableMorphs|rememberToken|set|smallInteger|string|text|time|timeTz|timestamp|timestampTz|tinyInteger|ulid|uuid|year";
  const namedColumnRegex = new RegExp(`\\$table->(?:${columnMethods})\\(\\s*['"]([A-Za-z0-9_]+)['"][^;]*`, "g");

  for (const match of body.matchAll(namedColumnRegex)) {
    if (match[1] === undefined || match.index === undefined) {
      continue;
    }
    const methodCall = match[0];
    const methodName = /\$table->([A-Za-z_][A-Za-z0-9_]*)/.exec(methodCall)?.[1];
    const baseIndex = bodyOffset + match.index + methodCall.lastIndexOf(match[1]);
    const nullable = /->nullable\(\s*\)/.test(methodCall);
    const defaultValue = /->default\(\s*([^)]+)\s*\)/.exec(methodCall)?.[1]?.trim();
    const enumValues = extractMigrationEnumValues(methodCall);

    if (methodName === "morphs" || methodName === "nullableMorphs") {
      columns.push({ name: `${match[1]}_id`, index: baseIndex, type: "unsignedBigInteger", nullable: methodName === "nullableMorphs" });
      columns.push({ name: `${match[1]}_type`, index: baseIndex, type: "string", nullable: methodName === "nullableMorphs" });
      continue;
    }

    columns.push({
      name: match[1],
      index: baseIndex,
      type: methodName ?? "column",
      nullable,
      defaultValue,
      enumValues,
    });
  }

  for (const match of body.matchAll(/\$table->id\(\s*\)/g)) {
    if (match.index !== undefined) {
      columns.push({ name: "id", index: bodyOffset + match.index, type: "id", nullable: false });
    }
  }

  for (const match of body.matchAll(/\$table->timestamps\(\s*\)/g)) {
    if (match.index !== undefined) {
      columns.push({ name: "created_at", index: bodyOffset + match.index, type: "timestamp", nullable: false });
      columns.push({ name: "updated_at", index: bodyOffset + match.index, type: "timestamp", nullable: false });
    }
  }

  for (const match of body.matchAll(/\$table->softDeletes\(\s*\)/g)) {
    if (match.index !== undefined) {
      columns.push({ name: "deleted_at", index: bodyOffset + match.index, type: "timestamp", nullable: true });
    }
  }

  for (const match of body.matchAll(/\$table->rememberToken\(\s*\)/g)) {
    if (match.index !== undefined) {
      columns.push({ name: "remember_token", index: bodyOffset + match.index, type: "string", nullable: true });
    }
  }

  return columns;
}

function extractMigrationEnumValues(methodCall: string): string[] | undefined {
  const valuesBlock = /->(?:enum|set)\(\s*['"][A-Za-z0-9_]+['"]\s*,\s*\[([^\]]*)\]\s*\)/.exec(methodCall)?.[1];
  if (!valuesBlock) {
    return undefined;
  }

  const values = [...valuesBlock.matchAll(/['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
  return values.length > 0 ? values : undefined;
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

function isArtisanCommandClass(classInfo: PhpClassInfo): boolean {
  return (
    classInfo.extendsClass === "Illuminate\\Console\\Command" ||
    /[/\\]app[/\\]Console[/\\]Commands[/\\]/.test(classInfo.file)
  );
}

function scanArtisanCommandDeclarations(text: string): Array<{ name: string; index: number }> {
  const commands: Array<{ name: string; index: number }> = [];
  const propertyRegex = /\bprotected\s+(?:static\s+)?(?:string\s+)?\$(signature|name)\s*=\s*(['"])([^'"]+)\2/g;

  for (const match of text.matchAll(propertyRegex)) {
    if (match.index === undefined || !match[1] || !match[3]) {
      continue;
    }

    const rawValue = match[3].trim();
    const commandName = match[1] === "signature" ? rawValue.split(/\s+/)[0] : rawValue;
    if (!commandName || !/^[A-Za-z0-9_.:-]+$/.test(commandName)) {
      continue;
    }

    commands.push({
      name: commandName,
      index: match.index + match[0].indexOf(match[3]),
    });
  }

  return commands;
}

async function collectServiceProviderFiles(projectRoot: string): Promise<string[]> {
  const files = new Set(await walkFiles(path.join(projectRoot, "app", "Providers"), (file) => file.endsWith(".php")));
  const configAppFile = path.join(projectRoot, "config", "app.php");
  const configAppText = await readTextFile(configAppFile);
  if (!configAppText) {
    return [...files].sort();
  }

  for (const match of configAppText.matchAll(/\\?([A-Za-z_][A-Za-z0-9_\\]*)::class/g)) {
    const className = match[1];
    if (!className?.startsWith("App\\")) {
      continue;
    }
    files.add(path.join(projectRoot, `${className.replace(/^App\\/, "app\\").replace(/\\/g, path.sep)}.php`));
  }

  return [...files].sort();
}

async function laravelCorePresetContainerBindings(projectRoot: string): Promise<RawContainerBinding[]> {
  const sourceFile = path.join(projectRoot, "vendor", "laravel", "framework", "src", "Illuminate", "Foundation", "Application.php");
  const fallbackFile = path.join(projectRoot, "composer.json");
  const sourceFileText = await readTextFile(sourceFile);
  const fallbackText = await readTextFile(fallbackFile);
  const source = sourceFileText !== undefined
    ? { file: sourceFile, text: sourceFileText }
    : { file: fallbackFile, text: fallbackText ?? "" };
  const bindings: RawContainerBinding[] = [];

  for (const [concreteClass, aliases] of Object.entries(LARAVEL_CORE_CONTAINER_ALIASES)) {
    for (const abstractClass of aliases) {
      if (abstractClass === concreteClass) {
        continue;
      }
      bindings.push({
        abstractClass,
        concreteClass,
        bindingKind: "laravel-core-alias",
        file: source.file,
        text: source.text,
        index: Math.max(0, source.text.indexOf(abstractClass.replace(/\\/g, "\\\\"))),
      });
    }
  }

  return bindings;
}

function candidateConcreteClassFiles(projectRoot: string, bindings: RawContainerBinding[]): string[] {
  const files = new Set<string>();
  for (const binding of bindings) {
    const file = phpClassFile(projectRoot, binding.concreteClass);
    if (file) {
      files.add(file);
    }
  }
  return [...files].sort();
}

function phpClassFile(projectRoot: string, className: string): string | undefined {
  if (className.startsWith("Illuminate\\")) {
    return path.join(
      projectRoot,
      "vendor",
      "laravel",
      "framework",
      "src",
      "Illuminate",
      `${className.slice("Illuminate\\".length).replace(/\\/g, path.sep)}.php`,
    );
  }
  if (className.startsWith("Symfony\\Component\\")) {
    return path.join(projectRoot, "vendor", "symfony", className.slice("Symfony\\Component\\".length).replace(/\\/g, path.sep) + ".php");
  }
  return undefined;
}

function scanSimpleContainerBindings(
  text: string,
  file: string,
  namespace: string,
  uses: Map<string, string>,
): RawContainerBinding[] {
  const bindings: RawContainerBinding[] = [];
  const classBindingRegex =
    /(?:(?:\$this->app|app\(\))->|(?:\\?App)::)(bind|singleton|scoped|bindIf|singletonIf)\s*\(\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*,\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class/g;
  const arrowFactoryBindingRegex =
    /(?:(?:\$this->app|app\(\))->|(?:\\?App)::)(bind|singleton|scoped|bindIf|singletonIf)\s*\(\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*,\s*(?:static\s+)?fn\s*\([^)]*\)\s*=>\s*new\s+\\?([A-Za-z_][A-Za-z0-9_\\]*)\b/g;
  const closureFactoryBindingRegex =
    /(?:(?:\$this->app|app\(\))->|(?:\\?App)::)(bind|singleton|scoped|bindIf|singletonIf)\s*\(\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*,\s*(?:static\s+)?function\s*\([^)]*\)\s*(?:use\s*\([^)]*\)\s*)?\{[\s\S]*?\breturn\s+new\s+\\?([A-Za-z_][A-Za-z0-9_\\]*)\b/g;

  for (const match of text.matchAll(classBindingRegex)) {
    addContainerBindingMatch(bindings, match, file, text, namespace, uses);
  }
  for (const match of text.matchAll(arrowFactoryBindingRegex)) {
    addContainerBindingMatch(bindings, match, file, text, namespace, uses);
  }
  for (const match of text.matchAll(closureFactoryBindingRegex)) {
    addContainerBindingMatch(bindings, match, file, text, namespace, uses);
  }

  return bindings;
}

function addContainerBindingMatch(
  bindings: RawContainerBinding[],
  match: RegExpMatchArray,
  file: string,
  text: string,
  namespace: string,
  uses: Map<string, string>,
): void {
    if (match.index === undefined || !match[1] || !match[2] || !match[3]) {
    return;
    }

    bindings.push({
      abstractClass: resolvePhpClassReference(match[2], namespace, uses),
      concreteClass: resolvePhpClassReference(match[3], namespace, uses),
      bindingKind: match[1],
      file,
      text,
      index: match.index + match[0].indexOf(match[2]),
    });
}

function countUnsupportedContainerBindingCalls(text: string, supportedBindings: RawContainerBinding[]): number {
  const supportedIndexes = new Set(supportedBindings.map((binding) => binding.index));
  const bindingCallRegex = /(?:(?:\$this->app|app\(\))->|(?:\\?App)::)(?:bind|singleton|scoped|bindIf|singletonIf)\s*\(/g;
  let unsupported = 0;

  for (const match of text.matchAll(bindingCallRegex)) {
    if (match.index === undefined) {
      continue;
    }
    const alreadySupported = [...supportedIndexes].some((index) => index >= match.index && index < match.index + match[0].length + 180);
    if (!alreadySupported) {
      unsupported += 1;
    }
  }

  return unsupported;
}

function scanPublicPhpMethods(text: string): Array<{ name: string; index: number }> {
  const methods: Array<{ name: string; index: number }> = [];
  const methodRegex = /\bpublic\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

  for (const match of text.matchAll(methodRegex)) {
    if (match.index === undefined || !match[1] || (match[1].startsWith("__") && match[1] !== "__invoke")) {
      continue;
    }

    methods.push({
      name: match[1],
      index: match.index + match[0].indexOf(match[1]),
    });
  }

  return methods;
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
  return resolvePhpClassReference(className, namespace, uses);
}

function normalizeClassReference(reference: string): string {
  return reference.replace(/^\\/, "").replace(/::class$/, "");
}

function resolvePhpClassReference(className: string, namespace: string, uses: Map<string, string>): string {
  const normalized = className.replace(/^\\/, "");
  if (normalized.includes("\\")) {
    return normalized;
  }
  return uses.get(normalized) ?? (namespace ? `${namespace}\\${normalized}` : normalized);
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

function scanHttpRouteDeclarations(
  text: string,
  file: string,
  routeControllerScopes: RouteControllerScope[],
  filePrefix = "",
): Array<{
  method: string;
  uri: string;
  uriIndex: number;
  routeName?: string;
  controllerTarget?: { controllerClass: string; method: string };
}> {
  const routes: Array<{
    method: string;
    uri: string;
    uriIndex: number;
    routeName?: string;
    controllerTarget?: { controllerClass: string; method: string };
  }> = [];
  const prefixScopes = scanRoutePrefixScopes(text, filePrefix);
  const uses = scanUseStatements(text);
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
      controllerTarget: httpRouteControllerTarget(statement, uses, routeControllerScopes, file, uriIndex),
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
        controllerTarget: httpRouteControllerTarget(statement, uses, routeControllerScopes, file, uriIndex),
      });
    }
  }

  const resourceRouteRegex = /Route::(resource|apiResource)\(\s*(['"])([^'"]+)\2\s*,\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class/g;
  for (const match of text.matchAll(resourceRouteRegex)) {
    if (match.index === undefined || !match[1] || !match[3] || !match[4]) {
      continue;
    }

    const statement = routeStatementAfter(text, match.index);
    const uriIndex = match.index + match[0].lastIndexOf(match[3]);
    const prefix = nearestRoutePrefix(prefixScopes, uriIndex) || filePrefix;
    const controllerClass = resolveControllerClass(match[4], uses);
    const resourceRoutes = expandResourceRoutes(match[3], match[1] === "apiResource");

    for (const route of resourceRoutes) {
      routes.push({
        method: route.method,
        uri: joinRouteUri(prefix, route.uri),
        uriIndex,
        routeName: routeNameFromStatement(statement) ?? `${resourceRouteName(match[3])}.${route.action}`,
        controllerTarget: {
          controllerClass,
          method: route.action,
        },
      });
    }
  }

  return routes;
}

function expandResourceRoutes(resource: string, apiOnly: boolean): Array<{ method: string; uri: string; action: string }> {
  const parameter = resourceParameterName(resource);
  const memberUri = joinRouteUri(resource, `{${parameter}}`);
  const indexRoute = { method: "GET", uri: resource, action: "index" };
  const storeRoute = { method: "POST", uri: resource, action: "store" };
  const showRoute = { method: "GET", uri: memberUri, action: "show" };
  const putUpdateRoute = { method: "PUT", uri: memberUri, action: "update" };
  const patchUpdateRoute = { method: "PATCH", uri: memberUri, action: "update" };
  const destroyRoute = { method: "DELETE", uri: memberUri, action: "destroy" };
  const routes = [indexRoute, storeRoute, showRoute, putUpdateRoute, patchUpdateRoute, destroyRoute];

  if (apiOnly) {
    return routes;
  }

  return [
    indexRoute,
    { method: "GET", uri: joinRouteUri(resource, "create"), action: "create" },
    storeRoute,
    showRoute,
    { method: "GET", uri: joinRouteUri(memberUri, "edit"), action: "edit" },
    putUpdateRoute,
    patchUpdateRoute,
    destroyRoute,
  ];
}

function resourceParameterName(resource: string): string {
  const segment = resource
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .at(-1) ?? "resource";
  const singular = singularizeResourceSegment(segment);
  const normalized = singular.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "resource";
}

function singularizeResourceSegment(segment: string): string {
  if (/ies$/i.test(segment)) {
    return segment.slice(0, -3) + "y";
  }

  if (/ses$/i.test(segment)) {
    return segment.slice(0, -2);
  }

  if (/s$/i.test(segment) && !/ss$/i.test(segment)) {
    return segment.slice(0, -1);
  }

  return segment;
}

function resourceRouteName(resource: string): string {
  return resource
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\{([^}]+)\}/g, "$1")
    .split("/")
    .filter(Boolean)
    .join(".");
}

function httpRouteControllerTarget(
  statement: string,
  uses: Map<string, string>,
  routeControllerScopes: RouteControllerScope[],
  file: string,
  offset: number,
): { controllerClass: string; method: string } | undefined {
  const arrayAction = /\[\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*,\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/.exec(statement);
  if (arrayAction?.[1] && arrayAction[2]) {
    return {
      controllerClass: resolveControllerClass(arrayAction[1], uses),
      method: arrayAction[2],
    };
  }

  const controllerString = /['"]\\?([A-Za-z_][A-Za-z0-9_\\]*)@([A-Za-z_][A-Za-z0-9_]*)['"]/.exec(statement);
  if (controllerString?.[1] && controllerString[2]) {
    return {
      controllerClass: resolveControllerClass(controllerString[1], uses),
      method: controllerString[2],
    };
  }

  const invokable = /,\s*\\?([A-Za-z_][A-Za-z0-9_\\]*)::class\s*\)/.exec(statement);
  if (invokable?.[1]) {
    return {
      controllerClass: resolveControllerClass(invokable[1], uses),
      method: "__invoke",
    };
  }

  const stringAction = /,\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/.exec(statement);
  const group = stringAction ? findNearestControllerGroup(routeControllerScopes, file, offset) : undefined;
  if (stringAction?.[1] && group) {
    return {
      controllerClass: group.controllerClass,
      method: stringAction[1],
    };
  }

  return undefined;
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

function createResponseFieldItem(field: ResponseFieldMatch, file: string, text: string, route: IndexedItem): IndexedItem {
  const key = field.path.join(".");
  const source = field.source ?? offsetToSourceLocation(file, text, field.index);
  return {
    key,
    label: key,
    kind: "response-field",
    source,
    detail: `Laravel response: ${route.httpMethod ?? "ANY"} ${route.uri ?? route.key}`,
    uri: route.uri,
    httpMethod: route.httpMethod,
    routeName: route.routeName,
    controllerClass: route.controllerClass,
    method: route.method,
    responseRouteUri: route.uri,
    responseRouteName: route.routeName,
    responseHttpMethod: route.httpMethod,
    responseControllerClass: route.controllerClass,
    responseControllerMethod: route.method,
    responseFieldPath: field.path,
    responseSourceKind: field.responseSourceKind,
    responseSourceClass: field.responseSourceClass,
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
