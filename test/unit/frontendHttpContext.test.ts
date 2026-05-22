import { describe, expect, it } from "vitest";
import {
  extractFrontendHttpRequestAtOffset,
  extractFrontendHttpRequestsFromLine,
  routePatternFromExpression,
} from "../../src/context/frontendHttpContext";

describe("frontend HTTP context", () => {
  it("resolves axios method calls", () => {
    const line = "axios.post('/users', payload)";

    expect(extractFrontendHttpRequestAtOffset(line, line.indexOf("/users") + 2)).toMatchObject({
      kind: "url",
      value: "/users",
      method: "POST",
    });
  });

  it("resolves fetch calls with default and explicit methods", () => {
    expect(extractFrontendHttpRequestAtOffset("fetch('/users')", 9)).toMatchObject({
      kind: "url",
      value: "/users",
      method: "GET",
    });

    expect(extractFrontendHttpRequestAtOffset("fetch('/users', { method: 'POST' })", 9)).toMatchObject({
      kind: "url",
      value: "/users",
      method: "POST",
    });
  });

  it("resolves axios object calls and route helpers", () => {
    expect(extractFrontendHttpRequestAtOffset("axios({ method: 'DELETE', url: '/users/1' })", 36)).toMatchObject({
      kind: "url",
      value: "/users/1",
      method: "DELETE",
    });

    expect(extractFrontendHttpRequestAtOffset("route('users.index')", 9)).toMatchObject({
      kind: "route-name",
      value: "users.index",
    });
  });

  it("normalizes dynamic route expressions", () => {
    expect(routePatternFromExpression("'/users/' + userId + '/orders'")).toBe("/users/{param}/orders");
    expect(routePatternFromExpression("`/users/${userId}/orders`")).toBe("/users/{param}/orders");
    expect(routePatternFromExpression("'/api/products/' + productId")).toBe("/api/products/{param}");
  });

  it("extracts line-level dynamic request references for CodeLens", () => {
    expect(extractFrontendHttpRequestsFromLine("axios.post('/users/' + userId + '/orders', payload)")).toEqual([
      expect.objectContaining({
        kind: "url",
        value: "/users/{param}/orders",
        method: "POST",
      }),
    ]);

    expect(extractFrontendHttpRequestsFromLine("fetch(`/users/${userId}/orders`, { method: 'PATCH' })")).toEqual([
      expect.objectContaining({
        kind: "url",
        value: "/users/{param}/orders",
        method: "PATCH",
      }),
    ]);
  });

  it("ignores unrelated strings", () => {
    expect(extractFrontendHttpRequestAtOffset("const label = '/users'", 16)).toBeUndefined();
  });
});
