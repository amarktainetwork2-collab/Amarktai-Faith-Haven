import { useState } from 'react';
import { Copy, Download, Mic, RefreshCw, Save, Sparkles } from 'lucide-react';
import { ApiError, apiRequest } from '@/lib/api';
import { toast } from 'sonner';

export default function SermonCreator() {
  const [topic, setTopic] = useState('');
  const [scripture, setScripture] = useState('');
  const [audience, setAudience] = useState('General congregation');
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim() || !scripture.trim()) { toast.error('Please enter both a topic and Scripture reference.'); return; }
    setIsGenerating(true); setSaved(false);
    try {
      const prompt = `Create a sermon draft about ${topic}. Scripture reference: ${scripture}. Intended audience: ${audience}. Provide a title, introduction, three main points, practical application, and conclusion. Do not invent Bible quotations; use the supplied reference and clearly label generated interpretation as draft material.`;
      const response = await apiRequest<{ content: string; disclaimer: string }>('/api/ai/generate/sermon', { method: 'POST', body: JSON.stringify({ prompt, metadata: { topic, scripture, audience } }) });
      setContent(response.content);
      toast.success('Sermon draft generated for your review.');
    } catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to generate the sermon draft.'); }
    finally { setIsGenerating(false); }
  };
  const handleSave = async () => {
    if (!content) return;
    try {
      await apiRequest('/api/documents', { method: 'POST', body: JSON.stringify({ type: 'sermon', title: topic, content, metadata: { scripture, audience } }) });
      setSaved(true); toast.success('Sermon draft saved to your account.');
    } catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to save this draft.'); }
  };
  const handleCopy = async () => { if (content) { await navigator.clipboard.writeText(content); toast.success('Draft copied to clipboard.'); } };
  const handleDownload = () => { if (!content) return; const blob = new Blob([content], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `faithhaven-sermon-${Date.now()}.md`; anchor.click(); URL.revokeObjectURL(url); };

  return <div className="h-full flex flex-col"><div className="mb-6"><h1 className="text-2xl font-bold text-slate-800">Sermon Creator</h1><p className="text-slate-500">AI-assisted draft preparation. Generated material requires pastoral review.</p></div><div className="grid lg:grid-cols-2 gap-6 flex-1"><section className="bg-white rounded-2xl border border-[hsl(48,30%,88%)] p-6"><h2 className="text-lg font-bold text-slate-800 mb-4">Sermon details</h2><div className="space-y-4"><label className="block text-sm font-medium text-slate-700">Topic<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Faith, love, forgiveness…" className="mt-2 w-full h-12 px-4 rounded-xl border" /></label><label className="block text-sm font-medium text-slate-700">Scripture reference<input value={scripture} onChange={(event) => setScripture(event.target.value)} placeholder="John 3:16" className="mt-2 w-full h-12 px-4 rounded-xl border" /></label><label className="block text-sm font-medium text-slate-700">Audience<input value={audience} onChange={(event) => setAudience(event.target.value)} className="mt-2 w-full h-12 px-4 rounded-xl border" /></label><button onClick={() => void handleGenerate()} disabled={isGenerating} className="w-full h-12 bg-[hsl(210,70%,60%)] text-white rounded-xl font-medium hover:bg-[hsl(210,60%,50%)] disabled:opacity-50 flex items-center justify-center gap-2">{isGenerating ? <><RefreshCw className="w-5 h-5 animate-spin" />Generating…</> : <><Sparkles className="w-5 h-5" />Generate sermon draft</>}</button></div></section><section className="bg-white rounded-2xl border border-[hsl(48,30%,88%)] p-6 overflow-y-auto"><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-slate-800">Generated draft</h2>{content && <div className="flex gap-2"><button onClick={() => void handleSave()} aria-label="Save sermon" className="p-2 hover:bg-[hsl(48,60%,96%)] rounded-lg"><Save className="w-5 h-5 text-slate-500" /></button><button onClick={() => void handleCopy()} aria-label="Copy sermon" className="p-2 hover:bg-[hsl(48,60%,96%)] rounded-lg"><Copy className="w-5 h-5 text-slate-500" /></button><button onClick={handleDownload} aria-label="Download sermon" className="p-2 hover:bg-[hsl(48,60%,96%)] rounded-lg"><Download className="w-5 h-5 text-slate-500" /></button></div>}</div>{content ? <div><p className="whitespace-pre-wrap text-slate-600 leading-relaxed">{content}</p><p className="mt-6 text-xs text-slate-500">Generated draft material is not authoritative scripture. Review accuracy, context, and pastoral suitability before use.{saved ? ' Saved to your account.' : ''}</p></div> : <div className="text-center py-12"><Mic className="w-16 h-16 text-slate-200 mx-auto mb-4" /><p className="text-slate-500">Enter sermon details to request a draft through the FaithHaven AI service.</p></div>}</section></div></div>;
}
