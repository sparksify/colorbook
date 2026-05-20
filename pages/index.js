import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { THEMES, COMPLEXITIES, PAGE_COUNTS } from '../lib/themes';

function StepBadge({ number, label, active, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? '#22c55e' : active ? '#f97316' : '#e7e5e4', color: done || active ? '#fff' : '#a8a29e', fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {done ? '✓' : number}
      </div>
      <span style={{ fontWeight: 800, fontSize: 14, color: active || done ? '#1c1917' : '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
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
  return (
    <div style={{ aspectRatio: '1', border: `2px solid ${status === 'done' ? '#22c55e' : status === 'placeholder' ? '#f97316' : status === 'generating' ? '#f97316' : '#e7e5e4'}`, borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#fafaf9' }}>
      {b64 ? (
        <>
          <img src={`data:image/png;base64,${b64}`} alt={`Page ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: status === 'placeholder' ? 'blur(6px) brightness(1.05)' : 'none' }} />
          {status === 'placeholder' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.15)' }}>
              <span style={{ background: 'rgba(249,115,22,0.85)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 6 }}>PREVIEW</span>
            </div>
          )}
        </>
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          <div style={{ fontSize: 18, animation: status === 'generating' ? 'spin 1.2s linear infinite' : 'none' }}>
            {status === 'generating' ? '⚙️' : status === 'error' ? '❌' : '🖼️'}
          </div>
          <p style={{ fontSize: 9, color: '#a8a29e', textAlign: 'center', margin: '4px 0 0', lineHeight: 1.3 }}>
            {status === 'error' ? 'Failed' : scene.slice(0, 30) + '...'}
          </p>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 4, right: 5, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4 }}>{index + 1}</div>
    </div>
  );
}

function compressImage(file, size, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        c.getContext('2d').drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', quality).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function safePost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error('Server error: ' + text.slice(0, 120)); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function Home() {
  const [photo, setPhoto] = useState(null);
  const [photoSmall, setPhotoSmall] = useState('');   // 128px for analysis
  const [photoMed, setPhotoMed] = useState('');        // 256px for generation
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
  const [generatedImages, setGeneratedImages] = useState([]);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [done, setDone] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfBase64, setPdfBase64] = useState('');
  const inputRef = useRef();

  const selectedTheme = THEMES.find(t => t.id === theme);
  const selectedComplexity = COMPLEXITIES.find(c => c.id === complexity);
  const scenes = selectedTheme.scenes.slice(0, pageCount);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setPhoto(file);
    const [small, med] = await Promise.all([
      compressImage(file, 128, 0.75),
      compressImage(file, 256, 0.82),
    ]);
    setPhotoSmall(small);
    setPhotoMed(med);
    setStep(s => Math.max(s, 2));
    setDone(false); setPdfBase64(''); setPdfError(''); setDescriptor('');
    setPageStatuses([]); setPageImages([]); setGeneratedImages([]);
  }, []);

  const removePhoto = () => {
    setPhoto(null); setPhotoSmall(''); setPhotoMed(''); setStep(1);
    setDone(false); setPdfBase64(''); setPdfError(''); setDescriptor('');
    setPageStatuses([]); setPageImages([]); setGeneratedImages([]);
    setProgress(0); setProgressMsg('');
  };

  const setPageStatus = (i, s) => setPageStatuses(prev => { const n=[...prev]; n[i]=s; return n; });
  const setPageImage = (i, b) => setPageImages(prev => { const n=[...prev]; n[i]=b; return n; });

  const buildPDF = async (images) => {
    // Dynamically load pdf-lib via script tag so it works in Next.js
    if (!window.PDFLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    const { PDFDocument, rgb } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const W = 612, H = 792, M = 36;
    const imgSize = Math.min(W - M*2, H - M*2 - 60);
    const imgX = M + (W - M*2 - imgSize)/2, imgY = M + 24;

    // Cover
    const cover = pdfDoc.addPage([W, H]);
    cover.drawRectangle({ x: M, y: M, width: W-M*2, height: H-M*2, borderColor: rgb(0.9,0.6,0.2), borderWidth: 2 });
    cover.drawRectangle({ x: M+6, y: M+6, width: W-M*2-12, height: H-M*2-12, borderColor: rgb(0.9,0.7,0.3), borderWidth: 0.5 });

    for (let i = 0; i < images.length; i++) {
      const page = pdfDoc.addPage([W, H]);
      try {
        const bytes = Uint8Array.from(atob(images[i].b64), c => c.charCodeAt(0));
        const png = await pdfDoc.embedPng(bytes);
        page.drawImage(png, { x: imgX, y: imgY, width: imgSize, height: imgSize });
      } catch(e) { console.error('PDF embed p', i+1, e.message); }
      page.drawRectangle({ x: imgX-2, y: imgY-2, width: imgSize+4, height: imgSize+4, borderColor: rgb(0.85,0.85,0.85), borderWidth: 0.5 });
    }

    const bytes = await pdfDoc.save();
    let bin = ''; const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  };

  const generateBook = async () => {
    setGenerating(true); setDone(false); setPdfError(''); setPdfBase64('');
    setStep(4);
    setPageStatuses(Array(pageCount).fill('pending'));
    setPageImages(Array(pageCount).fill(null));
    setGeneratedImages([]);

    try {
      // Step 1: Analyze
      setProgress(5); setProgressMsg('Analyzing photo...');
      const { descriptor: desc } = await safePost('/api/analyze-photo', {
        imageBase64: photoSmall,
        mimeType: 'image/jpeg',
      });
      setDescriptor(desc);
      setProgress(18); setProgressMsg('Generating your personalized page...');

      // Step 2: Generate page 1 only — rest are instant blurred previews
      const imgs = [];

      setPageStatus(0, 'generating');
      let realB64 = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const data = await safePost('/api/generate-page', {
            characterDescriptor: desc,
            scene: scenes[0],
            complexityModifier: selectedComplexity.promptModifier,
            childName,
            imageBase64: photoMed,
            mimeType: 'image/jpeg',
          });
          realB64 = data.b64;
          break;
        } catch(e) {
          if (attempt >= 1) throw e;
          await sleep(2000);
        }
      }

      if (!realB64) throw new Error('Image generation failed');
      setPageImage(0, realB64);
      setPageStatus(0, 'done');
      imgs.push({ b64: realB64 });
      setProgress(80);

      // Instantly fill remaining pages with blurred preview
      for (let i = 1; i < scenes.length; i++) {
        await sleep(150);
        setPageImage(i, realB64);
        setPageStatus(i, 'placeholder');
        imgs.push({ b64: realB64, isPlaceholder: true });
        setProgress(80 + Math.round((i / (scenes.length - 1)) * 8));
      }

      setGeneratedImages(imgs);
      setProgress(88); setProgressMsg('Building PDF...');

      // Step 3: Build PDF in browser
      try {
        const pdf = await buildPDF(imgs.filter(img => !img.isPlaceholder));
        setPdfBase64(pdf);
        setProgress(100); setProgressMsg('Done! Ready to print.');
      } catch(pdfErr) {
        // PDF failed but images are fine — show them, report PDF error separately
        setPdfError('PDF generation failed: ' + pdfErr.message + ' — you can still save images by right-clicking.');
        setProgress(100); setProgressMsg('Pages generated! PDF had an issue.');
      }
      setDone(true);

    } catch(err) {
      setProgress(0); setProgressMsg('');
      // Don't clear page images — show what was generated
      setPageStatuses(prev => prev.map(s => s === 'generating' ? 'error' : s));
      throw err; // re-throw so the outer catch shows error
    }
  };

  const handleGenerate = async () => {
    try {
      await generateBook();
    } catch(err) {
      // Error display handled in render — images stay visible
      console.error(err);
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
    a.download = `${(childName || 'my').replace(/\s+/g,'_')}_${theme}_coloring_book.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
                        <summary style={{ fontSize: 11, color: '#15803d', fontWeight: 700, cursor: 'pointer' }}>✓ Character captured — tap to review</summary>
                        <p style={{ fontSize: 10, color: '#15803d', margin: '4px 0 0', fontStyle: 'italic', lineHeight: 1.5 }}>{descriptor}</p>
                      </details>
                    ) : <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, margin: '3px 0 0' }}>✓ Photo ready</p>}
                  </div>
                  <button onClick={removePhoto} disabled={generating} style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>Remove</button>
                </div>
              ) : (
                <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }} onClick={() => inputRef.current.click()} style={{ border: `2px dashed ${dragging ? '#f97316' : '#d6d3d1'}`, borderRadius: 14, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: dragging ? '#fff7ed' : '#fafaf9', transition: 'all 0.2s' }}>
                  <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                  <p style={{ fontWeight: 800, fontSize: 15, color: '#1c1917', margin: 0 }}>Drop a photo here or <span style={{ color: '#f97316' }}>click to browse</span></p>
                  <p style={{ fontSize: 12, color: '#78716c', fontWeight: 600, margin: '5px 0 0' }}>Clear front-facing photo works best</p>
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
                    {selectedTheme.emoji} <strong style={{ color: selectedTheme.color }}>{selectedTheme.label}:</strong>{' '}
                    {scenes.slice(0,2).map(s => s.split(' ').slice(0,5).join(' ')).join(' · ')}{pageCount > 2 ? ` +${pageCount-2} more` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Step 3 */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', opacity: step >= 2 ? 1 : 0.35, transition: 'opacity 0.3s' }}>
              <StepBadge number="3" label="Customize" active={step === 3} done={done} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Child's name</label>
                  <input type="text" placeholder="e.g. Steven" value={childName} onChange={e => setChildName(e.target.value)} disabled={generating} style={{ width: '100%', padding: '9px 13px', borderRadius: 10, border: '1.5px solid #e7e5e4', fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: '#1c1917', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Pages</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {PAGE_COUNTS.map(n => (
                      <button key={n} onClick={() => setPageCount(n)} disabled={generating} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: pageCount === n ? '2px solid #f97316' : '1.5px solid #e7e5e4', background: pageCount === n ? '#fff7ed' : '#fff', color: pageCount === n ? '#f97316' : '#57534e', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13, cursor: generating ? 'default' : 'pointer' }}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {COMPLEXITIES.map(c => (
                  <div key={c.id} onClick={() => !generating && setComplexity(c.id)} style={{ padding: '11px 12px', borderRadius: 12, border: complexity === c.id ? '2px solid #f97316' : '1.5px solid #e7e5e4', background: complexity === c.id ? '#fff7ed' : '#fff', cursor: generating ? 'default' : 'pointer' }}>
                    <p style={{ fontWeight: 800, fontSize: 13, color: complexity === c.id ? '#f97316' : '#1c1917', margin: 0 }}>{c.label}</p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#78716c', margin: '2px 0' }}>{c.age}</p>
                    <p style={{ fontSize: 10, color: '#a8a29e', margin: 0 }}>{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleGenerate} disabled={!photo || generating} style={{ width: '100%', padding: '16px', borderRadius: 16, border: 'none', background: !photo || generating ? '#e7e5e4' : 'linear-gradient(135deg, #f97316, #fb923c)', color: !photo || generating ? '#a8a29e' : '#fff', fontFamily: "'Fredoka One', cursive", fontSize: 19, cursor: !photo || generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: !photo ? 'none' : '0 4px 18px rgba(249,115,22,0.3)', transition: 'all 0.2s' }}>
              {generating ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span> Generating...</> : done ? <><span>🔄</span> Regenerate</> : <><span>✨</span> Generate My Coloring Book</>}
            </button>

            {/* Results — always visible once generation starts */}
            {(generating || done || pageImages.some(Boolean)) && (
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
                  {scenes.map((scene, i) => (
                    <PageThumbnail key={i} index={i} scene={scene} status={pageStatuses[i] || 'pending'} b64={pageImages[i]} />
                  ))}
                </div>

                {/* PDF error — shown without hiding images */}
                {pdfError && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
                    <p style={{ fontWeight: 700, fontSize: 12, color: '#dc2626', margin: 0 }}>⚠️ {pdfError}</p>
                  </div>
                )}

                {done && pdfBase64 && (
                  <div style={{ marginTop: 12, padding: '11px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>✅</span>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: 12, color: '#166534', margin: 0 }}>Ready to print!</p>
                      <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, margin: '2px 0 0' }}>8.5×11" · Any home printer · <strong>Page 1 is fully personalized</strong> — generate more pages when ready</p>
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
                { icon: '📷', title: 'AI reads your photo', desc: 'GPT-4o Vision extracts hair, glasses, skin tone and distinctive features.' },
                { icon: '🎨', title: 'Personalized scenes', desc: 'Your child is the hero with their actual appearance in every scene.' },
                { icon: '🖨️', title: 'Print at home', desc: 'Download a crisp PDF ready for any home printer.' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 2 ? 12 : 0 }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                  <div><p style={{ fontWeight: 800, fontSize: 12, color: '#1c1917', margin: 0 }}>{item.title}</p><p style={{ fontSize: 11, color: '#78716c', margin: '2px 0 0', lineHeight: 1.5 }}>{item.desc}</p></div>
                </div>
              ))}
            </div>

            <div style={{ background: 'linear-gradient(135deg, #fff7ed, #fef3e8)', borderRadius: 18, border: '1.5px solid #fed7aa', padding: 18 }}>
              <p style={{ fontFamily: "'Fredoka One', cursive", fontSize: 14, color: '#f97316', margin: '0 0 10px' }}>📸 Photo tips</p>
              {['Front-facing, clear view of face', 'Good lighting, no shadows', 'Solo photo — no other people', 'Glasses and accessories show up', 'Recent photo works best'].map((tip, i) => (
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
