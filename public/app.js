// ========================================
// SOLDOWN - Frontend Application Logic
// ========================================

// State Management
let currentFormats = [];
let selectedFormat = null;
let currentFormatType = 'mp4'; // 'mp4' or 'mp3'

// DOM Elements
const splashScreen = document.getElementById('splash-screen');
const mainApp = document.getElementById('main-app');
// -------------- TAPE RECORDER UI REFS --------------
const urlInput = document.getElementById('video-url');
const insertBtn = document.getElementById('insert-btn');
const diskArea = document.getElementById('disk-area');
const statusMessage = document.getElementById('main-status');
const loadingAnimation = document.getElementById('loading-animation');
const backBtn = document.getElementById('back-btn');
const nextBtn = document.getElementById('next-btn');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const mp4Btn = document.getElementById('mp4-btn');
const mp3Btn = document.getElementById('mp3-btn');
const ledPlay = document.getElementById('led-play');
const ledStop = document.getElementById('led-stop');
const ledSpin = document.getElementById('led-spin');
const ledRec = document.getElementById('led-rec');
const tapeWindow = document.querySelector('.tape-window');
const leftReel = document.querySelector('.left-reel');
const rightReel = document.querySelector('.right-reel');
const tapeFace = document.getElementById('tape-face');
const tuningDial = document.querySelector('.tuning-dial');
const soundToggleBtn = document.getElementById('sound-toggle');
// Get EJECT button
const ejectBtn = document.getElementById('eject-btn');

// Dust glint flare logic:
const dustGlint = document.querySelector('.dust-glint');
function showDustGlint(x) {
    if (!dustGlint) return;
    dustGlint.classList.add('active');
    dustGlint.style.background = `linear-gradient(113deg, transparent ${(x-30)/window.innerWidth*100}%, #fff8 87%, #ffdaa024 92%, transparent 98%)`;
    setTimeout(() => {
        if (dustGlint) dustGlint.classList.remove('active');
    }, 230)
}
document.addEventListener('mousemove', (e) => {
    showDustGlint(e.clientX);
});
document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0])
        showDustGlint(e.touches[0].clientX);
});

// Knob drag interactivity for tuning-dial
if (tuningDial) {
    let dragging = false, baseDeg = 0;
    let clickAudio = null;
    function playKnobClick() {
        if (!clickAudio) {
            clickAudio = new Audio('/sounds/knob_click.mp3');
            clickAudio.volume = 0.33;
        }
        if (!tapeSounds.insert.muted) clickAudio.play();
    }
    tuningDial.addEventListener('mousedown', (e) => {
        dragging = true; playKnobClick();
        tuningDial.classList.add('rotating');
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const min = -45, max = 45; // deg
        let pct = Math.min(Math.max((e.clientX / window.innerWidth - 0.5) * 2, -1), 1);
        let deg = Math.round(pct * 45);
        tuningDial.style.transform = `rotate(${deg}deg)`;
        if (deg > 25) tuningDial.classList.add('power-on');
        else tuningDial.classList.remove('power-on');
        baseDeg = deg;
    });
    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        playKnobClick();
        dragging = false;
        document.body.style.userSelect = '';
        tuningDial.classList.remove('rotating');
        tuningDial.style.transform = `rotate(${baseDeg}deg)`;
    });
    tuningDial.addEventListener('mouseleave', () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.userSelect = '';
        tuningDial.classList.remove('rotating');
        tuningDial.style.transform = `rotate(0deg)`;
    });
}

// Cassette label editing
const tapeLabels = {};
function tapeId() {
    // crude unique ID, use URL for now
    if (formats[0] && formats[0].url) return formats[0].url.split('//').pop().split('/').join('').split('?')[0].slice(0,25);
    return 'notape';
}
function installTapeLabelEditable() {
    if (!tapeFace) return;
    const curId = tapeId();
    const curLbl = tapeLabels[curId] || '';
    // Find .tape-format in tapeFace and wrap with .tape-editable-label if not already
    const labelDiv = tapeFace.querySelector('.tape-format');
    if (!labelDiv) return;
    let wrap = labelDiv.querySelector('.tape-editable-label');
    if (!wrap) {
        wrap = document.createElement('span');
        wrap.className = 'tape-editable-label';
        wrap.tabIndex = 0;
        wrap.textContent = curLbl || labelDiv.textContent.trim() || 'Untitled';
        labelDiv.textContent = '';
        labelDiv.appendChild(wrap);
        wrap.addEventListener('click', enableEdit);
        wrap.addEventListener('keydown', (e) => { if (e.key=='Enter'){ enableEdit(e); } });
    }
    function enableEdit(e) {
        e.preventDefault();
        wrap.classList.add('editing');
        const input = document.createElement('input');
        input.value = wrap.textContent;
        wrap.textContent = '';
        wrap.appendChild(input);
        input.focus(); input.setSelectionRange(0, input.value.length);
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', function(ev){
            if (ev.key=='Enter'){
                saveEdit(ev);
            }
        });
    }
    function saveEdit(e) {
        const val = wrap.querySelector('input')?.value?.substring(0,42) || '';
        tapeLabels[curId] = val || 'Untitled';
        wrap.classList.remove('editing');
        wrap.textContent = tapeLabels[curId];
        wrap.tabIndex = 0;
    }
}
// augment updateTapeFace to always call installTapeLabelEditable
const _origUTF = updateTapeFace;
updateTapeFace = function(format){
    _origUTF.call(this, format);
    installTapeLabelEditable();
};


// Tape recorder state
let formats = [];
let currentIndex = 0;
let spinning = false;
let spinTimer = null;
let isPlaying = false;
// queue of tapes: { url, formats }
let tapesQueue = [];
let currentTape = -1;
let tapeSounds = {
    insert: new Audio('/sounds/tape_insert.mp3'),
    play: new Audio('/sounds/tape_play.mp3'),
    stop: new Audio('/sounds/tape_stop.mp3'),
    rewind: new Audio('/sounds/tape_rewind.mp3'),
    fastForward: new Audio('/sounds/tape_fast_forward.mp3')
};

// Initialize tape sounds with default volume
Object.values(tapeSounds).forEach(sound => {
    sound.volume = 0.5;
    // Create silent versions to preload
    sound.muted = true;
    sound.play().catch(() => {});
    sound.muted = false;
});

function setLED(which) {
  ledPlay.classList.remove('active');
  ledStop.classList.remove('active');
  ledSpin.classList.remove('active');
  if (which === 'play') ledPlay.classList.add('active');
  if (which === 'stop') ledStop.classList.add('active');
  if (which === 'spin') ledSpin.classList.add('active');
}

function resetLED(){ 
    ledPlay.classList.remove('active'); 
    ledStop.classList.remove('active'); 
    ledSpin.classList.remove('active'); 
}

 function updateStatus(msg) {
    statusMessage.textContent = msg;
    // brief CRT glow flicker to simulate VFD
    statusMessage.classList.add('crt-glow');
    setTimeout(()=>statusMessage.classList.remove('crt-glow'), 300);
 }

function showLoading(show = true) {
    if (loadingAnimation) {
        if (show) {
            loadingAnimation.classList.remove('hidden');
            tapeWindow.classList.add('processing');
        } else {
            loadingAnimation.classList.add('hidden');
            tapeWindow.classList.remove('processing');
        }
    }
}

function updateToggleBtns() {
    mp4Btn.classList.toggle('active', currentFormatType==='mp4');
    mp3Btn.classList.toggle('active', currentFormatType==='mp3');
}

function playTapeSound(soundType) {
    // Stop any currently playing sounds
    Object.values(tapeSounds).forEach(sound => {
        sound.pause();
        sound.currentTime = 0;
    });
    
    // Play the requested sound
    if (tapeSounds[soundType]) {
        tapeSounds[soundType].play().catch(err => console.log('Audio playback error:', err));
    }
}

function startTapeAnimation() {
    tapeWindow.classList.add('spinning');
    spinning = true;
    setLED('spin');
}

function stopTapeAnimation() {
    // apply mechanical slowing then bounce stop
    if (tapeWindow.classList.contains('spinning')) {
        tapeWindow.classList.add('slowing');
        setTimeout(()=>{
            tapeWindow.classList.remove('spinning');
            tapeWindow.classList.remove('slowing');
            tapeWindow.classList.add('inertia-stop');
            setTimeout(()=>{
                tapeWindow.classList.remove('inertia-stop');
            }, 620);
        }, 500);
    } else {
        tapeWindow.classList.remove('slowing');
        tapeWindow.classList.remove('inertia-stop');
    }
    spinning = false;
    resetLED();
}

function setRecordLED(on) {
    if (!ledRec) return;
    ledRec.classList.toggle('active', !!on);
}

function setFastSpin(on) {
    tapeWindow.classList.toggle('fast', !!on);
}

function animateInsert() {
    tapeWindow.classList.remove('ejecting');
    tapeWindow.classList.add('inserting');
    setTimeout(()=>{
        tapeWindow.classList.remove('inserting');
        tapeWindow.classList.add('inserted');
        
        // 3D transform effect
        tapeFace.style.transition = "all 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.1)";
        tapeFace.style.transform = "translate(-50%, -50%) scale(1) translateZ(0) rotateX(0deg)";
        tapeFace.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
    }, 400);
}

function animateEject(callback) {
    tapeWindow.classList.remove('inserted');
    tapeWindow.classList.add('ejecting');
    
    // 3D transform effect
    tapeFace.style.transition = "all 0.7s cubic-bezier(0.2, 0.8, 0.3, 1)";
    tapeFace.style.transform = "translate(-50%, -115%) scale(0.94) translateZ(30px) rotateX(25deg)";
    tapeFace.style.boxShadow = "0 40px 60px rgba(0,0,0,0.6)";
    
    setTimeout(()=>{
        tapeWindow.classList.remove('ejecting');
        if (typeof callback === 'function') callback();
    }, 650);
}

function animateHalfEject() {
    // partial mechanical bounce
    tapeWindow.classList.remove('inserted');
    tapeWindow.classList.add('half-eject');
    setTimeout(()=>{
        tapeWindow.classList.remove('half-eject');
    }, 480);
}

function loadTape(tape) {
    if (!tape) return;
    formats = tape.formats || [];
    currentIndex = 0;
    renderDisk();
}

function renderDisk() {
    diskArea.innerHTML = '';
    if (formats.length === 0) return;
    const selected = formats[currentIndex];
    const circle = document.createElement('div');
    circle.className = 'disk-outer';
    const total = formats.length;
    const R = 104;
    formats.forEach((fmt, i) => {
        // Only show selected+neighbor disks (for clarity)
        if (total > 1 && Math.abs(i - currentIndex) > 1 && Math.abs(i - currentIndex)!==total-1) return;
        let rel = i - currentIndex;
        if (rel < -1) rel += total;
        if (rel > 1) rel -= total;
        const angle = rel * 48 * Math.PI / 180;
        const x = Math.sin(angle) * R + (rel === 0 ? 0 : (rel * 12));
        const y = Math.cos(angle) * R + (rel === 0 ? 0 : -14);
        const item = document.createElement('div');
        item.className = 'disk-item' + (i===currentIndex?' selected':'') + (Math.abs(rel)<1 ? '' : ' neighbor');
        item.style.transform = `translate(${x}px, ${y}px) scale(${i===currentIndex?1.13:0.75})`;
        item.style.zIndex = (10-Math.abs(rel))+'';
        item.innerHTML = `<div class='disk-label'>${fmt.format??''} <span>${fmt.quality??''}</span></div>`;
        item.onclick = ()=>{ 
            if (i!==currentIndex) {
                playTapeSound('rewind');
                currentIndex=i; 
                renderDisk();
            }
        }
        circle.appendChild(item);
    });
    diskArea.appendChild(circle);

    // Update tape face with format info
    updateTapeFace(selected);

    // Info box
    let info = document.getElementById('format-info-vintage');
    if (!info) {
        info = document.createElement('div');
        info.id = 'format-info-vintage';
        info.className = 'format-vintage-info';
        diskArea.parentNode.insertBefore(info, diskArea.nextSibling);
    }
    const f = selected;
    info.innerHTML = `<div class='fmt-meta-bar'><b>${f.format||''}</b> <span>/</span> <b>${f.quality||''}</b> <span>/</span> <b>${f.size||'--'}</b></div><div class='fmt-codec-row'>${f.codec ? 'Codec: <span>'+f.codec+'</span>' : ''}</div>`;
    info.style.display = 'block';
    // Gray out tape controls if only one format
    [backBtn,nextBtn].forEach(btn=>{btn.disabled = (formats.length<=1);});

    // Update footer info display if present
    const footer = document.querySelector('.footer');
    if (footer && f) {
        const meta = `${f.format || ''} | ${f.quality || ''} | ${f.size || '--'} | codec: ${f.codec || '—'}`;
        footer.textContent = meta;
    }
}

function updateTapeFace(format) {
    if (!tapeFace) return;
    
    // Update tape face with format info
    let formatLabel = format ? `${format.format || ''} ${format.quality || ''}` : 'No Format';
    let sizeLabel = format && format.size ? format.size : '';
    
    tapeFace.innerHTML = `
        <div class="tape-label">
            <div class="tape-format">${formatLabel}</div>
            <div class="tape-size">${sizeLabel}</div>
        </div>
    `;
}

function selectNext(){
    if (tapesQueue.length > 1) {
        playTapeSound('fastForward');
        if (selectorDiskArea) selectorDiskArea.classList.add('output-hidden');
        animateEject(()=>{
            currentTape = (currentTape + 1) % tapesQueue.length;
            animateInsert();
            loadTape(tapesQueue[currentTape]);
            updateStatus('Loaded next tape.');
            if (selectorDiskArea) { selectorDiskArea.classList.remove('output-hidden'); selectorDiskArea.classList.add('output-visible'); }
        });
        return;
    }
    if (formats.length<2) return;
    currentIndex = (currentIndex+1)%formats.length;
    playTapeSound('fastForward');
    if (selectorDiskArea) {
        selectorDiskArea.classList.add('output-hidden');
        setTimeout(()=>{ renderDisk(); selectorDiskArea.classList.remove('output-hidden'); selectorDiskArea.classList.add('output-visible'); }, 220);
    } else {
        renderDisk();
    }
}
function selectBack(){
    if (tapesQueue.length > 1) {
        playTapeSound('rewind');
        if (selectorDiskArea) selectorDiskArea.classList.add('output-hidden');
        animateEject(()=>{
            currentTape = (currentTape - 1 + tapesQueue.length) % tapesQueue.length;
            animateInsert();
            loadTape(tapesQueue[currentTape]);
            updateStatus('Loaded previous tape.');
            if (selectorDiskArea) { selectorDiskArea.classList.remove('output-hidden'); selectorDiskArea.classList.add('output-visible'); }
        });
        return;
    }
    if (formats.length<2) return;
    currentIndex = (currentIndex - 1 + formats.length)%formats.length;
    playTapeSound('rewind');
    if (selectorDiskArea) {
        selectorDiskArea.classList.add('output-hidden');
        setTimeout(()=>{ renderDisk(); selectorDiskArea.classList.remove('output-hidden'); selectorDiskArea.classList.add('output-visible'); }, 220);
    } else {
        renderDisk();
    }
}

function startDownload() {
    if (formats.length === 0) return;
    const format = formats[currentIndex];
    if (!format || !format.url) {
        updateStatus('No download URL available');
        return;
    }
    
    // Visual and audio feedback
    playTapeSound('play');
    startTapeAnimation();
    setLED('play');
    setRecordLED(true);
    setFastSpin(true);
    if (tuningDial) tuningDial.classList.add('power-on');
    
    // Create a temporary link and trigger download
    const a = document.createElement('a');
    a.href = format.url;
    a.download = format.filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Show download message with tape counts
    const totalTapes = tapesQueue.length || 1;
    const tapeIndexHuman = (currentTape >= 0 ? currentTape : 0) + 1;
    const meta = `${format.quality || ''}${format.size ? ", " + format.size : ''}`;
    updateStatus(`Recording... Tape ${tapeIndexHuman} / ${totalTapes} — ${meta}`);
    
    // Simulate completion sequence: stop, green, eject
    setTimeout(() => {
        stopTapeAnimation();
        setRecordLED(false);
        setLED('stop');
        setFastSpin(false);
        updateStatus('Download complete — Tape saved to your library.');
        animateEject(()=>{
            // Remove current tape from queue once done
            if (currentTape >=0) {
                tapesQueue.splice(currentTape,1);
                if (tapesQueue.length) {
                    currentTape = currentTape % tapesQueue.length;
                    animateInsert();
                    loadTape(tapesQueue[currentTape]);
                } else {
                    formats = [];
                    currentIndex = 0;
                    diskArea.innerHTML = '';
                }
            }
        });
    }, 3000);
}
function doSpin() {
    if (spinning) return; spinning=true; setLED('spin');
    spinTimer = setInterval(()=>{ selectNext(); }, 1350);
    document.querySelectorAll('.tape-reel').forEach(x=>x.style.animationPlayState='running');
}
function stopSpin() {
    spinning=false; setLED('stop');
    clearInterval(spinTimer);
    document.querySelectorAll('.tape-reel').forEach(x=>x.style.animationPlayState='paused');
}

function stopCurrentAction() {
    // Visual and audio feedback
    playTapeSound('stop');
    stopTapeAnimation();
    setLED('stop');
    updateStatus('Stopped');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Hide splash screen after a delay
    setTimeout(() => {
        splashScreen.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(() => {
            splashScreen.style.display = 'none';
            mainApp.style.display = 'block';
            if (tuningDial) tuningDial.classList.add('power-on');
        }, 500);
    }, 1500);
});


// Format toggle buttons
mp4Btn.addEventListener('click', () => {
    currentFormatType = 'mp4';
    updateToggleBtns();
    playTapeSound('stop');
    // Fetch formats again if URL is present
    if (urlInput.value) {
        insertBtn.click();
    }
});

mp3Btn.addEventListener('click', () => {
    currentFormatType = 'mp3';
    updateToggleBtns();
    playTapeSound('stop');
    // Fetch formats again if URL is present
    if (urlInput.value) {
        insertBtn.click();
    }
});

// Control buttons
backBtn.addEventListener('click', () => {selectBack();});
nextBtn.addEventListener('click', () => {selectNext();});
playBtn.addEventListener('mousedown', () => {playBtn.classList.add('pressed');});
playBtn.addEventListener('mouseup', () => {playBtn.classList.remove('pressed');});
playBtn.addEventListener('mouseleave', () => {playBtn.classList.remove('pressed');});
playBtn.addEventListener('click', () => {startDownload();});
stopBtn.addEventListener('mousedown', () => {stopBtn.classList.add('pressed');});
stopBtn.addEventListener('mouseup', () => {stopBtn.classList.remove('pressed');});
stopBtn.addEventListener('mouseleave', () => {stopBtn.classList.remove('pressed');});
stopBtn.addEventListener('click', () => {stopCurrentAction();});

// Sound toggle
if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', ()=>{
        const mute = !tapeSounds.insert.muted;
        Object.values(tapeSounds).forEach(s=> s.muted = mute);
        soundToggleBtn.textContent = mute ? 'SND✕' : 'SND';
    });
}

// URL input and insert button
insertBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
        updateStatus('Insert a video URL.');
        return;
    }
    
    playTapeSound('insert');
    startTapeAnimation();
    animateInsert();
    showLoading(true);
    setLED('spin');
    updateStatus('Analyzing link...');
    
    try {
        const resp = await fetch('/api/analyze', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({url})
        });
        const data = await resp.json();
        if(!resp.ok) throw new Error(data.error || 'Analyze failed');
        
        showLoading(false);
        const analyzedFormats = (currentFormatType === 'mp4') ? data.formats.filter(f => f.format === 'MP4') : data.formats;
        
        if (!analyzedFormats.length) { 
            updateStatus('No formats found.'); 
            resetLED(); 
            return; 
        }
        
        // push to queue and load
        tapesQueue.push({ url, formats: analyzedFormats });
        currentTape = tapesQueue.length - 1;
        formats = analyzedFormats;
        currentIndex = 0;
        renderDisk();
        updateStatus('Ready to download. Use rotary controls to select format.');
        stopTapeAnimation();
        setLED('play');
    } catch(e) {
        showLoading(false); 
        updateStatus('Error analyzing: ' + e.message); 
        stopTapeAnimation();
        setLED('stop');
    }
});

// Add tape cassette visual effects
urlInput.addEventListener('focus', () => {
    tapeWindow.classList.add('input-focus');
});

urlInput.addEventListener('blur', () => {
    tapeWindow.classList.remove('input-focus');
});
// Eject halfway when input cleared
urlInput.addEventListener('input', () => {
    const val = urlInput.value.trim();
    if (!val && tapeWindow.classList.contains('inserted')) {
        playTapeSound('stop');
        animateHalfEject();
        updateStatus('Tape partially ejected — insert a link to load.');
    }
});
updateToggleBtns();

// On Enter in input
urlInput.addEventListener('keydown',e=>{if(e.key==='Enter'){insertBtn.click();}});
// Initial setup
renderDisk();
resetLED();
updateStatus('Insert video link, select format, spin the deck!');
document.querySelectorAll('.tape-reel').forEach(x=>x.style.animationPlayState='paused');

// Apply CRT flicker (safely, periodically on .main-status)
function crtFlicker() {
    const ms = document.querySelector('.main-status.crt-glow');
    if (ms) {
        ms.style.opacity = (0.97 + Math.random() * 0.07) + '';
        ms.style.filter = `blur(${0.2 + Math.random() * 0.7}px)`;
    }
    setTimeout(crtFlicker, 260 + Math.random() * 340);
}
crtFlicker();

function ejectCurrentTape() {
    if (!formats.length) return;
    playTapeSound('eject');
    animateEject(()=>{
        if (tapesQueue.length && currentTape >= 0) {
            tapesQueue.splice(currentTape, 1);
            if (tapesQueue.length) {
                currentTape = Math.max(0, currentTape % tapesQueue.length);
                animateInsert();
                loadTape(tapesQueue[currentTape]);
            } else {
                formats = [];
                currentIndex = 0;
                diskArea.innerHTML = '';
            }
        }
    });
}
if (ejectBtn) {
    ejectBtn.addEventListener('click', () => {
        // Trigger download of currently selected format
        startDownload();
    });
}

// Disable EJECT if no tape
function updateEjectState() {
    if (ejectBtn) ejectBtn.disabled = !formats.length;
}
// Patch into all disk/tape changing points
const _origRenderDisk = renderDisk;
renderDisk = function() { _origRenderDisk.apply(this, arguments); updateEjectState(); }

