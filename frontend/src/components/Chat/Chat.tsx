import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Send, Bot, User, Loader2, AlertCircle, RefreshCw,
  ChevronDown, Sparkles, Trash2, X, Minus,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  'What are my top spending categories this month?',
  'Where am I going over budget?',
  'How can I reduce my monthly expenses?',
  'Am I spending more or less than I earn?',
  'What would a realistic monthly budget look like for me?',
  "What's my current net worth?",
];

// ─── Simple markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const fence: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { fence.push(lines[i]); i++; }
      result.push(
        <pre key={i} className="my-2 bg-gray-950/60 border border-white/10 rounded-lg p-2.5 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
          {fence.join('\n')}
        </pre>
      );
      i++; continue;
    }

    if (line.startsWith('### ')) {
      result.push(<p key={i} className="font-semibold text-gray-200 mt-2.5 mb-0.5 text-xs">{inlineFormat(line.slice(4))}</p>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      result.push(<p key={i} className="font-semibold text-gray-100 mt-2.5 mb-0.5 text-xs">{inlineFormat(line.slice(3))}</p>);
      i++; continue;
    }

    if (line.match(/^[-*]\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) { items.push(lines[i].replace(/^[-*]\s/, '')); i++; }
      result.push(
        <ul key={i} className="my-1 space-y-0.5 pl-3">
          {items.map((item, j) => (
            <li key={j} className="flex gap-1.5 text-xs text-gray-300">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.match(/^\d+\.\s/)) {
      const items: string[] = [];
      let num = 1;
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++; }
      result.push(
        <ol key={i} className="my-1 space-y-0.5 pl-3">
          {items.map((item, j) => (
            <li key={j} className="flex gap-1.5 text-xs text-gray-300">
              <span className="text-blue-400 font-mono text-xs w-3 flex-shrink-0">{num++ + j}.</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim() === '') { result.push(<div key={i} className="h-1.5" />); i++; continue; }

    result.push(<p key={i} className="text-xs text-gray-300 leading-relaxed">{inlineFormat(line)}</p>);
    i++;
  }

  return result;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="px-1 py-0.5 rounded bg-gray-700 text-blue-300 text-xs font-mono">{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-gray-200">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic text-gray-300">{part.slice(1, -1)}</em>;
    return part;
  });
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-2 px-3 py-1.5', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
      )}>
        {isUser ? <User size={10} /> : <Bot size={10} />}
      </div>
      <div className={cn('max-w-[82%] min-w-0 flex flex-col', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'rounded-2xl px-3 py-2',
          isUser ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 border border-white/8 rounded-tl-sm'
        )}>
          {isUser ? (
            <p className="text-xs leading-relaxed">{message.content}</p>
          ) : message.streaming && message.content === '' ? (
            <div className="flex items-center gap-1 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
            </div>
          ) : (
            <div className="space-y-0.5">
              {renderMarkdown(message.content)}
              {message.streaming && (
                <span className="inline-block w-0.5 h-3.5 bg-blue-400 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Model selector ───────────────────────────────────────────────────────────

function ModelSelector({ models, selected, onSelect }: {
  models: string[];
  selected: string;
  onSelect: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 bg-gray-800 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors max-w-[140px]"
      >
        <span className="truncate">{selected || 'Select model'}</span>
        <ChevronDown size={10} className={cn('flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-[200] w-56 bg-gray-900 border border-white/15 rounded-xl shadow-2xl overflow-hidden">
          {models.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-500 text-center">No models found</p>
          ) : (
            <div className="py-1 max-h-48 overflow-auto">
              {models.map((m) => (
                <button
                  key={m}
                  onClick={() => { onSelect(m); setOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs transition-colors',
                    m === selected ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300 hover:bg-white/5'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({ onClose, onMinimize }: { onClose: () => void; onMinimize: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const messagesEndRef           = useRef<HTMLDivElement>(null);
  const inputRef                 = useRef<HTMLTextAreaElement>(null);
  const abortRef                 = useRef<AbortController | null>(null);

  const { data: modelsData, isLoading: modelsLoading, refetch: refetchModels } = useQuery({
    queryKey: ['chat-models'],
    queryFn: () => fetch('/api/chat/models').then((r) => r.json()) as Promise<{ models: string[]; error?: string }>,
    staleTime: 30_000,
    retry: false,
  });

  const models = modelsData?.models ?? [];
  const ollamaOnline = models.length > 0;

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      const preferred = models.find((m) => /llama3|llama-3|mistral|qwen|gemma|phi/i.test(m));
      setSelectedModel(preferred ?? models[0]);
    }
  }, [models, selectedModel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || !selectedModel) return;

    setError(null);
    setInput('');

    const userMsg: Message = { role: 'user', content: trimmed };
    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: trimmed },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${response.status}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated, streaming: true };
          return updated;
        });
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: accumulated, streaming: false };
        return updated;
      });
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') updated[updated.length - 1] = { ...last, streaming: false };
          return updated;
        });
      } else {
        setError((err as Error).message);
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [messages, isStreaming, selectedModel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 bg-gray-900 flex-shrink-0 rounded-t-2xl">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
          <Sparkles size={10} />
        </div>
        <span className="text-xs font-semibold text-gray-200 flex-1">Financial Advisor</span>

        {/* Ollama status dot */}
        <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', ollamaOnline ? 'bg-emerald-400' : 'bg-red-400')}
          title={ollamaOnline ? 'Ollama online' : 'Ollama offline'} />

        {ollamaOnline && (
          <ModelSelector models={models} selected={selectedModel} onSelect={setSelectedModel} />
        )}

        {!ollamaOnline && !modelsLoading && (
          <button onClick={() => refetchModels()} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors" title="Retry Ollama connection">
            <RefreshCw size={12} />
          </button>
        )}

        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-red-400 transition-colors" title="Clear chat">
            <Trash2 size={12} />
          </button>
        )}

        <button onClick={onMinimize} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors" title="Minimize">
          <Minus size={12} />
        </button>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors" title="Close">
          <X size={12} />
        </button>
      </div>

      {/* Ollama offline notice */}
      {!modelsLoading && !ollamaOnline && (
        <div className="mx-3 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex-shrink-0">
          <div className="flex gap-2">
            <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300 mb-1">Ollama is not running</p>
              <ol className="text-xs text-amber-400/80 space-y-0.5 list-decimal pl-3">
                <li>Install from <span className="font-mono text-amber-300">ollama.com</span></li>
                <li>Run <span className="font-mono bg-amber-500/10 px-1 rounded">ollama serve</span></li>
                <li>Pull a model: <span className="font-mono bg-amber-500/10 px-1 rounded">ollama pull qwen3:8b</span></li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-4 gap-4">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Ask anything about your finances. I have access to your real account data.
            </p>
            {ollamaOnline && (
              <div className="w-full space-y-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    disabled={!selectedModel}
                    className="w-full text-left px-2.5 py-2 bg-gray-800/60 border border-white/8 rounded-xl text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 hover:border-white/15 transition-all leading-snug disabled:opacity-40"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-1">
            {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          </div>
        )}

        {error && (
          <div className="mx-3 my-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
            <AlertCircle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-2.5 border-t border-white/10">
        {!ollamaOnline ? (
          <p className="text-center text-xs text-gray-600 py-1">Start Ollama to enable the advisor</p>
        ) : (
          <div className="flex items-end gap-1.5 bg-gray-800 border border-white/10 rounded-xl px-3 py-2 focus-within:border-blue-500/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedModel ? 'Ask about your finances…' : 'Select a model above'}
              disabled={!selectedModel || isStreaming}
              rows={1}
              className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 outline-none resize-none max-h-28 py-0.5 disabled:opacity-50"
              style={{ minHeight: '1.25rem' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 112) + 'px';
              }}
            />
            {isStreaming ? (
              <button onClick={() => abortRef.current?.abort()} className="p-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex-shrink-0" title="Stop">
                <Loader2 size={13} className="animate-spin" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || !selectedModel}
                className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Floating widget (exported) ───────────────────────────────────────────────

export function ChatWidget() {
  const [open, setOpen]       = useState(false);
  const [minimized, setMinimized] = useState(false);
  // Track unread messages while minimized/closed
  const [unread, setUnread]   = useState(0);
  const wasOpenRef             = useRef(open);

  useEffect(() => { wasOpenRef.current = open; }, [open]);

  const handleOpen = () => { setOpen(true); setMinimized(false); setUnread(0); };
  const handleMinimize = () => setMinimized(true);
  const handleClose = () => { setOpen(false); setMinimized(false); };

  const panelVisible = open && !minimized;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-2">
      {/* Chat panel */}
      {panelVisible && (
        <div className="w-80 h-[520px] bg-gray-900 border border-white/15 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
          <ChatPanel onClose={handleClose} onMinimize={handleMinimize} />
        </div>
      )}

      {/* Toggle / minimized button */}
      <button
        onClick={panelVisible ? handleMinimize : handleOpen}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200',
          'bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500',
          'text-white',
          panelVisible && 'rotate-0'
        )}
        title="Financial Advisor"
      >
        {panelVisible ? <Minus size={18} /> : <Sparkles size={18} />}
        {unread > 0 && !panelVisible && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
