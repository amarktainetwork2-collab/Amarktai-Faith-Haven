import { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Plus, Search, Tag, Trash2 } from 'lucide-react';
import { ApiError, apiRequest } from '@/lib/api';
import { toast } from 'sonner';

type Prayer = { id: string; title: string; content: string; tags: string[]; is_answered: boolean; created_at: string };
const prayerTags = ['Family', 'Health', 'Career', 'Finances', 'Relationships', 'Guidance', 'Healing', 'Thanksgiving'];

export default function PrayerJournal() {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [newPrayer, setNewPrayer] = useState({ title: '', content: '', tags: [] as string[], shareOnWall: false });

  const loadPrayers = async () => {
    try { const data = await apiRequest<{ prayers: Prayer[] }>('/api/prayer-journal'); setPrayers(data.prayers); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to load your prayer journal.'); }
  };
  useEffect(() => { void loadPrayers(); }, []);
  const filteredPrayers = useMemo(() => prayers.filter((prayer) => `${prayer.title} ${prayer.content}`.toLowerCase().includes(searchQuery.toLowerCase())), [prayers, searchQuery]);

  const handleAddPrayer = async () => {
    if (!newPrayer.title.trim() || !newPrayer.content.trim()) { toast.error('Please provide a title and details.'); return; }
    setSaving(true);
    try {
      await apiRequest('/api/prayer-journal', { method: 'POST', body: JSON.stringify({ title: newPrayer.title, content: newPrayer.content, tags: newPrayer.tags }) });
      if (newPrayer.shareOnWall) await apiRequest('/api/prayer-wall', { method: 'POST', body: JSON.stringify({ content: newPrayer.content, isAnonymous: false }) });
      setNewPrayer({ title: '', content: '', tags: [], shareOnWall: false });
      setShowAddModal(false);
      await loadPrayers();
      toast.success('Prayer saved securely.');
    } catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to save this prayer.'); }
    finally { setSaving(false); }
  };
  const markAnswered = async (id: string) => {
    try { await apiRequest(`/api/prayer-journal/${id}`, { method: 'PATCH', body: JSON.stringify({ isAnswered: true }) }); await loadPrayers(); toast.success('Prayer marked as answered.'); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to update this prayer.'); }
  };
  const deletePrayer = async (id: string) => {
    try { await apiRequest<void>(`/api/prayer-journal/${id}`, { method: 'DELETE' }); setPrayers((items) => items.filter((prayer) => prayer.id !== id)); toast.success('Prayer deleted.'); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'Unable to delete this prayer.'); }
  };
  const toggleTag = (tag: string) => setNewPrayer((current) => ({ ...current, tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag] }));

  return <div className="h-full flex flex-col">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"><div><h1 className="text-2xl font-bold text-slate-800">Prayer Journal</h1><p className="text-slate-500">Private, persistent prayer notes for your account.</p></div><button onClick={() => setShowAddModal(true)} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[hsl(210,70%,60%)] text-white rounded-xl font-medium hover:bg-[hsl(210,60%,50%)]"><Plus className="w-5 h-5" />New prayer</button></div>
    <div className="relative mb-6"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input type="search" placeholder="Search your private prayers..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl border border-[hsl(48,30%,88%)] focus:border-[hsl(210,70%,60%)] focus:ring-2 focus:ring-[hsl(210,70%,60%)]/20 outline-none" /></div>
    <div className="grid grid-cols-3 gap-4 mb-6">{[['Total', prayers.length, 'text-[hsl(210,70%,50%)]'], ['Answered', prayers.filter((prayer) => prayer.is_answered).length, 'text-[hsl(150,30%,55%)]'], ['Active', prayers.filter((prayer) => !prayer.is_answered).length, 'text-[hsl(48,80%,45%)]']].map(([label, value, colour]) => <div key={String(label)} className="bg-white rounded-xl p-4 border border-[hsl(48,30%,88%)]"><p className={`text-2xl font-bold ${colour}`}>{value}</p><p className="text-sm text-slate-500">{label}</p></div>)}</div>
    <div className="flex-1 overflow-y-auto space-y-4">{filteredPrayers.map((prayer) => <article key={prayer.id} className={`bg-white rounded-2xl p-6 border ${prayer.is_answered ? 'border-[hsl(150,30%,55%)]/30 bg-[hsl(150,30%,95%)]' : 'border-[hsl(48,30%,88%)]'}`}><div className="flex items-start justify-between gap-4"><div className="flex-1"><div className="flex items-center gap-2 mb-2"><h2 className={`font-bold ${prayer.is_answered ? 'line-through text-slate-500' : 'text-slate-800'}`}>{prayer.title}</h2><Lock className="w-4 h-4 text-slate-400" aria-label="Private" /></div><p className="text-sm mb-3 text-slate-600">{prayer.content}</p><div className="flex flex-wrap gap-2">{prayer.tags.map((tag) => <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-[hsl(48,60%,96%)] text-slate-600 text-xs rounded-full"><Tag className="w-3 h-3" />{tag}</span>)}</div></div><div className="flex items-center gap-2">{!prayer.is_answered && <button onClick={() => void markAnswered(prayer.id)} aria-label="Mark as answered" className="p-2 text-[hsl(150,30%,55%)] hover:bg-[hsl(150,30%,95%)] rounded-lg"><Check className="w-5 h-5" /></button>}<button onClick={() => void deletePrayer(prayer.id)} aria-label="Delete prayer" className="p-2 text-slate-400 hover:text-[hsl(0,70%,55%)] hover:bg-[hsl(0,70%,95%)] rounded-lg"><Trash2 className="w-5 h-5" /></button></div></div></article>)}
      {!filteredPrayers.length && <div className="text-center py-12"><div className="w-16 h-16 rounded-full bg-[hsl(48,60%,96%)] flex items-center justify-center mx-auto mb-4"><Plus className="w-8 h-8 text-slate-400" /></div><h2 className="text-lg font-bold text-slate-800 mb-2">No prayers yet</h2><p className="text-slate-500 mb-4">Start a private journal entry when you are ready.</p><button onClick={() => setShowAddModal(true)} className="px-6 py-3 bg-[hsl(210,70%,60%)] text-white rounded-xl font-medium">Add your first prayer</button></div>}</div>
    {showAddModal && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="new-prayer-title"><div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto"><h2 id="new-prayer-title" className="text-xl font-bold text-slate-800 mb-4">New prayer entry</h2><div className="space-y-4"><label className="block text-sm font-medium text-slate-700">Title<input value={newPrayer.title} onChange={(event) => setNewPrayer((current) => ({ ...current, title: event.target.value }))} className="mt-2 w-full h-12 px-4 rounded-xl border" /></label><label className="block text-sm font-medium text-slate-700">Details<textarea value={newPrayer.content} onChange={(event) => setNewPrayer((current) => ({ ...current, content: event.target.value }))} rows={4} className="mt-2 w-full px-4 py-3 rounded-xl border resize-none" /></label><div><p className="text-sm font-medium text-slate-700 mb-2">Tags</p><div className="flex flex-wrap gap-2">{prayerTags.map((tag) => <button key={tag} onClick={() => toggleTag(tag)} className={`px-3 py-1.5 rounded-full text-sm ${newPrayer.tags.includes(tag) ? 'bg-[hsl(210,70%,60%)] text-white' : 'bg-[hsl(48,60%,96%)] text-slate-600'}`}>{tag}</button>)}</div></div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newPrayer.shareOnWall} onChange={(event) => setNewPrayer((current) => ({ ...current, shareOnWall: event.target.checked }))} /><span className="text-sm text-slate-600">Also share these details on the public prayer wall</span></label></div><div className="flex gap-3 mt-6"><button onClick={() => setShowAddModal(false)} className="flex-1 h-12 border rounded-xl">Cancel</button><button disabled={saving} onClick={() => void handleAddPrayer()} className="flex-1 h-12 bg-[hsl(210,70%,60%)] text-white rounded-xl disabled:opacity-60">{saving ? 'Saving…' : 'Save prayer'}</button></div></div></div>}
  </div>;
}
