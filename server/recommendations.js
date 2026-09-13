'use strict';
/**
 * VIBE_ON Smart Recommendation Engine
 *
 * Scoring factors (weighted):
 *  1. Same artist                  → +50
 *  2. Shared tags / genre          → +20 per tag (max +60)
 *  3. Language match               → +30
 *  4. Co-listen in user history    → +40
 *  5. Freshness (newer upload)     → +10
 *  6. NOT recently played penalty  → -100 (exclude)
 *  7. Popularity boost             → up to +20
 */

const db = require('./db');

// Detect language from title/artist heuristics
function detectLanguage(song) {
  const text = `${song.title} ${song.artist}`.toLowerCase();
  const tags = (song.tags || []).join(' ').toLowerCase();
  const combined = `${text} ${tags}`;
  if (/punjabi|panjabi|bhangra/.test(combined)) return 'punjabi';
  if (/haryanvi|haryana|ragni|desi/.test(combined)) return 'haryanvi';
  if (/hindi|bollywood|filmi|urdu/.test(combined)) return 'hindi';
  if (/telugu|tollywood/.test(combined)) return 'telugu';
  if (/tamil|kollywood/.test(combined)) return 'tamil';
  if (/kannada/.test(combined)) return 'kannada';
  if (/lofi|lo-fi|chill|study|relax/.test(combined)) return 'lofi';
  if (/hip.hop|rap|trap|drill/.test(combined)) return 'hiphop';
  return 'global';
}

// Normalise tag for comparison
function normTag(t) { return t.toLowerCase().replace(/[^a-z0-9]/g, ''); }

function scoreSong(candidate, current, recentlyPlayed, historyArtists, historyTags, historyLang) {
  // Hard exclude recently played
  if (recentlyPlayed.has(candidate.video_id)) return -Infinity;
  // Don't recommend the same song
  if (candidate.video_id === current.video_id) return -Infinity;

  let score = 0;

  // Same artist
  const curArtist = (current.artist || '').toLowerCase();
  const candArtist = (candidate.artist || '').toLowerCase();
  if (curArtist && candArtist && (curArtist.includes(candArtist) || candArtist.includes(curArtist))) {
    score += 50;
  }
  // Artist from listening history
  if (historyArtists.has(candArtist)) score += 20;

  // Tag overlap
  const curTags = new Set((current.tags || []).map(normTag));
  const candTags = (candidate.tags || []).map(normTag);
  let tagHits = 0;
  for (const t of candTags) {
    if (curTags.has(t)) tagHits++;
    if (historyTags.has(t)) tagHits += 0.5;
  }
  score += Math.min(tagHits * 20, 60);

  // Language match
  const curLang = detectLanguage(current);
  const candLang = detectLanguage(candidate);
  if (curLang === candLang) score += 30;
  if (historyLang[candLang]) score += Math.min(historyLang[candLang] * 5, 25);

  // Freshness
  const uploadYear = parseInt((candidate.upload_date || '0').substring(0, 4), 10);
  if (uploadYear >= 2024) score += 10;
  else if (uploadYear >= 2022) score += 5;

  // Popularity
  const views = candidate.view_count || 0;
  if (views > 100_000_000) score += 20;
  else if (views > 10_000_000) score += 12;
  else if (views > 1_000_000) score += 6;

  return score;
}

/**
 * Build a smart up-next queue
 * @param {Object} currentSong - the song currently playing
 * @param {Array}  candidates  - pool of candidate songs (from related/search)
 * @param {number} limit       - how many to return
 */
function buildSmartQueue(currentSong, candidates, limit = 12) {
  // Recent play history (last 30)
  const recent = db.getHistory(30);
  const recentlyPlayed = new Set(recent.map(h => h.video_id));

  // Build artist/tag/lang affinity from full history
  const allHistory = db.getHistory(200);
  const historyArtists = new Set(allHistory.map(h => (h.artist || '').toLowerCase()).filter(Boolean));
  const historyTags = new Set();
  const historyLang = {};
  for (const h of allHistory) {
    const lang = detectLanguage(h);
    historyLang[lang] = (historyLang[lang] || 0) + 1;
  }

  const scored = candidates
    .map(c => ({ ...c, _score: scoreSong(c, currentSong, recentlyPlayed, historyArtists, historyTags, historyLang) }))
    .filter(c => c._score > -Infinity)
    .sort((a, b) => b._score - a._score);

  // De-duplicate by artist (avoid too many songs from same artist consecutively)
  const result = [];
  const artistCount = {};
  for (const song of scored) {
    if (result.length >= limit) break;
    const artist = (song.artist || '').toLowerCase();
    if ((artistCount[artist] || 0) >= 2) continue;
    artistCount[artist] = (artistCount[artist] || 0) + 1;
    result.push(song);
  }

  // Pad with random candidates if not enough
  if (result.length < limit) {
    const used = new Set(result.map(r => r.video_id));
    for (const c of candidates) {
      if (result.length >= limit) break;
      if (!used.has(c.video_id) && c.video_id !== currentSong.video_id) {
        result.push(c);
        used.add(c.video_id);
      }
    }
  }

  return result.slice(0, limit);
}

module.exports = { buildSmartQueue, detectLanguage };
