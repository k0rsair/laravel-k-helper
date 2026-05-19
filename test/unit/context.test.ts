import { describe, expect, it } from "vitest";
import {
  extractQuotedStringAtOffset,
  resolveBladeComponentPrefix,
  resolveIdeJsonStringContext,
  resolveStringContext,
} from "../../src/context/completionContext";

describe("completion context", () => {
  it("resolves Laravel helper contexts", () => {
    expect(resolveStringContext("return route('users.", "php")).toMatchObject({
      kind: "route",
      prefix: "users.",
    });
    expect(resolveStringContext("{{ __('messages.", "blade")).toMatchObject({
      kind: "translation",
      prefix: "messages.",
    });
    expect(resolveStringContext("@include('users.", "blade")).toMatchObject({
      kind: "view",
      prefix: "users.",
    });
    expect(resolveStringContext("return config('services.mailgun.endpoint.", "php")).toMatchObject({
      kind: "config",
      prefix: "services.mailgun.endpoint.",
      rangeStart: 15,
    });
    expect(resolveStringContext("$request->input('em", "php")).toMatchObject({
      kind: "request-field",
      prefix: "em",
    });
    expect(resolveStringContext("Storage::disk('s", "php")).toMatchObject({
      kind: "filesystem-disk",
      prefix: "s",
    });
  });

  it("resolves validation rule pipe contexts", () => {
    expect(resolveStringContext("'email' => 'required|em", "php")).toMatchObject({
      kind: "validation-rule",
      prefix: "em",
    });
  });

  it("resolves route action contexts", () => {
    expect(resolveStringContext("Route::get('{projectDelivery}/{article}', 'get", "php")).toMatchObject({
      kind: "route-action",
      prefix: "get",
    });
  });

  it("resolves ide.json custom function contexts", () => {
    expect(resolveIdeJsonStringContext("custom_route_target('us")).toEqual({
      target: "function",
      name: "custom_route_target",
      parameter: 0,
      prefix: "us",
    });
    expect(resolveIdeJsonStringContext("custom_disk($tenant, 's")).toEqual({
      target: "function",
      name: "custom_disk",
      parameter: 1,
      prefix: "s",
    });
    expect(resolveIdeJsonStringContext("$target->customMethod('wel")).toEqual({
      target: "method",
      name: "customMethod",
      parameter: 0,
      prefix: "wel",
    });
    expect(resolveIdeJsonStringContext("CustomFacade::target('app.")).toEqual({
      target: "method",
      name: "CustomFacade::target",
      parameter: 0,
      prefix: "app.",
    });
    expect(resolveIdeJsonStringContext("new App\\Support\\CustomTarget('messages.")).toEqual({
      target: "constructor",
      name: "App\\Support\\CustomTarget",
      parameter: 0,
      prefix: "messages.",
    });
    expect(resolveIdeJsonStringContext("    'dr")).toEqual({
      target: "arrayKey",
      name: "*",
      parameter: 0,
      prefix: "dr",
    });
    expect(resolveIdeJsonStringContext("    'driver' => 's")).toEqual({
      target: "arrayValue",
      name: "driver",
      parameter: 0,
      prefix: "s",
    });
  });

  it("resolves Blade component tag prefixes", () => {
    expect(resolveBladeComponentPrefix("<x-user-")).toMatchObject({
      prefix: "user.",
    });
  });

  it("extracts quoted string at cursor offset", () => {
    const line = "return route('users.index');";
    expect(extractQuotedStringAtOffset(line, 18)).toEqual({
      value: "users.index",
      start: 14,
      end: 25,
    });
  });
});
