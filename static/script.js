document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded fired"); // Debug log

    // Initialize theme
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
        const themeToggle = document.getElementById("theme-toggle");
        if (themeToggle) themeToggle.innerText = "☀️";
    }

    // Initialize user data
    let userId = localStorage.getItem("user_id");
    if (!userId) {
        userId = generateUUID();
        localStorage.setItem("user_id", userId);
    }

    // Initialize chat container
    const chatContainer = document.getElementById("chat-container");
    const assistantBubble = document.getElementById("assistant-bubble");
    if (chatContainer && assistantBubble) {
        console.log("Chat container and assistant bubble found");
        if (localStorage.getItem("chat_open") === "true") {
            chatContainer.classList.remove("hidden");
            assistantBubble.style.display = "none";
        }
        // Ensure event listener is attached
        assistantBubble.addEventListener("click", toggleChat);
    } else {
        console.error("Chat container or assistant bubble not found");
    }

    // Load chat history
    const chatHistory = document.getElementById("chat-history");
    if (chatHistory) updateChatHistory();

    // Set up event listeners only if elements exist
    const sendBtn = document.getElementById("send-btn");
    const userInput = document.getElementById("user-input");
    const themeToggle = document.getElementById("theme-toggle");
    const closeChat = document.getElementById("close-chat");
    const micBtn = document.getElementById("mic-btn");
    const userType = document.getElementById("user-type");
    const categorySidebar = document.querySelector(".category-sidebar");

    if (sendBtn) sendBtn.addEventListener("click", sendMessage);
    if (userInput) {
        userInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }
    if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
    if (closeChat) closeChat.addEventListener("click", toggleChat);
    if (micBtn) micBtn.addEventListener("click", startVoiceInput);
    if (userType) userType.addEventListener("change", updateUserType);
    if (categorySidebar) {
        categorySidebar.addEventListener("click", (e) => {
            if (e.target.tagName === "LI") {
                const category = e.target.dataset.category;
                displayCategoryQuestions(category);
            }
        });
    }

    // Cache FAQ data
    fetch("/static/faq_data.json")
        .then(res => res.json())
        .then(data => {
            localStorage.setItem("faq_data", JSON.stringify(data));
        })
        .catch(err => console.error("Failed to fetch FAQ data:", err));
});

function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function toggleTheme() {
    const body = document.body;
    const toggleButton = document.getElementById("theme-toggle");
    if (!toggleButton) return;
    body.classList.toggle("dark-mode");
    const isDarkMode = body.classList.contains("dark-mode");
    toggleButton.innerText = isDarkMode ? "☀️" : "🌙";
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
}

function toggleChat() {
    console.log("toggleChat called"); // Debug log
    const chatContainer = document.getElementById("chat-container");
    const assistantBubble = document.getElementById("assistant-bubble");
    if (!chatContainer || !assistantBubble) {
        console.error("toggleChat: Chat container or assistant bubble not found");
        return;
    }
    const isHidden = chatContainer.classList.contains("hidden");
    if (isHidden) {
        chatContainer.classList.remove("hidden");
        assistantBubble.style.display = "none";
        localStorage.setItem("chat_open", "true");
        console.log("Chat opened");
    } else {
        chatContainer.classList.add("hidden");
        assistantBubble.style.display = "flex";
        localStorage.setItem("chat_open", "false");
        console.log("Chat closed");
    }
}

function startVoiceInput() {
    const micBtn = document.getElementById("mic-btn");
    const userInput = document.getElementById("user-input");
    if (!micBtn || !userInput) return;

    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-IN";
    recognition.start();
    micBtn.style.background = "#357ABD";

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        sendMessage();
    };

    recognition.onend = () => {
        micBtn.style.background = "";
    };

    recognition.onerror = () => {
        addMessage("Sorry, I couldn't understand your voice input. 😓", "bot");
        micBtn.style.background = "";
    };
}

function updateUserType() {
    const userType = document.getElementById("user-type");
    if (userType) localStorage.setItem("user_type", userType.value);
}

function displayCategoryQuestions(category) {
    const chatBox = document.getElementById("chat-box");
    if (!chatBox) return;
    chatBox.innerHTML = "";
    const userType = localStorage.getItem("user_type") || "Student";
    const faqs = JSON.parse(localStorage.getItem("faq_data") || "{}")[userType] || {};
    const questions = faqs[category] || {};
    for (const [question, answer] of Object.entries(questions)) {
        addMessage(`${question}\n${answer.join(" ")}`, "bot");
    }
}

function sendMessage() {
    const inputBox = document.getElementById("user-input");
    if (!inputBox) return;
    const message = inputBox.value.trim();
    if (message === "") return;

    addMessage(message, "user");
    inputBox.value = "";

    const userId = localStorage.getItem("user_id");
    const userType = (document.getElementById("user-type")?.value) || localStorage.getItem("user_type") || "Student";
    let userName = localStorage.getItem("user_name") || "User";

    // If this is the first message and no name is set, assume the input is the name
    const isFirstMessage = !localStorage.getItem("has_responded");
    if (isFirstMessage && userName === "User") {
        userName = message;
        localStorage.setItem("user_name", userName);
        localStorage.setItem("has_responded", "true");
        addMessage(`Thanks, ${userName}! I'll use your name from now on. How can I assist you?`, "bot");
        return; // Skip sending to backend for name input
    }

    addMessage("", "typing");

    fetch("/get", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ msg: message, user_id: userId, user_type: userType, user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        const typingBubble = document.querySelector(".typing");
        if (typingBubble) typingBubble.remove();
        addMessage(data.reply, "bot", true);
        localStorage.setItem("user_id", data.user_id);
        const history = JSON.parse(localStorage.getItem("chat_history") || "[]");
        history.push(message);
        localStorage.setItem("chat_history", JSON.stringify(history.slice(-3)));
        updateChatHistory();
    })
    .catch(error => {
        console.error("Fetch error:", error);
        const typingBubble = document.querySelector(".typing");
        if (typingBubble) typingBubble.remove();
        addMessage("Oops! Something went wrong. 😓", "bot");
    });
}

function addMessage(message, type, isBotReply = false) {
    const chatBox = document.getElementById("chat-box");
    if (!chatBox) return;
    const bubble = document.createElement("div");
    bubble.className = type === "user" ? "user-bubble" : type === "typing" ? "bot-bubble typing" : "bot-bubble";
    bubble.innerText = message;

    if (isBotReply) {
        const actions = document.createElement("div");
        actions.className = "bubble-actions";
        const copyBtn = document.createElement("button");
        copyBtn.innerText = "Copy";
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(message);
            alert("Answer copied to clipboard!");
        };
        const shareBtn = document.createElement("button");
        shareBtn.innerText = "Share on WhatsApp";
        shareBtn.onclick = () => {
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`);
        };
        const feedbackUp = document.createElement("button");
        feedbackUp.innerText = "👍";
        feedbackUp.onclick = () => submitFeedback(message, "positive");
        const feedbackDown = document.createElement("button");
        feedbackDown.innerText = "👎";
        feedbackDown.onclick = () => submitFeedback(message, "negative");
        actions.appendChild(copyBtn);
        actions.appendChild(shareBtn);
        actions.appendChild(feedbackUp);
        actions.appendChild(feedbackDown);
        bubble.appendChild(actions);
    }

    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function submitFeedback(message, feedback) {
    const userId = localStorage.getItem("user_id");
    fetch("/feedback", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ user_id: userId, message, feedback })
    })
    .then(response => response.json())
    .then(data => {
        addMessage("Thanks for your feedback!", "bot");
    });
}

function updateChatHistory() {
    const chatHistory = document.getElementById("chat-history");
    if (!chatHistory) return;
    chatHistory.innerHTML = "";
    const history = JSON.parse(localStorage.getItem("chat_history") || "[]").slice(-3);
    history.forEach(msg => {
        const div = document.createElement("div");
        div.innerText = msg;
        div.onclick = () => {
            const inputBox = document.getElementById("user-input");
            if (inputBox) {
                inputBox.value = msg;
                sendMessage();
            }
        };
        chatHistory.appendChild(div);
    });
}