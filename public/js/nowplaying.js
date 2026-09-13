/* ═══════════════════════════════════════════════════════════
   VIBE_ON — Now Playing Full-Screen Page
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const el = {
    page:           () => document.getElementById('now-playing'),
    bg:             () => document.getElementById('np-bg'),
    artwork:        () => document.getElementById('np-artwork'),
    artworkWrap:    () => document.getElementById('np-artwork-container'),
    artworkGlow:    () => document.getElementById('np-artwork-glow'),
    title:          () => document.getElementById('np-title'),
    artist:         () => document.getElementById('np-artist'),
    likeBtn:        () => document.getElementById('np-like-btn'),
    heart:          () => document.getElementById('np-heart'),
    progressBar:    () => document.getElementById('np-progress-bar'),
    progressFill:   () => document.getElementById('np-progress-fill'),
    progressThumb:  () => document.getElementById('np-progress-thumb'),
    currentTime:    () => document.getElementById('np-current-time'),
    duration:       () => document.getElementById('np-duration'),
    playBtn:        () => document.getElementById('np-play-btn'),
    playIcon:       () => document.getElementById('np-play-icon'),
    prevBtn:        () => document.getElementById('np-prev-btn'),
    nextBtn:        () => document.getElementById('np-next-btn'),
    shuffleBtn:     () => document.getElementById('np-shuffle-btn'),
    repeatBtn:      () => document.getElementById('np-repeat-btn'),
    backBtn:        () => document.getElementById('np-back-btn'),
    sleepBtn:       () => document.getElementById('np-sleep-btn'),
    sleepLabel:     () => document.getElementById('sleep-btn-label'),
    downloadBtn:    () => document.getElementById('np-download-btn'),
    downloadLabel:  () => document.getElementById('download-btn-label'),
    addPlaylistBtn: () => document.getElementById('np-add-playlist-btn'),
    optionsBtn:     () => document.getElementById('np-options-btn'),
    upnextList:     () => document.getElementById('np-upnext-list'),
    dragHandle:     () => document.getElementById('np-drag-handle'),
  };

  let likedCache = new Set();
  let isDragging = false;

  // ── Open / Close ─────────────────────────────────────────────────────────
  function open() {
    el.page().classList.remove('hidden');
    setTimeout(() => el.page().classList.add('visible'), 20);
    updateLikeState();
    Player.drawWaveform();
  }

  function close() {
    el.page().classList.remove('visible');
    setTimeout(() => el.page().classList.add('hidden'), 450);
  }

  // ── Update UI ─────────────────────────────────────────────────────────────
  function updateSong(song) {
    if (!song) return;
    el.title().textContent  = song.title  || 'Unknown';
    el.artist().textContent = song.artist || 'Unknown Artist';

    const thumb = API.thumb(song.video_id);
    el.artwork().src = thumb;
    el.artwork().onerror = () => { el.artwork().src = `https://picsum.photos/seed/${song.video_id}/400/400`; };

    // Blurred background
    el.bg().style.backgroundImage = `url(${thumb})`;

    // Glow colour (cyan by default; can be dynamic later)
    el.artworkGlow().style.background =
      'radial-gradient(circle, rgba(0,212,255,.35) 0%, transparent 70%)';

    updateLikeState();
  }

  function updateLikeState() {
    const song = Player.state.currentSong;
    if (!song) return;
    const liked = likedCache.has(song.video_id);
    el.heart().setAttribute('fill', liked ? '#f472b6' : 'none');
    el.likeBtn().classList.toggle('liked', liked);
  }

  function updatePlayState(isPlaying) {
    const icon = el.playIcon();
    if (isPlaying) {
      icon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      el.artworkWrap().classList.add('playing');
      el.artworkWrap().classList.remove('paused');
    } else {
      icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      el.artworkWrap().classList.add('paused');
      el.artworkWrap().classList.remove('playing');
    }
  }

  function updateProgress({ currentTime, duration, pct }) {
    el.progressFill().style.width = `${(pct || 0) * 100}%`;
    el.progressThumb().style.right = 'auto';
    el.progressThumb().style.left  = `calc(${(pct || 0) * 100}% - 6px)`;
    el.currentTime().textContent = Player.formatTime(currentTime);
    el.duration().textContent    = Player.formatTime(duration);
  }

  function updateShuffleBtn(on) {
    el.shuffleBtn().classList.toggle('active', on);
  }

  function updateRepeatBtn(mode) {
    const btn = el.repeatBtn();
    btn.classList.toggle('active', mode !== 'none');
    // Show badge for repeat-one
    let badge = btn.querySelector('.repeat-badge');
    if (mode === 'one') {
      if (!badge) { badge = document.createElement('div'); badge.className = 'repeat-badge'; btn.style.position = 'relative'; btn.appendChild(badge); }
      badge.textContent = '1';
    } else {
      if (badge) badge.remove();
    }
  }

  // ── Up Next list ─────────────────────────────────────────────────────────
  function renderQueue(queue) {
    const list = el.upnextList();
    if (!queue || !queue.length) {
      list.innerHTML = '<div class="upnext-loading">No songs in queue yet…</div>';
      return;
    }
    list.innerHTML = queue.slice(0, 10).map((s, i) => `
      <div class="upnext-item" data-idx="${i}" data-id="${s.video_id}" tabindex="0" role="button" aria-label="Play ${s.title}">
        <img class="upnext-thumb" src="${API.thumb(s.video_id)}"
             onerror="this.src='https://picsum.photos/seed/${s.video_id}/80/80'"
             alt="${s.title}" loading="lazy" />
        <div class="upnext-info">
          <div class="upnext-title">${escHtml(s.title)}</div>
          <div class="upnext-artist">${escHtml(s.artist)}</div>
        </div>
        <span class="upnext-dur">${s.duration || ''}</span>
      </div>
    `).join('');

    list.querySelectorAll('.upnext-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx);
        Player.playSongFromQueue(idx);
        close();
      });
    });
  }

  // ── Sleep Timer UI ───────────────────────────────────────────────────────
  function updateSleepLabel(minutes) {
    el.sleepLabel().textContent = minutes > 0 ? `${minutes}m` : 'Sleep';
    el.sleepBtn().classList.toggle('active', minutes > 0);
  }

  // ── Download ─────────────────────────────────────────────────────────────
  async function handleDownload() {
    const song = Player.state.currentSong;
    if (!song) return;
    el.downloadBtn().classList.add('active');
    el.downloadLabel().textContent = 'Saving…';
    try {
      await API.download(song);
      el.downloadLabel().textContent = 'Saved ✓';
      Player.showToast('⬇️ Download started! Check your Library.');
    } catch (e) {
      el.downloadLabel().textContent = 'Save';
      Player.showToast('❌ Download failed: ' + e.message);
    }
  }

  // ── Add to Playlist ───────────────────────────────────────────────────────
  async function openPlaylistModal() {
    const song = Player.state.currentSong;
    if (!song) return;
    const modal = document.getElementById('playlist-modal');
    const list  = document.getElementById('playlist-modal-list');

    const { playlists } = await API.getPlaylists().catch(() => ({ playlists: [] }));
    list.innerHTML = playlists.length
      ? playlists.map(p => `
          <div class="playlist-modal-item" data-id="${p.id}" tabindex="0" role="button">
            <img class="playlist-modal-thumb" src="${p.cover || `https://picsum.photos/seed/pl${p.id}/80/80`}"
                 onerror="this.src='https://picsum.photos/seed/pl${p.id}/80/80'" alt="${p.name}" />
            <div class="playlist-modal-name">${escHtml(p.name)}</div>
            <div class="playlist-modal-count">${p.song_count || 0} songs</div>
          </div>`)
        .join('')
      : '<div style="text-align:center;color:var(--txt3);padding:24px 0">No playlists yet. Create one!</div>';

    list.querySelectorAll('.playlist-modal-item').forEach(item => {
      item.addEventListener('click', async () => {
        await API.addToPlaylist(item.dataset.id, song);
        modal.classList.add('hidden');
        Player.showToast('✅ Added to playlist!');
      });
    });

    modal.classList.remove('hidden');
  }

  // ── Progress bar seek ─────────────────────────────────────────────────────
  function initProgressSeek() {
    const bar = el.progressBar();
    let seeking = false;

    function seek(e) {
      const rect = bar.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      Player.seek(pct);
    }

    bar.addEventListener('mousedown', (e) => { seeking = true; seek(e); });
    bar.addEventListener('touchstart', (e) => { seeking = true; seek(e.touches[0]); }, { passive: true });
    document.addEventListener('mousemove', (e) => { if (seeking) seek(e); });
    document.addEventListener('touchmove', (e) => { if (seeking) seek(e.touches[0]); }, { passive: true });
    document.addEventListener('mouseup',  () => { seeking = false; });
    document.addEventListener('touchend', () => { seeking = false; });
  }

  // ── Drag to close ─────────────────────────────────────────────────────────
  function initDragClose() {
    const handle = el.dragHandle();
    const page   = el.page();
    let startY = 0, currentY = 0;

    function onStart(e) {
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      isDragging = true;
    }
    function onMove(e) {
      if (!isDragging) return;
      currentY = (e.touches ? e.touches[0].clientY : e.clientY) - startY;
      if (currentY < 0) currentY = 0;
      page.style.transform = `translateY(${currentY}px)`;
    }
    function onEnd() {
      if (!isDragging) return;
      isDragging = false;
      if (currentY > 120) { page.style.transform = ''; close(); }
      else { page.style.transform = ''; }
      currentY = 0;
    }

    handle.addEventListener('touchstart', onStart, { passive: true });
    handle.addEventListener('touchmove',  onMove,  { passive: true });
    handle.addEventListener('touchend',   onEnd);
    handle.addEventListener('mousedown',  onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onEnd);
  }

  // ── Options Menu ─────────────────────────────────────────────────────────
  function openOptions() {
    const song = Player.state.currentSong;
    if (!song) return;
    const modal    = document.getElementById('options-modal');
    const songInfo = document.getElementById('options-song-info');
    const optList  = document.getElementById('options-list');

    songInfo.innerHTML = `
      <img class="options-thumb" src="${API.thumb(song.video_id)}"
           onerror="this.src='https://picsum.photos/seed/${song.video_id}/80/80'" alt="" />
      <div class="options-info">
        <div class="options-title">${escHtml(song.title)}</div>
        <div class="options-artist">${escHtml(song.artist)}</div>
      </div>`;

    const options = [
      { icon:'❤️', text:'Like / Unlike', action: () => { Player.toggleLike(song); modal.classList.add('hidden'); } },
      { icon:'➕', text:'Add to Playlist', action: () => { modal.classList.add('hidden'); openPlaylistModal(); } },
      { icon:'⬇️', text:'Download',       action: () => { modal.classList.add('hidden'); handleDownload(); } },
      { icon:'⏭️', text:'Play Next',      action: () => { Player.addToQueueFront(song); modal.classList.add('hidden'); Player.showToast('⏭️ Playing next!'); } },
      { icon:'🔗', text:'Share',          action: () => { if (navigator.share) navigator.share({ title: song.title, text: `${song.title} — ${song.artist}`, url: `https://youtube.com/watch?v=${song.video_id}` }); modal.classList.add('hidden'); } },
      { icon:'📋', text:'View on YouTube', action: () => { window.open(`https://youtube.com/watch?v=${song.video_id}`, '_blank'); modal.classList.add('hidden'); } },
    ];

    optList.innerHTML = options.map((o, i) => `
      <div class="options-item" data-idx="${i}" tabindex="0" role="button">
        <span class="options-item-icon">${o.icon}</span>
        <span class="options-item-text">${o.text}</span>
      </div>`).join('');

    optList.querySelectorAll('.options-item').forEach(item => {
      item.addEventListener('click', () => options[parseInt(item.dataset.idx)].action());
    });

    modal.classList.remove('hidden');
  }

  // ── Bind events ───────────────────────────────────────────────────────────
  function init() {
    // Controls
    el.backBtn().addEventListener('click', close);
    el.playBtn().addEventListener('click', Player.togglePlay);
    el.prevBtn().addEventListener('click', Player.playPrev);
    el.nextBtn().addEventListener('click', () => Player.playNext(true));
    el.shuffleBtn().addEventListener('click', Player.toggleShuffle);
    el.repeatBtn().addEventListener('click', Player.cycleRepeat);
    el.likeBtn().addEventListener('click', () => {
      Player.toggleLike().then(liked => {
        liked ? likedCache.add(Player.state.currentSong?.video_id)
               : likedCache.delete(Player.state.currentSong?.video_id);
        updateLikeState();
      });
    });
    el.sleepBtn().addEventListener('click', () => {
      document.getElementById('sleep-modal').classList.remove('hidden');
    });
    el.downloadBtn().addEventListener('click', handleDownload);
    el.addPlaylistBtn().addEventListener('click', openPlaylistModal);
    el.optionsBtn().addEventListener('click', openOptions);

    // Share
    document.getElementById('np-share-btn')?.addEventListener('click', () => {
      const song = Player.state.currentSong;
      if (!song) return;
      if (navigator.share) navigator.share({ title: song.title, text: `${song.title} — ${song.artist}`, url: `https://youtube.com/watch?v=${song.video_id}` });
    });

    // Sleep modal
    const sleepModal = document.getElementById('sleep-modal');
    sleepModal?.querySelectorAll('.sleep-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const min = parseInt(btn.dataset.min);
        Player.setSleepTimer(min);
        sleepModal.querySelectorAll('.sleep-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sleepModal.classList.add('hidden');
      });
    });

    // Close playlist / options modals on overlay click
    ['playlist-modal', 'options-modal', 'sleep-modal', 'create-playlist-modal'].forEach(id => {
      const m = document.getElementById(id);
      if (!m) return;
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
    });

    // Create playlist from modal
    document.getElementById('modal-create-playlist-btn')?.addEventListener('click', () => {
      document.getElementById('playlist-modal').classList.add('hidden');
      document.getElementById('create-playlist-modal').classList.remove('hidden');
    });
    document.getElementById('create-pl-cancel')?.addEventListener('click', () => {
      document.getElementById('create-playlist-modal').classList.add('hidden');
    });
    document.getElementById('create-pl-confirm')?.addEventListener('click', async () => {
      const name = document.getElementById('new-playlist-name').value.trim();
      if (!name) return;
      const desc = document.getElementById('new-playlist-desc').value.trim();
      await API.createPlaylist(name, desc);
      document.getElementById('create-playlist-modal').classList.add('hidden');
      Player.showToast('✅ Playlist created!');
    });

    initProgressSeek();
    initDragClose();

    // Player events
    Player.on('songChanged',   updateSong);
    Player.on('playState',     updatePlayState);
    Player.on('progress',      updateProgress);
    Player.on('shuffleChanged',updateShuffleBtn);
    Player.on('repeatChanged', updateRepeatBtn);
    Player.on('queueUpdated',  renderQueue);
    Player.on('sleepTimerSet', updateSleepLabel);
    Player.on('likeChanged',   ({ videoId, liked }) => {
      liked ? likedCache.add(videoId) : likedCache.delete(videoId);
      updateLikeState();
    });

    // Load liked cache
    API.getLikes().then(({ songs }) => {
      likedCache = new Set(songs.map(s => s.video_id));
    }).catch(() => {});

    initLyrics();
  }

  // ── Lyrics Controller ─────────────────────────────────────────────────────
  function initLyrics() {
    const btn      = document.getElementById('np-lyrics-btn');
    const page     = document.getElementById('np-lyrics-page');
    const closeBtn = document.getElementById('lyrics-close-btn');
    const content  = document.getElementById('lyrics-content');
    const scroll   = document.getElementById('lyrics-scroll-container');
    let lyricsData = null;
    let activeLineIdx = -1;

    // Open / Close
    btn?.addEventListener('click', () => {
      page.classList.add('visible');
      const song = Player.state.currentSong;
      if (!song) return;
      document.getElementById('lyrics-song-title').textContent = song.title;
      document.getElementById('lyrics-song-artist').textContent = song.artist;
      loadLyrics(song);
    });

    closeBtn?.addEventListener('click', () => {
      page.classList.remove('visible');
    });

    // Fetch and render
    async function loadLyrics(song) {
      content.innerHTML = `
        <div class="lyrics-loading-state">
          <div class="lyrics-spinner"></div>
          <span>Finding lyrics…</span>
        </div>`;
      document.getElementById('lyrics-sync-tag').style.display = 'none';
      lyricsData = null;

      try {
        const res = await API.lyrics(song.video_id, song.title, song.artist);
        lyricsData = res.lyrics;

        if (!lyricsData || (!lyricsData.synced && !lyricsData.plain)) {
          content.innerHTML = `
            <div class="lyrics-not-found-state">
              <div class="lyrics-icon">📝</div>
              <span>No lyrics found for this song</span>
              <small>Try another song</small>
            </div>`;
          return;
        }

        const tag = document.getElementById('lyrics-sync-tag');
        tag.style.display = 'inline-flex';
        if (lyricsData.synced) {
          tag.className = 'lyrics-sync-tag';
          tag.innerHTML = '<svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> SYNCED';
        } else {
          tag.className = 'lyrics-sync-tag static';
          tag.innerHTML = 'STATIC';
        }

        renderLines();
      } catch (e) {
        content.innerHTML = `<div class="lyrics-not-found-state"><span>Error loading lyrics</span></div>`;
      }
    }

    function renderLines() {
      if (!lyricsData || !lyricsData.lines.length) return;
      content.innerHTML = '<div class="lyrics-spacer"></div>' +
        lyricsData.lines.map((l, i) => `<div class="lyric-line" id="lyr-${i}" data-time="${l.time}">${escHtml(l.text)}</div>`).join('') +
        '<div class="lyrics-spacer"></div>';

      // Tap to seek (only if synced)
      if (lyricsData.synced) {
        content.querySelectorAll('.lyric-line').forEach((el, i) => {
          el.addEventListener('click', () => {
            const t = parseFloat(el.dataset.time);
            if (!isNaN(t) && Player.audio.duration) {
              Player.seek(t / Player.audio.duration);
              Player.audio.play();
            }
          });
        });
      }
      activeLineIdx = -1;
      updateSync(Player.audio.currentTime);
    }

    // Sync on progress
    Player.on('progress', ({ currentTime, duration, pct }) => {
      if (!page.classList.contains('visible')) return;
      
      // Update mini controls in lyrics view
      document.getElementById('lyrics-progress-fill').style.width = `${pct * 100}%`;
      document.getElementById('lyrics-current-time').textContent = Player.formatTime(currentTime);
      document.getElementById('lyrics-duration').textContent = Player.formatTime(duration);
      
      updateSync(currentTime);
    });

    function updateSync(currentTime) {
      if (!lyricsData || !lyricsData.synced) return;
      const lines = lyricsData.lines;
      
      // Find the current line (the last one whose time is <= currentTime)
      let newIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (currentTime >= lines[i].time - 0.3) { // 0.3s anticipation
          newIdx = i;
        } else {
          break;
        }
      }

      if (newIdx !== activeLineIdx && newIdx !== -1) {
        activeLineIdx = newIdx;
        
        // Remove classes from all
        const els = content.querySelectorAll('.lyric-line');
        els.forEach(el => {
          el.classList.remove('active');
          el.classList.remove('near');
        });

        // Add active & near
        if (els[newIdx]) els[newIdx].classList.add('active');
        if (els[newIdx-1]) els[newIdx-1].classList.add('near');
        if (els[newIdx+1]) els[newIdx+1].classList.add('near');

        // Scroll to center
        const activeEl = els[newIdx];
        if (activeEl) {
          const scrollTarget = activeEl.offsetTop - scroll.offsetHeight / 2 + activeEl.offsetHeight / 2;
          scroll.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        }
      }
    }

    // Bind mini controls
    document.getElementById('lyrics-play-btn').addEventListener('click', Player.togglePlay);
    document.getElementById('lyrics-prev-btn').addEventListener('click', Player.playPrev);
    document.getElementById('lyrics-next-btn').addEventListener('click', () => Player.playNext(true));
    
    const progBar = document.getElementById('lyrics-progress-bar');
    let seeking = false;
    function seek(e) {
      const rect = progBar.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      Player.seek(pct);
    }
    progBar.addEventListener('mousedown', (e) => { seeking = true; seek(e); });
    progBar.addEventListener('touchstart', (e) => { seeking = true; seek(e.touches[0]); }, { passive: true });
    document.addEventListener('mousemove', (e) => { if (seeking && page.classList.contains('visible')) seek(e); });
    document.addEventListener('touchmove', (e) => { if (seeking && page.classList.contains('visible')) seek(e.touches[0]); }, { passive: true });
    document.addEventListener('mouseup',  () => { seeking = false; });
    document.addEventListener('touchend', () => { seeking = false; });

    Player.on('playState', (isPlaying) => {
      const icon = document.getElementById('lyrics-play-icon');
      if (!icon) return;
      icon.innerHTML = isPlaying
        ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
        : '<path d="M8 5v14l11-7z"/>';
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  document.addEventListener('DOMContentLoaded', init);

  window.NowPlaying = { open, close };
})();
