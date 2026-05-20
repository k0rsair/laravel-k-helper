import * as vscode from "vscode";
import type { Logger } from "../logging/logger";

export class ReindexScheduler {
  private timer: NodeJS.Timeout | undefined;

  public constructor(
    private readonly reindex: () => Promise<void>,
    private readonly logger: Logger,
    private readonly delayMs = 250,
  ) {}

  public schedule(reason: string): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.logger.debug("[ReindexScheduler.schedule] scheduled", { reason, delayMs: this.delayMs });
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.reindex().catch((error: unknown) => {
        this.logger.error("[ReindexScheduler.schedule] reindex failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.delayMs);
  }

  public dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}

export function createLaravelWatchers(
  workspaceFolder: vscode.WorkspaceFolder,
  scheduler: ReindexScheduler,
): vscode.Disposable[] {
  const patterns = [
    "routes/**/*.php",
    "resources/views/**/*.blade.php",
    "config/**/*.php",
    "lang/**/*.{php,json}",
    ".env",
    ".env.example",
    "app/View/Components/**/*.php",
    "app/Http/Requests/**/*.php",
    "app/Rules/**/*.php",
    "app/**/*.php",
    "database/migrations/**/*.php",
  ];

  return patterns.map((pattern) => {
    const fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder, pattern));
    fileWatcher.onDidCreate(() => scheduler.schedule(`created:${pattern}`));
    fileWatcher.onDidChange(() => scheduler.schedule(`changed:${pattern}`));
    fileWatcher.onDidDelete(() => scheduler.schedule(`deleted:${pattern}`));
    return fileWatcher;
  });
}
