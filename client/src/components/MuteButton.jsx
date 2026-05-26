import { useMuted } from '../lib/mute.js';
import { Volume2, VolumeX } from 'lucide-react';

export default function MuteButton({ className = '' }) {
  const [muted, setMuted] = useMuted();
  return (
    <button
      onClick={() => setMuted(!muted)}
      aria-label={muted ? 'Unmute' : 'Mute'}
      title={muted ? 'Sound off — click to unmute' : 'Sound on — click to mute'}
      className={`p-1.5 rounded hover:bg-jblueDark text-white/80 hover:text-jgold ${className}`}
    >
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}
