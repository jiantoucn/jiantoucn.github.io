
// Configuration
const DEFAULT_MODELS = [
    { id: 'deepseek-ai/DeepSeek-V3.2', name: 'DeepSeek V3.2' },
    { id: 'zai-org/GLM-4.6V', name: 'GLM 4.6V' },
    { id: 'Qwen/Qwen3-8B', name: 'Qwen 3 8B' },
    { id: 'moonshotai/Kimi-K2-Thinking', name: 'Kimi K2 Thinking' },
    { id: 'tencent/Hunyuan-A13B-Instruct', name: 'Hunyuan A13B' }
];

const API_ENDPOINT = 'https://api.siliconflow.cn/v1/chat/completions';

// State
let state = {
    apiKey: localStorage.getItem('siliconflow_api_key') || '',
    currentChatId: Date.now().toString(), // Simple ID generation
    history: JSON.parse(localStorage.getItem('chat_history') || '[]'),
    // Structure: { [modelId]: [{role, content}, ...] }
    conversations: {},
    isGenerating: false
};

// Initialize conversations structure
DEFAULT_MODELS.forEach(m => state.conversations[m.id] = []);

// DOM Elements
const els = {
    apiKeyInput: document.getElementById('api-key-input'),
    saveKeyBtn: document.getElementById('save-key-btn'),
    globalInput: document.getElementById('global-input'),
    sendBtn: document.getElementById('send-btn'),
    chatGrid: document.getElementById('chat-grid'),
    sidebar: document.getElementById('sidebar'),
    historyList: document.getElementById('history-list'),
    newChatBtn: document.getElementById('new-chat-btn'),
    historyToggleBtn: document.getElementById('history-toggle-btn'),
    closeSidebarBtn: document.getElementById('close-sidebar'),
    overlay: document.getElementById('overlay')
};

// Initialization
function init() {
    els.apiKeyInput.value = state.apiKey;
    renderHistoryList();
    renderChatColumns();
    setupEventListeners();
    
    // Load latest chat if exists and no current active chat logic (for now, always new or clean start)
    // If user wants to persist last state, we could do that, but "New Chat" logic implies session based.
    // We will start fresh by default as requested "Support new chat".
}

// Render Columns
function renderChatColumns() {
    els.chatGrid.innerHTML = '';
    const template = document.getElementById('chat-column-template');

    DEFAULT_MODELS.forEach(model => {
        const clone = template.content.cloneNode(true);
        const col = clone.querySelector('.chat-column');
        
        // Set Model Info
        col.dataset.modelId = model.id;
        col.querySelector('.model-name').textContent = model.name;
        col.querySelector('.model-name').title = model.id;

        // Individual Send Logic
        const indInput = col.querySelector('.individual-input');
        const indSendBtn = col.querySelector('.individual-send-btn');
        const indContainer = col.querySelector('.individual-input-container');

        // Show individual input on hover or always? Let's show always for better UX as requested
        indContainer.classList.remove('hidden'); 

        const handleIndividualSend = () => {
            const text = indInput.value.trim();
            if (!text) return;
            if (!state.apiKey) {
                alert('请先设置 API Key');
                return;
            }
            indInput.value = '';
            sendMessage(text, [model.id]);
        };

        indSendBtn.onclick = handleIndividualSend;
        indInput.onkeydown = (e) => {
            if (e.key === 'Enter') handleIndividualSend();
        };
        
        // Clear Chat Logic
        col.querySelector('.clear-chat-btn').onclick = () => {
            if(confirm('确定清空此模型的对话记录吗？')) {
                state.conversations[model.id] = [];
                const msgContainer = col.querySelector('.messages-container');
                msgContainer.innerHTML = '<div class="welcome-msg text-center text-gray-400 text-xs mt-10">对话已清空</div>';
            }
        };

        els.chatGrid.appendChild(col);
    });
}

// Event Listeners
function setupEventListeners() {
    // API Key
    els.saveKeyBtn.onclick = () => {
        const key = els.apiKeyInput.value.trim();
        if (key) {
            state.apiKey = key;
            localStorage.setItem('siliconflow_api_key', key);
            alert('API Key 已保存');
        }
    };

    // Global Send
    const handleGlobalSend = () => {
        const text = els.globalInput.value.trim();
        if (!text) return;
        if (!state.apiKey) {
            alert('请先输入并保存 API Key');
            return;
        }
        
        els.globalInput.value = '';
        // Send to ALL models
        const allModelIds = DEFAULT_MODELS.map(m => m.id);
        sendMessage(text, allModelIds);
    };

    els.sendBtn.onclick = handleGlobalSend;
    els.globalInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGlobalSend();
        }
    };

    // Sidebar
    const toggleSidebar = () => {
        const isClosed = els.sidebar.classList.contains('-ml-64');
        if (isClosed) {
            els.sidebar.classList.remove('-ml-64');
            els.overlay.classList.remove('hidden');
        } else {
            els.sidebar.classList.add('-ml-64');
            els.overlay.classList.add('hidden');
        }
    };
    els.historyToggleBtn.onclick = toggleSidebar;
    els.closeSidebarBtn.onclick = toggleSidebar;
    els.overlay.onclick = toggleSidebar;

    // New Chat
    els.newChatBtn.onclick = () => {
        createNewChat();
        if (!els.sidebar.classList.contains('-ml-64')) toggleSidebar();
    };
}

// Core Logic: Send Message
async function sendMessage(text, targetModelIds) {
    if (state.isGenerating) return; // Prevent double send for now
    
    // 1. Update UI & State with User Message
    targetModelIds.forEach(modelId => {
        // Add to state
        if (!state.conversations[modelId]) state.conversations[modelId] = [];
        state.conversations[modelId].push({ role: 'user', content: text });
        
        // Update UI
        appendMessageUI(modelId, 'user', text);
    });

    // 2. Trigger API Calls
    // We don't block UI, fire and forget (handle async)
    state.isGenerating = true;
    updateStatusIndicators('busy', targetModelIds);

    const promises = targetModelIds.map(modelId => callLLM(modelId));
    
    try {
        await Promise.allSettled(promises);
    } finally {
        state.isGenerating = false;
        updateStatusIndicators('idle', targetModelIds);
        saveToHistory(); // Auto save after turn
    }
}

// Call LLM
async function callLLM(modelId) {
    const messages = state.conversations[modelId];
    // Filter out system messages if any (we don't have them yet)
    
    const col = document.querySelector(`.chat-column[data-model-id="${CSS.escape(modelId)}"]`);
    if (!col) return;

    // Create placeholder for AI response
    const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    appendMessageUI(modelId, 'assistant', '', msgId);
    const msgContentDiv = document.getElementById(msgId).querySelector('.markdown-body');
    
    let fullResponse = '';

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelId,
                messages: messages,
                stream: true, // Try streaming
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr.trim() === '[DONE]') continue;
                    
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            msgContentDiv.innerHTML = marked.parse(fullResponse);
                            // Scroll to bottom
                            const container = col.querySelector('.messages-container');
                            container.scrollTop = container.scrollHeight;
                        }
                    } catch (e) {
                        console.warn('Parse error', e);
                    }
                }
            }
        }

        // Finalize state
        state.conversations[modelId].push({ role: 'assistant', content: fullResponse });

    } catch (error) {
        msgContentDiv.innerHTML += `\n\n*[Error: ${error.message}]*`;
        msgContentDiv.classList.add('text-red-500');
        state.conversations[modelId].push({ role: 'assistant', content: `[Error: ${error.message}]` });
    }
}

// UI Helper: Append Message
function appendMessageUI(modelId, role, content, specificId = null) {
    const col = document.querySelector(`.chat-column[data-model-id="${CSS.escape(modelId)}"]`);
    if (!col) return;

    const container = col.querySelector('.messages-container');
    // Remove welcome msg if exists
    const welcome = container.querySelector('.welcome-msg');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    if (specificId) div.id = specificId;
    
    const isUser = role === 'user';
    div.className = `flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`;
    
    const bubbleColor = isUser ? 'bg-blue-100 text-gray-800' : 'bg-white border border-gray-200 text-gray-800';
    
    div.innerHTML = `
        <div class="max-w-[90%] rounded-lg p-3 text-sm ${bubbleColor} shadow-sm">
            <div class="markdown-body text-xs sm:text-sm break-words">${isUser ? content : marked.parse(content)}</div>
        </div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// UI Helper: Update Status
function updateStatusIndicators(status, modelIds) {
    modelIds.forEach(id => {
        const col = document.querySelector(`.chat-column[data-model-id="${CSS.escape(id)}"]`);
        if (col) {
            const dot = col.querySelector('.status-indicator');
            if (status === 'busy') {
                dot.classList.remove('bg-green-500');
                dot.classList.add('bg-yellow-500', 'animate-pulse');
            } else {
                dot.classList.add('bg-green-500');
                dot.classList.remove('bg-yellow-500', 'animate-pulse');
            }
        }
    });
}

// History Management
function saveToHistory() {
    // Check if empty
    let hasContent = false;
    for (const k in state.conversations) {
        if (state.conversations[k].length > 0) hasContent = true;
    }
    if (!hasContent) return;

    const title = generateTitle();
    const existingIndex = state.history.findIndex(h => h.id === state.currentChatId);
    
    const entry = {
        id: state.currentChatId,
        title: title,
        timestamp: Date.now(),
        conversations: state.conversations
    };

    if (existingIndex >= 0) {
        state.history[existingIndex] = entry;
    } else {
        state.history.unshift(entry);
    }
    
    localStorage.setItem('chat_history', JSON.stringify(state.history));
    renderHistoryList();
}

function generateTitle() {
    // Find first user message
    for (const k in state.conversations) {
        const msgs = state.conversations[k];
        const firstUser = msgs.find(m => m.role === 'user');
        if (firstUser) {
            return firstUser.content.substring(0, 20) + (firstUser.content.length > 20 ? '...' : '');
        }
    }
    return 'New Chat ' + new Date().toLocaleString();
}

function renderHistoryList() {
    els.historyList.innerHTML = '';
    state.history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'p-2 hover:bg-gray-100 rounded cursor-pointer text-sm truncate border-b border-gray-50 flex justify-between group';
        if (item.id === state.currentChatId) div.classList.add('bg-blue-50', 'text-blue-600');
        
        div.innerHTML = `
            <span class="truncate flex-1">${item.title}</span>
            <button class="delete-chat-btn hidden group-hover:block text-gray-400 hover:text-red-500 ml-2" data-id="${item.id}">
                &times;
            </button>
        `;
        
        div.onclick = (e) => {
            if (e.target.classList.contains('delete-chat-btn')) return;
            loadChat(item.id);
        };
        
        div.querySelector('.delete-chat-btn').onclick = (e) => {
            e.stopPropagation();
            deleteChat(item.id);
        };
        
        els.historyList.appendChild(div);
    });
}

function loadChat(chatId) {
    const entry = state.history.find(h => h.id === chatId);
    if (!entry) return;
    
    state.currentChatId = entry.id;
    state.conversations = JSON.parse(JSON.stringify(entry.conversations)); // Deep copy
    
    // Clear UI
    document.querySelectorAll('.messages-container').forEach(el => el.innerHTML = '');
    
    // Restore UI
    DEFAULT_MODELS.forEach(model => {
        const msgs = state.conversations[model.id] || [];
        msgs.forEach(m => appendMessageUI(model.id, m.role, m.content));
    });
    
    renderHistoryList(); // Update active state
    // Close sidebar on mobile
    if (!els.sidebar.classList.contains('-ml-64') && window.innerWidth < 768) {
        els.sidebar.classList.add('-ml-64');
        els.overlay.classList.add('hidden');
    }
}

function createNewChat() {
    state.currentChatId = Date.now().toString();
    state.conversations = {};
    DEFAULT_MODELS.forEach(m => state.conversations[m.id] = []);
    
    // Clear UI
    document.querySelectorAll('.messages-container').forEach(el => el.innerHTML = '<div class="welcome-msg text-center text-gray-400 text-xs mt-10">等待开始对话...</div>');
    els.globalInput.value = '';
    
    renderHistoryList();
}

function deleteChat(chatId) {
    if (!confirm('确定删除此对话吗？')) return;
    state.history = state.history.filter(h => h.id !== chatId);
    localStorage.setItem('chat_history', JSON.stringify(state.history));
    
    if (state.currentChatId === chatId) {
        createNewChat();
    } else {
        renderHistoryList();
    }
}

// Start
init();
