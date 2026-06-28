import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume1, Volume2, VolumeX } from 'lucide-react';
import { C } from '../../lib/constants';

export function MusicBtn({ playing, onToggle, audioRef }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const prevVolume = useRef(1);

  useEffect(() => {
    const el = audioRef && audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onLoaded = () => setDuration(el.duration || 0);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    if (el.duration) setDuration(el.duration);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [audioRef]);

  function seek(e) {
    const el = audioRef && audioRef.current;
    if (!el || !duration) return;
    el.currentTime = parseFloat(e.target.value);
    setCurrentTime(parseFloat(e.target.value));
  }

  function changeVolume(e) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setMuted(v === 0);
    prevVolume.current = v > 0 ? v : prevVolume.current;
    const el = audioRef && audioRef.current;
    if (el) el.volume = v;
  }

  function toggleMute() {
    const el = audioRef && audioRef.current;
    if (muted) {
      const restore = prevVolume.current > 0 ? prevVolume.current : 0.7;
      setVolume(restore);
      setMuted(false);
      if (el) el.volume = restore;
    } else {
      prevVolume.current = volume > 0 ? volume : 0.7;
      setVolume(0);
      setMuted(true);
      if (el) el.volume = 0;
    }
  }

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.4 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        title={playing ? "Pause music" : "Play music"}
        className="flex items-center justify-center rounded-full shrink-0"
        style={{ width: 30, height: 30, background: playing ? C.brass : "transparent", border: `1px solid ${playing ? C.brass : C.inkLine}` }}
      >
        {playing ? <Pause size={12} color={playing ? C.inkText : C.ivory} /> : <Play size={12} color={C.ivory} />}
      </button>
      <input
        type="range" min="0" max={duration || 100} step="0.5" value={currentTime}
        onChange={seek}
        className="artium-slider"
        style={{ width: 80, accentColor: C.brass, cursor: "pointer" }}
        title="Seek"
      />
      <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"} style={{ color: C.ivoryDim, lineHeight: 0 }}>
        <VolumeIcon size={14} />
      </button>
      <input
        type="range" min="0" max="1" step="0.02" value={volume}
        onChange={changeVolume}
        className="artium-slider"
        style={{ width: 48, accentColor: C.brass, cursor: "pointer" }}
        title="Volume"
      />
    </div>
  );
}
