// App State
let player = null;
let isPlayerReady = false;
let isPlaying = false;
let currentIndex = 0;
let currentCategory = 'all';
let searchQuery = '';
let isVideoVisible = false;
let progressInterval = null;
let favorites = new Set();

// Rain Mode State (yIQd2Ya0Ziw)
let rainPlayer = null;
let isRainPlayerReady = false;
let isRainModeOn = false;
let currentRainVolume = 20;
let rainAnimationId = null;

// Load favorites
try {
  const saved = localStorage.getItem('sm_favorites');
  if (saved) favorites = new Set(JSON.parse(saved));
} catch (e) {}

// Initial Launch
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initOnlineCounter();
  initPlayerUI();
  initRainCanvas();
  setupEventListeners();
  setupKeyboardShortcuts();
});

// Real-time Clock (e.g. 9:58 PM)
function initClock() {
  const clockEl = document.getElementById('clockDisplay');
  function update() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? '0' + minutes : minutes;
    clockEl.textContent = `${hours}:${minStr} ${ampm}`;
  }
  update();
  setInterval(update, 1000);
}

// Simulated Online Listeners Counter
function initOnlineCounter() {
  const countEl = document.getElementById('onlineCount');
  let currentCount = 68;
  setInterval(() => {
    // Subtle realistic fluctuation between 64 and 74
    const delta = Math.floor(Math.random() * 3) - 1;
    currentCount = Math.min(76, Math.max(62, currentCount + delta));
    countEl.textContent = `${currentCount} online`;
  }, 9000);
}

// YouTube API Ready Callback
window.onYouTubeIframeAPIReady = function () {
  const firstTrack = window.TRACKS && window.TRACKS.length > 0 ? window.TRACKS[0] : null;
  const initialId = firstTrack ? firstTrack.id : 'N0jnLZxYwYc';

  // Main Music Player
  player = new YT.Player('ytPlayerFrame', {
    height: '100%',
    width: '100%',
    videoId: initialId,
    playerVars: {
      playsinline: 1,
      controls: 1,
      rel: 0,
      modestbranding: 1
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError
    }
  });

  // Rain Ambience Player (yIQd2Ya0Ziw)
  rainPlayer = new YT.Player('rainPlayerFrame', {
    height: '1',
    width: '1',
    videoId: 'yIQd2Ya0Ziw',
    playerVars: {
      autoplay: 0,
      controls: 0,
      loop: 1,
      playlist: 'yIQd2Ya0Ziw',
      playsinline: 1
    },
    events: {
      onReady: () => {
        isRainPlayerReady = true;
        console.log('Rain Player (yIQd2Ya0Ziw) Ready');
        rainPlayer.setVolume(currentRainVolume);
        if (isRainModeOn) {
          rainPlayer.playVideo();
        }
      }
    }
  });
};

function onPlayerReady() {
  isPlayerReady = true;
  console.log('YouTube Player Ready');
  const vol = document.getElementById('volumeSlider').value;
  player.setVolume(parseInt(vol, 10));
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    setPlayingState(true);
    startProgressTimer();
  } else if (event.data === YT.PlayerState.PAUSED) {
    setPlayingState(false);
    stopProgressTimer();
  } else if (event.data === YT.PlayerState.ENDED) {
    setPlayingState(false);
    stopProgressTimer();
    playNextTrack();
  }
}

function onPlayerError(event) {
  console.warn('Player Error:', event.data);
  setTimeout(playNextTrack, 1200);
}

function setPlayingState(playing) {
  isPlaying = playing;
  const capsule = document.getElementById('playerCapsule');
  const icon = document.getElementById('playPauseIcon');

  if (playing) {
    capsule.classList.add('playing');
    icon.innerHTML = `<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>`;
  } else {
    capsule.classList.remove('playing');
    icon.innerHTML = `<polygon points="6 3 20 12 6 21 6 3"></polygon>`;
  }
  updateActiveSongRow();
}

function initPlayerUI() {
  if (window.TRACKS && window.TRACKS.length > 0) {
    updateCapsuleTrack(window.TRACKS[0]);
  }
  renderDrawerSongs();
}

function updateCapsuleTrack(track) {
  if (!track) return;
  document.getElementById('capsuleThumb').src = track.thumbnail;
  document.getElementById('capsuleTitle').textContent = track.title;
  document.getElementById('capsuleArtist').textContent = track.artist;
  document.getElementById('capsuleTimeText').textContent = `0:00 / ${track.duration || '0:00'}`;
  document.getElementById('progressBarFill').style.width = '0%';
}

function playTrackByIndex(idx) {
  if (!window.TRACKS || idx < 0 || idx >= window.TRACKS.length) return;
  currentIndex = idx;
  const track = window.TRACKS[currentIndex];
  updateCapsuleTrack(track);

  if (player && isPlayerReady) {
    player.loadVideoById(track.id);
    setPlayingState(true);
  }
}

function playTrackById(id) {
  const idx = window.TRACKS.findIndex(t => t.id === id);
  if (idx !== -1) {
    playTrackByIndex(idx);
  }
}

function togglePlay() {
  if (!player || !isPlayerReady) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

function playNextTrack() {
  const nextIdx = (currentIndex + 1) % window.TRACKS.length;
  playTrackByIndex(nextIdx);
}

function playPrevTrack() {
  if (player && isPlayerReady && player.getCurrentTime && player.getCurrentTime() > 4) {
    player.seekTo(0);
    return;
  }
  const prevIdx = (currentIndex - 1 + window.TRACKS.length) % window.TRACKS.length;
  playTrackByIndex(prevIdx);
}

// Progress Bar & Scrubbing
function startProgressTimer() {
  stopProgressTimer();
  progressInterval = setInterval(() => {
    if (!player || !isPlayerReady || !player.getCurrentTime) return;
    const current = player.getCurrentTime();
    const duration = player.getDuration() || window.TRACKS[currentIndex]?.durationSec || 0;

    if (duration > 0) {
      const pct = (current / duration) * 100;
      document.getElementById('progressBarFill').style.width = `${Math.min(pct, 100)}%`;
      const curFormatted = formatTime(current);
      const durFormatted = formatTime(duration);
      document.getElementById('capsuleTimeText').textContent = `${curFormatted} / ${durFormatted}`;
    }
  }, 400);
}

function stopProgressTimer() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

function formatTime(seconds) {
  const s = Math.floor(seconds || 0);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

function handleProgressClick(e) {
  if (!player || !isPlayerReady || !player.getDuration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const clickPos = (e.clientX - rect.left) / rect.width;
  const duration = player.getDuration() || window.TRACKS[currentIndex]?.durationSec || 0;
  if (duration > 0) {
    const targetSec = duration * clickPos;
    player.seekTo(targetSec, true);
    document.getElementById('progressBarFill').style.width = `${clickPos * 100}%`;
    document.getElementById('capsuleTimeText').textContent = `${formatTime(targetSec)} / ${formatTime(duration)}`;
  }
}

// Volume handling
function handleVolume(e) {
  const val = parseInt(e.target.value, 10);
  if (player && isPlayerReady) {
    player.setVolume(val);
    if (player.isMuted && player.isMuted() && val > 0) {
      player.unMute();
    }
  }
}

function toggleMute() {
  if (!player || !isPlayerReady) return;
  if (player.isMuted()) {
    player.unMute();
  } else {
    player.mute();
  }
}

// Filtered songs
function getFilteredTracks() {
  let list = window.TRACKS || [];

  if (currentCategory === 'favorites') {
    list = list.filter(t => favorites.has(t.id));
  } else if (currentCategory === 'sanu') {
    list = list.filter(t => /Kumar Sanu/i.test(t.title) || /Kumar Sanu/i.test(t.artist));
  } else if (currentCategory === 'romantic') {
    list = list.filter(t => /Pyar|Mohabbat|Dil|Sanam|Janam|Aashiqui|Deewana|Saajan|Pehli|Prem/i.test(t.title));
  } else if (currentCategory === 'jhankar') {
    list = list.filter(t => /Jhankar/i.test(t.title) || /Beats/i.test(t.artist));
  } else if (currentCategory === 'pl1') {
    list = list.filter(t => t.playlist === 'PLVj13wxnoNgc');
  } else if (currentCategory === 'pl2') {
    list = list.filter(t => t.playlist === 'PLCYtCYjFC67c');
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
  }

  return list;
}

function renderDrawerSongs() {
  const container = document.getElementById('drawerSongsList');
  const filtered = getFilteredTracks();
  const totalBadge = document.getElementById('songsTotalBadge');
  if (totalBadge) totalBadge.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-dim);">
        <p style="font-size: 1rem; color: #fff;">No songs found</p>
        <p style="font-size: 0.8rem; margin-top: 4px;">Try another search term or filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(t => {
    const isCur = window.TRACKS[currentIndex]?.id === t.id;
    return `
      <div class="song-row ${isCur ? 'current-playing' : ''}" onclick="selectSongFromDrawer('${t.id}')">
        <div class="song-left">
          <span class="song-index">${t.index}</span>
          <img class="song-thumb" src="${t.thumbnail}" alt="" loading="lazy" />
          <div class="song-meta">
            <div class="song-title-text">${escapeHtml(t.title)}</div>
            <div class="song-artist-text">${escapeHtml(t.artist)}</div>
          </div>
        </div>
        <div class="song-right">
          <span>${t.duration || '--:--'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function updateActiveSongRow() {
  const curId = window.TRACKS[currentIndex]?.id;
  document.querySelectorAll('.song-row').forEach(row => {
    // Check if clicked
  });
}

function selectSongFromDrawer(id) {
  playTrackById(id);
  closeAllModals();
}

// Modals Control
function openSongsModal() {
  document.getElementById('songsModalOverlay').classList.add('open');
  renderDrawerSongs();
  setTimeout(() => document.getElementById('songSearchInput').focus(), 150);
}

function openPlaylistsModal() {
  document.getElementById('playlistsModalOverlay').classList.add('open');
}

function closeAllModals() {
  document.getElementById('songsModalOverlay').classList.remove('open');
  document.getElementById('playlistsModalOverlay').classList.remove('open');
}

// Event Listeners
function setupEventListeners() {
  // Player Controls
  document.getElementById('playPauseBtn').addEventListener('click', togglePlay);
  document.getElementById('nextTrackBtn').addEventListener('click', playNextTrack);
  document.getElementById('prevTrackBtn').addEventListener('click', playPrevTrack);
  document.getElementById('progressBarContainer').addEventListener('click', handleProgressClick);
  document.getElementById('volumeSlider').addEventListener('input', handleVolume);
  document.getElementById('muteToggleBtn').addEventListener('click', toggleMute);

  // Video Toggle
  document.getElementById('videoToggleBtn').addEventListener('click', () => {
    isVideoVisible = !isVideoVisible;
    const wrap = document.getElementById('ytVideoWrap');
    if (isVideoVisible) {
      wrap.classList.add('video-visible');
    } else {
      wrap.classList.remove('video-visible');
    }
  });

  // Open Modals
  document.getElementById('openSongsBtn').addEventListener('click', openSongsModal);
  document.getElementById('openSongsFromTrack').addEventListener('click', openSongsModal);
  document.getElementById('openPlaylistsBtn').addEventListener('click', openPlaylistsModal);

  // Close Modals
  document.getElementById('closeSongsBtn').addEventListener('click', closeAllModals);
  document.getElementById('closePlaylistsBtn').addEventListener('click', closeAllModals);
  document.getElementById('songsModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'songsModalOverlay') closeAllModals();
  });
  document.getElementById('playlistsModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'playlistsModalOverlay') closeAllModals();
  });

  // Search in Drawer
  document.getElementById('songSearchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderDrawerSongs();
  });

  // Category filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.getAttribute('data-cat');
      renderDrawerSongs();
    });
  });

  // Rain Mode Listeners
  const rainToggle = document.getElementById('rainToggleCheckbox');
  if (rainToggle) {
    rainToggle.addEventListener('change', (e) => {
      toggleRainMode(e.target.checked);
    });
  }

  const topRainBtn = document.getElementById('topRainBtn');
  if (topRainBtn) {
    topRainBtn.addEventListener('click', () => {
      toggleRainMode();
    });
  }

  const rainSlider = document.getElementById('rainVolSlider');
  if (rainSlider) {
    rainSlider.addEventListener('input', handleRainVolume);
  }

  // Fullscreen Button
  const fsBtn = document.getElementById('fullscreenToggleBtn');
  if (fsBtn) {
    fsBtn.addEventListener('click', toggleFullscreen);
  }
}

// Fullscreen Toggle
function toggleFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

// Rain Mode Controls
function toggleRainMode(forcedState) {
  if (typeof forcedState === 'boolean') {
    isRainModeOn = forcedState;
  } else {
    isRainModeOn = !isRainModeOn;
  }

  const checkbox = document.getElementById('rainToggleCheckbox');
  if (checkbox) checkbox.checked = isRainModeOn;

  const panel = document.getElementById('glassRainPanel');
  if (panel) panel.classList.toggle('rain-active', isRainModeOn);

  document.body.classList.toggle('rain-active-mode', isRainModeOn);

  const statusTag = document.getElementById('rainStatusTag');
  if (statusTag) statusTag.textContent = isRainModeOn ? 'ON' : 'OFF';

  const topStatus = document.getElementById('topRainStatusText');
  if (topStatus) topStatus.textContent = isRainModeOn ? 'ON' : 'OFF';

  const topBtn = document.getElementById('topRainBtn');
  if (topBtn) topBtn.classList.toggle('active', isRainModeOn);

  if (isRainModeOn) {
    if (rainPlayer && isRainPlayerReady) {
      rainPlayer.setVolume(currentRainVolume);
      rainPlayer.playVideo();
    }
    startRainCanvasAnimation();
  } else {
    if (rainPlayer && isRainPlayerReady) {
      rainPlayer.pauseVideo();
    }
    stopRainCanvasAnimation();
  }
}

function handleRainVolume(e) {
  currentRainVolume = parseInt(e.target.value, 10);
  const valText = document.getElementById('rainVolText');
  if (valText) valText.textContent = `${currentRainVolume}%`;

  if (rainPlayer && isRainPlayerReady) {
    rainPlayer.setVolume(currentRainVolume);
  }
}

// Canvas Rain Particle Animation
let rainCanvas = null;
let rainCtx = null;
let raindrops = [];

function initRainCanvas() {
  rainCanvas = document.getElementById('rainCanvas');
  if (!rainCanvas) return;
  rainCtx = rainCanvas.getContext('2d');
  resizeRainCanvas();
  window.addEventListener('resize', resizeRainCanvas);
}

function resizeRainCanvas() {
  if (!rainCanvas) return;
  rainCanvas.width = window.innerWidth;
  rainCanvas.height = window.innerHeight;
}

function startRainCanvasAnimation() {
  if (!rainCanvas) initRainCanvas();
  if (rainAnimationId) cancelAnimationFrame(rainAnimationId);

  const count = Math.floor(window.innerWidth / 12);
  raindrops = [];
  for (let i = 0; i < count; i++) {
    raindrops.push({
      x: Math.random() * rainCanvas.width,
      y: Math.random() * rainCanvas.height,
      length: Math.random() * 22 + 10,
      speed: Math.random() * 8 + 14,
      opacity: Math.random() * 0.4 + 0.15
    });
  }

  function loop() {
    if (!isRainModeOn) return;
    rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);

    rainCtx.lineWidth = 1.2;
    for (let drop of raindrops) {
      rainCtx.strokeStyle = `rgba(186, 230, 253, ${drop.opacity})`;
      rainCtx.beginPath();
      rainCtx.moveTo(drop.x, drop.y);
      rainCtx.lineTo(drop.x - 1, drop.y + drop.length);
      rainCtx.stroke();

      drop.y += drop.speed;
      drop.x -= 0.8;

      if (drop.y > rainCanvas.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * rainCanvas.width;
      }
    }

    rainAnimationId = requestAnimationFrame(loop);
  }
  loop();
}

function stopRainCanvasAnimation() {
  if (rainAnimationId) {
    cancelAnimationFrame(rainAnimationId);
    rainAnimationId = null;
  }
  if (rainCanvas && rainCtx) {
    rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
  }
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())) {
      if (e.key === 'Escape') closeAllModals();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      if (player && isPlayerReady && player.getCurrentTime) {
        player.seekTo(player.getCurrentTime() + 5, true);
      }
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      if (player && isPlayerReady && player.getCurrentTime) {
        player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
      }
    } else if (e.key === 'n' || e.key === 'N') {
      playNextTrack();
    } else if (e.key === 'p' || e.key === 'P') {
      playPrevTrack();
    } else if (e.key === 'm' || e.key === 'M') {
      toggleMute();
    } else if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
