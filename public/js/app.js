/* ═══════════════════════════════════════════════════════════
   VIBE_ON — App Router + Mini-Player + Profile + Init
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let currentView = 'home';
  let likedSongIds = new Set();

  // ── Router ────────────────────────────────────────────────────────────────
  const Router = {
    navigate(view) {
      if (currentView === view) {
        // Re-trigger library load on repeat tap
        if (view === 'library') LibraryModule?.loadTab('liked');
        return;
      }
      const prev = document.getElementById(`view-${currentView}`);
      const next = document.getElementById(`view-${view}`);
      if (!next) return;

      prev?.classList.remove('active');
      next.classList.add('active');

      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
      });

      currentView = view;

      // Lifecycle hooks
      if (view === 'search') {
        SearchModule?.init();
        setTimeout(() => document.getElementById('search-input')?.focus(), 200);
      }
      if (view === 'library') {
        LibraryModule?.init();
        LibraryModule?.loadTab('liked');
      }
      if (view === 'profile') loadProfile();
    },
  };

  // ── Mini Player ───────────────────────────────────────────────────────────
  function initMiniPlayer() {
    // Open now playing on click
    document.getElementById('mini-player-open')?.addEventListener('click', (e) => {
      if (e.target.closest('#mini-play-btn') ||
          e.target.closest('#mini-prev-btn') ||
          e.target.closest('#mini-next-btn') ||
          e.target.closest('#mini-like-btn')) return;
      NowPlaying.open();
    });

    document.getElementById('mini-prev-btn')?.addEventListener('click', () => Player.playPrev());
    document.getElementById('mini-play-btn')?.addEventListener('click', () => Player.togglePlay());
    document.getElementById('mini-next-btn')?.addEventListener('click', () => Player.playNext(true));
    document.getElementById('mini-like-btn')?.addEventListener('click', () => {
      Player.toggleLike().then(liked => {
        const vid = Player.state.currentSong?.video_id;
        if (vid) liked ? likedSongIds.add(vid) : likedSongIds.delete(vid);
        updateMiniLike();
      });
    });

    // Player events
    Player.on('songChanged', (song) => {
      const mp = document.getElementById('mini-player');
      mp?.classList.remove('hidden');

      document.getElementById('mini-title').textContent  = song.title  || '';
      document.getElementById('mini-artist').textContent = song.artist || '';

      const thumb = document.getElementById('mini-thumb');
      if (thumb) {
        thumb.src = API.thumb(song.video_id);
        thumb.onerror = () => { thumb.src = `https://picsum.photos/seed/${song.video_id}/80/80`; };
        thumb.style.display = 'block';
      }

      updateMiniLike();
    });

    Player.on('playState', (isPlaying) => {
      const icon = document.getElementById('mini-play-icon');
      if (!icon) return;
      icon.innerHTML = isPlaying
        ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
        : '<path d="M8 5v14l11-7z"/>';
    });

    Player.on('progress', ({ pct }) => {
      const fill = document.getElementById('mini-progress-fill');
      if (fill) fill.style.width = `${(pct || 0) * 100}%`;
    });

    Player.on('likeChanged', ({ videoId, liked }) => {
      liked ? likedSongIds.add(videoId) : likedSongIds.delete(videoId);
      updateMiniLike();
    });
  }

  function updateMiniLike() {
    const vid  = Player.state.currentSong?.video_id;
    const liked = vid && likedSongIds.has(vid);
    const btn   = document.getElementById('mini-like-btn');
    const heart = document.getElementById('mini-heart');
    if (!btn || !heart) return;
    btn.classList.toggle('liked', !!liked);
    heart.setAttribute('fill', liked ? '#f472b6' : 'none');
    heart.setAttribute('stroke', liked ? '#f472b6' : 'currentColor');
  }

  // ── Bottom Navigation ─────────────────────────────────────────────────────
  function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => Router.navigate(item.dataset.view));
    });

    // Home search trigger
    document.getElementById('search-trigger')?.addEventListener('click', () => Router.navigate('search'));
    document.getElementById('search-trigger')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') Router.navigate('search');
    });
    document.getElementById('search-back')?.addEventListener('click', () => Router.navigate('home'));

    // Header buttons
    document.getElementById('btn-notifications')?.addEventListener('click', () => {
      document.getElementById('notifications-modal')?.classList.remove('hidden');
    });
    document.getElementById('btn-profile')?.addEventListener('click', () => Router.navigate('profile'));

    // Notifications modal close/save
    document.getElementById('notifications-close')?.addEventListener('click', () => {
      document.getElementById('notifications-modal')?.classList.add('hidden');
    });
    document.getElementById('notifications-save')?.addEventListener('click', () => {
      document.getElementById('notifications-modal')?.classList.add('hidden');
      Player.showToast('🔔 Notification preferences saved!');
    });
    document.getElementById('notifications-modal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('notifications-modal'))
        document.getElementById('notifications-modal').classList.add('hidden');
    });

    // Quality modal close on overlay
    document.getElementById('quality-modal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('quality-modal'))
        document.getElementById('quality-modal').classList.add('hidden');
    });
    document.getElementById('quality-close')?.addEventListener('click', () => {
      document.getElementById('quality-modal')?.classList.add('hidden');
    });
  }

  // ── Profile Page ──────────────────────────────────────────────────────────
  async function loadProfile() {
    try {
      const [{ history }, { songs: liked }, { playlists }, { ok, ytdlp }] = await Promise.all([
        API.getHistory(500).catch(() => ({ history: [] })),
        API.getLikes().catch(() => ({ songs: [] })),
        API.getPlaylists().catch(() => ({ playlists: [] })),
        API.status().catch(() => ({ ok: false, ytdlp: false })),
      ]);

      document.getElementById('stat-songs').textContent     = history.length;
      document.getElementById('stat-liked').textContent     = liked.length;
      document.getElementById('stat-playlists').textContent = playlists.length;
      document.getElementById('ytdlp-status-val').textContent = ytdlp
        ? '✅ Installed & ready'
        : '❌ Not installed (run: pip3 install yt-dlp)';
    } catch {}

    // Sleep timer settings
    document.getElementById('setting-sleep-timer')?.addEventListener('click', () => {
      document.getElementById('sleep-modal')?.classList.remove('hidden');
    });
    Player.on('sleepTimerSet', (min) => {
      document.getElementById('sleep-timer-val').textContent = min > 0 ? `${min} min` : 'Off';
    });

    // Audio quality setting
    const qualityLabels = { best: 'Best Available', high: 'High (~320kbps)', medium: 'Medium (~128kbps)', low: 'Data Saver' };
    let currentQuality = localStorage.getItem('audioQuality') || 'best';
    const qualValEl = document.querySelector('#setting-quality .setting-val');
    if (qualValEl) qualValEl.textContent = qualityLabels[currentQuality] || 'Best Available';

    document.getElementById('setting-quality')?.addEventListener('click', () => {
      // Mark the current selection
      document.querySelectorAll('.quality-opt').forEach(opt => {
        const check = opt.querySelector('.quality-check');
        if (check) check.classList.toggle('hidden', opt.dataset.q !== currentQuality);
      });
      document.getElementById('quality-modal')?.classList.remove('hidden');
    });

    document.querySelectorAll('.quality-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        currentQuality = opt.dataset.q;
        localStorage.setItem('audioQuality', currentQuality);
        // Update checkmarks
        document.querySelectorAll('.quality-opt .quality-check').forEach(c => c.classList.add('hidden'));
        opt.querySelector('.quality-check')?.classList.remove('hidden');
        // Update profile display
        if (qualValEl) qualValEl.textContent = qualityLabels[currentQuality];
        document.getElementById('quality-modal')?.classList.add('hidden');
        Player.showToast(`🎵 Audio quality set to ${qualityLabels[currentQuality]}`);
      });
    });

    // Clear history
    document.getElementById('setting-clear-history')?.addEventListener('click', async () => {
      if (confirm('Clear all play history?')) {
        await API.clearHistory();
        Player.showToast('🗑️ History cleared');
        document.getElementById('stat-songs').textContent = '0';
      }
    });
  }

  // ── Splash screen ──────────────────────────────────────────────────────────
  async function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Load liked IDs into cache
    API.getLikes().then(({ songs }) => {
      likedSongIds = new Set(songs.map(s => s.video_id));
    }).catch(() => {});

    // Init modules
    initNavigation();
    initMiniPlayer();
    HomeModule?.initHome();

    // Hide splash after delay
    setTimeout(() => {
      document.getElementById('splash')?.classList.add('hide');
      setTimeout(() => document.getElementById('splash')?.remove(), 700);
    }, 2400);
  }

  // ── Expose globally ────────────────────────────────────────────────────────
  window.AppRouter = Router;

  document.addEventListener('DOMContentLoaded', init);
})();
