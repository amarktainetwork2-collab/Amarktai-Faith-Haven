import { useEffect, useRef, useState } from 'react';
import { BookOpen, Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { ApiError, apiRequest } from '@/lib/api';

type AudioItem = { id: string; title: string; artist: string | null; collection: string | null; stream_url: string; duration_seconds: number | null; license_reference: string; metadata: { chapter?: string } };
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export default function BibleAudio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [items, setItems] = useState<AudioItem[]>([]);
  const [selected, setSelected] = useState<AudioItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [message, setMessage] = useState('Loading licensed audio…');

  useEffect(() => {
    void apiRequest<{ available: boolean; items: AudioItem[]; message?: string }>('/api/media/bible_audio')
      .then((data) => { setItems(data.items); setSelected(data.items[0] || null); setMessage(data.message || ''); })
      .catch((error) => setMessage(error instanceof ApiError ? error.message : 'Bible audio is unavailable.'));
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !selected) return;
    if (audio.paused) { await audio.play(); } else { audio.pause(); }
  };
  const selectItem = (item: AudioItem) => {
    setSelected(item); setCurrentTime(0); setDuration(0); setIsPlaying(false);
  };
  const moveSelection = (offset: number) => {
    if (!selected) return;
    const index = items.findIndex((item) => item.id === selected.id);
    const next = items[index + offset];
    if (next) selectItem(next);
  };

  if (!selected) return <div className="max-w-2xl"><h1 className="text-2xl font-bold text-slate-800">Bible Audio</h1><div className="mt-6 rounded-2xl border border-[hsl(48,30%,88%)] bg-white p-8"><BookOpen className="h-8 w-8 text-[hsl(210,70%,60%)]" /><h2 className="mt-4 text-lg font-semibold text-slate-800">Licensed audio is not configured</h2><p className="mt-2 text-slate-600">{message || 'This feature will become available when a licensed Bible-audio provider is connected.'}</p></div></div>;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6"><h1 className="text-2xl font-bold text-slate-800">Bible Audio</h1><p className="text-slate-500">Listen to licensed Scripture audio on the go.</p></div>
      <audio ref={audioRef} src={selected.stream_url} preload="metadata" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => moveSelection(1)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || selected.duration_seconds || 0)} />
      <div className="grid lg:grid-cols-3 gap-6 flex-1">
        <div className="lg:col-span-2"><div className="bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(260,50%,55%)] rounded-2xl p-8 text-white"><div className="flex items-center gap-4 mb-8"><div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center"><BookOpen className="w-10 h-10" /></div><div><p className="text-white/70">Now playing</p><h2 className="text-2xl font-bold">{selected.title}</h2><p className="text-white/70">{selected.collection || selected.artist || 'Licensed Bible audio'}</p></div></div>
          <input aria-label="Playback progress" className="w-full accent-white" type="range" min="0" max={Math.max(duration, 1)} value={currentTime} onChange={(event) => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setCurrentTime(value); }} />
          <div className="flex justify-between text-sm text-white/70 mt-2"><span>{formatTime(currentTime)}</span><span>{formatTime(duration || selected.duration_seconds || 0)}</span></div>
          <div className="mt-6 flex items-center justify-center gap-6"><button onClick={() => moveSelection(-1)} disabled={items[0]?.id === selected.id} aria-label="Previous chapter" className="p-3 hover:bg-white/10 disabled:opacity-40 rounded-full"><SkipBack className="w-6 h-6" /></button><button onClick={() => void togglePlayback()} aria-label={isPlaying ? 'Pause' : 'Play'} className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-[hsl(210,70%,50%)] hover:scale-105 transition-transform">{isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}</button><button onClick={() => moveSelection(1)} disabled={items.at(-1)?.id === selected.id} aria-label="Next chapter" className="p-3 hover:bg-white/10 disabled:opacity-40 rounded-full"><SkipForward className="w-6 h-6" /></button></div></div>
          <div className="mt-6 bg-white rounded-2xl border border-[hsl(48,30%,88%)] p-6"><div className="flex items-center gap-4"><Volume2 className="w-5 h-5 text-slate-400" /><input aria-label="Volume" className="flex-1 accent-[hsl(210,70%,60%)]" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><label className="text-sm text-slate-600">Speed <select className="ml-1 rounded border p-1" defaultValue="1" onChange={(event) => { if (audioRef.current) audioRef.current.playbackRate = Number(event.target.value); }}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label></div><p className="mt-4 text-xs text-slate-500">License: {selected.license_reference}</p></div>
        </div>
        <aside className="bg-white rounded-2xl border border-[hsl(48,30%,88%)] p-6 overflow-y-auto"><h3 className="font-bold text-slate-800 mb-4">Available chapters</h3><div className="space-y-2">{items.map((item) => <button key={item.id} onClick={() => selectItem(item)} className={`w-full text-left p-3 rounded-xl transition-colors ${selected.id === item.id ? 'bg-[hsl(210,80%,95%)] text-[hsl(210,70%,50%)]' : 'hover:bg-[hsl(48,60%,98%)] text-slate-600'}`}><span className="block font-medium">{item.title}</span><span className="block text-sm opacity-70">{item.collection || item.artist || 'Licensed audio'}</span></button>)}</div></aside>
      </div>
    </div>
  );
}
