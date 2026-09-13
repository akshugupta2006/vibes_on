'use strict';
const { spawn, execFile } = require('child_process');

// ─── yt-dlp availability ────────────────────────────────────────────────────
let ytDlpAvailable = null;
async function checkYtDlp() {
  if (ytDlpAvailable !== null) return ytDlpAvailable;
  return new Promise(resolve => {
    execFile('yt-dlp', ['--version'], (err, stdout) => {
      ytDlpAvailable = !err;
      if (!err) console.log(`✅ yt-dlp ${stdout.trim()} detected`);
      else console.warn('⚠️  yt-dlp not found — using mock data. Run: pip3 install yt-dlp');
      resolve(ytDlpAvailable);
    });
  });
}

// ─── Core runner ────────────────────────────────────────────────────────────
// Base args injected into every yt-dlp call for better success rate
const BASE_ARGS = [
  '--no-warnings',
  '--no-check-certificate',
  '--extractor-args', 'youtube:player_client=ios',
  '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];

function runYtDlp(args, timeout = 40_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [...BASE_ARGS, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    const timer = setTimeout(() => { proc.kill(); reject(new Error('yt-dlp timeout')); }, timeout);
    proc.on('close', code => {
      clearTimeout(timer);
      code === 0 ? resolve(stdout) : reject(new Error(stderr.slice(0, 300)));
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(secs) {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function cleanTitle(t = '') {
  return t
    .replace(/\(Official\s?(Video|Audio|Music Video|Lyric Video|Song|Visualizer|Version)\)/gi, '')
    .replace(/\[Official\s?(Video|Audio|Music Video|Lyric Video|Song|Visualizer|Version)\]/gi, '')
    .replace(/\((Full Song|HD|4K|HQ|Slowed|Reverb|Lyrics?)\)/gi, '')
    .replace(/\| Official.*/gi, '').replace(/Official$/i, '').trim();
}

function toSong(d) {
  const id = d.id || d.video_id || '';
  return {
    video_id:         id,
    title:            cleanTitle(d.title || 'Unknown'),
    artist:           d.uploader || d.channel || d.artist || 'Unknown Artist',
    thumbnail:        d.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration:         fmt(d.duration),
    duration_seconds: d.duration || 0,
    view_count:       d.view_count || 0,
    upload_date:      d.upload_date || '',
    tags:             d.tags || [],
  };
}

// ─── Mock data (used when yt-dlp is absent) ──────────────────────────────────
const MOCK = {
  trending: [
    { video_id:'H5v3kku4y6Q', title:'APT.', artist:'ROSÉ & Bruno Mars', duration:'3:09' },
    { video_id:'7tNT7WEWBNE', title:'Espresso', artist:'Sabrina Carpenter', duration:'2:55' },
    { video_id:'kPa7bsKwL-c', title:'Die With a Smile', artist:'Lady Gaga & Bruno Mars', duration:'4:11' },
    { video_id:'BddP6PYo2gs', title:'Kesariya', artist:'Arijit Singh', duration:'4:34' },
    { video_id:'yBdMNMSNIno', title:'Pasoori', artist:'Ali Sethi & Shae Gill', duration:'4:45' },
    { video_id:'F4eLpUmB6yI', title:'Birds of a Feather', artist:'Billie Eilish', duration:'3:30' },
    { video_id:'T6eK-2OQtew', title:'Not Like Us', artist:'Kendrick Lamar', duration:'4:34' },
    { video_id:'lqYuRCzJ0jE', title:'Please Please Please', artist:'Sabrina Carpenter', duration:'3:05' },
    { video_id:'G7KNmW9a75Y', title:'Flowers', artist:'Miley Cyrus', duration:'3:20' },
    { video_id:'HQmmM_qwG4k', title:'Levitating', artist:'Dua Lipa', duration:'3:23' },
    { video_id:'Wrn6sCDs9jA', title:'Blinding Lights', artist:'The Weeknd', duration:'3:20' },
    { video_id:'jGh_JwfFfEY', title:'Teri Baaton Mein Aisa Uljha', artist:'Raghav Chaitanya', duration:'3:40' },
  ],
  newReleases: [
    { video_id:'Rx4jXAFHJjQ', title:'Chaleya', artist:'Arijit Singh & Shilpa Rao', duration:'3:23' },
    { video_id:'BddP6PYo2gs', title:'Jamal Kudu', artist:'Shreya Ghoshal', duration:'3:10' },
    { video_id:'MXvoh5zxPOk', title:'Woh Toh Hai Albela', artist:'Pritam', duration:'3:55' },
    { video_id:'9wGFHQR48sk', title:'Nayak Nahi Khalnayak', artist:'Sonu Nigam', duration:'4:12' },
    { video_id:'F4eLpUmB6yI', title:'Lunch', artist:'Billie Eilish', duration:'2:47' },
    { video_id:'zQmgrHhKhU0', title:'Good Luck Babe!', artist:'Chappell Roan', duration:'3:58' },
    { video_id:'vVHgPuEBUQQ', title:'Texas Hold Em', artist:'Beyoncé', duration:'3:54' },
    { video_id:'0LPCfGTHTNI', title:'Brown Munde', artist:'AP Dhillon', duration:'3:20' },
    { video_id:'E0-HRTmYQEI', title:'Excuses', artist:'AP Dhillon', duration:'3:30' },
    { video_id:'Xzy7CQSO1DM', title:'Satranga', artist:'Arijit Singh', duration:'4:08' },
  ],
  punjabi: [
    { video_id:'0LPCfGTHTNI', title:'Brown Munde', artist:'AP Dhillon', duration:'3:20' },
    { video_id:'E0-HRTmYQEI', title:'Excuses', artist:'AP Dhillon & Gurinder Gill', duration:'3:30' },
    { video_id:'bAsQiDjFrE8', title:'Softly', artist:'Karan Aujla', duration:'3:15' },
    { video_id:'UBFNb0vBwUQ', title:'52 Bars', artist:'Karan Aujla', duration:'4:02' },
    { video_id:'Tj0YQgnTlMk', title:'GOAT', artist:'Diljit Dosanjh', duration:'3:48' },
    { video_id:'N2C4h1QFXOY', title:'Born to Shine', artist:'Diljit Dosanjh', duration:'2:58' },
    { video_id:'RGPqNmLWO8Y', title:'Unforgettable', artist:'French Montana ft. Swae Lee', duration:'3:38' },
    { video_id:'CevxZvSJLk8', title:'Way 2 Fly', artist:'AP Dhillon', duration:'3:12' },
    { video_id:'7H7UxL-Q7QE', title:'Pind Wali Gal', artist:'Sidhu Moosewala', duration:'4:05' },
    { video_id:'r2GKo0zWRjQ', title:'295', artist:'Sidhu Moosewala', duration:'4:30' },
    { video_id:'q7UAi-8K5sk', title:'Sare Karo', artist:'Babbal Rai', duration:'3:44' },
    { video_id:'XoGrNUV2jUA', title:'Backbone', artist:'Hardy Sandhu', duration:'3:20' },
  ],
  haryanvi: [
    { video_id:'IqMGAhZhXbQ', title:'Teri Aakhya Ka Yo Kajal', artist:'Masoom Sharma', duration:'3:50' },
    { video_id:'C9Xt6fvhkb0', title:'52 Gaj Ka Daman', artist:'Renuka Panwar', duration:'3:30' },
    { video_id:'G1pu3UNOFhc', title:'Nikle Currant', artist:'Jassi Gill & Neha Kakkar', duration:'3:28' },
    { video_id:'3Fp-FKP0MOo', title:'Bahu Kale Ki', artist:'Vijay Varma', duration:'3:55' },
    { video_id:'UH8ykWQ19-I', title:'Dj Wale Babu', artist:'Badshah', duration:'3:22' },
    { video_id:'nfWlot6h_JM', title:'Lat Lag Gayee', artist:'Benny Dayal', duration:'4:10' },
    { video_id:'yD0PrkBzRRU', title:'Daru Badnaam', artist:'Kamal Kahlon & Param Singh', duration:'4:24' },
    { video_id:'lCdedP7P3cw', title:'Bijli Girayi', artist:'Raju Punjabi', duration:'4:01' },
    { video_id:'QsvPCbVPILE', title:'Aadat', artist:'Atif Aslam', duration:'4:44' },
    { video_id:'rRrv2lNLcnY', title:'Tere Bin Nahi Lagda', artist:'Nusrat Fateh Ali Khan', duration:'5:02' },
  ],
  global: [
    { video_id:'H5v3kku4y6Q', title:'APT.', artist:'ROSÉ & Bruno Mars', duration:'3:09' },
    { video_id:'F4eLpUmB6yI', title:'Birds of a Feather', artist:'Billie Eilish', duration:'3:30' },
    { video_id:'T6eK-2OQtew', title:'Not Like Us', artist:'Kendrick Lamar', duration:'4:34' },
    { video_id:'7tNT7WEWBNE', title:'Espresso', artist:'Sabrina Carpenter', duration:'2:55' },
    { video_id:'zQmgrHhKhU0', title:'Good Luck Babe!', artist:'Chappell Roan', duration:'3:58' },
    { video_id:'HQmmM_qwG4k', title:'Levitating', artist:'Dua Lipa', duration:'3:23' },
    { video_id:'Wrn6sCDs9jA', title:'Blinding Lights', artist:'The Weeknd', duration:'3:20' },
    { video_id:'vVHgPuEBUQQ', title:'Texas Hold Em', artist:'Beyoncé', duration:'3:54' },
    { video_id:'GazrvBRSzGY', title:'As It Was', artist:'Harry Styles', duration:'2:37' },
    { video_id:'d-J9dvN-5KM', title:'Heat Waves', artist:'Glass Animals', duration:'3:59' },
    { video_id:'nYh-n7EOtMA', title:'Sunflower', artist:'Post Malone & Swae Lee', duration:'2:38' },
    { video_id:'8yoL5GRZMpQ', title:'Watermelon Sugar', artist:'Harry Styles', duration:'2:54' },
  ],
  bollywood: [
    { video_id:'BddP6PYo2gs', title:'Kesariya', artist:'Arijit Singh', duration:'4:34' },
    { video_id:'Xzy7CQSO1DM', title:'Satranga', artist:'Arijit Singh', duration:'4:08' },
    { video_id:'Rx4jXAFHJjQ', title:'Chaleya', artist:'Arijit Singh & Shilpa Rao', duration:'3:23' },
    { video_id:'jGh_JwfFfEY', title:'Teri Baaton Mein Aisa', artist:'Raghav Chaitanya', duration:'3:40' },
    { video_id:'9wGFHQR48sk', title:'Tum Kya Mile', artist:'Pritam', duration:'3:55' },
    { video_id:'MXvoh5zxPOk', title:'Har Har Shambhu', artist:'Abhilipsa Panda', duration:'4:12' },
    { video_id:'3j7BWXG5yZE', title:'Arjan Vailly', artist:'Bhupinder Babbal', duration:'3:21' },
    { video_id:'yD0PrkBzRRU', title:'Srivalli', artist:'Sid Sriram', duration:'4:26' },
    { video_id:'QsvPCbVPILE', title:'Pushpa Pushpa', artist:'Devi Sri Prasad', duration:'3:15' },
    { video_id:'IqMGAhZhXbQ', title:'Raataan Lambiyan', artist:'Jubin Nautiyal', duration:'3:40' },
  ],
  english: [
    { video_id:'H5v3kku4y6Q', title:'APT.', artist:'ROSÉ & Bruno Mars', duration:'3:09' },
    { video_id:'kPa7bsKwL-c', title:'Die With a Smile', artist:'Lady Gaga & Bruno Mars', duration:'4:11' },
    { video_id:'7tNT7WEWBNE', title:'Espresso', artist:'Sabrina Carpenter', duration:'2:55' },
    { video_id:'F4eLpUmB6yI', title:'Birds of a Feather', artist:'Billie Eilish', duration:'3:30' },
    { video_id:'G7KNmW9a75Y', title:'Flowers', artist:'Miley Cyrus', duration:'3:20' },
    { video_id:'nYh-n7EOtMA', title:'Sunflower', artist:'Post Malone & Swae Lee', duration:'2:38' },
    { video_id:'d-J9dvN-5KM', title:'Heat Waves', artist:'Glass Animals', duration:'3:59' },
    { video_id:'HQmmM_qwG4k', title:'Levitating', artist:'Dua Lipa', duration:'3:23' },
    { video_id:'Wrn6sCDs9jA', title:'Blinding Lights', artist:'The Weeknd', duration:'3:20' },
    { video_id:'GazrvBRSzGY', title:'As It Was', artist:'Harry Styles', duration:'2:37' },
    { video_id:'T6eK-2OQtew', title:'Not Like Us', artist:'Kendrick Lamar', duration:'4:34' },
    { video_id:'lqYuRCzJ0jE', title:'Please Please Please', artist:'Sabrina Carpenter', duration:'3:05' },
  ],
  hiphop: [
    { video_id:'T6eK-2OQtew', title:'Not Like Us', artist:'Kendrick Lamar', duration:'4:34' },
    { video_id:'nYh-n7EOtMA', title:'Sunflower', artist:'Post Malone & Swae Lee', duration:'2:38' },
    { video_id:'UH8ykWQ19-I', title:'Bad and Boujee', artist:'Migos', duration:'5:37' },
    { video_id:'3Fp-FKP0MOo', title:'HUMBLE.', artist:'Kendrick Lamar', duration:'2:57' },
    { video_id:'ztbf9TtGTkQ', title:"God's Plan", artist:'Drake', duration:'3:19' },
    { video_id:'RGPqNmLWO8Y', title:'Rockstar', artist:'Post Malone ft. 21 Savage', duration:'3:41' },
    { video_id:'CevxZvSJLk8', title:'SICKO MODE', artist:'Travis Scott', duration:'5:12' },
    { video_id:'vVHgPuEBUQQ', title:'Sorry Not Sorry', artist:'Doja Cat', duration:'3:12' },
    { video_id:'7H7UxL-Q7QE', title:'INDUSTRY BABY', artist:'Lil Nas X & Jack Harlow', duration:'3:32' },
    { video_id:'r2GKo0zWRjQ', title:'Starboy', artist:'The Weeknd', duration:'3:51' },
  ],
  lofi: [
    { video_id:'jfKfPfyJRdk', title:'Lofi Hip Hop Radio', artist:'Lofi Girl', duration:'∞' },
    { video_id:'5qap5aO4i9A', title:'Lofi Hip Hop Mix - Beats to Relax', artist:'ChilledCow', duration:'∞' },
    { video_id:'lTRiuFIWV54', title:'Study Music - Focus & Calm', artist:'Lofi Beats', duration:'∞' },
    { video_id:'DWcJFNfaw9c', title:'Aesthetic Lofi Mix', artist:'Dreamy Vibes', duration:'∞' },
    { video_id:'2WqRfXJLpR4', title:'Midnight Lofi Mix', artist:'Chillhop Music', duration:'∞' },
    { video_id:'N9VPOvKxLUQ', title:'Smooth Jazz Lofi', artist:'Jazz Vibes', duration:'∞' },
    { video_id:'wGCpDpUQ3eg', title:'Rain Lofi - Relaxing Beats', artist:'Rain Sounds', duration:'∞' },
    { video_id:'7NOSDKb0HlU', title:'Night Drives Lofi', artist:'Lofi Records', duration:'∞' },
  ],
};

// Add thumbnails to mock data
Object.keys(MOCK).forEach(cat => {
  MOCK[cat] = MOCK[cat].map(s => ({
    ...s,
    thumbnail: s.thumbnail || `https://i.ytimg.com/vi/${s.video_id}/hqdefault.jpg`,
    duration_seconds: 0,
    view_count: Math.floor(Math.random() * 50_000_000) + 1_000_000,
    tags: []
  }));
});

// ─── Public API ───────────────────────────────────────────────────────────────
module.exports = {
  checkYtDlp,

  async search(query, max = 15) {
    const ok = await checkYtDlp();
    if (!ok) {
      // Fuzzy match mock data
      const q = query.toLowerCase();
      const all = Object.values(MOCK).flat();
      const matched = all.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q)
      );
      return matched.length ? matched.slice(0, max) : all.slice(0, max);
    }
    try {
      const out = await runYtDlp([
        `ytsearch${max}:${query}`,
        '--dump-json', '--no-playlist', '--no-warnings',
        '--ignore-errors', '--flat-playlist', '--skip-download',
      ], 50_000);
      return out.trim().split('\n').filter(Boolean).map(l => {
        try { return toSong(JSON.parse(l)); } catch { return null; }
      }).filter(Boolean);
    } catch (e) {
      console.error('search error:', e.message);
      const q = query.toLowerCase();
      const all = Object.values(MOCK).flat();
      const matched = all.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q)
      );
      return matched.length ? matched.slice(0, max) : all.slice(0, max);
    }
  },

  async searchCategory(category, query, max = 15) {
    const ok = await checkYtDlp();
    if (!ok) return (MOCK[category] || MOCK.trending).slice(0, max);
    try {
      const out = await runYtDlp([
        `ytsearch${max}:${query}`,
        '--dump-json', '--no-playlist', '--no-warnings',
        '--ignore-errors', '--flat-playlist', '--skip-download',
      ], 50_000);
      const results = out.trim().split('\n').filter(Boolean).map(l => {
        try { return toSong(JSON.parse(l)); } catch { return null; }
      }).filter(Boolean);
      return results.length ? results : (MOCK[category] || MOCK.trending).slice(0, max);
    } catch (e) {
      console.error(`Category ${category} error:`, e.message);
      return (MOCK[category] || MOCK.trending).slice(0, max);
    }
  },

  async getInfo(videoId) {
    const ok = await checkYtDlp();
    if (!ok) {
      const all = Object.values(MOCK).flat();
      return all.find(s => s.video_id === videoId) || null;
    }
    try {
      const out = await runYtDlp([
        `https://www.youtube.com/watch?v=${videoId}`,
        '--dump-json', '--no-playlist', '--no-warnings', '--skip-download',
      ]);
      return toSong(JSON.parse(out.trim()));
    } catch (e) {
      console.error('getInfo error:', e.message);
      const all = Object.values(MOCK).flat();
      return all.find(s => s.video_id === videoId) || null;
    }
  },

  async getStreamUrl(videoId) {
    const ok = await checkYtDlp();
    if (!ok) throw new Error('yt-dlp not installed. Run: pip3 install yt-dlp');

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    // If on cloud, YouTube often blackholes requests causing 15s timeouts per client.
    // Try only the best bypass clients and fail fast (8 seconds) to trigger the SoundCloud fallback.
    const clients = ['ios', 'mweb'];

    for (const client of clients) {
      try {
        const args = [
          url,
          '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
          '--get-url', '--no-playlist',
          '--extractor-args', `youtube:player_client=${client}`,
        ];
        const out = await runYtDlp(args, 8_000);
        const streamUrl = out.trim().split('\n')[0];
        if (streamUrl && streamUrl.startsWith('http')) {
          console.log(`✅ Stream URL fetched via [${client}] client for ${videoId}`);
          return streamUrl;
        }
      } catch (e) {
        console.warn(`⚠️  [${client}] client failed for ${videoId}: ${e.message.slice(0, 80)}`);
      }
    }
    
    // --- SOUNDCLOUD FALLBACK (Bypasses YouTube datacenter blocks entirely) ---
    try {
      const db = require('./db');
      const hist = db.getHistory(100);
      const all = Object.values(MOCK).flat();
      const songInfo = hist.find(h => h.video_id === videoId) || all.find(s => s.video_id === videoId);
      
      const query = songInfo ? `${songInfo.artist} ${songInfo.title} official audio` : `official audio`;
      console.log(`🔄 YouTube blocked. Falling back to SoundCloud search for: ${query}`);
      
      const args = [
        `scsearch1:${query}`,
        '-f', 'bestaudio[protocol^=http]/bestaudio',
        '--get-url', '--no-playlist'
      ];
      // Run yt-dlp without the youtube-specific BASE_ARGS
      const proc = spawn('yt-dlp', ['--no-warnings', '--no-check-certificate', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
      const streamUrl = await new Promise((resolve, reject) => {
        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d; });
        proc.stderr.on('data', d => { stderr += d; });
        proc.on('close', code => code === 0 ? resolve(stdout.trim().split('\n')[0]) : reject(new Error(stderr.slice(0, 100))));
      });
      
      if (streamUrl && streamUrl.startsWith('http')) {
        console.log(`✅ Stream URL fetched via SoundCloud for ${videoId}`);
        return streamUrl;
      }
    } catch (scErr) {
      console.warn(`⚠️  SoundCloud fallback failed: ${scErr.message}`);
    }

    throw new Error(`All clients and fallbacks failed for video ${videoId}`);
  },

  async getRelated(videoId, limit = 15) {
    const ok = await checkYtDlp();
    if (!ok) {
      const all = Object.values(MOCK).flat();
      return all.filter(s => s.video_id !== videoId).slice(0, limit);
    }
    try {
      const out = await runYtDlp([
        `https://www.youtube.com/watch?v=${videoId}`,
        '--dump-json', '--no-warnings', '--skip-download',
      ]);
      const data = JSON.parse(out.trim().split('\n')[0]);
      if (Array.isArray(data.related_videos) && data.related_videos.length) {
        return data.related_videos.slice(0, limit).map(v => ({
          video_id: v.id, title: cleanTitle(v.title || 'Unknown'),
          artist: v.uploader || v.channel || 'Unknown Artist',
          thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
          duration: fmt(v.duration), duration_seconds: v.duration || 0, tags: [],
        }));
      }
      // Fallback: search related by title
      const info = toSong(data);
      const q = `${info.artist} songs 2025`;
      return module.exports.search(q, limit);
    } catch (e) {
      console.error('getRelated error:', e.message);
      const all = Object.values(MOCK).flat();
      return all.filter(s => s.video_id !== videoId).slice(0, limit);
    }
  },

  streamAudio(videoId, req, res) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const args = [url, '-f', 'bestaudio/best', '-o', '-', '--no-playlist', '--no-warnings', '--quiet'];
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    res.setHeader('Content-Type', 'audio/webm');
    res.setHeader('Transfer-Encoding', 'chunked');
    proc.stdout.pipe(res);
    req.on('close', () => { try { proc.kill(); } catch {} });
    proc.on('error', err => { console.error('stream proc err:', err.message); if (!res.headersSent) res.status(500).end(); });
    return proc;
  },

  getMockData(category) { return MOCK[category] || MOCK.trending; },
};
