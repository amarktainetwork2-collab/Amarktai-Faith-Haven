import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Loader2, RotateCcw, Send, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store';
import { toast } from 'sonner';
import { ApiError, apiRequest } from '@/lib/api';

type Message = { id: string; role: 'user' | 'assistant'; content: string; createdAt: Date };

const quickPrompts = [
  { icon: BookOpen, label: 'Daily reflection', prompt: 'Help me reflect prayerfully on a Bible passage for today.' },
  { icon: Sparkles, label: 'Prayer help', prompt: 'Help me write a short prayer about something on my heart.' },
  { icon: BookOpen, label: 'Faith question', prompt: 'I have a question about my faith journey.' },
];

export default function AIChat() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const resetConversation = () => {
    setConversationId(null);
    setMessages([]);
    setInput('');
  };

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || isTyping) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: prompt, createdAt: new Date() };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsTyping(true);
    try {
      const response = await apiRequest<{ conversationId: string; content: string; disclaimer: string }>('/api/ai/chat', {
        method: 'POST', body: JSON.stringify({ prompt, conversationId: conversationId || undefined }),
      });
      setConversationId(response.conversationId);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: response.content, createdAt: new Date() }]);
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      const message = error instanceof ApiError ? error.message : 'The AI service is unavailable. Please try again later.';
      toast.error(message);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">AI Faith Mentor</h1>
          <p className="text-slate-500">Generated guidance is not scripture or pastoral authority.</p>
        </div>
        <button onClick={resetConversation} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-[hsl(210,70%,50%)] hover:bg-[hsl(210,80%,95%)] rounded-lg transition-colors">
          <RotateCcw className="w-4 h-4" /> New chat
        </button>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-[hsl(48,30%,88%)] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef} aria-live="polite">
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.length === 0 && (
              <div className="py-16 text-center text-slate-500">
                <Sparkles className="w-9 h-9 mx-auto mb-3 text-[hsl(210,70%,60%)]" aria-hidden="true" />
                <p className="font-medium text-slate-700">Start a private conversation.</p>
                <p className="mt-1 text-sm">Your messages are saved to your account and processed through the FaithHaven AI service.</p>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <Avatar className={`w-10 h-10 flex-shrink-0 ${message.role === 'assistant' ? 'bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(260,50%,65%)]' : 'bg-gradient-to-br from-[hsl(48,90%,65%)] to-[hsl(35,80%,60%)]'}`}>
                  <AvatarFallback className="text-white text-sm">{message.role === 'assistant' ? 'AI' : user?.name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 text-left ${message.role === 'user' ? 'bg-[hsl(210,70%,60%)] text-white' : 'bg-[hsl(48,60%,96%)] text-slate-700'}`}>
                    <p className="leading-relaxed whitespace-pre-line">{message.content}</p>
                    {message.role === 'assistant' && <Badge variant="secondary" className="mt-3 text-xs bg-white/50"><BookOpen className="w-3 h-3 mr-1" />Generated reflection</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {isTyping && <div className="flex gap-4"><Avatar className="w-10 h-10 bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(260,50%,65%)]"><AvatarFallback className="text-white text-sm">AI</AvatarFallback></Avatar><div className="bg-[hsl(48,60%,96%)] rounded-2xl px-4 py-3 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-[hsl(210,70%,60%)]" /><span className="text-sm text-slate-500">FaithHaven is thinking…</span></div></div>}
          </div>
        </div>

        {messages.length < 3 && <div className="px-4 py-3 border-t border-[hsl(48,30%,88%)]"><p className="text-xs text-slate-500 mb-2">Try a prompt:</p><div className="flex flex-wrap gap-2">{quickPrompts.map((quickPrompt) => <button key={quickPrompt.label} onClick={() => setInput(quickPrompt.prompt)} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(48,60%,96%)] hover:bg-[hsl(210,80%,95%)] text-sm text-slate-600 hover:text-[hsl(210,70%,50%)] transition-colors"><quickPrompt.icon className="w-4 h-4" />{quickPrompt.label}</button>)}</div></div>}

        <div className="p-4 border-t border-[hsl(48,30%,88%)] bg-white">
          <div className="flex gap-3 max-w-3xl mx-auto">
            <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} placeholder="Ask about faith, prayer, Scripture, or anything on your heart..." aria-label="Message FaithHaven AI" className="flex-1 h-12 px-4 rounded-xl border border-[hsl(48,30%,88%)] focus:border-[hsl(210,70%,60%)] focus:ring-2 focus:ring-[hsl(210,70%,60%)]/20 outline-none transition-all" disabled={isTyping} />
            <button onClick={() => void handleSend()} disabled={!input.trim() || isTyping} aria-label="Send message" className="h-12 px-6 bg-[hsl(210,70%,60%)] text-white rounded-xl hover:bg-[hsl(210,60%,50%)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
