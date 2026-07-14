import { useCallback, useRef, useState } from 'react';
import { sendMessage } from '../lib/api';
import type { Message } from '../types/index';

interface SendMessageResult {
  message: Message;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
}

export function useStreamingChat(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string, model?: string): Promise<SendMessageResult | void> => {
      if (!conversationId || !text.trim()) return;

      setSending(true);
      setError(null);

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const assistantId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        text: '',
        timestamp: new Date().toISOString(),
        model: model || 'auto',
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await sendMessage(
          conversationId,
          text.trim(),
          model,
          (chunk) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + chunk } : m)),
            );
          },
          controller.signal,
        );

        // Update assistant message with final text and usage data
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  text: result.message.text || m.text,
                  tokens: result.message.tokens,
                  cost: result.message.cost,
                }
              : m,
          ),
        );

        return result;
      } catch (err: any) {
        const message = err?.error || err?.message || 'Something went wrong.';
        setError(message);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: message, status: 'error' as const } : m,
          ),
        );
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [conversationId],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setSending(false);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, sending, error, send, cancel, reset };
}
