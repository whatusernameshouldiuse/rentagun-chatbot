'use client';

import { useEffect, useCallback } from 'react';

/**
 * Client component that handles widget loading and chat interactions
 * Separated from main page to enable server-side rendering of products
 */
export function WidgetLoader() {
  useEffect(() => {
    // Set API URL
    (window as Window & { RENTAGUN_CHAT_API?: string }).RENTAGUN_CHAT_API =
      'https://rentagun-chatbot.vercel.app';

    // Load widget script
    const script = document.createElement('script');
    script.src = '/widget.js';
    script.async = true;
    document.body.appendChild(script);

    // Load widget CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/widget.css';
    document.head.appendChild(link);

    return () => {
      script.remove();
      link.remove();
      const widget = document.querySelector('.rag-widget');
      if (widget) widget.remove();
    };
  }, []);

  return null;
}

/**
 * Hook for opening the chat widget
 * Returns a stable callback that doesn't change between renders
 */
export function useChatOpener() {
  return useCallback(() => {
    const btn = document.querySelector('.rag-chat-toggle') as HTMLButtonElement;
    if (btn) btn.click();
  }, []);
}

/**
 * Client component for CTA buttons that open chat
 */
export function ChatCTA({
  children,
  variant = 'primary',
  className
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  const openChat = useChatOpener();

  return (
    <button onClick={openChat} className={className}>
      {children}
    </button>
  );
}
