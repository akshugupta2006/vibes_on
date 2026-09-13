'use strict';
/**
 * VIBE_ON — Lightweight JSON-file database
 * No native dependencies. Simple, fast, reliable.
 */
const path = require('path');
const fs   = require('fs');

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE  = path.join(DATA_DIR, 'vibe_on.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ── In-memory store ────────────────────────────────────────────────────────
const DEFAULTS = {
  history:       [],   // { video_id, title, artist, thumbnail, duration, play_count, played_at }
  liked_songs:   [],   // { video_id, title, artist, thumbnail, duration, liked_at }
  playlists:     [],   // { id, name, description, cover, created_at, updated_at }
  playlist_songs:[],   // { playlist_id, video_id, title, artist, thumbnail, duration, position, added_at }
  downloads:     [],   // { video_id, title, artist, thumbnail, duration, file_path, file_size, downloaded_at }
  search_history:[],   // { query, searched_at }
  stream_cache:  [],   // { video_id, stream_url, expires_at }
  home_cache:    [],   // { category, data, cached_at }
  _next_id:      1,
};

let store;
function load() {
  if (store) return;
  try { store = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
  catch { store = { ...DEFAULTS }; }
}
function save() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 0)); } catch {}
}
function nextId() { const id = store._next_id++; save(); return id; }
function now() { return new Date().toISOString(); }

load();

module.exports = {
  // ── History ───────────────────────────────────────────────────────────────
  addToHistory(song) {
    load();
    const ex = store.history.find(h => h.video_id === song.video_id);
    if (ex) { ex.play_count = (ex.play_count || 1) + 1; ex.played_at = now(); }
    else store.history.unshift({ video_id:song.video_id, title:song.title||'', artist:song.artist||'', thumbnail:song.thumbnail||'', duration:song.duration||'0:00', play_count:1, played_at:now() });
    save();
  },
  getHistory(limit=60)      { load(); return store.history.slice(0, limit); },
  getMostListened(limit=20) { load(); return [...store.history].sort((a,b)=>(b.play_count||0)-(a.play_count||0)).slice(0,limit); },
  clearHistory()            { load(); store.history = []; save(); },
  removeFromHistory(vid)    { load(); store.history = store.history.filter(h=>h.video_id!==vid); save(); },

  // ── Likes ─────────────────────────────────────────────────────────────────
  toggleLike(song) {
    load();
    const idx = store.liked_songs.findIndex(s=>s.video_id===song.video_id);
    if (idx >= 0) { store.liked_songs.splice(idx,1); save(); return { liked:false }; }
    store.liked_songs.unshift({ video_id:song.video_id, title:song.title||'', artist:song.artist||'', thumbnail:song.thumbnail||'', duration:song.duration||'0:00', liked_at:now() });
    save();
    return { liked:true };
  },
  isLiked(vid)    { load(); return !!store.liked_songs.find(s=>s.video_id===vid); },
  getLikedSongs() { load(); return store.liked_songs; },

  // ── Playlists ─────────────────────────────────────────────────────────────
  createPlaylist(name, description='') {
    load();
    const pl = { id:nextId(), name, description, cover:'', created_at:now(), updated_at:now() };
    store.playlists.push(pl);
    save();
    return pl;
  },
  getPlaylists() {
    load();
    return store.playlists.map(p => ({
      ...p,
      song_count: store.playlist_songs.filter(s=>s.playlist_id===p.id).length,
      cover: p.cover || store.playlist_songs.find(s=>s.playlist_id===p.id)?.thumbnail || '',
    })).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
  },
  getPlaylist(id) {
    load();
    const p = store.playlists.find(pl=>pl.id===id);
    if (!p) return null;
    return { ...p, songs: store.playlist_songs.filter(s=>s.playlist_id===id).sort((a,b)=>a.position-b.position) };
  },
  updatePlaylist(id, name, description) {
    load();
    const p = store.playlists.find(pl=>pl.id===id);
    if (p) { p.name=name; p.description=description; p.updated_at=now(); save(); }
  },
  deletePlaylist(id) {
    load();
    store.playlists = store.playlists.filter(p=>p.id!==id);
    store.playlist_songs = store.playlist_songs.filter(s=>s.playlist_id!==id);
    save();
  },
  addToPlaylist(playlistId, song) {
    load();
    if (store.playlist_songs.find(s=>s.playlist_id===playlistId&&s.video_id===song.video_id)) return;
    const pos = store.playlist_songs.filter(s=>s.playlist_id===playlistId).length;
    store.playlist_songs.push({ playlist_id:playlistId, video_id:song.video_id, title:song.title||'', artist:song.artist||'', thumbnail:song.thumbnail||'', duration:song.duration||'0:00', position:pos, added_at:now() });
    const p = store.playlists.find(pl=>pl.id===playlistId);
    if (p) p.updated_at = now();
    save();
  },
  removeFromPlaylist(playlistId, vid) {
    load();
    store.playlist_songs = store.playlist_songs.filter(s=>!(s.playlist_id===playlistId&&s.video_id===vid));
    const p = store.playlists.find(pl=>pl.id===playlistId);
    if (p) p.updated_at = now();
    save();
  },

  // ── Downloads ─────────────────────────────────────────────────────────────
  addDownload(song, filePath, fileSize) {
    load();
    store.downloads = store.downloads.filter(d=>d.video_id!==song.video_id);
    store.downloads.unshift({ video_id:song.video_id, title:song.title||'', artist:song.artist||'', thumbnail:song.thumbnail||'', duration:song.duration||'0:00', file_path:filePath, file_size:fileSize||0, downloaded_at:now() });
    save();
  },
  getDownloads()      { load(); return store.downloads; },
  isDownloaded(vid)   { load(); return store.downloads.find(d=>d.video_id===vid) || null; },
  deleteDownload(vid) { load(); store.downloads=store.downloads.filter(d=>d.video_id!==vid); save(); },

  // ── Search History ────────────────────────────────────────────────────────
  addSearchHistory(query) {
    load();
    store.search_history = store.search_history.filter(h=>h.query!==query.toLowerCase().trim());
    store.search_history.unshift({ query:query.toLowerCase().trim(), searched_at:now() });
    store.search_history = store.search_history.slice(0,20);
    save();
  },
  getSearchHistory()     { load(); return store.search_history; },
  clearSearchHistory()   { load(); store.search_history=[]; save(); },
  removeSearchHistory(q) { load(); store.search_history=store.search_history.filter(h=>h.query!==q); save(); },

  // ── Stream Cache ──────────────────────────────────────────────────────────
  getCachedStreamUrl(vid) {
    load();
    const row = store.stream_cache.find(r=>r.video_id===vid);
    if (!row) return null;
    if (Date.now() > row.expires_at) { store.stream_cache=store.stream_cache.filter(r=>r.video_id!==vid); save(); return null; }
    return row.stream_url;
  },
  cacheStreamUrl(vid, url, ttl=3_600_000) {
    load();
    store.stream_cache = store.stream_cache.filter(r=>r.video_id!==vid);
    store.stream_cache.push({ video_id:vid, stream_url:url, expires_at:Date.now()+ttl });
    save();
  },

  // ── Home Cache ────────────────────────────────────────────────────────────
  getCachedHome(category, ttl=1_800_000) {
    load();
    const row = store.home_cache.find(r=>r.category===category);
    if (!row || Date.now()-row.cached_at > ttl) return null;
    return row.data;
  },
  setCachedHome(category, data) {
    load();
    store.home_cache = store.home_cache.filter(r=>r.category!==category);
    store.home_cache.push({ category, data, cached_at:Date.now() });
    save();
  },
};
