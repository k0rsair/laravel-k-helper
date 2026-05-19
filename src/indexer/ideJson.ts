import path from "node:path";
import type { Logger } from "../logging/logger";
import { readTextFile } from "../utils/files";
import type { IdeJsonCompletionKind, IdeJsonCompletionRule } from "./types";
import { IDE_JSON_PACKAGE_PRESETS } from "./ideJsonPresets";

const SUPPORTED_KINDS = new Set<IdeJsonCompletionKind>([
  "routeName",
  "configKey",
  "viewName",
  "translationKey",
  "environmentVariable",
  "filesystemDisk",
  "staticStrings",
]);

export async function scanIdeJsonRules(projectRoot: string, logger: Logger): Promise<IdeJsonCompletionRule[]> {
  const file = path.join(projectRoot, "ide.json");
  const text = await readTextFile(file);
  if (!text) {
    logger.debug("[LaravelIndex.scanIdeJsonRules] ide.json not found", { file });
    return [];
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    logger.warn("[LaravelIndex.scanIdeJsonRules] invalid JSON", {
      file,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  const packages = await readComposerPackages(projectRoot);
  const presetRules = IDE_JSON_PACKAGE_PRESETS
    .filter((preset) => packages.has(preset.package))
    .flatMap((preset) => preset.rules);
  const rules = [...normalizeIdeJsonRules(payload), ...presetRules].filter((rule) => packageRuleMatches(rule, packages));
  logger.debug("[LaravelIndex.scanIdeJsonRules] completed", { file, items: rules.length, packages: packages.size });
  return rules;
}

export function normalizeIdeJsonRules(payload: unknown): IdeJsonCompletionRule[] {
  if (!isRecord(payload)) {
    return [];
  }

  const completions = Array.isArray(payload.completions) ? payload.completions : [];
  return completions.flatMap((entry) => normalizeRule(entry));
}

function normalizeRule(entry: unknown): IdeJsonCompletionRule[] {
  if (!isRecord(entry)) {
    return [];
  }

  const target = resolveTarget(entry);
  const kind = typeof entry.kind === "string" && SUPPORTED_KINDS.has(entry.kind as IdeJsonCompletionKind)
    ? (entry.kind as IdeJsonCompletionKind)
    : undefined;
  const parameter = typeof entry.parameter === "number" && Number.isInteger(entry.parameter) ? entry.parameter : 0;
  const packageName = typeof entry.package === "string" ? entry.package : undefined;
  const version = typeof entry.version === "string" ? entry.version : undefined;

  if (!target || !kind) {
    return [];
  }

  const values = Array.isArray(entry.values)
    ? entry.values.filter((value): value is string => typeof value === "string")
    : undefined;

  if (kind === "staticStrings" && (!values || values.length === 0)) {
    return [];
  }

  return [{ ...target, parameter, kind, values, package: packageName, version }];
}

function resolveTarget(entry: Record<string, unknown>): { target: IdeJsonCompletionRule["target"]; name: string } | undefined {
  for (const key of ["function", "method", "constructor", "arrayKey", "arrayValue"] as const) {
    const value = entry[key];
    if (typeof value === "string" && value.length > 0) {
      return { target: key, name: value };
    }
  }
  return undefined;
}

function packageRuleMatches(rule: IdeJsonCompletionRule, packages: Map<string, string>): boolean {
  if (!rule.package) {
    return true;
  }

  const installedVersion = packages.get(rule.package);
  if (!installedVersion) {
    return false;
  }

  return !rule.version || composerConstraintMatches(installedVersion, rule.version);
}

export function composerConstraintMatches(installedVersion: string, constraint: string): boolean {
  const installedMajor = extractMajorVersion(installedVersion);
  if (installedMajor === undefined) {
    return true;
  }

  return constraint
    .split("||")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => composerConstraintPartMatches(installedMajor, part));
}

function composerConstraintPartMatches(installedMajor: number, constraint: string): boolean {
  const comparisons = [...constraint.matchAll(/(\^|~|>=|<=|>|<)?\s*(\d+)(?:\.\d+)?(?:\.\d+)?/g)];
  if (comparisons.length === 0) {
    return true;
  }

  return comparisons.every((comparison) => {
    const operator = comparison[1] ?? "=";
    const constraintMajor = Number.parseInt(comparison[2], 10);

    switch (operator) {
      case "^":
      case "~":
      case "=":
        return installedMajor === constraintMajor;
      case ">=":
        return installedMajor >= constraintMajor;
      case ">":
        return installedMajor > constraintMajor;
      case "<=":
        return installedMajor <= constraintMajor;
      case "<":
        return installedMajor < constraintMajor;
      default:
        return true;
    }
  });
}

function extractMajorVersion(value: string): number | undefined {
  const match = /(\d+)(?:\.\d+)?(?:\.\d+)?/.exec(value);
  return match?.[1] ? Number.parseInt(match[1], 10) : undefined;
}

async function readComposerPackages(projectRoot: string): Promise<Map<string, string>> {
  const text = await readTextFile(path.join(projectRoot, "composer.json"));
  if (!text) {
    return new Map();
  }

  try {
    const composer = JSON.parse(text) as { require?: Record<string, string>; "require-dev"?: Record<string, string> };
    return new Map(Object.entries({ ...(composer.require ?? {}), ...(composer["require-dev"] ?? {}) }));
  } catch {
    return new Map();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
