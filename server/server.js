import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import ffmpeg from 'fluent-ffmpeg';
import youtubeDl from 'youtube-dl-exec';
import net from 'net';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3006;

// Create event emitter for status updates
const statusEmitter = new EventEmitter();

// Create necessary directories
const tempDir = join(__dirname, 'temp');
const outputDir = join(__dirname, 'output');
const dbDir = join(__dirname, 'db');
const dbPath = join(dbDir, 'karaoke.db');

// Ensure necessary directories exist
async function ensureDirectories() {
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(dbDir, { recursive: true });
}

// Initialize database
async function initDatabase() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create conversion record table and playlist related tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL UNIQUE,
      title TEXT,
      duration INTEGER,
      karaoke_path TEXT NOT NULL,
      vocals_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_video_id ON conversions(video_id);

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES conversions(id) ON DELETE CASCADE,
      UNIQUE(playlist_id, song_id)
    );
    CREATE INDEX IF NOT EXISTS idx_playlist_songs ON playlist_songs(playlist_id, position);
  `);

  return db;
}

// Global database connection
let db;

// Configure CORS
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/output', express.static(outputDir));

// SSE route
app.get('/status', cors(corsOptions), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send status updates to client
  const sendStatus = (status) => {
    res.write(`data: ${JSON.stringify(status)}\n\n`);
  };

  statusEmitter.on('statusUpdate', sendStatus);

  // Clean up when client disconnects
  req.on('close', () => {
    statusEmitter.removeListener('statusUpdate', sendStatus);
  });
});

// Function for sending status updates
function sendStatusUpdate(status) {
  statusEmitter.emit('statusUpdate', status);
}

// Extract YouTube video ID
function extractYouTubeVideoId(url) {
  // Process different YouTube URL formats, including more complex YouTube Music URLs
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?(?:music\.youtube\.com\/(?:watch\?v=|embed\/|v\/)?)([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:music\.youtube\.com\/.*?v=)([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  throw new Error('Invalid YouTube video URL');
}

// Download YouTube video
async function downloadYouTube(url, outputPath) {
  try {
    sendStatusUpdate({ message: 'Starting to check video information', url });
    
    // First get video information
    const info = await youtubeDl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    // Check video duration (seconds)
    const duration = info.duration;
    if (duration > 600) { // 10 minutes = 600 seconds
      throw new Error('Video duration exceeds limit');
    }

    sendStatusUpdate({ 
      message: 'Video duration', 
      duration: `${Math.floor(duration / 60)} minutes ${duration % 60} seconds` 
    });
    sendStatusUpdate({ message: 'Starting to download YouTube video' });
    
    // Use youtube-dl-exec to download and show progress
    await youtubeDl(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      output: outputPath,
      noPlaylist: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      addHeader: [
        'referer:youtube.com',
        'origin:youtube.com'
      ],
      progress: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      retries: 3
    }, {
      onProgress: (progress) => {
        if (progress.percent) {
          const percent = (progress.percent * 100).toFixed(1);
          process.stdout.write(`\rDownload progress: ${percent}%`);
        }
      }
    });
    console.log('\n'); // New line

    // Check if file is successfully downloaded
    await fs.access(outputPath);
    sendStatusUpdate({ message: 'YouTube video download completed' });
    
    return outputPath;
  } catch (error) {
    console.error('Error downloading YouTube video:', error);
    throw new Error(`Failed to download YouTube video: ${error.message}`);
  }
}

// Check if demucs is installed
async function checkDemucs() {
  try {
    await execAsync('which demucs');
    return true;
  } catch (error) {
    console.error('Demucs not installed or unable to execute');
    return false;
  }
}

// Separate vocals and accompaniment
async function separateAudio(inputPath, outputPath) {
  try {
    // Check if demucs is installed
    if (!await checkDemucs()) {
      throw new Error('Demucs not installed, please install Demucs first');
    }

    // Use demucs for audio separation
    // -n htdemucs use high quality model
    // --two-stems=vocals separate audio into vocals and accompaniment
    const separatedDir = join(tempDir, 'separated');
    
    // Ensure separated directory is clean
    try {
      await fs.rm(separatedDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore error if directory does not exist
    }
    
    // Use demucs for separation, use htdemucs_ft model, and monitor progress
    sendStatusUpdate({ message: 'Starting audio separation processing...' });
    
    let errorOutput = '';
    const demucsProcess = exec(`demucs "${inputPath}" -n htdemucs --two-stems=vocals --mp3 --out "${separatedDir}"`);
    
    // Monitor demucs output
    demucsProcess.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output; // Collect error output
      
      if (output.includes('Separated track')) {
        sendStatusUpdate({ message: 'Voice separation completed', progress: 50 });
      } else if (output.includes('Applying effects')) {
        sendStatusUpdate({ message: 'Processing audio effects', progress: 75 });
      }
      // Output detailed logs for debugging
      console.log('Demucs output:', output);
    });

    // Monitor standard output
    demucsProcess.stdout.on('data', (data) => {
      console.log('Demucs output:', data.toString());
    });

    // Wait for demucs to complete
    await new Promise((resolve, reject) => {
      demucsProcess.on('close', (code) => {
        if (code === 0) {
          sendStatusUpdate({ message: 'Audio separation completed', progress: 100 });
          resolve();
        } else {
          console.error('Demucs error output:', errorOutput);
          reject(new Error(`Demucs processing failed, error code: ${code}\nError information: ${errorOutput}`));
        }
      });
      
      // Set timeout check
      const timeout = setTimeout(() => {
        demucsProcess.kill();
        reject(new Error('Audio separation processing timeout'));
      }, 1200000); // 10 minutes timeout

      demucsProcess.on('close', () => clearTimeout(timeout));
    });
    
    // Find accompaniment and vocals files
    const trackName = basename(inputPath, '.mp3');
    const accompanimentPath = join(separatedDir, 'htdemucs', trackName, 'no_vocals.mp3');
    const vocalsPath = join(separatedDir, 'htdemucs', trackName, 'vocals.mp3');
    console.log('Accompaniment file path:', accompanimentPath);
    console.log('Vocals file path:', vocalsPath);
    
    // Check if files exist
    try {
      await fs.access(accompanimentPath);
      await fs.access(vocalsPath);
    } catch (error) {
      console.error('Separated audio files not found:', error);
      throw new Error('Audio separation failed');
    }

    // Copy processed mp3 files to output directory
    const vocalsOutputPath = outputPath.replace('_karaoke.mp3', '_vocals.mp3');
    await fs.copyFile(accompanimentPath, outputPath);
    await fs.copyFile(vocalsPath, vocalsOutputPath);
    console.log('Audio files copied successfully');
    
    // Clean up temporary files
    try {
      await fs.rm(separatedDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up temporary files:', error);
    }
    
    return outputPath;
  } catch (error) {
    console.error('Error processing audio:', error);
    // Provide more specific error messages based on error type
    if (error.message.includes('Demucs not installed')) {
      throw new Error(error.message);
    } else if (error.message.includes('Demucs processing failed')) {
      throw new Error(error.message); // Keep full error information, including demucs output
    } else if (error.message.includes('Audio separation timeout')) {
      throw new Error('Audio separation processing took too long, please try again later or choose a shorter video');
    } else {
      throw new Error(`Audio processing failed: ${error.message}`);
    }
  }
}

// Check if video has already been converted
async function checkExistingConversion(videoId) {
  const result = await db.get(
    'SELECT * FROM conversions WHERE video_id = ?',
    videoId
  );
  return result;
}

// Save conversion record
async function saveConversion(videoId, title, duration, karaokePath, vocalsPath) {
  await db.run(
    `INSERT INTO conversions (video_id, title, duration, karaoke_path, vocals_path)
     VALUES (?, ?, ?, ?, ?)`,
    [videoId, title, duration, karaokePath, vocalsPath]
  );
}

// Get all converted videos
// Playlist related APIs
app.get('/playlists', async (req, res) => {
  try {
    const playlists = await db.all(`
      SELECT 
        p.*,
        COUNT(ps.id) as song_count
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    
    // Get songs for each playlist
    for (let playlist of playlists) {
      const songs = await db.all(`
        SELECT 
          c.*,
          ps.position
        FROM playlist_songs ps
        JOIN conversions c ON ps.song_id = c.id
        WHERE ps.playlist_id = ?
        ORDER BY ps.position
      `, playlist.id);
      playlist.songs = songs;
    }
    
    res.json(playlists);
  } catch (error) {
    console.error('Failed to get playlists:', error);
    res.status(500).json({ error: 'Failed to get playlists' });
  }
});

// Update playlist name
app.put('/playlists/:id', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Playlist name cannot be empty' });
    }

    await db.run(
      'UPDATE playlists SET name = ? WHERE id = ?',
      [name, id]
    );
    
    const updatedPlaylist = await db.get(
      'SELECT * FROM playlists WHERE id = ?',
      id
    );
    
    if (!updatedPlaylist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    
    res.json(updatedPlaylist);
  } catch (error) {
    console.error('Failed to update playlist:', error);
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

app.post('/playlists', express.json(), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Playlist name cannot be empty' });
    }

    const result = await db.run(
      'INSERT INTO playlists (name) VALUES (?)',
      name
    );
    
    const playlist = await db.get(
      'SELECT * FROM playlists WHERE id = ?',
      result.lastID
    );
    
    res.json(playlist);
  } catch (error) {
    console.error('Failed to create playlist:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

app.post('/playlists/:playlistId/songs', express.json(), async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { songId } = req.body;
    
    // Get current playlist's maximum position
    const maxPosition = await db.get(
      'SELECT MAX(position) as maxPos FROM playlist_songs WHERE playlist_id = ?',
      playlistId
    );
    const position = (maxPosition.maxPos || 0) + 1;
    
    await db.run(
      'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
      [playlistId, songId, position]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to add song:', error);
    res.status(500).json({ error: 'Failed to add song' });
  }
});

app.delete('/playlists/:playlistId/songs/:songId', async (req, res) => {
  try {
    const { playlistId, songId } = req.params;
    
    await db.run(
      'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
      [playlistId, songId]
    );
    
    // Re-order remaining songs
    const songs = await db.all(
      'SELECT * FROM playlist_songs WHERE playlist_id = ? ORDER BY position',
      playlistId
    );
    
    for (let i = 0; i < songs.length; i++) {
      await db.run(
        'UPDATE playlist_songs SET position = ? WHERE id = ?',
        [i + 1, songs[i].id]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to remove song:', error);
    res.status(500).json({ error: 'Failed to remove song' });
  }
});

app.put('/playlists/:playlistId/songs/reorder', express.json(), async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { fromPosition, toPosition } = req.body;
    
    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    // Get song to move
    const songToMove = await db.get(
      'SELECT id FROM playlist_songs WHERE playlist_id = ? AND position = ?',
      [playlistId, fromPosition]
    );

    if (!songToMove) {
      throw new Error('Song not found');
    }

    if (fromPosition < toPosition) {
      // Move down: Move middle songs up
      await db.run(`
        UPDATE playlist_songs 
        SET position = position - 1 
        WHERE playlist_id = ? 
        AND position > ? 
        AND position <= ?
      `, [playlistId, fromPosition, toPosition]);
    } else {
      // Move up: Move middle songs down
      await db.run(`
        UPDATE playlist_songs 
        SET position = position + 1 
        WHERE playlist_id = ? 
        AND position >= ? 
        AND position < ?
      `, [playlistId, toPosition, fromPosition]);
    }
    
    // Update moved song to target position
    await db.run(`
      UPDATE playlist_songs 
      SET position = ? 
      WHERE id = ?
    `, [toPosition, songToMove.id]);
    
    // Commit transaction
    await db.run('COMMIT');
    
    res.json({ success: true });
  } catch (error) {
    // Rollback transaction
    await db.run('ROLLBACK');
    console.error('Failed to reorder:', error);
    res.status(500).json({ error: 'Failed to reorder' });
  }
});

// Remove song
app.delete('/conversions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First get song information to delete files
    const conversion = await db.get('SELECT * FROM conversions WHERE id = ?', id);
    if (!conversion) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Delete audio files
    // Extract file name from database path
    const karaokeFileName = conversion.karaoke_path.split('/').pop();
    const vocalsFileName = conversion.vocals_path.split('/').pop();
    
    // Build full file path
    const karaokeFile = join(outputDir, karaokeFileName);
    const vocalsFile = join(outputDir, vocalsFileName);
    try {
      await fs.unlink(karaokeFile);
      await fs.unlink(vocalsFile);
    } catch (error) {
      console.error('Failed to delete audio files:', error);
    }

    // Delete database record (related records in playlist_songs table will be automatically deleted due to foreign key constraints)
    await db.run('DELETE FROM conversions WHERE id = ?', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to remove song:', error);
    res.status(500).json({ error: 'Failed to remove song' });
  }
});

app.get('/conversions', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM conversions';
    let params = [];

    if (search) {
      query += ' WHERE title LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    
    const conversions = await db.all(query, params);
    res.json(conversions);
  } catch (error) {
    console.error('Failed to get conversion records:', error);
    res.status(500).json({ error: 'Failed to get conversion records' });
  }
});

// Process YouTube URL route
app.post('/process', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const tempFile = join(tempDir, `${timestamp}.mp3`);
    const outputFile = join(outputDir, `${timestamp}_karaoke.mp3`);

    // Extract video ID
    const videoId = extractYouTubeVideoId(url);
    
    // Check if already converted
    const existing = await checkExistingConversion(videoId);
    if (existing) {
      console.log('Found existing converted video:', videoId);
      return res.json({
        karaokeUrl: existing.karaoke_path,
        vocalsUrl: existing.vocals_path,
        isExisting: true
      });
    }

    // Get video information
    const info = await youtubeDl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    // Download and process video
    await downloadYouTube(url, tempFile);
    await separateAudio(tempFile, outputFile);

    // Save conversion record
    const karaokeUrl = `/output/${timestamp}_karaoke.mp3`;
    const vocalsUrl = `/output/${timestamp}_vocals.mp3`;
    await saveConversion(
      videoId,
      info.title,
      info.duration,
      karaokeUrl,
      vocalsUrl
    );

    // Clean up temporary files
    await fs.unlink(tempFile);

    // Return processed file URL (includes accompaniment and vocals)
    res.json({
      karaokeUrl: `/output/${timestamp}_karaoke.mp3`,
      vocalsUrl: `/output/${timestamp}_vocals.mp3`
    });

  } catch (error) {
    console.error('Error processing request:', error);
    let errorMessage = 'Error occurred during processing';
    
    // Provide more specific error messages based on error type
    if (error.message.includes('Failed to download YouTube video')) {
      errorMessage = 'Failed to download YouTube video, please verify URL is correct or video is available';
    } else if (error.message.includes('Audio separation failed')) {
      errorMessage = 'Voice separation processing failed, please verify audio file format';
    } else if (error.message.includes('Audio separation timeout')) {
      errorMessage = 'Voice separation processing took too long, please try again later or choose a shorter video';
    } else if (error.message.includes('Demucs processing failed')) {
      errorMessage = 'Voice separation engine failed, please try again later';
    } else if (error.message.includes('Invalid YouTube video URL')) {
      errorMessage = 'Please provide a valid YouTube video URL';
    } else if (error.message.includes('Video duration exceeds limit')) {
      errorMessage = 'Video duration exceeds limit, please choose a video under 10 minutes';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message // Provide detailed error message for debugging
    });
  }
});

// Save server instance
let serverInstance = null;

// Start server
async function startServer() {
  // Check if port is in use
  const isPortInUse = async (port) => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(port);
    });
  };

  await ensureDirectories();
  
  // Initialize database
  try {
    db = await initDatabase();
    console.log('Database initialization successful');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
  
  // Check if port is in use
  const portInUse = await isPortInUse(port);
  if (portInUse) {
    console.error(`Error: Port ${port} is already in use`);
    console.error('\nTo find the process using this port, run:');
    if (process.platform === 'darwin') {  // macOS
      console.error(`sudo lsof -i :${port}`);
    } else if (process.platform === 'win32') {  // Windows
      console.error(`netstat -ano | findstr :${port}`);
    } else {  // Linux
      console.error(`sudo netstat -tulpn | grep :${port}`);
    }
    console.error('\nThen use the following command to kill the process (replace PID with the process ID shown above):');
    if (process.platform === 'win32') {
      console.error('taskkill /F /PID <PID>');
    } else {
      console.error('kill -9 <PID>');
    }
    process.exit(1);
  }
  
  return new Promise((resolve, reject) => {
    serverInstance = app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      console.log('Press Ctrl+C to stop the server');
      resolve(serverInstance);
    });

    serverInstance.on('error', (err) => {
      console.error('Server startup failed:', err);
      reject(err);
    });
  });
}

startServer().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
