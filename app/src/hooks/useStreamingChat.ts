import { useCallback, useEffect, useRef, useState } from 'react';
import { getConversation, sendMessage } from '../lib/api';
import { neural, pulseThinking, pulseStreaming } from '../lib/neural';
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
  // The conversation whose messages `messages` currently reflects. Guards
  // against redundant re-fetches and, crucially, against a hydration fetch
  // overwriting the optimistic exchange an in-flight send() just appended:
  // send() claims this ref for its target before touching messages, so the
  // effect below sees it already "hydrated" and skips the fetch.
  const hydratedRef = useRef<string | null>(null);
  // Bumped whenever local state is taken over (a new switch or a send). An
  // in-flight hydration captures the current value and only applies its
  // result if it hasn't changed — so a send() that fires mid-fetch wins.
  const hydrationTokenRef = useRef(0);
  // Always-current view of messages, so callbacks (regenerate/edit) can read
  // the latest without being re-created on every message update.
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setError(null);
      hydratedRef.current = null;
      hydrationTokenRef.current++;
      return;
    }
    if (conversationId === hydratedRef.current) return;

    hydratedRef.current = conversationId;
    const token = ++hydrationTokenRef.current;
    setError(null);
    setMessages([]);
    getConversation(conversationId)
      .then((history) => {
        if (hydrationTokenRef.current === token) setMessages(history);
      })
      .catch(() => {
        // Non-fatal: leave the thread empty rather than blocking the UI.
      });
  }, [conversationId]);

  // Appends a fresh assistant placeholder and streams a reply into it for the
  // given user text. Shared by both send() (new turn) and regenerate() (redo
  // the last turn), so the streaming/finalize/error handling lives in one place.
  const runAssistant = useCallback(
    async (
      targetConversationId: string,
      text: string,
      model?: string,
      provider?: string,
      specialistId?: string,
      regenerate?: boolean,
    ): Promise<SendMessageResult | void> => {
      hydratedRef.current = targetConversationId;
      hydrationTokenRef.current++;

      setSending(true);
      setError(null);

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

      // Ignite the nervous system for the duration of the request.
      pulseThinking(model);

      try {
        const result = await sendMessage(
          targetConversationId,
          text,
          model,
          (chunk) => {
            pulseStreaming(model);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + chunk } : m)),
            );
          },
          controller.signal,
          provider,
          specialistId,
          regenerate,
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  text: result.message.text || m.text,
                  tokens: result.message.tokens,
                  cost: result.message.cost,
                  model: result.message.model,
                  specialist: result.message.specialist,
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
        // Let the storm settle back to its calm resting state.
        window.setTimeout(() => neural.calm(), 700);
      }
    },
    [],
  );

  const send = useCallback(
    async (
      text: string,
      model?: string,
      provider?: string,
      conversationIdOverride?: string,
      specialistId?: string,
    ): Promise<SendMessageResult | void> => {
      const targetConversationId = conversationIdOverride || conversationId;
      if (!targetConversationId || !text.trim()) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      return runAssistant(targetConversationId, text.trim(), model, provider, specialistId);
    },
    [conversationId, runAssistant],
  );

  // Re-run the most recent user message, replacing the reply that followed it.
  const regenerate = useCallback(
    async (model?: string, provider?: string, specialistId?: string): Promise<SendMessageResult | void> => {
      if (!conversationId || sending) return;
      const msgs = messagesRef.current;
      const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
      if (!lastUser) return;

      // Drop everything after (and not including) that user message — i.e. the
      // stale assistant reply.
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === lastUser.id);
        return idx === -1 ? prev : prev.slice(0, idx + 1);
      });

      return runAssistant(conversationId, lastUser.text, model, provider, specialistId, true);
    },
    [conversationId, sending, runAssistant],
  );

  // Remove the last user message (and its reply) and return its text, so the
  // caller can drop it back into the composer for editing.
  const popLastUserMessage = useCallback((): string | undefined => {
    const msgs = messagesRef.current;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return undefined;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === lastUser.id);
      return idx === -1 ? prev : prev.slice(0, idx);
    });
    return lastUser.text;
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setSending(false);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, sending, error, send, regenerate, popLastUserMessage, cancel, reset };
}
