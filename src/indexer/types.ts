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
  controllerClass?: string;
  method?: string;
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
  | "view"
  | "config"
  | "translation"
  | "env"
  | "blade-component"
  | "validation-rule"
  | "request-field"
  | "controller-method"
  | "route-action"
  | "filesystem-disk";

export interface LaravelIndexSnapshot {
  projectRoot: string;
  indexedAt: number;
  routes: IndexedItem[];
  views: IndexedItem[];
  config: IndexedItem[];
  translations: IndexedItem[];
  env: IndexedItem[];
  bladeComponents: IndexedItem[];
  validationRules: IndexedItem[];
  requestFields: IndexedItem[];
  controllerMethods: IndexedItem[];
  routeActions: IndexedItem[];
  routeControllerScopes: RouteControllerScope[];
  filesystemDisks: IndexedItem[];
  ideJsonRules: IdeJsonCompletionRule[];
}

export interface IndexStats {
  routes: number;
  views: number;
  config: number;
  translations: number;
  env: number;
  bladeComponents: number;
  validationRules: number;
  requestFields: number;
  controllerMethods: number;
  routeActions: number;
  filesystemDisks: number;
}

export interface LaravelProject {
  root: string;
  composerPackages: string[];
}
