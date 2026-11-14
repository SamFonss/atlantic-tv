/* ==========================================================================
   TMDB API CLIENT
   The Movie Database API wrapper for metadata
   Docs: https://developers.themoviedb.org/3
   ========================================================================== */

export interface TMDBConfig {
  apiKey: string;
  baseUrl?: string;
  imageBaseUrl?: string;
  language?: string;
  region?: string;
}

export interface TMDBImageConfig {
  base_url: string;
  secure_base_url: string;
  backdrop_sizes: string[];
  logo_sizes: string[];
  poster_sizes: string[];
  profile_sizes: string[];
  still_sizes: string[];
}

export interface MediaItemBase {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  adult: boolean;
  media_type?: 'movie' | 'tv';
}

export interface Movie extends MediaItemBase {
  media_type: 'movie';
  title: string;
  original_title: string;
  release_date: string;
  video: boolean;
}

export interface TVShow extends MediaItemBase {
  media_type: 'tv';
  name: string;
  original_name: string;
  first_air_date: string;
  origin_country: string[];
}

export type MediaItem = Movie | TVShow;

export interface PaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface GenresResponse {
  genres: Genre[];
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: 'Trailer' | 'Teaser' | 'Clip' | 'Featurette' | 'Behind the Scenes' | 'Bloopers';
  official: boolean;
  published_at: string;
}

export interface VideosResponse {
  id: number;
  results: Video[];
}

export interface CreditsResponse {
  id: number;
  cast: CastMember[];
  crew: CrewMember[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface WatchProvidersResponse {
  id: number;
  results: Record<string, {
    link: string;
    flatrate?: WatchProvider[];
    rent?: WatchProvider[];
    buy?: WatchProvider[];
    free?: WatchProvider[];
  }>;
}

export interface ContentRatingsResponse {
  id: number;
  results: Array<{
    iso_3166_1: string;
    rating: string;
  }>;
}

export interface ImagesResponse {
  id: number;
  backdrops: ImageItem[];
  logos: ImageItem[];
  posters: ImageItem[];
}

export interface ImageItem {
  aspect_ratio: number;
  height: number;
  width: number;
  iso_639_1: string | null;
  file_path: string;
  vote_average: number;
  vote_count: number;
}

class TMDBClient {
  private apiKey: string;
  private baseUrl: string;
  private imageBaseUrl: string;
  private language: string;
  private region: string;
  private genreCache: Map<string, Genre[]> = new Map();
  private imageConfig: TMDBImageConfig | null = null;

  constructor(config: TMDBConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.themoviedb.org/3';
    this.imageBaseUrl = config.imageBaseUrl || 'https://image.tmdb.org/t/p';
    this.language = config.language || 'en-US';
    this.region = config.region || 'US';
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('language', this.language);
    if (this.region && !endpoint.includes('genre')) {
      url.searchParams.set('region', this.region);
    }
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const response = await fetch(url.toString());
    if (!response.ok) {
      const error = await response.json().catch(() => ({ status_message: 'Unknown error' }));
      throw new Error(`TMDB API error (${response.status}): ${error.status_message || response.statusText}`);
    }
    return response.json();
  }

  /* ========================================================================
     CONFIGURATION
     ======================================================================== */
  async getImageConfig(): Promise<TMDBImageConfig> {
    if (this.imageConfig) return this.imageConfig;
    const data = await this.request<{ images: TMDBImageConfig }>('/configuration');
    this.imageConfig = data.images;
    return this.imageConfig;
  }

  getImageUrl(path: string | null, size: string = 'w780'): string {
    if (!path) return '';
    return `${this.imageBaseUrl}/${size}${path}`;
  }

  getPosterUrl(path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string {
    return this.getImageUrl(path, size);
  }

  getBackdropUrl(path: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w780'): string {
    return this.getImageUrl(path, size);
  }

  getProfileUrl(path: string | null, size: 'w45' | 'w185' | 'h632' | 'original' = 'w185'): string {
    return this.getImageUrl(path, size);
  }

  /* ========================================================================
     GENRES
     ======================================================================== */
  async getMovieGenres(): Promise<Genre[]> {
    if (this.genreCache.has('movie')) return this.genreCache.get('movie')!;
    const data = await this.request<GenresResponse>('/genre/movie/list');
    this.genreCache.set('movie', data.genres);
    return data.genres;
  }

  async getTVGenres(): Promise<Genre[]> {
    if (this.genreCache.has('tv')) return this.genreCache.get('tv')!;
    const data = await this.request<GenresResponse>('/genre/tv/list');
    this.genreCache.set('tv', data.genres);
    return data.genres;
  }

  getGenreNames(genreIds: number[], type: 'movie' | 'tv' = 'movie'): string[] {
    const genres = this.genreCache.get(type) || [];
    return genreIds.map(id => genres.find(g => g.id === id)?.name).filter(Boolean) as string[];
  }

  /* ========================================================================
     DISCOVER / TRENDING / POPULAR
     ======================================================================== */
  async getTrending(type: 'all' | 'movie' | 'tv' | 'person' = 'all', timeWindow: 'day' | 'week' = 'week', page = 1): Promise<PaginatedResponse<MediaItem>> {
    return this.request<PaginatedResponse<MediaItem>>(`/trending/${type}/${timeWindow}`, { page: String(page) });
  }

  async getPopularMovies(page = 1): Promise<PaginatedResponse<Movie>> {
    return this.request<PaginatedResponse<Movie>>('/movie/popular', { page: String(page) });
  }

  async getPopularTV(page = 1): Promise<PaginatedResponse<TVShow>> {
    return this.request<PaginatedResponse<TVShow>>('/tv/popular', { page: String(page) });
  }

  async getNowPlaying(page = 1): Promise<PaginatedResponse<Movie>> {
    return this.request<PaginatedResponse<Movie>>('/movie/now_playing', { page: String(page) });
  }

  async getTopRatedMovies(page = 1): Promise<PaginatedResponse<Movie>> {
    return this.request<PaginatedResponse<Movie>>('/movie/top_rated', { page: String(page) });
  }

  async getTopRatedTV(page = 1): Promise<PaginatedResponse<TVShow>> {
    return this.request<PaginatedResponse<TVShow>>('/tv/top_rated', { page: String(page) });
  }

  async getAiringToday(page = 1): Promise<PaginatedResponse<TVShow>> {
    return this.request<PaginatedResponse<TVShow>>('/tv/airing_today', { page: String(page) });
  }

  async getOnTheAir(page = 1): Promise<PaginatedResponse<TVShow>> {
    return this.request<PaginatedResponse<TVShow>>('/tv/on_the_air', { page: String(page) });
  }

  /* ========================================================================
     DISCOVER BY GENRE
     ======================================================================== */
  async discoverMovies(options: {
    with_genres?: number | number[];
    sort_by?: 'popularity.desc' | 'vote_average.desc' | 'release_date.desc' | 'revenue.desc';
    vote_count_gte?: number;
    vote_average_gte?: number;
    with_watch_providers?: number;
    watch_region?: string;
    page?: number;
    include_adult?: boolean;
  } = {}): Promise<PaginatedResponse<Movie>> {
    const params: Record<string, string> = {
      include_adult: String(options.include_adult ?? false),
      page: String(options.page ?? 1),
      sort_by: options.sort_by || 'popularity.desc',
    };

    if (options.with_genres) {
      params.with_genres = Array.isArray(options.with_genres) ? options.with_genres.join(',') : String(options.with_genres);
    }
    if (options.vote_count_gte) params['vote_count.gte'] = String(options.vote_count_gte);
    if (options.vote_average_gte) params['vote_average.gte'] = String(options.vote_average_gte);
    if (options.with_watch_providers) params.with_watch_providers = String(options.with_watch_providers);
    if (options.watch_region) params.watch_region = options.watch_region;

    return this.request<PaginatedResponse<Movie>>('/discover/movie', params);
  }

  async discoverTV(options: {
    with_genres?: number | number[];
    sort_by?: 'popularity.desc' | 'vote_average.desc' | 'first_air_date.desc';
    vote_count_gte?: number;
    page?: number;
    include_adult?: boolean;
  } = {}): Promise<PaginatedResponse<TVShow>> {
    const params: Record<string, string> = {
      include_adult: String(options.include_adult ?? false),
      page: String(options.page ?? 1),
      sort_by: options.sort_by || 'popularity.desc',
    };

    if (options.with_genres) {
      params.with_genres = Array.isArray(options.with_genres) ? options.with_genres.join(',') : String(options.with_genres);
    }
    if (options.vote_count_gte) params['vote_count.gte'] = String(options.vote_count_gte);

    return this.request<PaginatedResponse<TVShow>>('/discover/tv', params);
  }

  /* ========================================================================
     SEARCH
     ======================================================================== */
  async searchMulti(query: string, page = 1): Promise<PaginatedResponse<MediaItem>> {
    return this.request<PaginatedResponse<MediaItem>>('/search/multi', { query, page: String(page) });
  }

  async searchMovies(query: string, page = 1): Promise<PaginatedResponse<Movie>> {
    return this.request<PaginatedResponse<Movie>>('/search/movie', { query, page: String(page) });
  }

  async searchTV(query: string, page = 1): Promise<PaginatedResponse<TVShow>> {
    return this.request<PaginatedResponse<TVShow>>('/search/tv', { query, page: String(page) });
  }

  /* ========================================================================
     DETAILS
     ======================================================================== */
  async getMovieDetails(id: number, append?: string[]): Promise<Movie & { genres: Genre[]; runtime: number; production_companies: any[] }> {
    const params: Record<string, string> = {};
    if (append?.length) params.append_to_response = append.join(',');
    return this.request(`/movie/${id}`, params);
  }

  async getTVDetails(id: number, append?: string[]): Promise<TVShow & { genres: Genre[]; episode_run_time: number[]; networks: any[] }> {
    const params: Record<string, string> = {};
    if (append?.length) params.append_to_response = append.join(',');
    return this.request(`/tv/${id}`, params);
  }

  async getMovieVideos(id: number): Promise<VideosResponse> {
    return this.request<VideosResponse>(`/movie/${id}/videos`);
  }

  async getTVVideos(id: number): Promise<VideosResponse> {
    return this.request<VideosResponse>(`/tv/${id}/videos`);
  }

  async getMovieCredits(id: number): Promise<CreditsResponse> {
    return this.request<CreditsResponse>(`/movie/${id}/credits`);
  }

  async getTVCredits(id: number): Promise<CreditsResponse> {
    return this.request<CreditsResponse>(`/tv/${id}/credits`);
  }

  async getMovieImages(id: number): Promise<ImagesResponse> {
    return this.request<ImagesResponse>(`/movie/${id}/images`);
  }

  async getTVImages(id: number): Promise<ImagesResponse> {
    return this.request<ImagesResponse>(`/tv/${id}/images`);
  }

  async getMovieWatchProviders(id: number): Promise<WatchProvidersResponse> {
    return this.request<WatchProvidersResponse>(`/movie/${id}/watch/providers`);
  }

  async getTVWatchProviders(id: number): Promise<WatchProvidersResponse> {
    return this.request<WatchProvidersResponse>(`/tv/${id}/watch/providers`);
  }

  async getMovieContentRatings(id: number): Promise<ContentRatingsResponse> {
    return this.request<ContentRatingsResponse>(`/movie/${id}/release_dates`);
  }

  async getTVContentRatings(id: number): Promise<ContentRatingsResponse> {
    return this.request<ContentRatingsResponse>(`/tv/${id}/content_ratings`);
  }

  async getSimilarMovies(id: number, page = 1): Promise<PaginatedResponse<Movie>> {
    return this.request<PaginatedResponse<Movie>>(`/movie/${id}/similar`, { page: String(page) });
  }

  async getSimilarTV(id: number, page = 1): Promise<PaginatedResponse<TVShow>> {
    return this.request<PaginatedResponse<TVShow>>(`/tv/${id}/similar`, { page: String(page) });
  }

  async getRecommendationsMovies(id: number, page = 1): Promise<PaginatedResponse<Movie>> {
    return this.request<PaginatedResponse<Movie>>(`/movie/${id}/recommendations`, { page: String(page) });
  }

  async getRecommendationsTV(id: number, page = 1): Promise<PaginatedResponse<TVShow>> {
    return this.request<PaginatedResponse<TVShow>>(`/tv/${id}/recommendations`, { page: String(page) });
  }

  /* ========================================================================
     WATCH PROVIDERS
     ======================================================================== */
  async getWatchProvidersMovie(): Promise<{ results: WatchProvider[] }> {
    return this.request('/watch/providers/movie');
  }

  async getWatchProvidersTV(): Promise<{ results: WatchProvider[] }> {
    return this.request('/watch/providers/tv');
  }
}

/* ==========================================================================
   SINGLETON & HOOK
   ========================================================================== */

let tmdbInstance: TMDBClient | null = null;

export function createTMDBClient(config: TMDBConfig): TMDBClient {
  tmdbInstance = new TMDBClient(config);
  return tmdbInstance;
}

export function getTMDBClient(): TMDBClient {
  if (!tmdbInstance) {
    throw new Error('TMDBClient not initialized. Call createTMDBClient() first.');
  }
  return tmdbInstance;
}

import { useState, useEffect, useCallback } from 'react';

export function useTMDB(apiKey?: string) {
  const [client, setClient] = useState<TMDBClient | null>(null);
  const [genresLoaded, setGenresLoaded] = useState(false);

  useEffect(() => {
    if (apiKey) {
      const c = createTMDBClient({ apiKey });
      setClient(c);
      // Preload genres
      Promise.all([c.getMovieGenres(), c.getTVGenres()]).then(() => setGenresLoaded(true));
    }
  }, [apiKey]);

  const search = useCallback(async (query: string) => {
    if (!client) return { results: [] };
    return client.searchMulti(query);
  }, [client]);

  const getTrending = useCallback(async (type: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'week') => {
    if (!client) return { results: [] };
    return client.getTrending(type, timeWindow);
  }, [client]);

  const discoverByGenre = useCallback(async (type: 'movie' | 'tv', genreId: number) => {
    if (!client) return { results: [] };
    return type === 'movie'
      ? client.discoverMovies({ with_genres: genreId, vote_count_gte: 200 })
      : client.discoverTV({ with_genres: genreId, vote_count_gte: 200 });
  }, [client]);

  return {
    client,
    genresLoaded,
    search,
    getTrending,
    discoverByGenre,
  };
}