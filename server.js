require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ SECURITY & PERFORMANCE ============
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "http:", "https://p16-common-sign.tiktokcdn-us.com", "https://p19-common-sign.tiktokcdn-us.com"],
      connectSrc: ["'self'", "https://api.danuxy.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  }
}));

app.use(compression({ level: 9, threshold: 0 }));
app.use(cors());
app.use(express.json());

// Static files dengan cache
app.use(express.static('public', {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
  }
}));

// ============ RATE LIMITING (Anti Spam & Anti DDOS) ============
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 50,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// IP-based rate limiting untuk extra protection
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many requests from this IP.' }
});
app.use('/api/', globalLimiter);

// ============ PROXY DOWNLOAD (CORS bypass) ============
app.get('/api/download', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, message: 'URL required' });
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 60000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const filename = url.split('/').pop().split('?')[0];
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Download failed' });
  }
});

// ============ API ENDPOINTS ============
// TikTok Video Download (MP4)
app.post('/api/tiktok/ttmp4', async (req, res) => {
  try {
    const { url, quality } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    console.log(`[TikTok MP4] Request: ${url}, Quality: ${quality || '1080p'}`);

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
      const proxyUrl = `/api/download?url=${encodeURIComponent(data.download_url)}`;
      
      res.json({
        success: true,
        data: {
          ...data,
          download_url: proxyUrl
        }
      });
    } else {
      throw new Error(response.data?.message || 'Failed to process video');
    }
  } catch (error) {
    console.error('[TikTok MP4 Error]:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to process video' });
  }
});

// TikTok Audio Download (MP3)
app.post('/api/tiktok/ttmp3', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

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
      const proxyUrl = `/api/download?url=${encodeURIComponent(data.download_url)}`;
      
      res.json({
        success: true,
        data: {
          ...data,
          download_url: proxyUrl
        }
      });
    } else {
      throw new Error(response.data?.message || 'Failed to process audio');
    }
  } catch (error) {
    console.error('[TikTok MP3 Error]:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to process audio' });
  }
});

// TikTok Photo/Slideshow Download
app.post('/api/tiktok/ttphoto', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

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
      res.json(response.data);
    } else {
      throw new Error(response.data?.message || 'Failed to process slideshow');
    }
  } catch (error) {
    console.error('[TikTok Photo Error]:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to process slideshow' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), service: 'TikTok Downloader' });
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
  console.log(`🚀 Danuxy Studio TikTok Downloader running on http://localhost:${PORT}`);
  console.log(`🔒 Anti-spam: ${process.env.RATE_LIMIT_MAX_REQUESTS} requests per ${process.env.RATE_LIMIT_WINDOW_MS/1000}s`);
  console.log(`📹 Endpoints: /api/tiktok/ttmp4, /api/tiktok/ttmp3, /api/tiktok/ttphoto`);
});