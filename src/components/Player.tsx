/* ==========================================================================
   VIDEO PLAYER — HLS.js wrapper with open-glass-ui Glass controls
   TV-remote friendly, spatial navigation compatible
   ========================================================================== */

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { useFocusable } from '../hooks/useSpatialNavigation';
import { Glass, useSdfFilter, SdfFilterDefinition } from '@open-glass-ui/react';
import { getMaterialPreset } from '@open-glass-ui/core';
import type { LensGeometry } from '@open-glass-ui/core';

interface PlayerProps {
  src: string;
  poster?: string;
  title?: string;
  onClose: () => void;
  onError?: (error: Error) => void;
  autoPlay?: boolean;
}

// Control bar geometry
const CONTROLS_GEOMETRY: LensGeometry = {
  kind: 'rounded-rect',
  width: 1280,
  height: 120,
  cornerRadius: 16,
};

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

  // SDF filter for controls
  const controlsFilter = useSdfFilter({
    id: 'player-controls',
    width: CONTROLS_GEOMETRY.width,
    height: CONTROLS_GEOMETRY.height,
    geometry: CONTROLS_GEOMETRY,
    material: getMaterialPreset('frosted'),
    quality: 'medium',
  });

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Video player: ${title || 'Playing'}`}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            background: '#000',
          }}
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
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '40px',
            textAlign: 'center',
            maxWidth: '500px',
            zIndex: 10,
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ogui-color-text)' }}>
              Playback Error
            </h2>
            <p style={{ margin: '0 0 24px', color: 'var(--ogui-color-text-secondary)', fontSize: '1rem' }}>
              {error}
            </p>
            <button
              style={{
                padding: '12px 24px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--ogui-color-accent)',
                color: 'var(--ogui-color-accent-contrast)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Glass Controls Bar */}
      <div
        ref={controlsRef}
        style={{
          position: 'relative',
          zIndex: 5,
          padding: '0 32px 24px',
          display: 'flex',
          justifyContent: 'center',
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      >
        <Glass
          as="div"
          material="frosted"
          look="frosted"
          geometry={CONTROLS_GEOMETRY}
          filterId={controlsFilter.ready ? controlsFilter.filterId : undefined}
          style={{
            width: '100%',
            maxWidth: CONTROLS_GEOMETRY.width,
            height: CONTROLS_GEOMETRY.height,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 24px',
            boxSizing: 'border-box',
          }}
        >
          {controlsFilter.ready && <SdfFilterDefinition filter={controlsFilter} />}

          {/* Progress Bar */}
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            role="slider"
            aria-label="Playback progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
            tabIndex={0}
            style={{
              position: 'relative',
              height: '6px',
              borderRadius: '3px',
              background: 'rgba(255,255,255,0.1)',
              cursor: 'pointer',
              marginBottom: '16px',
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') { e.preventDefault(); seek(Math.max(0, progressPercent - 1)); }
              if (e.key === 'ArrowRight') { e.preventDefault(); seek(Math.min(100, progressPercent + 1)); }
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${buffered}%`,
                borderRadius: '3px',
                background: 'rgba(255,255,255,0.2)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${progressPercent}%`,
                borderRadius: '3px',
                background: 'var(--ogui-color-accent)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: `${progressPercent}%`,
                transform: 'translate(-50%, -50%)',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'var(--ogui-color-accent)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
                transition: 'left 0.1s linear',
              }}
            />
          </div>

          {/* Bottom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
            <span style={{
              fontSize: '0.875rem',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--ogui-color-text-secondary)',
              minWidth: '120px',
              textAlign: 'left',
            }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                style={controlButtonStyle}
                onClick={() => { const v = videoRef.current; if (v) { v.currentTime = Math.max(0, v.currentTime - 30); resetControlsTimer(); } }}
                aria-label="Rewind 30s"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M11 19V5M7 11l-4 4 4 4" />
                  <text x="14" y="17" fontSize="8" fill="currentColor" textAnchor="middle">30</text>
                </svg>
              </button>

              <button
                style={controlButtonStyle}
                onClick={() => { const v = videoRef.current; if (v) { v.currentTime = Math.max(0, v.currentTime - 10); resetControlsTimer(); } }}
                aria-label="Rewind 10s"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M11 19V5M7 11l-4 4 4 4" />
                </svg>
              </button>

              <button
                style={{
                  ...controlButtonStyle,
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--ogui-color-accent)',
                  color: 'var(--ogui-color-accent-contrast)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => { const v = videoRef.current; if (v) isPlaying ? v.pause() : v.play(); resetControlsTimer(); }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
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

              <button
                style={controlButtonStyle}
                onClick={() => { const v = videoRef.current; if (v) { v.currentTime = Math.min(v.duration, v.currentTime + 10); resetControlsTimer(); } }}
                aria-label="Forward 10s"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M13 19V5M17 11l4 4-4 4" />
                </svg>
              </button>

              <button
                style={controlButtonStyle}
                onClick={() => { const v = videoRef.current; if (v) { v.currentTime = Math.min(v.duration, v.currentTime + 30); resetControlsTimer(); } }}
                aria-label="Forward 30s"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M13 19V5M17 11l4 4-4 4" />
                  <text x="14" y="17" fontSize="8" fill="currentColor" textAnchor="middle">30</text>
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '120px', justifyContent: 'flex-end' }}>
              <button
                style={controlButtonStyle}
                onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setIsMuted(v.muted); } resetControlsTimer(); }}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
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

              <button
                style={controlButtonStyle}
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
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

              <button
                style={controlButtonStyle}
                onClick={onClose}
                aria-label="Close player"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </Glass>
      </div>
    </div>
  );
}

const controlButtonStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--ogui-color-text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.1s ease, border-color 0.1s ease, transform 0.05s ease',
} as const;

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