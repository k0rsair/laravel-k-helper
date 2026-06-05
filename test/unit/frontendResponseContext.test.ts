import { describe, expect, it } from "vitest";
import {
  resolveFrontendResponseCompletionContext,
  resolveFrontendResponseFieldContext,
} from "../../src/context/frontendResponseContext";

describe("frontend response context", () => {
  it("resolves axios response.data chains", () => {
    const text = "const response = await axios.get('/api/health');\nresponse.data.st";

    expect(resolveAt(text, "st")).toMatchObject({
      kind: "response",
      prefix: "st",
      path: [],
      receiver: "response",
      request: {
        kind: "url",
        value: "/api/health",
        method: "GET",
      },
    });
  });

  it("resolves then callback response variables", () => {
    const text = "axios.post('/api/orders/1/cancel').then((response) => response.data.cancel)";

    expect(resolveAt(text, "cancel")).toMatchObject({
      kind: "response",
      prefix: "cancel",
      path: [],
      receiver: "response",
      request: {
        kind: "url",
        value: "/api/orders/1/cancel",
        method: "POST",
      },
    });
  });

  it("resolves destructured axios data variables", () => {
    const text = "const { data } = await axios.post('/api/product-statistics', payload);\ndata.na";

    expect(resolveAt(text, "na")).toMatchObject({
      kind: "response",
      prefix: "na",
      path: [],
      receiver: "data",
      request: {
        kind: "url",
        value: "/api/product-statistics",
        method: "POST",
      },
    });
  });

  it("resolves nested data paths", () => {
    const text = "const response = await axios.get('/api/health');\nresponse.data.status.na";

    expect(resolveAt(text, "na")).toMatchObject({
      kind: "response",
      prefix: "na",
      path: ["status"],
    });
  });

  it("resolves fetch json data variables", () => {
    const text = "const response = await fetch('/api/health');\nconst data = await response.json();\ndata.ok";

    expect(resolveAt(text, "ok")).toMatchObject({
      kind: "response",
      prefix: "ok",
      receiver: "data",
      request: {
        kind: "url",
        value: "/api/health",
        method: "GET",
      },
    });
  });

  it("resolves exact response.data field references for definition and hover", () => {
    const text = "const response = await axios.get('/api/users/1/resource-summary');\nresponse.data.contact.email;";

    expect(resolveFieldAt(text, "email")).toMatchObject({
      kind: "response-field",
      path: ["contact"],
      field: "email",
      fieldPath: ["contact", "email"],
      request: {
        kind: "url",
        value: "/api/users/1/resource-summary",
        method: "GET",
      },
    });
  });

  it("resolves exact destructured data field references", () => {
    const text = "const { data } = await axios.get('/api/users/1/resource-collection');\nconsole.log(data.meta.count);";

    expect(resolveFieldAt(text, "count")).toMatchObject({
      kind: "response-field",
      path: ["meta"],
      field: "count",
      fieldPath: ["meta", "count"],
      request: {
        kind: "url",
        value: "/api/users/1/resource-collection",
        method: "GET",
      },
    });
  });
});

function resolveAt(text: string, fragment: string) {
  const index = text.lastIndexOf(fragment);
  if (index < 0) {
    throw new Error(`Missing fragment: ${fragment}`);
  }
  return resolveFrontendResponseCompletionContext(text, index + fragment.length);
}

function resolveFieldAt(text: string, fragment: string) {
  const index = text.lastIndexOf(fragment);
  if (index < 0) {
    throw new Error(`Missing fragment: ${fragment}`);
  }
  return resolveFrontendResponseFieldContext(text, index + Math.max(0, fragment.length - 1));
}
