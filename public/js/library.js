/* ═══════════════════════════════════════════════════════════
   VIBE_ON — Library Page (Liked, History, Playlists, Downloads)
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let activeTab = 'liked';

  function init() {
    // Tab switching
    document.querySelectorAll('.lib-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lib-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        loadTab(activeTab);
      });
    });

    // New playlist button
    document.getElementById('btn-new-playlist')?.addEventListener('click', () => {
      document.getElementById('create-playlist-modal')?.classList.remove('hidden');
    });

    document.getElementById('create-pl-confirm')?.addEventListener('click', async () => {
      const name = document.getElementById('new-playlist-name')?.value.trim();
      if (!name) return;
      const desc = document.getElementById('new-playlist-desc')?.value.trim();
      await API.createPlaylist(name, desc);
      document.getElementById('create-playlist-modal').classList.add('hidden');
      document.getElementById('new-playlist-name').value = '';
      document.getElementById('new-playlist-desc').value = '';
      Player.showToast('✅ Playlist created!');
      if (activeTab === 'playlists') loadTab('playlists');
    });
    document.getElementById('create-pl-cancel')?.addEventListener('click', () => {
      document.getElementById('create-playlist-modal')?.classList.add('hidden');
    });
  }

  function loadTab(tab) {
    const content = document.getElementById('library-content');
    if (!content) return;
    content.innerHTML = '<div class="upnext-loading">Loading…</div>';

    switch (tab) {
      case 'liked':     return loadLiked(content);
      case 'history':   return loadHistory(content);
      case 'playlists': return loadPlaylists(content);
      case 'downloads': return loadDownloads(content);
    }
  }

  // ── Liked Songs ───────────────────────────────────────────────────────────
  async function loadLiked(container) {
    const { songs } = await API.getLikes().catch(() => ({ songs: [] }));
    if (!songs.length) {
      container.innerHTML = emptyState('❤️', 'No Liked Songs', 'Tap the heart on any song to save it here!');
      return;
    }
    container.innerHTML = `
      <div class="lib-header-row">
        <div class="lib-header-count">${songs.length} songs</div>
        <div class="lib-header-actions">
          <button class="lib-action-btn primary" id="play-liked">▶ Play All</button>
          <button class="lib-action-btn" id="shuffle-liked">⇌ Shuffle</button>
        </div>
      </div>
      <div class="lib-list">
        ${songs.map((s, i) => songItem(s, i)).join('')}
      </div>`;

    bindSongList(container, songs, 'liked');
    container.querySelector('#play-liked')?.addEventListener('click', () => {
      if (songs.length) { Player.state.queue = songs.slice(1); Player.loadSong(songs[0]); NowPlaying.open(); }
    });
    container.querySelector('#shuffle-liked')?.addEventListener('click', () => {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      Player.state.queue = shuffled.slice(1); Player.loadSong(shuffled[0]); NowPlaying.open();
    });
  }

  // ── Play History ──────────────────────────────────────────────────────────
  async function loadHistory(container) {
    const { history } = await API.getHistory(80).catch(() => ({ history: [] }));
    if (!history.length) {
      container.innerHTML = emptyState('🕐', 'No History', 'Songs you play will appear here!');
      return;
    }
    container.innerHTML = `
      <div class="lib-header-row">
        <div class="lib-header-count">${history.length} plays</div>
        <div class="lib-header-actions">
          <button class="lib-action-btn" id="clear-history-btn">🗑 Clear</button>
        </div>
      </div>
      <div class="lib-list">
        ${history.map((s, i) => songItem(s, i, s.play_count > 1 ? `Played ${s.play_count}×` : null)).join('')}
      </div>`;

    bindSongList(container, history, 'history');
    container.querySelector('#clear-history-btn')?.addEventListener('click', async () => {
      if (confirm('Clear all play history?')) {
        await API.clearHistory();
        loadTab('history');
        Player.showToast('🗑️ History cleared');
      }
    });
  }

  // ── Playlists ─────────────────────────────────────────────────────────────
  async function loadPlaylists(container) {
    const { playlists } = await API.getPlaylists().catch(() => ({ playlists: [] }));
    if (!playlists.length) {
      container.innerHTML = emptyState('📋', 'No Playlists', 'Create your first playlist and add songs!') +
        '<div style="padding:0 4px"><button class="btn-primary" id="create-pl-cta" style="margin-top:16px">+ Create Playlist</button></div>';
      container.querySelector('#create-pl-cta')?.addEventListener('click', () => {
        document.getElementById('create-playlist-modal')?.classList.remove('hidden');
      });
      return;
    }
    container.innerHTML = `
      <div class="lib-list">
        ${playlists.map(p => `
          <div class="lib-item" data-id="${p.id}" tabindex="0" role="button">
            <img class="lib-thumb"
                 src="${p.cover || `https://picsum.photos/seed/pl${p.id}/100/100`}"
                 onerror="this.src='https://picsum.photos/seed/pl${p.id}/100/100'"
                 alt="${p.name}" loading="lazy" />
            <div class="lib-info">
              <div class="lib-title">${escHtml(p.name)}</div>
              <div class="lib-sub">${p.song_count || 0} songs${p.description ? ' · ' + escHtml(p.description) : ''}</div>
            </div>
            <button class="lib-more-btn" data-id="${p.id}" aria-label="More options">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
          </div>`).join('')}
      </div>`;

    container.querySelectorAll('.lib-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.lib-more-btn')) return;
        openPlaylistView(parseInt(item.dataset.id));
      });
      item.querySelector('.lib-more-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        showPlaylistOptions(parseInt(item.dataset.id), playlists.find(p => p.id === parseInt(item.dataset.id)));
      });
    });
  }

  async function openPlaylistView(id) {
    const content = document.getElementById('library-content');
    content.innerHTML = '<div class="upnext-loading">Loading playlist…</div>';
    const { playlist } = await API.getPlaylist(id).catch(() => ({ playlist: null }));
    if (!playlist) { loadTab('playlists'); return; }

    const songs = playlist.songs || [];
    content.innerHTML = `
      <div class="playlist-view-header">
        <button class="back-btn" id="pl-view-back" style="margin-bottom:16px" aria-label="Back to playlists">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5m7-7-7 7 7 7"/></svg>
        </button>
        <img class="playlist-view-cover"
             src="${playlist.cover || `https://picsum.photos/seed/pl${id}/400/400`}"
             onerror="this.src='https://picsum.photos/seed/pl${id}/400/400'"
             alt="${playlist.name}" />
        <div class="playlist-view-name">${escHtml(playlist.name)}</div>
        ${playlist.description ? `<div class="playlist-view-desc">${escHtml(playlist.description)}</div>` : ''}
        <div style="font-size:13px;color:var(--txt3);margin-bottom:14px">${songs.length} songs</div>
        ${songs.length ? `
        <div class="playlist-view-actions">
          <button class="btn-primary" id="pl-play-all">▶ Play All</button>
          <button class="btn-secondary" id="pl-shuffle">⇌</button>
        </div>` : ''}
      </div>
      <div class="lib-list" id="pl-song-list">
        ${songs.length
          ? songs.map((s, i) => songItem(s, i)).join('')
          : '<div class="lib-empty"><div class="lib-empty-icon">🎵</div><div class="lib-empty-text">No songs yet</div><div class="lib-empty-sub">Add songs from search!</div></div>'}
      </div>`;

    content.querySelector('#pl-view-back')?.addEventListener('click', () => loadTab('playlists'));
    content.querySelector('#pl-play-all')?.addEventListener('click', () => {
      if (songs.length) { Player.state.queue = songs.slice(1); Player.loadSong(songs[0]); NowPlaying.open(); }
    });
    content.querySelector('#pl-shuffle')?.addEventListener('click', () => {
      const s = [...songs].sort(() => Math.random() - 0.5);
      Player.state.queue = s.slice(1); Player.loadSong(s[0]); NowPlaying.open();
    });
    bindSongList(content.querySelector('#pl-song-list'), songs, 'playlist', id);
  }

  function showPlaylistOptions(id, playlist) {
    const actions = [
      { icon:'▶️', text:'Play',   fn: async () => { const { playlist: p } = await API.getPlaylist(id); if (p?.songs?.length) { Player.state.queue = p.songs.slice(1); Player.loadSong(p.songs[0]); NowPlaying.open(); } } },
      { icon:'🗑️', text:'Delete', fn: async () => { if (confirm(`Delete "${playlist.name}"?`)) { await API.deletePlaylist(id); loadTab('playlists'); Player.showToast('🗑️ Playlist deleted'); } } },
    ];
    showGenericOptions(null, actions);
  }

  // ── Downloads ─────────────────────────────────────────────────────────────
  async function loadDownloads(container) {
    const { downloads } = await API.getDownloads().catch(() => ({ downloads: [] }));
    if (!downloads.length) {
      container.innerHTML = emptyState('⬇️', 'No Downloads', 'Download songs to listen offline!');
      return;
    }
    container.innerHTML = `
      <div class="lib-header-row">
        <div class="lib-header-count">${downloads.length} files · ${formatBytes(downloads.reduce((a,b)=>a+(b.file_size||0),0))}</div>
      </div>
      <div class="lib-list">
        ${downloads.map((s, i) => `
          <div class="lib-item" data-idx="${i}" tabindex="0" role="button">
            <img class="lib-thumb"
                 src="${API.thumb(s.video_id)}"
                 onerror="this.src='https://picsum.photos/seed/${s.video_id}/100/100'"
                 alt="${s.title}" loading="lazy" />
            <div class="lib-info">
              <div class="lib-title">${escHtml(s.title)}</div>
              <div class="lib-sub">${escHtml(s.artist)} · ${formatBytes(s.file_size)}</div>
            </div>
            <button class="lib-more-btn" data-id="${s.video_id}" data-title="${escHtml(s.title)}" aria-label="Delete">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6m4-6v6"/></svg>
            </button>
          </div>`).join('')}
      </div>`;

    container.querySelectorAll('.lib-item').forEach((item, i) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.lib-more-btn')) return;
        Player.state.queue = downloads.filter((_, j) => j !== i);
        Player.loadSong(downloads[i]);
        NowPlaying.open();
      });
      item.querySelector('.lib-more-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const vid = e.currentTarget.dataset.id;
        if (confirm(`Delete "${e.currentTarget.dataset.title}" from downloads?`)) {
          await API.deleteDownload(vid);
          loadTab('downloads');
          Player.showToast('🗑️ Download deleted');
        }
      });
    });
  }

  // ── Shared helpers ────────────────────────────────────────────────────────
  function songItem(s, i, sub = null) {
    return `
      <div class="lib-item" data-idx="${i}" tabindex="0" role="button" aria-label="Play ${s.title}">
        <img class="lib-thumb"
             src="${API.thumb(s.video_id)}"
             onerror="this.src='https://picsum.photos/seed/${s.video_id}/100/100'"
             alt="${s.title}" loading="lazy" />
        <div class="lib-info">
          <div class="lib-title">${escHtml(s.title)}</div>
          <div class="lib-sub">${escHtml(sub || s.artist || '')}</div>
        </div>
        <span class="lib-count">${s.duration || ''}</span>
        <button class="lib-more-btn" data-idx="${i}" aria-label="More options">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
      </div>`;
  }

  function bindSongList(container, songs, type, playlistId) {
    if (!container) return;
    container.querySelectorAll('.lib-item').forEach((item) => {
      const idx = parseInt(item.dataset.idx);
      item.addEventListener('click', (e) => {
        if (e.target.closest('.lib-more-btn')) return;
        const next = songs.filter((_, j) => j !== idx);
        Player.state.queue = next;
        Player.loadSong(songs[idx]);
        NowPlaying.open();
      });
      item.querySelector('.lib-more-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        showSongOptions(songs[idx], type, playlistId);
      });
    });
  }

  function showSongOptions(song, type, playlistId) {
    const actions = [
      { icon:'▶️', text:'Play Now',        fn: () => { Player.loadSong(song); NowPlaying.open(); } },
      { icon:'⏭️', text:'Play Next',       fn: () => { Player.addToQueueFront(song); Player.showToast('⏭️ Added to queue!'); } },
      { icon:'❤️', text:'Like',            fn: () => Player.toggleLike(song) },
      { icon:'⬇️', text:'Download',        fn: () => { API.download(song); Player.showToast('⬇️ Download started!'); } },
    ];
    if (type === 'playlist' && playlistId) {
      actions.push({ icon:'🗑️', text:'Remove from Playlist', fn: async () => { await API.removeFromPlaylist(playlistId, song.video_id); openPlaylistView(playlistId); Player.showToast('Removed from playlist'); } });
    }
    if (type === 'history') {
      actions.push({ icon:'🗑️', text:'Remove from History', fn: async () => { await API.removeHistory(song.video_id); loadTab('history'); Player.showToast('Removed from history'); } });
    }
    showGenericOptions(song, actions);
  }

  function showGenericOptions(song, actions) {
    const modal    = document.getElementById('options-modal');
    const songInfo = document.getElementById('options-song-info');
    const optList  = document.getElementById('options-list');

    if (song) {
      songInfo.innerHTML = `
        <img class="options-thumb" src="${API.thumb(song.video_id)}"
             onerror="this.src='https://picsum.photos/seed/${song.video_id}/80/80'" alt="" />
        <div class="options-info">
          <div class="options-title">${escHtml(song.title)}</div>
          <div class="options-artist">${escHtml(song.artist)}</div>
        </div>`;
    } else {
      songInfo.innerHTML = '';
    }

    optList.innerHTML = actions.map((a, i) => `
      <div class="options-item" data-idx="${i}" tabindex="0" role="button">
        <span class="options-item-icon">${a.icon}</span>
        <span class="options-item-text">${a.text}</span>
      </div>`).join('');

    optList.querySelectorAll('.options-item').forEach(item => {
      item.addEventListener('click', () => {
        actions[parseInt(item.dataset.idx)].fn();
        modal.classList.add('hidden');
      });
    });
    modal.classList.remove('hidden');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); }, { once: true });
  }

  function emptyState(icon, title, sub) {
    return `<div class="lib-empty"><div class="lib-empty-icon">${icon}</div><div class="lib-empty-text">${title}</div><div class="lib-empty-sub">${sub}</div></div>`;
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes > 1e6) return `${(bytes/1e6).toFixed(1)} MB`;
    if (bytes > 1e3) return `${(bytes/1e3).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.LibraryModule = { init, loadTab };
  });
})();
