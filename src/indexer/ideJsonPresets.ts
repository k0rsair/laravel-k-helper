import type { IdeJsonCompletionRule } from "./types";

export interface IdeJsonPackagePreset {
  package: string;
  rules: IdeJsonCompletionRule[];
}

export const IDE_JSON_PACKAGE_PRESETS: IdeJsonPackagePreset[] = [
  {
    package: "laravel/framework",
    rules: [
      {
        target: "function",
        name: "storage_disk",
        parameter: 0,
        kind: "filesystemDisk",
        package: "laravel/framework",
        version: "^10.0 || ^11.0 || ^12.0 || ^13.0",
      },
      {
        target: "method",
        name: "disk",
        parameter: 0,
        kind: "filesystemDisk",
        package: "laravel/framework",
        version: "^10.0 || ^11.0 || ^12.0 || ^13.0",
      },
    ],
  },
  {
    package: "laravel/pint",
    rules: [
      {
        target: "function",
        name: "pint_preset",
        parameter: 0,
        kind: "staticStrings",
        values: ["laravel", "psr12", "symfony"],
        package: "laravel/pint",
        version: "^1.0",
      },
    ],
  },
];
