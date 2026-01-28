/**
 * Rentagun Chat Widget
 * Embeddable chat widget for rentagun.com
 */
(function () {
  'use strict';

  // WordPress/external configuration (set by rentagun-chat-widget.php)
  const externalConfig = window.RENTAGUN_CHAT_CONFIG || {};

  // Configuration with defaults
  const CONFIG = {
    apiUrl: externalConfig.apiUrl || window.RENTAGUN_CHAT_API || 'https://rentagun-chatbot.vercel.app/api/chat',
    productsUrl: externalConfig.productsUrl || 'https://rentagun-chatbot.vercel.app/api/products',
    ordersUrl: externalConfig.ordersUrl || 'https://rentagun-chatbot.vercel.app/api/orders',
    subscribeUrl: externalConfig.subscribeUrl || 'https://rentagun-chatbot.vercel.app/api/subscribe',
    greeting: externalConfig.greeting || "Hey there! I'm the Rentagun concierge. I can help you find the perfect rental, check availability, or track your order. What can I help you with today?",
    position: externalConfig.position || 'bottom-right',
    pageContext: externalConfig.pageContext || null,
    quickActions: [
      { label: 'Browse Firearms', prompt: 'Show me what firearms you have available' },
      { label: 'How It Works', prompt: 'How does renting a firearm work?' },
      { label: 'Track My Order', prompt: "I'd like to check on my order status" },
      { label: 'Pricing', prompt: 'How much does it cost to rent?' }
    ],
    teaserMessages: [
      'Need help finding the perfect rental?',
      'Questions about how it works?',
      'Looking for something specific?'
    ],
    inactivityDelay: 45000, // 45 seconds
    productPageDelay: 20000, // 20 seconds on product pages
    emailCaptureAfter: 3 // Show email capture after 3 searches
  };

  // State
  let container = null;
  let bubble = null;
  let chatWindow = null;
  let messagesContainer = null;
  let inputField = null;
  let isOpen = false;
  let messages = [];
  let sessionId = generateSessionId();
  let isLoading = false;
  let searchCount = 0;
  let hasTriggeredProactive = false;
  let hasTriggeredExitIntent = false;
  let inactivityTimer = null;
  let emailCaptured = false;

  // Icons
  const ICONS = {
    chat: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
    minimize: '<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>',
    user: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
  };

  /**
   * Generate unique session ID
   */
  function generateSessionId() {
    return 'rag_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Initialize the widget
   */
  function init() {
    if (container) return; // Already initialized

    // Load CSS
    loadStyles();

    // Create container
    container = document.createElement('div');
    container.className = 'rag-widget' + (CONFIG.position === 'bottom-left' ? ' rag-position-left' : '');
    container.innerHTML = createWidgetHTML();
    document.body.appendChild(container);

    // Get references
    bubble = container.querySelector('.rag-bubble');
    chatWindow = container.querySelector('.rag-container');
    messagesContainer = container.querySelector('.rag-messages');
    inputField = container.querySelector('.rag-input');

    // Bind events
    bindEvents();

    // Restore conversation if exists
    restoreConversation();

    // Initialize growth triggers
    initGrowthTriggers();

    console.log('[Rentagun Chat] Widget initialized');
  }

  /**
   * Load widget styles
   */
  function loadStyles() {
    if (document.getElementById('rag-widget-styles')) return;

    const link = document.createElement('link');
    link.id = 'rag-widget-styles';
    link.rel = 'stylesheet';
    link.href = CONFIG.apiUrl + '/widget.css';
    document.head.appendChild(link);
  }

  /**
   * Create widget HTML
   */
  function createWidgetHTML() {
    return `
      <!-- Chat Bubble -->
      <button class="rag-bubble" aria-label="Open chat">
        ${ICONS.chat}
      </button>

      <!-- Teaser Message -->
      <div class="rag-teaser">
        <button class="rag-teaser-close" aria-label="Close">&times;</button>
        <p class="rag-teaser-text">${CONFIG.teaserMessages[0]}</p>
      </div>

      <!-- Chat Container -->
      <div class="rag-container">
        <!-- Header -->
        <div class="rag-header">
          <div class="rag-header-info">
            <div class="rag-header-avatar">${ICONS.user}</div>
            <div>
              <div class="rag-header-title">Rentagun Concierge</div>
              <div class="rag-header-subtitle">Ask me anything</div>
            </div>
          </div>
          <div class="rag-header-actions">
            <button class="rag-header-btn rag-clear-btn" title="Clear chat">${ICONS.refresh}</button>
            <button class="rag-header-btn rag-close-btn" title="Close">${ICONS.minimize}</button>
          </div>
        </div>

        <!-- Messages -->
        <div class="rag-messages"></div>

        <!-- Quick Actions -->
        <div class="rag-quick-actions"></div>

        <!-- Input Area -->
        <div class="rag-input-area">
          <textarea class="rag-input" placeholder="Type your message..." rows="1"></textarea>
          <button class="rag-send-btn" aria-label="Send">${ICONS.send}</button>
        </div>

        <!-- Email Capture Modal -->
        <div class="rag-email-modal">
          <div class="rag-email-content">
            <div class="rag-email-title">Get Personalized Recommendations</div>
            <div class="rag-email-subtitle">Enter your email and we'll send you deals on firearms you've shown interest in.</div>
            <input type="email" class="rag-email-input" placeholder="your@email.com" />
            <button class="rag-email-submit">Subscribe</button>
            <button class="rag-email-skip">Maybe later</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Bind event handlers
   */
  function bindEvents() {
    // Bubble click
    bubble.addEventListener('click', toggleChat);

    // Teaser close
    container.querySelector('.rag-teaser-close').addEventListener('click', hideTeaser);

    // Close button
    container.querySelector('.rag-close-btn').addEventListener('click', closeChat);

    // Clear button
    container.querySelector('.rag-clear-btn').addEventListener('click', clearConversation);

    // Send button
    container.querySelector('.rag-send-btn').addEventListener('click', sendMessage);

    // Input events
    inputField.addEventListener('keydown', handleKeyDown);
    inputField.addEventListener('input', handleInput);

    // Email modal
    container.querySelector('.rag-email-submit').addEventListener('click', submitEmail);
    container.querySelector('.rag-email-skip').addEventListener('click', skipEmail);

    // Reset inactivity on user interaction
    document.addEventListener('mousemove', resetInactivityTimer);
    document.addEventListener('scroll', resetInactivityTimer);
  }

  /**
   * Toggle chat open/close
   */
  function toggleChat() {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  /**
   * Open chat window
   */
  function openChat() {
    isOpen = true;
    chatWindow.classList.add('rag-open');
    bubble.innerHTML = ICONS.close;
    hideTeaser();

    // Show greeting if first open
    if (messages.length === 0) {
      addBotMessage(CONFIG.greeting);
      showQuickActions();
    }

    // Focus input
    setTimeout(() => inputField.focus(), 300);

    // Track event
    trackEvent('chat_opened');
  }

  /**
   * Close chat window
   */
  function closeChat() {
    isOpen = false;
    chatWindow.classList.remove('rag-open');
    bubble.innerHTML = ICONS.chat;
  }

  /**
   * Show teaser message
   */
  function showTeaser() {
    if (isOpen || hasTriggeredProactive) return;

    const teaser = container.querySelector('.rag-teaser');
    const text = container.querySelector('.rag-teaser-text');

    // Random teaser message
    const randomIndex = Math.floor(Math.random() * CONFIG.teaserMessages.length);
    text.textContent = CONFIG.teaserMessages[randomIndex];

    teaser.style.display = 'block';
    setTimeout(() => teaser.classList.add('rag-teaser-show'), 10);
    bubble.classList.add('pulse');

    hasTriggeredProactive = true;
  }

  /**
   * Hide teaser message
   */
  function hideTeaser() {
    const teaser = container.querySelector('.rag-teaser');
    teaser.classList.remove('rag-teaser-show');
    setTimeout(() => teaser.style.display = 'none', 300);
    bubble.classList.remove('pulse');
  }

  /**
   * Initialize growth triggers
   */
  function initGrowthTriggers() {
    // Inactivity trigger
    const delay = window.location.pathname.includes('/product')
      ? CONFIG.productPageDelay
      : CONFIG.inactivityDelay;

    inactivityTimer = setTimeout(() => {
      if (!isOpen && !hasTriggeredProactive) {
        showTeaser();
      }
    }, delay);

    // Exit intent (mouse leaves viewport at top)
    document.addEventListener('mouseout', handleExitIntent);
  }

  /**
   * Reset inactivity timer
   */
  function resetInactivityTimer() {
    if (hasTriggeredProactive) return;

    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      if (!isOpen && !hasTriggeredProactive) {
        showTeaser();
      }
    }, CONFIG.inactivityDelay);
  }

  /**
   * Handle exit intent
   */
  function handleExitIntent(e) {
    if (e.clientY < 10 && !hasTriggeredExitIntent && !isOpen) {
      showTeaser();
      hasTriggeredExitIntent = true;
    }
  }

  /**
   * Show quick action buttons
   */
  function showQuickActions() {
    const container = chatWindow.querySelector('.rag-quick-actions');
    container.innerHTML = CONFIG.quickActions.map(action =>
      `<button class="rag-quick-btn" data-prompt="${escapeHtml(action.prompt)}">${escapeHtml(action.label)}</button>`
    ).join('');

    // Bind click events
    container.querySelectorAll('.rag-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.dataset.prompt;
        inputField.value = prompt;
        sendMessage();
        container.innerHTML = ''; // Hide quick actions after use
      });
    });
  }

  /**
   * Handle keyboard input
   */
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  /**
   * Handle input changes (auto-resize)
   */
  function handleInput() {
    inputField.style.height = 'auto';
    inputField.style.height = Math.min(inputField.scrollHeight, 120) + 'px';
  }

  /**
   * Send message to API
   */
  async function sendMessage() {
    const content = inputField.value.trim();
    if (!content || isLoading) return;

    // Clear input
    inputField.value = '';
    inputField.style.height = 'auto';

    // Add user message
    addUserMessage(content);
    messages.push({ role: 'user', content });
    saveConversation();

    // Show typing indicator
    showTyping();
    isLoading = true;

    try {
      const response = await fetch(`${CONFIG.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId
        },
        body: JSON.stringify({ messages, sessionId })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botMessage = '';
      let messageElement = null;
      let hasToolResults = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'text') {
              if (!messageElement) {
                hideTyping();
                messageElement = addBotMessage('');
              }
              botMessage += data.content;
              // Use innerHTML to support markdown-like formatting
              messageElement.innerHTML = formatMessage(botMessage);
              scrollToBottom();
            } else if (data.type === 'tool_start') {
              // Show searching indicator
              hideTyping();
              const searchingEl = document.createElement('div');
              searchingEl.className = 'rag-message rag-message-bot rag-searching';
              searchingEl.innerHTML = getToolLoadingMessage(data.tool);
              messagesContainer.appendChild(searchingEl);
              scrollToBottom();
            } else if (data.type === 'tool_result') {
              // Remove searching indicator
              const searchingEl = messagesContainer.querySelector('.rag-searching');
              if (searchingEl) searchingEl.remove();

              hasToolResults = true;

              // Handle product search results
              if (data.tool === 'search_products' && data.data && data.data.products) {
                const productsHtml = renderProductCards(data.data.products);
                const resultEl = document.createElement('div');
                resultEl.className = 'rag-message rag-message-bot rag-products-message';
                resultEl.innerHTML = productsHtml;
                messagesContainer.appendChild(resultEl);
                scrollToBottom();

                // Track product search
                searchCount++;
                trackEvent('product_viewed', { count: data.data.products.length });
              }

              // Handle availability check results
              if (data.tool === 'check_availability' && data.data) {
                const availHtml = renderAvailabilityResult(data.data);
                const resultEl = document.createElement('div');
                resultEl.className = 'rag-message rag-message-bot';
                resultEl.innerHTML = availHtml;
                messagesContainer.appendChild(resultEl);
                scrollToBottom();
              }

              // Handle order lookup results
              if (data.tool === 'lookup_order' && data.data) {
                const orderHtml = renderOrderResult(data.data);
                const resultEl = document.createElement('div');
                resultEl.className = 'rag-message rag-message-bot';
                resultEl.innerHTML = orderHtml;
                messagesContainer.appendChild(resultEl);
                scrollToBottom();
              }
            } else if (data.type === 'error') {
              hideTyping();
              addBotMessage(data.message || "I'm having trouble right now. Please try again.");
            } else if (data.type === 'done') {
              // Message complete
              if (botMessage) {
                messages.push({ role: 'assistant', content: botMessage });
                saveConversation();
              }
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }

      // Check if we should show email capture
      if (searchCount >= CONFIG.emailCaptureAfter && !emailCaptured && hasToolResults) {
        setTimeout(() => showEmailCapture(), 2000);
      }

      // Track event
      trackEvent('message_sent', { message_length: content.length });

    } catch (error) {
      console.error('[Rentagun Chat] Error:', error);
      hideTyping();
      addBotMessage("I'm having trouble connecting. Please try again in a moment.");
    } finally {
      isLoading = false;
    }
  }

  /**
   * Get loading message for tool
   */
  function getToolLoadingMessage(tool) {
    const messages = {
      'search_products': '🔍 Searching our inventory...',
      'check_availability': '📅 Checking availability...',
      'lookup_order': '📦 Looking up your order...'
    };
    return messages[tool] || '⏳ Working on it...';
  }

  /**
   * Format message text (basic markdown support)
   */
  function formatMessage(text) {
    // Bold text **text**
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Newlines to <br>
    text = text.replace(/\n/g, '<br>');
    return text;
  }

  /**
   * Render availability result
   */
  function renderAvailabilityResult(data) {
    const isAvailable = data.available;
    const productName = data.product_name || 'This firearm';
    const dates = `${data.start_date} to ${data.end_date}`;

    if (isAvailable) {
      return `
        <div class="rag-availability-result rag-available-result">
          <div class="rag-avail-icon">✅</div>
          <div class="rag-avail-text">
            <strong>${escapeHtml(productName)}</strong> is available for ${escapeHtml(dates)}!
            ${data.booking_url ? `<a href="${escapeHtml(data.booking_url)}" class="rag-book-btn" target="_blank">Book These Dates</a>` : ''}
          </div>
        </div>
      `;
    } else {
      return `
        <div class="rag-availability-result rag-unavailable-result">
          <div class="rag-avail-icon">❌</div>
          <div class="rag-avail-text">
            <strong>${escapeHtml(productName)}</strong> is not available for ${escapeHtml(dates)}.
            ${data.next_available_date ? `<br>📅 Next available: <strong>${escapeHtml(data.next_available_date)}</strong>` : ''}
          </div>
        </div>
      `;
    }
  }

  /**
   * Render order lookup result
   */
  function renderOrderResult(order) {
    const statusEmojis = {
      pending: '⏳',
      processing: '📋',
      shipped: '📦',
      'at-ffl': '🏪',
      'with-customer': '✅',
      'return-shipped': '↩️',
      completed: '✅',
      cancelled: '❌',
      refunded: '💰'
    };

    const emoji = statusEmojis[order.status] || '📋';
    const items = order.line_items ? order.line_items.map(item => item.name).join(', ') : 'N/A';

    let html = `
      <div class="rag-order-result">
        <div class="rag-order-header">
          <span class="rag-order-emoji">${emoji}</span>
          <strong>Order #${escapeHtml(order.order_number || order.id)}</strong>
        </div>
        <div class="rag-order-details">
          <div class="rag-order-row"><span>Status:</span> <span class="rag-order-status">${escapeHtml(order.status)}</span></div>
          <div class="rag-order-row"><span>Items:</span> <span>${escapeHtml(items)}</span></div>
    `;

    if (order.rental_dates) {
      html += `<div class="rag-order-row"><span>Rental Dates:</span> <span>${escapeHtml(order.rental_dates.start_date)} to ${escapeHtml(order.rental_dates.end_date)}</span></div>`;
    }

    if (order.shipping && order.shipping.tracking_number) {
      html += `
        <div class="rag-order-row">
          <span>Tracking:</span>
          <a href="${escapeHtml(order.shipping.tracking_url || '#')}" target="_blank" class="rag-tracking-link">${escapeHtml(order.shipping.tracking_number)}</a>
        </div>
      `;
    }

    if (order.ffl) {
      html += `
        <div class="rag-order-ffl">
          <strong>📍 Pickup Location:</strong><br>
          ${escapeHtml(order.ffl.name)}<br>
          ${escapeHtml(order.ffl.address)}<br>
          ${escapeHtml(order.ffl.city)}, ${escapeHtml(order.ffl.state)} ${escapeHtml(order.ffl.zip)}<br>
          📞 ${escapeHtml(order.ffl.phone)}
        </div>
      `;
    }

    html += `</div></div>`;
    return html;
  }

  /**
   * Add user message to UI
   */
  function addUserMessage(content) {
    const div = document.createElement('div');
    div.className = 'rag-message rag-message-user';
    div.textContent = content;
    messagesContainer.appendChild(div);
    scrollToBottom();
    return div;
  }

  /**
   * Add bot message to UI
   */
  function addBotMessage(content) {
    const div = document.createElement('div');
    div.className = 'rag-message rag-message-bot';
    div.textContent = content;
    messagesContainer.appendChild(div);
    scrollToBottom();
    return div;
  }

  /**
   * Show typing indicator
   */
  function showTyping() {
    const existing = messagesContainer.querySelector('.rag-typing');
    if (existing) return;

    const div = document.createElement('div');
    div.className = 'rag-typing';
    div.innerHTML = '<span class="rag-typing-dot"></span><span class="rag-typing-dot"></span><span class="rag-typing-dot"></span>';
    messagesContainer.appendChild(div);
    scrollToBottom();
  }

  /**
   * Hide typing indicator
   */
  function hideTyping() {
    const typing = messagesContainer.querySelector('.rag-typing');
    if (typing) typing.remove();
  }

  /**
   * Scroll messages to bottom
   */
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Save conversation to localStorage
   */
  function saveConversation() {
    try {
      localStorage.setItem('rag_messages', JSON.stringify(messages));
      localStorage.setItem('rag_session_id', sessionId);
      localStorage.setItem('rag_search_count', String(searchCount));
    } catch (e) {
      // localStorage not available
    }
  }

  /**
   * Restore conversation from localStorage
   */
  function restoreConversation() {
    try {
      const saved = localStorage.getItem('rag_messages');
      const savedSession = localStorage.getItem('rag_session_id');
      const savedSearchCount = localStorage.getItem('rag_search_count');
      const savedEmailCaptured = localStorage.getItem('rag_email_captured');

      if (saved && savedSession) {
        messages = JSON.parse(saved);
        sessionId = savedSession;

        // Render saved messages
        messages.forEach(msg => {
          if (msg.role === 'user') {
            addUserMessage(msg.content);
          } else {
            addBotMessage(msg.content);
          }
        });
      }

      if (savedSearchCount) {
        searchCount = parseInt(savedSearchCount, 10);
      }

      if (savedEmailCaptured === 'true') {
        emailCaptured = true;
      }
    } catch (e) {
      // localStorage not available
    }
  }

  /**
   * Clear conversation
   */
  function clearConversation() {
    messages = [];
    searchCount = 0;
    sessionId = generateSessionId();

    try {
      localStorage.removeItem('rag_messages');
      localStorage.removeItem('rag_session_id');
      localStorage.removeItem('rag_search_count');
    } catch (e) {
      // localStorage not available
    }

    messagesContainer.innerHTML = '';
    addBotMessage(CONFIG.greeting);
    showQuickActions();
  }

  /**
   * Show email capture modal
   */
  function showEmailCapture() {
    if (emailCaptured) return;

    const modal = container.querySelector('.rag-email-modal');
    modal.classList.add('rag-show');
  }

  /**
   * Submit email
   */
  async function submitEmail() {
    const input = container.querySelector('.rag-email-input');
    const email = input.value.trim();

    if (!email || !isValidEmail(email)) {
      input.style.borderColor = '#ef4444';
      return;
    }

    try {
      // Pass conversation history for interest extraction on server side
      await fetch(CONFIG.subscribeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId
        },
        body: JSON.stringify({
          email,
          sessionId,
          source: 'chatbot',
          conversationHistory: messages
        })
      });

      emailCaptured = true;
      localStorage.setItem('rag_email_captured', 'true');
      hideEmailCapture();

      addBotMessage("Thanks! I'll keep you posted on deals and availability for firearms you're interested in.");

      trackEvent('email_captured', { email });
    } catch (e) {
      console.error('[Rentagun Chat] Email submit error:', e);
    }
  }

  /**
   * Skip email capture
   */
  function skipEmail() {
    hideEmailCapture();
    trackEvent('email_skipped');
  }

  /**
   * Hide email capture modal
   */
  function hideEmailCapture() {
    const modal = container.querySelector('.rag-email-modal');
    modal.classList.remove('rag-show');
  }

  /**
   * Validate email format
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Track analytics event
   */
  function trackEvent(event, data = {}) {
    // This could be sent to n8n webhook or other analytics
    console.log('[Rentagun Chat] Event:', event, data);

    // If analytics endpoint is configured, send the event
    if (window.RENTAGUN_ANALYTICS_URL) {
      fetch(window.RENTAGUN_ANALYTICS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          sessionId,
          timestamp: new Date().toISOString(),
          ...data
        })
      }).catch(() => {});
    }
  }

  /**
   * Escape HTML for safe insertion
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Render product cards in message
   */
  function renderProductCards(products) {
    if (!products || products.length === 0) return '';

    return `
      <div class="rag-products">
        ${products.map((product, index) => `
          <div class="rag-product-card">
            <img class="rag-product-image" src="${escapeHtml(product.image || '/placeholder.jpg')}" alt="${escapeHtml(product.name)}" />
            <div class="rag-product-info">
              <div class="rag-product-name">
                ${escapeHtml(product.name)}
                ${index < 2 ? '<span class="rag-popular-badge">POPULAR</span>' : ''}
              </div>
              <div class="rag-product-price">$${product.daily_rate}/day</div>
              <div class="rag-product-availability ${product.available ? 'rag-available' : 'rag-unavailable'}">
                <span class="rag-availability-dot"></span>
                ${product.available ? 'Available' : 'Next: ' + (product.next_available_date || 'TBD')}
                ${product.available ? '<span class="rag-urgency-text">In high demand</span>' : ''}
              </div>
              ${product.available ? `<a href="${escapeHtml(product.url)}" class="rag-product-btn" target="_blank">View Details</a>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual control if needed
  window.RentagunChat = {
    open: openChat,
    close: closeChat,
    toggle: toggleChat,
    clear: clearConversation
  };

})();
