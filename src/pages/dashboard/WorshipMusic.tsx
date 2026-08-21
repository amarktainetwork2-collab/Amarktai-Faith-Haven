import { useEffect, useRef, useState } from 'react';
import { Heart, Music, Pause, Play, Search } from 'lucide-react';
import { ApiError, apiRequest } from '@/lib/api';

type Track = { id: string; title: string; artist: string | null; collection: string | null; stream_url: string; duration_seconds: number | null; license_reference: string };
const durationLabel = (seconds: number | null) => seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '—';

export default function WorshipMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('Loading licensed worship music…');

  useEffect(() => {
    void apiRequest<{ available: boolean; items: Track[]; message?: string }>('/api/media/worship_music')
      .then((data) => { setTracks(data.items); setSelected(data.items[0] || null); setMessage(data.message || ''); })
      .catch((error) => setMessage(error instanceof ApiError ? error.message : 'Worship music is unavailable.'));
  }, []);

  const selectTrack = (track: Track, play = false) => {
    setSelected(track); setIsPlaying(false);
    window.setTimeout(() => { if (play) void audioRef.current?.play(); }, 0);
  };
  const togglePlayback = async () => {
    if (!audioRef.current || !selected) return;
    if (audioRef.current.paused) await audioRef.current.play(); else audioRef.current.pause();
  };
  const filteredTracks = tracks.filter((track) => [track.title, track.artist || '', track.collection || ''].some((value) => value.toLowerCase().includes(searchQuery.toLowerCase())));

  if (!selected) return <div className="max-w-2xl"><h1 className="text-2xl font-bold text-slate-800">Worship Music</h1><div className="mt-6 rounded-2xl border border-[hsl(48,30%,88%)] bg-white p-8"><Music className="h-8 w-8 text-[hsl(210,70%,60%)]" /><h2 className="mt-4 text-lg font-semibold text-slate-800">Licensed worship music is not configured</h2><p className="mt-2 text-slate-600">{message || 'This feature will become available when a licensed music provider is connected.'}</p></div></div>;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6"><h1 className="text-2xl font-bold text-slate-800">Worship Music</h1><p className="text-slate-500">Listen to licensed worship music from configured providers.</p></div>
      <audio ref={audioRef} src={selected.stream_url} preload="metadata" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
      <div className="relative mb-6"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input type="search" placeholder="Search licensed tracks..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl border border-[hsl(48,30%,88%)] focus:border-[hsl(210,70%,60%)] focus:ring-2 focus:ring-[hsl(210,70%,60%)]/20 outline-none transition-all" /></div>
      <div className="bg-white rounded-2xl border border-[hsl(48,30%,88%)] p-6 mb-6"><div className="flex items-center gap-4"><div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[hsl(210,70%,60%)] to-[hsl(260,50%,65%)] flex items-center justify-center"><Music className="w-8 h-8 text-white" /></div><div className="flex-1"><h2 className="font-bold text-slate-800">{selected.title}</h2><p className="text-slate-500">{selected.artist || selected.collection || 'Licensed worship music'}</p><p className="mt-1 text-xs text-slate-400">License: {selected.license_reference}</p></div><button onClick={() => void togglePlayback()} aria-label={isPlaying ? 'Pause' : 'Play'} className="w-12 h-12 bg-[hsl(210,70%,60%)] rounded-full flex items-center justify-center text-white hover:bg-[hsl(210,60%,50%)] transition-colors">{isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}</button></div></div>
      <section className="flex-1 bg-white rounded-2xl border border-[hsl(48,30%,88%)] overflow-hidden"><div className="p-4 border-b border-[hsl(48,30%,88%)]"><h3 className="font-bold text-slate-800">Available tracks</h3></div><div className="overflow-y-auto max-h-[420px]">{filteredTracks.map((track) => <div key={track.id} className={`flex items-center gap-4 p-4 ${selected.id === track.id ? 'bg-[hsl(210,80%,95%)]' : 'hover:bg-[hsl(48,60%,98%)]'}`}><button onClick={() => selectTrack(track, true)} aria-label={`Play ${track.title}`} className="w-10 h-10 rounded-full bg-[hsl(48,60%,96%)] flex items-center justify-center hover:bg-[hsl(210,70%,60%)] hover:text-white transition-colors"><Play className="w-4 h-4 ml-0.5" /></button><button onClick={() => selectTrack(track)} className="flex-1 text-left"><p className={`font-medium ${selected.id === track.id ? 'text-[hsl(210,70%,50%)]' : 'text-slate-800'}`}>{track.title}</p><p className="text-sm text-slate-500">{track.artist || track.collection || 'Licensed music'}</p></button><span className="text-sm text-slate-400">{durationLabel(track.duration_seconds)}</span><Heart className="w-4 h-4 text-slate-400" aria-label="Favorites require an account-library integration" /></div>)}</div></section>
    </div>
  );
}
