// ========================================
// SOLDOWN - Backend Server
// ========================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const ytdl = require('ytdl-core');
const ytdlp = require('youtube-dl-exec');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
require('dotenv').config();

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Force no-cache for all served assets in dev
app.use((req, res, next) => {
   res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
   res.set('Pragma', 'no-cache');
   next();
});
app.use(express.static(path.join(__dirname, '../public'), {maxAge: 0}));

// Helper function to get video info (prefer yt-dlp for multi-site)
async function getVideoInfo(url) {
    try {
        // Check if running on Vercel or serverless environment
        if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
            // For serverless, use ytdl-core for YouTube only
            if (ytdl.validateURL(url)) {
                const info = await ytdl.getInfo(url);
                const formats = info.formats
                    .filter(f => f.hasVideo && f.hasAudio && f.container === 'mp4')
                    .map(f => ({
                        format: f.container.toUpperCase(),
                        quality: f.qualityLabel || `${f.height}p`,
                        codec: `${f.videoCodec || ''} + ${f.audioCodec || ''}`.trim(),
                        size: f.contentLength ? formatApproxSize(parseInt(f.contentLength)) : 'N/A',
                        itag: f.itag,
                        type: 'video'
                    }));
                
                return {
                    title: info.videoDetails.title,
                    duration: parseInt(info.videoDetails.lengthSeconds),
                    formats,
                    platform: 'youtube'
                };
            } else {
                throw new Error('Non-YouTube videos require a VPS/dedicated server');
            }
        } else {
            // Use yt-dlp for broad site support (VPS/dedicated server)
            const info = await ytdlp(url, {
                dumpSingleJson: true,
                noWarnings: true,
                noCheckCertificates: true,
                preferFreeFormats: true,
                ffmpegLocation: ffmpegPath || undefined
            });

            const rawFormats = Array.isArray(info.formats) ? info.formats : [];
            // Keep only formats that have video and some audio path (either acodec present or can be merged)
            const withVideo = rawFormats.filter(f => (f.vcodec || 'none') !== 'none');
            // Prefer MP4 first
            const sorted = [
                ...withVideo.filter(f => (f.ext || '').toLowerCase() === 'mp4' && (f.acodec || 'none') !== 'none'),
                ...withVideo.filter(f => (f.ext || '').toLowerCase() === 'mp4' && (f.acodec || 'none') === 'none'),
                ...withVideo.filter(f => (f.ext || '').toLowerCase() !== 'mp4')
            ];

            const mapped = sorted.map(f => ({
                format: (f.ext || 'mp4').toUpperCase(),
                quality: f.format_note || (f.height ? `${f.height}p` : 'video'),
                codec: `${f.vcodec || ''}${f.acodec ? ` + ${f.acodec}` : ''}`.trim() || 'unknown',
                size: f.filesize ? formatApproxSize(f.filesize) : (f.filesize_approx ? formatApproxSize(f.filesize_approx) : (info.duration && f.tbr ? formatApproxSize((f.tbr * 1000 / 8) * info.duration) : 'N/A')),
                itag: f.format_id || '',
                type: 'video'
            }));

            return {
                title: info.title || 'Video',
                duration: info.duration || 0,
                formats: mapped,
                platform: info.extractor || 'generic'
            };
        }

    } catch (error) {
        throw new Error(`Failed to get video info: ${error.message}`);
    }
}

// Helper function to format file size
function formatApproxSize(bytes) {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'SOLDOWN API is running' });
});

// Analyze video URL
app.post('/api/analyze', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate URL
        let isValid = false;

        // Check YouTube
        if (ytdl.validateURL(url)) {
            isValid = true;
        } else {
            // Check other supported platforms
            try {
                const urlObj = new URL(url);
                const supportedDomains = [
                    'youtube.com', 'youtu.be',
                    'vimeo.com',
                    'twitter.com', 'x.com',
                    'instagram.com',
                    'tiktok.com',
                    'fb.com', 'facebook.com'
                ];
                isValid = supportedDomains.some(domain => urlObj.hostname.includes(domain));
            } catch (e) {
                isValid = false;
            }
        }

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid or unsupported URL' });
        }

        // Get video info
        const videoInfo = await getVideoInfo(url);

        // Add MP3 option for video formats
        const mp3Formats = videoInfo.formats.map(f => ({
            format: 'MP3',
            quality: f.quality || 'Audio',
            codec: 'AAC → MP3',
            size: 'N/A', // Size will be known after conversion
            itag: f.itag || 'audio',
            type: 'audio'
        }));

        // Combine video and audio formats
        const allFormats = [
            ...videoInfo.formats,
            ...mp3Formats
        ];

        res.json({
            success: true,
            title: videoInfo.title,
            duration: videoInfo.duration,
            formats: allFormats,
            platform: videoInfo.platform
        });

    } catch (error) {
        console.error('Error analyzing URL:', error);
        res.status(500).json({ error: error.message || 'Failed to analyze URL' });
    }
});

// Download video or audio
app.post('/api/download', async (req, res) => {
    try {
        const { url, format, quality, itag, formatType } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const isMP3 = formatType === 'mp3';

        // Check if running on Vercel or serverless environment
        if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
            // For Vercel/serverless, use ytdl-core for YouTube
            if (ytdl.validateURL(url)) {
                try {
                    const info = await ytdl.getInfo(url);
                    const selectedFormat = info.formats.find(f => f.itag == itag) || 
                                          info.formats.find(f => f.hasVideo && f.hasAudio) ||
                                          info.formats[0];
                    
                    if (isMP3) {
                        // Extract audio as MP3
                        const audioStream = ytdl.downloadFromInfo(info, { format: selectedFormat });
                        
                        res.setHeader('Content-Disposition', `attachment; filename="${info.videoDetails.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.mp3"`);
                        res.setHeader('Content-Type', 'audio/mpeg');
                        
                        // Convert to MP3 using ffmpeg
                        ffmpeg(audioStream)
                            .audioBitrate(128)
                            .audioCodec('libmp3lame')
                            .format('mp3')
                            .on('error', (err) => {
                                console.error('FFmpeg error:', err);
                                if (!res.headersSent) res.status(500).json({ error: 'Audio conversion failed' });
                            })
                            .pipe(res, { end: true });
                    } else {
                        // Download video as MP4
                        const stream = ytdl.downloadFromInfo(info, { format: selectedFormat });
                        
                        res.setHeader('Content-Disposition', `attachment; filename="${info.videoDetails.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.mp4"`);
                        res.setHeader('Content-Type', 'video/mp4');
                        
                        stream.pipe(res);
                    }
                } catch (error) {
                    console.error('YouTube download error:', error);
                    res.status(500).json({ error: 'Download failed. Please try a different quality.' });
                }
            } else {
                res.status(500).json({ 
                    error: 'Non-YouTube videos are not supported on serverless platforms. Please use YouTube URLs only, or deploy to a VPS/dedicated server for full support.' 
                });
            }
        } else {
            // Use yt-dlp for broad site support (VPS/dedicated server)
            let chosenFormat, outputFormat, fileExtension, contentType;
            
            if (isMP3) {
                // Extract audio as MP3
                chosenFormat = 'bestaudio/best';
                outputFormat = 'mp3';
                fileExtension = 'mp3';
                contentType = 'audio/mpeg';
            } else {
                // Download video as MP4
                chosenFormat = itag || 'bestvideo+bestaudio[ext=mp4]/best[ext=mp4]/best';
                outputFormat = 'mp4';
                fileExtension = 'mp4';
                contentType = 'video/mp4';
            }
            
            res.setHeader('Content-Disposition', `attachment; filename="video.${fileExtension}"`);
            res.setHeader('Content-Type', contentType);

            const ytdlpOptions = isMP3 ? {
                f: chosenFormat,
                x: true, // Extract audio
                o: '-',
                ffmpegLocation: ffmpegPath || undefined,
                audioFormat: 'mp3',
                audioQuality: '0' // Best quality
            } : {
                f: chosenFormat,
                o: '-',
                ffmpegLocation: ffmpegPath || undefined,
                mergeOutputFormat: 'mp4',
                noPart: true,
                remuxVideo: 'mp4'
            };

            const proc = ytdlp.exec(url, ytdlpOptions, { shell: true, maxBuffer: 1024 * 1024 * 64 });

            proc.stdout.pipe(res);
            proc.stderr.on('data', () => { });
            proc.on('error', (err) => {
                console.error('yt-dlp error:', err);
                if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
            });
        }

    } catch (error) {
        console.error('Error downloading:', error);
        res.status(500).json({ error: error.message || 'Download failed' });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Start server with port auto-fallback
function startServer(initialPort, attemptsLeft = 10) {
    const server = app.listen(initialPort, () => {
        console.log(`🚀 SOLDOWN server running on http://localhost:${initialPort}`);
        console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`⚠️  Legal Notice: This service is for personal, non-copyrighted content only`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
            const nextPort = initialPort + 1;
            console.warn(`Port ${initialPort} in use, trying ${nextPort}...`);
            startServer(nextPort, attemptsLeft - 1);
        } else {
            console.error('Failed to start server:', err);
            process.exit(1);
        }
    });
}

startServer(Number(PORT));
