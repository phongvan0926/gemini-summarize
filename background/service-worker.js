/**
 * Gemini Summarize - Background Service Worker
 * Coordinates between extension action, context menus, popup iframe,
 * and Gemini AI providers (Gemini Web Session & Gemini API).
 */

import { GeminiWebClient } from "./gemini-web-client.js";
import { GeminiApiClient } from "./gemini-api-client.js";

const webClient = new GeminiWebClient();

// 1. Extension Installation & Setup
chrome.runtime.onInstalled.addListener(async () => {
  // Create context menu for text selection
  chrome.contextMenus.create({
    id: "summarizeSelectionWithGemini",
    title: "Tóm tắt bằng Gemini",
    contexts: ["selection"]
  });

  // Inject content scripts into already open tabs
  try {
    const tabs = await chrome.tabs.query({ windowType: "normal" });
    for (const tab of tabs) {
      if (isValidUrl(tab.url)) {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content/content-styles.css"]
        }).catch(() => {});
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: false },
          files: ["content/readability.js", "content/content-script.js"]
        }).catch(() => {});
      }
    }
  } catch (e) {}
});

function isValidUrl(url) {
  if (!url) return false;
  return !url.startsWith("chrome://") &&
         !url.startsWith("chrome-extension://") &&
         !url.startsWith("edge://") &&
         !url.startsWith("about:") &&
         !url.startsWith("https://chrome.google.com/webstore");
}

// 2. Toolbar Icon Click Event
chrome.action.onClicked.addListener(async (tab) => {
  if (!isValidUrl(tab.url)) {
    console.warn("Cannot run extension on this page:", tab.url);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "OPEN_POPUP" });
  } catch (err) {
    // If content script is not yet injected, inject it and retry
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["content/content-styles.css"]
      }).catch(() => {});
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/readability.js", "content/content-script.js"]
      });
      await new Promise(r => setTimeout(r, 100));
      await chrome.tabs.sendMessage(tab.id, { type: "OPEN_POPUP" });
    } catch (e) {
      console.error("Failed to inject content script:", e);
    }
  }
});

// 3. Context Menu Selection Click Event
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "summarizeSelectionWithGemini" && tab?.id && isValidUrl(tab.url)) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "SUMMARIZE_TEXT" });
    } catch (err) {
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content/content-styles.css"]
        }).catch(() => {});
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/readability.js", "content/content-script.js"]
        });
        await new Promise(r => setTimeout(r, 100));
        await chrome.tabs.sendMessage(tab.id, { type: "SUMMARIZE_TEXT" });
      } catch (e) {
        console.error("Failed to inject content script for context menu:", e);
      }
    }
  }
});

// 4. Intercept YouTube timedtext Subtitles
chrome.webRequest.onBeforeRequest.addListener((details) => {
  if (details.tabId && details.tabId > 0) {
    chrome.tabs.sendMessage(details.tabId, {
      type: "GET_SUBTITLES_URL",
      url: details.url
    }).catch(() => {});
  }
}, { urls: ["*://*.youtube.com/api/timedtext?*"] });

// 5. General Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "OPEN_OPTIONS_PAGE") {
    chrome.runtime.openOptionsPage();
    sendResponse({ status: "ok" });
  } else if (request.type === "OPEN_TAB" && request.url) {
    chrome.tabs.create({ url: request.url });
    sendResponse({ status: "ok" });
  }
  return true;
});

// 6. Connect Port Handler (Streaming summary to Popup)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "gemini-summarize-channel") return;

  const abortController = new AbortController();

  port.onDisconnect.addListener(() => {
    abortController.abort();
  });

  port.onMessage.addListener(async (msg) => {
    if (msg.type === "summarize" && msg.prompt) {
      try {
        const settings = await chrome.storage.local.get({
          provider: "web",
          apiKey: "",
          model: "gemini-2.5-flash",
          autoDeleteSession: true
        });

        const autoDelete = msg.autoDelete !== undefined ? msg.autoDelete : (settings.autoDeleteSession !== false);

        if (settings.provider === "api" && settings.apiKey) {
          // Use official Gemini API
          const apiClient = new GeminiApiClient(settings.apiKey, settings.model);
          await apiClient.generateContent({
            prompt: msg.prompt,
            onToken: (text) => {
              try { port.postMessage({ type: "token", text }); } catch (e) {}
            },
            onDone: () => {
              try { port.postMessage({ type: "done" }); } catch (e) {}
            },
            onError: (err) => {
              try { port.postMessage({ type: "error", ...err }); } catch (e) {}
            },
            signal: abortController.signal
          });
        } else {
          // Default: Use Gemini Web (Logged-in session)
          await webClient.generateContent({
            prompt: msg.prompt,
            autoDelete,
            onToken: (text) => {
              try { port.postMessage({ type: "token", text }); } catch (e) {}
            },
            onDone: () => {
              try { port.postMessage({ type: "done" }); } catch (e) {}
            },
            onError: (err) => {
              try { port.postMessage({ type: "error", ...err }); } catch (e) {}
            },
            signal: abortController.signal
          });
        }
      } catch (err) {
        try {
          port.postMessage({
            type: "error",
            code: "GENERAL_ERROR",
            message: err.message || "Đã xảy ra lỗi không xác định"
          });
        } catch (e) {}
      }
    }
  });
});
