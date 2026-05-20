import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { THEMES, COMPLEXITIES, PAGE_COUNTS } from '../lib/themes';

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
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error(text.slice(0, 200)); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function buildPDF(b64Image, childName, themeName) {
  if (!window.PDFLib) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const { PDFDocument, rgb } = window.PDFLib;
  const doc = await PDFDocument.create();

  // Page dimensions: US Letter 8.5x11 inches at 72 DPI
  const W = 612, H = 792;
  // Image fills the page with small margins
  const M = 30;
  const imgW = W - M * 2;
  const imgH = H - M * 2;

  // Single page — just the image, full page, no cover
  const page = doc.addPage([W, H]);

  // Light border around edge
  page.drawRectangle({
    x: M - 4, y: M - 4,
    width: imgW + 8, height: imgH + 8,
    borderColor: rgb(0.88, 0.88, 0.88),
    borderWidth: 1,
  });

  // Embed and draw image
  const bytes = Uint8Array.from(atob(b64Image), c => c.charCodeAt(0));
  const png = await doc.embedPng(bytes);
  page.drawImage(png, { x: M, y: M, width: imgW, height: imgH });

  const saved = await doc.save();
  let bin = '';
  const arr = new Uint8Array(saved);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

export default function Home() {
  const [photo, setPhoto] = useState(null);
  const [photoSmall, setPhotoSmall] = useState('');
  const [photoMed, setPhotoMed] = useState('');
  const [theme, setTheme] = useState('dinosaurs');
  const [pageCount, setPageCount] = useState(4);
  const [complexity, setComplexity] = useState('medium');
  const [childName, setChildName] = useState('');
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [descriptor, setDescriptor] = useState('');
  const [pageStatuses, setPageStatuses] = useState([]);
  const [pageImages, setPageImages] = useState([]);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [done, setDone] = useState(false);
  const [pdfBase64, setPdfBase64] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const selectedTheme = THEMES.find(t => t.id === theme);
  const selectedComplexity = COMPLEXITIES.find(c => c.id === complexity);
  const scenes = selectedTheme.scenes.slice(0, pageCount);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setPhoto(file);
    const [small, med] = await Promise.all([compressImage(file, 128, 0.75), compressImage(file, 256, 0.82)]);
    setPhotoSmall(small); setPhotoMed(med);
    setStep(s => Math.max(s, 2));
    setDone(false); setPdfBase64(''); setErrorMsg(''); setDescriptor('');
    setPageStatuses([]); setPageImages([]);
  }, []);

  const setPS = (i, s) => setPageStatuses(prev => { const n=[...prev]; n[i]=s; return n; });
  const setPI = (i, b) => setPageImages(prev => { const n=[...prev]; n[i]=b; return n; });

  const handleGenerate = async () => {
    setGenerating(true); setDone(false); setErrorMsg(''); setPdfBase64('');
    setStep(4);
    setPageStatuses(Array(pageCount).fill('pending'));
    setPageImages(Array(pageCount).fill(null));

    try {
      setProgress(5); setProgressMsg('Analyzing photo...');
      const { descriptor: desc } = await safePost('/api/analyze-photo', { imageBase64: photoSmall, mimeType: 'image/jpeg' });
      setDescriptor(desc);
      setProgress(20); setProgressMsg('Generating your personalized illustration...');

      // Generate ONLY page 1
      setPS(0, 'generating');
      const data = await safePost('/api/generate-page', {
        characterDescriptor: desc,
        scene: scenes[0],
        complexityModifier: selectedComplexity.promptModifier,
        childName,
        imageBase64: photoMed,
        mimeType: 'image/jpeg',
      });

      if (!data.b64) throw new Error('No image returned');

      setPI(0, data.b64);
      setPS(0, 'done');
      setProgress(80);

      // Instant blurred previews for remaining pages
      for (let i = 1; i < pageCount; i++) {
        await sleep(150);
        setPI(i, data.b64);
        setPS(i, 'placeholder');
        setProgress(80 + Math.round(i / pageCount * 10));
      }

      // Build PDF
      setProgressMsg('Building PDF...');
      setProgress(92);
      try {
        const pdf = await buildPDF(data.b64, childName, selectedTheme.label);
        setPdfBase64(pdf);
      } catch(pdfErr) {
        setErrorMsg('Image generated! PDF failed: ' + pdfErr.message + ' — use "Save Image" instead.');
      }

      setProgress(100);
      setProgressMsg('Done!');
      setDone(true);

    } catch(err) {
      setErrorMsg(err.message || 'Something went wrong');
      setProgress(0);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = () => {
    const bytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${(childName||'my').replace(/\s+/g,'_')}_${theme}_coloring.pdf`;
    a.click(); URL.revokeObjectURL(url);
  };

  const saveImage = () => {
    if (!pageImages[0]) return;
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${pageImages[0]}`;
    a.download = `${(childName||'my').replace(/\s+/g,'_')}_${theme}_page1.png`;
    a.click();
  };

  return (
    <>
      <Head><title>ColorBook — Personalized AI Coloring Books</title></Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap'); *{box-sizing:border-box;} body{font-family:'Nunito',sans-serif;background:linear-gradient(150deg,#fff9f5 0%,#fef3e8 50%,#f0fdf4 100%);min-height:100vh;} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(8px)',borderBottom:'1px solid #f0ede8',padding:'0 20px',position:'sticky',top:0,zIndex:50}}>
        <div style={{maxWidth:900,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:58}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:26}}>🎨</span>
            <span style={{fontFamily:"'Fredoka One',cursive",fontSize:22,color:'#f97316'}}>ColorBook</span>
            <span style={{background:'#fef3c7',color:'#92400e',fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:20,border:'1px solid #fde68a'}}>BETA</span>
          </div>
          <span style={{fontSize:12,color:'#78716c',fontWeight:700}}>AI-personalized coloring books ✨</span>
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'28px 20px 80px'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <h1 style={{fontFamily:"'Fredoka One',cursive",fontSize:36,color:'#1c1917',margin:'0 0 10px',lineHeight:1.15}}>
            Your child. Their adventure.<br/><span style={{color:'#f97316'}}>Ready to color. 🖍️</span>
          </h1>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:20,alignItems:'start'}}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>

            {/* Upload */}
            <div style={{background:'#fff',borderRadius:18,border:'1px solid #f0ede8',padding:22,boxShadow:'0 2px 10px rgba(0,0,0,0.04)'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:photo?'#22c55e':'#f97316',color:'#fff',fontWeight:900,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>{photo?'✓':'1'}</div>
                <span style={{fontWeight:800,fontSize:14,color:'#1c1917',textTransform:'uppercase',letterSpacing:'0.05em'}}>Upload child's photo</span>
              </div>
              {photo ? (
                <div style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',background:'#f0fdf4',border:'1.5px solid #bbf7d0',borderRadius:12}}>
                  <img src={URL.createObjectURL(photo)} alt="preview" style={{width:60,height:60,borderRadius:10,objectFit:'cover'}}/>
                  <div style={{flex:1}}>
                    <p style={{fontWeight:800,fontSize:14,color:'#1c1917',margin:0}}>{photo.name}</p>
                    {descriptor
                      ? <details style={{marginTop:4}}><summary style={{fontSize:11,color:'#15803d',fontWeight:700,cursor:'pointer'}}>✓ Character captured — tap to review</summary><p style={{fontSize:10,color:'#15803d',margin:'4px 0 0',fontStyle:'italic',lineHeight:1.5}}>{descriptor}</p></details>
                      : <p style={{fontSize:12,color:'#16a34a',fontWeight:600,margin:'3px 0 0'}}>✓ Photo ready</p>
                    }
                  </div>
                  <button onClick={()=>{setPhoto(null);setPhotoSmall('');setPhotoMed('');setStep(1);setDone(false);setDescriptor('');setPageStatuses([]);setPageImages([]);setErrorMsg('');}} style={{fontSize:12,fontWeight:700,color:'#ef4444',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'5px 12px',cursor:'pointer'}}>Remove</button>
                </div>
              ) : (
                <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}} onClick={()=>inputRef.current.click()} style={{border:`2px dashed ${dragging?'#f97316':'#d6d3d1'}`,borderRadius:14,padding:'32px 20px',textAlign:'center',cursor:'pointer',background:dragging?'#fff7ed':'#fafaf9',transition:'all 0.2s'}}>
                  <input ref={inputRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
                  <div style={{fontSize:36,marginBottom:8}}>📷</div>
                  <p style={{fontWeight:800,fontSize:15,color:'#1c1917',margin:0}}>Drop a photo or <span style={{color:'#f97316'}}>click to browse</span></p>
                  <p style={{fontSize:12,color:'#78716c',fontWeight:600,margin:'5px 0 0'}}>Clear front-facing photo works best</p>
                </div>
              )}
            </div>

            {/* Theme */}
            <div style={{background:'#fff',borderRadius:18,border:'1px solid #f0ede8',padding:22,boxShadow:'0 2px 10px rgba(0,0,0,0.04)',opacity:photo?1:0.4,transition:'opacity 0.3s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:'#e7e5e4',color:'#a8a29e',fontWeight:900,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>2</div>
                <span style={{fontWeight:800,fontSize:14,color:'#a8a29e',textTransform:'uppercase',letterSpacing:'0.05em'}}>Pick a theme</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                {THEMES.map(t=>(
                  <div key={t.id} onClick={()=>photo&&setTheme(t.id)} style={{border:theme===t.id?`2.5px solid ${t.color}`:'1.5px solid #e7e5e4',borderRadius:12,padding:'12px 8px',textAlign:'center',cursor:photo?'pointer':'default',background:theme===t.id?`${t.color}15`:'#fff',transform:theme===t.id?'scale(1.04)':'scale(1)',transition:'all 0.18s',position:'relative'}}>
                    {theme===t.id&&<div style={{position:'absolute',top:6,right:6,width:16,height:16,borderRadius:'50%',background:t.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff',fontWeight:900}}>✓</div>}
                    <div style={{fontSize:24,marginBottom:4}}>{t.emoji}</div>
                    <p style={{fontWeight:800,fontSize:12,color:'#1c1917',margin:0}}>{t.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Config */}
            <div style={{background:'#fff',borderRadius:18,border:'1px solid #f0ede8',padding:22,boxShadow:'0 2px 10px rgba(0,0,0,0.04)',opacity:photo?1:0.4,transition:'opacity 0.3s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:'#e7e5e4',color:'#a8a29e',fontWeight:900,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>3</div>
                <span style={{fontWeight:800,fontSize:14,color:'#a8a29e',textTransform:'uppercase',letterSpacing:'0.05em'}}>Customize</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                <div>
                  <label style={{fontSize:10,fontWeight:800,color:'#78716c',textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5}}>Child's name</label>
                  <input type="text" placeholder="e.g. Steven" value={childName} onChange={e=>setChildName(e.target.value)} style={{width:'100%',padding:'9px 13px',borderRadius:10,border:'1.5px solid #e7e5e4',fontFamily:'Nunito,sans-serif',fontSize:14,fontWeight:700,color:'#1c1917',outline:'none'}}/>
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:800,color:'#78716c',textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:5}}>Pages</label>
                  <div style={{display:'flex',gap:6}}>
                    {PAGE_COUNTS.map(n=>(
                      <button key={n} onClick={()=>setPageCount(n)} style={{flex:1,padding:'9px 0',borderRadius:10,border:pageCount===n?'2px solid #f97316':'1.5px solid #e7e5e4',background:pageCount===n?'#fff7ed':'#fff',color:pageCount===n?'#f97316':'#57534e',fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:13,cursor:'pointer'}}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {COMPLEXITIES.map(c=>(
                  <div key={c.id} onClick={()=>setComplexity(c.id)} style={{padding:'11px 12px',borderRadius:12,border:complexity===c.id?'2px solid #f97316':'1.5px solid #e7e5e4',background:complexity===c.id?'#fff7ed':'#fff',cursor:'pointer'}}>
                    <p style={{fontWeight:800,fontSize:13,color:complexity===c.id?'#f97316':'#1c1917',margin:0}}>{c.label}</p>
                    <p style={{fontSize:10,color:'#78716c',margin:'2px 0'}}>{c.age}</p>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleGenerate} disabled={!photo||generating} style={{width:'100%',padding:'16px',borderRadius:16,border:'none',background:!photo||generating?'#e7e5e4':'linear-gradient(135deg,#f97316,#fb923c)',color:!photo||generating?'#a8a29e':'#fff',fontFamily:"'Fredoka One',cursive",fontSize:19,cursor:!photo||generating?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:!photo?'none':'0 4px 18px rgba(249,115,22,0.3)'}}>
              {generating?<><span style={{animation:'spin 1s linear infinite',display:'inline-block'}}>⚙️</span> Generating...</>:done?<><span>🔄</span> Regenerate</>:<><span>✨</span> Generate My Coloring Book</>}
            </button>

            {(generating||done||pageImages.some(Boolean)) && (
              <div style={{background:'#fff',borderRadius:18,border:'1px solid #f0ede8',padding:22,boxShadow:'0 2px 10px rgba(0,0,0,0.04)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <p style={{fontFamily:"'Fredoka One',cursive",fontSize:16,color:'#1c1917',margin:0}}>
                    {done?`🎉 ${childName?childName+"'s":'Your'} ${selectedTheme.label} Book`:'⚙️ Generating...'}
                  </p>
                  <div style={{display:'flex',gap:8}}>
                    {pageImages[0]&&<button onClick={saveImage} style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:10,padding:'8px 14px',fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:12,cursor:'pointer'}}>💾 Save PNG</button>}
                    {pdfBase64&&<button onClick={downloadPDF} style={{background:'#f97316',color:'#fff',border:'none',borderRadius:10,padding:'8px 14px',fontFamily:'Nunito,sans-serif',fontWeight:800,fontSize:12,cursor:'pointer'}}>⬇️ PDF</button>}
                  </div>
                </div>

                <div style={{height:5,background:'#f0ede8',borderRadius:3,overflow:'hidden',marginBottom:6}}>
                  <div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,#f97316,#fbbf24)',borderRadius:3,transition:'width 0.5s ease'}}/>
                </div>
                <p style={{fontSize:11,fontWeight:600,color:'#78716c',margin:'0 0 14px'}}>{progressMsg}</p>

                <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(pageCount,4)},1fr)`,gap:8}}>
                  {scenes.map((scene,i)=>(
                    <div key={i} style={{aspectRatio:'1',border:`2px solid ${pageStatuses[i]==='done'?'#22c55e':pageStatuses[i]==='placeholder'?'#f97316':pageStatuses[i]==='generating'?'#f97316':'#e7e5e4'}`,borderRadius:10,overflow:'hidden',position:'relative',background:'#fafaf9'}}>
                      {pageImages[i]?(
                        <>
                          <img src={`data:image/png;base64,${pageImages[i]}`} alt={`Page ${i+1}`} style={{width:'100%',height:'100%',objectFit:'cover',filter:pageStatuses[i]==='placeholder'?'blur(6px) brightness(1.05)':'none'}}/>
                          {pageStatuses[i]==='placeholder'&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{background:'rgba(249,115,22,0.9)',color:'#fff',fontSize:9,fontWeight:800,padding:'3px 7px',borderRadius:6}}>PREVIEW</span></div>}
                          {pageStatuses[i]==='done'&&<div style={{position:'absolute',top:5,left:5,background:'#22c55e',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:4}}>✓</div>}
                        </>
                      ):(
                        <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:8}}>
                          <div style={{fontSize:18,animation:pageStatuses[i]==='generating'?'spin 1.2s linear infinite':'none'}}>{pageStatuses[i]==='generating'?'⚙️':'🖼️'}</div>
                          <p style={{fontSize:9,color:'#a8a29e',textAlign:'center',margin:'4px 0 0'}}>{scene.slice(0,30)}...</p>
                        </div>
                      )}
                      <div style={{position:'absolute',bottom:4,right:5,background:'rgba(0,0,0,0.5)',color:'#fff',fontSize:8,fontWeight:700,padding:'2px 5px',borderRadius:4}}>{i+1}</div>
                    </div>
                  ))}
                </div>

                {errorMsg&&<div style={{marginTop:12,padding:'10px 14px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10}}><p style={{fontWeight:700,fontSize:12,color:'#dc2626',margin:0}}>⚠️ {errorMsg}</p></div>}

                {done&&pdfBase64&&(
                  <div style={{marginTop:12,padding:'11px 14px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12}}>
                    <p style={{fontWeight:800,fontSize:12,color:'#166534',margin:0}}>✅ Page 1 is your personalized illustration. Pages 2–{pageCount} are previews. Hit Regenerate to create more unique pages.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:'#fff',borderRadius:18,border:'1px solid #f0ede8',padding:18,boxShadow:'0 2px 10px rgba(0,0,0,0.04)'}}>
              <p style={{fontFamily:"'Fredoka One',cursive",fontSize:15,color:'#1c1917',margin:'0 0 12px'}}>How it works</p>
              {[{icon:'📷',t:'AI reads your photo',d:'GPT-4o Vision captures hair, face, glasses and features.'},{icon:'🎨',t:'Personalized scene',d:'Your child is the hero with their actual appearance.'},{icon:'🖨️',t:'Print at home',d:'Download PDF or save as PNG.'}].map((it,i)=>(
                <div key={i} style={{display:'flex',gap:10,marginBottom:i<2?12:0}}>
                  <span style={{fontSize:20,flexShrink:0,marginTop:2}}>{it.icon}</span>
                  <div><p style={{fontWeight:800,fontSize:12,color:'#1c1917',margin:0}}>{it.t}</p><p style={{fontSize:11,color:'#78716c',margin:'2px 0 0',lineHeight:1.5}}>{it.d}</p></div>
                </div>
              ))}
            </div>
            <div style={{background:'linear-gradient(135deg,#fff7ed,#fef3e8)',borderRadius:18,border:'1.5px solid #fed7aa',padding:18}}>
              <p style={{fontFamily:"'Fredoka One',cursive",fontSize:14,color:'#f97316',margin:'0 0 10px'}}>📸 Photo tips</p>
              {['Front-facing, clear face','Good lighting, no shadows','Solo photo only','Glasses & accessories show','Recent photo is best'].map((tip,i)=>(
                <p key={i} style={{fontSize:11,fontWeight:700,color:'#92400e',margin:'0 0 5px'}}>✓ {tip}</p>
              ))}
            </div>
            <div style={{background:'#fff',borderRadius:18,border:'1px solid #f0ede8',padding:18,boxShadow:'0 2px 10px rgba(0,0,0,0.04)'}}>
              <p style={{fontFamily:"'Fredoka One',cursive",fontSize:14,color:'#1c1917',margin:'0 0 10px'}}>{selectedTheme.emoji} Scenes</p>
              {scenes.map((scene,i)=>(
                <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:6}}>
                  <span style={{fontSize:9,fontWeight:900,color:'#fff',background:selectedTheme.color,borderRadius:'50%',width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{i+1}</span>
                  <p style={{fontSize:11,fontWeight:600,color:'#57534e',margin:0,lineHeight:1.4}}>{scene.split(' ').slice(0,7).join(' ')}...</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
