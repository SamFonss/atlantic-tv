/* ==========================================================================
   SEARCH — Overlay search with debounced TMDB queries
   Uses open-glass-ui Glass component with SDF-based refraction
   ========================================================================== */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ContentCard } from './ContentCard';
import type { MediaItem } from '../api/tmdb';
import { getTMDBClient } from '../api/tmdb';
import { Glass, useSdfFilter, SdfFilterDefinition } from '@open-glass-ui/react';
import { getMaterialPreset } from '@open-glass-ui/core';
import type { LensGeometry } from '@open-glass-ui/core';

interface SearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
}

const SEARCH_GEOMETRY: LensGeometry = {
  kind: 'rounded-rect',
  width: 720,
  height: 520,
  cornerRadius: 24,
};

export function Search({ isOpen, onClose, onSelect, onPlay }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tmdb = getTMDBClient();

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await tmdb.searchMulti(q);
      setResults(data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 20));
      setSelectedIndex(0);
    } catch (e) {
      console.error('Search error:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [tmdb]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        onSelect(results[selectedIndex]);
      }
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (results[selectedIndex]) {
        onPlay(results[selectedIndex]);
      }
    }
  };

  // SDF filter for the search overlay
  const filter = useSdfFilter({
    id: 'search-overlay',
    width: SEARCH_GEOMETRY.width,
    height: SEARCH_GEOMETRY.height,
    geometry: SEARCH_GEOMETRY,
    material: getMaterialPreset('frosted'),
    quality: 'medium',
  });

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 10, 15, 0.9)',
        backdropFilter: 'blur(16px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={handleKeyDown}
    >
      <Glass
        as="div"
        material="frosted"
        look="frosted"
        geometry={SEARCH_GEOMETRY}
        filterId={filter.ready ? filter.filterId : undefined}
        style={{
          width: '100%',
          maxWidth: SEARCH_GEOMETRY.width,
          height: SEARCH_GEOMETRY.height,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {filter.ready && <SdfFilterDefinition filter={filter} />}

        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflow: 'auto' }}>
          {/* Search icon */}
          <div style={{ textAlign: 'center' }} aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ogui-color-accent)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          {/* Search input */}
          <input
            ref={inputRef}
            type="search"
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--ogui-color-text)',
              fontSize: '1.125rem',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            placeholder="Search movies, shows, actors..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            autoComplete="off"
            aria-label="Search"
          />

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: 'var(--ogui-color-text-secondary)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
              </svg>
            </div>
          )}

          {results.length > 0 && (
            <div style={{ flex: 1, overflow: 'auto' }} role="listbox" aria-label="Search results">
              {results.map((item, i) => (
                <ContentCard
                  key={`${item.media_type}-${item.id}`}
                  item={item}
                  variant="poster"
                  onClick={() => onSelect(item)}
                  onPlay={() => onPlay(item)}
                  className={i === selectedIndex ? 'focused' : ''}
                />
              ))}
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', color: 'var(--ogui-color-text-muted)', textAlign: 'center' }}>
              No results found
            </div>
          )}

          {!query && !loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', color: 'var(--ogui-color-text-muted)', textAlign: 'center' }}>
              Type to search...
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Glass>
    </div>
  );
}

/* ==========================================================================
   COMMAND PALETTE — Quick actions (K key)
   ========================================================================== */

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

const COMMAND_GEOMETRY: LensGeometry = {
  kind: 'rounded-rect',
  width: 480,
  height: 380,
  cornerRadius: 20,
};

export function CommandPalette({ isOpen, onClose, onAction }: CommandPaletteProps) {
  const commands = [
    { key: 'K', label: 'Search', action: 'search' },
    { key: 'H', label: 'Home', action: 'home' },
    { key: 'L', label: 'Library', action: 'library' },
    { key: 'S', label: 'Settings', action: 'settings' },
    { key: 'P', label: 'Play/Resume', action: 'play' },
  ];

  const filter = useSdfFilter({
    id: 'command-palette',
    width: COMMAND_GEOMETRY.width,
    height: COMMAND_GEOMETRY.height,
    geometry: COMMAND_GEOMETRY,
    material: getMaterialPreset('frosted'),
    quality: 'medium',
  });

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 10, 15, 0.9)',
        backdropFilter: 'blur(16px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Commands"
    >
      <Glass
        as="div"
        material="frosted"
        look="frosted"
        geometry={COMMAND_GEOMETRY}
        filterId={filter.ready ? filter.filterId : undefined}
        style={{
          width: '100%',
          maxWidth: COMMAND_GEOMETRY.width,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {filter.ready && <SdfFilterDefinition filter={filter} />}

        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--ogui-color-text)' }}>
            Commands
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {commands.map((cmd) => (
              <button
                key={cmd.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--ogui-color-text)',
                  fontSize: '1rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s ease, border-color 0.1s ease',
                }}
                onClick={() => { onAction(cmd.action); onClose(); }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                <span>{cmd.label}</span>
                <kbd style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: 'var(--ogui-color-text-secondary)',
                }}>{cmd.key}</kbd>
              </button>
            ))}
          </div>
        </div>
      </Glass>
    </div>
  );
}