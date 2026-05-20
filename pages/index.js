import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { THEMES, COMPLEXITIES, PAGE_COUNTS } from '../lib/themes';

// ─── Small reusable components ───────────────────────────────────────────────

function StepBadge({ number, label, active, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: done ? '#22c55e' : active ? '#f97316' : '#e7e5e4',
        color: done || active ? '#fff' : '#a8a29e',
        fontWeight: 900, fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.3s',
      }}>
        {done ? '✓' : number}
      </div>
      <span style={{
        fontWeight: 800, fontSize: 14,
        color: active || done ? '#1c1917' : '#a8a29e',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        transition: 'all 0.3s',
      }}>
        {label}
      </span>
    </div>
  );
}

function ThemeCard({ theme, selected, onClick, disabled }) {
  return (
    <div
      onClick={() => !disabled && onClick()}
      style={{
        border: selected ? `2.5px solid ${theme.color}` : '1.5px solid #e7e5e4',
        borderRadius: 12, padding: '12px 8px', textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer',
        background: selected ? `${theme.color}15` : '#fff',
        transform: selected ? 'scale(1.04)' : 'scale(1)',
        transition: 'all 0.18s', position: 'relative',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: 6, right: 6, width: 16, height: 16,
          borderRadius: '50%', background: theme.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#fff', fontWeight: 900,
        }}>✓</div>
      )}
      <div style={{ fontSize: 24, marginBottom: 4 }}>{theme.emoji}</div>
      <p style={{ fontWeight: 800, fontSize: 12, color: '#1c1917', margin: 0 }}>{theme.label}</p>
      <p style={{ fontSize: 10, color: '#78716c', margin: '2px 0 0' }}>{theme.desc}</p>
    </div>
  );
}

function PageThumbnail({ index, scene, status, b64 }) {
  const borderColor = status === 'done' ? '#22c55e' : status === 'generating' ? '#f97316' : '#e7e5e4';
  const borderWidth = status === 'done' || status === 'generating' ? 2 : 1.5;

  return (
    <div style={{
      aspectRatio: '1', border: `${borderWidth}px solid ${borderColor}`,
      borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#fafaf9',
      transition: 'border-color 0.3s',
    }}>
      {b64 ? (
        <img
          src={`data:image/png;base64,${b64}`}
          alt={`Page ${index + 1}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: status === 'placeholder' ? 'blur(6px) brightness(1.1)' : 'none' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 8,
        }}>
          <div style={{ fontSize: 18, animation: status === 'generating' ? 'spin 1.2s linear infinite' : 'none' }}>
            {status === 'generating' ? '⚙️' : status === 'error' ? '❌' : '🖼️'}
          </div>
          <p style={{ fontSize: 9, color: '#a8a29e', textAlign: 'center', margin: '4px 0 0', lineHeight: 1.3 }}>
            {status === 'error' ? 'Failed — will retry' : scene.slice(0, 32) + '...'}
          </p>
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 4, right: 5,
        background: 'rgba(0,0,0,0.5)', color: '#fff',
        fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
      }}>
        {index + 1}
      </div>
      {status === 'done' && (
        <div style={{
          position: 'absolute', top: 5, left: 5,
          background: '#22c55e', color: '#fff',
          fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
        }}>✓</div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Home() {
  // Form state
  const [photo, setPhoto] = useState(null);           // File object
  const [photoBase64, setPhotoBase64] = useState(''); // base64 string
  const [photoMime, setPhotoMime] = useState('');
  const [theme, setTheme] = useState('dinosaurs');
  const [pageCount, setPageCount] = useState(6);
  const [complexity, setComplexity] = useState('medium');
  const [childName, setChildName] = useState('');
  const [dragging, setDragging] = useState(false);

  // Generation state
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [descriptor, setDescriptor] = useState('');
  const [pageStatuses, setPageStatuses] = useState([]); // 'pending' | 'generating' | 'done' | 'error'
  const [pageImages, setPageImages] = useState([]);     // array of b64 strings
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [pdfBase64, setPdfBase64] = useState('');

  const inputRef = useRef();
  const selectedTheme = THEMES.find(t => t.id === theme);
  const selectedComplexity = COMPLEXITIES.find(c => c.id === complexity);
  const scenes = selectedTheme.scenes.slice(0, pageCount);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setPhoto(file);
    setPhotoMime(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1];
      setPhotoBase64(base64);
    };
    reader.readAsDataURL(file);
    setStep(s => Math.max(s, 2));
    setDone(false);
    setPdfBase64('');
    setError('');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const removePhoto = () => {
    setPhoto(null);
    setPhotoBase64('');
    setStep(1);
    setDone(false);
    setPdfBase64('');
    setDescriptor('');
    setPageStatuses([]);
    setPageImages([]);
    setProgress(0);
    setProgressMsg('');
    setError('');
  };

  // ── Generation pipeline ────────────────────────────────────────────────────

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const updatePageStatus = (index, status) => {
    setPageStatuses(prev => {
      const next = [...prev];
      next[index] = status;
      return next;
    });
  };

  const updatePageImage = (index, b64) => {
    setPageImages(prev => {
      const next = [...prev];
      next[index] = b64;
      return next;
    });
  };

  const generateBook = async () => {
    setGenerating(true);
    setDone(false);
    setError('');
    setPdfBase64('');
    setStep(4);
    setPageStatuses(Array(pageCount).fill('pending'));
    setPageImages(Array(pageCount).fill(null));

    try {
      // ── Step 1: Analyze photo ─────────────────────────────────────────────
      setProgress(5);
      setProgressMsg('Analyzing photo with GPT-4o Vision...');

      const analyzeRes = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: photoBase64, mimeType: photoMime }),
      });

      if (!analyzeRes.ok) {
        const text = await analyzeRes.text();
        let msg = 'Failed to analyze photo';
        try { msg = JSON.parse(text).error || msg; } catch(e) { msg = text.slice(0, 200); }
        throw new Error(msg);
      }

      const { descriptor: desc } = await analyzeRes.json();
      setDescriptor(desc);
      setProgress(18);
      setProgressMsg('Character extracted! Building scene prompts...');
      await sleep(400);

      // ── Step 2: Generate pages ────────────────────────────────────────────
      // Only generate page 1 for real. Remaining pages use a blurred
      // copy of page 1 as a preview placeholder to save API credits.
      const generatedImages = [];

      for (let i = 0; i < scenes.length; i++) {
        const pct = 18 + Math.round(((i + 0.5) / scenes.length) * 65);
        setProgress(pct);
        updatePageStatus(i, 'generating');

        if (i === 0) {
          // Generate the first page for real
          setProgressMsg(`Generating sample page...`);
          let attempts = 0;
          let success = false;

          while (attempts < 2 && !success) {
            try {
              const genRes = await fetch('/api/generate-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  characterDescriptor: desc,
                  scene: scenes[i],
                  complexityModifier: selectedComplexity.promptModifier,
                  childName,
                  imageBase64: photoBase64,
                  mimeType: photoMime,
                }),
              });

              if (!genRes.ok) {
                const text = await genRes.text();
                throw new Error(text.slice(0, 200));
              }

              const data = await genRes.json();
              if (data.b64) {
                updatePageImage(i, data.b64);
                generatedImages.push({ b64: data.b64 });
                updatePageStatus(i, 'done');
                success = true;
              } else {
                throw new Error('No image data returned');
              }
            } catch (pageError) {
              attempts++;
              if (attempts >= 2) {
                updatePageStatus(i, 'error');
                generatedImages.push({ b64: null });
                success = true;
              } else {
                await sleep(2000);
              }
            }
          }
        } else {
          // Use first page image as blurred placeholder for remaining pages
          await sleep(400);
          setProgressMsg(`Preparing page ${i + 1} preview...`);
          const firstB64 = generatedImages[0]?.b64 || null;
          generatedImages.push({ b64: firstB64, isPlaceholder: true });
          updatePageImage(i, firstB64);
          updatePageStatus(i, 'done');
        }

        setProgress(18 + Math.round(((i + 1) / scenes.length) * 65));
      }

      // ── Step 3: Assemble PDF ──────────────────────────────────────────────
      setProgress(88);
      setProgressMsg('Assembling your print-ready PDF...');

      // Only send real (non-placeholder) images to PDF
      const realImages = generatedImages.filter(img => img.b64 && !img.isPlaceholder);
      const pdfRes = await fetch('/api/create-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: realImages.length > 0 ? realImages : generatedImages,
          childName,
          theme: selectedTheme.label,
          pageCount: scenes.length,
        }),
      });

      if (!pdfRes.ok) {
        const err = await pdfRes.json();
        throw new Error(err.error || 'Failed to create PDF');
      }

      const { pdfBase64: pdf } = await pdfRes.json();
      setPdfBase64(pdf);
      setProgress(100);
      setProgressMsg(`Done! ${scenes.length} pages ready to print.`);
      setDone(true);

    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setProgress(0);
      setProgressMsg('');
    } finally {
      setGenerating(false);
    }
  };

  // ── PDF download ───────────────────────────────────────────────────────────

  const downloadPDF = () => {
    if (!pdfBase64) return;
    const bytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = childName
      ? `${childName.replace(/\s+/g, '_')}_${theme}_coloring_book.pdf`
      : `${theme}_coloring_book.pdf`;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const canGenerate = !!photo && !generating;

  return (
    <>
      <Head>
        <title>ColorBook — Personalized AI Coloring Books</title>
        <meta name="description" content="Upload a photo of your child, pick a theme, and get a personalized printable coloring book in under 60 seconds." />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎨</text></svg>" />
      </Head>

      {/* ── Header ── */}
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

        {/* ── Hero ── */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Fredoka One', cursive", fontSize: 38, color: '#1c1917', margin: '0 0 10px', lineHeight: 1.15 }}>
            Your child. Their adventure.<br />
            <span style={{ color: '#f97316' }}>Ready to color. 🖍️</span>
          </h1>
          <p style={{ fontSize: 15, color: '#78716c', fontWeight: 600, maxWidth: 460, margin: '0 auto' }}>
            Upload a photo · pick a theme · get a personalized coloring book in under 60 seconds
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Step 1: Upload */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <StepBadge number="1" label="Upload child's photo" active={step === 1} done={step > 1} />

              {photo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12 }}>
                  <img
                    src={URL.createObjectURL(photo)}
                    alt="preview"
                    style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: '#1c1917', margin: 0 }}>{photo.name}</p>
                    <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, margin: '3px 0 0' }}>
                      ✓ Photo ready — AI will extract character features
                    </p>
                    {descriptor && (
                      <p style={{ fontSize: 11, color: '#4ade80', margin: '4px 0 0', fontStyle: 'italic', color: '#15803d' }}>
                        "{descriptor.slice(0, 90)}..."
                      </p>
                    )}
                  </div>
                  <button
                    onClick={removePhoto}
                    disabled={generating}
                    style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current.click()}
                  style={{
                    border: `2px dashed ${dragging ? '#f97316' : '#d6d3d1'}`,
                    borderRadius: 14, padding: '32px 20px', textAlign: 'center',
                    cursor: 'pointer', background: dragging ? '#fff7ed' : '#fafaf9',
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    ref={inputRef} type="file" accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleFile(e.target.files[0])}
                  />
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                  <p style={{ fontWeight: 800, fontSize: 15, color: '#1c1917', margin: 0 }}>
                    Drop a photo here or <span style={{ color: '#f97316' }}>click to browse</span>
                  </p>
                  <p style={{ fontSize: 12, color: '#78716c', fontWeight: 600, margin: '5px 0 0' }}>
                    Clear, front-facing photo works best · JPG / PNG / WEBP
                  </p>
                </div>
              )}
            </div>

            {/* Step 2: Theme */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', opacity: step >= 2 ? 1 : 0.45, transition: 'opacity 0.3s' }}>
              <StepBadge number="2" label="Pick a theme" active={step === 2} done={step > 2} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                {THEMES.map(t => (
                  <ThemeCard
                    key={t.id} theme={t}
                    selected={theme === t.id}
                    disabled={step < 2 || generating}
                    onClick={() => setTheme(t.id)}
                  />
                ))}
              </div>
              {step >= 2 && (
                <div style={{ padding: '10px 14px', background: `${selectedTheme.color}12`, border: `1px solid ${selectedTheme.color}35`, borderRadius: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#57534e', margin: 0 }}>
                    {selectedTheme.emoji} <strong style={{ color: selectedTheme.color }}>{selectedTheme.label}:</strong>{' '}
                    {scenes.slice(0, 2).map(s => s.split(' ').slice(0, 6).join(' ')).join(' · ')}
                    {pageCount > 2 ? ` + ${pageCount - 2} more scenes` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Step 3: Configure */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', opacity: step >= 2 ? 1 : 0.35, transition: 'opacity 0.3s' }}>
              <StepBadge number="3" label="Customize your book" active={step === 3} done={done} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>
                    Child's name (optional)
                  </label>
                  <input
                    type="text" placeholder="e.g. Steven"
                    value={childName}
                    onChange={e => setChildName(e.target.value)}
                    disabled={generating}
                    style={{ width: '100%', padding: '9px 13px', borderRadius: 10, border: '1.5px solid #e7e5e4', fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: '#1c1917', background: '#fff', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>
                    Number of pages
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {PAGE_COUNTS.map(n => (
                      <button
                        key={n} onClick={() => setPageCount(n)} disabled={generating}
                        style={{
                          flex: 1, padding: '9px 0', borderRadius: 10,
                          border: pageCount === n ? '2px solid #f97316' : '1.5px solid #e7e5e4',
                          background: pageCount === n ? '#fff7ed' : '#fff',
                          color: pageCount === n ? '#f97316' : '#57534e',
                          fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13,
                          cursor: generating ? 'default' : 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label style={{ fontSize: 10, fontWeight: 800, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
                Complexity / age group
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {COMPLEXITIES.map(c => (
                  <div
                    key={c.id} onClick={() => !generating && setComplexity(c.id)}
                    style={{
                      padding: '11px 12px', borderRadius: 12,
                      border: complexity === c.id ? '2px solid #f97316' : '1.5px solid #e7e5e4',
                      background: complexity === c.id ? '#fff7ed' : '#fff',
                      cursor: generating ? 'default' : 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <p style={{ fontWeight: 800, fontSize: 13, color: complexity === c.id ? '#f97316' : '#1c1917', margin: 0 }}>{c.label}</p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#78716c', margin: '2px 0' }}>{c.age}</p>
                    <p style={{ fontSize: 10, color: '#a8a29e', margin: 0, lineHeight: 1.4 }}>{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px' }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#dc2626', margin: 0 }}>⚠️ {error}</p>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={generateBook}
              disabled={!canGenerate}
              style={{
                width: '100%', padding: '16px', borderRadius: 16, border: 'none',
                background: !canGenerate ? '#e7e5e4' : 'linear-gradient(135deg, #f97316, #fb923c)',
                color: !canGenerate ? '#a8a29e' : '#fff',
                fontFamily: "'Fredoka One', cursive", fontSize: 19, letterSpacing: '0.02em',
                cursor: !canGenerate ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: !canGenerate ? 'none' : '0 4px 18px rgba(249,115,22,0.3)',
                transition: 'all 0.2s',
              }}
            >
              {generating
                ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span> Generating your book...</>
                : done
                  ? <><span>🔄</span> Regenerate Book</>
                  : <><span>✨</span> Generate My Coloring Book</>
              }
            </button>

            {/* Progress + results */}
            {(generating || done) && (
              <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ fontFamily: "'Fredoka One', cursive", fontSize: 16, color: '#1c1917', margin: 0 }}>
                    {done
                      ? `🎉 ${childName ? childName + "'s" : 'Your'} ${selectedTheme.label} Coloring Book`
                      : '⚙️ Generating your book...'
                    }
                  </p>
                  {done && pdfBase64 && (
                    <button
                      onClick={downloadPDF}
                      style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      ⬇️ Download PDF
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{ height: 5, background: '#f0ede8', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #f97316, #fbbf24)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#78716c', margin: '0 0 14px' }}>{progressMsg}</p>

                {/* Page thumbnails grid */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(pageCount, 4)}, 1fr)`, gap: 8 }}>
                  {scenes.map((scene, i) => (
                    <PageThumbnail
                      key={i} index={i} scene={scene}
                      status={pageStatuses[i] || 'pending'}
                      b64={pageImages[i]}
                    />
                  ))}
                </div>

                {done && (
                  <div style={{ marginTop: 14, padding: '11px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>✅</span>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: 12, color: '#166534', margin: 0 }}>Ready to print!</p>
                      <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, margin: '2px 0 0' }}>
                        Print on 8.5×11" paper · Works on any home printer
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* How it works */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 18, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <p style={{ fontFamily: "'Fredoka One', cursive", fontSize: 16, color: '#1c1917', margin: '0 0 14px' }}>How it works</p>
              {[
                { icon: '📷', title: 'AI reads your photo', desc: 'GPT-4o Vision extracts hair, glasses, skin tone, clothing — creating a locked character descriptor used in every scene.' },
                { icon: '🎨', title: 'Every page is unique', desc: 'Up to 12 different adventures per theme. Your child is the hero in every single scene.' },
                { icon: '🖨️', title: 'Print at home instantly', desc: 'Download a crisp print-ready PDF. Works on any home printer with standard paper.' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 2 ? 12 : 0 }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 12, color: '#1c1917', margin: 0 }}>{item.title}</p>
                    <p style={{ fontSize: 11, color: '#78716c', margin: '2px 0 0', lineHeight: 1.5 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tips card */}
            <div style={{ background: 'linear-gradient(135deg, #fff7ed, #fef3e8)', borderRadius: 18, border: '1.5px solid #fed7aa', padding: 18 }}>
              <p style={{ fontFamily: "'Fredoka One', cursive", fontSize: 14, color: '#f97316', margin: '0 0 10px' }}>📸 Photo tips</p>
              {[
                'Front-facing, clear view of face',
                'Good lighting — avoid shadows',
                'Recent photo works best',
                'Solo photo (no other people)',
                'Glasses and accessories included',
              ].map((tip, i) => (
                <p key={i} style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 5px' }}>✓ {tip}</p>
              ))}
            </div>

            {/* Scene list */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0ede8', padding: 18, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <p style={{ fontFamily: "'Fredoka One', cursive", fontSize: 14, color: '#1c1917', margin: '0 0 10px' }}>
                {selectedTheme.emoji} Scenes in this book
              </p>
              {scenes.map((scene, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 900, color: '#fff',
                    background: selectedTheme.color, borderRadius: '50%',
                    width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                  }}>{i + 1}</span>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#57534e', margin: 0, lineHeight: 1.4 }}>
                    {scene.split(' ').slice(0, 8).join(' ')}...
                  </p>
                </div>
              ))}
            </div>

            {/* Timing note */}
            <div style={{ background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', padding: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#475569', margin: '0 0 5px' }}>⏱️ Generation time</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Approx. <strong>{pageCount * 12}–{pageCount * 18} seconds</strong> for {pageCount} pages.
                Each page is generated individually for best quality.
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
