import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { onRequest } from "../functions/api/pilot-request.js";

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

function makeRequest(payload, headers = {}) {
  return new Request("https://bidframe.co/api/pilot-request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://bidframe.co",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

function validPayload(overrides = {}) {
  return {
    email: "producer@example.com",
    bidVolume: "15-50",
    companyUrl: "",
    submissionId: "4e5bf9bd-e0f8-4d72-9a84-1aab4e116724",
    ...overrides,
  };
}

test("sends a valid pilot request through Resend", async () => {
  let providerRequest;
  globalThis.fetch = async (request, options) => {
    providerRequest = { request, options };
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  };
  console.log = () => {};

  const response = await onRequest({
    request: makeRequest(validPayload()),
    env: { RESEND_API_KEY: "test-key" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(providerRequest.request, "https://api.resend.com/emails");
  assert.equal(providerRequest.options.headers.Authorization, "Bearer test-key");
  assert.equal(providerRequest.options.headers["Idempotency-Key"], `pilot-request/${validPayload().submissionId}`);

  const email = JSON.parse(providerRequest.options.body);
  assert.equal(email.from, "BidFrame Website <michael@bidframe.co>");
  assert.deepEqual(email.to, ["michael@bidframe.co"]);
  assert.equal(email.reply_to, "producer@example.com");
  assert.match(email.text, /15 to 50 bids/);
});

test("rejects invalid form values before calling the provider", async () => {
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    return new Response(null, { status: 200 });
  };

  const response = await onRequest({
    request: makeRequest(validPayload({ email: "not-an-email", bidVolume: "hundreds" })),
    env: { RESEND_API_KEY: "test-key" },
  });

  assert.equal(response.status, 400);
  assert.equal(providerCalled, false);
});

test("rejects unsafe characters in an email address", async () => {
  const response = await onRequest({
    request: makeRequest(validPayload({ email: "<producer>@example.com" })),
    env: { RESEND_API_KEY: "test-key" },
  });

  assert.equal(response.status, 400);
});

test("accepts the honeypot silently without sending email", async () => {
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    return new Response(null, { status: 200 });
  };

  const response = await onRequest({
    request: makeRequest(validPayload({ companyUrl: "https://spam.example" })),
    env: { RESEND_API_KEY: "test-key" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(providerCalled, false);
});

test("rejects cross-origin submissions", async () => {
  const response = await onRequest({
    request: makeRequest(validPayload(), { Origin: "https://attacker.example" }),
    env: { RESEND_API_KEY: "test-key" },
  });

  assert.equal(response.status, 403);
});

test("rejects requests without a browser origin", async () => {
  const request = makeRequest(validPayload());
  request.headers.delete("Origin");

  const response = await onRequest({
    request,
    env: { RESEND_API_KEY: "test-key" },
  });

  assert.equal(response.status, 403);
});

test("allows only POST requests", async () => {
  const response = await onRequest({
    request: new Request("https://bidframe.co/api/pilot-request", {
      method: "GET",
      headers: { Origin: "https://bidframe.co" },
    }),
    env: { RESEND_API_KEY: "test-key" },
  });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "POST");
});

test("rejects oversized bodies before parsing them", async () => {
  const response = await onRequest({
    request: makeRequest(validPayload(), { "Content-Length": "4097" }),
    env: { RESEND_API_KEY: "test-key" },
  });

  assert.equal(response.status, 413);
});

test("returns a safe error when Resend rejects delivery", async () => {
  globalThis.fetch = async () => new Response(null, { status: 429 });
  console.error = () => {};

  const response = await onRequest({
    request: makeRequest(validPayload()),
    env: { RESEND_API_KEY: "test-key" },
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "The request could not be sent. Try again or email michael@bidframe.co.",
  });
});

test("fails closed when the Resend secret is missing", async () => {
  console.error = () => {};

  const response = await onRequest({
    request: makeRequest(validPayload()),
    env: {},
  });

  assert.equal(response.status, 503);
});
