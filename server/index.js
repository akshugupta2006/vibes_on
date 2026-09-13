'use strict';
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const fetch      = require('node-fetch');
const db         = require('./db');
const ytdlp      = require('./ytdlp');
const ytmusic    = require('./ytmusic');
const { buildSmartQueue } = require('./recommendations');

const app  = express();
const PORT = process.env.PORT || 3000;

const DOWNLOADS_DIR = path.join(__dirname, '../cache/downloads');
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── Category definitions ────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'trending',    query: 'trending songs india 2025',                label: '🔥 Trending Now',       emoji: '🔥' },
  { key: 'newReleases', query: 'new hindi english songs released 2025',    label: '✨ New Releases',        emoji: '✨' },
  { key: 'punjabi',     query: 'new punjabi songs 2025 latest hit',        label: '🎵 Punjabi Bangers',    emoji: '🎵' },
  { key: 'haryanvi',    query: 'new haryanvi songs 2025 latest hit',       label: '🎤 Haryanvi Hits',      emoji: '🎤' },
  { key: 'global',      query: 'global top trending songs 2025 worldwide', label: '🌍 Global Trending',    emoji: '🌍' },
  { key: 'bollywood',   query: 'latest bollywood hindi songs 2025',        label: '🎬 Bollywood Fresh',    emoji: '🎬' },
  { key: 'english',     query: 'top english pop songs 2025 billboard',     label: '🎸 English Charts',     emoji: '🎸' },
  { key: 'hiphop',      query: 'best hip hop rap songs 2025',              label: '🎤 Hip-Hop Zone',       emoji: '🎤' },
  { key: 'lofi',        query: 'lofi chill beats study relax 2025',       label: '🌙 Lo-Fi & Chill',      emoji: '🌙' },
];

const ARTISTS = [
  { name:'Arijit Singh',   query:'Arijit Singh songs',    image:'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg' },
  { name:'AP Dhillon',     query:'AP Dhillon songs',      image:'https://i.ytimg.com/vi/0LPCfGTHTNI/hqdefault.jpg' },
  { name:'Karan Aujla',    query:'Karan Aujla songs',     image:'https://i.ytimg.com/vi/bAsQiDjFrE8/hqdefault.jpg' },
  { name:'Dua Lipa',       query:'Dua Lipa songs',        image:'https://i.ytimg.com/vi/HQmmM_qwG4k/hqdefault.jpg' },
  { name:'The Weeknd',     query:'The Weeknd songs',      image:'https://i.ytimg.com/vi/Wrn6sCDs9jA/hqdefault.jpg' },
  { name:'Billie Eilish',  query:'Billie Eilish songs',   image:'https://i.ytimg.com/vi/F4eLpUmB6yI/hqdefault.jpg' },
  { name:'Diljit Dosanjh', query:'Diljit Dosanjh songs',  image:'https://i.ytimg.com/vi/Tj0YQgnTlMk/hqdefault.jpg' },
  { name:'Sabrina Carpenter', query:'Sabrina Carpenter songs', image:'https://i.ytimg.com/vi/7tNT7WEWBNE/hqdefault.jpg' },
  { name:'Badshah',        query:'Badshah songs',         image:'https://i.ytimg.com/vi/UH8ykWQ19-I/hqdefault.jpg' },
  { name:'Masoom Sharma',  query:'Masoom Sharma haryanvi',image:'https://i.ytimg.com/vi/IqMGAhZhXbQ/hqdefault.jpg' },
];

const PLAYLISTS = [
  { id:'pl-1', name:'Gym Motivation',   desc:'High energy workout bangers',    cover:'https://i.ytimg.com/vi/T6eK-2OQtew/hqdefault.jpg', songs:12 },
  { id:'pl-2', name:'Late Night Drive', desc:'Smooth songs for the road',       cover:'https://i.ytimg.com/vi/d-J9dvN-5KM/hqdefault.jpg', songs:18 },
  { id:'pl-3', name:'Desi Vibes',       desc:'Best of Punjabi & Haryanvi',      cover:'https://i.ytimg.com/vi/0LPCfGTHTNI/hqdefault.jpg', songs:24 },
  { id:'pl-4', name:'Study Session',    desc:'Lofi beats to focus',             cover:'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg', songs:30 },
  { id:'pl-5', name:'Romantic Hits',    desc:'Love songs for every mood',       cover:'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg', songs:20 },
  { id:'pl-6', name:'Party Starters',   desc:'Turn up the volume 🔊',           cover:'https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg', songs:15 },
];

// ─── Status ──────────────────────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  const ytdlpOk = await ytdlp.checkYtDlp();
  res.json({ ok: true, ytdlp: ytdlpOk, user: 'Akash', version: '1.0.0' });
});

// ─── Home categories ─────────────────────────────────────────────────────────
app.get('/api/home/categories', (req, res) => {
  res.json({ categories: CATEGORIES, artists: ARTISTS, playlists: PLAYLISTS });
});

app.get('/api/home/:category', async (req, res) => {
  const { category } = req.params;

  // Most Listened — comes from DB
  if (category === 'mostListened') {
    const songs = db.getMostListened(15);
    return res.json({ songs, from_cache: false });
  }

  const cat = CATEGORIES.find(c => c.key === category);
  if (!cat) return res.status(404).json({ error: 'Unknown category' });

  const cached = db.getCachedHome(category);
  if (cached) return res.json({ songs: cached, from_cache: true });

  try {
    const songs = await ytmusic.searchCategory(category, cat.query, 15);
    if (songs.length) db.setCachedHome(category, songs);
    res.json({ songs, from_cache: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Endpoints ---

// Get stream URL (still uses yt-dlp / soundcloud fallback)
app.get('/api/streamurl/:id', async (req, res) => {
  try {
    const url = await ytdlp.getStreamUrl(req.params.id);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ songs: [] });
  const max = Math.min(parseInt(req.query.max) || 20, 30);
  db.addSearchHistory(q);
  try {
    const songs = await ytmusic.search(q, max);
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/suggestions', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  const history = db.getSearchHistory().map(h => h.query);
  if (!q) return res.json({ suggestions: history.slice(0, 8) });
  const matched = history.filter(h => h.includes(q));
  const static_ = [
    'Trending songs 2025','New Punjabi songs','Arijit Singh hits','AP Dhillon latest',
    'Lofi chill beats','Haryanvi songs 2025','Bollywood 2025','English top hits',
    'The Weeknd songs','Dua Lipa playlist','Karan Aujla new songs','Badshah songs',
  ].filter(s => s.toLowerCase().includes(q));
  const merged = [...new Set([...matched, ...static_])].slice(0, 8);
  res.json({ suggestions: merged });
});

// ─── Song info ────────────────────────────────────────────────────────────────
app.get('/api/info/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const info = await ytmusic.getInfo(videoId);
    if (!info) return res.status(404).json({ error: 'Not found' });
    res.json({ song: { ...info, liked: db.isLiked(videoId) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Smart recommendations / Up Next ─────────────────────────────────────────
app.post('/api/recommendations', async (req, res) => {
  const { song, limit = 12 } = req.body;
  if (!song || !song.video_id) return res.status(400).json({ error: 'song required' });
  try {
    const related = await ytmusic.getRelated(song.video_id, 30);
    const queue   = buildSmartQueue(song, related, limit);
    res.json({ queue });
  } catch (err) {
    // Fallback to mock-based recs
    const fallback = ytdlp.getMockData('trending').filter(s => s.video_id !== song.video_id).slice(0, limit);
    res.json({ queue: fallback });
  }
});

// ─── Streaming ────────────────────────────────────────────────────────────────
app.get('/api/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;

  // 1. Serve downloaded file if exists
  const dl = db.isDownloaded(videoId);
  if (dl && fs.existsSync(dl.file_path)) {
    return res.sendFile(path.resolve(dl.file_path));
  }

  // 2. Get/cache stream URL then proxy
  try {
    let streamUrl = db.getCachedStreamUrl(videoId);
    if (!streamUrl) {
      streamUrl = await ytdlp.getStreamUrl(videoId);
      if (streamUrl) db.cacheStreamUrl(videoId, streamUrl);
    }
    if (!streamUrl) return res.status(404).json({ error: 'Stream URL not found' });

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.youtube.com/',
    };
    if (req.headers.range) headers['Range'] = req.headers.range;

    const upstream = await fetch(streamUrl, { headers });

    res.status(upstream.status);
    const passHeaders = ['content-type','content-length','content-range','accept-ranges'];
    for (const h of passHeaders) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    upstream.body.pipe(res);
    req.on('close', () => { try { upstream.body.destroy(); } catch {} });

  } catch (err) {
    console.error('Stream error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Streaming failed: ' + err.message });
  }
});

// Direct stream URL (for clients that can handle CORS themselves)
app.get('/api/streamurl/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    let url = db.getCachedStreamUrl(videoId);
    if (!url) { url = await ytdlp.getStreamUrl(videoId); if (url) db.cacheStreamUrl(videoId, url); }
    if (!url) return res.status(404).json({ error: 'Not found' });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Lyrics ───────────────────────────────────────────────────────────────────
app.get('/api/lyrics/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const { title = '', artist = '' } = req.query;
  try {
    const { fetchLyrics } = require('./lyrics');
    const lyrics = await fetchLyrics(videoId, decodeURIComponent(title), decodeURIComponent(artist));
    res.json({ lyrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/download', async (req, res) => {
  const song = req.body;
  if (!song || !song.video_id) return res.status(400).json({ error: 'song required' });

  const existing = db.isDownloaded(song.video_id);
  if (existing && fs.existsSync(existing.file_path)) {
    return res.json({ success: true, cached: true });
  }

  const ytdlpOk = await ytdlp.checkYtDlp();
  if (!ytdlpOk) return res.status(503).json({ error: 'yt-dlp not installed. Run: pip3 install yt-dlp' });

  const safeTitle = (song.title || 'unknown').replace(/[^a-z0-9\s]/gi, '').trim().replace(/\s+/g, '_');
  const filename  = `${song.video_id}_${safeTitle}.mp3`;
  const filePath  = path.join(DOWNLOADS_DIR, filename);

  res.json({ success: true, downloading: true });

  // Run download in background
  const { spawn } = require('child_process');
  const proc = spawn('yt-dlp', [
    `https://www.youtube.com/watch?v=${song.video_id}`,
    '-f', 'bestaudio/best',
    '-x', '--audio-format', 'mp3', '--audio-quality', '0',
    '-o', filePath.replace('.mp3', '.%(ext)s'),
    '--no-playlist', '--no-warnings',
  ]);
  proc.on('close', code => {
    if (code === 0 && fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      db.addDownload(song, filePath, stat.size);
    }
  });
});

app.get('/api/downloads', (req, res) => {
  res.json({ downloads: db.getDownloads() });
});

app.delete('/api/downloads/:videoId', (req, res) => {
  const { videoId } = req.params;
  const dl = db.isDownloaded(videoId);
  if (dl && fs.existsSync(dl.file_path)) { try { fs.unlinkSync(dl.file_path); } catch {} }
  db.deleteDownload(videoId);
  res.json({ success: true });
});

// ─── History ─────────────────────────────────────────────────────────────────
app.post('/api/history', (req, res) => {
  const song = req.body;
  if (!song || !song.video_id) return res.status(400).json({ error: 'song required' });
  db.addToHistory(song);
  res.json({ success: true });
});

app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 60;
  res.json({ history: db.getHistory(limit) });
});

app.delete('/api/history', (req, res) => {
  db.clearHistory();
  res.json({ success: true });
});

app.delete('/api/history/:videoId', (req, res) => {
  db.removeFromHistory(req.params.videoId);
  res.json({ success: true });
});

// ─── Likes ────────────────────────────────────────────────────────────────────
app.post('/api/like', (req, res) => {
  const song = req.body;
  if (!song || !song.video_id) return res.status(400).json({ error: 'song required' });
  const result = db.toggleLike(song);
  res.json(result);
});

app.get('/api/likes', (req, res) => {
  res.json({ songs: db.getLikedSongs() });
});

// ─── Playlists ────────────────────────────────────────────────────────────────
app.get('/api/playlists', (req, res) => {
  res.json({ playlists: db.getPlaylists() });
});

app.post('/api/playlists', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const pl = db.createPlaylist(name, description);
  res.json({ playlist: pl });
});

app.get('/api/playlists/:id', (req, res) => {
  const pl = db.getPlaylist(parseInt(req.params.id));
  if (!pl) return res.status(404).json({ error: 'Not found' });
  res.json({ playlist: pl });
});

app.put('/api/playlists/:id', (req, res) => {
  const { name, description } = req.body;
  db.updatePlaylist(parseInt(req.params.id), name, description);
  res.json({ success: true });
});

app.delete('/api/playlists/:id', (req, res) => {
  db.deletePlaylist(parseInt(req.params.id));
  res.json({ success: true });
});

app.post('/api/playlists/:id/songs', (req, res) => {
  const song = req.body;
  if (!song || !song.video_id) return res.status(400).json({ error: 'song required' });
  db.addToPlaylist(parseInt(req.params.id), song);
  res.json({ success: true });
});

app.delete('/api/playlists/:id/songs/:videoId', (req, res) => {
  db.removeFromPlaylist(parseInt(req.params.id), req.params.videoId);
  res.json({ success: true });
});

// ─── Search History ───────────────────────────────────────────────────────────
app.get('/api/searchhistory', (req, res) => {
  res.json({ history: db.getSearchHistory() });
});

app.delete('/api/searchhistory', (req, res) => {
  db.clearSearchHistory();
  res.json({ success: true });
});

app.delete('/api/searchhistory/:query', (req, res) => {
  db.removeSearchHistory(decodeURIComponent(req.params.query));
  res.json({ success: true });
});

// ─── Thumbnail proxy (bypass CORS) ───────────────────────────────────────────
app.get('/api/thumb/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  try {
    const r = await fetch(thumbUrl);
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    r.body.pipe(res);
  } catch {
    res.status(404).end();
  }
});

// ─── Catch-all → SPA ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎵 VIBE_ON running at http://localhost:${PORT}`);
  ytdlp.checkYtDlp(); // warm-up check
});
