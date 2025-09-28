import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, MapPin, Play, Shield, Download, Eye, EyeOff, Clock, AlertTriangle, CheckCircle, MessageSquare, Zap, Activity } from 'lucide-react';

/* =========================
   Global Styles Injection
   ========================= */
const globalStyles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f0f23;
  color: #ffffff;
  overflow: hidden;
  font-feature-settings: 'cv02','cv03','cv04','cv11';
}
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.glass-card:hover { border-color: rgba(255, 255, 255, 0.15); box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4); transform: translateY(-2px); }
.neon-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none; border-radius: 12px; color: white; cursor: pointer;
  font-weight: 600; font-size: 14px; padding: 12px 24px; position: relative; overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); text-transform: uppercase; letter-spacing: .5px;
}
.neon-button::before {
  content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.2), transparent); transition: left .5s;
}
.neon-button:hover::before { left: 100%; }
.neon-button:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(102,126,234,.4); }
.neon-button:active { transform: translateY(0); }
.neon-button.danger { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); }
.neon-button.success { background: linear-gradient(135deg, #26de81 0%, #20bf6b 100%); }
.neon-button.warning { background: linear-gradient(135deg, #fed330 0%, #f39801 100%); color: #0f0f23; }
.cyber-input, .cyber-select {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; color: white; font-size: 14px; padding: 12px 16px; width: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-family: inherit;
}
.cyber-input:focus, .cyber-select:focus { outline: none; border-color: #667eea; background: rgba(255,255,255,.08); box-shadow: 0 0 0 3px rgba(102,126,234,.1); }
.cyber-select { appearance: none; cursor: pointer; }
.cyber-input::placeholder { color: rgba(255,255,255,0.4); }
.section-title { color: #667eea; font-size: 18px; font-weight: 700; margin: 0 0 16px; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 1px; }
.event-item {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; padding: 16px; margin-bottom: 12px; transition: all .3s cubic-bezier(0.4,0,0.2,1); cursor: pointer;
}
.event-item:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); transform: translateX(4px); }
.event-item.verified { border-color: rgba(38,222,129,0.3); background: rgba(38,222,129,0.05); }
.severity-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
.severity-1 { background: rgba(38,222,129,0.2); color: #26de81; }
.severity-2 { background: rgba(254,211,48,0.2); color: #fed330; }
.severity-3 { background: rgba(255,159,67,0.2); color: #ff9f43; }
.severity-4 { background: rgba(255,107,107,0.2); color: #ff6b6b; }
.severity-5 { background: rgba(238,90,36,0.2); color: #ee5a24; }
.pulse { animation: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
.floating { animation: float 6s ease-in-out infinite; }
@keyframes float { 0%{transform:translateY(0)} 50%{transform:translateY(-10px)} 100%{transform:translateY(0)} }
.glow { box-shadow: 0 0 20px rgba(102,126,234,.3); }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
.stat-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; text-align: center; transition: all .3s cubic-bezier(0.4,0,0.2,1); }
.stat-card:hover { background: rgba(255,255,255,0.04); transform: scale(1.02); }
.stat-number { font-size: 28px; font-weight: 800; color: #667eea; display: block; }
.stat-label { font-size: 12px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: .5px; margin-top: 4px; }
.action-buttons { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.mini-button {
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px; color: white; cursor: pointer; font-size: 12px; font-weight: 500; padding: 6px 12px;
  transition: all .2s cubic-bezier(0.4,0,0.2,1); display: flex; align-items: center; gap: 4px;
}
.mini-button:hover { background: rgba(255,255,255,0.15); transform: translateY(-1px); }
.scrollbar-style { scrollbar-width: thin; scrollbar-color: rgba(102,126,234,.5) transparent; }
.scrollbar-style::-webkit-scrollbar { width: 6px; }
.scrollbar-style::-webkit-scrollbar-track { background: transparent; }
.scrollbar-style::-webkit-scrollbar-thumb { background: rgba(102,126,234,.5); border-radius: 3px; }
.scrollbar-style::-webkit-scrollbar-thumb:hover { background: rgba(102,126,234,.7); }
.brand-logo {
  font-size: 32px; font-weight: 900;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  letter-spacing: 3px; margin-bottom: 32px;
}
.map-container { border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,0.1); }
@keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }

/* Leaflet container needs height */
.leaflet-container { width: 100%; height: 100%; background: #0a0f1f; }
.leaflet-control-attribution { font-size: 10px; }
`;
if (typeof document !== 'undefined' && !document.getElementById('murmur-global-styles')) {
  const style = document.createElement('style');
  style.id = 'murmur-global-styles';
  style.innerHTML = globalStyles;
  document.head.appendChild(style);
}

/* =========================
   Config & Utilities
   ========================= */
const MOCK_AUTH = { username: 'authority', password: 'password123' };
const US_BBOX = { minLat: 24.396308, maxLat: 49.384358, minLng: -124.848974, maxLng: -66.885444 };

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randBetween(a, b) { return a + Math.random() * (b - a); }
function randomTimestampWithin(days = 7) {
  const now = Date.now();
  return new Date(now - Math.random() * days * 24 * 3600 * 1000);
}
function generateSyntheticEvents(n = 700) {
  const types = ['shot', 'fight', 'alarm', 'gunshot', 'scream'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const lat = randBetween(US_BBOX.minLat, US_BBOX.maxLat);
    const lng = randBetween(US_BBOX.minLng, US_BBOX.maxLng);
    const severity = Math.max(1, Math.round(Math.random() * 5));
    const t = randomTimestampWithin(14);
    out.push({
      id: `evt_${i}`,
      lat, lng, severity,
      type: types[Math.floor(Math.random() * types.length)],
      timestamp: t.toISOString(),
      verified: Math.random() < 0.2,
      notes: '',
    });
  }
  return out;
}

/* ============  Audio Utils  ============ */
async function synthesizeAudioBlobForEvent(seed = 0) {
  const sampleRate = 44100;
  const duration = 1.8 + (seed % 3) * 0.4;
  const length = Math.ceil(sampleRate * duration);
  const Ctx = (typeof window !== 'undefined') && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
  if (!Ctx) {
    const silent = new Float32Array(length);
    const wavBuf = encodeWavFromFloat32(silent, sampleRate, 1, 16);
    return new Blob([wavBuf], { type: 'audio/wav' });
  }

  const ctx = new Ctx(1, length, sampleRate);
  const noiseBuffer = ctx.createBuffer(1, length, sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const x = Math.sin((i + seed * 9973) * 12.9898) * 43758.5453;
    data[i] = ((x - Math.floor(x)) * 2 - 1) * (1 - (i / data.length) * 0.9);
  }
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 800 + ((seed % 5) * 300);
  bp.Q.value = 1.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, 0);
  gain.gain.exponentialRampToValueAtTime(1.0, Math.min(0.05, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.001, duration - 0.05);

  noiseSource.connect(bp);
  bp.connect(gain);
  gain.connect(ctx.destination);

  noiseSource.start(0);
  const rendered = await ctx.startRendering();
  const wavArrayBuffer = audioBufferToWavArrayBuffer(rendered);
  return new Blob([wavArrayBuffer], { type: 'audio/wav' });
}
function audioBufferToWavArrayBuffer(buffer, opt) {
  opt = opt || {};
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = opt.float32 ? 3 : 1;
  const bitDepth = format === 3 ? 32 : 16;
  let interleaved;
  if (numChannels === 2) interleaved = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  else interleaved = buffer.getChannelData(0);
  const view = encodeWAV(interleaved, format, sampleRate, numChannels, bitDepth);
  return view.buffer;
}
function interleave(l, r) {
  const length = l.length + r.length;
  const out = new Float32Array(length);
  let k = 0, i = 0;
  while (k < length) { out[k++] = l[i]; out[k++] = r[i]; i++; }
  return out;
}
function encodeWAV(samples, format, sampleRate, numChannels, bitDepth) {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format === 3 ? 3 : 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);
  if (format === 1) floatTo16BitPCM(view, 44, samples);
  else writeFloat32(view, 44, samples);
  return view;
}
function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}
function writeFloat32(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 4) output.setFloat32(offset, input[i], true);
}
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}
function encodeWavFromFloat32(float32, sampleRate, numChannels = 1, bitDepth = 16) {
  return encodeWAV(float32, 1, sampleRate, numChannels, bitDepth).buffer;
}

/* =========================
   Map Component (Leaflet via CDN)
   ========================= */
function leafletZoomFromScalar(scalar = 1) {
  // Map your 1..5-ish UI scalar to a Leaflet zoom (roughly US-wide to street)
  // 1 -> 4, 1.5 -> 5, 2.5 -> 7, 4 -> 11, 5 -> 13 (clamped)
  const z = Math.round(3 + scalar * 2.5);
  return Math.max(3, Math.min(13, z));
}

function severityColor(level) {
  return {
    1: '#26de81',
    2: '#fed330',
    3: '#ff9f43',
    4: '#ff6b6b',
    5: '#ee5a24',
  }[level] || '#667eea';
}

function MapComponent({ filteredEvents, viewMode, user, onEventSelect, selectedEvent, mapCenter, mapZoom }) {
  const mapRef = useRef(null);
  const mapDivRef = useRef(null);
  const layerRef = useRef(null);
  const selectedRef = useRef(null);

  // dynamically load Leaflet CSS/JS from CDN (no npm)
  useEffect(() => {
    const ensureLeaflet = () =>
      new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window.L) return resolve(window.L);

        // CSS
        const cssId = 'leaflet-css-cdn';
        if (!document.getElementById(cssId)) {
          const link = document.createElement('link');
          link.id = cssId;
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
        }
        // JS
        const jsId = 'leaflet-js-cdn';
        if (!document.getElementById(jsId)) {
          const script = document.createElement('script');
          script.id = jsId;
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
          script.crossOrigin = '';
          script.onload = () => resolve(window.L);
          script.onerror = reject;
          document.body.appendChild(script);
        } else {
          const existing = document.getElementById(jsId);
          existing.onload = () => resolve(window.L);
          if (window.L) resolve(window.L);
        }
      });

    let destroyed = false;

    (async () => {
      const L = await ensureLeaflet();
      if (destroyed) return;

      // init map only once
      if (!mapRef.current) {
        const initialZoom = leafletZoomFromScalar(mapZoom);
        const m = L.map(mapDivRef.current, {
          zoomControl: true,
          attributionControl: true,
          minZoom: 3,
          maxZoom: 18
        }).setView([mapCenter.lat, mapCenter.lng], initialZoom);
        mapRef.current = m;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(m);

        layerRef.current = L.layerGroup().addTo(m);

        // clicks: choose closest event (authority only)
        m.on('click', (e) => {
          if (viewMode !== 'private' || !user) return;
          const { latlng } = e;
          let closest = null;
          let min = Infinity;
          filteredEvents.forEach(ev => {
            if (
              ev.lat < US_BBOX.minLat || ev.lat > US_BBOX.maxLat ||
              ev.lng < US_BBOX.minLng || ev.lng > US_BBOX.maxLng
            ) return;
            const d = latlng.distanceTo([ev.lat, ev.lng]);
            if (d < min) { min = d; closest = ev.id; }
          });
          if (closest) onEventSelect(closest);
        });
      }

      // keep map in sync with prop center/zoom
      if (mapRef.current) {
        const targetZoom = leafletZoomFromScalar(mapZoom);
        const current = mapRef.current.getCenter();
        if (Math.abs(current.lat - mapCenter.lat) > 0.0001 || Math.abs(current.lng - mapCenter.lng) > 0.0001) {
          mapRef.current.setView([mapCenter.lat, mapCenter.lng], targetZoom, { animate: false });
        } else {
          mapRef.current.setZoom(targetZoom);
        }
      }

      // redraw markers
      if (layerRef.current && mapRef.current) {
        layerRef.current.clearLayers();

        filteredEvents.forEach(ev => {
          if (
            ev.lat < US_BBOX.minLat || ev.lat > US_BBOX.maxLat ||
            ev.lng < US_BBOX.minLng || ev.lng > US_BBOX.maxLng
          ) return;

          const color = severityColor(ev.severity);
          const radius = Math.max(4, ev.severity * 3 * mapZoom);

          const circle = window.L.circleMarker([ev.lat, ev.lng], {
            radius,
            color: ev.verified ? '#ffffff' : color,
            weight: ev.verified ? 2 : 1,
            opacity: 0.9,
            fillColor: color,
            fillOpacity: 0.28
          });

          circle.on('click', () => {
            if (viewMode === 'private' && user) onEventSelect(ev.id);
          });

          circle.addTo(layerRef.current);
        });

        // highlight selected
        if (selectedEvent) {
          const sel = filteredEvents.find(e => e.id === selectedEvent);
          if (sel) {
            if (selectedRef.current) {
              try { selectedRef.current.remove(); } catch {}
            }
            selectedRef.current = window.L.circle([sel.lat, sel.lng], {
              radius: 20000 / mapRef.current.getZoom(), // scale highlight by zoom
              color: '#ffffff',
              weight: 2,
              fill: false,
              dashArray: '6 6',
              opacity: 0.9
            }).addTo(layerRef.current);
          }
        } else if (selectedRef.current) {
          try { selectedRef.current.remove(); } catch {}
          selectedRef.current = null;
        }
      }
    })();

    return () => { destroyed = true; };
  }, [filteredEvents, viewMode, user, onEventSelect, selectedEvent, mapCenter, mapZoom]);

  return <div ref={mapDivRef} className="leaflet-container" />;
}

/* ================
   Main App
   ================ */
export default function App() {
  const [events, setEvents] = useState(() => generateSyntheticEvents(700));
  const [user, setUser] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState({});
  const audioCache = useRef({});
  const [viewMode, setViewMode] = useState('public');
  const [query, setQuery] = useState('');
  const [timeFilterDays, setTimeFilterDays] = useState(7);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: 'authority', password: 'password123' });
  const [mapCenter, setMapCenter] = useState({ lat: 39.5, lng: -98.35 });
  const [mapZoom, setMapZoom] = useState(1);
  const [searchLoading, setSearchLoading] = useState(false);

  // Filter events by time
  const filteredEvents = useMemo(() => {
    const cutoff = Date.now() - timeFilterDays * 24 * 3600 * 1000;
    return events.filter(e => new Date(e.timestamp).getTime() >= cutoff);
  }, [events, timeFilterDays]);

  const verifiedCount = filteredEvents.filter(e => e.verified).length;
  const highSeverityCount = filteredEvents.filter(e => e.severity >= 4).length;

  // Preload AUDIO for recent visible events
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const recent = filteredEvents
        .slice()
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 30);

      for (let i = 0; i < recent.length; i++) {
        const id = recent[i].id;
        if (!audioCache.current[id]) {
          setLoadingAudio(s => ({ ...s, [id]: true }));
          try {
            const blob = await synthesizeAudioBlobForEvent(i);
            if (cancelled) return;
            audioCache.current[id] = URL.createObjectURL(blob);
          } catch {
            if (!cancelled) audioCache.current[id] = null;
          } finally {
            if (!cancelled) setLoadingAudio(s => ({ ...s, [id]: false }));
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [filteredEvents]);

  // Search with Nominatim (clamped to US)
  async function handleSearch() {
    if (!query.trim()) return;
    setSearchLoading(true);
    try {
      const encodedQuery = encodeURIComponent(query.trim() + ', USA');
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1&countrycodes=us&addressdetails=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MURMUR-Intelligence-Dashboard (demo)', 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        let lat = parseFloat(result.lat);
        let lng = parseFloat(result.lon);

        // clamp to US bbox to hard geolock
        lat = clamp(lat, US_BBOX.minLat, US_BBOX.maxLat);
        lng = clamp(lng, US_BBOX.minLng, US_BBOX.maxLng);

        setMapCenter({ lat, lng });

        let zoom = 1;
        const addr = result.address || {};
        if (addr.house_number) zoom = 4;
        else if (addr.postcode) zoom = 3;
        else if (addr.city || addr.town || addr.village) zoom = 2.5;
        else if (addr.county) zoom = 1.8;
        else if (addr.state) zoom = 1.2;

        setMapZoom(zoom);

        const locationName = (result.display_name || '').split(',').slice(0, 2).join(',');
        if (locationName) setTimeout(() => alert(`📍 Found: ${locationName}`), 100);
      } else {
        throw new Error('Location not found');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert(`❌ Search failed: ${error?.message || 'Unable to find location'}`);
    } finally {
      setSearchLoading(false);
    }
  }

  function resetMapView() {
    setMapCenter({ lat: 39.5, lng: -98.35 });
    setMapZoom(1);
    setSelectedEvent(null);
  }
  function zoomToEvents() {
    if (filteredEvents.length === 0) return;
    const lats = filteredEvents.map(e => e.lat);
    const lngs = filteredEvents.map(e => e.lng);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    setMapCenter({ lat: centerLat, lng: centerLng });
    setMapZoom(1.5);
  }

  function handleLogin(e) {
    e.preventDefault();
    if (loginForm.username === MOCK_AUTH.username && loginForm.password === MOCK_AUTH.password) {
      setUser({ username: loginForm.username });
      setViewMode('private');
    } else {
      alert('Invalid credentials');
    }
  }

  // Lazy on-demand audio generation (fixes "Audio not ready")
  async function playEventAudio(ev) {
    try {
      if (!audioCache.current[ev.id]) {
        setLoadingAudio(s => ({ ...s, [ev.id]: true }));
        const blob = await synthesizeAudioBlobForEvent(Number(ev.id.split('_')[1]) || 0);
        const url = URL.createObjectURL(blob);
        audioCache.current[ev.id] = url;
        setLoadingAudio(s => ({ ...s, [ev.id]: false }));
      }
      const url = audioCache.current[ev.id];
      if (!url) { alert('Audio not ready'); return; }
      const a = new Audio(url);
      await a.play();
    } catch {
      alert('Audio playback failed.');
    }
  }

  function toggleVerify(id) {
    setEvents(evs => evs.map(ev => ev.id === id ? { ...ev, verified: !ev.verified } : ev));
  }
  function exportCSV() {
    const headers = ['id','lat','lng','type','severity','timestamp','verified','notes'];
    const rows = events.map(ev => headers.map(h => JSON.stringify(ev[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'events_export.csv'; a.click();
    URL.revokeObjectURL(url);
  }
  function addNote(id) {
    const note = typeof window !== 'undefined' ? window.prompt('Add a note:') : null;
    if (note !== null) {
      setEvents(evs => evs.map(ev => ev.id === id ? { ...ev, notes: (ev.notes || '') + '\n' + note } : ev));
    }
  }
  function markTopVerified() {
    const top = [...events].sort((a,b) => b.severity - a.severity).slice(0, 5).map(e => e.id);
    setEvents(evs => evs.map(ev => top.includes(ev.id) ? { ...ev, verified: true } : ev));
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 400,
        padding: 32,
        overflowY: 'auto',
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)'
      }} className="scrollbar-style">

        <div className="brand-logo floating">MURMUR</div>

        {/* Search */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
          <div className="section-title"><Search size={18} />Search Location</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              className="cyber-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ZIP, city, state, or address"
              style={{ flex: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              className="neon-button"
              onClick={handleSearch}
              disabled={searchLoading}
              style={{ padding: '12px 16px', minWidth: '60px' }}
              title="Search"
            >
              {searchLoading
                ? <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                : <MapPin size={16} />}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="mini-button" onClick={resetMapView} style={{ flex: 1, justifyContent: 'center' }}>Reset View</button>
            <button className="mini-button" onClick={zoomToEvents} style={{ flex: 1, justifyContent: 'center' }}>Show All Events</button>
          </div>
        </div>

        {/* Time Filter */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
          <div className="section-title"><Clock size={18} />Time Range</div>
          <select className="cyber-select" value={timeFilterDays} onChange={(e) => setTimeFilterDays(Number(e.target.value))}>
            <option value={1}>Last 24 hours</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card pulse">
            <span className="stat-number">{filteredEvents.length}</span>
            <span className="stat-label">Active Events</span>
          </div>
          <div className="stat-card">
            <span className="stat-number" style={{ color: '#26de81' }}>{verifiedCount}</span>
            <span className="stat-label">Verified</span>
          </div>
          <div className="stat-card">
            <span className="stat-number" style={{ color: '#ff6b6b' }}>{highSeverityCount}</span>
            <span className="stat-label">High Priority</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{events.length}</span>
            <span className="stat-label">Total Events</span>
          </div>
        </div>

        {/* Mode Toggle / Authority */}
        {viewMode === 'public' ? (
          <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
            <div className="section-title"><Eye size={18} />Public View</div>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 16, fontSize: 14 }}>
              Limited view showing heatmap visualization only. Event details and audio are restricted.
            </p>
            <button className="neon-button" onClick={() => setViewMode('private')} style={{ width: '100%' }}>
              <Shield size={16} style={{ marginRight: 8 }} />
              Authority Access
            </button>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
            <div className="section-title"><EyeOff size={18} />Authority Panel</div>
            {!user ? (
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16 }}>
                  <input className="cyber-input" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} placeholder="Username" />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <input className="cyber-input" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Password" />
                </div>
                <button className="neon-button" type="submit" style={{ width: '100%' }}>
                  <Shield size={16} style={{ marginRight: 8 }} />
                  Authenticate
                </button>
              </form>
            ) : (
              <div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
                  padding: 12, background: 'rgba(38,222,129,0.1)', borderRadius: 8, border: '1px solid rgba(38,222,129,0.2)'
                }}>
                  <span style={{ color: '#26de81', fontWeight: 600 }}>
                    <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                    {user.username}
                  </span>
                  <button
                    className="mini-button"
                    onClick={() => { setUser(null); setViewMode('public'); }}
                    style={{ background: 'rgba(255,107,107,0.2)', borderColor: 'rgba(255,107,107,0.3)' }}
                  >
                    Sign Out
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <button className="neon-button" onClick={exportCSV} style={{ flex: 1 }}>
                    <Download size={14} style={{ marginRight: 6 }} />
                    Export
                  </button>
                  <button className="neon-button success" onClick={markTopVerified} style={{ flex: 1 }}>
                    <Zap size={14} style={{ marginRight: 6 }} />
                    Auto-Verify
                  </button>
                </div>

                <div className="section-title" style={{ marginTop: 24 }}>
                  <Activity size={18} />
                  Recent Activity
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }} className="scrollbar-style">
                  {filteredEvents
                    .slice()
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, 20)
                    .map(ev => (
                      <div
                        key={ev.id}
                        className={`event-item ${ev.verified ? 'verified' : ''} ${selectedEvent === ev.id ? 'glow' : ''}`}
                        onClick={() => setSelectedEvent(ev.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, color: '#667eea', textTransform: 'uppercase', fontSize: 14 }}>
                                {ev.type}
                              </span>
                              <span className={`severity-badge severity-${ev.severity}`}>Level {ev.severity}</span>
                              {ev.verified && <CheckCircle size={14} style={{ color: '#26de81' }} />}
                            </div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                              {new Date(ev.timestamp).toLocaleString()}
                            </div>
                            {ev.notes && (
                              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', marginTop: 4 }}>
                                {ev.notes.split('\n').slice(-1)[0]}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="action-buttons">
                          <button
                            className="mini-button"
                            onClick={(e) => { e.stopPropagation(); playEventAudio(ev); }}
                            disabled={!!loadingAudio[ev.id]}
                          >
                            <Play size={12} />
                            {loadingAudio[ev.id] ? 'Loading...' : 'Play'}
                          </button>
                          <button
                            className="mini-button"
                            onClick={(e) => { e.stopPropagation(); toggleVerify(ev.id); }}
                            style={{
                              background: ev.verified ? 'rgba(38,222,129,0.2)' : 'rgba(102,126,234,0.2)',
                              borderColor: ev.verified ? 'rgba(38,222,129,0.3)' : 'rgba(102,126,234,0.3)'
                            }}
                          >
                            {ev.verified ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                            {ev.verified ? 'Verified' : 'Verify'}
                          </button>
                          <button
                            className="mini-button"
                            onClick={(e) => { e.stopPropagation(); addNote(ev.id); }}
                            style={{ background: 'rgba(254,211,48,0.2)', borderColor: 'rgba(254,211,48,0.3)' }}
                          >
                            <MessageSquare size={12} />
                            Note
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security Notice */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div className="section-title"><Shield size={18} />Security Notice</div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            This is a demonstration with synthetic data. Production systems require end-to-end encryption,
            audit logging, strict access controls, and compliance with privacy regulations.
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column' }}>
        <div className="map-container" style={{ flex: 1, position: 'relative' }}>
          <MapComponent
            filteredEvents={filteredEvents}
            viewMode={viewMode}
            user={user}
            onEventSelect={setSelectedEvent}
            selectedEvent={selectedEvent}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
          />

          {/* Map Controls (optional; Leaflet has built-in zoom UI too) */}
          <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="mini-button"
              onClick={() => setMapZoom(Math.min(5, mapZoom * 1.2))}
              style={{ background: 'rgba(0,0,0,0.8)', padding: '8px 12px' }}
            >+ Zoom In</button>
            <button
              className="mini-button"
              onClick={() => setMapZoom(Math.max(0.5, mapZoom / 1.2))}
              style={{ background: 'rgba(0,0,0,0.8)', padding: '8px 12px' }}
            >- Zoom Out</button>
          </div>

          {/* Map Overlay */}
          <div style={{
            position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, color: 'white'
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Real-time Intelligence Dashboard</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              {viewMode === 'public' ? 'Public View - Limited Data' : 'Authority View - Full Access'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              Showing {filteredEvents.length} events • Zoom: {mapZoom.toFixed(1)}x
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              Center: {mapCenter.lat.toFixed(2)}°, {mapCenter.lng.toFixed(2)}°
            </div>
          </div>

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 20, left: 20, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, color: 'white'
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Severity Levels</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { level: 1, color: '#26de81', label: 'Low' },
                { level: 2, color: '#fed330', label: 'Moderate' },
                { level: 3, color: '#ff9f43', label: 'High' },
                { level: 4, color: '#ff6b6b', label: 'Critical' },
                { level: 5, color: '#ee5a24', label: 'Emergency' }
              ].map(item => (
                <div key={item.level} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color, boxShadow: `0 0 6px ${item.color}50` }} />
                  <span style={{ fontSize: 12 }}>Level {item.level} - {item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Event Popup */}
          {selectedEvent && viewMode === 'private' && user && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 16, padding: 24, color: 'white', minWidth: 300, zIndex: 1000
            }}>
              {(() => {
                const event = filteredEvents.find(e => e.id === selectedEvent);
                if (!event) return null;
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ margin: 0, color: '#667eea', textTransform: 'uppercase' }}>{event.type}</h3>
                      <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 20 }}>×</button>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <div className={`severity-badge severity-${event.severity}`} style={{ marginBottom: 8 }}>
                        Severity Level {event.severity}
                      </div>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{new Date(event.timestamp).toLocaleString()}</div>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                        Coordinates: {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="neon-button" onClick={() => playEventAudio(event)} disabled={!!loadingAudio[event.id]}>
                        <Play size={14} style={{ marginRight: 6 }} /> {loadingAudio[event.id] ? 'Loading...' : 'Play Audio'}
                      </button>
                      <button className={`neon-button ${event.verified ? 'success' : ''}`} onClick={() => toggleVerify(event.id)}>
                        {event.verified ? <CheckCircle size={14} /> : <AlertTriangle size={14} />} {event.verified ? 'Verified' : 'Verify'}
                      </button>
                      <button className="neon-button warning" onClick={() => addNote(event.id)}>
                        <MessageSquare size={14} style={{ marginRight: 6 }} /> Add Note
                      </button>
                    </div>
                    {event.notes && (
                      <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                        <strong>Notes:</strong><br />
                        {event.notes.split('\n').filter(n => n.trim()).map((note, i) => (<div key={i}>• {note}</div>))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
