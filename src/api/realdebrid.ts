/* ==========================================================================
   REAL-DEBRID API CLIENT
   Lightweight wrapper for Real-Debrid REST API
   Docs: https://api.real-debrid.com/
   ========================================================================== */

export interface RealDebridConfig {
  token: string;
  baseUrl?: string;
}

export interface TorrentInfo {
  id: string;
  filename: string;
  hash: string;
  bytes: number;
  original_filename: string;
  host: string;
  split: number;
  progress: number;
  status: 'magnet_conversion' | 'waiting_files_selection' | 'queued' | 'downloading' | 'compressed' | 'error' | 'finished';
  added: string;
  files: TorrentFile[];
  links: string[];
  ended?: string;
  speed?: number;
  seeders?: number;
}

export interface TorrentFile {
  id: number;
  path: string;
  bytes: number;
  selected: boolean;
}

export interface UnrestrictLinkResponse {
  id: string;
  filename: string;
  download: string;
  streamable: 0 | 1;
  host: string;
  size: number;
  chunks?: number;
  crc?: string;
}

export interface AvailableHost {
  host: string;
  domains: string[];
  direct: boolean;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  points: number;
  type: 'premium' | 'free';
  expiration: string;
  locale: string;
  avatar: string;
}

class RealDebridClient {
  private token: string;
  private baseUrl: string;

  constructor(config: RealDebridConfig) {
    this.token = config.token;
    this.baseUrl = config.baseUrl || 'https://api.real-debrid.com/rest/1.0';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Real-Debrid API error (${response.status}): ${error.error || response.statusText}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  /* ========================================================================
     USER
     ======================================================================== */
  async getUser(): Promise<UserInfo> {
    return this.request<UserInfo>('/user');
  }

  /* ========================================================================
     TORRENTS
     ======================================================================== */
  async addMagnet(magnet: string): Promise<TorrentInfo> {
    return this.request<TorrentInfo>('/torrents/addMagnet', {
      method: 'POST',
      body: JSON.stringify({ magnet }),
    });
  }

  async addTorrent(file: File): Promise<TorrentInfo> {
    const formData = new FormData();
    formData.append('torrent', file);
    return this.request<TorrentInfo>('/torrents/addTorrent', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    } as RequestInit);
  }

  async selectFiles(torrentId: string, fileIds: 'all' | number[]): Promise<void> {
    const files = fileIds === 'all' ? 'all' : fileIds.join(',');
    await this.request(`/torrents/selectFiles/${torrentId}`, {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  }

  async getTorrents(page = 1, limit = 50): Promise<TorrentInfo[]> {
    return this.request<TorrentInfo[]>(`/torrents?page=${page}&limit=${limit}`);
  }

  async getTorrentInfo(torrentId: string): Promise<TorrentInfo> {
    return this.request<TorrentInfo>(`/torrents/info/${torrentId}`);
  }

  async deleteTorrent(torrentId: string): Promise<void> {
    await this.request(`/torrents/delete/${torrentId}`, { method: 'DELETE' });
  }

  async getActiveCount(): Promise<{ waiting: number; downloading: number; finished: number; error: number }> {
    return this.request('/torrents/activeCount');
  }

  /* ========================================================================
     UNRESTRICT / STREAMING
     ======================================================================== */
  async unrestrictLink(link: string): Promise<UnrestrictLinkResponse> {
    return this.request<UnrestrictLinkResponse>('/unrestrict/link', {
      method: 'POST',
      body: JSON.stringify({ link }),
    });
  }

  async checkHost(host: string): Promise<{ host: string; status: boolean }> {
    return this.request(`/unrestrict/checkHost`, {
      method: 'POST',
      body: JSON.stringify({ host }),
    });
  }

  /* ========================================================================
     AVAILABLE HOSTS
     ======================================================================== */
  async getAvailableHosts(): Promise<AvailableHost[]> {
    return this.request<AvailableHost[]>('/hosts/domains');
  }

  async getSupportedHosts(): Promise<Record<string, string[]>> {
    return this.request('/hosts');
  }

  /* ========================================================================
     HELPERS FOR STREAMING
     ======================================================================== */

  /**
   * Get a direct streamable URL for a torrent file
   * Flow: add magnet -> wait for cached/finished -> select file -> unrestrict link
   */
  async getStreamUrl(magnet: string, fileIndex?: number): Promise<string> {
    // Add magnet
    const torrent = await this.addMagnet(magnet);

    // If already finished (cached), select files immediately
    if (torrent.status === 'finished') {
      return this.getStreamUrlFromFinished(torrent, fileIndex);
    }

    // Poll for completion
    return this.waitForTorrentAndStream(torrent.id, fileIndex);
  }

  private async getStreamUrlFromFinished(torrent: TorrentInfo, fileIndex?: number): Promise<string> {
    const files = torrent.files.filter(f => f.selected);
    if (files.length === 0) {
      // Auto-select video files
      const videoFiles = torrent.files.filter(f =>
        /\.(mkv|mp4|avi|mov|webm|m4v|ts)$/i.test(f.path)
      );
      if (videoFiles.length > 0) {
        const ids = videoFiles.map(f => f.id);
        await this.selectFiles(torrent.id, ids);
        // Re-fetch torrent info
        const updated = await this.getTorrentInfo(torrent.id);
        return this.getStreamUrlFromFinished(updated, fileIndex);
      }
      throw new Error('No video files found in torrent');
    }

    // Pick file
    let targetFile = files[0];
    if (fileIndex !== undefined && files[fileIndex]) {
      targetFile = files[fileIndex];
    } else {
      // Pick largest video file
      const videoFiles = files.filter(f => /\.(mkv|mp4|avi|mov|webm|m4v|ts)$/i.test(f.path));
      if (videoFiles.length > 0) {
        targetFile = videoFiles.reduce((a, b) => a.bytes > b.bytes ? a : b);
      }
    }

    const link = torrent.links[targetFile.id - 1];
    if (!link) throw new Error('No link available for selected file');

    const unrestricted = await this.unrestrictLink(link);
    return unrestricted.download;
  }

  private async waitForTorrentAndStream(torrentId: string, fileIndex?: number, maxWaitMs = 300000): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 3000;

    while (Date.now() - startTime < maxWaitMs) {
      const torrent = await this.getTorrentInfo(torrentId);

      if (torrent.status === 'finished') {
        return this.getStreamUrlFromFinished(torrent, fileIndex);
      }

      if (torrent.status === 'error') {
        throw new Error(`Torrent error: ${torrent.filename}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Torrent did not finish in time');
  }

  /**
   * Get stream URL from already added torrent (by hash or ID)
   */
  async getStreamUrlFromHash(hash: string, fileIndex?: number): Promise<string> {
    const torrents = await this.getTorrents(1, 100);
    const existing = torrents.find(t => t.hash.toLowerCase() === hash.toLowerCase());

    if (existing) {
      if (existing.status === 'finished') {
        return this.getStreamUrlFromFinished(existing, fileIndex);
      }
      return this.waitForTorrentAndStream(existing.id, fileIndex);
    }

    // Not found, add as magnet
    return this.getStreamUrl(`magnet:?xt=urn:btih:${hash}`, fileIndex);
  }
}

/* ==========================================================================
   SINGLETON INSTANCE (configure once in your app)
   ========================================================================== */

let clientInstance: RealDebridClient | null = null;

export function createRealDebridClient(config: RealDebridConfig): RealDebridClient {
  clientInstance = new RealDebridClient(config);
  return clientInstance;
}

export function getRealDebridClient(): RealDebridClient {
  if (!clientInstance) {
    throw new Error('RealDebridClient not initialized. Call createRealDebridClient() first.');
  }
  return clientInstance;
}

/* ==========================================================================
   REACT HOOK
   ========================================================================== */
import { useState, useEffect, useCallback } from 'react';

export function useRealDebrid(token?: string) {
  const [client, setClient] = useState<RealDebridClient | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      const c = createRealDebridClient({ token });
      setClient(c);
      // Verify token
      c.getUser().then(setUser).catch(e => setError(e.message));
    }
  }, [token]);

  const addMagnet = useCallback(async (magnet: string) => {
    if (!client) throw new Error('Client not initialized');
    setLoading(true);
    setError(null);
    try {
      return await client.addMagnet(magnet);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add magnet');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [client]);

  const getStreamUrl = useCallback(async (magnet: string, fileIndex?: number) => {
    if (!client) throw new Error('Client not initialized');
    setLoading(true);
    setError(null);
    try {
      return await client.getStreamUrl(magnet, fileIndex);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get stream URL');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [client]);

  const getTorrents = useCallback(async () => {
    if (!client) return [];
    setLoading(true);
    try {
      return await client.getTorrents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch torrents');
      return [];
    } finally {
      setLoading(false);
    }
  }, [client]);

  return {
    client,
    user,
    loading,
    error,
    addMagnet,
    getStreamUrl,
    getTorrents,
  };
}