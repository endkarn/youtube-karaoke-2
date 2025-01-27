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

// 創建事件發射器用於狀態更新
const statusEmitter = new EventEmitter();

// 建立必要的目錄
const tempDir = join(__dirname, 'temp');
const outputDir = join(__dirname, 'output');
const dbDir = join(__dirname, 'db');
const dbPath = join(dbDir, 'karaoke.db');

// 確保必要的目錄存在
async function ensureDirectories() {
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(dbDir, { recursive: true });
}

// 初始化資料庫
async function initDatabase() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // 建立轉換記錄表和歌單相關表
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

// 全域資料庫連接
let db;

// 配置 CORS
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/output', express.static(outputDir));

// SSE 路由
app.get('/status', cors(corsOptions), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 發送狀態更新到客戶端
  const sendStatus = (status) => {
    res.write(`data: ${JSON.stringify(status)}\n\n`);
  };

  statusEmitter.on('statusUpdate', sendStatus);

  // 當客戶端斷開連接時清理
  req.on('close', () => {
    statusEmitter.removeListener('statusUpdate', sendStatus);
  });
});

// 用於發送狀態更新的函數
function sendStatusUpdate(status) {
  statusEmitter.emit('statusUpdate', status);
}

// 提取YouTube影片ID
function extractYouTubeVideoId(url) {
  // 處理不同的YouTube URL格式，包括更複雜的YouTube Music URL
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

  throw new Error('無效的YouTube影片網址');
}

// 下載YouTube影片
async function downloadYouTube(url, outputPath) {
  try {
    sendStatusUpdate({ message: '開始檢查影片資訊', url });
    
    // 先獲取影片資訊
    const info = await youtubeDl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    // 檢查影片時長（秒）
    const duration = info.duration;
    if (duration > 600) { // 10分鐘 = 600秒
      throw new Error('影片時長超過限制');
    }

    sendStatusUpdate({ 
      message: '影片時長', 
      duration: `${Math.floor(duration / 60)}分${duration % 60}秒` 
    });
    sendStatusUpdate({ message: '開始下載YouTube影片' });
    
    // 使用youtube-dl-exec下載，並顯示進度
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
          process.stdout.write(`\r下載進度: ${percent}%`);
        }
      }
    });
    console.log('\n'); // 換行

    // 檢查檔案是否成功下載
    await fs.access(outputPath);
    sendStatusUpdate({ message: 'YouTube影片下載完成' });
    
    return outputPath;
  } catch (error) {
    console.error('下載YouTube影片時發生錯誤:', error);
    throw new Error(`下載YouTube影片失敗: ${error.message}`);
  }
}

// 檢查 demucs 是否已安裝
async function checkDemucs() {
  try {
    await execAsync('which demucs');
    return true;
  } catch (error) {
    console.error('Demucs 未安裝或無法執行');
    return false;
  }
}

// 分離人聲和伴奏
async function separateAudio(inputPath, outputPath) {
  try {
    // 檢查 demucs 是否已安裝
    if (!await checkDemucs()) {
      throw new Error('Demucs 未安裝，請先安裝 Demucs');
    }

    // 使用demucs進行音訊分離
    // -n htdemucs 使用高品質模型
    // --two-stems=vocals 將音訊分離為人聲和伴奏兩個部分
    const separatedDir = join(tempDir, 'separated');
    
    // 確保分離目錄是乾淨的
    try {
      await fs.rm(separatedDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略錯誤，如果目錄不存在
    }
    
    // 使用demucs進行分離，使用htdemucs_ft模型，並監控進度
    sendStatusUpdate({ message: '開始音訊分離處理...' });
    
    let errorOutput = '';
    const demucsProcess = exec(`demucs "${inputPath}" -n htdemucs --two-stems=vocals --mp3 --out "${separatedDir}"`);
    
    // 監控demucs的進度輸出
    demucsProcess.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output; // 收集錯誤輸出
      
      if (output.includes('Separated track')) {
        sendStatusUpdate({ message: '人聲分離完成', progress: 50 });
      } else if (output.includes('Applying effects')) {
        sendStatusUpdate({ message: '正在處理音效', progress: 75 });
      }
      // 輸出詳細日誌以便調試
      console.log('Demucs 輸出:', output);
    });

    // 監控標準輸出
    demucsProcess.stdout.on('data', (data) => {
      console.log('Demucs 輸出:', data.toString());
    });

    // 等待demucs完成
    await new Promise((resolve, reject) => {
      demucsProcess.on('close', (code) => {
        if (code === 0) {
          sendStatusUpdate({ message: '音訊分離完成', progress: 100 });
          resolve();
        } else {
          console.error('Demucs 錯誤輸出:', errorOutput);
          reject(new Error(`Demucs 處理失敗，錯誤碼: ${code}\n錯誤信息: ${errorOutput}`));
        }
      });
      
      // 設置超時檢查
      const timeout = setTimeout(() => {
        demucsProcess.kill();
        reject(new Error('音訊分離處理超時'));
      }, 600000); // 10分鐘超時

      demucsProcess.on('close', () => clearTimeout(timeout));
    });
    
    // 找到伴奏和人聲檔案
    const trackName = basename(inputPath, '.mp3');
    const accompanimentPath = join(separatedDir, 'htdemucs', trackName, 'no_vocals.mp3');
    const vocalsPath = join(separatedDir, 'htdemucs', trackName, 'vocals.mp3');
    console.log('伴奏檔案路徑:', accompanimentPath);
    console.log('人聲檔案路徑:', vocalsPath);
    
    // 檢查檔案是否存在
    try {
      await fs.access(accompanimentPath);
      await fs.access(vocalsPath);
    } catch (error) {
      console.error('找不到分離後的音訊檔案:', error);
      throw new Error('音訊分離失敗');
    }

    // 複製處理好的mp3檔案到輸出目錄
    const vocalsOutputPath = outputPath.replace('_karaoke.mp3', '_vocals.mp3');
    await fs.copyFile(accompanimentPath, outputPath);
    await fs.copyFile(vocalsPath, vocalsOutputPath);
    console.log('音訊檔案複製完成');
    
    // 清理臨時檔案
    try {
      await fs.rm(separatedDir, { recursive: true, force: true });
    } catch (error) {
      console.error('清理臨時檔案失敗:', error);
    }
    
    return outputPath;
  } catch (error) {
    console.error('音訊處理時發生錯誤:', error);
    // 根據錯誤類型提供更具體的錯誤訊息
    if (error.message.includes('Demucs 未安裝')) {
      throw new Error(error.message);
    } else if (error.message.includes('Demucs 處理失敗')) {
      throw new Error(error.message); // 保留完整的錯誤信息，包含 demucs 的輸出
    } else if (error.message.includes('音訊分離處理超時')) {
      throw new Error('音訊分離處理超時，請選擇較短的影片或稍後再試');
    } else {
      throw new Error(`音訊處理失敗: ${error.message}`);
    }
  }
}

// 檢查影片是否已經轉換過
async function checkExistingConversion(videoId) {
  const result = await db.get(
    'SELECT * FROM conversions WHERE video_id = ?',
    videoId
  );
  return result;
}

// 儲存轉換記錄
async function saveConversion(videoId, title, duration, karaokePath, vocalsPath) {
  await db.run(
    `INSERT INTO conversions (video_id, title, duration, karaoke_path, vocals_path)
     VALUES (?, ?, ?, ?, ?)`,
    [videoId, title, duration, karaokePath, vocalsPath]
  );
}

// 獲取所有已轉換的影片
// 歌單相關的 API
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
    
    // 獲取每個歌單的歌曲
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
    console.error('獲取歌單失敗:', error);
    res.status(500).json({ error: '獲取歌單失敗' });
  }
});

// 更新歌單名稱
app.put('/playlists/:id', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '歌單名稱不能為空' });
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
      return res.status(404).json({ error: '找不到指定的歌單' });
    }
    
    res.json(updatedPlaylist);
  } catch (error) {
    console.error('更新歌單失敗:', error);
    res.status(500).json({ error: '更新歌單失敗' });
  }
});

app.post('/playlists', express.json(), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: '歌單名稱不能為空' });
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
    console.error('建立歌單失敗:', error);
    res.status(500).json({ error: '建立歌單失敗' });
  }
});

app.post('/playlists/:playlistId/songs', express.json(), async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { songId } = req.body;
    
    // 獲取目前歌單中最大的 position
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
    console.error('加入歌曲失敗:', error);
    res.status(500).json({ error: '加入歌曲失敗' });
  }
});

app.delete('/playlists/:playlistId/songs/:songId', async (req, res) => {
  try {
    const { playlistId, songId } = req.params;
    
    await db.run(
      'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
      [playlistId, songId]
    );
    
    // 重新排序剩餘歌曲
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
    console.error('移除歌曲失敗:', error);
    res.status(500).json({ error: '移除歌曲失敗' });
  }
});

app.put('/playlists/:playlistId/songs/reorder', express.json(), async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { fromPosition, toPosition } = req.body;
    
    // 開始事務
    await db.run('BEGIN TRANSACTION');
    
    // 獲取要移動的歌曲ID
    const songToMove = await db.get(
      'SELECT id FROM playlist_songs WHERE playlist_id = ? AND position = ?',
      [playlistId, fromPosition]
    );

    if (!songToMove) {
      throw new Error('找不到要移動的歌曲');
    }

    if (fromPosition < toPosition) {
      // 向下移動：將中間的歌曲往上移
      await db.run(`
        UPDATE playlist_songs 
        SET position = position - 1 
        WHERE playlist_id = ? 
        AND position > ? 
        AND position <= ?
      `, [playlistId, fromPosition, toPosition]);
    } else {
      // 向上移動：將中間的歌曲往下移
      await db.run(`
        UPDATE playlist_songs 
        SET position = position + 1 
        WHERE playlist_id = ? 
        AND position >= ? 
        AND position < ?
      `, [playlistId, toPosition, fromPosition]);
    }
    
    // 更新移動的歌曲到目標位置
    await db.run(`
      UPDATE playlist_songs 
      SET position = ? 
      WHERE id = ?
    `, [toPosition, songToMove.id]);
    
    // 提交事務
    await db.run('COMMIT');
    
    res.json({ success: true });
  } catch (error) {
    // 回滾事務
    await db.run('ROLLBACK');
    console.error('重新排序失敗:', error);
    res.status(500).json({ error: '重新排序失敗' });
  }
});

// 刪除歌曲
app.delete('/conversions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 先獲取歌曲資訊，以便刪除檔案
    const conversion = await db.get('SELECT * FROM conversions WHERE id = ?', id);
    if (!conversion) {
      return res.status(404).json({ error: '找不到指定的歌曲' });
    }

    // 刪除音訊檔案
    // 從資料庫路徑中提取檔案名稱
    const karaokeFileName = conversion.karaoke_path.split('/').pop();
    const vocalsFileName = conversion.vocals_path.split('/').pop();
    
    // 構建完整的檔案路徑
    const karaokeFile = join(outputDir, karaokeFileName);
    const vocalsFile = join(outputDir, vocalsFileName);
    try {
      await fs.unlink(karaokeFile);
      await fs.unlink(vocalsFile);
    } catch (error) {
      console.error('刪除音訊檔案失敗:', error);
    }

    // 刪除資料庫記錄（playlist_songs 表中的相關記錄會因為外鍵約束自動刪除）
    await db.run('DELETE FROM conversions WHERE id = ?', id);

    res.json({ success: true });
  } catch (error) {
    console.error('刪除歌曲失敗:', error);
    res.status(500).json({ error: '刪除歌曲失敗' });
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
    console.error('獲取轉換記錄失敗:', error);
    res.status(500).json({ error: '獲取轉換記錄失敗' });
  }
});

// 處理YouTube URL的路由
app.post('/process', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: '需要提供YouTube URL' });
    }

    // 生成唯一的檔案名稱
    const timestamp = Date.now();
    const tempFile = join(tempDir, `${timestamp}.mp3`);
    const outputFile = join(outputDir, `${timestamp}_karaoke.mp3`);

    // 提取影片ID
    const videoId = extractYouTubeVideoId(url);
    
    // 檢查是否已經轉換過
    const existing = await checkExistingConversion(videoId);
    if (existing) {
      console.log('找到已轉換的影片:', videoId);
      return res.json({
        karaokeUrl: existing.karaoke_path,
        vocalsUrl: existing.vocals_path,
        isExisting: true
      });
    }

    // 獲取影片資訊
    const info = await youtubeDl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    // 下載並處理影片
    await downloadYouTube(url, tempFile);
    await separateAudio(tempFile, outputFile);

    // 儲存轉換記錄
    const karaokeUrl = `/output/${timestamp}_karaoke.mp3`;
    const vocalsUrl = `/output/${timestamp}_vocals.mp3`;
    await saveConversion(
      videoId,
      info.title,
      info.duration,
      karaokeUrl,
      vocalsUrl
    );

    // 清理臨時檔案
    await fs.unlink(tempFile);

    // 回傳處理後的檔案URL（包含伴奏和人聲）
    res.json({
      karaokeUrl: `/output/${timestamp}_karaoke.mp3`,
      vocalsUrl: `/output/${timestamp}_vocals.mp3`
    });

  } catch (error) {
    console.error('處理請求時發生錯誤:', error);
    let errorMessage = '處理過程發生錯誤';
    
    // 根據錯誤類型提供更具體的錯誤訊息
    if (error.message.includes('下載YouTube影片失敗')) {
      errorMessage = '下載YouTube影片失敗，請確認網址是否正確或影片是否可用';
    } else if (error.message.includes('音訊分離失敗')) {
      errorMessage = '人聲分離處理失敗，請確認音訊檔案格式是否正確';
    } else if (error.message.includes('音訊分離處理超時')) {
      errorMessage = '人聲分離處理時間過長，請稍後再試或選擇較短的影片';
    } else if (error.message.includes('Demucs 處理失敗')) {
      errorMessage = '人聲分離引擎處理失敗，請稍後再試';
    } else if (error.message.includes('無效的YouTube影片網址')) {
      errorMessage = '請提供有效的YouTube影片網址';
    } else if (error.message.includes('影片時長超過限制')) {
      errorMessage = '影片時長超過限制，請選擇10分鐘以內的影片';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message // 提供詳細的錯誤信息供調試
    });
  }
});

// 儲存伺服器實例
let serverInstance = null;

// 啟動伺服器
async function startServer() {
  // 檢查端口是否被佔用
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
  
  // 初始化資料庫
  try {
    db = await initDatabase();
    console.log('資料庫初始化成功');
  } catch (error) {
    console.error('資料庫初始化失敗:', error);
    process.exit(1);
  }
  
  // 檢查port是否被佔用
  const portInUse = await isPortInUse(port);
  if (portInUse) {
    console.error(`錯誤: Port ${port} 已被佔用`);
    console.error('\n要找出占用端口的進程，請執行以下命令：');
    if (process.platform === 'darwin') {  // macOS
      console.error(`sudo lsof -i :${port}`);
    } else if (process.platform === 'win32') {  // Windows
      console.error(`netstat -ano | findstr :${port}`);
    } else {  // Linux
      console.error(`sudo netstat -tulpn | grep :${port}`);
    }
    console.error('\n然後使用以下命令關閉進程（將 PID 替換為上面命令顯示的進程 ID）：');
    if (process.platform === 'win32') {
      console.error('taskkill /F /PID <PID>');
    } else {
      console.error('kill -9 <PID>');
    }
    process.exit(1);
  }
  
  return new Promise((resolve, reject) => {
    serverInstance = app.listen(port, () => {
      console.log(`伺服器運行在 http://localhost:${port}`);
      console.log('按下 Ctrl+C 可以停止伺服器');
      resolve(serverInstance);
    });

    serverInstance.on('error', (err) => {
      console.error('伺服器啟動失敗:', err);
      reject(err);
    });
  });
}

startServer().catch((error) => {
  console.error('啟動伺服器時發生錯誤:', error);
  process.exit(1);
});
