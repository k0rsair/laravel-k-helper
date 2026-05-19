import path from "node:path";
import { readTextFile } from "../utils/files";
import type { LaravelProject } from "./types";
import type { Logger } from "../logging/logger";

const LARAVEL_PACKAGES = [
  "laravel/framework",
  "laravel/lumen-framework",
  "illuminate/support",
  "laravel-zero/framework",
];

export async function detectLaravelProject(
  workspaceRoot: string,
  configuredRoot: string | undefined,
  logger: Logger,
): Promise<LaravelProject | undefined> {
  const projectRoot = configuredRoot ? path.resolve(workspaceRoot, configuredRoot) : workspaceRoot;
  const composerPath = path.join(projectRoot, "composer.json");
  const composerText = await readTextFile(composerPath);

  logger.debug("[LaravelProjectDetector.detect] checking workspace", {
    workspaceRoot,
    projectRoot,
    composerFile: composerPath,
  });

  if (!composerText) {
    logger.info("[LaravelProjectDetector.detect] composer.json not found", { projectRoot });
    return undefined;
  }

  let composer: ComposerJson;
  try {
    composer = JSON.parse(composerText) as ComposerJson;
  } catch (error) {
    logger.warn("[LaravelProjectDetector.detect] composer.json is not valid JSON", {
      projectRoot,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }

  const packages = Object.keys({
    ...(composer.require ?? {}),
    ...(composer["require-dev"] ?? {}),
  });
  const isLaravel = packages.some((pkg) => LARAVEL_PACKAGES.includes(pkg));

  if (!isLaravel) {
    logger.info("[LaravelProjectDetector.detect] workspace is not a Laravel project", {
      projectRoot,
      packageCount: packages.length,
    });
    return undefined;
  }

  logger.info("[LaravelProjectDetector.detect] Laravel project detected", {
    projectRoot,
    composerPackages: packages.filter((pkg) => LARAVEL_PACKAGES.includes(pkg)),
  });

  return {
    root: projectRoot,
    composerPackages: packages,
  };
}

interface ComposerJson {
  require?: Record<string, string>;
  "require-dev"?: Record<string, string>;
}
