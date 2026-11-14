/* ==========================================================================
   SEARCH — Overlay search with debounced TMDB queries
   ========================================================================== */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ContentCard } from './ContentCard';
import type { MediaItem } from '../api/tmdb';
import { getTMDBClient } from '../api/tmdb';

interface SearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
}

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

  if (!isOpen) return null;

  return (
    <div
      className="search-overlay glass-liquid distort-medium caustics-subtle"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={handleKeyDown}
    >
      <div className="search-wrapper" style={{ maxWidth: '720px', margin: '0 auto', padding: '32px' }}>
        <div className="search-wrapper__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="search"
          className="search-input glass-refractive"
          placeholder="Search movies, shows, actors..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          autoComplete="off"
          aria-label="Search"
        />

        {loading && (
          <div className="flex-center glass-subtle" style={{ padding: '32px', color: 'var(--text-secondary)', borderRadius: 'var(--radius-lg)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
            </svg>
          </div>
        )}

        {results.length > 0 && (
          <div className="tv-row" style={{ marginTop: '24px' }} role="listbox" aria-label="Search results">
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
          <div className="flex-center tv-body glass-frosted" style={{ padding: '48px', color: 'var(--text-muted)', borderRadius: 'var(--radius-lg)' }}>
            No results found
          </div>
        )}

        {!query && !loading && (
          <div className="tv-body glass-frosted" style={{ padding: '48px', color: 'var(--text-muted)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
            Type to search...
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
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

export function CommandPalette({ isOpen, onClose, onAction }: CommandPaletteProps) {
  const commands = [
    { key: 'K', label: 'Search', action: 'search' },
    { key: 'H', label: 'Home', action: 'home' },
    { key: 'L', label: 'Library', action: 'library' },
    { key: 'S', label: 'Settings', action: 'settings' },
    { key: 'P', label: 'Play/Resume', action: 'play' },
  ];

  if (!isOpen) return null;

  return (
    <>
      <div className="command-palette glass-liquid caustics-normal" role="dialog" aria-modal="true" aria-label="Commands">
        <div style={{ padding: '32px', maxWidth: '480px', margin: '0 auto' }}>
          <h3 className="tv-title-3" style={{ marginBottom: '24px' }}>Commands</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {commands.map((cmd) => (
              <button
                key={cmd.action}
                className="btn btn-glass glass-refractive"
                style={{ justifyContent: 'space-between', textAlign: 'left' }}
                onClick={() => { onAction(cmd.action); onClose(); }}
              >
                <span className="tv-body">{cmd.label}</span>
                <kbd style={{
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)'
                }}>{cmd.key}</kbd>
              </button>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        .command-palette {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 10, 15, 0.9);
          backdrop-filter: blur(16px);
        }
      `}</style>
    </>
  );
}