/* ==========================================================================
   CONTENT CARD — Poster / Backdrop / Square variants
   Focusable, animated, glass-morphism with distortion/refraction
   ========================================================================== */

import { useFocusable } from '../hooks/useSpatialNavigation';
import type { MediaItem } from '../api/tmdb';
import { getTMDBClient } from '../api/tmdb';

interface ContentCardProps {
  item: MediaItem;
  variant?: 'poster' | 'backdrop' | 'square';
  onClick?: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
  className?: string;
}

export function ContentCard({ item, variant = 'poster', onClick, onPlay, className = '' }: ContentCardProps) {
  const tmdb = getTMDBClient();
  const ref = useFocusable({});

  const title = item.title || item.name || 'Unknown';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const rating = item.vote_average?.toFixed(1) || '—';
  const posterPath = item.poster_path;
  const backdropPath = item.backdrop_path;

  const imageUrl = variant === 'backdrop' && backdropPath
    ? tmdb.getBackdropUrl(backdropPath, 'w780')
    : posterPath
      ? tmdb.getPosterUrl(posterPath, variant === 'poster' ? 'w342' : 'w500')
      : '';

  const isMovie = item.media_type === 'movie' || 'title' in item;

  // Genres from detailed response
  const genreNames = ('genres' in item && item.genres && Array.isArray(item.genres))
    ? item.genres.map((g: { name: string }) => g.name).slice(0, 2).join(' • ')
    : (item.genre_ids && tmdb.getGenreNames(item.genre_ids, item.media_type || 'movie').slice(0, 2).join(' • ')) || '';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(item);
    }
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      onPlay?.(item);
    }
  };

  const classNames = [
    'content-card',
    `content-card--${variant}`,
    'glass-liquid distort-medium refract-normal ca-medium',
    className,
  ].filter(Boolean).join(' ');

  return (
    <article
      ref={ref}
      className={classNames}
      role="button"
      tabIndex={0}
      aria-label={`${title}${year ? ` (${year})` : ''}, ${rating}/10${genreNames ? `, ${genreNames}` : ''}`}
      onClick={() => onClick?.(item)}
      onKeyDown={handleKeyDown}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
        e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.setProperty('--mouse-x', '50%');
        e.currentTarget.style.setProperty('--mouse-y', '50%');
      }}
    >
      {imageUrl ? (
        <img
          className="content-card__image"
          src={imageUrl}
          alt={`${title} poster`}
          loading="lazy"
        />
      ) : (
        <div className="content-card__image skeleton skeleton--poster" aria-hidden="true" />
      )}

      <div className="content-card__overlay glass-frosted">
        <h3 className="content-card__title">{title}</h3>
        <div className="content-card__meta">
          {year && <span>{year}</span>}
          <span className="content-card__badge glass-subtle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {rating}
          </span>
          {isMovie ? (
            <span className="content-card__badge glass-subtle">Movie</span>
          ) : (
            <span className="content-card__badge glass-subtle">Series</span>
          )}
        </div>
      </div>

      <div className="focus-ring" aria-hidden="true" />
    </article>
  );
}

/* ==========================================================================
   HERO CARD — Large featured content
   ========================================================================== */

interface HeroCardProps {
  item: MediaItem & { genres?: { name: string }[]; runtime?: number; episode_run_time?: number[] };
  onPlay?: (item: MediaItem) => void;
  onMore?: (item: MediaItem) => void;
  className?: string;
}

export function HeroCard({ item, onPlay, onMore, className = '' }: HeroCardProps) {
  const tmdb = getTMDBClient();
  const ref = useFocusable({});

  const title = item.title || item.name || 'Unknown';
  const overview = item.overview || 'No description available.';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const rating = item.vote_average?.toFixed(1) || '—';
  const runtime = 'runtime' in item && item.runtime
    ? `${item.runtime}min`
    : 'episode_run_time' in item && item.episode_run_time?.[0]
      ? `${item.episode_run_time[0]}min`
      : '';
  const genres = item.genres?.map(g => g.name).slice(0, 3).join(' • ') ||
                 (item.genre_ids && tmdb.getGenreNames(item.genre_ids, item.media_type || 'movie').slice(0, 3).join(' • ')) ||
                 '';
  const backdropPath = item.backdrop_path;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlay?.(item);
    }
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      onMore?.(item);
    }
  };

  return (
    <section
      ref={ref}
      className={`hero glass-caustic caustics-subtle ${className}`}
      role="region"
      aria-label={`${title} - Featured`}
      onKeyDown={handleKeyDown}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
        e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.setProperty('--mouse-x', '50%');
        e.currentTarget.style.setProperty('--mouse-y', '50%');
      }}
    >
      {backdropPath ? (
        <img
          className="hero__background"
          src={tmdb.getBackdropUrl(backdropPath, 'w1280')}
          alt=""
          aria-hidden="true"
        />
      ) : (
        <div className="hero__background skeleton skeleton--backdrop" aria-hidden="true" />
      )}

      <div className="hero__gradient glass-liquid" aria-hidden="true" />

      <div className="hero__content glass-refractive">
        <div className="hero__badges">
          {year && <span className="content-card__badge glass-subtle">{year}</span>}
          <span className="content-card__badge glass-subtle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {rating}
          </span>
          {runtime && <span className="content-card__badge glass-subtle">{runtime}</span>}
          {'title' in item ? (
            <span className="content-card__badge glass-subtle">Movie</span>
          ) : (
            <span className="content-card__badge glass-subtle">Series</span>
          )}
        </div>

        <h1 className="hero__title">{title}</h1>

        {genres && (
          <div className="hero__meta tv-caption" style={{ marginBottom: '16px' }}>
            {genres}
          </div>
        )}

        <p className="hero__meta tv-body" style={{ maxWidth: '700px', marginBottom: '24px', color: 'var(--text-secondary)' }}>
          {overview}
        </p>

        <div className="hero__actions">
          <button
            className="btn btn-primary glass-prism"
            onClick={() => onPlay?.(item)}
            aria-label={`Play ${title}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play
          </button>
          <button
            className="btn btn-glass glass-refractive"
            onClick={() => onMore?.(item)}
            aria-label={`More info about ${title}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            More Info
          </button>
        </div>
      </div>
    </section>
  );
}