export interface SourceLocation {
  file: string;
  line: number;
  character: number;
  offset?: number;
}

export interface IndexedItem {
  key: string;
  label: string;
  kind: LaravelIndexKind;
  source: SourceLocation;
  detail?: string;
  routeSource?: SourceLocation;
  controllerSource?: SourceLocation;
  controllerClass?: string;
  method?: string;
  modelClass?: string;
  relatedModelClass?: string;
  table?: string;
  columnType?: string;
  middlewareClass?: string;
  uri?: string;
  httpMethod?: string;
  routeName?: string;
}

export type IdeJsonCompletionKind =
  | "routeName"
  | "configKey"
  | "viewName"
  | "translationKey"
  | "environmentVariable"
  | "filesystemDisk"
  | "staticStrings";

export type IdeJsonTarget = "function" | "method" | "constructor" | "arrayKey" | "arrayValue";

export interface IdeJsonCompletionRule {
  target: IdeJsonTarget;
  name: string;
  parameter: number;
  kind: IdeJsonCompletionKind;
  values?: string[];
  package?: string;
  version?: string;
}

export interface RouteControllerScope {
  file: string;
  controllerClass: string;
  bodyStart: number;
  bodyEnd: number;
}

export type LaravelIndexKind =
  | "route"
  | "http-route"
  | "view"
  | "config"
  | "translation"
  | "env"
  | "blade-component"
  | "validation-rule"
  | "request-field"
  | "route-middleware"
  | "controller-method"
  | "route-action"
  | "filesystem-disk"
  | "eloquent-model"
  | "database-table"
  | "database-column"
  | "eloquent-field"
  | "eloquent-relation"
  | "eloquent-scope"
  | "eloquent-factory-state"
  | "livewire-component"
  | "inertia-page"
  | "filament-resource"
  | "nova-resource";

export interface LaravelIndexSnapshot {
  projectRoot: string;
  indexedAt: number;
  routes: IndexedItem[];
  httpRoutes: IndexedItem[];
  views: IndexedItem[];
  config: IndexedItem[];
  translations: IndexedItem[];
  env: IndexedItem[];
  bladeComponents: IndexedItem[];
  validationRules: IndexedItem[];
  requestFields: IndexedItem[];
  routeMiddleware: IndexedItem[];
  controllerMethods: IndexedItem[];
  routeActions: IndexedItem[];
  routeControllerScopes: RouteControllerScope[];
  filesystemDisks: IndexedItem[];
  eloquentModels: IndexedItem[];
  databaseTables: IndexedItem[];
  databaseColumns: IndexedItem[];
  eloquentFields: IndexedItem[];
  eloquentRelations: IndexedItem[];
  eloquentScopes: IndexedItem[];
  eloquentFactoryStates: IndexedItem[];
  livewireComponents: IndexedItem[];
  inertiaPages: IndexedItem[];
  filamentResources: IndexedItem[];
  novaResources: IndexedItem[];
  ideJsonRules: IdeJsonCompletionRule[];
}

export interface IndexStats {
  routes: number;
  httpRoutes: number;
  views: number;
  config: number;
  translations: number;
  env: number;
  bladeComponents: number;
  validationRules: number;
  requestFields: number;
  routeMiddleware: number;
  controllerMethods: number;
  routeActions: number;
  filesystemDisks: number;
  eloquentModels: number;
  databaseTables: number;
  databaseColumns: number;
  eloquentFields: number;
  eloquentRelations: number;
  eloquentScopes: number;
  eloquentFactoryStates: number;
  livewireComponents: number;
  inertiaPages: number;
  filamentResources: number;
  novaResources: number;
}

export interface LaravelProject {
  root: string;
  composerPackages: string[];
}
