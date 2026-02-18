# YouTube subscriptions import

Re-subscribe to channels from a Google Takeout export by sending one subscribe request per channel. Uses your browser session (cookies and headers) so you must be signed in when capturing the request.

## Prerequisites

- **Node.js** (v18 or newer)
- **subscriptions.csv** from Google Takeout (see below)
- **Request headers** in `headers.js` (see below)

---

## 1. Get `subscriptions.csv` from Google Takeout

1. Go to [Google Takeout](https://takeout.google.com/) and sign in.
2. Click **Deselect all**, then enable only **YouTube and YouTube Music**.
3. Click **Next step** → choose delivery method (e.g. **Send download link via email**) and frequency → **Create export**.
4. When the export is ready, download the zip and unzip it.
5. Open the folder **YouTube and YouTube Music** (or **YouTube**).
6. Copy **subscriptions.csv** into this project folder (same folder as `import.js`).

The CSV must have a first column **Channel Id** with values like `UCxxxxxxxxxxxxxxxxxxxxx`. The script skips the header row and uses only that column.

---

## 2. Fill request headers in `headers.js`

The script sends subscribe requests using the same headers your browser uses. You must capture them from Chrome or Firefox and paste them into **`headers.js`**.

### Using Chrome or Firefox

1. **Sign in to YouTube** in that browser.
2. Open **Developer Tools** (F12 or right‑click → Inspect).
3. Go to the **Network** tab and leave it open.
4. In YouTube, go to **https://www.youtube.com/feed/channels** (Subscriptions).
5. **Subscribe to any channel** (click Subscribe on a channel you’re not subscribed to). You can unsubscribe right after.
6. In the Network tab, find a request whose URL contains:
   - `youtubei/v1/subscription/subscribe`
   Filter by “subscribe” or “subscription” if needed.
7. Click that request → open **Headers** (or **Request Headers**).
8. Copy **all** request headers and the **Referrer** (or **Referer**) into **`headers.js`**:
   - In `headers.js`, the `headers` object must contain every header from that request (e.g. `Cookie`, `authorization`, `x-goog-visitor-id`, `content-type`, `x-youtube-client-name`, etc.). Use the exact header names (case-sensitive) and values.
   - Set `referrer` to the same Referrer value as in the request (usually `https://www.youtube.com/feed/channels`).

**Important:** Fill **all** required headers. At minimum you need: `Cookie`, `authorization`, `content-type`, `x-goog-visitor-id`, `x-youtube-client-name`, `x-youtube-client-version`, and the rest that appear in the subscribe request. If any are missing, YouTube may reject the request or treat it as unauthenticated.

When your session expires (e.g. after some time or after logging out), the script will tell you to update **`headers.js`**. Repeat the steps above to capture a fresh request and replace the contents of `headers.js`.

---

## 3. Run the import

From the project folder (where `import.js` and `subscriptions.csv` are):

```bash
node yt_subimport.js
```

The script will:

- Read channel IDs from `subscriptions.csv`
- Send one subscribe request per channel with a short delay between requests
- Log progress and write success/failure to `subscriptions_success.log` and `subscriptions_failure.log`

If you see **“session expired”** or subscription failures, update the cookies and headers in **`headers.js`** (step 2) and run again.
