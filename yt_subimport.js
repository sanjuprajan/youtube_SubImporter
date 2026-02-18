const url = "https://www.youtube.com/youtubei/v1/subscription/subscribe?prettyPrint=false";

const requestConfig = (typeof require !== "undefined") ? require("./headers.js") : null;
const options = requestConfig
  ? { ...requestConfig, body: undefined, method: "POST", mode: "cors", credentials: "include" }
  : { headers: {}, referrer: "https://www.youtube.com/feed/channels", method: "POST", mode: "cors", credentials: "include" };

// Request body is built on the fly per channel (no embedded data).
function buildSubscribeBody(channelId) {
  return JSON.stringify({
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20260213.01.00",
        hl: "en",
        gl: "US",
      },
      user: {},
    },
    channelIds: [channelId],
  });
}

const DELAY_MS = 1000;
const CSV_PATH = "subscriptions.csv";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readChannelIdsFromCsv(csvPath) {
  const fs = require("fs");
  const path = require("path");
  const resolved = path.isAbsolute(csvPath) ? csvPath : path.join(__dirname, csvPath);
  const content = fs.readFileSync(resolved, "utf8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const channelIds = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const firstComma = line.indexOf(",");
    const channelId = (firstComma >= 0 ? line.slice(0, firstComma) : line).trim();
    if (i === 0 && channelId === "Channel Id") continue;
    if (/^UC[\w-]{20,}$/.test(channelId)) channelIds.push(channelId);
  }
  return channelIds;
}

async function sendSubscribe(channelId, title) {
  const opts = { ...options, headers: { ...options.headers }, body: buildSubscribeBody(channelId) };
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  if (text) try { json = JSON.parse(text); } catch {}
  const ctx = json?.responseContext?.mainAppWebResponseContext || {};
  const loggedOut = ctx.loggedOut === true;
  const subscribeAction = (json?.actions || []).find((a) => a.updateSubscribeButtonAction);
  const subscribed = subscribeAction?.updateSubscribeButtonAction?.subscribed === true;
  return { ok: res.ok, loggedOut, subscribed, json, status: res.status };
}

async function run() {
  const isNode = typeof process !== "undefined" && process.versions?.node;
  let channelIds = [];
  try {
    channelIds = readChannelIdsFromCsv(CSV_PATH);
  } catch (e) {
    if (isNode) {
      console.error("[import] Could not read CSV:", e.message);
      if (process?.exitCode !== undefined) process.exitCode = 1;
    }
  }
  const singleRequest = !isNode || channelIds.length === 0;
  if (singleRequest) {
    console.log("[import] Sending single subscribe request...");
    const testChannelId = channelIds[0] || "UC_x5XG1OV2P6uZZ5FSM9Ttw"; // YouTube Spotlight as fallback
    options.body = buildSubscribeBody(testChannelId);
    const start = Date.now();
    try {
      const res = await fetch(url, options);
      const elapsed = Date.now() - start;
      console.log(`[import] Response: ${res.status} ${res.statusText} (${elapsed}ms)`);
      const text = await res.text();
      let json = null;
      if (text) {
        try {
          json = JSON.parse(text);
          console.log("[import] Body:", JSON.stringify(json, null, 2));
        } catch {
          console.log("[import] Body (raw):", text.slice(0, 500) + (text.length > 500 ? "..." : ""));
        }
      }
      if (!res.ok) {
        console.error("[import] Request failed:", res.status, res.statusText);
        if (process?.exitCode !== undefined) process.exitCode = 1;
      } else if (json) {
        const ctx = json.responseContext?.mainAppWebResponseContext || {};
        const loggedOut = ctx.loggedOut === true;
        const subscribeAction = (json.actions || []).find((a) => a.updateSubscribeButtonAction);
        const subscribed = subscribeAction?.updateSubscribeButtonAction?.subscribed === true;
        if (loggedOut || !subscribed) {
          console.error("[import] Subscription did not complete. Your session has expired or you are not signed in. Update cookies in headers.js and re-run.");
          if (process?.exitCode !== undefined) process.exitCode = 1;
        } else {
          console.log("[import] Done. Subscribed successfully.");
        }
      } else {
        console.log("[import] Done.");
      }
    } catch (err) {
      console.error("[import] Error:", err.message);
      if (process?.exitCode !== undefined) process.exitCode = 1;
    }
    return;
  }

  console.log("[import] Subscribing to", channelIds.length, "channels (delay", DELAY_MS, "ms between requests)...");
  let success = 0;
  let fail = 0;
  for (let i = 0; i < channelIds.length; i++) {
    const channelId = channelIds[i];
    const title = `channel ${i + 1}/${channelIds.length}`;
    try {
      const result = await sendSubscribe(channelId, title);
      if (result.ok && !result.loggedOut && result.subscribed) {
        success++;
        console.log(`[import] ${i + 1}/${channelIds.length} OK  ${channelId}`);
      } else {
        fail++;
        if (result.loggedOut) {
          console.error(`[import] ${i + 1}/${channelIds.length} FAIL ${channelId} (session expired)`);
          console.error("[import] Update cookies in headers.js and re-run. Stopping.");
          if (process?.exitCode !== undefined) process.exitCode = 1;
          return;
        } else {
          console.error(`[import] ${i + 1}/${channelIds.length} FAIL ${channelId} (${result.status})`);
        }
      }
    } catch (err) {
      fail++;
      console.error(`[import] ${i + 1}/${channelIds.length} FAIL ${channelId} Error:`, err.message);
    }
    if (i < channelIds.length - 1) await delay(DELAY_MS);
  }
  console.log("[import] Done. Success:", success, "Failed:", fail);
  if (fail > 0 && process?.exitCode !== undefined) process.exitCode = 1;
}

run();