/* ═══════════════════════════════════════════════════════════
   VIBE_ON — API Client
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BASE = '';  // same origin

  async function request(path, opts = {}) {
    try {
      const res = await fetch(BASE + path, {
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        ...opts,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (e) {
      console.warn('[API]', path, e.message);
      throw e;
    }
  }

  window.API = {
    // Status
    status: () => request('/api/status'),

    // Home
    homeCategories:  ()     => request('/api/home/categories'),
    homeCategory:    (cat)  => request(`/api/home/${cat}`),

    // Search
    search:      (q, max = 20) => request(`/api/search?q=${encodeURIComponent(q)}&max=${max}`),
    suggestions: (q)           => request(`/api/suggestions?q=${encodeURIComponent(q)}`),

    // Song info
    info: (videoId) => request(`/api/info/${videoId}`),

    // Lyrics
    lyrics: (videoId, title, artist) =>
      request(`/api/lyrics/${videoId}?title=${encodeURIComponent(title||'')}&artist=${encodeURIComponent(artist||'')}`),

    // Streaming
    streamUrl: (videoId) => `/api/stream/${videoId}`,

    // Recommendations
    recommendations: (song, limit = 12) =>
      request('/api/recommendations', { method: 'POST', body: { song, limit } }),

    // History
    addToHistory:  (song)    => request('/api/history', { method: 'POST', body: song }),
    getHistory:    (limit)   => request(`/api/history?limit=${limit || 60}`),
    clearHistory:  ()        => request('/api/history', { method: 'DELETE' }),
    removeHistory: (videoId) => request(`/api/history/${videoId}`, { method: 'DELETE' }),

    // Likes
    toggleLike: (song)  => request('/api/like', { method: 'POST', body: song }),
    getLikes:   ()      => request('/api/likes'),

    // Playlists
    getPlaylists:          ()          => request('/api/playlists'),
    createPlaylist:        (name, desc) => request('/api/playlists', { method: 'POST', body: { name, description: desc } }),
    getPlaylist:           (id)        => request(`/api/playlists/${id}`),
    updatePlaylist:        (id, name, desc) => request(`/api/playlists/${id}`, { method: 'PUT', body: { name, description: desc } }),
    deletePlaylist:        (id)        => request(`/api/playlists/${id}`, { method: 'DELETE' }),
    addToPlaylist:         (id, song)  => request(`/api/playlists/${id}/songs`, { method: 'POST', body: song }),
    removeFromPlaylist:    (id, vid)   => request(`/api/playlists/${id}/songs/${vid}`, { method: 'DELETE' }),

    // Downloads
    download:       (song)    => request('/api/download', { method: 'POST', body: song }),
    getDownloads:   ()        => request('/api/downloads'),
    deleteDownload: (videoId) => request(`/api/downloads/${videoId}`, { method: 'DELETE' }),

    // Search history
    getSearchHistory:    () => request('/api/searchhistory'),
    clearSearchHistory:  () => request('/api/searchhistory', { method: 'DELETE' }),
    removeSearchHistory: (q) => request(`/api/searchhistory/${encodeURIComponent(q)}`, { method: 'DELETE' }),

    // Thumbnail
    thumb: (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    thumbMaxRes: (videoId) => `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  };
})();
