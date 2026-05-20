import path from "node:path";

export type LaravelArtifactType = "controller" | "form-request";

export interface LaravelArtifact {
  type: LaravelArtifactType;
  className: string;
  namespace: string;
  relativePath: string;
  absolutePath: string;
  content: string;
}

export function buildLaravelArtifact(projectRoot: string, type: LaravelArtifactType, rawName: string): LaravelArtifact {
  const segments = normalizeClassSegments(rawName);
  const className = segments[segments.length - 1]!;
  const namespaceSegments = segments.slice(0, -1);

  if (type === "controller") {
    const namespace = ["App", "Http", "Controllers", ...namespaceSegments].join("\\");
    const relativePath = path.join("app", "Http", "Controllers", ...namespaceSegments, `${className}.php`);
    return {
      type,
      className,
      namespace,
      relativePath,
      absolutePath: path.join(projectRoot, relativePath),
      content: renderController(namespace, className),
    };
  }

  const namespace = ["App", "Http", "Requests", ...namespaceSegments].join("\\");
  const relativePath = path.join("app", "Http", "Requests", ...namespaceSegments, `${className}.php`);
  return {
    type,
    className,
    namespace,
    relativePath,
    absolutePath: path.join(projectRoot, relativePath),
    content: renderFormRequest(namespace, className),
  };
}

function normalizeClassSegments(rawName: string): string[] {
  const segments = rawName
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    throw new Error("Artifact name is required.");
  }

  for (const segment of segments) {
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(segment)) {
      throw new Error("Artifact names must use PHP class segments such as Admin/UserController.");
    }
  }

  return segments;
}

function renderController(namespace: string, className: string): string {
  return `<?php

namespace ${namespace};

use Illuminate\\Http\\Request;

class ${className}
{
    public function __invoke(Request $request)
    {
        //
    }
}
`;
}

function renderFormRequest(namespace: string, className: string): string {
  return `<?php

namespace ${namespace};

use Illuminate\\Foundation\\Http\\FormRequest;

class ${className} extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            //
        ];
    }
}
`;
}
