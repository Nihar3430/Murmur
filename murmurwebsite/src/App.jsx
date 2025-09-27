import React, { useEffect, useMemo, useRef, useState } from 'react';
// --- Global Styles ---
const globalStyles = `
body {
  margin: 0;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  background: linear-gradient(135deg, #2d0606 0%, #ff4747 100%);
}
.murmur-card {
  background: rgba(255,255,255,0.92);
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(255,71,71,0.10);
  padding: 18px 20px;
  margin-bottom: 18px;
}
.murmur-btn {
  background: linear-gradient(90deg, #ff4747 0%, #ff7a7a 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(255,71,71,0.10);
  transition: background 0.2s, transform 0.2s;
}
.murmur-btn:hover {
  background: linear-gradient(90deg, #ff7a7a 0%, #ff4747 100%);
  transform: scale(1.05);
}
.murmur-input, .murmur-select {
  border: 1px solid #fca5a5;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 1rem;
  outline: none;
  margin-bottom: 6px;
  background: #fff1f1;
  transition: border 0.2s;
}
.murmur-input:focus, .murmur-select:focus {
  border-color: #ff4747;
}
.murmur-label {
  font-weight: 600;
  color: #7f1d1d;
  margin-bottom: 4px;
  display: block;
}
.murmur-section-title {
  color: #ff4747;
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 8px;
}
`;

if (typeof document !== 'undefined' && !document.getElementById('murmur-global-styles')) {
  const style = document.createElement('style');
  style.id = 'murmur-global-styles';
  style.innerHTML = globalStyles;
  document.head.appendChild(style);
}
import { MapContainer, TileLayer, useMap, CircleMarker, Popup, Pane } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

// ---------- Configuration ----------
const MOCK_AUTH = { username: 'authority', password: 'password123' };
const US_BBOX = { // continental US extent (approx)
  minLat: 24.396308,
  maxLat: 49.384358,
  minLng: -124.848974,
  maxLng: -66.885444,
};

// ---------- Utilities ----------
function randBetween(a, b) { return a + Math.random() * (b - a); }
function randomTimestampWithin(days = 7) {
  const now = Date.now();
  return new Date(now - Math.random() * days * 24 * 3600 * 1000);
}

function generateSyntheticEvents(n = 600) {
  const types = ['shot', 'fight', 'alarm', 'gunshot', 'scream'];
  const events = [];
  for (let i = 0; i < n; i++) {
    const lat = randBetween(US_BBOX.minLat, US_BBOX.maxLat);
    const lng = randBetween(US_BBOX.minLng, US_BBOX.maxLng);
    const severity = Math.max(1, Math.round(Math.random() * 5));
    const t = randomTimestampWithin(14);
    events.push({
      id: `evt_${i}`,
      lat, lng,
      severity,
      type: types[Math.floor(Math.random() * types.length)],
      timestamp: t.toISOString(),
      verified: Math.random() < 0.2 ? true : false,
      notes: '',
    });
  }
  return events;
}

// Create a small synthetic audio blob via WebAudio. We'll generate a short noise burst + tone.
async function synthesizeAudioBlobForEvent(seed = 0) {
  // Use offline AudioContext to render and encode to WAV-style blob
  const sampleRate = 44100;
  const duration = 1.8 + (seed % 3) * 0.4; // vary duration
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, sampleRate * duration, sampleRate);

  // noise burst
  const noiseBuffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // seeded-ish pseudo random using seed
    const x = Math.sin((i + seed * 9973) * 12.9898) * 43758.5453;
    data[i] = (x - Math.floor(x)) * 2 - 1;
    // fade out
    data[i] *= 1 - (i / data.length) * 0.9;
  }
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  // bandpass filter to mimic human voice / event sound
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 800 + ((seed % 5) * 300);
  bp.Q.value = 1.5;

  // gain envelope
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, 0);
  gain.gain.exponentialRampToValueAtTime(1.0, 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, duration - 0.05);

  noiseSource.connect(bp);
  bp.connect(gain);
  gain.connect(ctx.destination);

  noiseSource.start(0);
  const rendered = await ctx.startRendering();

  // convert AudioBuffer to WAV Blob (16-bit PCM)
  const wav = audioBufferToWav(rendered);
  const blob = new Blob([wav], { type: 'audio/wav' });
  return blob;
}

// helper: encode AudioBuffer to WAV (16-bit PCM)
function audioBufferToWav(buffer, opt) {
  opt = opt || {}
  var numChannels = buffer.numberOfChannels
  var sampleRate = buffer.sampleRate
  var format = opt.float32 ? 3 : 1
  var bitDepth = format === 3 ? 32 : 16

  var result
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1))
  } else {
    result = buffer.getChannelData(0)
  }

  return encodeWAV(result, format, sampleRate, numChannels, bitDepth)
}

function interleave(inputL, inputR) {
  var length = inputL.length + inputR.length
  var result = new Float32Array(length)

  var index = 0
  var inputIndex = 0

  while (index < length) {
    result[index++] = inputL[inputIndex]
    result[index++] = inputR[inputIndex]
    inputIndex++
  }
  return result
}

function encodeWAV(samples, format, sampleRate, numChannels, bitDepth) {
  var bytesPerSample = bitDepth / 8
  var blockAlign = numChannels * bytesPerSample

  var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  var view = new DataView(buffer)

  /* RIFF identifier */
  writeString(view, 0, 'RIFF')
  /* file length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  /* RIFF type */
  writeString(view, 8, 'WAVE')
  /* format chunk identifier */
  writeString(view, 12, 'fmt ')
  /* format chunk length */
  view.setUint32(16, 16, true)
  /* sample format (raw) */
  view.setUint16(20, format === 3 ? 3 : 1, true)
  /* channel count */
  view.setUint16(22, numChannels, true)
  /* sample rate */
  view.setUint32(24, sampleRate, true)
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true)
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true)
  /* bits per sample */
  view.setUint16(34, bitDepth, true)
  /* data chunk identifier */
  writeString(view, 36, 'data')
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true)

  if (format === 1) { // PCM
    floatTo16BitPCM(view, 44, samples)
  } else {
    writeFloat32(view, 44, samples)
  }

  return view
}

function floatTo16BitPCM(output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]))
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
}

function writeFloat32(output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 4) {
    output.setFloat32(offset, input[i], true)
  }
}

function writeString(view, offset, string) {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

// ---------- Map Heat Layer Hook ----------
function HeatLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Remove existing heat layer if it exists
    const existing = map._heatLayer;
    if (existing) {
      map.removeLayer(existing);
      map._heatLayer = null;
    }

    const heatPoints = points.map((p) => [p.lat, p.lng, p.severity]);
    if (heatPoints.length === 0) return;

    const heat = L.heatLayer(heatPoints, {
      radius: 25,
      blur: 20,
      maxZoom: 11,
    });

    heat.addTo(map);
    map._heatLayer = heat;

    return () => {
      if (map._heatLayer) {
        map.removeLayer(map._heatLayer);
        map._heatLayer = null;
      }
    };
  }, [map, points]);

  return null;
}

// ---------- Main App ----------
export default function App() {
  const [events, setEvents] = useState(() => generateSyntheticEvents(700));
  const [user, setUser] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState({});
  const audioCache = useRef({});
  const mapRef = useRef(null);
  const [viewMode, setViewMode] = useState('public'); // 'public' or 'private'
  const [query, setQuery] = useState('');
  const [timeFilterDays, setTimeFilterDays] = useState(7);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Pre-generate audio blobs and store refs (async)
  useEffect(() => {
    let mounted = true;
    (async () => {
      for (let i = 0; i < events.length; i++) {
        const id = events[i].id;
        if (!audioCache.current[id]) {
          setLoadingAudio(s => ({ ...s, [id]: true }));
          try {
            const blob = await synthesizeAudioBlobForEvent(i);
            audioCache.current[id] = URL.createObjectURL(blob);
          } catch (e) {
            audioCache.current[id] = null;
          }
          if (!mounted) return;
          setLoadingAudio(s => ({ ...s, [id]: false }));
        }
      }
    })();
    return () => { mounted = false; }
  }, [events]);

  // filtered events based on time filter
  const filteredEvents = useMemo(() => {
    const cutoff = Date.now() - timeFilterDays * 24 * 3600 * 1000;
    return events.filter(e => new Date(e.timestamp).getTime() >= cutoff);
  }, [events, timeFilterDays]);

  // Search -> geocode using Nominatim and pan map
  async function handleSearch() {
    if (!query) return;
    try {
      const q = encodeURIComponent(query + ' USA');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
      const data = await res.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (mapRef.current) {
          mapRef.current.setView([lat, lon], 12);
        }
      } else {
        alert('Location not found');
      }
    } catch (err) {
      console.error(err);
      alert('Geocoding failed');
    }
  }

  // Mock login
  function handleLogin(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const username = form.get('username');
    const password = form.get('password');
    if (username === MOCK_AUTH.username && password === MOCK_AUTH.password) {
      setUser({ username });
      setViewMode('private');
    } else {
      alert('Invalid credentials');
    }
  }

  // play audio
  function playEventAudio(ev) {
    const url = audioCache.current[ev.id];
    if (!url) { alert('Audio not ready'); return; }
    const a = new Audio(url);
    a.play();
  }

  // verify event (authority only)
  function toggleVerify(id) {
    setEvents(evs => evs.map(ev => ev.id === id ? { ...ev, verified: !ev.verified } : ev));
  }

  function exportCSV() {
    const headers = ['id','lat','lng','type','severity','timestamp','verified','notes'];
    const rows = events.map(ev => headers.map(h => JSON.stringify(ev[h] || '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'events_export.csv'; a.click();
  }

  // focus map on event
  function focusOnEvent(ev) {
    if (mapRef.current) mapRef.current.setView([ev.lat, ev.lng], 14);
    setSelectedEvent(ev.id);
  }

  // Add a note (authority)
  function addNote(id) {
    const note = prompt('Add a short note');
    if (note !== null) {
      setEvents(evs => evs.map(ev => ev.id === id ? { ...ev, notes: (ev.notes || '') + '\n' + note } : ev));
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'none' }}>
      <aside style={{ width: 360, borderRight: '1px solid #fca5a5', padding: 24, overflowY: 'auto', background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 32px rgba(255,71,71,0.08)' }}>
        <h2 style={{ color: '#ff4747', fontWeight: 800, letterSpacing: 2, fontSize: '2rem', marginBottom: 8 }}>MURMUR</h2>
        <div className="murmur-card">
          <span className="murmur-label">Search (zip/city/address):</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input className="murmur-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g., 94103 or Miami, FL" style={{ flex: 1 }} />
            <button className="murmur-btn" onClick={handleSearch}>Go</button>
          </div>
        </div>

        <div className="murmur-card">
          <span className="murmur-label">Time filter (days):</span>
          <select className="murmur-select" value={timeFilterDays} onChange={e => setTimeFilterDays(Number(e.target.value))} style={{ width: '100%' }}>
            <option value={1}>Last 24 hours</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>

        <div className="murmur-card">
          <strong className="murmur-section-title">Counts</strong>
          <div>Showing <b>{filteredEvents.length}</b> events</div>
          <div>Total generated <b>{events.length}</b></div>
        </div>

        {viewMode === 'public' ? (
          <div className="murmur-card">
            <h3 className="murmur-section-title">Public Controls</h3>
            <p style={{ color: '#64748b' }}>The public sees the heatmap only. No audio or event details.</p>
            <button className="murmur-btn" onClick={() => setViewMode('private')}>Authorities? Log in</button>
          </div>
        ) : (
          <div className="murmur-card">
            <h3 className="murmur-section-title">Authority Controls</h3>
            {!user ? (
              <form onSubmit={handleLogin}>
                <div><input className="murmur-input" name="username" placeholder="username" defaultValue="authority" /></div>
                <div><input className="murmur-input" name="password" placeholder="password" type="password" defaultValue="password123" /></div>
                <div><button className="murmur-btn" type="submit">Login</button></div>
              </form>
            ) : (
              <div>
                <div>Signed in: <b>{user.username}</b> <button className="murmur-btn" style={{ marginLeft: 8, background: '#f87171', color: '#fff' }} onClick={() => { setUser(null); setViewMode('public'); }}>Sign out</button></div>
                <div style={{ marginTop: 8 }}>
                  <button className="murmur-btn" onClick={exportCSV}>Export CSV</button>
                  <button className="murmur-btn" style={{ marginLeft: 8 }} onClick={() => {
                    const top = [...events].sort((a,b)=>b.severity-a.severity).slice(0,5).map(e=>e.id);
                    setEvents(evs=>evs.map(ev=> top.includes(ev.id) ? { ...ev, verified: true } : ev));
                  }}>Mark top-5 verified</button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h4 className="murmur-section-title">Recent Events (authority)</h4>
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {filteredEvents.slice().sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).map(ev => (
                      <div key={ev.id} style={{ padding: 8, borderBottom: '1px solid #fca5a5', background: ev.verified ? 'rgba(255,71,71,0.08)' : 'none', borderRadius: 8, marginBottom: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ color: '#ff4747' }}>{ev.type}</strong> • <span style={{ color: '#f59e42' }}>sev {ev.severity}</span>
                            <div style={{ fontSize: 12, color: '#7f1d1d' }}>{new Date(ev.timestamp).toLocaleString()}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="murmur-btn" style={{ padding: '4px 10px', fontSize: '0.95rem' }} onClick={()=>focusOnEvent(ev)}>Focus</button>
                            <button className="murmur-btn" style={{ padding: '4px 10px', fontSize: '0.95rem' }} onClick={()=>playEventAudio(ev)} disabled={loadingAudio[ev.id]}>Play</button>
                            <button className="murmur-btn" style={{ padding: '4px 10px', fontSize: '0.95rem', background: ev.verified ? '#ff4747' : '#f87171' }} onClick={()=>toggleVerify(ev.id)}>{ev.verified ? 'Unverify' : 'Verify'}</button>
                            <button className="murmur-btn" style={{ padding: '4px 10px', fontSize: '0.95rem', background: '#fbbf24', color: '#7f1d1d' }} onClick={()=>addNote(ev.id)}>Note</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, marginTop: 6, color: '#7f1d1d' }}>{ev.notes?.split('\n').slice(-2).join(' — ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="murmur-card">
          <h4 className="murmur-section-title">Tips & safety</h4>
          <p style={{ color: '#64748b' }}>Data shown here is synthetic. In a production deployment: ensure strict access controls, encrypted audio storage and streaming, auditing, consent/legal compliance, rate-limiting and abuse protections.</p>
        </div>
      </aside>

      <main style={{ flex: 1, boxShadow: '0 0 32px rgba(255,71,71,0.10)' }}>
        <MapContainer center={[39.5, -98.35]} zoom={4} style={{ height: '100%', width: '100%', borderRadius: '0 0 0 24px', boxShadow: '0 4px 32px rgba(255,71,71,0.10)' }} whenCreated={m => { mapRef.current = m; }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <HeatLayer points={filteredEvents} />

          {/* show markers for private users so they can click and play audio */}
          {viewMode === 'private' && user && filteredEvents.map(ev => (
            <Pane key={ev.id} name={`marker-${ev.id}`} style={{ zIndex: 600 }}>
              <CircleMarker center={[ev.lat, ev.lng]} radius={6 + ev.severity * 1.5}>
                <Popup>
                  <div style={{ minWidth: 220 }}>
                    <div><strong style={{ color: '#ff4747' }}>{ev.type}</strong> — <span style={{ color: '#f59e42' }}>sev {ev.severity}</span></div>
                    <div style={{ fontSize: 12, color: '#7f1d1d' }}>{new Date(ev.timestamp).toLocaleString()}</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                      <button className="murmur-btn" style={{ padding: '4px 10px', fontSize: '0.95rem' }} onClick={() => playEventAudio(ev)} disabled={loadingAudio[ev.id]}>Play audio</button>
                      <button className="murmur-btn" style={{ padding: '4px 10px', fontSize: '0.95rem', background: ev.verified ? '#ff4747' : '#f87171' }} onClick={() => toggleVerify(ev.id)}>{ev.verified ? 'Unverify' : 'Verify'}</button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button className="murmur-btn" style={{ padding: '4px 10px', fontSize: '0.95rem', background: '#fbbf24', color: '#7f1d1d' }} onClick={() => addNote(ev.id)}>Add note</button>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </Pane>
          ))}
        </MapContainer>
      </main>
    </div>
  );
}