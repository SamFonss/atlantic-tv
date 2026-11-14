/* ==========================================================================
   CONTENT ROW — Horizontal scrolling row of content cards
   ========================================================================== */

import { useFocusable } from '../hooks/useSpatialNavigation';
import { ContentCard } from './ContentCard';
import type { MediaItem } from '../api/tmdb';

interface ContentRowProps {
  title: string;
  items: MediaItem[];
  variant?: 'poster' | 'backdrop' | 'square';
  onItemClick?: (item: MediaItem) => void;
  onItemPlay?: (item: MediaItem) => void;
  onSeeAll?: () => void;
  className?: string;
  skeletonCount?: number;
}

interface SkeletonItem {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  adult: boolean;
  media_type: 'movie' | 'tv';
  __skeleton?: true;
}

function createSkeletonItem(index: number): SkeletonItem {
  return {
    id: -index - 1,
    title: '',
    overview: '',
    poster_path: null,
    backdrop_path: null,
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    genre_ids: [],
    adult: false,
    media_type: 'movie',
    __skeleton: true,
  };
}

export function ContentRow({
  title,
  items,
  variant = 'poster',
  onItemClick,
  onItemPlay,
  onSeeAll,
  className = '',
  skeletonCount = 8,
}: ContentRowProps) {
  const ref = useFocusable({});
  const isLoading = items.length === 0;

  const cards = isLoading
    ? Array.from({ length: skeletonCount }, (_, i) => (
        <ContentCard
          key={`skeleton-${i}`}
          item={createSkeletonItem(i) as MediaItem}
          variant={variant}
        />
      ))
    : items.map((item) => (
        <ContentCard
          key={`${item.media_type}-${item.id}`}
          item={item}
          variant={variant}
          onClick={onItemClick}
          onPlay={onItemPlay}
        />
      ));

  return (
    <section ref={ref} className={`section ${className}`} aria-labelledby={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`}>
      <div className="section__header glass-subtle" style={{ padding: '8px 16px', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 id={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`} className="section__title tv-title-3">
          {title}
        </h2>
        {onSeeAll && (
          <button
            className="section__action btn-ghost tv-caption glass-refractive"
            onClick={onSeeAll}
            aria-label={`See all ${title}`}
          >
            See all
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ marginLeft: '4px', verticalAlign: 'middle' }}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      <div className="tv-row" role="list" aria-label={title}>
        {cards}
      </div>
    </section>
  );
}

/* ==========================================================================
   HERO SECTION — Full-width featured content
   ========================================================================== */

import { HeroCard } from './ContentCard';

interface HeroSectionProps {
  item: MediaItem | null;
  onPlay?: (item: MediaItem) => void;
  onMore?: (item: MediaItem) => void;
  className?: string;
}

export function HeroSection({ item, onPlay, onMore, className = '' }: HeroSectionProps) {
  if (!item) {
    return (
      <section className={`hero skeleton skeleton--backdrop ${className}`} aria-hidden="true" style={{ minHeight: '400px' }} />
    );
  }

  return (
    <section className={`section ${className}`}>
      <HeroCard item={item} onPlay={onPlay} onMore={onMore} className="glass-caustic caustics-subtle" />
    </section>
  );
}