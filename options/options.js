/**
 * Gemini Summarize - Options Controller
 * Handles user settings, custom prompts management, and Gemini web session status.
 */
(function() {
  'use strict';

  // Elements
  const providerWeb = document.getElementById('provider-web');
  const providerApi = document.getElementById('provider-api');
  const cardWeb = document.getElementById('card-provider-web');
  const cardApi = document.getElementById('card-provider-api');
  const apiKeyConfig = document.getElementById('api-key-config');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnToggleKey = document.getElementById('btn-toggle-key');
  const modelSelect = document.getElementById('model-select');
  const btnCheckLogin = document.getElementById('btn-check-login');
  const loginStatusText = document.getElementById('login-status-text');
  const defaultLang = document.getElementById('default-lang');
  const defaultPromptSelect = document.getElementById('default-prompt-select');
  const optCustomPromptsGroup = document.getElementById('opt-custom-prompts-group');
  const autoDeleteSessionToggle = document.getElementById('auto-delete-session-toggle');
  const autoSummarizeToggle = document.getElementById('auto-summarize-toggle');
  const selectionButtonToggle = document.getElementById('selection-button-toggle');
  const btnSave = document.getElementById('btn-save');
  const saveFeedback = document.getElementById('save-feedback');

  // Custom Prompts Elements
  const btnAddPrompt = document.getElementById('btn-add-prompt');
  const promptEditorBox = document.getElementById('prompt-editor-box');
  const editorTitle = document.getElementById('editor-title');
  const promptNameInput = document.getElementById('prompt-name-input');
  const promptTextInput = document.getElementById('prompt-text-input');
  const btnSaveCustomPrompt = document.getElementById('btn-save-custom-prompt');
  const btnCancelCustomPrompt = document.getElementById('btn-cancel-custom-prompt');
  const customPromptsList = document.getElementById('custom-prompts-list');
  const suggestedPromptsList = document.getElementById('suggested-prompts-list');

  // State
  let customPrompts = [];
  let editingPromptId = null;

  // Suggested Presets
  const SUGGESTED_PRESETS = [
    {
      name: '💼 Phân tích SWOT',
      prompt: 'Hãy phân tích bài viết sau theo mô hình SWOT: 1. Strengths (Điểm mạnh), 2. Weaknesses (Điểm yếu), 3. Opportunities (Cơ hội phát triển), 4. Threats (Thách thức & Rủi ro). Đưa ra các khuyến nghị chiến lược súc tích.'
    },
    {
      name: '⚖️ So sánh Ưu & Nhược điểm',
      prompt: 'Hãy lập bảng hoặc danh sách so sánh chi tiết giữa Ưu điểm (Pros) và Nhược điểm (Cons) của vấn đề được thảo luận trong bài. Đưa ra kết luận khách quan.'
    },
    {
      name: '🚀 Kế hoạch hành động 24h',
      prompt: 'Hãy trích xuất từ nội dung này một bản Checklist Hành Động gồm 3-5 việc cụ thể người đọc có thể thực hiện ngay trong vòng 24 giờ tới để áp dụng kiến thức vào thực tế.'
    },
    {
      name: '💰 Góc nhìn Đầu tư & Tài chính',
      prompt: 'Hãy phân tích nội dung sau dưới góc nhìn của một nhà đầu tư: Những tín hiệu thị trường quan trọng, cơ hội tiềm năng, rủi ro tiềm ẩn và nhận định xu hướng tương lai.'
    }
  ];

  // 1. Load Saved Settings
  async function loadSettings() {
    const data = await chrome.storage.local.get({
      provider: 'web',
      apiKey: '',
      model: 'gemini-2.0-flash',
      selectedLanguage: 'Vietnamese',
      activePrompt: 'auto',
      autoDeleteSession: true,
      autoSummarize: true,
      showSelectionButton: true,
      customPrompts: []
    });

    if (data.provider === 'api') {
      providerApi.checked = true;
      showApiConfig(true);
    } else {
      providerWeb.checked = true;
      showApiConfig(false);
    }

    apiKeyInput.value = data.apiKey || '';
    modelSelect.value = data.model || 'gemini-2.0-flash';
    defaultLang.value = data.selectedLanguage || 'Vietnamese';
    autoDeleteSessionToggle.checked = data.autoDeleteSession !== false;
    autoSummarizeToggle.checked = data.autoSummarize !== false;
    selectionButtonToggle.checked = data.showSelectionButton !== false;

    customPrompts = data.customPrompts || [];
    renderCustomPrompts();
    renderSuggestedPrompts();
    updateDefaultPromptSelect(data.activePrompt || 'auto');
  }

  function showApiConfig(show) {
    if (show) {
      apiKeyConfig.classList.remove('hidden');
      cardApi.classList.add('active');
      cardWeb.classList.remove('active');
    } else {
      apiKeyConfig.classList.add('hidden');
      cardWeb.classList.add('active');
      cardApi.classList.remove('active');
    }
  }

  // Radio change handlers
  providerWeb.addEventListener('change', () => showApiConfig(false));
  providerApi.addEventListener('change', () => showApiConfig(true));

  // Toggle API Key visibility
  btnToggleKey.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      btnToggleKey.textContent = '🔒';
    } else {
      apiKeyInput.type = 'password';
      btnToggleKey.textContent = '👁️';
    }
  });

  // Check login status live
  btnCheckLogin.addEventListener('click', async () => {
    loginStatusText.textContent = 'Đang kiểm tra...';
    loginStatusText.className = 'status-text';

    try {
      const res = await fetch('https://gemini.google.com/app', {
        method: 'GET',
        credentials: 'include'
      });

      if (!res.ok || res.url.includes('accounts.google.com')) {
        loginStatusText.textContent = '❌ Chưa đăng nhập Google Gemini!';
        loginStatusText.className = 'status-text error';
        return;
      }

      const html = await res.text();
      if (html.includes('"SNlM0e":')) {
        loginStatusText.textContent = '✅ Đã đăng nhập Gemini sẵn sàng!';
        loginStatusText.className = 'status-text ok';
      } else {
        loginStatusText.textContent = '❌ Chưa phát hiện phiên đăng nhập!';
        loginStatusText.className = 'status-text error';
      }
    } catch (e) {
      loginStatusText.textContent = '❌ Lỗi kết nối đến gemini.google.com';
      loginStatusText.className = 'status-text error';
    }
  });

  // 2. Custom Prompts Management
  function renderCustomPrompts() {
    customPromptsList.innerHTML = '';

    if (!customPrompts || customPrompts.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'empty-state-text';
      emptyNotice.textContent = 'Bạn chưa có câu lệnh tùy chỉnh nào. Bấm "+ Thêm Prompt mới" hoặc chọn các gợi ý bên dưới để thêm.';
      customPromptsList.appendChild(emptyNotice);
      return;
    }

    customPrompts.forEach((p) => {
      const item = document.createElement('div');
      item.className = 'prompt-item';

      const header = document.createElement('div');
      header.className = 'prompt-item-header';

      const titleSpan = document.createElement('strong');
      titleSpan.textContent = p.name;

      const actions = document.createElement('div');
      actions.className = 'custom-prompt-actions';

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn-icon-action';
      btnEdit.textContent = '✏️ Sửa';
      btnEdit.addEventListener('click', () => openEditor(p));

      const btnDelete = document.createElement('button');
      btnDelete.type = 'button';
      btnDelete.className = 'btn-icon-action btn-icon-delete';
      btnDelete.textContent = '🗑️ Xóa';
      btnDelete.addEventListener('click', () => deleteCustomPrompt(p.id));

      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);

      header.appendChild(titleSpan);
      header.appendChild(actions);

      const body = document.createElement('div');
      body.className = 'prompt-item-body';
      body.textContent = p.prompt;

      item.appendChild(header);
      item.appendChild(body);
      customPromptsList.appendChild(item);
    });
  }

  function renderSuggestedPrompts() {
    suggestedPromptsList.innerHTML = '';

    SUGGESTED_PRESETS.forEach(preset => {
      const card = document.createElement('div');
      card.className = 'suggested-card';

      const title = document.createElement('div');
      title.className = 'suggested-title';
      title.textContent = preset.name;

      const preview = document.createElement('div');
      preview.className = 'suggested-preview';
      preview.textContent = preset.prompt;

      const btnAdd = document.createElement('button');
      btnAdd.type = 'button';
      btnAdd.className = 'suggested-btn';
      btnAdd.textContent = '➕ Thêm vào Prompts';
      btnAdd.addEventListener('click', () => addSuggestedPrompt(preset));

      card.appendChild(title);
      card.appendChild(preview);
      card.appendChild(btnAdd);

      suggestedPromptsList.appendChild(card);
    });
  }

  function updateDefaultPromptSelect(selectedVal) {
    optCustomPromptsGroup.innerHTML = '';
    customPrompts.forEach(p => {
      const opt = document.createElement('option');
      opt.value = `custom_${p.id}`;
      opt.textContent = `✨ ${p.name}`;
      optCustomPromptsGroup.appendChild(opt);
    });

    if (selectedVal) {
      const exists = Array.from(defaultPromptSelect.options).some(o => o.value === selectedVal);
      if (exists) {
        defaultPromptSelect.value = selectedVal;
      } else {
        defaultPromptSelect.value = 'auto';
      }
    }
  }

  function openEditor(promptObj = null) {
    promptEditorBox.classList.remove('hidden');
    if (promptObj) {
      editingPromptId = promptObj.id;
      editorTitle.textContent = 'Chỉnh sửa câu lệnh';
      promptNameInput.value = promptObj.name;
      promptTextInput.value = promptObj.prompt;
    } else {
      editingPromptId = null;
      editorTitle.textContent = 'Thêm câu lệnh mới';
      promptNameInput.value = '';
      promptTextInput.value = '';
    }
    promptNameInput.focus();
  }

  function closeEditor() {
    promptEditorBox.classList.add('hidden');
    editingPromptId = null;
    promptNameInput.value = '';
    promptTextInput.value = '';
  }

  async function saveCustomPrompt() {
    const name = promptNameInput.value.trim();
    const prompt = promptTextInput.value.trim();

    if (!name || !prompt) {
      alert('Vui lòng điền đầy đủ tên gợi nhớ và nội dung câu lệnh.');
      return;
    }

    if (editingPromptId) {
      const idx = customPrompts.findIndex(p => p.id === editingPromptId);
      if (idx !== -1) {
        customPrompts[idx] = { id: editingPromptId, name, prompt };
      }
    } else {
      const newPrompt = {
        id: 'cp_' + Date.now(),
        name,
        prompt
      };
      customPrompts.push(newPrompt);
    }

    await chrome.storage.local.set({ customPrompts });
    renderCustomPrompts();
    updateDefaultPromptSelect(defaultPromptSelect.value);
    closeEditor();
  }

  async function deleteCustomPrompt(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa câu lệnh này?')) return;
    customPrompts = customPrompts.filter(p => p.id !== id);
    await chrome.storage.local.set({ customPrompts });
    renderCustomPrompts();
    updateDefaultPromptSelect(defaultPromptSelect.value);
  }

  async function addSuggestedPrompt(preset) {
    const newPrompt = {
      id: 'cp_' + Date.now(),
      name: preset.name,
      prompt: preset.prompt
    };
    customPrompts.push(newPrompt);
    await chrome.storage.local.set({ customPrompts });
    renderCustomPrompts();
    updateDefaultPromptSelect(defaultPromptSelect.value);

    // Scroll to custom prompts
    customPromptsList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  btnAddPrompt.addEventListener('click', () => openEditor());
  btnCancelCustomPrompt.addEventListener('click', closeEditor);
  btnSaveCustomPrompt.addEventListener('click', saveCustomPrompt);

  // 3. Save All Settings Button
  btnSave.addEventListener('click', async () => {
    const provider = providerApi.checked ? 'api' : 'web';
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    const selectedLanguage = defaultLang.value;
    const activePrompt = defaultPromptSelect.value;
    const autoDeleteSession = autoDeleteSessionToggle.checked;
    const autoSummarize = autoSummarizeToggle.checked;
    const showSelectionButton = selectionButtonToggle.checked;

    await chrome.storage.local.set({
      provider,
      apiKey,
      model,
      selectedLanguage,
      activePrompt,
      autoDeleteSession,
      autoSummarize,
      showSelectionButton,
      customPrompts
    });

    saveFeedback.classList.remove('hidden');
    setTimeout(() => {
      saveFeedback.classList.add('hidden');
    }, 2500);
  });

  document.addEventListener('DOMContentLoaded', loadSettings);
})();
