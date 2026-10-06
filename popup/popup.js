/**
 * Gemini Summarize - Popup Controller
 * Handles drag events, in-page UI, communication with content script,
 * and streaming responses from the background Gemini client.
 */
(function() {
  'use strict';

  // Elements
  const dragHeader = document.getElementById('drag-header');
  const btnClose = document.getElementById('btn-close');
  const btnOptions = document.getElementById('btn-options');
  const promptSelect = document.getElementById('prompt-select');
  const langSelect = document.getElementById('lang-select');
  const customPromptContainer = document.getElementById('custom-prompt-container');
  const customPromptInput = document.getElementById('custom-prompt-input');
  const sourceTitle = document.getElementById('source-title');
  const loadingState = document.getElementById('loading-state');
  const loadingMsg = document.getElementById('loading-msg');
  const errorState = document.getElementById('error-state');
  const errorMessage = document.getElementById('error-message');
  const btnLoginGemini = document.getElementById('btn-login-gemini');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const btnRetry = document.getElementById('btn-retry');
  const resultContainer = document.getElementById('result-container');
  const btnSummarize = document.getElementById('btn-summarize');
  const btnCopy = document.getElementById('btn-copy');
  const copyLabel = document.getElementById('copy-label');
  const providerName = document.getElementById('provider-name');
  const contentScroll = document.getElementById('content-scroll');

  // State
  let currentPageData = null;
  let currentRawText = '';
  let port = null;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  // 1. Setup Drag & Move
  dragHeader.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;
    window.parent.postMessage({
      type: 'DRAG_MOVE',
      movementX: dx,
      movementY: dy,
      runtimeId: chrome.runtime.id
    }, '*');
  }

  function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    window.parent.postMessage({
      type: 'DRAG_END',
      runtimeId: chrome.runtime.id
    }, '*');
  }

  // 2. Window Controls
  btnClose.addEventListener('click', () => {
    window.parent.postMessage({
      type: 'CLOSE_POPUP',
      runtimeId: chrome.runtime.id
    }, '*');
  });

  btnOptions.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
  });

  btnOpenOptions.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
  });

  btnLoginGemini.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'OPEN_TAB',
      url: 'https://gemini.google.com'
    });
  });

  btnRetry.addEventListener('click', () => {
    startSummarizing();
  });

  btnSummarize.addEventListener('click', () => {
    startSummarizing();
  });

  btnCopy.addEventListener('click', () => {
    if (!currentRawText) return;
    navigator.clipboard.writeText(currentRawText).then(() => {
      copyLabel.textContent = 'Đã chép! ✓';
      btnCopy.style.borderColor = '#10b981';
      btnCopy.style.color = '#10b981';
      setTimeout(() => {
        copyLabel.textContent = 'Sao chép';
        btnCopy.style.borderColor = '';
        btnCopy.style.color = '';
      }, 2000);
    });
  });

  const customPromptsGroup = document.getElementById('custom-prompts-group');
  let customPromptsList = [];

  promptSelect.addEventListener('change', () => {
    if (promptSelect.value === 'custom') {
      customPromptContainer.classList.remove('hidden');
      customPromptInput.focus();
    } else {
      customPromptContainer.classList.add('hidden');
      chrome.storage.local.set({ activePrompt: promptSelect.value });
      startSummarizing();
    }
  });

  customPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      startSummarizing();
    }
  });

  langSelect.addEventListener('change', () => {
    chrome.storage.local.set({ selectedLanguage: langSelect.value });
    startSummarizing();
  });

  // 3. Listen for Page Data from Content Script
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    const { type, data, runtimeId } = event.data;
    if (runtimeId !== chrome.runtime.id) return;

    if (type === 'INIT_PAGE_DATA') {
      currentPageData = data;
      updateSourceInfo();
      loadSettingsAndSummarize();
    } else if (type === 'UPDATE_SELECTION_TEXT') {
      if (currentPageData) {
        currentPageData.selectedText = data.text;
        updateSourceInfo();
        startSummarizing();
      }
    }
  });

  function updateSourceInfo() {
    if (!currentPageData) return;
    if (currentPageData.selectedText) {
      sourceTitle.textContent = `✂️ Đoạn đã chọn: "${currentPageData.selectedText.slice(0, 45)}..."`;
    } else if (currentPageData.isYouTube) {
      sourceTitle.textContent = `🎬 Video YouTube: ${currentPageData.title}`;
    } else {
      sourceTitle.textContent = `📄 ${currentPageData.title}`;
    }
  }

  // 4. Load Saved Settings
  async function loadSettingsAndSummarize() {
    const settings = await chrome.storage.local.get({
      provider: 'web',
      model: 'gemini-2.0-flash',
      selectedLanguage: 'Vietnamese',
      activePrompt: 'auto',
      customPrompts: []
    });

    customPromptsList = settings.customPrompts || [];
    renderCustomPromptsOptions(customPromptsList);

    if (settings.selectedLanguage) {
      langSelect.value = settings.selectedLanguage;
    }
    if (settings.activePrompt) {
      const optionExists = Array.from(promptSelect.options).some(opt => opt.value === settings.activePrompt);
      if (optionExists) {
        promptSelect.value = settings.activePrompt;
      } else {
        promptSelect.value = 'auto';
      }
    }
    if (promptSelect.value === 'custom') {
      customPromptContainer.classList.remove('hidden');
    } else {
      customPromptContainer.classList.add('hidden');
    }

    if (settings.provider === 'api') {
      providerName.textContent = 'Gemini API (' + settings.model + ')';
    } else {
      providerName.textContent = 'Gemini Web (Đã đăng nhập)';
    }

    startSummarizing();
  }

  function renderCustomPromptsOptions(prompts) {
    if (!customPromptsGroup) return;
    customPromptsGroup.innerHTML = '';
    if (prompts && prompts.length > 0) {
      customPromptsGroup.style.display = '';
      prompts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = `custom_${p.id}`;
        opt.textContent = `✨ ${p.name}`;
        customPromptsGroup.appendChild(opt);
      });
    } else {
      customPromptsGroup.style.display = 'none';
    }
  }

  // 5. Build Prompt
  function buildPrompt(content, lang, mode) {
    let instruction = '';

    if (mode === 'auto') {
      instruction = `Bạn là một chuyên gia đúc kết tri thức và phân tích thông tin đỉnh cao. Hãy đọc kỹ nội dung sau và thực hiện:
1. [Phân loại]: Xác định nhanh loại nội dung (Tin tức/Thời sự, Hướng dẫn/Kỹ thuật, Phân tích/Kinh doanh, Khoa học/Triết lý, hay Bình luận/Quan điểm). Hiển thị ngắn gọn ở dòng đầu tiên: **🏷️ Phân loại: [Loại nội dung]**.
2. [Tóm tắt tối ưu theo phân loại]:
   - Nếu là Tin tức/Sự kiện: Tóm lược theo mô hình 5W1H (Ai, Cái gì, Khi nào, Ở đâu, Tại sao, Thế nào) trong 3-5 gạch đầu dòng súc tích.
   - Nếu là Hướng dẫn/Kỹ thuật/Thực hành: Liệt kê các bước thực hiện tuần tự, lưu ý sống còn và công cụ cần dùng.
   - Nếu là Phân tích/Kinh tế/Khoa học: Trình bày bối cảnh, luận điểm cốt lõi, số liệu/bằng chứng chính và hệ quả/ý nghĩa.
   - Nếu là Ý kiến/Quan điểm: Tóm tắt thông điệp của tác giả, luận cứ bảo vệ và góc nhìn phản biện (nếu có).
3. [Điểm đúc kết - Golden Nugget]: Đúc kết 1 câu duy nhất giá trị hoặc bài học đáng nhớ nhất của toàn bộ bài viết.
Định dạng bài viết thoáng, dùng bullet points và emoji hợp lý để người đọc nắm bắt toàn bộ thông tin trong 60 giây. Trả lời bằng ngôn ngữ: ${lang}.`;
    } else if (mode === 'bulletpoints') {
      instruction = `Hãy tóm tắt nội dung sau thành các ý chính rõ ràng, súc tích dưới dạng gạch đầu dòng (bullet points). Thêm emoji thích hợp ở đầu mỗi ý chính để dễ theo dõi. Trả lời bằng ngôn ngữ: ${lang}.`;
    } else if (mode === 'tldr') {
      instruction = `Hãy viết một đoạn tóm tắt siêu ngắn gọn (TL;DR) trong đúng 2-3 câu làm nổi bật thông điệp cốt lõi nhất của nội dung. Trả lời bằng ngôn ngữ: ${lang}.`;
    } else if (mode === 'takeaways') {
      instruction = `Hãy rút ra 3-5 bài học sâu sắc, bài học kinh nghiệm hoặc kế hoạch hành động cụ thể (Actionable Takeaways) có thể áp dụng ngay từ nội dung sau. Trả lời bằng ngôn ngữ: ${lang}.`;
    } else if (mode === 'feynman') {
      instruction = `Hãy áp dụng Kỹ thuật Feynman: Giải thích toàn bộ nội dung và các khái niệm phức tạp trong bài này theo cách đơn giản, dễ hiểu nhất như đang giải thích cho một người hoàn toàn mới bắt đầu (hoặc học sinh). Sử dụng các ví dụ minh họa và hình ảnh ẩn dụ gần gũi trong đời sống, tuyệt đối tránh thuật ngữ rườm rà (hoặc phải giải nghĩa ngay nếu bắt buộc dùng). Trả lời bằng ngôn ngữ: ${lang}.`;
    } else if (mode === 'mindmap') {
      instruction = `Hãy tái cấu trúc nội dung sau thành một sơ đồ tư duy logic dạng phân cấp (Mindmap / Outline cấu trúc) bao gồm:
- 🎯 Chủ đề trung tâm
  - 🔹 Nhánh chính 1: ...
    - • Chi tiết/Số liệu bổ trợ
  - 🔹 Nhánh chính 2: ...
    - • Chi tiết/Số liệu bổ trợ
Làm nổi bật mối quan hệ nguyên nhân - kết quả và luồng logic xuyên suốt bài viết. Trả lời bằng ngôn ngữ: ${lang}.`;
    } else if (mode === 'flashcard') {
      instruction = `Dựa trên nội dung sau, hãy tạo ra 3-6 thẻ câu hỏi - trả lời dạng Flashcards (Active Recall) để người đọc tự ôn tập và ghi nhớ sâu các kiến thức cốt lõi:
- ❓ **Q1**: [Câu hỏi trọng tâm]?
  👉 **A1**: [Câu trả lời ngắn gọn, chính xác, kèm bối cảnh]
- ❓ **Q2**: ...
Trả lời bằng ngôn ngữ: ${lang}.`;
    } else if (mode === 'critical') {
      instruction = `Hãy phân tích nội dung sau bằng tư duy phản biện (Critical Thinking):
1. **Luận điểm & Giả định ngầm**: Tác giả đang muốn người đọc tin vào điều gì? Có giả định ngầm nào không?
2. **Bằng chứng & Dữ liệu**: Những dữ liệu, dẫn chứng nào đáng tin cậy?
3. **Lỗ hổng & Điểm mù**: Có chi tiết nào bị phóng đại, suy diễn phiến diện hoặc thông tin quan trọng bị bỏ qua không?
4. **Góc nhìn đối lập**: Đâu là quan điểm trái chiều hoặc câu hỏi cần đặt ra thêm?
Trả lời bằng ngôn ngữ: ${lang}.`;
    } else if (mode === 'detailed') {
      instruction = `Hãy phân tích và tóm tắt toàn diện nội dung sau, bao gồm bối cảnh, luận điểm chính, số liệu dẫn chứng và kết luận. Sử dụng tiêu đề và gạch đầu dòng rõ ràng. Trả lời bằng ngôn ngữ: ${lang}.`;
    } else if (mode.startsWith('custom_')) {
      const customId = mode.replace('custom_', '');
      const found = customPromptsList.find(p => String(p.id) === customId);
      if (found && found.prompt) {
        instruction = `${found.prompt}\nTrả lời bằng ngôn ngữ: ${lang}.`;
      } else {
        instruction = `Hãy tóm tắt nội dung sau bằng ngôn ngữ: ${lang}.`;
      }
    } else if (mode === 'custom') {
      const customQ = customPromptInput.value.trim();
      instruction = customQ ? `${customQ}\nTrả lời bằng ngôn ngữ: ${lang}.` : `Hãy tóm tắt nội dung sau bằng ngôn ngữ: ${lang}.`;
    } else {
      instruction = `Hãy tóm tắt nội dung sau bằng ngôn ngữ: ${lang}.`;
    }

    return `${instruction}\n\nNội dung cần xử lý:\n"""\n${content}\n"""`;
  }

  // 6. Execute Summarization via Background Service Worker
  function startSummarizing() {
    if (!currentPageData) return;

    const contentToSummarize = currentPageData.selectedText || currentPageData.textContent;
    if (!contentToSummarize || contentToSummarize.trim().length === 0) {
      showError('Không tìm thấy nội dung văn bản phù hợp trên trang này để tóm tắt.');
      return;
    }

    // UI state
    showLoading();
    currentRawText = '';
    resultContainer.innerHTML = '';

    const lang = langSelect.value;
    const mode = promptSelect.value;
    const prompt = buildPrompt(contentToSummarize, lang, mode);

    // Close previous port if open
    if (port) {
      try { port.disconnect(); } catch (e) {}
    }

    // Open connection to background worker
    port = chrome.runtime.connect({ name: 'gemini-summarize-channel' });

    port.onMessage.addListener((msg) => {
      switch (msg.type) {
        case 'token':
          currentRawText += msg.text;
          renderResult(currentRawText);
          break;
        case 'done':
          hideLoading();
          break;
        case 'error':
          hideLoading();
          handleErrorResponse(msg);
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      hideLoading();
    });

    // Send request
    port.postMessage({
      type: 'summarize',
      prompt: prompt,
      pageTitle: currentPageData.title,
      pageUrl: currentPageData.url
    });
  }

  function renderResult(markdown) {
    hideLoading();
    errorState.classList.add('hidden');
    resultContainer.classList.remove('hidden');

    if (window.marked && typeof window.marked.parse === 'function') {
      resultContainer.innerHTML = window.marked.parse(markdown);
    } else {
      resultContainer.innerText = markdown;
    }

    // Auto-scroll to bottom as text streams in
    contentScroll.scrollTop = contentScroll.scrollHeight;
  }

  function showLoading(text) {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    if (text) loadingMsg.textContent = text;
  }

  function hideLoading() {
    loadingState.classList.add('hidden');
  }

  function showError(msg) {
    hideLoading();
    resultContainer.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMessage.textContent = msg;
    btnLoginGemini.classList.add('hidden');
  }

  function handleErrorResponse(msg) {
    hideLoading();

    // If summary has already been produced, do not hide it
    if (currentRawText && currentRawText.trim().length > 0) {
      console.warn('[Popup] Non-critical error after content was generated:', msg);
      return;
    }

    resultContainer.classList.add('hidden');
    errorState.classList.remove('hidden');

    if (msg.code === 'NOT_LOGGED_IN') {
      errorMessage.textContent = 'Bạn chưa đăng nhập Google Gemini trên trình duyệt này. Vui lòng bấm vào nút dưới đây để đăng nhập vào tài khoản Google rồi thử lại.';
      btnLoginGemini.classList.remove('hidden');
    } else {
      errorMessage.textContent = msg.message || 'Đã xảy ra lỗi khi kết nối với Gemini. Vui lòng thử lại hoặc kiểm tra cài đặt.';
      btnLoginGemini.classList.add('hidden');
    }
  }

  // Tell parent window that popup is loaded and ready to receive page data
  window.parent.postMessage({
    type: 'POPUP_READY',
    runtimeId: chrome.runtime.id
  }, '*');

  // Retry after 400ms if parent message hasn't arrived
  setTimeout(() => {
    if (!currentPageData) {
      window.parent.postMessage({
        type: 'POPUP_READY',
        runtimeId: chrome.runtime.id
      }, '*');
    }
  }, 400);

})();
