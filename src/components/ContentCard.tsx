/* ==========================================================================
   CONTENT CARD — Poster / Backdrop / Square variants
   Uses open-glass-ui Glass component with SDF-based refraction
   ========================================================================== */

import { useFocusable } from '../hooks/useSpatialNavigation';
import type { MediaItem } from '../api/tmdb';
import { getTMDBClient } from '../api/tmdb';
import { Glass, useSdfFilter } from '@open-glass-ui/react';
import { getMaterialPreset } from '@open-glass-ui/core';
import type { LensGeometry } from '@open-glass-ui/core';
import { useMemo } from 'react';

interface ContentCardProps {
  item: MediaItem;
  variant?: 'poster' | 'backdrop' | 'square';
  onClick?: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
  className?: string;
}

const CARD_SIZES: Record<string, { width: number; height: number; radius: number }> = {
  poster: { width: 220, height: 330, radius: 16 },
  backdrop: { width: 400, height: 225, radius: 16 },
  square: { width: 280, height: 280, radius: 16 },
};

function getGeometry(variant: string): LensGeometry {
  const size = CARD_SIZES[variant] || CARD_SIZES.poster;
  return {
    kind: 'rounded-rect',
    width: size.width,
    height: size.height,
    cornerRadius: size.radius,
  };
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

  // Create SDF filter for refraction/distortion
  const geometry = useMemo(() => getGeometry(variant), [variant]);
  const filter = useSdfFilter({
    id: `card-${variant}-${item.id}`,
    width: geometry.width,
    height: geometry.height,
    geometry,
    material: getMaterialPreset('regular'),
    quality: 'medium',
  });

  const baseStyles = {
    width: geometry.width,
    height: geometry.height,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column' as const,
  } as const;

  return (
    <article
      ref={ref}
      className={className}
      role="button"
      tabIndex={0}
      aria-label={`${title}${year ? ` (${year})` : ''}, ${rating}/10${genreNames ? `, ${genreNames}` : ''}`}
      onClick={() => onClick?.(item)}
      onKeyDown={handleKeyDown}
      data-focusable
      style={baseStyles}
    >
      {/* Glass surface with refraction - the main card */}
      <Glass
        as="div"
        material="regular"
        look="liquid"
        geometry={geometry}
        filterId={filter.ready ? filter.filterId : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        interactive={true}
      >
        {filter.ready && <SdfFilterDefinition filter={filter} />}

        {/* Background image */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          {imageUrl ? (
            <img
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
              }}
              src={imageUrl}
              alt={`${title} poster`}
              loading="lazy"
            />
          ) : (
            <div className="skeleton skeleton--poster" style={{ width: '100%', height: '100%' }} aria-hidden="true" />
          )}
        </div>

        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60%',
            background: 'linear-gradient(to top, rgba(10,10,15,0.95), transparent)',
            zIndex: 1,
          }}
          aria-hidden="true"
        />

        {/* Content overlay */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            padding: '16px',
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <h3 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            lineHeight: 1.3,
            color: 'var(--ogui-color-text)',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {year && <span style={{ fontSize: '0.75rem', color: 'var(--ogui-color-text-secondary)' }}>{year}</span>}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'var(--ogui-color-text)',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {rating}
            </span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'var(--ogui-color-text)',
            }}>
              {isMovie ? 'Movie' : 'Series'}
            </span>
          </div>
        </div>
      </Glass>

      {/* Focus ring - separate element for TV focus */}
      <div
        style={{
          position: 'absolute',
          inset: -4,
          borderRadius: (geometry.cornerRadius ?? 16) + 4,
          border: '3px solid var(--ogui-color-accent)',
          opacity: 0,
          transition: 'opacity 0.15s ease',
          pointerEvents: 'none',
          zIndex: 10,
        }}
        className="focus-ring"
        aria-hidden="true"
      />
    </article>
  );
}

// Need to import SdfFilterDefinition
import { SdfFilterDefinition } from '@open-glass-ui/react';

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

  // Hero geometry - larger for featured content
  const heroGeometry = useMemo<LensGeometry>(() => ({
    kind: 'rounded-rect',
    width: 1280,
    height: 720,
    cornerRadius: 24,
  }), []);

  const heroFilter = useSdfFilter({
    id: `hero-${item.id}`,
    width: 1280,
    height: 720,
    geometry: heroGeometry,
    material: getMaterialPreset('regular'),
    quality: 'medium',
  });

  return (
    <section
      ref={ref}
      className={className}
      role="region"
      aria-label={`${title} - Featured`}
      onKeyDown={handleKeyDown}
      data-focusable
      style={{
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      <Glass
        as="div"
        material="regular"
        look="lensed" // Stronger refraction for hero
        geometry={heroGeometry}
        filterId={heroFilter.ready ? heroFilter.filterId : undefined}
        style={{
          position: 'relative',
          width: '100%',
          height: '720px',
          minHeight: '720px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        interactive={true}
      >
        {heroFilter.ready && <SdfFilterDefinition filter={heroFilter} />}

        {/* Background image */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          {backdropPath ? (
            <img
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
              src={tmdb.getBackdropUrl(backdropPath, 'w1280')}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <div className="skeleton skeleton--backdrop" style={{ width: '100%', height: '100%' }} aria-hidden="true" />
          )}
        </div>

        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background: 'linear-gradient(to top, rgba(10,10,15,0.98) 0%, rgba(10,10,15,0.6) 40%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            padding: '48px 64px',
            marginTop: 'auto',
            maxWidth: '800px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            {year && <span className="badge glass-subtle" style={{ fontSize: '0.875rem', padding: '6px 14px' }}>{year}</span>}
            <span className="badge glass-subtle" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', padding: '6px 14px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {rating}
            </span>
            {runtime && <span className="badge glass-subtle" style={{ fontSize: '0.875rem', padding: '6px 14px' }}>{runtime}</span>}
            <span className="badge glass-subtle" style={{ fontSize: '0.875rem', padding: '6px 14px' }}>
              {'title' in item ? 'Movie' : 'Series'}
            </span>
          </div>

          <h1 style={{
            margin: 0,
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            color: 'var(--ogui-color-text)',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            maxWidth: '90%',
          }}>
            {title}
          </h1>

          {genres && (
            <div style={{ fontSize: '1rem', color: 'var(--ogui-color-text-secondary)', maxWidth: '90%' }}>
              {genres}
            </div>
          )}

          <p style={{
            margin: 0,
            fontSize: '1.125rem',
            lineHeight: 1.6,
            color: 'var(--ogui-color-text-secondary)',
            maxWidth: '700px',
          }}>
            {overview}
          </p>

          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 32px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--ogui-color-accent)',
                color: 'var(--ogui-color-accent-contrast)',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'transform 0.1s ease, filter 0.1s ease',
              }}
              onClick={() => onPlay?.(item)}
              aria-label={`Play ${title}`}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 32px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--ogui-color-text)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(20px)',
                transition: 'background 0.15s ease',
              }}
              onClick={() => onMore?.(item)}
              aria-label={`More info about ${title}`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              More Info
            </button>
          </div>
        </div>
      </Glass>
    </section>
  );
}