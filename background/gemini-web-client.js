/**
 * Gemini Web Client
 * Interacts directly with gemini.google.com using the user's active logged-in browser session.
 * Does not require an API key!
 */

export class GeminiWebClient {
  constructor() {
    this.cachedSession = null;
    this.sessionExpiry = 0;
    this.conversationId = "";
    this.responseId = "";
    this.choiceId = "";
    this.lastCreatedConversationId = "";
  }

  /**
   * Check if user is logged into gemini.google.com and retrieve session tokens
   */
  async getSessionTokens(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.cachedSession && now < this.sessionExpiry) {
      return this.cachedSession;
    }

    try {
      const res = await fetch("https://gemini.google.com/app", {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-Mode": "navigate"
        }
      });

      if (res.status === 401 || res.status === 403 || res.url.includes("accounts.google.com")) {
        throw new Error("NOT_LOGGED_IN");
      }

      const html = await res.text();

      // Extract SNlM0e (XSRF/CSRF Token)
      const snlm0eMatch = html.match(/"SNlM0e":"([^"]+)"/);
      if (!snlm0eMatch || !snlm0eMatch[1]) {
        throw new Error("NOT_LOGGED_IN");
      }
      const snlm0e = snlm0eMatch[1];

      // Extract FdrFJe (Session ID)
      const fdrfjeMatch = html.match(/"FdrFJe":"([^"]+)"/);
      const fdrfje = fdrfjeMatch ? fdrfjeMatch[1] : "";

      // Extract cfb2h (Build label)
      const cfb2hMatch = html.match(/"cfb2h":"([^"]+)"/);
      const cfb2h = cfb2hMatch ? cfb2hMatch[1] : "boq_assistant-bard-web-server_20240901.00_p0";

      this.cachedSession = { snlm0e, fdrfje, cfb2h };
      this.sessionExpiry = now + 15 * 60 * 1000; // Cache for 15 minutes
      return this.cachedSession;
    } catch (err) {
      this.cachedSession = null;
      throw err;
    }
  }

  /**
   * Compute SAPISIDHASH authorization header from Google session cookies
   */
  async getSapisidHash() {
    try {
      const cookieNames = ["SAPISID", "__Secure-1PAPISID", "__Secure-3PAPISID", "__Secure-1PSID"];
      let sapisid = "";

      for (const name of cookieNames) {
        const c = await chrome.cookies.get({ url: "https://gemini.google.com", name });
        if (c && c.value) {
          sapisid = c.value;
          break;
        }
      }

      if (!sapisid) return null;

      const timestamp = Math.floor(Date.now() / 1000);
      const strToHash = `${timestamp} ${sapisid} https://gemini.google.com`;
      const enc = new TextEncoder().encode(strToHash);
      const hashBuf = await crypto.subtle.digest("SHA-1", enc);
      const hashHex = Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      return `SAPISIDHASH ${timestamp}_${hashHex}`;
    } catch (e) {
      console.warn("[GeminiWebClient] Could not compute SAPISIDHASH:", e);
      return null;
    }
  }

  /**
   * Recursively locate answer text inside Gemini's nested response array
   */
  extractText(data) {
    if (!data) return "";

    // Candidate structure in Gemini response:
    // data[4] is an array of candidates: [ [candidate_id, [ "text part 1", ... ]], ... ]
    try {
      if (Array.isArray(data[4]) && data[4].length > 0) {
        for (const candidate of data[4]) {
          if (Array.isArray(candidate) && candidate.length > 1) {
            const parts = candidate[1];
            if (Array.isArray(parts)) {
              const textParts = parts.filter(p => typeof p === "string");
              if (textParts.length > 0) {
                return textParts.join("\n\n");
              }
            } else if (typeof parts === "string") {
              return parts;
            }
          }
        }
      }
    } catch (e) {}

    // Fallback: search for the longest sensible string
    let longestStr = "";
    function traverse(item) {
      if (typeof item === "string") {
        if (!item.startsWith("rc_") && !item.startsWith("c_") && !item.startsWith("boq_") && !item.startsWith("generic") && item.length > longestStr.length) {
          longestStr = item;
        }
      } else if (Array.isArray(item)) {
        for (const sub of item) traverse(sub);
      }
    }
    traverse(data);
    return longestStr;
  }

  /**
   * Generate content using Gemini Web RPC
   */
  async generateContent({ prompt, autoDelete = true, onToken, onDone, onError, signal }) {
    try {
      const session = await this.getSessionTokens();
      const reqId = Math.floor(100000 + Math.random() * 900000);
      const sapisidAuth = await this.getSapisidHash();

      const messageStruct = [
        [prompt, 0, null, null, null, null, 0],
        ["en"],
        [this.conversationId, this.responseId, this.choiceId],
        null, null, null, [1], 0, [], [], 1, 0
      ];

      const headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Same-Domain": "1"
      };
      if (sapisidAuth) {
        headers["Authorization"] = sapisidAuth;
      }

      // We will try StreamGenerate first, then batchexecute as fallback
      const attempts = [
        {
          name: "StreamGenerate",
          url: `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=${encodeURIComponent(session.cfb2h)}&f.sid=${encodeURIComponent(session.fdrfje)}&_reqid=${reqId}&rt=c`,
          payload: JSON.stringify([null, JSON.stringify(messageStruct)])
        },
        {
          name: "batchexecute",
          url: `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=PCck7e&source-path=%2Fapp&bl=${encodeURIComponent(session.cfb2h)}&f.sid=${encodeURIComponent(session.fdrfje)}&_reqid=${reqId}&rt=c`,
          payload: JSON.stringify([[["PCck7e", JSON.stringify(messageStruct), null, "generic"]]])
        }
      ];

      let lastError = null;
      let accumulatedText = "";

      for (const attempt of attempts) {
        if (signal && signal.aborted) break;

        try {
          console.log(`[GeminiWebClient] Trying ${attempt.name}...`);
          const body = new URLSearchParams();
          body.append("f.req", attempt.payload);
          body.append("at", session.snlm0e);

          const res = await fetch(attempt.url, {
            method: "POST",
            credentials: "include",
            headers,
            body: body.toString(),
            signal
          });

          console.log(`[GeminiWebClient] ${attempt.name} response status:`, res.status);

          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              lastError = new Error("NOT_LOGGED_IN");
              continue; // try next attempt
            }
            lastError = new Error(`HTTP ${res.status}`);
            continue;
          }

          const rawText = await res.text();
          let cleanText = rawText;
          if (cleanText.startsWith(")]}'")) {
            cleanText = cleanText.substring(4).trim();
          }

          const lines = cleanText.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || /^\d+$/.test(line)) continue;

            try {
              const parsed = JSON.parse(line);
              if (Array.isArray(parsed)) {
                for (const rpcResult of parsed) {
                  if (Array.isArray(rpcResult) && rpcResult[0] === "wrb.fr") {
                    const innerJson = rpcResult[2];
                    if (typeof innerJson === "string") {
                      const data = JSON.parse(innerJson);
                      const extracted = this.extractText(data);
                      if (extracted && extracted.length > accumulatedText.length) {
                        accumulatedText = extracted;
                      }

                      // Robust extraction of conversationId & responseId
                      if (data && Array.isArray(data[1])) {
                        if (data[1][0] && typeof data[1][0] === "string") {
                          this.conversationId = data[1][0];
                          this.lastCreatedConversationId = data[1][0];
                        }
                        if (data[1][1] && typeof data[1][1] === "string") {
                          this.responseId = data[1][1];
                        }
                      }
                      if (data && Array.isArray(data[4]) && data[4][0] && data[4][0][0]) {
                        this.choiceId = data[4][0][0];
                      }
                    }
                  }
                }
              }
            } catch (e) {}
          }

          // Fallback regex detection for conversationId if not found in data[1]
          if (!this.lastCreatedConversationId) {
            const match = cleanText.match(/["'](c_[a-fA-F0-9]{16,})["']/);
            if (match && match[1]) {
              this.conversationId = match[1];
              this.lastCreatedConversationId = match[1];
              console.log("[GeminiWebClient] Captured conversationId via fallback regex:", match[1]);
            }
          }

          if (accumulatedText) {
            // Succeeded! Break out of attempts
            break;
          }
        } catch (err) {
          if (signal && signal.aborted) return;
          lastError = err;
          console.warn(`[GeminiWebClient] ${attempt.name} failed:`, err);
        }
      }

      if (accumulatedText) {
        // Stream text out in chunks for smooth typing effect
        const chunkSize = 20;
        for (let i = 0; i < accumulatedText.length; i += chunkSize) {
          if (signal && signal.aborted) break;
          onToken(accumulatedText.slice(i, i + chunkSize));
          await new Promise(r => setTimeout(r, 12));
        }
        onDone();

        // If autoDelete is enabled, schedule conversation cleanup after a short delay
        // (allows Gemini server to commit the conversation before delete request)
        if (autoDelete) {
          const targetConvId = this.lastCreatedConversationId;
          this.lastCreatedConversationId = "";
          this.conversationId = "";
          this.responseId = "";
          this.choiceId = "";

          setTimeout(async () => {
            try {
              if (targetConvId) {
                console.log(`[GeminiWebClient] Auto-deleting session by ID: ${targetConvId}`);
                await this.deleteConversation(targetConvId);
              }
              // Wait briefly and verify with listConversations to ensure no leftover chat remains
              await new Promise(r => setTimeout(r, 800));
              const recent = await this.listConversations();
              if (recent && recent.length > 0) {
                if (targetConvId && recent[0].id === targetConvId) {
                  console.log(`[GeminiWebClient] Re-deleting lingering session: ${recent[0].id}`);
                  await this.deleteConversation(recent[0].id);
                } else if (!targetConvId) {
                  console.log(`[GeminiWebClient] Auto-deleting latest session from list: ${recent[0].id} (${recent[0].title})`);
                  await this.deleteConversation(recent[0].id);
                }
              }
            } catch (err) {
              console.warn("[GeminiWebClient] Background conversation cleanup error:", err);
            }
          }, 1500);
        }
      } else {
        if (lastError && lastError.message === "NOT_LOGGED_IN") {
          throw lastError;
        }
        throw new Error(lastError ? `Kết nối Gemini thất bại: ${lastError.message}` : "Không nhận được phản hồi từ Gemini. Vui lòng thử lại.");
      }

    } catch (err) {
      if (signal && signal.aborted) return;
      console.error("[GeminiWebClient] Error in generateContent:", err);
      if (err.message === "NOT_LOGGED_IN") {
        onError({
          code: "NOT_LOGGED_IN",
          message: "Chưa đăng nhập Gemini"
        });
      } else {
        onError({
          code: "REQUEST_FAILED",
          message: err.message || "Lỗi không xác định khi kết nối với Gemini"
        });
      }
    }
  }

  /**
   * Retrieve list of recent conversations using RPC MaZiqc
   */
  async listConversations() {
    try {
      const session = await this.getSessionTokens();
      const reqId = Math.floor(100000 + Math.random() * 900000);
      const sapisidAuth = await this.getSapisidHash();

      const payload = JSON.stringify([[["MaZiqc", "[]", null, "generic"]]]);

      const body = new URLSearchParams();
      body.append("f.req", payload);
      body.append("at", session.snlm0e);

      const headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Same-Domain": "1"
      };
      if (sapisidAuth) {
        headers["Authorization"] = sapisidAuth;
      }

      const url = `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=MaZiqc&source-path=%2Fapp&bl=${encodeURIComponent(session.cfb2h)}&f.sid=${encodeURIComponent(session.fdrfje)}&_reqid=${reqId}&rt=c`;

      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: body.toString()
      });

      if (!res.ok) return [];
      const rawText = await res.text();
      let cleanText = rawText;
      if (cleanText.startsWith(")]}'")) {
        cleanText = cleanText.substring(4).trim();
      }

      const convs = [];
      const lines = cleanText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || /^\d+$/.test(trimmed)) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (Array.isArray(item) && item[0] === "wrb.fr" && item[1] === "MaZiqc" && typeof item[2] === "string") {
                const inner = JSON.parse(item[2]);
                const entries = (Array.isArray(inner) && (Array.isArray(inner[2]) ? inner[2] : (Array.isArray(inner[0]) ? inner[0] : []))) || [];
                for (const e of entries) {
                  if (Array.isArray(e) && e[0]) {
                    convs.push({ id: e[0], title: e[1] || "" });
                  }
                }
              }
            }
          }
        } catch (e) {}
      }
      return convs;
    } catch (err) {
      console.warn("[GeminiWebClient] listConversations error:", err);
      return [];
    }
  }

  /**
   * Delete a conversation by its ID to prevent leaving junk chats in Gemini
   */
  async deleteConversation(conversationId) {
    if (!conversationId) return false;
    try {
      console.log(`[GeminiWebClient] Cleaning up conversation: ${conversationId}`);
      const session = await this.getSessionTokens();
      const reqId = Math.floor(100000 + Math.random() * 900000);
      const sapisidAuth = await this.getSapisidHash();

      // Standard batchexecute payload for GzXR5e:
      // fReqData = [[[rpcID, JSON.stringify([conversationId]), null, "generic"]]]
      const payload = JSON.stringify([[["GzXR5e", JSON.stringify([conversationId]), null, "generic"]]]);

      const body = new URLSearchParams();
      body.append("f.req", payload);
      body.append("at", session.snlm0e);

      const headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Same-Domain": "1"
      };
      if (sapisidAuth) {
        headers["Authorization"] = sapisidAuth;
      }

      const url = `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=GzXR5e&source-path=%2Fapp&bl=${encodeURIComponent(session.cfb2h)}&f.sid=${encodeURIComponent(session.fdrfje)}&_reqid=${reqId}&rt=c`;

      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: body.toString()
      });

      console.log(`[GeminiWebClient] Delete response status for ${conversationId}:`, res.status);
      const resText = await res.text();
      console.log(`[GeminiWebClient] Delete response body:`, resText.slice(0, 120));
      return res.ok;
    } catch (e) {
      console.warn(`[GeminiWebClient] Failed to delete conversation ${conversationId}:`, e);
      return false;
    }
  }
}
