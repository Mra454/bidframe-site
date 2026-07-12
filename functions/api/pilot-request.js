const MAX_BODY_BYTES = 4096;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNSAFE_EMAIL_CHARACTERS = /[<>"\x00-\x1f\x7f]/;
const SUBMISSION_ID_PATTERN = /^[a-zA-Z0-9-]{1,64}$/;
const BID_VOLUMES = Object.freeze({
  "under-15": "Under 15 bids",
  "15-50": "15 to 50 bids",
  "over-50": "More than 50 bids",
});

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Enter a valid work email and bid volume." };
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const bidVolume = typeof payload.bidVolume === "string" ? payload.bidVolume : "";
  const companyUrl = typeof payload.companyUrl === "string" ? payload.companyUrl.trim() : "";
  const submissionId = typeof payload.submissionId === "string" ? payload.submissionId : "";

  if (companyUrl) return { isSpam: true };
  if (!email || email.length > 254 || UNSAFE_EMAIL_CHARACTERS.test(email) || !EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid work email." };
  }
  if (!Object.hasOwn(BID_VOLUMES, bidVolume)) {
    return { error: "Select an annual bid volume." };
  }
  if (!SUBMISSION_ID_PATTERN.test(submissionId)) {
    return { error: "Refresh the page and try again." };
  }

  return { email, bidVolume, submissionId };
}

async function sendPilotRequest(env, submission) {
  const requestId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const volumeLabel = BID_VOLUMES[submission.bidVolume];
  const safeEmail = escapeHtml(submission.email);
  const safeVolume = escapeHtml(volumeLabel);
  const safeSubmittedAt = escapeHtml(submittedAt);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `pilot-request/${submission.submissionId}`,
    },
    body: JSON.stringify({
      from: "BidFrame Website <michael@bidframe.co>",
      to: ["michael@bidframe.co"],
      reply_to: submission.email,
      subject: "New BidFrame pilot request",
      text: [
        "New BidFrame pilot request",
        "",
        `Work email: ${submission.email}`,
        `Approximate annual bid volume: ${volumeLabel}`,
        `Submitted: ${submittedAt}`,
        `Request ID: ${requestId}`,
      ].join("\n"),
      html: [
        "<h1>New BidFrame pilot request</h1>",
        `<p><strong>Work email:</strong> ${safeEmail}</p>`,
        `<p><strong>Approximate annual bid volume:</strong> ${safeVolume}</p>`,
        `<p><strong>Submitted:</strong> ${safeSubmittedAt}</p>`,
        `<p><strong>Request ID:</strong> ${requestId}</p>`,
      ].join(""),
    }),
  });

  if (!response.ok) {
    console.error(JSON.stringify({
      event: "pilot_request_delivery_failed",
      requestId,
      provider: "resend",
      providerStatus: response.status,
    }));
    throw new Error("Email provider rejected the request");
  }

  console.log(JSON.stringify({
    event: "pilot_request_delivered",
    requestId,
    bidVolume: submission.bidVolume,
  }));
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST" });
  }

  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Request origin was not accepted." }, 403);
  }

  const contentLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request is too large." }, 413);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "Content type must be application/json." }, 415);
  }

  let payload;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Request is too large." }, 413);
    }
    payload = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const submission = validatePayload(payload);
  if (submission.isSpam) return jsonResponse({ ok: true });
  if (submission.error) return jsonResponse({ error: submission.error }, 400);
  if (!env.RESEND_API_KEY) {
    console.error(JSON.stringify({ event: "pilot_request_configuration_error" }));
    return jsonResponse({ error: "Request service is temporarily unavailable." }, 503);
  }

  try {
    await sendPilotRequest(env, submission);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({
      event: "pilot_request_failed",
      error: error instanceof Error ? error.message : "Unknown error",
    }));
    return jsonResponse({ error: "The request could not be sent. Try again or email michael@bidframe.co." }, 502);
  }
}
