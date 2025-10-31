// SOLDOWN clean UI logic

// DOM
const videoUrlInput = document.getElementById('video-url');
const analyzeBtn = document.getElementById('analyze-btn');
const pasteBtn = document.getElementById('paste-btn');
const clearBtn = document.getElementById('clear-btn');
const mp4Btn = document.getElementById('mp4-btn');
const mp3Btn = document.getElementById('mp3-btn');
const resultsSection = document.getElementById('results-section');
const formatsGrid = document.getElementById('formats-grid');
const downloadBtn = document.getElementById('download-btn');
const statusMessage = document.getElementById('status-message');
const themeToggle = document.getElementById('theme-toggle');
const previewCard = document.getElementById('preview-card');
const previewThumb = document.getElementById('preview-thumb');
const previewTitle = document.getElementById('preview-title');
const previewDuration = document.getElementById('preview-duration');
const previewPlatform = document.getElementById('preview-platform');
const qualityFilterEl = document.getElementById('quality-filter');
const sortByEl = document.getElementById('sort-by');
const toastContainer = document.getElementById('toast-container');
const recentList = document.getElementById('recent-list');
// Bulk DOM
// Accent DOM
const accentButtons = document.querySelectorAll('.accent-dot');
const bulkInput = document.getElementById('bulk-input');
const bulkAddBtn = document.getElementById('bulk-add');
const bulkClearBtn = document.getElementById('bulk-clear');
const bulkPasteBtn = document.getElementById('bulk-paste');
const bulkList = document.getElementById('bulk-list');
const bulkTypeEl = document.getElementById('bulk-type');
const bulkQualityEl = document.getElementById('bulk-quality');
const bulkDownloadBtn = document.getElementById('bulk-download');
const bulkProgress = document.getElementById('bulk-progress');
const bulkExportBtn = document.getElementById('bulk-export');
const bulkImportBtn = document.getElementById('bulk-import');
const bulkImportFile = document.getElementById('bulk-import-file');

// State
let currentFormatType = 'mp4';
let availableFormats = [];
let selectedFormat = null;
let analyzedUrl = '';
let bulkLinks = [];

// Events
if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeVideo);
if (mp4Btn) mp4Btn.addEventListener('click', () => switchFormatType('mp4'));
if (mp3Btn) mp3Btn.addEventListener('click', () => switchFormatType('mp3'));
if (downloadBtn) downloadBtn.addEventListener('click', downloadVideo);
if (videoUrlInput) {
  videoUrlInput.addEventListener('keydown', e => { if (e.key === 'Enter') analyzeVideo(); });
  videoUrlInput.addEventListener('input', quickPreviewFromInput);
}
if (pasteBtn) pasteBtn.addEventListener('click', pasteFromClipboard);
if (clearBtn) clearBtn.addEventListener('click', () => {
  if (videoUrlInput){ videoUrlInput.value=''; videoUrlInput.focus(); }
  if (previewCard){ previewCard.style.display = 'none'; }
});
if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
if (qualityFilterEl) qualityFilterEl.addEventListener('change', renderFormats);
if (sortByEl) sortByEl.addEventListener('change', renderFormats);
document.addEventListener('keydown', globalShortcuts);
if (bulkAddBtn) bulkAddBtn.addEventListener('click', () => addBulk(bulkInput?.value || ''));
if (bulkPasteBtn) bulkPasteBtn.addEventListener('click', pasteBulk);
if (bulkClearBtn) bulkClearBtn.addEventListener('click', clearBulk);
if (bulkDownloadBtn) bulkDownloadBtn.addEventListener('click', startBulkDownload);
if (bulkExportBtn) bulkExportBtn.addEventListener('click', exportBulk);
if (bulkImportBtn) bulkImportBtn.addEventListener('click', () => bulkImportFile?.click());
if (bulkImportFile) bulkImportFile.addEventListener('change', importBulk);

function isValidYouTubeUrl(url){
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function updateStatus(message, type = ''){
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  if (type) statusMessage.classList.add(type);
}

async function analyzeVideo(){
  const url = (videoUrlInput?.value || '').trim();
  if (!url) { updateStatus('Please enter a YouTube URL', 'error'); return; }
  if (!isValidYouTubeUrl(url)) { updateStatus('Please enter a valid YouTube URL', 'error'); return; }

  updateStatus('Analyzing video...', 'processing');
  selectedFormat = null;
  if (downloadBtn) downloadBtn.disabled = true;

  try {
    setAnalyzing(true);
    const resp = await fetch('/api/analyze', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ url }) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Analyze failed');

    availableFormats = data.formats || [];
    analyzedUrl = url;
    renderPreview(data, url);
    renderFormats();
    updateStatus('Analysis complete. Select a format to download.', 'success');
    toast('Analysis complete', 'success');
  } catch (e){
    updateStatus('Error analyzing: ' + e.message, 'error');
    toast(e.message, 'error');
  } finally { setAnalyzing(false); }
}

function switchFormatType(type){
  currentFormatType = type;
  if (mp4Btn) mp4Btn.classList.toggle('active', type==='mp4');
  if (mp3Btn) mp3Btn.classList.toggle('active', type==='mp3');
  renderFormats();
  selectedFormat = null;
  if (downloadBtn) downloadBtn.disabled = true;
}

function renderFormats(){
  if (!formatsGrid) return;
  formatsGrid.innerHTML = '';
  let filtered = availableFormats.filter(f => currentFormatType==='mp4' ? f.format === 'MP4' : f.format === 'MP3' || f.type === 'audio');
  const minQ = parseInt(qualityFilterEl?.value || '');
  if (!isNaN(minQ)) {
    filtered = filtered.filter(f => parseQualityToNumber(f.quality) >= minQ);
  }
  const sortBy = (sortByEl?.value) || 'quality_desc';
  filtered.sort((a,b) => sortFormats(a,b,sortBy));
  if (!filtered.length){
    formatsGrid.innerHTML = '<p>No formats available for this video.</p>';
    if (resultsSection) resultsSection.style.display = 'block';
    return;
  }
  filtered.forEach(f => {
    const card = document.createElement('div');
    card.className = 'format-card';
    card.innerHTML = `<div class="format-name">${f.quality || f.format || ''}</div><div class="format-details"><span class="chip">${f.codec || ''}</span><span>${f.size || ''}</span></div>`;
    card.addEventListener('click', () => selectFormat(f, card));
    formatsGrid.appendChild(card);
  });
  if (resultsSection) resultsSection.style.display = 'block';
}

function selectFormat(format, card){
  document.querySelectorAll('.format-card').forEach(el => el.classList.remove('selected'));
  card.classList.add('selected');
  selectedFormat = format;
  if (downloadBtn) downloadBtn.disabled = false;
  updateStatus(`Selected: ${format.quality || format.format} ${format.size ? ' - ' + format.size : ''}`, 'success');
  toast(`Selected ${format.quality || format.format}`, 'info');
}

function downloadVideo(){
  if (!selectedFormat){ updateStatus('Please select a format first', 'error'); return; }
  if (!analyzedUrl){ updateStatus('Analyze a URL first', 'error'); return; }
  updateStatus('Preparing download...', 'processing');
  if (downloadBtn) downloadBtn.disabled = true;
  const formatType = currentFormatType === 'mp3' ? 'mp3' : 'mp4';
  const body = {
    url: analyzedUrl,
    format: selectedFormat.format,
    quality: selectedFormat.quality,
    itag: selectedFormat.itag,
    formatType
  };
  fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(async (resp) => {
    if (!resp.ok) {
      const problem = await safeJson(resp);
      throw new Error(problem.error || 'Download failed');
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = extractFilename(resp.headers.get('Content-Disposition')) ||
      `soldown-${Date.now()}.${formatType}`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    updateStatus(`Download started: ${selectedFormat.quality || selectedFormat.format}`, 'success');
    saveRecent({ title: previewTitle?.textContent || 'Video', format: formatType.toUpperCase(), quality: selectedFormat.quality || '', ts: Date.now() });
    renderRecent();
    toast('Download started', 'success');
  }).catch((e) => {
    updateStatus('Error: ' + e.message, 'error');
    toast(e.message, 'error');
  }).finally(() => {
    if (downloadBtn) downloadBtn.disabled = false;
  });
}

function setAnalyzing(isLoading){
  if (!analyzeBtn) return;
  analyzeBtn.disabled = !!isLoading;
  if (isLoading) analyzeBtn.innerHTML = '<span class="loading"></span>'; else analyzeBtn.textContent = 'Analyze';
}

async function pasteFromClipboard(){
  try {
    const text = await navigator.clipboard.readText();
    if (videoUrlInput) {
      videoUrlInput.value = text || '';
      videoUrlInput.focus();
    }
  } catch(_e) {
    updateStatus('Clipboard not available. Paste with Ctrl+V.', 'error');
  }
}

// Init
updateStatus('Ready to download');
initTheme();
renderRecent();
initBulk();
initSplashAndTransitions();
initScrollAppear();
initRipples();
initAccent();

function extractFilename(contentDisposition){
  if (!contentDisposition) return '';
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match ? match[1] : '';
}

async function safeJson(resp){
  try { return await resp.json(); } catch(_e) { return {}; }
}

function initAccent(){
  accentButtons.forEach(btn => {
    btn.addEventListener('click', () => setAccent(btn.getAttribute('data-accent')));
  });
  const saved = localStorage.getItem('soldown_accent');
  if (saved) setAccent(saved, true);
}

function setAccent(name, skipSave){
  document.body.classList.remove('accent-red','accent-blue','accent-violet','accent-emerald');
  const cls = `accent-${name}`;
  document.body.classList.add(cls);
  if (!skipSave) localStorage.setItem('soldown_accent', name);
}

function initScrollAppear(){
  const targets = document.querySelectorAll('.main-card, .format-card, .recent-item, .bulk-item');
  if (!('IntersectionObserver' in window)) { targets.forEach(t=>t.classList.add('appears')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add('appears'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
  targets.forEach(t => io.observe(t));
}

function initRipples(){
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn, .download-btn, .format-btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.left = (e.clientX - rect.left) + 'px';
    span.style.top = (e.clientY - rect.top) + 'px';
    btn.appendChild(span);
    setTimeout(()=> span.remove(), 650);
  });
}

function renderPreview(data, url){
  if (!previewCard) return;
  const title = data.title || 'Video';
  const duration = data.duration ? formatDuration(data.duration) : '';
  const platform = (data.platform || '').toString();
  previewTitle.textContent = title;
  previewDuration.textContent = duration;
  previewPlatform.textContent = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Unknown';
  const ytId = extractYouTubeId(url);
  if (ytId) {
    previewThumb.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  } else {
    previewThumb.removeAttribute('src');
  }
  previewCard.style.display = 'grid';
}

function quickPreviewFromInput(){
  if (!previewCard) return;
  const url = (videoUrlInput?.value || '').trim();
  if (!url) { previewCard.style.display = 'none'; return; }
  const ytId = extractYouTubeId(url);
  if (ytId){
    previewTitle.textContent = 'Preview';
    previewDuration.textContent = '';
    previewPlatform.textContent = 'YouTube';
    previewThumb.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    previewCard.style.display = 'grid';
  }
}

function extractYouTubeId(url){
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch(_e) {}
  return '';
}

function formatDuration(sec){
  const s = Math.max(0, parseInt(sec, 10) || 0);
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const ss = s%60;
  return (h? h+':':'') + (h? String(m).padStart(2,'0'):m) + ':' + String(ss).padStart(2,'0');
}

function parseQualityToNumber(q){
  if (!q) return 0;
  const match = /([0-9]{3,4})p/i.exec(q);
  return match ? parseInt(match[1],10) : 0;
}

function parseSizeToNumberMB(size){
  if (!size || size === 'N/A') return 0;
  const m = /([0-9.]+)\s*(GB|MB|KB)/i.exec(size);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === 'GB') return n * 1024;
  if (unit === 'MB') return n;
  if (unit === 'KB') return n / 1024;
  return 0;
}

function sortFormats(a,b,mode){
  if (mode === 'size_desc') return parseSizeToNumberMB(b.size) - parseSizeToNumberMB(a.size);
  if (mode === 'size_asc') return parseSizeToNumberMB(a.size) - parseSizeToNumberMB(b.size);
  return parseQualityToNumber(b.quality) - parseQualityToNumber(a.quality);
}

function toggleTheme(){
  document.body.classList.add('theme-anim');
  const next = document.body.classList.toggle('light');
  localStorage.setItem('soldown_theme', next ? 'light' : 'dark');
  setTimeout(() => document.body.classList.remove('theme-anim'), 350);
}

function initSplashAndTransitions(){
  // Page enter animation
  document.body.classList.add('page-enter');
  setTimeout(() => document.body.classList.remove('page-enter'), 260);

  // Splash auto-hide: CSS anim already hides; remove node after delay
  const splash = document.getElementById('splash');
  if (splash){
    const seen = localStorage.getItem('soldown_seenSplash') === '1';
    if (seen){
      splash.remove();
    } else {
      setTimeout(() => { splash.style.display = 'none'; splash.remove(); localStorage.setItem('soldown_seenSplash','1'); }, 1300);
    }
  }

  // Intercept same-origin nav links for fade-out
  const links = document.querySelectorAll('a.nav-link');
  links.forEach(a => {
    a.addEventListener('click', (e) => {
      const url = new URL(a.href, location.href);
      if (url.origin === location.origin){
        e.preventDefault();
        document.body.classList.add('page-exit');
        // Clear any toasts to avoid stray text during transition
        if (toastContainer) toastContainer.innerHTML = '';
        setTimeout(() => { location.href = a.href; }, 200);
      }
    });
  });
}

function initTheme(){
  const saved = localStorage.getItem('soldown_theme');
  if (saved === 'light') document.body.classList.add('light');
}

function toast(message, type='info'){
  if (!toastContainer) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => { el.remove(); }, 3000);
}

function saveRecent(item){
  const key = 'soldown_recent';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.unshift(item);
  const trimmed = list.slice(0,10);
  localStorage.setItem(key, JSON.stringify(trimmed));
}

function renderRecent(){
  if (!recentList) return;
  const key = 'soldown_recent';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  if (!list.length) { recentList.innerHTML = '<p class="recent-meta">No downloads yet.</p>'; return; }
  recentList.innerHTML = '';
  list.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'recent-item';
    const d = new Date(item.ts);
    div.innerHTML = `<div class=\"recent-title\">${item.title}</div><div class=\"recent-meta\">${item.format}${item.quality? ' · '+item.quality : ''} · ${d.toLocaleString()}</div>`;
    const del = document.createElement('button');
    del.className = 'remove';
    del.textContent = 'Delete';
    del.addEventListener('click', () => deleteRecent(idx));
    div.appendChild(del);
    recentList.appendChild(div);
  });
}

function deleteRecent(index){
  const key = 'soldown_recent';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  if (index >=0 && index < list.length){
    list.splice(index,1);
    localStorage.setItem(key, JSON.stringify(list));
    renderRecent();
  }
}

function globalShortcuts(e){
  if (e.ctrlKey && e.key.toLowerCase() === 'l'){ e.preventDefault(); videoUrlInput?.focus(); }
  if (e.key === '1'){ switchFormatType('mp4'); }
  if (e.key === '2'){ switchFormatType('mp3'); }
  if (e.key.toLowerCase() === 'd'){ if (!downloadBtn?.disabled) downloadVideo(); }
}

// =============== BULK DOWNLOADER ===============
function initBulk(){
  const saved = JSON.parse(localStorage.getItem('soldown_bulk') || '[]');
  bulkLinks = Array.isArray(saved) ? saved : [];
  renderBulkList();
}

function persistBulk(){
  localStorage.setItem('soldown_bulk', JSON.stringify(bulkLinks));
  if (bulkDownloadBtn) bulkDownloadBtn.disabled = bulkLinks.length === 0;
}

function addBulk(text){
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let added = 0;
  for (const ln of lines){
    if (isValidYouTubeUrl(ln) && !bulkLinks.includes(ln)) { bulkLinks.push(ln); added++; }
  }
  if (bulkInput) bulkInput.value = '';
  if (added>0){ toast(`Added ${added} link(s)`, 'success'); renderBulkList(); persistBulk(); }
}

async function pasteBulk(){
  try {
    const text = await navigator.clipboard.readText();
    addBulk(text || '');
  } catch(_e) { toast('Clipboard not available', 'error'); }
}

function clearBulk(){
  bulkLinks = [];
  renderBulkList();
  persistBulk();
}

function removeBulk(url){
  bulkLinks = bulkLinks.filter(u => u !== url);
  renderBulkList();
  persistBulk();
}

function renderBulkList(){
  if (!bulkList) return;
  if (bulkLinks.length === 0){ bulkList.innerHTML = '<p class="recent-meta">No links added yet.</p>'; if (bulkDownloadBtn) bulkDownloadBtn.disabled = true; return; }
  bulkList.innerHTML = '';
  bulkLinks.forEach(u => {
    const row = document.createElement('div');
    row.className = 'bulk-item appears';
    const ytId = extractYouTubeId(u);
    const thumb = ytId ? `<img class=\"bulk-thumb\" src=\"https://img.youtube.com/vi/${ytId}/mqdefault.jpg\" alt=\"thumb\">` : '';
    row.innerHTML = `${thumb}<span class=\"url\">${u}</span>`;
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeBulk(u));
    row.appendChild(remove);
    bulkList.appendChild(row);
    // Try enrich with title
    analyzeForBulk(u).then(meta => {
      if (meta && meta.title){
        const t = document.createElement('div');
        t.className = 'recent-meta';
        t.textContent = meta.title;
        row.insertBefore(t, remove);
      }
    }).catch(()=>{});
  });
  if (bulkDownloadBtn) bulkDownloadBtn.disabled = false;
}

async function startBulkDownload(){
  if (!bulkLinks.length) return;
  const type = (bulkTypeEl?.value || 'mp4').toLowerCase();
  const prefQ = parseInt(bulkQualityEl?.value || '1080', 10);
  if (bulkProgress) bulkProgress.textContent = `Preparing bulk download of ${bulkLinks.length} video(s)...`;

  try {
    const first = bulkLinks[0];
    const info = await analyzeForBulk(first);
    const candidates = (info.formats || []).filter(f => type==='mp3' ? (f.format==='MP3' || f.type==='audio') : f.format==='MP4');
    if (!candidates.length) throw new Error('No formats available to base selection on');
    const target = pickBestByQuality(candidates, prefQ);
    const itag = target.itag;

    let done = 0;
    for (const u of bulkLinks){
      try {
        await downloadOne(u, type, itag, prefQ);
        done++;
        if (bulkProgress){
          const pct = Math.round(done / bulkLinks.length * 100);
          const fill = bulkProgress.querySelector('.progress-fill');
          const text = bulkProgress.querySelector('.progress-text');
          if (fill) fill.style.width = pct + '%';
          if (text) text.textContent = `Downloading... (${done}/${bulkLinks.length})`;
        }
      } catch(err){
        toast(`Failed: ${u.substring(0,42)}...`, 'error');
      }
    }
    toast('Bulk downloads complete', 'success');
  } catch(e){
    toast(e.message || 'Bulk failed', 'error');
  }
}

function exportBulk(){
  const data = bulkLinks.join('\n');
  const blob = new Blob([data], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'soldown-links.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function importBulk(e){
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { addBulk(String(reader.result || '')); };
  reader.readAsText(file);
  e.target.value = '';
}

async function analyzeForBulk(url){
  const resp = await fetch('/api/analyze', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ url }) });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Analyze failed');
  return data;
}

function pickBestByQuality(list, pref){
  let best = list[0];
  let bestDelta = Math.abs(parseQualityToNumber(best.quality) - pref);
  for (const f of list){
    const d = Math.abs(parseQualityToNumber(f.quality) - pref);
    if (d < bestDelta){ best = f; bestDelta = d; }
  }
  return best;
}

async function downloadOne(url, type, itag, prefQ){
  const body = { url, itag, formatType: type, format: type.toUpperCase(), quality: `${prefQ}p` };
  const resp = await fetch('/api/download', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!resp.ok){ const p = await safeJson(resp); throw new Error(p.error || 'Download failed'); }
  const blob = await resp.blob();
  const obj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = extractFilename(resp.headers.get('Content-Disposition')) || `soldown-${Date.now()}.${type}`;
  a.href = obj; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(obj);
  saveRecent({ title: 'Bulk item', format: type.toUpperCase(), quality: `${prefQ}p`, ts: Date.now() });
}


