import * as vscode from "vscode";
import { detectLaravelProject } from "./indexer/detector";
import { LaravelIndex } from "./indexer";
import { createLaravelWatchers, ReindexScheduler } from "./indexer/watchers";
import { OutputLogger, type LogLevel } from "./logging/logger";
import { LaravelCompletionProvider } from "./providers/completionProvider";
import { LaravelDefinitionProvider } from "./providers/definitionProvider";
import { LaravelReferenceProvider } from "./providers/referenceProvider";
import { LaravelCodeLensProvider } from "./providers/codeLensProvider";
import { LaravelAutoSuggestTrigger } from "./providers/autoSuggestTrigger";
import { buildLaravelArtifact, type LaravelArtifactType } from "./generators/artifacts";
import { pathExists } from "./utils/files";

let activeIndex: LaravelIndex | undefined;
let logger: OutputLogger | undefined;
const EXTENSION_NAME = "Laravel K Helper";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel(EXTENSION_NAME);
  logger = new OutputLogger(output, readLogLevel());
  context.subscriptions.push(output);

  logger.info("[Extension.activate] activating Laravel K Helper");

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    logger.warn("[Extension.activate] no workspace folder open");
    registerCommands(context, () => undefined);
    return;
  }

  if (!readSetting<boolean>("enabled", true)) {
    logger.info("[Extension.activate] extension disabled by setting");
    registerCommands(context, () => undefined);
    return;
  }

  const configuredRoot = readSetting<string>("projectRoot", "") || readSetting<string>("laravelDirectory", "") || undefined;
  const project = await detectLaravelProject(workspaceFolder.uri.fsPath, configuredRoot, logger);
  if (!project) {
    registerCommands(context, () => undefined);
    return;
  }

  activeIndex = new LaravelIndex(project.root, logger);
  await activeIndex.reindex();

  const scheduler = new ReindexScheduler(async () => {
    await activeIndex?.reindex();
  }, logger);

  context.subscriptions.push(scheduler, ...createLaravelWatchers(workspaceFolder, scheduler));
  registerCommands(context, () => activeIndex, project.root);
  registerProviders(context, () => activeIndex, logger);
}

export function deactivate(): void {
  logger?.info("[Extension.deactivate] deactivated");
}

function registerCommands(context: vscode.ExtensionContext, getIndex: () => LaravelIndex | undefined, projectRoot?: string): void {
  const reindex = async () => {
    const index = getIndex();
    if (!index) {
      void vscode.window.showInformationMessage(`${EXTENSION_NAME}: no active Laravel project.`);
      return;
    }
    await index.reindex();
    void vscode.window.showInformationMessage(`${EXTENSION_NAME}: workspace reindexed.`);
  };
  const showIndexStatus = () => {
    const index = getIndex();
    const stats = index?.stats();
    const status = stats
      ? `Routes ${stats.routes}, actions ${stats.routeActions}, middleware ${stats.routeMiddleware}, views ${stats.views}, config ${stats.config}, translations ${stats.translations}, env ${stats.env}, disks ${stats.filesystemDisks}, components ${stats.bladeComponents}, Livewire ${stats.livewireComponents}, Inertia ${stats.inertiaPages}, Filament ${stats.filamentResources}, Nova ${stats.novaResources}, request fields ${stats.requestFields}, models ${stats.eloquentModels}, relations ${stats.eloquentRelations}, scopes ${stats.eloquentScopes}, factory states ${stats.eloquentFactoryStates}, tables ${stats.databaseTables}, columns ${stats.databaseColumns}`
      : "No active Laravel index.";
    void vscode.window.showInformationMessage(`${EXTENSION_NAME}: ${status}`);
    logger?.info("[Extension.showIndexStatus] status requested", { stats });
  };
  const openOutput = () => {
    logger?.show();
  };
  const generateArtifactPreview = async () => {
    if (!projectRoot) {
      void vscode.window.showInformationMessage(`${EXTENSION_NAME}: no active Laravel project.`);
      return;
    }

    const selectedType = await vscode.window.showQuickPick(
      [
        { label: "Controller", type: "controller" as const },
        { label: "Form Request", type: "form-request" as const },
      ],
      {
        title: `${EXTENSION_NAME}: Generate artifact preview`,
        placeHolder: "Choose artifact type",
      },
    );
    if (!selectedType) {
      return;
    }

    const name = await vscode.window.showInputBox({
      title: `${EXTENSION_NAME}: Artifact class`,
      prompt: "Use PHP class segments, for example Admin/ReportController.",
    });
    if (!name) {
      return;
    }

    let artifact;
    try {
      artifact = buildLaravelArtifact(projectRoot, selectedType.type satisfies LaravelArtifactType, name);
    } catch (error) {
      void vscode.window.showErrorMessage(`${EXTENSION_NAME}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    if (await pathExists(artifact.absolutePath)) {
      void vscode.window.showWarningMessage(`${EXTENSION_NAME}: ${artifact.relativePath} already exists.`);
      logger?.warn("[Extension.generateArtifactPreview] target already exists", { file: artifact.absolutePath });
      return;
    }

    const document = await vscode.workspace.openTextDocument({
      language: "php",
      content: artifact.content,
    });
    await vscode.window.showTextDocument(document, { preview: true });
    void vscode.window.showInformationMessage(`${EXTENSION_NAME}: preview for ${artifact.relativePath}`);
    logger?.info("[Extension.generateArtifactPreview] preview opened", {
      type: artifact.type,
      file: artifact.absolutePath,
    });
  };
  const openRouteReference = async (controllerMethodKey: string) => {
    const index = getIndex();
    const references = index?.routeReferencesForControllerMethod(controllerMethodKey) ?? [];
    if (references.length === 0) {
      void vscode.window.showInformationMessage(`${EXTENSION_NAME}: no route reference found.`);
      logger?.warn("[Extension.openRouteReference] no route reference found", { controllerMethodKey });
      return;
    }

    const selectedReference =
      references.length === 1
        ? references[0]
        : await vscode.window.showQuickPick(
            references.map((reference) => ({
              label: reference.key,
              description: reference.routeSource?.file,
              detail: reference.detail,
              reference,
            })),
            {
              title: `${EXTENSION_NAME}: Select route declaration`,
              placeHolder: "Choose a route declaration to open",
            },
          ).then((item) => item?.reference);

    if (!selectedReference?.routeSource) {
      logger?.debug("[Extension.openRouteReference] route reference selection cancelled", { controllerMethodKey });
      return;
    }

    const routeSource = selectedReference.routeSource;
    logger?.info("[Extension.openRouteReference] opening route reference", {
      controllerMethodKey,
      file: routeSource.file,
      line: routeSource.line,
      routeAction: selectedReference.key,
    });

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(routeSource.file));
    await vscode.window.showTextDocument(document, {
      selection: new vscode.Range(routeSource.line, routeSource.character, routeSource.line, routeSource.character),
    });
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("laravelKHelper.reindex", reindex),
    vscode.commands.registerCommand("laravelKHelper.showIndexStatus", showIndexStatus),
    vscode.commands.registerCommand("laravelKHelper.openOutput", openOutput),
    vscode.commands.registerCommand("laravelKHelper.generateArtifactPreview", generateArtifactPreview),
    vscode.commands.registerCommand("laravelKHelper.openRouteReference", openRouteReference),
    vscode.commands.registerCommand("laravelAware.reindex", reindex),
    vscode.commands.registerCommand("laravelAware.showIndexStatus", showIndexStatus),
    vscode.commands.registerCommand("laravelAware.openOutput", openOutput),
    vscode.commands.registerCommand("laravelAware.generateArtifactPreview", generateArtifactPreview),
    vscode.commands.registerCommand("laravelAware.openRouteReference", openRouteReference),
  );
}

function registerProviders(
  context: vscode.ExtensionContext,
  getIndex: () => LaravelIndex | undefined,
  activeLogger: OutputLogger,
): void {
  const selector: vscode.DocumentSelector = [
    { language: "php", scheme: "file" },
    { language: "blade", scheme: "file" },
    { pattern: "**/*.blade.php", scheme: "file" },
  ];

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      new LaravelCompletionProvider(getIndex, activeLogger),
      "'",
      '"',
      ".",
      "-",
      ":",
      ">",
    ),
    vscode.languages.registerDefinitionProvider(selector, new LaravelDefinitionProvider(getIndex, activeLogger)),
    vscode.languages.registerReferenceProvider(selector, new LaravelReferenceProvider(getIndex, activeLogger)),
    vscode.languages.registerCodeLensProvider(selector, new LaravelCodeLensProvider(getIndex, activeLogger)),
    new LaravelAutoSuggestTrigger(() => readSetting<boolean>("autoTriggerSuggest", true), activeLogger),
  );
}

function readLogLevel(): LogLevel {
  return readSetting<LogLevel>("logLevel", "debug");
}

function readSetting<T>(key: string, fallback: T): T {
  const nextConfig = vscode.workspace.getConfiguration("laravelKHelper");
  const nextValue = nextConfig.get<T>(key);
  if (nextValue !== undefined && nextValue !== "") {
    return nextValue;
  }

  const assistConfig = vscode.workspace.getConfiguration("laravelAssist");
  const assistValue = assistConfig.get<T>(key);
  if (assistValue !== undefined && assistValue !== "") {
    return assistValue;
  }

  const awareConfig = vscode.workspace.getConfiguration("laravelAware");
  const awareValue = awareConfig.get<T>(key);
  if (awareValue !== undefined) {
    return awareValue;
  }

  return fallback;
}
