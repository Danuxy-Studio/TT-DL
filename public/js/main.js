(function() {
  'use strict';
  
  let urlInput, clearBtn, btnVideo, btnAudio, btnPhoto, loadingDiv, resultDiv, progressFill;
  let progressInterval = null;
  let isProcessing = false;
  
  const API_BASE = '/api/tiktok';
  
  document.addEventListener('DOMContentLoaded', () => {
    urlInput = document.getElementById('urlInput');
    clearBtn = document.getElementById('clearBtn');
    btnVideo = document.getElementById('btnVideo');
    btnAudio = document.getElementById('btnAudio');
    btnPhoto = document.getElementById('btnPhoto');
    loadingDiv = document.getElementById('loading');
    resultDiv = document.getElementById('result');
    progressFill = document.getElementById('progressFill');
    
    if (!urlInput || !btnVideo || !btnAudio) return;
    
    if (clearBtn) {
      urlInput.addEventListener('input', () => {
        clearBtn.style.display = urlInput.value ? 'flex' : 'none';
      });
      clearBtn.addEventListener('click', () => {
        urlInput.value = '';
        clearBtn.style.display = 'none';
        urlInput.focus();
      });
    }
    
    btnVideo.addEventListener('click', () => handleDownload('ttmp4', { quality: '1080p' }));
    btnAudio.addEventListener('click', () => handleDownload('ttmp3'));
    if (btnPhoto) btnPhoto.addEventListener('click', () => handlePhoto());
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleDownload('ttmp4', { quality: '1080p' });
    });
    
    const donateBtn = document.getElementById('donateBtn');
    const modal = document.getElementById('modal');
    const closeModal = document.getElementById('closeModal');
    
    if (donateBtn && modal && closeModal) {
      donateBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      });
      closeModal.addEventListener('click', () => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
          document.body.style.overflow = '';
        }
      });
    }
  });
  
  function startProgress() {
    let progress = 0;
    if (progressInterval) clearInterval(progressInterval);
    
    progressInterval = setInterval(() => {
      if (progress < 95) {
        progress += Math.random() * 12;
        if (progress > 95) progress = 95;
        if (progressFill) progressFill.style.width = `${progress}%`;
      }
    }, 500);
  }
  
  function completeProgress() {
    if (progressInterval) clearInterval(progressInterval);
    if (progressFill) progressFill.style.width = '100%';
  }
  
  function showLoading(show) {
    if (show) {
      loadingDiv.classList.remove('hidden');
      resultDiv.classList.add('hidden');
      startProgress();
    } else {
      loadingDiv.classList.add('hidden');
    }
  }
  
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, (m) => {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }
  
  function formatNumber(num) {
    if (!num) return null;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
  
  function getUrl() {
    let raw = urlInput.value.trim();
    if (!raw) throw new Error('Masukkan URL TikTok');
    if (!raw.includes('tiktok.com') && !raw.includes('vt.tiktok')) {
      throw new Error('URL TikTok tidak valid');
    }
    return raw;
  }
  
  async function callAPI(endpoint, payload) {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      const error = new Error(data.error?.message || data.message || 'Request failed');
      error.code = data.error?.code || 'UNKNOWN';
      error.detail = data.error;
      throw error;
    }
    return data.data;
  }
  
  function renderResult(data, type) {
    const isVideo = type === 'ttmp4';
    const isAudio = type === 'ttmp3';
    const vi = data.video_info || {};
    const sizeMb = data.size_mb ? (data.size_mb.includes('MB') ? data.size_mb : `${data.size_mb} MB`) : 'Unknown';
    
    let html = '<div class="result-card">';
    
    // Video Preview
    if (isVideo && data.download_url) {
      html += `
        <div class="video-preview-container">
          <video class="video-preview" controls muted autoplay loop playsinline disablePictureInPicture>
            <source src="${data.download_url}" type="video/mp4">
            Browser tidak support video preview.
          </video>
          <div class="video-preview-control">
            <i class="fas fa-play"></i> Preview Video
          </div>
        </div>
      `;
    }
    
    // Audio Player
    if (isAudio && data.download_url) {
      html += `
        <div class="audio-player-container">
          <div class="audio-player-header">
            <i class="fas fa-music"></i>
            <span>Preview Audio</span>
          </div>
          <audio controls class="audio-preview" preload="metadata">
            <source src="${data.download_url}" type="audio/mpeg">
            Browser tidak support audio player.
          </audio>
          <div class="audio-info">
            <i class="fas fa-headphones"></i> Play untuk mendengarkan sebelum download
          </div>
        </div>
      `;
    }
    
    // Info
    html += `
      <div class="result-info">
        <div class="result-title">${escapeHtml(vi.title || (isVideo ? 'TikTok Video' : isAudio ? 'TikTok Audio' : 'TikTok Content'))}</div>
        <div class="result-meta">
          <span><i class="fab fa-tiktok"></i> ${escapeHtml(vi.uploader || 'Unknown')}</span>
          ${data.quality ? `<span><i class="fas fa-tachometer-alt"></i> ${escapeHtml(data.quality)}</span>` : ''}
          <span><i class="fas fa-database"></i> ${sizeMb}</span>
          ${vi.like_count ? `<span><i class="fas fa-heart"></i> ${formatNumber(vi.like_count)}</span>` : ''}
        </div>
      </div>
    `;
    
    // File Info
    if (data.filename) {
      html += `<div class="file-info"><span><i class="fas fa-file"></i> ${escapeHtml(data.filename)}</span><span><i class="fas fa-download"></i> ${sizeMb}</span></div>`;
    }
    
    // Download Link
    if (data.download_url) {
      const downloadText = isVideo ? 'Download Video (HD)' : (isAudio ? 'Download Audio MP3' : 'Download');
      html += `<a href="${data.download_url}" class="download-link" download target="_blank"><i class="fas fa-download"></i> ${downloadText}</a>`;
    }
    
    html += `<div class="secure-note"><i class="fas fa-shield-alt"></i> Download aman dari Danuxy Studio • Tanpa Watermark</div>`;
    html += '</div>';
    
    resultDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  
  function renderPhotoResult(data) {
    const vi = data.video_info || {};
    const images = data.images || [];
    
    let html = '<div class="result-card">';
    
    // Info
    html += `
      <div class="result-info">
        <div class="result-title">${escapeHtml(vi.title || 'TikTok Slideshow')}</div>
        <div class="result-meta">
          <span><i class="fab fa-tiktok"></i> ${escapeHtml(vi.uploader || 'Unknown')}</span>
          <span><i class="fas fa-images"></i> ${data.image_count || images.length} Foto</span>
          ${vi.like_count ? `<span><i class="fas fa-heart"></i> ${formatNumber(vi.like_count)}</span>` : ''}
        </div>
      </div>
    `;
    
    // Images Grid
    if (images.length > 0) {
      html += `<div class="slideshow-section">`;
      html += `<div class="slideshow-grid">`;
      images.forEach((img, idx) => {
        html += `
          <div class="slideshow-card">
            <img src="${img}" alt="Photo ${idx + 1}" loading="lazy">
            <div class="photo-number">${idx + 1}/${images.length}</div>
            <a href="${img}" class="photo-download-btn" download target="_blank">
              <i class="fas fa-download"></i> Download
            </a>
          </div>
        `;
      });
      html += `</div>`;
      html += `<div class="slideshow-note"><i class="fas fa-info-circle"></i> Klik tombol Download di bawah setiap gambar untuk menyimpan • ${images.length} foto tanpa watermark</div>`;
      html += `</div>`;
    }
    
    html += `<div class="secure-note"><i class="fas fa-shield-alt"></i> Download aman dari Danuxy Studio • Tanpa Watermark</div>`;
    html += '</div>';
    
    resultDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  
  function displayError(error) {
    let errorMessage = error.message || 'Terjadi kesalahan';
    let suggestion = '';
    let errorCode = error.code || '';
    
    if (errorCode === 'PHOTO_URL') {
      errorMessage = 'Link ini adalah slideshow (kumpulan foto)';
      suggestion = 'Gunakan tombol "Download Foto" untuk mengunduh semua gambar.';
    } 
    else if (errorCode === 'VIDEO_URL') {
      errorMessage = 'Link ini adalah video';
      suggestion = 'Gunakan tombol "Download Video" untuk mengunduh videonya.';
    } 
    else if (errorCode === 'SERVER_ERROR') {
      errorMessage = 'Terjadi kesalahan pada server';
      suggestion = 'Silakan coba lagi dalam beberapa saat.';
    }
    else if (error.message && error.message.includes('URL TikTok tidak valid')) {
      errorMessage = 'URL TikTok tidak valid';
      suggestion = 'Pastikan URL yang Anda masukkan benar.';
    }
    else if (error.message && error.message.includes('Masukkan URL')) {
      errorMessage = 'URL TikTok tidak boleh kosong';
      suggestion = 'Silakan masukkan URL TikTok terlebih dahulu.';
    }
    
    let html = `
      <div class="error">
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <strong>Error</strong><br>
          ${escapeHtml(errorMessage)}
          ${suggestion ? `<br><span class="error-suggestion">${escapeHtml(suggestion)}</span>` : ''}
          <br><br>
          <span class="error-contact">
            <i class="fab fa-whatsapp"></i> Hubungi: 
            <a href="https://whatsapp.com/channel/0029Vb6RsCAEAKWDFTrHdu0L" target="_blank">WhatsApp</a>
            <span class="separator">•</span>
            <i class="fab fa-github"></i> 
            <a href="https://github.com/Danuxy-Studio" target="_blank">GitHub</a>
          </span>
        </div>
      </div>
    `;
    
    resultDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
  }
  
  async function handleDownload(endpoint, payload = {}) {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
      const url = getUrl();
      showLoading(true);
      const res = await callAPI(endpoint, { url, ...payload });
      if (!res) throw new Error('Gagal memproses');
      completeProgress();
      setTimeout(() => {
        showLoading(false);
        renderResult(res, endpoint);
        isProcessing = false;
      }, 500);
    } catch (err) {
      completeProgress();
      setTimeout(() => {
        showLoading(false);
        displayError(err);
        isProcessing = false;
      }, 500);
    }
  }
  
  async function handlePhoto() {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
      const url = getUrl();
      showLoading(true);
      const res = await callAPI('ttphoto', { url });
      if (!res) throw new Error('Gagal memproses');
      completeProgress();
      setTimeout(() => {
        showLoading(false);
        renderPhotoResult(res);
        isProcessing = false;
      }, 500);
    } catch (err) {
      completeProgress();
      setTimeout(() => {
        showLoading(false);
        displayError(err);
        isProcessing = false;
      }, 500);
    }
  }
})();