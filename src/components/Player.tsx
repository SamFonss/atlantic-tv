/* ==========================================================================
   VIDEO PLAYER — HLS.js wrapper with glass-morphism controls
   TV-remote friendly, spatial navigation compatible
   ========================================================================== */

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { useFocusable } from '../hooks/useSpatialNavigation';

interface PlayerProps {
  src: string;
  poster?: string;
  title?: string;
  onClose: () => void;
  onError?: (error: Error) => void;
  autoPlay?: boolean;
}

export function Player({ src, poster, title, onClose, onError, autoPlay = true }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [buffered, setBuffered] = useState(0);

  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focusable for spatial nav
  const overlayRef = useFocusable<HTMLDivElement>({
    onFocus: () => setShowControls(true),
  });

  // Initialize HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !Hls.isSupported()) {
      if (video) {
        video.src = src;
        if (autoPlay) video.play().catch(() => {});
      }
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      startLevel: -1,
      capLevelToPlayerSize: true,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
    });

    hlsRef.current = hls;
    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (autoPlay) video.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            const err = new Error(`HLS Error: ${data.details}`);
            setErrorState(err.message);
            onError?.(err);
        }
      }
    });

    return () => {
      hls.destroy();
    };
  }, [src, autoPlay, onError]);

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, []);

  const handleDurationChange = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.buffered.length) return;
    const end = video.buffered.end(video.buffered.length - 1);
    setBuffered((end / video.duration) * 100);
  }, []);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const err = new Error(`Video error: ${video.error?.message || 'Unknown'}`);
    setErrorState(err.message);
    onError?.(err);
  }, [onError]);

  // Controls visibility
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // Seek
  const seek = useCallback((percent: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = (percent / 100) * video.duration;
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return;
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    seek(percent);
  }, [seek]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const video = videoRef.current;
    if (!video) return;

    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault();
        isPlaying ? video.pause() : video.play();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        resetControlsTimer();
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        resetControlsTimer();
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        setVolume(video.volume);
        setIsMuted(false);
        resetControlsTimer();
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
        setVolume(video.volume);
        if (video.volume === 0) setIsMuted(true);
        resetControlsTimer();
        break;
      case 'm':
      case 'M':
        video.muted = !video.muted;
        setIsMuted(video.muted);
        resetControlsTimer();
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case 'Escape':
        if (isFullscreen) {
          toggleFullscreen();
        } else {
          onClose();
        }
        break;
    }
  }, [isPlaying, isFullscreen, onClose, resetControlsTimer]);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isFullscreen) {
      video.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Format time
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Keyboard listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [handleKeyDown]);

  // Focus management for controls
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleFocusIn = () => setShowControls(true);
    const handleFocusOut = (e: FocusEvent) => {
      if (!controls.contains(e.relatedTarget as Node)) {
        setShowControls(false);
      }
    };

    controls.addEventListener('focusin', handleFocusIn);
    controls.addEventListener('focusout', handleFocusOut);
    return () => {
      controls.removeEventListener('focusin', handleFocusIn);
      controls.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={overlayRef}
      className="player-overlay glass-liquid"
      role="dialog"
      aria-modal="true"
      aria-label={`Video player: ${title || 'Playing'}`}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      <video
        ref={videoRef}
        className="player-overlay__video"
        poster={poster}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onProgress={handleProgress}
        onError={handleError}
        onClick={() => resetControlsTimer()}
      />

      {error && (
        <div className="glass-panel glass-liquid" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: '40px', textAlign: 'center', maxWidth: '500px' }}>
          <h2 className="tv-title-3" style={{ marginBottom: '16px' }}>Playback Error</h2>
          <p className="tv-body" style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error}</p>
          <button className="btn btn-primary glass-prism" onClick={onClose}>Close</button>
        </div>
      )}

      <div
        ref={controlsRef}
        className={`player-overlay__controls glass-strong caustics-subtle ${showControls ? '' : 'hidden'}`}
        style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none', transition: 'opacity 0.3s ease' }}
      >
        <div className="player-overlay__progress glass-refractive" ref={progressRef} onClick={handleProgressClick} role="slider" aria-label="Playback progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)} tabIndex={0}>
          <div className="player-overlay__progress-fill" style={{ width: `${progressPercent}%` }} />
          <div className="player-overlay__progress-buffered" style={{ width: `${buffered}%`, background: 'rgba(255,255,255,0.2)' }} />
          <div className="player-overlay__progress-handle" style={{ left: `${progressPercent}%` }} />
        </div>

        <div className="player-overlay__bottom">
          <span className="player-overlay__time">{formatTime(currentTime)} / {formatTime(duration)}</span>

          <div className="player-overlay__center">
            <button className="player-overlay__btn glass-subtle" onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 10); resetControlsTimer(); }} aria-label="Rewind 10s">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M11 19V5M7 11l-4 4 4 4" />
              </svg>
            </button>

            <button className="player-overlay__btn glass-subtle" onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration, v.currentTime + 10); resetControlsTimer(); }} aria-label="Forward 10s">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M13 19V5M17 11l4 4-4 4" />
              </svg>
            </button>

            <button className="player-overlay__btn player-overlay__btn--play glass-prism" onClick={() => { const v = videoRef.current; if (v) isPlaying ? v.pause() : v.play(); resetControlsTimer(); }} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button className="player-overlay__btn glass-subtle" onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 30); resetControlsTimer(); }} aria-label="Rewind 30s">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M11 19V5M7 11l-4 4 4 4" />
                <text x="14" y="17" fontSize="8" fill="currentColor" textAnchor="middle">30</text>
              </svg>
            </button>

            <button className="player-overlay__btn glass-subtle" onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration, v.currentTime + 30); resetControlsTimer(); }} aria-label="Forward 30s">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M13 19V5M17 11l4 4-4 4" />
                <text x="14" y="17" fontSize="8" fill="currentColor" textAnchor="middle">30</text>
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="player-overlay__btn glass-subtle" onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setIsMuted(v.muted); } resetControlsTimer(); }} aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted || volume === 0 ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : volume < 0.5 ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>

            <button className="player-overlay__btn glass-subtle" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3M21 3v3a2 2 0 0 0 2 2h3M3 21v-3a2 2 0 0 0-2-2H3M21 21v-3a2 2 0 0 1 2-2h3" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
              )}
            </button>

            <button className="player-overlay__btn glass-subtle" onClick={onClose} aria-label="Close player">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   SIMPLE PLAYER HOOK for inline usage
   ========================================================================== */

export function usePlayer(src: string) {
  const [hls, setHls] = useState<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !Hls.isSupported()) return;

    const hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
    hlsInstance.loadSource(src);
    hlsInstance.attachMedia(video);
    setHls(hlsInstance);

    return () => hlsInstance.destroy();
  }, [src]);

  return { videoRef, hls };
}