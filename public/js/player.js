/* ═══════════════════════════════════════════════════════════
   VIBE_ON — Audio Player Engine (with Web Audio waveform)
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const audio = document.getElementById('audio-element');

  // ── State ────────────────────────────────────────────────────────────────
  const state = {
    currentSong:  null,
    queue:        [],          // up-next smart queue
    sessionQueue: [],          // session play history (for prev)
    isPlaying:    false,
    isShuffle:    false,
    repeatMode:   'none',      // 'none' | 'all' | 'one'
    volume:       1,
    sleepTimer:   null,
    sleepMinutes: 0,
    isLoading:    false,
  };

  // ── Web Audio Visualiser ─────────────────────────────────────────────────
  let audioCtx, analyser, source, waveRaf;

  function initAudioContext() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source = audioCtx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch (e) {
      console.warn('Web Audio not available:', e.message);
    }
  }

  function drawWaveform() {
    const canvas = document.getElementById('np-waveform');
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);

    function frame() {
      if (!state.isPlaying) {
        // Draw flat line when paused
        ctx.clearRect(0, 0, W, H);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0,212,255,0.35)';
        ctx.lineWidth = 2;
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        waveRaf = requestAnimationFrame(frame);
        return;
      }
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, W, H);

      const barW = (W / bufLen) * 2.2;
      let x = 0;
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, '#00d4ff');
      grad.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = grad;

      for (let i = 0; i < bufLen; i++) {
        const v = data[i] / 255;
        const bH = v * H;
        ctx.beginPath();
        ctx.roundRect(x, H - bH, barW - 1, bH, 2);
        ctx.fill();
        x += barW + 1;
      }
      waveRaf = requestAnimationFrame(frame);
    }
    cancelAnimationFrame(waveRaf);
    frame();
  }

  // ── Load & Play ──────────────────────────────────────────────────────────
  async function loadSong(song, autoplay = true) {
    if (!song) return;
    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    state.currentSong = song;
    state.isLoading = true;
    emit('loading', song);

    // Record history
    API.addToHistory(song).catch(() => {});

    // Set audio source
    const src = API.streamUrl(song.video_id);
    audio.src = src;
    audio.load();

    if (autoplay) {
      try {
        await audio.play();
        state.isPlaying = true;
      } catch (e) {
        console.warn('Autoplay blocked:', e.message);
        state.isPlaying = false;
      }
    }

    state.isLoading = false;
    emit('songChanged', song);
    emit('playState', state.isPlaying);

    // Fetch smart recommendations for queue
    refreshQueue(song);

    // Draw waveform
    drawWaveform();
  }

  async function refreshQueue(song) {
    try {
      const { queue } = await API.recommendations(song, 12);
      state.queue = queue.filter(s => s.video_id !== song.video_id);
      emit('queueUpdated', state.queue);
    } catch (e) {
      console.warn('Queue refresh failed:', e.message);
    }
  }

  // ── Controls ─────────────────────────────────────────────────────────────
  function togglePlay() {
    if (!state.currentSong) return;
    if (state.isPlaying) { audio.pause(); }
    else {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      audio.play().catch(console.warn);
    }
  }

  function playNext(force = false) {
    if (state.repeatMode === 'one' && !force) {
      audio.currentTime = 0;
      audio.play().catch(console.warn);
      return;
    }
    const next = state.isShuffle
      ? state.queue.splice(Math.floor(Math.random() * state.queue.length), 1)[0]
      : state.queue.shift();
    if (next) {
      state.sessionQueue.push(state.currentSong);
      loadSong(next);
    } else if (state.repeatMode === 'all' && state.sessionQueue.length) {
      loadSong(state.sessionQueue[0]);
    }
  }

  function playPrev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    const prev = state.sessionQueue.pop();
    if (prev) loadSong(prev);
    else audio.currentTime = 0;
  }

  function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    emit('shuffleChanged', state.isShuffle);
  }

  function cycleRepeat() {
    const modes = ['none', 'all', 'one'];
    const idx = modes.indexOf(state.repeatMode);
    state.repeatMode = modes[(idx + 1) % modes.length];
    emit('repeatChanged', state.repeatMode);
  }

  function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, v));
    audio.volume = state.volume;
    emit('volumeChanged', state.volume);
  }

  function seek(pct) {
    if (audio.duration) {
      audio.currentTime = pct * audio.duration;
    }
  }

  function setSleepTimer(minutes) {
    if (state.sleepTimer) { clearTimeout(state.sleepTimer); state.sleepTimer = null; }
    state.sleepMinutes = minutes;
    if (minutes > 0) {
      state.sleepTimer = setTimeout(() => {
        audio.pause();
        state.isPlaying = false;
        state.sleepMinutes = 0;
        emit('sleepFired');
        emit('playState', false);
        showToast('😴 Sleep timer ended. Goodnight!');
      }, minutes * 60_000);
    }
    emit('sleepTimerSet', minutes);
  }

  async function toggleLike(song = state.currentSong) {
    if (!song) return;
    const { liked } = await API.toggleLike(song);
    emit('likeChanged', { videoId: song.video_id, liked });
    showToast(liked ? '❤️ Added to Liked Songs' : '💔 Removed from Liked Songs');
    return liked;
  }

  function playSongFromQueue(idx) {
    const song = state.queue.splice(idx, 1)[0];
    if (song) {
      if (state.currentSong) state.sessionQueue.push(state.currentSong);
      loadSong(song);
    }
  }

  function addToQueueFront(song) {
    state.queue.unshift(song);
    emit('queueUpdated', state.queue);
  }

  // ── Audio events ─────────────────────────────────────────────────────────
  audio.addEventListener('play',  () => { state.isPlaying = true;  emit('playState', true); });
  audio.addEventListener('pause', () => { state.isPlaying = false; emit('playState', false); });
  audio.addEventListener('ended', () => playNext());
  audio.addEventListener('error', (e) => {
    console.error('Audio error:', audio.error);
    emit('error', audio.error);
    showToast('⚠️ Playback error. Trying next…');
    setTimeout(() => playNext(true), 1500);
  });
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = audio.currentTime / audio.duration;
    emit('progress', { currentTime: audio.currentTime, duration: audio.duration, pct });
  });
  audio.addEventListener('loadstart',  () => { state.isLoading = true;  emit('loadingState', true); });
  audio.addEventListener('canplay',    () => { state.isLoading = false; emit('loadingState', false); });
  audio.addEventListener('waiting',    () => emit('loadingState', true));
  audio.addEventListener('playing',    () => emit('loadingState', false));

  // ── Event emitter ─────────────────────────────────────────────────────────
  const listeners = {};
  function on(evt, fn)  { (listeners[evt] = listeners[evt] || []).push(fn); }
  function off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); }
  function emit(evt, data) { (listeners[evt] || []).forEach(fn => fn(data)); }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function formatTime(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function showToast(msg, duration = 2800) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.classList.remove('hidden');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.classList.remove('show'); }, duration);
  }

  // ── Media Session API ─────────────────────────────────────────────────────
  function updateMediaSession(song) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      artwork: [
        { src: API.thumb(song.video_id), sizes: '480x360', type: 'image/jpeg' },
      ],
    });
    navigator.mediaSession.setActionHandler('play',         () => audio.play());
    navigator.mediaSession.setActionHandler('pause',        () => audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack',() => playPrev());
    navigator.mediaSession.setActionHandler('nexttrack',    () => playNext(true));
  }
  on('songChanged', updateMediaSession);

  // ── Public API ────────────────────────────────────────────────────────────
  window.Player = {
    on, off, emit,
    loadSong,
    togglePlay,
    playNext: (force) => playNext(force),
    playPrev,
    toggleShuffle,
    cycleRepeat,
    setVolume,
    seek,
    setSleepTimer,
    toggleLike,
    playSongFromQueue,
    addToQueueFront,
    refreshQueue,
    formatTime,
    showToast,
    get state() { return state; },
    get audio() { return audio; },
    drawWaveform,
  };
})();
