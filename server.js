require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Performance
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      mediaSrc: ["'self'", "blob:", "data:", "https:"], // Penting untuk audio/video
      connectSrc: ["'self'", "https://api.danuxy.com"],
      frameSrc: ["'none'"]
    }
  }
}));

app.use(cors());
app.use(express.json());

// Static files
app.use(express.static('public', {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
  }
}));

// ============ PROXY DOWNLOAD - Download langsung dari server ============
app.get('/api/download', async (req, res) => {
  try {
    const { url, type } = req.query;
    if (!url) return res.status(400).json({ success: false, message: 'URL required' });
    
    console.log(`[PROXY] Downloading: ${url.substring(0, 100)}...`);
    
    // Set header yang benar untuk file
    let contentType = 'application/octet-stream';
    if (type === 'mp4' || url.includes('.mp4')) contentType = 'video/mp4';
    if (type === 'mp3' || url.includes('.mp3')) contentType = 'audio/mpeg';
    if (type === 'jpg' || type === 'jpeg' || url.includes('.jpg')) contentType = 'image/jpeg';
    if (type === 'png' || url.includes('.png')) contentType = 'image/png';
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const filename = url.split('/').pop().split('?')[0];
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');
    
    response.data.pipe(res);
  } catch (error) {
    console.error('[PROXY Error]:', error.message);
    res.status(500).json({ success: false, message: 'Download failed' });
  }
});

// Rate limiting untuk anti spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: 'Too many requests' }
});
app.use('/api/', limiter);

// ============ TIKTOK API ENDPOINTS ============
app.post('/api/tiktok/ttmp4', async (req, res) => {
  try {
    const { url, quality } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL required' });

    console.log(`[TikTok MP4] Request: ${url}`);

    const response = await axios.post(`${process.env.API_BASE_URL}/ttmp4`, {
      url: url,
      quality: quality || '1080p'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.API_KEY
      },
      timeout: 30000
    });

    if (response.data && response.data.success) {
      const data = response.data.data;
      const proxyUrl = `/api/download?url=${encodeURIComponent(data.download_url)}&type=mp4`;
      
      res.json({
        success: true,
        data: {
          ...data,
          download_url: proxyUrl,
          preview_url: proxyUrl
        }
      });
    } else {
      throw new Error(response.data?.message || 'Failed to process video');
    }
  } catch (error) {
    console.error('[TikTok MP4 Error]:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/tiktok/ttmp3', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL required' });

    console.log(`[TikTok MP3] Request: ${url}`);

    const response = await axios.post(`${process.env.API_BASE_URL}/ttmp3`, {
      url: url
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.API_KEY
      },
      timeout: 30000
    });

    if (response.data && response.data.success) {
      const data = response.data.data;
      const proxyUrl = `/api/download?url=${encodeURIComponent(data.download_url)}&type=mp3`;
      
      res.json({
        success: true,
        data: {
          ...data,
          download_url: proxyUrl,
          preview_url: proxyUrl
        }
      });
    } else {
      throw new Error(response.data?.message || 'Failed to process audio');
    }
  } catch (error) {
    console.error('[TikTok MP3 Error]:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/tiktok/ttphoto', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL required' });

    console.log(`[TikTok Photo] Request: ${url}`);

    const response = await axios.post(`${process.env.API_BASE_URL}/ttphoto`, {
      url: url
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.API_KEY
      },
      timeout: 30000
    });

    if (response.data && response.data.success) {
      const data = response.data.data;
      
      // Konversi semua image URLs ke proxy
      if (data.images && data.images.length > 0) {
        data.images = data.images.map(img => {
          const filename = img.split('/').pop().split('?')[0];
          const ext = filename.split('.').pop();
          return `/api/download?url=${encodeURIComponent(img)}&type=${ext}`;
        });
      }
      
      res.json({
        success: true,
        data: data
      });
    } else {
      throw new Error(response.data?.message || 'Failed to process slideshow');
    }
  } catch (error) {
    console.error('[TikTok Photo Error]:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// SEO Routes
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Catch all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 TikTok Downloader running on http://localhost:${PORT}`);
  console.log(`🔒 Anti-spam: 50 requests per 15 minutes`);
});