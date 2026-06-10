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
    if (!res.ok || !data.success) throw new Error(data.message || 'Request failed');
    return data.data;
  }
  
  function renderResult(data, type) {
    const isVideo = type === 'ttmp4';
    const isAudio = type === 'ttmp3';
    const vi = data.video_info || {};
    const sizeMb = data.size_mb ? (data.size_mb.includes('MB') ? data.size_mb : `${data.size_mb} MB`) : 'Unknown';
    
    let html = '<div class="result-card">';
    
    // Video Preview untuk video (tanpa suara/muted) - PASTI MUNCUL
    if (isVideo && data.download_url) {
      html += `
        <div class="video-preview-container" onclick="window.open('${data.download_url}', '_blank')">
          <video class="video-preview" muted autoplay loop playsinline disablePictureInPicture>
            <source src="${data.download_url}?preview=1" type="video/mp4">
            <img src="/assets/logo.png" alt="Preview not available">
          </video>
          <div class="video-preview-control">
            <i class="fas fa-play"></i> Preview (tanpa suara) • Klik untuk download
          </div>
        </div>
      `;
    }
    
    // Video Info
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
    
    // Play video setelah render
    setTimeout(() => {
      const video = document.querySelector('.video-preview');
      if (video) {
        video.play().catch(e => console.log('Auto-play prevented:', e));
      }
    }, 100);
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
    
    // Images Grid - Responsive untuk mobile
    if (images.length > 0) {
      html += `<div class="slideshow-section">`;
      html += `<div class="slideshow-grid" id="slideshowGrid">`;
      images.forEach((img, idx) => {
        html += `
          <div class="slideshow-card" onclick="window.open('${img}', '_blank')">
            <img src="${img}" alt="Photo ${idx + 1}" loading="lazy">
            <div class="photo-number">${idx + 1}/${images.length}</div>
          </div>
        `;
      });
      html += `</div>`;
      html += `<div class="slideshow-note"><i class="fas fa-info-circle"></i> Klik gambar untuk melihat/menyimpan • ${images.length} foto tanpa watermark</div>`;
      html += `</div>`;
    }
    
    html += `<div class="secure-note"><i class="fas fa-shield-alt"></i> Download aman dari Danuxy Studio • Tanpa Watermark</div>`;
    html += '</div>';
    
    resultDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  
  function displayError(msg) {
    resultDiv.innerHTML = `<div class="error"><i class="fas fa-exclamation-triangle"></i><div><strong>Error</strong><br>${escapeHtml(msg)}</div></div>`;
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
        displayError(err.message);
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
        displayError(err.message);
        isProcessing = false;
      }, 500);
    }
  }
})();