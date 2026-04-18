document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const apiKeyInput = document.getElementById('api-key');
    const quickReplies = document.querySelectorAll('.quick-reply');

    // Restore API key if saved in session
    const savedKey = sessionStorage.getItem('gemini_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
    }

    // Save API key on change
    apiKeyInput.addEventListener('change', (e) => {
        sessionStorage.setItem('gemini_api_key', e.target.value.trim());
    });

    // Auto-resize textarea
    userInput.addEventListener('input', function () {
        this.style.height = '';
        this.style.height = this.scrollHeight + 'px';

        // Enable/disable send button
        if (this.value.trim().length > 0) {
            sendBtn.removeAttribute('disabled');
        } else {
            sendBtn.setAttribute('disabled', 'true');
        }
    });

    // Handle initial state
    if (userInput.value.trim().length === 0) {
        sendBtn.setAttribute('disabled', 'true');
    }

    // Handle Quick Replies
    quickReplies.forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.innerText;
            userInput.value = text;
            userInput.dispatchEvent(new Event('input')); // Trigger resize and btn state
            sendMessage();
        });
    });

    // Send Message on Enter
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send Message on Button Click
    sendBtn.addEventListener('click', () => {
        sendMessage();
    });

    // Add Message to DOM
    function appendMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role === 'user' ? 'user-message' : 'bot-message');

        const avatarIcon = role === 'user' ? 'fa-user' : 'fa-robot';
        const parsedContent = role === 'bot' && typeof marked !== 'undefined' ? marked.parse(content) : content;

        messageDiv.innerHTML = `
            <div class="avatar"><i class="fa-solid ${avatarIcon}"></i></div>
            <div class="bubble">
                <div class="content">${parsedContent}</div>
            </div>
        `;

        chatContainer.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv;
    }

    function addTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot-message');
        messageDiv.id = 'typing-indicator-msg';

        messageDiv.innerHTML = `
            <div class="avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="bubble">
                <div class="typing-indicator active">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;

        chatContainer.appendChild(messageDiv);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator-msg');
        if (indicator) {
            indicator.remove();
        }
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // System prompt for travel context
    const systemPrompt = `You are TravelOptima, an elite business travel optimization assistant. 
    Your goal is to help corporate travelers plan optimal itineraries, suggest cost-effective flights, and find convenient hotels. 
    You must ALWAYS use your Google Search tool to find live, real-time prices for flights and hotels to ensure accuracy.
    Provide concise, professional, and structured responses. Where possible, outline steps or suggest specific actions format.`;

    let messageHistory = [
        { role: "system", content: systemPrompt }
    ];

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        const apiKey = apiKeyInput.value.trim() || sessionStorage.getItem('gemini_api_key');

        if (!apiKey) {
            alert('Please enter your API key in the sidebar to use the chatbot.');
            apiKeyInput.focus();
            return;
        }

        // Add user message to UI and history
        appendMessage('user', text);
        messageHistory.push({ role: "user", content: text });

        // Reset input immediately for better UX
        userInput.value = '';
        userInput.style.height = '';
        sendBtn.setAttribute('disabled', 'true');

        // Add typing indicator
        addTypingIndicator();

        try {
            // Formatting history for Gemini (user and model roles)
            const geminiHistory = messageHistory.filter(msg => msg.role !== 'system').map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: geminiHistory,
                    systemInstruction: {
                        role: 'user',
                        parts: [{ text: systemPrompt }]
                    },
                    tools: [{ googleSearch: {} }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to fetch Gemini response');
            }

            const data = await response.json();
            const botReply = data.candidates[0].content.parts[0].text;

            removeTypingIndicator();
            appendMessage('bot', botReply);
            messageHistory.push({ role: "assistant", content: botReply });

        } catch (error) {
            removeTypingIndicator();
            appendMessage('bot', `**Error:** ${error.message}\n\nPlease verify your API key and try again.`);
        }
    }
});
