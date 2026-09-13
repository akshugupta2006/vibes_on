/* ═══════════════════════════════════════════════════════════
   VIBE_ON — Home Page
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Category order (per user requirement)
  const CATEGORIES = [
    { key:'trending',     label:'🔥 Trending Now',    wide:false },
    { key:'newReleases',  label:'✨ New Releases',     wide:false },
    { key:'punjabi',      label:'🎵 Punjabi Bangers',  wide:false },
    { key:'haryanvi',     label:'🎤 Haryanvi Hits',    wide:false },
    { key:'mostListened', label:'🎧 Most Played By You', wide:true },
    { key:'global',       label:'🌍 Global Trending',  wide:false },
    { key:'bollywood',    label:'🎬 Bollywood Fresh',  wide:false },
    { key:'english',      label:'🎸 English Charts',   wide:false },
    { key:'hiphop',       label:'🎤 Hip-Hop Zone',     wide:false },
    { key:'lofi',         label:'🌙 Lo-Fi & Chill',    wide:false },
  ];

  let heroCycle, heroSongs = [], heroIdx = 0;

  // ── Bootstrap home ───────────────────────────────────────────────────────
  async function initHome() {
    setGreeting();
    await loadMeta(); // artists + static playlists
    loadAllCategories();
  }

  function setGreeting() {
    const h = new Date().getHours();
    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
    const el = document.getElementById('home-greeting');
    if (el) el.textContent = g + ', Akash 👋';
  }

  // ── Artists & Playlists (from server) ────────────────────────────────────
  async function loadMeta() {
    try {
      const { artists, playlists } = await API.homeCategories();
      renderArtists(artists);
      renderPlaylists(playlists);
    } catch { /* silently fail */ }
  }

  function renderArtists(artists) {
    const row = document.getElementById('artists-row');
    if (!row || !artists?.length) return;
    row.innerHTML = artists.map(a => `
      <div class="artist-card" tabindex="0" role="button" aria-label="Play ${a.name}" data-query="${escHtml(a.query)}">
        <div class="artist-thumb-wrap">
          <img class="artist-thumb" src="${a.image}"
               onerror="this.src='https://picsum.photos/seed/${encodeURIComponent(a.name)}/150/150'"
               alt="${a.name}" loading="lazy" />
        </div>
        <div class="artist-name">${escHtml(a.name)}</div>
      </div>`).join('');

    row.querySelectorAll('.artist-card').forEach(card => {
      card.addEventListener('click', () => {
        // Open search with artist name
        window.AppRouter?.navigate('search');
        setTimeout(() => {
          const inp = document.getElementById('search-input');
          if (inp) { inp.value = card.dataset.query; inp.dispatchEvent(new Event('input')); }
        }, 300);
      });
    });
  }

  function renderPlaylists(playlists) {
    const row = document.getElementById('playlists-row');
    if (!row || !playlists?.length) return;
    row.innerHTML = playlists.map(p => `
      <div class="playlist-card" tabindex="0" role="button" aria-label="${p.name}">
        <div class="playlist-card-thumb-wrap">
          <img class="playlist-card-thumb" src="${p.cover || ''}"
               onerror="this.src='https://picsum.photos/seed/${p.id}/320/320'"
               alt="${p.name}" loading="lazy" />
          <div class="playlist-card-badge">${p.songs} songs</div>
        </div>
        <div class="playlist-card-name">${escHtml(p.name)}</div>
        <div class="playlist-card-desc">${escHtml(p.desc)}</div>
      </div>`).join('');

    // Clicking a curated playlist: search it
    row.querySelectorAll('.playlist-card').forEach((card, i) => {
      card.addEventListener('click', () => {
        window.AppRouter?.navigate('search');
        setTimeout(() => {
          const inp = document.getElementById('search-input');
          if (inp) { inp.value = playlists[i].name + ' songs'; inp.dispatchEvent(new Event('input')); }
        }, 300);
      });
    });
  }

  // ── All sections (progressive load) ──────────────────────────────────────
  function loadAllCategories() {
    const container = document.getElementById('home-sections');
    if (!container) return;

    // Build skeleton sections first
    container.innerHTML = CATEGORIES.map(cat => `
      <section class="home-section" id="sec-${cat.key}">
        <div class="section-header">
          <h2 class="section-title">${cat.label}</h2>
          <button class="view-all-btn" data-key="${cat.key}">View All</button>
        </div>
        <div class="${cat.wide ? 'cards-row wide-row' : 'cards-row'}" id="row-${cat.key}">
          <div class="skeleton-row">
            ${Array(6).fill(`<div class="card-skeleton shimmer" style="height:${cat.wide?'76':'200'}px"></div>`).join('')}
          </div>
        </div>
      </section>`).join('');

    // Bind view-all
    container.querySelectorAll('.view-all-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.AppRouter?.navigate('search');
        const cat = CATEGORIES.find(c => c.key === btn.dataset.key);
        setTimeout(() => {
          const inp = document.getElementById('search-input');
          if (inp && cat) { inp.value = cat.label.replace(/[\u{1F300}-\u{1F9FF}]/gu,'').trim() + ' songs 2025'; inp.dispatchEvent(new Event('input')); }
        }, 300);
      });
    });

    // Load each category with a staggered delay for UX
    CATEGORIES.forEach((cat, i) => {
      setTimeout(() => loadCategory(cat), i * 180);
    });
  }

  async function loadCategory(cat) {
    const row = document.getElementById(`row-${cat.key}`);
    if (!row) return;

    try {
      const { songs } = await API.homeCategory(cat.key);
      if (!songs?.length) { row.innerHTML = '<div class="text-muted" style="padding:0 16px">Nothing here yet…</div>'; return; }

      // First category feeds the hero banner
      if (cat.key === 'trending' && songs.length) {
        heroSongs = songs;
        renderHero(songs[0]);
        startHeroCycle();
      }

      if (cat.wide) {
        renderMostListened(row, songs);
      } else {
        renderSongCards(row, songs);
      }
    } catch (e) {
      row.innerHTML = `<div class="text-muted" style="padding:0 16px;font-size:13px">Failed to load 😕</div>`;
    }
  }

  // ── Hero Banner ───────────────────────────────────────────────────────────
  function renderHero(song) {
    const banner = document.getElementById('hero-banner');
    if (!banner || !song) return;
    banner.innerHTML = `
      <div class="hero-card" id="hero-card" tabindex="0" role="button" aria-label="Play ${song.title}">
        <img class="hero-img" id="hero-img"
             src="${API.thumb(song.video_id)}"
             onerror="this.src='https://picsum.photos/seed/${song.video_id}/640/360'"
             alt="${song.title}" />
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <div class="hero-label">Featured · Trending</div>
          <div class="hero-title" id="hero-title">${escHtml(song.title)}</div>
          <div class="hero-artist" id="hero-artist">${escHtml(song.artist)}</div>
          <button class="hero-play-btn" id="hero-play-btn">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            Play Now
          </button>
        </div>
      </div>`;

    document.getElementById('hero-play-btn')?.addEventListener('click', () => {
      Player.loadSong(heroSongs[heroIdx]);
    });
    document.getElementById('hero-card')?.addEventListener('click', (e) => {
      if (!e.target.closest('.hero-play-btn')) {
        Player.loadSong(heroSongs[heroIdx]);
        NowPlaying.open();
      }
    });
  }

  function updateHero(song) {
    const img   = document.getElementById('hero-img');
    const title = document.getElementById('hero-title');
    const artist= document.getElementById('hero-artist');
    if (img)    { img.style.opacity = 0; setTimeout(() => { img.src = API.thumb(song.video_id); img.style.opacity = 1; }, 300); }
    if (title)  title.textContent  = song.title;
    if (artist) artist.textContent = song.artist;
  }

  function startHeroCycle() {
    clearInterval(heroCycle);
    if (heroSongs.length <= 1) return;
    heroCycle = setInterval(() => {
      heroIdx = (heroIdx + 1) % Math.min(heroSongs.length, 6);
      updateHero(heroSongs[heroIdx]);
    }, 5000);
  }

  // ── Song card grid ────────────────────────────────────────────────────────
  function renderSongCards(container, songs) {
    container.innerHTML = songs.map((s, i) => `
      <div class="song-card" tabindex="0" role="button" aria-label="Play ${s.title}"
           data-idx="${i}" data-id="${s.video_id}">
        <div class="song-card-thumb-wrap">
          <img class="song-card-thumb"
               src="${API.thumb(s.video_id)}"
               onerror="this.src='https://picsum.photos/seed/${s.video_id}/280/280'"
               alt="${s.title}" loading="lazy" />
          <div class="song-card-overlay">
            <div class="song-card-play-icon">
              <svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>
        <div class="song-card-title">${escHtml(s.title)}</div>
        <div class="song-card-artist">${escHtml(s.artist)}</div>
      </div>`).join('');

    container.querySelectorAll('.song-card').forEach((card, i) => {
      card.addEventListener('click', () => {
        // Put remaining songs in queue
        const next = songs.filter((_, j) => j !== i);
        Player.state.queue = next;
        Player.loadSong(songs[i]);
        NowPlaying.open();
      });
    });
  }

  // ── Most listened (wide pill style) ──────────────────────────────────────
  function renderMostListened(container, songs) {
    if (!songs?.length) {
      container.innerHTML = '<div class="text-muted" style="padding:0 16px;font-size:13px">Play some songs to see your top tracks!</div>';
      return;
    }
    container.innerHTML = songs.slice(0, 10).map((s, i) => `
      <div class="most-listened-card" tabindex="0" role="button" data-idx="${i}">
        <div class="most-listened-num">${i + 1}</div>
        <img class="most-listened-thumb"
             src="${API.thumb(s.video_id)}"
             onerror="this.src='https://picsum.photos/seed/${s.video_id}/80/80'"
             alt="${s.title}" loading="lazy" />
        <div class="most-listened-info">
          <div class="most-listened-title">${escHtml(s.title)}</div>
          <div class="most-listened-artist">${escHtml(s.artist)}</div>
        </div>
      </div>`).join('');

    container.querySelectorAll('.most-listened-card').forEach((card, i) => {
      card.addEventListener('click', () => {
        const next = songs.filter((_,j) => j !== i);
        Player.state.queue = next;
        Player.loadSong(songs[i]);
        NowPlaying.open();
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Expose for router
    window.HomeModule = { initHome };
  });
})();
