import type { LaravelIndex } from "../indexer";
import type { IndexedItem } from "../indexer/types";
import type { Logger } from "../logging/logger";
import { readTextFile } from "../utils/files";

export interface ModelDiagnosticFinding {
  code: string;
  file: string;
  line: number;
  character: number;
  endCharacter: number;
  message: string;
}

export async function buildModelDiagnosticFindings(
  index: LaravelIndex | undefined,
  logger: Logger,
): Promise<ModelDiagnosticFinding[]> {
  const snapshot = index?.current();
  if (!snapshot) {
    return [];
  }

  const findings: ModelDiagnosticFinding[] = [];

  for (const model of snapshot.eloquentModels) {
    const modelClass = model.modelClass ?? model.key;
    const table = model.table;
    if (!table) {
      continue;
    }

    const text = await readTextFile(model.source.file);
    if (!text) {
      continue;
    }

    const knownColumns = new Map(
      snapshot.databaseColumns
        .filter((column) => column.table === table)
        .map((column) => [column.key, column] as const),
    );
    if (knownColumns.size === 0) {
      continue;
    }

    for (const entry of scanArrayEntries(text, "fillable")) {
      if (knownColumns.has(entry.value)) {
        continue;
      }
      findings.push(createFinding(model.source.file, text, entry.index, "unknown-fillable", `Unknown $fillable column "${entry.value}" on ${modelClass}.`));
      logger.debug("[ModelDiagnostics] unknown fillable key", { modelClass, key: entry.value });
    }

    for (const entry of scanArrayEntries(text, "guarded")) {
      if (knownColumns.has(entry.value)) {
        continue;
      }
      findings.push(createFinding(model.source.file, text, entry.index, "unknown-guarded", `Unknown $guarded column "${entry.value}" on ${modelClass}.`));
      logger.debug("[ModelDiagnostics] unknown guarded key", { modelClass, key: entry.value });
    }

    for (const entry of [...scanCastEntries(text, "$casts"), ...scanCastEntries(text, "casts()")]) {
      const column = knownColumns.get(entry.key);
      if (!column) {
        findings.push(createFinding(model.source.file, text, entry.index, "unknown-cast-key", `Unknown $casts key "${entry.key}" on ${modelClass}.`));
        logger.debug("[ModelDiagnostics] unknown cast key", { modelClass, key: entry.key });
        continue;
      }

      if (!isCastCompatible(entry.castType, column)) {
        findings.push(
          createFinding(
            model.source.file,
            text,
            entry.castIndex,
            "cast-type-mismatch",
            `Suspicious cast "${entry.castType}" for ${entry.key} (${column.columnType ?? "unknown"} column).`,
          ),
        );
        logger.debug("[ModelDiagnostics] cast type mismatch", {
          modelClass,
          key: entry.key,
          castType: entry.castType,
          columnType: column.columnType,
        });
      }
    }
  }

  logger.info("[ModelDiagnostics] completed", {
    findings: findings.length,
    byCode: findings.reduce<Record<string, number>>((carry, finding) => {
      carry[finding.code] = (carry[finding.code] ?? 0) + 1;
      return carry;
    }, {}),
  });

  return findings;
}

function scanArrayEntries(text: string, property: "fillable" | "guarded"): Array<{ value: string; index: number }> {
  const match = new RegExp(`\\$${property}\\s*=\\s*\\[([\\s\\S]*?)\\];`).exec(text);
  if (!match?.[1] || match.index === undefined) {
    return [];
  }

  const start = match.index + match[0].indexOf(match[1]);
  return [...match[1].matchAll(/['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g)]
    .filter((entry) => entry[1] !== undefined && entry.index !== undefined)
    .map((entry) => ({
      value: entry[1] ?? "",
      index: start + (entry.index ?? 0) + entry[0].indexOf(entry[1] ?? ""),
    }));
}

function scanCastEntries(text: string, source: "$casts" | "casts()"): Array<{ key: string; castType: string; index: number; castIndex: number }> {
  const block =
    source === "$casts"
      ? /\$casts\s*=\s*\[([\s\S]*?)\];/.exec(text)
      : /function\s+casts\s*\([^)]*\)\s*:\s*array\s*\{[\s\S]*?return\s*\[([\s\S]*?)\];[\s\S]*?\}/.exec(text);
  if (!block?.[1] || block.index === undefined) {
    return [];
  }

  const start = block.index + block[0].indexOf(block[1]);
  return [...block[1].matchAll(/['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*=>\s*['"]([^'"]+)['"]/g)]
    .filter((entry) => entry[1] !== undefined && entry[2] !== undefined && entry.index !== undefined)
    .map((entry) => ({
      key: entry[1] ?? "",
      castType: entry[2] ?? "",
      index: start + (entry.index ?? 0) + entry[0].indexOf(entry[1] ?? ""),
      castIndex: start + (entry.index ?? 0) + entry[0].lastIndexOf(entry[2] ?? ""),
    }));
}

function isCastCompatible(castType: string, column: IndexedItem): boolean {
  const normalizedCast = castType.toLowerCase();
  const normalizedColumnType = column.columnType?.toLowerCase();
  if (!normalizedColumnType) {
    return true;
  }

  if (["json", "jsonb"].includes(normalizedColumnType)) {
    return ["array", "object", "collection", "encrypted:array", "encrypted:collection"].includes(normalizedCast);
  }
  if (normalizedColumnType === "boolean") {
    return normalizedCast === "boolean";
  }
  if (["integer", "tinyinteger", "smallinteger", "mediuminteger", "biginteger", "unsignedbiginteger", "id", "foreignid", "year"].includes(normalizedColumnType)) {
    return normalizedCast === "integer";
  }
  if (normalizedColumnType === "decimal") {
    return normalizedCast.startsWith("decimal");
  }
  if (normalizedColumnType === "float") {
    return normalizedCast === "float";
  }
  if (normalizedColumnType === "double") {
    return normalizedCast === "double";
  }
  if (["date", "datetime", "datetz", "datetimetz", "time", "timetz", "timestamp", "timestamptz"].includes(normalizedColumnType)) {
    return /date|datetime|immutable_datetime|immutable_date|timestamp/.test(normalizedCast);
  }

  return true;
}

function createFinding(file: string, text: string, offset: number, code: string, message: string): ModelDiagnosticFinding {
  const before = text.slice(0, offset);
  const lines = before.split(/\r?\n/);
  const line = lines.length - 1;
  const character = lines[lines.length - 1]?.length ?? 0;
  return {
    code,
    file,
    line,
    character,
    endCharacter: character + 1,
    message,
  };
}
