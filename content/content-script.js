/**
 * Gemini Summarize - Content Script
 * Injected into webpages to extract article content, YouTube transcripts,
 * and manage the floating draggable iframe popup.
 */
(function() {
  'use strict';

  const IFRAME_ID = 'gemini-summarize-popup-iframe';
  const SELECTION_BTN_CLASS = 'gemini-summarize-selection-btn';
  let interceptedSubtitlesUrl = null;
  let currentSelectionText = '';
  let posX = 0;
  let posY = 0;
  let isDragging = false;

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_POPUP') {
      togglePopup();
      sendResponse({ status: 'ok' });
    } else if (message.type === 'SUMMARIZE_TEXT') {
      const selection = window.getSelection()?.toString().trim();
      openPopupWithText(selection || '');
      sendResponse({ status: 'ok' });
    } else if (message.type === 'GET_SUBTITLES_URL') {
      interceptedSubtitlesUrl = message.url;
      sendResponse({ status: 'ok' });
    }
  });

  // Listen for messages from the iframe
  window.addEventListener('message', async (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    const { type, runtimeId, movementX, movementY } = event.data;

    // Verify message is from our extension
    if (runtimeId !== chrome.runtime.id) return;

    switch (type) {
      case 'POPUP_READY': {
        const pageData = await extractPageData();
        sendToPopup('INIT_PAGE_DATA', pageData);
        break;
      }
      case 'CLOSE_POPUP': {
        hidePopup();
        break;
      }
      case 'DRAG_MOVE': {
        handleDragMove(movementX, movementY);
        break;
      }
      case 'DRAG_END': {
        isDragging = false;
        break;
      }
    }
  });

  function getIframe() {
    return document.getElementById(IFRAME_ID);
  }

  function createIframe() {
    let iframe = getIframe();
    if (iframe) return iframe;

    iframe = document.createElement('iframe');
    iframe.id = IFRAME_ID;
    iframe.src = chrome.runtime.getURL('popup/index.html');
    iframe.referrerPolicy = 'unsafe-url';
    iframe.allow = 'clipboard-write *';
    
    // Explicit inline styles to ensure perfect positioning and visibility
    iframe.style.all = 'unset';
    iframe.style.position = 'fixed';
    iframe.style.top = '16px';
    iframe.style.right = '16px';
    iframe.style.width = '520px';
    iframe.style.height = '640px';
    iframe.style.minWidth = '380px';
    iframe.style.minHeight = '400px';
    iframe.style.maxWidth = 'calc(100vw - 32px)';
    iframe.style.maxHeight = 'calc(100vh - 32px)';
    iframe.style.background = '#ffffff';
    iframe.style.borderRadius = '16px';
    iframe.style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.08)';
    iframe.style.zIndex = '2147483647';
    iframe.style.overflow = 'hidden';
    iframe.style.display = 'block';
    iframe.style.boxSizing = 'border-box';

    // Position tracking
    posX = 0;
    posY = 0;
    iframe.style.transform = 'translate(0px, 0px)';

    (document.body || document.documentElement).appendChild(iframe);
    return iframe;
  }

  function togglePopup() {
    const iframe = getIframe();
    if (iframe && iframe.style.display !== 'none' && !iframe.classList.contains('hidden')) {
      hidePopup();
    } else {
      openPopup();
    }
  }

  async function openPopup() {
    const iframe = createIframe();
    iframe.style.display = 'block';
    iframe.classList.remove('hidden');
    iframe.focus();
    const pageData = await extractPageData();
    sendToPopup('INIT_PAGE_DATA', pageData);
  }

  function hidePopup() {
    const iframe = getIframe();
    if (iframe) {
      iframe.style.display = 'none';
      iframe.classList.add('hidden');
    }
  }

  async function openPopupWithText(text) {
    currentSelectionText = text;
    const iframe = createIframe();
    iframe.style.display = 'block';
    iframe.classList.remove('hidden');
    iframe.focus();
    const pageData = await extractPageData();
    pageData.selectedText = text;
    sendToPopup('INIT_PAGE_DATA', pageData);
  }

  function handleDragMove(dx, dy) {
    const iframe = getIframe();
    if (!iframe) return;
    posX += dx;
    posY += dy;
    iframe.style.transform = `translate(${posX}px, ${posY}px)`;
  }

  function sendToPopup(type, data) {
    const iframe = getIframe();
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type,
        data,
        runtimeId: chrome.runtime.id
      }, '*');
    }
  }

  /**
   * Extract content from current page or YouTube video
   */
  async function extractPageData() {
    // If text was selected right before opening
    const activeSelection = window.getSelection()?.toString().trim();
    const selectedText = currentSelectionText || activeSelection;
    currentSelectionText = ''; // reset

    const extractor = new window.ReadabilityExtractor(document);
    const extracted = extractor.extract();

    let finalText = extracted.textContent;
    let isVideoTranscript = false;

    // Handle YouTube Video
    if (window.location.hostname.includes('youtube.com') && window.location.pathname.includes('/watch')) {
      const ytTranscript = await getYouTubeTranscript();
      if (ytTranscript) {
        finalText = ytTranscript;
        isVideoTranscript = true;
      }
    }

    return {
      title: extracted.title || document.title,
      url: window.location.href,
      lang: extracted.lang || 'vi',
      textContent: finalText,
      selectedText: selectedText || null,
      isYouTube: isVideoTranscript
    };
  }

  /**
   * Retrieve YouTube subtitles/transcript if available
   */
  async function getYouTubeTranscript() {
    try {
      // 1. Try intercepted timedtext URL
      if (interceptedSubtitlesUrl) {
        let url = interceptedSubtitlesUrl;
        if (!url.includes('&fmt=json3')) url += '&fmt=json3';
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.events) {
            const transcript = json.events
              .filter(e => e.segs)
              .map(e => e.segs.map(s => s.utf8).join(''))
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (transcript.length > 50) return transcript;
          }
        }
      }

      // 2. Try parsing ytInitialPlayerResponse from page scripts
      const scripts = document.getElementsByTagName('script');
      for (const script of scripts) {
        if (script.textContent && script.textContent.includes('captionTracks')) {
          const match = script.textContent.match(/"captionTracks":\s*(\[.*?\])/);
          if (match) {
            const tracks = JSON.parse(match[1]);
            if (tracks && tracks.length > 0) {
              const trackUrl = tracks[0].baseUrl + '&fmt=json3';
              const res = await fetch(trackUrl);
              if (res.ok) {
                const json = await res.json();
                if (json.events) {
                  return json.events
                    .filter(e => e.segs)
                    .map(e => e.segs.map(s => s.utf8).join(''))
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not extract YouTube transcript:', err);
    }
    return null;
  }

  /**
   * Floating action button on text selection
   */
  let floatingBtn = null;

  document.addEventListener('mouseup', (e) => {
    // If clicking inside extension popup or existing button, ignore
    if (e.target.closest && (e.target.closest('#' + IFRAME_ID) || e.target.closest('.' + SELECTION_BTN_CLASS))) {
      return;
    }

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selectedText.length >= 15) {
      // Show floating button
      showSelectionButton(e.pageX, e.pageY, selectedText);
    } else {
      removeSelectionButton();
    }
  });

  function showSelectionButton(x, y, text) {
    removeSelectionButton();

    floatingBtn = document.createElement('button');
    floatingBtn.className = SELECTION_BTN_CLASS;
    floatingBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" fill="url(#geminiGradIcon)"/>
        <defs>
          <linearGradient id="geminiGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4E8CFF"/>
            <stop offset="100%" stop-color="#FF5C93"/>
          </linearGradient>
        </defs>
      </svg>
      <span>Tóm tắt với Gemini</span>
    `;

    floatingBtn.style.left = `${Math.max(10, x - 50)}px`;
    floatingBtn.style.top = `${Math.max(10, y - 42)}px`;

    floatingBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openPopupWithText(text);
      removeSelectionButton();
    });

    document.body.appendChild(floatingBtn);
  }

  function removeSelectionButton() {
    if (floatingBtn) {
      floatingBtn.remove();
      floatingBtn = null;
    }
  }

  // Remove floating button on click elsewhere or keypress
  document.addEventListener('mousedown', (e) => {
    if (floatingBtn && !floatingBtn.contains(e.target)) {
      removeSelectionButton();
    }
  });

})();
