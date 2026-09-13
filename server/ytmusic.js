'use strict';

const YTMusic = require('ytmusic-api');
const ytdlp = require('./ytdlp'); // for MOCK fallback

let yt;
async function getYT() {
  if (yt) return yt;
  yt = new YTMusic();
  await yt.initialize();
  return yt;
}

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

function formatSong(s) {
  const thumb = s.thumbnails && s.thumbnails.length 
    ? s.thumbnails[s.thumbnails.length - 1].url 
    : `https://i.ytimg.com/vi/${s.videoId}/hqdefault.jpg`;
  
  // Format high quality thumbnail if it's from yt3.ggpht
  const hqThumb = thumb.replace(/w\d+-h\d+/, 'w800-h800');

  return {
    video_id: s.videoId,
    title: cleanTitle(s.name || s.title || 'Unknown'),
    artist: (s.artist && s.artist.name) ? s.artist.name : (s.author ? s.author : 'Unknown Artist'),
    thumbnail: hqThumb,
    duration: fmt(s.duration),
    duration_seconds: s.duration || 0,
    view_count: 0,
    tags: []
  };
}

module.exports = {
  async search(query, max = 15) {
    try {
      const api = await getYT();
      const rawResults = await api.search(query);
      const results = rawResults.filter(s => s.type === 'SONG' || s.type === 'VIDEO');
      if (!results || results.length === 0) throw new Error('Empty results');
      return results.slice(0, max).map(formatSong);
    } catch (e) {
      console.error('ytmusic-api search error:', e.message);
      // Fallback to exact match on Mock Data
      const q = query.toLowerCase();
      const all = Object.values(ytdlp.getMockData('all') || {}).flat();
      if (!all.length) return [];
      const matched = all.filter(s =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.artist && s.artist.toLowerCase().includes(q))
      );
      return matched.length ? matched.slice(0, max) : ytdlp.getMockData('trending').slice(0, max);
    }
  },

  async searchCategory(category, query, max = 15) {
    try {
      const api = await getYT();
      const results = await api.searchSongs(query);
      if (!results || results.length === 0) throw new Error('Empty results');
      return results.slice(0, max).map(formatSong);
    } catch (e) {
      console.error(`ytmusic-api category ${category} error:`, e.message);
      return ytdlp.getMockData(category).slice(0, max);
    }
  },

  async getInfo(videoId) {
    try {
      const api = await getYT();
      const song = await api.getSong(videoId);
      if (song) return formatSong(song);
      throw new Error('Not found');
    } catch (e) {
      console.error('ytmusic-api getInfo error:', e.message);
      const all = Object.values(ytdlp.getMockData('all') || {}).flat();
      return all.find(s => s.video_id === videoId) || null;
    }
  },

  async getRelated(videoId, limit = 15) {
    try {
      const api = await getYT();
      // ytmusic-api doesn't have a direct getRelated method in all versions, 
      // but we can search for the artist of this song to simulate it
      const song = await api.getSong(videoId);
      if (song && song.artist && song.artist.name) {
         const results = await api.searchSongs(song.artist.name);
         return results.filter(s => s.videoId !== videoId).slice(0, limit).map(formatSong);
      }
      throw new Error('Artist not found for related');
    } catch (e) {
      console.error('ytmusic-api getRelated error:', e.message);
      const all = Object.values(ytdlp.getMockData('all') || {}).flat();
      return all.filter(s => s.video_id !== videoId).slice(0, limit);
    }
  }
};
