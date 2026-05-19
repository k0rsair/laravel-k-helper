import * as vscode from "vscode";
import { detectLaravelProject } from "./indexer/detector";
import { LaravelIndex } from "./indexer";
import { createLaravelWatchers, ReindexScheduler } from "./indexer/watchers";
import { OutputLogger, type LogLevel } from "./logging/logger";
import { LaravelCompletionProvider } from "./providers/completionProvider";
import { LaravelDefinitionProvider } from "./providers/definitionProvider";
import { LaravelReferenceProvider } from "./providers/referenceProvider";
import { LaravelCodeLensProvider } from "./providers/codeLensProvider";

let activeIndex: LaravelIndex | undefined;
let logger: OutputLogger | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel("Laravel Aware");
  logger = new OutputLogger(output, readLogLevel());
  context.subscriptions.push(output);

  logger.info("[Extension.activate] activating Laravel Aware");

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    logger.warn("[Extension.activate] no workspace folder open");
    registerCommands(context, () => undefined);
    return;
  }

  const config = vscode.workspace.getConfiguration("laravelAware");
  if (!config.get<boolean>("enabled", true)) {
    logger.info("[Extension.activate] extension disabled by setting");
    registerCommands(context, () => undefined);
    return;
  }

  const configuredRoot = config.get<string>("projectRoot") || config.get<string>("laravelDirectory") || undefined;
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
  registerCommands(context, () => activeIndex);
  registerProviders(context, () => activeIndex, logger);
}

export function deactivate(): void {
  logger?.info("[Extension.deactivate] deactivated");
}

function registerCommands(context: vscode.ExtensionContext, getIndex: () => LaravelIndex | undefined): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("laravelAware.reindex", async () => {
      const index = getIndex();
      if (!index) {
        void vscode.window.showInformationMessage("Laravel Aware: no active Laravel project.");
        return;
      }
      await index.reindex();
      void vscode.window.showInformationMessage("Laravel Aware: workspace reindexed.");
    }),
    vscode.commands.registerCommand("laravelAware.showIndexStatus", () => {
      const index = getIndex();
      const stats = index?.stats();
      const status = stats
        ? `Routes ${stats.routes}, actions ${stats.routeActions}, views ${stats.views}, config ${stats.config}, translations ${stats.translations}, env ${stats.env}, disks ${stats.filesystemDisks}, components ${stats.bladeComponents}, request fields ${stats.requestFields}`
        : "No active Laravel index.";
      void vscode.window.showInformationMessage(`Laravel Aware: ${status}`);
      logger?.info("[Extension.showIndexStatus] status requested", { stats });
    }),
    vscode.commands.registerCommand("laravelAware.openOutput", () => {
      logger?.show();
    }),
    vscode.commands.registerCommand("laravelAware.openRouteReference", async (controllerMethodKey: string) => {
      const index = getIndex();
      const references = index?.routeReferencesForControllerMethod(controllerMethodKey) ?? [];
      if (references.length === 0) {
        void vscode.window.showInformationMessage("Laravel Aware: no route reference found.");
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
                title: "Laravel Aware: Select route declaration",
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
    }),
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
    ),
    vscode.languages.registerDefinitionProvider(selector, new LaravelDefinitionProvider(getIndex, activeLogger)),
    vscode.languages.registerReferenceProvider(selector, new LaravelReferenceProvider(getIndex, activeLogger)),
    vscode.languages.registerCodeLensProvider(selector, new LaravelCodeLensProvider(getIndex, activeLogger)),
  );
}

function readLogLevel(): LogLevel {
  return vscode.workspace.getConfiguration("laravelAware").get<LogLevel>("logLevel", "debug");
}
