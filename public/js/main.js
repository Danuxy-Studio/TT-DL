(function () {
    "use strict";

    let urlInput,
        clearBtn,
        btnVideo,
        btnAudio,
        btnPhoto,
        loadingDiv,
        resultDiv,
        progressFill;
    let progressInterval = null;
    let isProcessing = false;

    const API_BASE = "/api/tiktok";

    document.addEventListener("DOMContentLoaded", () => {
        urlInput = document.getElementById("urlInput");
        clearBtn = document.getElementById("clearBtn");
        btnVideo = document.getElementById("btnVideo");
        btnAudio = document.getElementById("btnAudio");
        btnPhoto = document.getElementById("btnPhoto");
        loadingDiv = document.getElementById("loading");
        resultDiv = document.getElementById("result");
        progressFill = document.getElementById("progressFill");

        if (!urlInput || !btnVideo || !btnAudio) return;

        if (clearBtn) {
            urlInput.addEventListener("input", () => {
                clearBtn.style.display = urlInput.value ? "flex" : "none";
            });
            clearBtn.addEventListener("click", () => {
                urlInput.value = "";
                clearBtn.style.display = "none";
                urlInput.focus();
            });
        }

        btnVideo.addEventListener("click", () =>
            handleDownload("ttmp4", { quality: "1080p" })
        );
        btnAudio.addEventListener("click", () => handleDownload("ttmp3"));
        if (btnPhoto) btnPhoto.addEventListener("click", () => handlePhoto());
        urlInput.addEventListener("keypress", e => {
            if (e.key === "Enter")
                handleDownload("ttmp4", { quality: "1080p" });
        });

        const donateBtn = document.getElementById("donateBtn");
        const modal = document.getElementById("modal");
        const closeModal = document.getElementById("closeModal");

        if (donateBtn && modal && closeModal) {
            donateBtn.addEventListener("click", () => {
                modal.classList.remove("hidden");
                document.body.style.overflow = "hidden";
            });
            closeModal.addEventListener("click", () => {
                modal.classList.add("hidden");
                document.body.style.overflow = "";
            });
            modal.addEventListener("click", e => {
                if (e.target === modal) {
                    modal.classList.add("hidden");
                    document.body.style.overflow = "";
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
        if (progressFill) progressFill.style.width = "100%";
    }

    function showLoading(show) {
        if (show) {
            loadingDiv.classList.remove("hidden");
            resultDiv.classList.add("hidden");
            startProgress();
        } else {
            loadingDiv.classList.add("hidden");
        }
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str).replace(/[&<>]/g, m => {
            if (m === "&") return "&amp;";
            if (m === "<") return "&lt;";
            if (m === ">") return "&gt;";
            return m;
        });
    }

    function formatFileSize(bytes) {
        if (!bytes) return "Unknown";
        if (typeof bytes === "string" && bytes.includes("MB")) return bytes;
        return `${bytes} MB`;
    }

    function getUrl() {
        let raw = urlInput.value.trim();
        if (!raw) throw new Error("Masukkan URL TikTok");
        if (!raw.includes("tiktok.com") && !raw.includes("vt.tiktok")) {
            throw new Error("URL TikTok tidak valid");
        }
        return raw;
    }

    async function callAPI(endpoint, payload) {
        const res = await fetch(`${API_BASE}/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success)
            throw new Error(data.message || "Request failed");
        return data.data;
    }

    function renderResult(data, type) {
        const isVideo = type === "ttmp4";
        const isAudio = type === "ttmp3";

        let html = '<div class="result-card">';

        // Video Info
        if (data.video_info) {
            html += `
        <div class="result-info">
          <div class="result-title">${escapeHtml(data.video_info.title || "TikTok Video")}</div>
          <div class="result-meta">
            <span><i class="fab fa-tiktok"></i> ${escapeHtml(data.video_info.uploader || "Unknown")}</span>
            ${data.quality ? `<span><i class="fas fa-tachometer-alt"></i> ${escapeHtml(data.quality)}</span>` : ""}
            ${data.size_mb ? `<span><i class="fas fa-database"></i> ${escapeHtml(data.size_mb)} MB</span>` : ""}
          </div>
        </div>
      `;
        }

        // File Info
        if (data.filename || data.image_count) {
            if (data.image_count) {
                html += `<div class="file-info"><span><i class="fas fa-images"></i> ${data.image_count} Foto</span></div>`;
            } else if (data.filename) {
                html += `<div class="file-info"><span><i class="fas fa-file"></i> ${escapeHtml(data.filename)}</span><span><i class="fas fa-database"></i> ${escapeHtml(data.size_mb || "Unknown")} MB</span></div>`;
            }
        }

        // Download Link
        if (data.download_url) {
            const downloadText = isVideo
                ? "Download Video"
                : isAudio
                  ? "Download Audio"
                  : "Download";
            html += `<a href="${data.download_url}" class="download-link" download target="_blank"><i class="fas fa-download"></i> ${downloadText}</a>`;
        }

        // Images for slideshow
        if (data.images && data.images.length > 0) {
            html += `<div class="slideshow-images">`;
            data.images.forEach((img, idx) => {
                html += `<div class="slideshow-image"><img src="${img}" alt="Slide ${idx + 1}" loading="lazy" onclick="window.open('${img}', '_blank')"></div>`;
            });
            html += `</div><div class="slideshow-note"><i class="fas fa-info-circle"></i> Klik gambar untuk melihat/ menyimpan</div>`;
        }

        // Secure note
        html += `<div class="secure-note"><i class="fas fa-shield-alt"></i> Download aman dari Danuxy Studio • Tanpa Watermark</div>`;
        html += "</div>";

        resultDiv.innerHTML = html;
        resultDiv.classList.remove("hidden");
        resultDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function renderPhotoResult(data) {
        let html = '<div class="result-card">';

        if (data.video_info) {
            html += `
        <div class="result-info">
          <div class="result-title">${escapeHtml(data.video_info.title || "TikTok Slideshow")}</div>
          <div class="result-meta">
            <span><i class="fab fa-tiktok"></i> ${escapeHtml(data.video_info.uploader || "Unknown")}</span>
            <span><i class="fas fa-images"></i> ${data.image_count} Foto</span>
          </div>
        </div>
      `;
        }

        if (data.images && data.images.length > 0) {
            html += `<div class="slideshow-images">`;
            data.images.forEach((img, idx) => {
                html += `<div class="slideshow-image"><img src="${img}" alt="Slide ${idx + 1}" loading="lazy" onclick="window.open('${img}', '_blank')"></div>`;
            });
            html += `</div><div class="slideshow-note"><i class="fas fa-info-circle"></i> Klik gambar untuk melihat/menyimpan • ${data.image_count} foto</div>`;
        }

        html += `<div class="secure-note"><i class="fas fa-shield-alt"></i> Download aman dari Danuxy Studio • Tanpa Watermark</div>`;
        html += "</div>";

        resultDiv.innerHTML = html;
        resultDiv.classList.remove("hidden");
        resultDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function displayError(msg) {
        resultDiv.innerHTML = `<div class="error"><i class="fas fa-exclamation-triangle"></i><div><strong>Error</strong><br>${escapeHtml(msg)}</div></div>`;
        resultDiv.classList.remove("hidden");
    }

    async function handleDownload(endpoint, payload = {}) {
        if (isProcessing) return;
        isProcessing = true;

        try {
            const url = getUrl();
            showLoading(true);
            const res = await callAPI(endpoint, { url, ...payload });
            if (!res) throw new Error("Gagal memproses");
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
            const res = await callAPI("ttphoto", { url });
            if (!res) throw new Error("Gagal memproses");
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
