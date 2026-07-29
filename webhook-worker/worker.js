export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-line-signature") || "";
    if (!(await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET))) {
      return new Response("Invalid signature", { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const events = (payload.events || [])
      .filter((event) =>
        event?.type === "message" &&
        event?.source?.type === "user" &&
        event?.source?.userId
      )
      .map((event) => ({
        webhookEventId: String(event.webhookEventId || ""),
        lineUserId: String(event.source.userId),
        timestamp: Number(event.timestamp || Date.now()),
        messageId: String(event.message?.id || ""),
        messageType: String(event.message?.type || "unknown"),
        textPreview: event.message?.type === "text"
          ? String(event.message.text || "").slice(0, 160)
          : "",
        isRedelivery: event.deliveryContext?.isRedelivery === true,
      }));

    if (events.length) {
      const response = await fetch(env.GAS_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "recordLineWebhookSignals",
          forwardingSecret: env.WEBHOOK_FORWARDING_SECRET,
          events,
        }),
      });
      if (!response.ok) return new Response("Upstream failed", { status: 502 });
      const result = await response.json().catch(() => null);
      if (!result?.ok) return new Response("Upstream rejected", { status: 502 });
    }

    return new Response("OK", { status: 200 });
  },
};

async function verifyLineSignature(rawBody, receivedSignature, channelSecret) {
  if (!receivedSignature || !channelSecret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const calculated = bytesToBase64(new Uint8Array(digest));
  return timingSafeEqual(calculated, receivedSignature);
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
