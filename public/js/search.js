/* ═══════════════════════════════════════════════════════════
   VIBE_ON — Search Page
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const TRENDING_TERMS = [
    'APT ROSÉ Bruno Mars','Arijit Singh 2025','AP Dhillon new song',
    'Karan Aujla','Dua Lipa latest','Kesariya','Pasoori',
    'Trending Punjabi 2025','Haryanvi hits 2025','Bollywood 2025',
    'Billie Eilish','Sabrina Carpenter','The Weeknd','Kendrick Lamar',
    'Diljit Dosanjh','Badshah new song','Lo-fi chill beats',
  ];

  let searchTimeout = null;
  let lastQuery = '';
  let isSearching = false;

  function init() {
    const input   = document.getElementById('search-input');
    const clearBtn= document.getElementById('search-clear');
    const back    = document.getElementById('search-back');
    const content = document.getElementById('search-content');

    if (!input) return;

    // Show default state
    showDefault();

    // Input handler
    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearBtn.classList.toggle('hidden', !q);

      if (!q) { showDefault(); lastQuery = ''; return; }
      if (q === lastQuery) return;

      // Show suggestions immediately
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        lastQuery = q;
        doSearch(q);
      }, 500);

      // Live suggestions
      API.suggestions(q).then(({ suggestions }) => {
        if (input.value.trim() && !isSearching) showSuggestions(q, suggestions);
      }).catch(() => {});
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        const q = input.value.trim();
        if (q) { lastQuery = q; doSearch(q); input.blur(); }
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = ''; clearBtn.classList.add('hidden');
      lastQuery = ''; showDefault();
    });

    back.addEventListener('click', () => {
      window.AppRouter?.navigate('home');
    });
  }

  // ── Default state (recent + trending chips) ───────────────────────────────
  async function showDefault() {
    const content = document.getElementById('search-content');
    if (!content) return;

    const { history: recent } = await API.getSearchHistory().catch(() => ({ history: [] }));

    content.innerHTML = `
      ${recent.length ? `
      <div class="recent-section">
        <div class="section-label">
          Recent Searches
          <button class="clear-all-btn" id="clear-all-history">Clear All</button>
        </div>
        <div class="recent-list">
          ${recent.slice(0,8).map(h => `
            <div class="recent-item" data-query="${escHtml(h.query)}">
              <svg class="recent-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span class="recent-text">${escHtml(h.query)}</span>
              <button class="recent-delete" data-q="${escHtml(h.query)}" aria-label="Remove">✕</button>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="trending-chips-section">
        <div class="section-label">Trending Searches 🔥</div>
        <div class="trending-chips">
          ${TRENDING_TERMS.map((t, i) => `<button class="trend-chip${i < 3 ? ' hot' : ''}" data-query="${escHtml(t)}">${t}</button>`).join('')}
        </div>
      </div>`;

    // Bind recent clicks
    content.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('recent-delete')) return;
        const q = item.dataset.query;
        const inp = document.getElementById('search-input');
        if (inp) { inp.value = q; inp.dispatchEvent(new Event('input')); doSearch(q); }
      });
    });

    // Delete recent
    content.querySelectorAll('.recent-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await API.removeSearchHistory(btn.dataset.q);
        showDefault();
      });
    });

    // Clear all
    content.querySelector('#clear-all-history')?.addEventListener('click', async () => {
      await API.clearSearchHistory();
      showDefault();
    });

    // Trend chips
    content.querySelectorAll('.trend-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.query;
        const inp = document.getElementById('search-input');
        if (inp) {
          inp.value = q;
          document.getElementById('search-clear')?.classList.remove('hidden');
          doSearch(q);
        }
      });
    });
  }

  // ── Suggestions ───────────────────────────────────────────────────────────
  function showSuggestions(q, suggs) {
    if (isSearching) return;
    const content = document.getElementById('search-content');
    if (!content) return;
    if (!suggs?.length) return;

    content.innerHTML = `
      <div class="recent-section">
        <div class="section-label">Suggestions</div>
        <div class="recent-list">
          ${suggs.map(s => `
            <div class="recent-item" data-query="${escHtml(s)}">
              <svg class="recent-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span class="recent-text">${escHtml(s)}</span>
            </div>`).join('')}
        </div>
      </div>`;

    content.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const inp = document.getElementById('search-input');
        if (inp) { inp.value = item.dataset.query; doSearch(item.dataset.query); }
      });
    });
  }

  // ── Search ────────────────────────────────────────────────────────────────
  async function doSearch(q) {
    if (!q) return;
    isSearching = true;

    const content = document.getElementById('search-content');
    if (!content) return;

    content.innerHTML = `
      <div class="search-loading">
        <div style="font-size:28px;margin-bottom:12px">🔍</div>
        Searching for "<strong>${escHtml(q)}</strong>"…
      </div>`;

    try {
      const { songs } = await API.search(q, 25);
      isSearching = false;
      renderResults(songs, q);
    } catch (e) {
      isSearching = false;
      content.innerHTML = `
        <div class="search-empty">
          <div class="search-empty-icon">😕</div>
          <div>Search failed</div>
          <div style="font-size:13px;margin-top:8px;color:var(--txt3)">${e.message}</div>
        </div>`;
    }
  }

  function renderResults(songs, q) {
    const content = document.getElementById('search-content');
    if (!content) return;

    if (!songs?.length) {
      content.innerHTML = `
        <div class="search-empty">
          <div class="search-empty-icon">🎵</div>
          <div>No results for "<strong>${escHtml(q)}</strong>"</div>
          <div style="font-size:13px;margin-top:8px;color:var(--txt3)">Try a different search term</div>
        </div>`;
      return;
    }

    content.innerHTML = `
      <div style="padding:4px 0 12px;font-size:13px;color:var(--txt3)">${songs.length} results</div>
      <div class="search-results">
        ${songs.map((s, i) => `
          <div class="result-item" data-idx="${i}" tabindex="0" role="button" aria-label="Play ${s.title}">
            <img class="result-thumb"
                 src="${API.thumb(s.video_id)}"
                 onerror="this.src='https://picsum.photos/seed/${s.video_id}/100/100'"
                 alt="${s.title}" loading="lazy" />
            <div class="result-info">
              <div class="result-title">${escHtml(s.title)}</div>
              <div class="result-artist">${escHtml(s.artist)}</div>
            </div>
            <span class="result-dur">${s.duration || ''}</span>
            <button class="result-more-btn" data-idx="${i}" aria-label="More options">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
          </div>`).join('')}
      </div>`;

    content.querySelectorAll('.result-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.result-more-btn')) return;
        const idx = parseInt(item.dataset.idx);
        const next = songs.filter((_, j) => j !== idx);
        Player.state.queue = next;
        Player.loadSong(songs[idx]);
        NowPlaying.open();
      });

      item.querySelector('.result-more-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(item.dataset.idx);
        showSongOptions(songs[idx], songs);
      });
    });
  }

  function showSongOptions(song, allSongs) {
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

    const actions = [
      { icon:'▶️', text:'Play Now',         fn: () => { Player.loadSong(song); NowPlaying.open(); modal.classList.add('hidden'); } },
      { icon:'⏭️', text:'Play Next',        fn: () => { Player.addToQueueFront(song); modal.classList.add('hidden'); Player.showToast('⏭️ Added to queue!'); } },
      { icon:'❤️', text:'Like',             fn: () => { Player.toggleLike(song); modal.classList.add('hidden'); } },
      { icon:'➕', text:'Add to Playlist',  fn: () => { modal.classList.add('hidden'); openPlaylistModal(song); } },
      { icon:'⬇️', text:'Download',         fn: () => { API.download(song); modal.classList.add('hidden'); Player.showToast('⬇️ Download started!'); } },
    ];

    optList.innerHTML = actions.map((a, i) => `
      <div class="options-item" data-idx="${i}" tabindex="0" role="button">
        <span class="options-item-icon">${a.icon}</span>
        <span class="options-item-text">${a.text}</span>
      </div>`).join('');

    optList.querySelectorAll('.options-item').forEach(item => {
      item.addEventListener('click', () => actions[parseInt(item.dataset.idx)].fn());
    });

    modal.classList.remove('hidden');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); }, { once: true });
  }

  async function openPlaylistModal(song) {
    const modal = document.getElementById('playlist-modal');
    const list  = document.getElementById('playlist-modal-list');
    const { playlists } = await API.getPlaylists().catch(() => ({ playlists: [] }));

    list.innerHTML = playlists.length
      ? playlists.map(p => `
          <div class="playlist-modal-item" data-id="${p.id}" tabindex="0" role="button">
            <img class="playlist-modal-thumb"
                 src="${p.cover || ''}"
                 onerror="this.src='https://picsum.photos/seed/pl${p.id}/80/80'" alt="${p.name}" />
            <div class="playlist-modal-name">${escHtml(p.name)}</div>
            <div class="playlist-modal-count">${p.song_count || 0}</div>
          </div>`)
        .join('')
      : '<div style="text-align:center;color:var(--txt3);padding:24px">No playlists yet!</div>';

    list.querySelectorAll('.playlist-modal-item').forEach(item => {
      item.addEventListener('click', async () => {
        await API.addToPlaylist(item.dataset.id, song);
        modal.classList.add('hidden');
        Player.showToast('✅ Added to playlist!');
      });
    });
    modal.classList.remove('hidden');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); }, { once: true });
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.SearchModule = { init, doSearch };
  });
})();
