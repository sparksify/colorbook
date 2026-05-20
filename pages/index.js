import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { THEMES, COMPLEXITIES, PAGE_COUNTS } from '../lib/themes';

function StepBadge({ number, label, active, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? '#22c55e' : active ? '#f97316' : '#e7e5e4', color: done || active ? '#fff' : '#a8a29e', fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.3s' }}>
        {done ? '✓' : number}
      </div>
      <span style={{ fontWeight: 800, fontSize: 14, color: active || done ? '#1c1917' : '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.3s' }}>
        {label}
      </span>
    </div>
  );
}

function ThemeCard({ theme, selected, onClick, disabled }) {
  return (
    <div onClick={() => !disabled && onClick()} style={{ border: selected ? `2.5px solid ${theme.color}` : '1.5px solid #e7e5e4', borderRadius: 12, padding: '12px 8px', textAlign: 'center', cursor: disabled ? 'default' : 'pointer', background: selected ? `${theme.color}15` : '#fff', transform: selected ? 'scale(1.04)' : 'scale(1)', transition: 'all 0.18s', position: 'relative', opacity: disabled ? 0.5 : 1 }}>
      {selected && <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: theme.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 900 }}>✓</div>}
      <div style={{ fontSize: 24, marginBottom: 4 }}>{theme.emoji}</div>
      <p style={{ fontWeight: 800, fontSize: 12, color: '#1c1917', margin: 0 }}>{theme.label}</p>
      <p style={{ fontSize: 10, color: '#78716c', margin: '2px 0 0' }}>{theme.desc}</p>
    </div>
  );
}

function PageThumbnail({ index, scene, status, b64 }) {
  const borderColor = status === 'done' || status === 'placeholder' ? '#22c55e' : status === 'generating' ? '#f97316' : '#e7e5e4';
  return (
    <div style={{ aspectRatio: '1', border: `2px solid ${borderColor}`, borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#fafaf9', transition: 'border-color 0.3s' }}>
      {b64 ? (
        <img src={`data:image/png;base64,${b64}`} alt={`Page ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: status === 'placeholder' ? 'blur(5px) brightness(1.05)' : 'none', transition: 'filter 0.3s' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          <div style={{ fontSize: 18, animation: status === 'generating' ? 'spin 1.2s linear infinite' : 'none' }}>{status === 'generating' ? '⚙️' : status === 'error' ? '❌' : '🖼️'}</div>
          <p style={{ fontSize: 9, color: '#a8a29e', textAlign: 'center', margin: '4px 0 0', lineHeight: 1.3 }}>{status === 'error' ? 'Failed' : scene.slice(0, 32) + '...'}</p>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 4, right: 5, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4 }}>{index + 1}</div>
      {status === 'done' && <div style={{ position: 'absolute', top: 5, left: 5, background: '#22c55e', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4 }}>✓</div>}
      {status === 'placeholder' && <div style={{ position: 'absolute', top: 5, left: 5, background: '#f97316', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4 }}>preview</div>}
    </div>
  );
}

// Compress image to target size in browser
function compressImage(file, maxDim, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = maxDim; canvas.height = maxDim;
        canvas.getContext('2d').drawImage(img, sx, sy, minDim, minDim, 0, 0, maxDim, maxDim);
        resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e) { throw new Error(text.slice(0, 200)); }
}

export default function Home() {
  const [photo, setPhoto] = useState(null);
  const [photoBase64, setPhotoBase64] = useState('');
  const [photoMime] = useState('image/jpeg');
  const [theme, setTheme] = useState('dinosaurs');
  const [pageCount, setPageCount] = useState(4);
  const [complexity, setComplexity] = useState('medium');
  const [childName, setChildName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [descriptor, setDescriptor] = useState('');
  const [pageStatuses, setPageStatuses] = useState([]);
  const [pageImages, setPageImages] = useState([]);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [pdfBase64, setPdfBase64] = useState('');

  const inputRef = useRef();
  const selectedTheme = THEMES.find(t => t.id === theme);
  const selectedComplexity = COMPLEXITIES.find(c => c.id === complexity);
  const scenes = selectedTheme.scenes.slice(0, pageCount);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setPhoto(file);
    // Two versions: small for analysis (128px), medium for generation reference (256px)
    const smallB64 = await compressImage(file, 128, 0.75);
    setPhotoBase64(smallB64);
    setStep(s => Math.max(s, 2));
    setDone(false); setPdfBase64(''); setError('');
  }, []);

  const handleDrop = useCallback((e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }, [handleFile]);

  const removePhoto = () => { setPhoto(null); setPhotoBase64(''); setStep(1); setDone(false); setPdfBase64(''); setDescriptor(''); setPageStatuses([]); setPageImages([]); setProgress(0); setProgressMsg(''); setError(''); };

  const updatePageStatus = (i, s) => setPageStatuses(prev => { const n=[...prev]; n[i]=s; return n; });
  const updatePageImage = (i, b) => setPageImages(prev => { const n=[...prev]; n[i]=b; return n; });

  const generateBook = async () => {
    setGenerating(true); setDone(false); setError(''); setPdfBase64('');
    setStep(4);
    setPageStatuses(Array(pageCount).fill('pending'));
    setPageImages(Array(pageCount).fill(null));

    try {
      // Step 1: Analyze photo — use tiny 128px version
      setProgress(5); setProgressMsg('Analyzing photo...');
      const analyzeRes = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: photoBase64, mimeType: 'image/jpeg' }),
      });
      if (!analyzeRes.ok) { const d = await safeJson(analyzeRes); throw new Error(d.error || 'Photo analysis failed'); }
      const { descriptor: desc } = await analyzeRes.json();
      setDescriptor(desc);
      setProgress(18); setProgressMsg('Character captured! Generating pages...');

      // Get a medium-sized version for generation (256px)
      const genPhotoB64 = photo ? await compressImage(photo, 256, 0.82) : photoBase64;

      // Step 2: Generate pages
      const generatedImages = [];
      for (let i = 0; i < scenes.length; i++) {
        setProgress(18 + Math.round(((i + 0.5) / scenes.length) * 62));
        updatePageStatus(i, 'generating');

        if (i === 0) {
          setProgressMsg('Generating your personalized page...');
          let success = false;
          for (let attempt = 0; attempt < 2 && !success; attempt++) {
            try {
              const genRes = await fetch('/api/generate-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  characterDescriptor: desc,
                  scene: scenes[i],
                  complexityModifier: selectedComplexity.promptModifier,
                  childName,
                  imageBase64: genPhotoB64,
                  mimeType: 'image/jpeg',
                }),
              });
              if (!genRes.ok) { const d = await safeJson(genRes); throw new Error(d.error || 'Generation failed'); }
              const data = await genRes.json();
              if (data.b64) {
                updatePageImage(i, data.b64);
                generatedImages.push({ b64: data.b64 });
                updatePageStatus(i, 'done');
                success = true;
              } else throw new Error('No image returned');
            } catch(e) {
              if (attempt >= 1) { updatePageStatus(i, 'error'); generatedImages.push({ b64: null }); success = true; }
              else await sleep(2000);
            }
          }
        } else {
          // Blurred preview from page 1
          await sleep(250);
          setProgressMsg(`Preparing page ${i + 1} preview...`);
          const firstB64 = generatedImages[0]?.b64 || null;
          generatedImages.push({ b64: firstB64, isPlaceholder: true });
          updatePageImage(i, firstB64);
          updatePageStatus(i, 'placeholder');
        }
        setProgress(18 + Math.round(((i + 1) / scenes.length) * 62));
      }

      // Step 3: Build PDF entirely in browser — no server needed
      setProgress(88); setProgressMsg('Building your PDF...');
      const realImages = generatedImages.filter(img => img?.b64 && !img.isPlaceholder);
      if (realImages.length === 0) throw new Error('No images generated successfully');

      const { PDFDocument, rgb } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js');
      const pdfDoc = await PDFDocument.create();
      const W = 612, H = 792, M = 36;
      const imgSize = Math.min(W - M * 2, H - M * 2 - 60);
      const imgX = M + (W - M * 2 - imgSize) / 2;
      const imgY = M + 24;

      // Cover page
      const cover = pdfDoc.addPage([W, H]);
      cover.drawRectangle({ x: M, y: M, width: W-M*2, height: H-M*2, borderColor: rgb(0.9,0.6,0.2), borderWidth: 2 });
      cover.drawRectangle({ x: M+6, y: M+6, width: W-M*2-12, height: H-M*2-12, borderColor: rgb(0.9,0.7,0.3), borderWidth: 0.5 });

      for (let i = 0; i < realImages.length; i++) {
        const page = pdfDoc.addPage([W, H]);
        try {
          const bytes = Uint8Array.from(atob(realImages[i].b64), c => c.charCodeAt(0));
          const pngImg = await pdfDoc.embedPng(bytes);
          page.drawImage(pngImg, { x: imgX, y: imgY, width: imgSize, height: imgSize });
        } catch(e) { console.error('embed page', i+1, e.message); }
        page.drawRectangle({ x: imgX-2, y: imgY-2, width: imgSize+4, height: imgSize+4, borderColor: rgb(0.85,0.85,0.85), borderWidth: 0.5 });
      }

      const pdfBytes = await pdfDoc.save();
      let bin = ''; const arr = new Uint8Array(pdfBytes);
      for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
      setPdfBase64(btoa(bin));
      setProgress(100); setProgressMsg('Done! Ready to print.');
      setDone(true);

    } catch(err) {
      setError(err.message || 'Something went wrong');
      setProgress(0); setProgressMsg('');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = () => {
    if (!pdfBase64) return;
    const bytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${childName || 'my'}_${theme}_coloring_book.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canGenerate = !!photo && !generating;

  return (
    <>
      <Head>
        <title>ColorBook — Personalized AI Coloring Books</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎨</text></svg>" />
      </Head>

      <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #f0ede8', padding: '0 20px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 26 }}>🎨</span>
            <span style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: '#f97316' }}>ColorBook</span>
            <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, border: '1px solid #fde68a' }}>BETA</span>
          </div>
          <span style={{ fontSize: 12, color: '#78716c', fontWeight: 700 }}>AI-personalized coloring books ✨</span>
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 20px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Fredoka One', cursive", fontSize: 38, color: '#1c1917', margin: '0 0 10px', lineHeight: 1.15 }}>
            Your child. Their adventure.<br /><span style={{ color: '#f97316' }}>Ready to color. 🖍️</span>
          </h1>
          <p style={{ fontSize: 15, color: '#78716c', fontWeight: 600, maxWidth: 460, margin: '0 auto' }}>Upload a photo · pick a theme · get a personalized coloring book</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Step 1 */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <StepBadge number="1" label="Upload child's photo" active={step === 1} done={step > 1} />
              {photo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12 }}>
                  <img src={URL.createObjectURL(photo)} alt="preview" style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: '#1c1917', margin: 0 }}>{photo.name}</p>
                    {descriptor ? (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ fontSize: 11, color: '#15803d', fontWeight: 700, cursor: 'pointer' }}>✓ Character captured — click to review</summary>
                        <p style={{ fontSize: 11, color: '#15803d', margin: '4px 0 0', fontStyle: 'italic', lineHeight: 1.5 }}>{descriptor}</p>
                      </details>
                    ) : (
                      <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, margin: '3px 0 0' }}>✓ Photo ready</p>
                    )}
                  </div>
                  <button onClick={removePhoto} disabled={generating} style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>Remove</button>
                </div>
              ) : (
                <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => inputRef.current.click()} style={{ border: `2px dashed ${dragging ? '#f97316' : '#d6d3d1'}`, borderRadius: 14, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: dragging ? '#fff7ed' : '#fafaf9', transition: 'all 0.2s' }}>
                  <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                  <p style={{ fontWeight: 800, fontSize: 15, color: '#1c1917', margin: 0 }}>Drop a photo here or <span style={{ color: '#f97316' }}>click to browse</span></p>
                  <p style={{ fontSize: 12, color: '#78716c', fontWeight: 600, margin: '5px 0 0' }}>Clear front-facing photo works best · JPG / PNG</p>
                </div>
              )}
            </div>

            {/* Step 2 */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', opacity: step >= 2 ? 1 : 0.45, transition: 'opacity 0.3s' }}>
              <StepBadge number="2" label="Pick a theme" active={step === 2} done={step > 2} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                {THEMES.map(t => <ThemeCard key={t.id} theme={t} selected={theme === t.id} disabled={step < 2 || generating} onClick={() => setTheme(t.id)} />)}
              </div>
              {step >= 2 && (
                <div style={{ padding: '10px 14px', background: `${selectedTheme.color}12`, border: `1px solid ${selectedTheme.color}35`, borderRadius: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#57534e', margin: 0 }}>
                    {selectedTheme.emoji} <strong style={{ color: selectedTheme.color }}>{selectedTheme.label}:</strong> {scenes.slice(0,2).map(s => s.split(' ').slice(0,6).join(' ')).join(' · ')}{pageCount > 2 ? ` + ${pageCount-2} more` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Step 3 */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', opacity: step >= 2 ? 1 : 0.35, transition: 'opacity 0.3s' }}>
              <StepBadge number="3" label="Customize your book" active={step === 3} done={done} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Child's name (optional)</label>
                  <input type="text" placeholder="e.g. Steven" value={childName} onChange={e => setChildName(e.target.value)} disabled={generating} style={{ width: '100%', padding: '9px 13px', borderRadius: 10, border: '1.5px solid #e7e5e4', fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: '#1c1917', background: '#fff', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Number of pages</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {PAGE_COUNTS.map(n => (
                      <button key={n} onClick={() => setPageCount(n)} disabled={generating} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: pageCount === n ? '2px solid #f97316' : '1.5px solid #e7e5e4', background: pageCount === n ? '#fff7ed' : '#fff', color: pageCount === n ? '#f97316' : '#57534e', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13, cursor: generating ? 'default' : 'pointer', transition: 'all 0.15s' }}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Complexity</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {COMPLEXITIES.map(c => (
                  <div key={c.id} onClick={() => !generating && setComplexity(c.id)} style={{ padding: '11px 12px', borderRadius: 12, border: complexity === c.id ? '2px solid #f97316' : '1.5px solid #e7e5e4', background: complexity === c.id ? '#fff7ed' : '#fff', cursor: generating ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                    <p style={{ fontWeight: 800, fontSize: 13, color: complexity === c.id ? '#f97316' : '#1c1917', margin: 0 }}>{c.label}</p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#78716c', margin: '2px 0' }}>{c.age}</p>
                    <p style={{ fontSize: 10, color: '#a8a29e', margin: 0 }}>{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px' }}><p style={{ fontWeight: 700, fontSize: 13, color: '#dc2626', margin: 0 }}>⚠️ {error}</p></div>}

            <button onClick={generateBook} disabled={!canGenerate} style={{ width: '100%', padding: '16px', borderRadius: 16, border: 'none', background: !canGenerate ? '#e7e5e4' : 'linear-gradient(135deg, #f97316, #fb923c)', color: !canGenerate ? '#a8a29e' : '#fff', fontFamily: "'Fredoka One', cursive", fontSize: 19, cursor: !canGenerate ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: !canGenerate ? 'none' : '0 4px 18px rgba(249,115,22,0.3)', transition: 'all 0.2s' }}>
              {generating ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span> Generating...</> : done ? <><span>🔄</span> Regenerate</> : <><span>✨</span> Generate My Coloring Book</>}
            </button>

            {(generating || done) && (
              <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ fontFamily: "'Fredoka One', cursive", fontSize: 16, color: '#1c1917', margin: 0 }}>
                    {done ? `🎉 ${childName ? childName + "'s" : 'Your'} ${selectedTheme.label} Coloring Book` : '⚙️ Generating...'}
                  </p>
                  {done && pdfBase64 && (
                    <button onClick={downloadPDF} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>⬇️ Download PDF</button>
                  )}
                </div>
                <div style={{ height: 5, background: '#f0ede8', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #f97316, #fbbf24)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#78716c', margin: '0 0 14px' }}>{progressMsg}</p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(pageCount, 4)}, 1fr)`, gap: 8 }}>
                  {scenes.map((scene, i) => <PageThumbnail key={i} index={i} scene={scene} status={pageStatuses[i] || 'pending'} b64={pageImages[i]} />)}
                </div>
                {done && (
                  <div style={{ marginTop: 14, padding: '11px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>✅</span>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: 12, color: '#166534', margin: 0 }}>Ready to print!</p>
                      <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, margin: '2px 0 0' }}>8.5×11" · Any home printer</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 18, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <p style={{ fontFamily: "'Fredoka One', cursive", fontSize: 16, color: '#1c1917', margin: '0 0 14px' }}>How it works</p>
              {[
                { icon: '📷', title: 'AI reads your photo', desc: 'GPT-4o Vision extracts their hair, face, glasses, and distinctive features.' },
                { icon: '🎨', title: 'Personalized scenes', desc: 'Each page features your child as the hero with their actual appearance.' },
                { icon: '🖨️', title: 'Print at home', desc: 'Download a crisp PDF. Works on any printer with standard paper.' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 2 ? 12 : 0 }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                  <div><p style={{ fontWeight: 800, fontSize: 12, color: '#1c1917', margin: 0 }}>{item.title}</p><p style={{ fontSize: 11, color: '#78716c', margin: '2px 0 0', lineHeight: 1.5 }}>{item.desc}</p></div>
                </div>
              ))}
            </div>
            <div style={{ background: 'linear-gradient(135deg, #fff7ed, #fef3e8)', borderRadius: 18, border: '1.5px solid #fed7aa', padding: 18 }}>
              <p style={{ fontFamily: "'Fredoka One', cursive", fontSize: 14, color: '#f97316', margin: '0 0 10px' }}>📸 Photo tips</p>
              {['Front-facing, clear view of face', 'Good lighting — no shadows', 'Solo photo (no other people)', 'Glasses and accessories included', 'Recent photo works best'].map((tip, i) => (
                <p key={i} style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 5px' }}>✓ {tip}</p>
              ))}
            </div>
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 18, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <p style={{ fontFamily: "'Fredoka One', cursive", fontSize: 14, color: '#1c1917', margin: '0 0 10px' }}>{selectedTheme.emoji} Scenes in this book</p>
              {scenes.map((scene, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', background: selectedTheme.color, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{i+1}</span>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#57534e', margin: 0, lineHeight: 1.4 }}>{scene.split(' ').slice(0,8).join(' ')}...</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
