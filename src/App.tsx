/* ==========================================================================
   ATLANTIC TV — Main App Component
   TV-optimized media browser with Real-Debrid + TMDB
   ========================================================================== */

import { useState, useEffect, useCallback } from 'react';
import { useSpatialNavigation } from './hooks/useSpatialNavigation';
import { ContentRow, HeroSection } from './components/ContentRow';
import { Player } from './components/Player';
import { Search, CommandPalette } from './components/Search';
import { useRealDebrid } from './api/realdebrid';
import { useTMDB } from './api/tmdb';
import type { MediaItem } from './api/tmdb';
import './styles/nimbus.css';

// Genre IDs for discover rows
const GENRE_ROWS = [
  { id: 28, name: 'Action', emoji: '💥' },
  { id: 12, name: 'Adventure', emoji: '🗺️' },
  { id: 16, name: 'Animation', emoji: '🎨' },
  { id: 35, name: 'Comedy', emoji: '😂' },
  { id: 80, name: 'Crime', emoji: '🕵️' },
  { id: 99, name: 'Documentary', emoji: '📹' },
  { id: 18, name: 'Drama', emoji: '🎭' },
  { id: 10751, name: 'Family', emoji: '👨‍👩‍👧‍👦' },
  { id: 14, name: 'Fantasy', emoji: '🏰' },
  { id: 36, name: 'History', emoji: '📜' },
  { id: 27, name: 'Horror', emoji: '👻' },
  { id: 10402, name: 'Music', emoji: '🎵' },
  { id: 9648, name: 'Mystery', emoji: '🔍' },
  { id: 10749, name: 'Romance', emoji: '❤️' },
  { id: 878, name: 'Sci-Fi', emoji: '🚀' },
  { id: 10770, name: 'TV Movie', emoji: '📺' },
  { id: 53, name: 'Thriller', emoji: '😰' },
  { id: 10752, name: 'War', emoji: '⚔️' },
  { id: 37, name: 'Western', emoji: '🤠' },
];

function App() {
  // API Clients
  const { client: rdClient, user: rdUser, error: rdError } = useRealDebrid(
    import.meta.env.VITE_REALDEBRID_TOKEN
  );
  const { client: tmdb, discoverByGenre } = useTMDB(
    import.meta.env.VITE_TMDB_API_KEY
  );

  // State
  const [heroItem, setHeroItem] = useState<MediaItem | null>(null);
  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [trendingTV, setTrendingTV] = useState<MediaItem[]>([]);
  const [genreRows, setGenreRows] = useState<Record<number, MediaItem[]>>({});
  const [continueWatching, setContinueWatching] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerSrc, setPlayerSrc] = useState('');
  const [playerItem, setPlayerItem] = useState<MediaItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Spatial Navigation
  const { refresh } = useSpatialNavigation({
    selector: '[data-focusable]',
    onBack: () => {
      if (searchOpen) { setSearchOpen(false); return true; }
      if (commandOpen) { setCommandOpen(false); return true; }
      if (playerOpen) { setPlayerOpen(false); return true; }
      if (userMenuOpen) { setUserMenuOpen(false); return true; }
      return false;
    },
  });

  // Load initial data
  useEffect(() => {
    async function loadData() {
      if (!tmdb) return;
      setLoading(true);
      try {
        const [trendingAll, trendingMovie, trendingTVData] = await Promise.all([
          tmdb.getTrending('all', 'week'),
          tmdb.getTrending('movie', 'week'),
          tmdb.getTrending('tv', 'week'),
        ]);

        // Hero = top trending
        if (trendingAll.results.length > 0) {
          const hero = trendingAll.results[0];
          // Fetch full details for hero
          const details = hero.media_type === 'movie'
            ? await tmdb.getMovieDetails(hero.id, ['videos', 'credits', 'images'])
            : await tmdb.getTVDetails(hero.id, ['videos', 'credits', 'images']);
          setHeroItem(details as MediaItem);
        }

        setTrendingMovies(trendingMovie.results.slice(0, 20));
        setTrendingTV(trendingTVData.results.slice(0, 20));

        // Load genre rows (first 6 genres)
        const genrePromises = GENRE_ROWS.slice(0, 6).map(async ({ id }) => {
          const [movies, tv] = await Promise.all([
            discoverByGenre('movie', id),
            discoverByGenre('tv', id),
          ]);
          const combined = [...movies.results, ...tv.results]
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 20);
          return { id, items: combined };
        });
        const genreResults = await Promise.all(genrePromises);
        const genreMap: Record<number, MediaItem[]> = {};
        genreResults.forEach(({ id, items }) => { genreMap[id] = items; });
        setGenreRows(genreMap);

        // Load continue watching from localStorage
        const saved = localStorage.getItem('continueWatching');
        if (saved) {
          try {
            setContinueWatching(JSON.parse(saved));
          } catch {}
        }
      } catch (e) {
        console.error('Failed to load data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tmdb, discoverByGenre]);

  // Play handler - gets stream URL from Real-Debrid
  const handlePlay = useCallback(async (item: MediaItem) => {
    if (!rdClient) {
      alert('Real-Debrid not configured. Add VITE_REALDEBRID_TOKEN to .env');
      return;
    }

    setPlayerItem(item);
    setPlayerOpen(true);
    setPlayerSrc('');

    try {
      const query = `${item.title || item.name} ${(item.release_date || item.first_air_date || '').slice(0, 4)}`;
      console.log('Would search for:', query);

      // DEMO: Use a known working magnet for testing (Big Buck Bunny)
      const demoMagnet = 'magnet:?xt=urn:btih:d2474e86c95b19b8bcfdb92bc12c9d44667cfa36&dn=Big+Buck+Bunny';
      const streamUrl = await rdClient.getStreamUrl(demoMagnet);
      setPlayerSrc(streamUrl);
    } catch (e) {
      console.error('Failed to get stream:', e);
      alert(`Failed to get stream: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setPlayerOpen(false);
    }
  }, [rdClient]);

  const handleItemClick = useCallback((item: MediaItem) => {
    if (item.media_type === 'movie') {
      tmdb?.getMovieDetails(item.id, ['videos', 'credits', 'images']).then(setHeroItem);
    } else {
      tmdb?.getTVDetails(item.id, ['videos', 'credits', 'images']).then(setHeroItem);
    }
  }, [tmdb]);

  const handleSearchSelect = useCallback((item: MediaItem) => {
    setSearchOpen(false);
    handleItemClick(item);
  }, [handleItemClick]);

  const handleSearchPlay = useCallback((item: MediaItem) => {
    setSearchOpen(false);
    handlePlay(item);
  }, [handlePlay]);

  const handleCommand = useCallback((action: string) => {
    switch (action) {
      case 'search': setSearchOpen(true); break;
      case 'home': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'library': alert('Library coming soon'); break;
      case 'settings': setUserMenuOpen(true); break;
      case 'play': playerItem && handlePlay(playerItem); break;
    }
    setCommandOpen(false);
  }, [playerItem, handlePlay]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === '/' && !searchOpen) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setCommandOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // Refresh spatial nav when content loads
  useEffect(() => { refresh(); }, [loading, trendingMovies, trendingTV, genreRows, refresh]);

  // Render
  return (
    <div className="app">
      {/* Background atmosphere */}
      <div className="nimbus-bg" aria-hidden="true">
        <div className="nimbus-bg__float nimbus-bg__float--1" />
        <div className="nimbus-bg__float nimbus-bg__float--2" />
        <div className="nimbus-bg__float nimbus-bg__float--3" />
      </div>

      {/* Header */}
      <header className="glass" style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-glass)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--atlantic-400)" strokeWidth="2.5" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="tv-title-2" style={{ fontWeight: 800, background: 'linear-gradient(135deg, var(--atlantic-300), var(--amber-400))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Atlantic
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {['Movies', 'Series', 'Discover', 'Library'].map((label) => (
            <button
              key={label}
              className="btn btn-ghost tv-caption"
              data-focusable
              style={{ padding: '8px 16px' }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn btn-icon btn-glass"
            data-focusable
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
          <button
            className="btn btn-icon btn-glass"
            data-focusable
            onClick={() => setCommandOpen(true)}
            aria-label="Commands"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 17h8M12 17v4" />
            </svg>
          </button>
          {rdUser && (
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-icon btn-glass"
                data-focusable
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-label="User menu"
                aria-expanded={userMenuOpen}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              {userMenuOpen && (
                <div className="glass-panel" style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                  minWidth: '240px', padding: '16px', borderRadius: 'var(--radius-lg)',
                  display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 100
                }}>
                  <div className="tv-caption" style={{ color: 'var(--text-secondary)' }}>
                    {rdUser.username} • {rdUser.type}
                  </div>
                  <div className="tv-caption" style={{ color: 'var(--text-muted)' }}>
                    Expires: {new Date(rdUser.expiration).toLocaleDateString()}
                  </div>
                  <button className="btn btn-glass" data-focusable onClick={() => setUserMenuOpen(false)}>Close</button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="tv-safe" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div className="flex-center" style={{ height: '60vh' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--atlantic-400)" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <span className="tv-body" style={{ color: 'var(--text-secondary)' }}>Loading Atlantic...</span>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* Hero */}
            <HeroSection item={heroItem} onPlay={handlePlay} onMore={handleItemClick} />

            {/* Continue Watching */}
            {continueWatching.length > 0 && (
              <ContentRow
                title="Continue Watching"
                items={continueWatching}
                variant="backdrop"
                onItemClick={handleItemClick}
                onItemPlay={handlePlay}
              />
            )}

            {/* Trending Movies */}
            {trendingMovies.length > 0 && (
              <ContentRow
                title="Trending Movies"
                items={trendingMovies}
                variant="poster"
                onItemClick={handleItemClick}
                onItemPlay={handlePlay}
              />
            )}

            {/* Trending TV */}
            {trendingTV.length > 0 && (
              <ContentRow
                title="Trending Series"
                items={trendingTV}
                variant="poster"
                onItemClick={handleItemClick}
                onItemPlay={handlePlay}
              />
            )}

            {/* Genre Rows */}
            {GENRE_ROWS.slice(0, 6).map(({ id, name, emoji }) => (
              genreRows[id]?.length && (
                <ContentRow
                  key={id}
                  title={`${emoji} ${name}`}
                  items={genreRows[id]!}
                  variant="poster"
                  onItemClick={handleItemClick}
                  onItemPlay={handlePlay}
                />
              )
            ))}

            {/* Bottom padding for TV safe area */}
            <div style={{ height: '100px' }} />
          </>
        )}
      </main>

      {/* Overlays */}
      <Search
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
        onPlay={handleSearchPlay}
      />

      <CommandPalette
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        onAction={handleCommand}
      />

      {/* Player */}
      {playerOpen && playerSrc && playerItem && (
        <Player
          src={playerSrc}
          title={playerItem.title || playerItem.name}
          poster={playerItem.backdrop_path ? tmdb?.getBackdropUrl(playerItem.backdrop_path, 'w1280') : undefined}
          onClose={() => {
            setPlayerOpen(false);
            setPlayerSrc('');
            setPlayerItem(null);
          }}
          onError={(e) => {
            console.error('Player error:', e);
            setPlayerOpen(false);
          }}
          autoPlay={true}
        />
      )}

      {playerOpen && !playerSrc && playerItem && (
        <div className="player-overlay">
          <div className="glass-panel" style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            padding: '48px', textAlign: 'center', maxWidth: '480px', minWidth: '320px'
          }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--atlantic-400)" strokeWidth="2" style={{ marginBottom: '24px', animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <h2 className="tv-title-2" style={{ marginBottom: '8px' }}>Preparing Stream</h2>
            <p className="tv-body" style={{ color: 'var(--text-secondary)' }}>
              {playerItem.title || playerItem.name}
            </p>
            <p className="tv-caption" style={{ marginTop: '16px', color: 'var(--text-muted)' }}>
              Fetching from Real-Debrid...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {rdError && (
        <div className="glass-panel" style={{
          position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          padding: '16px 24px', borderRadius: 'var(--radius-lg)', zIndex: 100,
          borderColor: 'var(--amber-500)', background: 'rgba(255, 96, 86, 0.15)',
          display: 'flex', alignItems: 'center', gap: '16px'
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--amber-500)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="tv-body">{rdError}</span>
          <button className="btn btn-ghost" onClick={() => {}}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

export default App;