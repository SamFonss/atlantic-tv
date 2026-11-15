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
import { AtlanticGlassProvider } from './components/GlassProvider';
import { Glass } from '@open-glass-ui/react';
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

  // Demo data for when no API key is configured
  const getDemoData = useCallback(() => {
    const demoMovies: MediaItem[] = [
      { id: 1, title: 'The Matrix', original_title: 'The Matrix', overview: 'A computer hacker learns about the true nature of reality.', poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', backdrop_path: '/ncE7wAeL2dH5pQgDqhhpjrJ3YbB.jpg', vote_average: 8.7, vote_count: 25000, popularity: 150, genre_ids: [28, 878], adult: false, media_type: 'movie', release_date: '1999-03-31', video: false },
      { id: 2, title: 'Inception', original_title: 'Inception', overview: 'A thief who steals corporate secrets through dream-sharing technology.', poster_path: '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', backdrop_path: '/s3TBrRGB1iav7gFOCNx3H31MoES.jpg', vote_average: 8.8, vote_count: 30000, popularity: 140, genre_ids: [28, 878, 53], adult: false, media_type: 'movie', release_date: '2010-07-15', video: false },
      { id: 3, title: 'Interstellar', original_title: 'Interstellar', overview: 'A team of explorers travel through a wormhole in space.', poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', backdrop_path: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg', vote_average: 8.6, vote_count: 28000, popularity: 130, genre_ids: [12, 18, 878], adult: false, media_type: 'movie', release_date: '2014-11-05', video: false },
      { id: 4, title: 'The Dark Knight', original_title: 'The Dark Knight', overview: 'Batman faces the Joker in this crime thriller.', poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', backdrop_path: '/hqkIcbrOHL86UncnHIsHVcVmzue.jpg', vote_average: 9.0, vote_count: 35000, popularity: 160, genre_ids: [28, 80, 18], adult: false, media_type: 'movie', release_date: '2008-07-18', video: false },
      { id: 5, title: 'Pulp Fiction', original_title: 'Pulp Fiction', overview: 'The lives of two mob hitmen, a boxer, and others intertwine.', poster_path: '/d5iIlFn5s0ImszYzBPb8JPIfbX.jpg', backdrop_path: '/mteyOYgmJpKxKz1Z4vz4vz4vz4v.jpg', vote_average: 8.9, vote_count: 22000, popularity: 120, genre_ids: [80, 18], adult: false, media_type: 'movie', release_date: '1994-10-14', video: false },
      { id: 6, title: 'Fight Club', original_title: 'Fight Club', overview: 'An insomniac office worker forms an underground fight club.', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', backdrop_path: '/8uO0gL8ZxJjL8Z8Z8Z8Z8Z8Z8Z8.jpg', vote_average: 8.8, vote_count: 24000, popularity: 110, genre_ids: [18], adult: false, media_type: 'movie', release_date: '1999-10-15', video: false },
      { id: 7, title: 'Forrest Gump', original_title: 'Forrest Gump', overview: 'The presidencies of Kennedy and Johnson through the eyes of an Alabama man.', poster_path: '/arw2vcBveWOVZr6Zd9Dd9f4k4k4.jpg', backdrop_path: '/k4k4k4k4k4k4k4k4k4k4k4k4k4k.jpg', vote_average: 8.8, vote_count: 20000, popularity: 100, genre_ids: [18, 35], adult: false, media_type: 'movie', release_date: '1994-07-06', video: false },
      { id: 8, title: 'The Shawshank Redemption', original_title: 'The Shawshank Redemption', overview: 'Two imprisoned men bond over a number of years.', poster_path: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', backdrop_path: '/x333333333333333333333333333.jpg', vote_average: 9.3, vote_count: 30000, popularity: 170, genre_ids: [18], adult: false, media_type: 'movie', release_date: '1994-09-23', video: false },
    ];
    const demoTV: MediaItem[] = [
      { id: 101, name: 'Breaking Bad', original_name: 'Breaking Bad', overview: 'A chemistry teacher turns to manufacturing meth.', poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', backdrop_path: '/tsRy63Mu5Cu8etL1X7ZLyf7UP1M.jpg', vote_average: 9.5, vote_count: 15000, popularity: 200, genre_ids: [80, 18, 53], adult: false, media_type: 'tv', first_air_date: '2008-01-20', origin_country: ['US'] },
      { id: 102, name: 'Game of Thrones', original_name: 'Game of Thrones', overview: 'Nine noble families fight for control of the Iron Throne.', poster_path: '/u3bZgnGQ9T01sW1yeve3w3w3w3w3w3w3.jpg', backdrop_path: '/suopoADq0k8YZr4dQXcU6pZT6Zw.jpg', vote_average: 9.3, vote_count: 18000, popularity: 190, genre_ids: [10765, 18, 10759], adult: false, media_type: 'tv', first_air_date: '2011-04-17', origin_country: ['US'] },
      { id: 103, name: 'Stranger Things', original_name: 'Stranger Things', overview: 'Kids encounter supernatural forces in 1980s Indiana.', poster_path: '/49WJfeN0moxb9IPfGn8ZqZqZqZqZqZqZ.jpg', backdrop_path: '/56YOx7YqZ4Z4Z4Z4Z4Z4Z4Z4Z4Z4.jpg', vote_average: 8.7, vote_count: 12000, popularity: 180, genre_ids: [10765, 18, 9648], adult: false, media_type: 'tv', first_air_date: '2016-07-15', origin_country: ['US'] },
      { id: 104, name: 'The Crown', original_name: 'The Crown', overview: 'The reign of Queen Elizabeth II.', poster_path: '/6tG9uJxJxJxJxJxJxJxJxJxJxJxJx.jpg', backdrop_path: '/crown444444444444444444444444.jpg', vote_average: 8.6, vote_count: 8000, popularity: 100, genre_ids: [18, 36], adult: false, media_type: 'tv', first_air_date: '2016-11-04', origin_country: ['GB'] },
    ];
    const demoGenres: Record<number, MediaItem[]> = {};
    GENRE_ROWS.slice(0, 6).forEach(({ id }) => {
      demoGenres[id] = [...demoMovies.slice(0, 5), ...demoTV.slice(0, 3)].sort((a, b) => b.popularity - a.popularity);
    });
    return { demoMovies, demoTV, demoGenres };
  }, []);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      if (!tmdb) {
        // No API key - use demo data
        const { demoMovies, demoTV, demoGenres } = getDemoData();
        setTrendingMovies(demoMovies);
        setTrendingTV(demoTV);
        setGenreRows(demoGenres);
        setHeroItem(demoMovies[0]);
        setLoading(false);
        return;
      }
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
    <AtlanticGlassProvider>
      <div className="app">
      {/* Background atmosphere */}
      <div className="nimbus-bg" aria-hidden="true">
        <div className="nimbus-bg__float nimbus-bg__float--1" />
        <div className="nimbus-bg__float nimbus-bg__float--2" />
        <div className="nimbus-bg__float nimbus-bg__float--3" />
      </div>

      {/* Header */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          padding: '16px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--ogui-color-border)',
        }}
      >
        <Glass
          as="div"
          material="regular"
          look="lensed"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 32px',
            zIndex: 1,
          }}
          interactive={true}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--ogui-color-accent)" strokeWidth="2.5" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span style={{ fontWeight: 800, background: 'linear-gradient(135deg, var(--ogui-color-accent), var(--ogui-color-accent-muted))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: 'clamp(1.5rem, 2.5vw, 2rem)' }}>
              Atlantic
            </span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {['Movies', 'Series', 'Discover', 'Library'].map((label) => (
              <button
                key={label}
                style={{
                  padding: '8px 16px',
                  borderRadius: '999px',
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'var(--ogui-color-text-secondary)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'color 0.15s ease, background 0.15s ease, border-color 0.15s ease',
                }}
                data-focusable
                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--ogui-color-text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--ogui-color-text-secondary)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                {label}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--ogui-color-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.1s ease, border-color 0.1s ease',
              }}
              data-focusable
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
            <button
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--ogui-color-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.1s ease, border-color 0.1s ease',
              }}
              data-focusable
              onClick={() => setCommandOpen(true)}
              aria-label="Commands"
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 17h8M12 17v4" />
              </svg>
            </button>
            {rdUser && (
              <div style={{ position: 'relative' }}>
                <button
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--ogui-color-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease, border-color 0.1s ease',
                  }}
                  data-focusable
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </button>
                {userMenuOpen && (
                  <Glass
                    as="div"
                    material="frosted"
                    look="frosted"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      minWidth: '240px',
                      padding: '16px',
                      borderRadius: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      zIndex: 100,
                    }}
                    interactive={true}
                  >
                    <div style={{ fontSize: '0.875rem', color: 'var(--ogui-color-text-secondary)' }}>
                      {rdUser.username} • {rdUser.type}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--ogui-color-text-muted)' }}>
                      Expires: {new Date(rdUser.expiration).toLocaleDateString()}
                    </div>
                    <button
                      style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--ogui-color-text)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                      data-focusable
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Close
                    </button>
                  </Glass>
                )}
              </div>
            )}
          </div>
        </Glass>
      </header>

      {/* Main Content */}
      <main className="tv-safe" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <Glass
              as="div"
              material="frosted"
              look="frosted"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                padding: '48px 64px',
                borderRadius: '24px',
              }}
            >
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--ogui-color-accent)" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <span style={{ fontSize: '1.125rem', color: 'var(--ogui-color-text-secondary)' }}>Loading Atlantic...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </Glass>
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
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'rgba(10, 10, 15, 0.95)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Glass
            as="div"
            material="frosted"
            look="frosted"
            style={{
              padding: '48px',
              textAlign: 'center',
              maxWidth: '480px',
              minWidth: '320px',
              borderRadius: '24px',
            }}
          >
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--ogui-color-accent)" strokeWidth="2" style={{ marginBottom: '24px', animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.75rem', fontWeight: 700, color: 'var(--ogui-color-text)' }}>Preparing Stream</h2>
            <p style={{ margin: '0 0 16px', fontSize: '1.125rem', color: 'var(--ogui-color-text-secondary)' }}>
              {playerItem.title || playerItem.name}
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ogui-color-text-muted)' }}>
              Fetching from Real-Debrid...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </Glass>
        </div>
      )}

      {/* Error Banner */}
      {rdError && (
        <Glass
          as="div"
          material="regular"
          look="smoked"
          style={{
            position: 'fixed',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '16px 24px',
            borderRadius: '16px',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid var(--ogui-color-accent-amber)',
          }}
          interactive={true}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ogui-color-accent-amber)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontSize: '1rem', color: 'var(--ogui-color-text)' }}>{rdError}</span>
          <button
            style={{
              padding: '8px 16px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--ogui-color-text)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.1s ease',
            }}
            onClick={() => {}}
          >
            Dismiss
          </button>
        </Glass>
      )}
    </div>
    </AtlanticGlassProvider>
  );
}

export default App;