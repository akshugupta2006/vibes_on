'use strict';
/**
 * VIBE_ON — Synced Lyrics Engine
 * Uses lrclib.net (free, no key needed) — supports LRC timestamped lyrics
 */
const fetch = require('node-fetch');

// In-memory cache (per session; songs don't change mid-session)
const cache = new Map();

// ── Fetch with proper AbortController timeout ─────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ── Strip noise from YouTube titles ──────────────────────────────────────────
//  "Guru Randhawa: Ishq Tera | Nushrat Bharucha | Bhushan Kumar | T-Series"
//  → "Guru Randhawa Ishq Tera"
function cleanTitle(str) {
  return (str || '')
    .split('|')[0]            // drop everything after first pipe
    .replace(/[:\-–—]/g, ' ') // colon / dashes → space (keeps song name)
    .replace(/\([^)]*\)/g, '') // remove (Official Video) etc
    .replace(/\[[^\]]*\]/g, '') // remove [Official] etc
    .replace(/\b(official|lyrics?|video|audio|song|full|hd|4k|ft\.?|feat\.?)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Clean artist name ──────────────────────────────────────────────────────────
function cleanArtist(str) {
  const name = (str || '').split('|')[0].split(',')[0].split('&')[0].trim();
  // Drop obvious channel names, not real artists
  if (/record|music|series|entertainment|official|vevo|studio/i.test(name)) return '';
  return name.replace(/\s+/g, ' ').trim();
}

// ── Extract just the song name when artist is embedded in title ───────────────
//  "Ishq Tera Guru Randhawa" → try last portion after known artist
function extractSongName(title) {
  // Many Bollywood/Punjabi YouTube titles: "SongName Artist | Label"
  const part = (title || '').split('|')[0];
  // Try to grab just the first few words before an all-caps word (label/artist)
  const words = part.split(/\s+/);
  // Return first 3–4 meaningful words as a fallback query
  return words.slice(0, 4).join(' ').trim();
}

// ── Check if lyrics are in English/Roman script ───────────────────────────────
// Threshold: if >2% of chars are non-ASCII (Devanagari, Gurmukhi, etc.) → reject
function isRomanized(text) {
  if (!text) return false;
  const stripped = text.replace(/\[\d+:\d+\.\d+\]/g, '').replace(/\s+/g, '');
  if (stripped.length < 5) return false;
  let nonAscii = 0;
  for (let i = 0; i < stripped.length; i++) {
    if (stripped.charCodeAt(i) > 255) nonAscii++;
  }
  return (nonAscii / stripped.length) < 0.02; // strict: reject if >2% regional chars
}

// ── Parse LRC format → [{time, text}] ────────────────────────────────────────
function parseLRC(lrc) {
  const lines = [];
  const re = /\[(\d{1,2}):(\d{2})\.(\d{1,3})\](.*)/;
  for (const raw of (lrc || '').split('\n')) {
    const m = raw.match(re);
    if (!m) continue;
    const frac = m[3].padEnd(3, '0');
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(frac) / 1000;
    const text = m[4].trim();
    if (text) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

// ── Search lrclib.net with a query ───────────────────────────────────────────
async function searchLrclib(query) {
  if (!query || query.length < 2) return [];
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
  const headers = { 'User-Agent': 'VIBE_ON/1.0 (music-app)', 'Accept': 'application/json' };
  try {
    const res = await fetchWithTimeout(url, { headers }, 10000);
    if (!res.ok) return [];
    const results = await res.json();
    return Array.isArray(results) ? results : [];
  } catch (e) {
    console.warn('Lyrics search failed:', e.message, '| query:', query);
    return [];
  }
}

// ── Pick the best result from a results array ─────────────────────────────────
function pickBest(results) {
  if (!results || !results.length) return null;
  // ONLY return romanized (English-alphabet) lyrics — never regional script
  return results.find(r => r.syncedLyrics && isRomanized(r.syncedLyrics))
    || results.find(r => r.plainLyrics   && isRomanized(r.plainLyrics))
    || null; // no romanized version found in this result set
}

// ── Build result object from a matched entry ──────────────────────────────────
function buildResult(best) {
  if (!best) return null;
  if (best.syncedLyrics) {
    return { synced: true, lines: parseLRC(best.syncedLyrics), plain: best.plainLyrics || '' };
  }
  if (best.plainLyrics) {
    const lines = best.plainLyrics.split('\n')
      .map(l => l.trim()).filter(Boolean)
      .map(text => ({ time: -1, text }));
    return { synced: false, lines, plain: best.plainLyrics };
  }
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────
async function fetchLyrics(videoId, title, artist) {
  if (cache.has(videoId)) return cache.get(videoId);

  const cleanedTitle  = cleanTitle(title);
  const cleanedArtist = cleanArtist(artist);
  const shortTitle    = extractSongName(title);

  // Build a de-duped list of search strategies
  const queries = [
    cleanedTitle && cleanedArtist ? `${cleanedTitle} ${cleanedArtist}` : null,
    cleanedTitle || null,
    shortTitle !== cleanedTitle ? shortTitle : null,
    // Last resort: first 2 words of cleaned title
    cleanedTitle.split(' ').slice(0, 2).join(' ') || null,
  ].filter((q, i, arr) => q && q.length >= 2 && arr.indexOf(q) === i); // unique + non-empty

  for (const query of queries) {
    const results = await searchLrclib(query);
    const best    = pickBest(results);
    const result  = buildResult(best);
    if (result && result.lines.length > 0) {
      console.log(`✅ Lyrics found via query: "${query}"`);
      cache.set(videoId, result);
      return result;
    }
  }

  console.log(`❌ No lyrics found for: "${title}"`);
  // Don't cache empty result — let it retry next time
  return { synced: false, lines: [], plain: '' };
}

module.exports = { fetchLyrics };
