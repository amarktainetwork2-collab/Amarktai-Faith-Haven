import { useState } from 'react';
import { BookOpen, Copy, Download, Save, Scroll } from 'lucide-react';
import { ApiError, apiRequest } from '@/lib/api';
import { toast } from 'sonner';

export default function LiturgyBuilder() {
  const [denomination, setDenomination] = useState('Anglican');
  const [occasion, setOccasion] = useState('Sunday service');
  const [scripture, setScripture] = useState('');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async () => {
    setIsGenerating(true);
    try {
      const prompt = `Create a respectful liturgy draft for a ${occasion} in a ${denomination} context. Scripture reference: ${scripture || 'not specified'}. Include a call to worship, opening prayer, scripture-reading placeholder, sermon transition, intercessions, offering transition, and benediction. Do not reproduce unlicensed hymn lyrics or invent Bible quotations. Clearly mark this as a local-review draft.`;
      const result = await apiRequest<{ content: string }>('/api/ai/generate/liturgy', { method: 'POST', body: JSON.stringify({ prompt, metadata: { denomination, occasion, scripture } }) });
      setContent(result.content); toast.success('Liturgy draft generated for review.');
    } catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to generate the liturgy draft.'); }
    finally { setIsGenerating(false); }
  };
  const save = async () => {
    if (!content) return;
    try { await apiRequest('/api/documents', { method: 'POST', body: JSON.stringify({ type: 'liturgy', title: `${occasion} liturgy`, content, metadata: { denomination, scripture } }) }); toast.success('Liturgy saved to your account.'); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to save this liturgy.'); }
  };
  const copy = async () => { if (content) { await navigator.clipboard.writeText(content); toast.success('Liturgy copied.'); } };
  const download = () => { if (!content) return; const blob = new Blob([content], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `faithhaven-liturgy-${Date.now()}.md`; link.click(); URL.revokeObjectURL(url); };

  return <div className="h-full flex flex-col"><div className="mb-6"><h1 className="text-2xl font-bold text-slate-800">Liturgy Builder</h1><p className="text-slate-500">Create a draft for local pastoral review.</p></div><div className="grid lg:grid-cols-3 gap-6 flex-1"><section className="bg-white rounded-2xl border border-[hsl(48,30%,88%)] p-6"><h2 className="text-lg font-bold text-slate-800 mb-4">Service settings</h2><div className="space-y-4"><label className="block text-sm font-medium text-slate-700">Denomination<select value={denomination} onChange={(event) => setDenomination(event.target.value)} className="mt-2 w-full h-12 px-4 rounded-xl border bg-white"><option>Anglican</option><option>Baptist</option><option>Catholic</option><option>Lutheran</option><option>Methodist</option><option>Presbyterian</option></select></label><label className="block text-sm font-medium text-slate-700">Occasion<select value={occasion} onChange={(event) => setOccasion(event.target.value)} className="mt-2 w-full h-12 px-4 rounded-xl border bg-white"><option>Sunday service</option><option>Easter</option><option>Christmas</option><option>Wedding</option><option>Funeral</option><option>Baptism</option></select></label><label className="block text-sm font-medium text-slate-700">Scripture reference<input value={scripture} onChange={(event) => setScripture(event.target.value)} placeholder="Optional reference" className="mt-2 w-full h-12 px-4 rounded-xl border" /></label><button onClick={() => void generate()} disabled={isGenerating} className="w-full h-12 bg-[hsl(210,70%,60%)] text-white rounded-xl font-medium disabled:opacity-50">{isGenerating ? 'Generating…' : 'Generate liturgy draft'}</button></div><div className="mt-8 rounded-xl bg-[hsl(48,60%,98%)] p-4 text-sm text-slate-600"><BookOpen className="w-5 h-5 mb-2" />The result is drafted through the FaithHaven AI service and is never a substitute for pastoral review.</div></section><section className="lg:col-span-2 bg-white rounded-2xl border border-[hsl(48,30%,88%)] p-6 overflow-y-auto"><div className="flex items-center justify-between mb-6"><h2 className="text-lg font-bold text-slate-800">Liturgy draft</h2>{content && <div className="flex gap-2"><button onClick={() => void save()} aria-label="Save liturgy" className="p-2 hover:bg-[hsl(48,60%,96%)] rounded-lg"><Save className="w-5 h-5 text-slate-500" /></button><button onClick={() => void copy()} aria-label="Copy liturgy" className="p-2 hover:bg-[hsl(48,60%,96%)] rounded-lg"><Copy className="w-5 h-5 text-slate-500" /></button><button onClick={download} aria-label="Download liturgy" className="p-2 hover:bg-[hsl(48,60%,96%)] rounded-lg"><Download className="w-5 h-5 text-slate-500" /></button></div>}</div>{content ? <div><p className="whitespace-pre-wrap text-slate-600 leading-relaxed">{content}</p><p className="mt-6 text-xs text-slate-500">Generated draft content should be reviewed for theological, liturgical, and licensing appropriateness.</p></div> : <div className="text-center py-12"><Scroll className="w-16 h-16 text-slate-200 mx-auto mb-4" /><p className="text-slate-500">Configure settings to request a liturgy draft.</p></div>}</section></div></div>;
}
