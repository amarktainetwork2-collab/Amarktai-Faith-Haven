import { useEffect, useState } from 'react';
import { Flag, Heart, Pencil, Plus, RefreshCw, Trash2, User, X } from 'lucide-react';
import { ApiError, apiRequest } from '@/lib/api';
import { toast } from 'sonner';

type PrayerWallPost = { id: string; content: string; is_anonymous: boolean; created_at: string; author_name: string | null; prayer_count: number; prayed: boolean; is_owner: boolean };
type EditorState = { id?: string; content: string; isAnonymous: boolean };

const relativeTime = (timestamp: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return 'Just now'; if (minutes < 60) return `${minutes}m ago`; if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`; return `${Math.floor(minutes / 1_440)}d ago`;
};

export default function PrayerWall() {
  const [prayers, setPrayers] = useState<PrayerWallPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const loadPrayers = async () => {
    setLoading(true);
    try { const data = await apiRequest<{ prayers: PrayerWallPost[] }>('/api/prayer-wall?limit=50'); setPrayers(data.prayers); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to load prayer requests.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadPrayers(); }, []);

  const savePrayer = async () => {
    if (!editor?.content.trim()) { toast.error('Please enter a prayer request.'); return; }
    setSaving(true);
    try {
      const path = editor.id ? `/api/prayer-wall/${editor.id}` : '/api/prayer-wall';
      const method = editor.id ? 'PUT' : 'POST';
      await apiRequest(path, { method, body: JSON.stringify({ content: editor.content, isAnonymous: editor.isAnonymous }) });
      setEditor(null); await loadPrayers(); toast.success(editor.id ? 'Prayer request updated.' : 'Prayer request shared.');
    } catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to save this prayer request.'); }
    finally { setSaving(false); }
  };
  const prayFor = async (id: string) => {
    try { await apiRequest(`/api/prayer-wall/${id}/pray`, { method: 'POST' }); setPrayers((items) => items.map((item) => item.id === id ? { ...item, prayed: true, prayer_count: item.prayed ? item.prayer_count : item.prayer_count + 1 } : item)); toast.success('Your prayer has been recorded.'); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to record your prayer.'); }
  };
  const removePrayer = async (id: string) => {
    if (!window.confirm('Delete this public prayer request?')) return;
    try { await apiRequest(`/api/prayer-wall/${id}`, { method: 'DELETE' }); setPrayers((items) => items.filter((item) => item.id !== id)); toast.success('Prayer request deleted.'); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to delete this request.'); }
  };
  const reportPrayer = async (id: string) => {
    const reason = window.prompt('Briefly describe the concern.'); if (!reason?.trim()) return;
    try { await apiRequest(`/api/prayer-wall/${id}/report`, { method: 'POST', body: JSON.stringify({ reason }) }); toast.success('Report submitted for moderation.'); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to submit this report.'); }
  };

  return <div className="h-full flex flex-col"><header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"><div><h1 className="text-2xl font-bold text-slate-800">Prayer Wall</h1><p className="text-slate-500">Share public requests and pray for others with care.</p></div><button onClick={() => setEditor({ content: '', isAnonymous: false })} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[hsl(210,70%,60%)] text-white rounded-xl font-medium hover:bg-[hsl(210,60%,50%)]"><Plus className="w-5 h-5" />Share request</button></header><div className="flex-1 overflow-y-auto"><div className="flex justify-end mb-3"><button onClick={() => void loadPrayers()} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>{loading && !prayers.length ? <p className="text-slate-500">Loading prayer requests…</p> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{prayers.map((prayer) => <article key={prayer.id} className="bg-white rounded-2xl p-6 border border-[hsl(48,30%,88%)]"><div className="flex items-start justify-between gap-3 mb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(260,50%,65%)] flex items-center justify-center"><User className="w-5 h-5 text-white" /></div><div><p className="font-medium text-slate-800">{prayer.is_anonymous ? 'Anonymous' : prayer.author_name || 'FaithHaven member'}</p><p className="text-xs text-slate-500">{relativeTime(prayer.created_at)}</p></div></div><div className="flex gap-1">{prayer.is_owner && <><button onClick={() => setEditor({ id: prayer.id, content: prayer.content, isAnonymous: prayer.is_anonymous })} aria-label="Edit prayer request" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button><button onClick={() => void removePrayer(prayer.id)} aria-label="Delete prayer request" className="p-1.5 text-red-700 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></>} {!prayer.is_owner && <button onClick={() => void reportPrayer(prayer.id)} aria-label="Report prayer request" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"><Flag className="w-4 h-4" /></button>}</div></div><p className="text-slate-700 mb-6 leading-relaxed whitespace-pre-wrap">{prayer.content}</p><button disabled={prayer.prayed} onClick={() => void prayFor(prayer.id)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[hsl(48,60%,98%)] hover:bg-[hsl(210,80%,95%)] text-slate-600 hover:text-[hsl(210,70%,50%)] disabled:opacity-60"><Heart className={`w-5 h-5 ${prayer.prayed ? 'fill-current' : ''}`} /><span>{prayer.prayed ? 'You prayed' : 'Pray for this'} ({prayer.prayer_count})</span></button></article>)}</div>}{!loading && !prayers.length && <div className="text-center py-12"><Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h2 className="text-lg font-bold text-slate-800">No prayer requests yet</h2><p className="mt-2 text-slate-500">Be the first to share a public request.</p></div>}</div>{editor && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="prayer-editor-title"><div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl"><div className="flex items-center justify-between mb-4"><h2 id="prayer-editor-title" className="text-xl font-bold text-slate-800">{editor.id ? 'Edit prayer request' : 'Share prayer request'}</h2><button onClick={() => setEditor(null)} aria-label="Close" className="text-slate-500 hover:text-slate-800"><X className="w-5 h-5" /></button></div><label className="block text-sm font-medium text-slate-700" htmlFor="prayer-wall-content">Prayer request</label><textarea id="prayer-wall-content" autoFocus value={editor.content} onChange={(event) => setEditor((current) => current ? { ...current, content: event.target.value } : current)} rows={5} className="mt-2 w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[hsl(210,70%,60%)]/20 outline-none resize-none" /><label className="mt-4 flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editor.isAnonymous} onChange={(event) => setEditor((current) => current ? { ...current, isAnonymous: event.target.checked } : current)} /><span className="text-sm text-slate-600">Post anonymously</span></label><div className="flex gap-3 mt-6"><button onClick={() => setEditor(null)} className="flex-1 h-12 border rounded-xl">Cancel</button><button disabled={saving} onClick={() => void savePrayer()} className="flex-1 h-12 bg-[hsl(210,70%,60%)] text-white rounded-xl disabled:opacity-60">{saving ? 'Saving…' : 'Save request'}</button></div></div></div>}</div>;
}
