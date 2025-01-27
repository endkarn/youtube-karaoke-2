# YouTube 卡拉 OK 轉換器

這是一個強大的網頁應用程式，能夠將 YouTube 影片轉換成卡拉 OK 伴奏。應用程式會自動下載 YouTube 影片的音訊，並使用先進的 AI 模型將人聲和伴奏分離，讓您輕鬆取得高品質的卡拉 OK 伴奏。

本專案是基於 Anthropic 的 Claude AI 助手以及 Cline 開發環境製作。Cline 是一個創新的 AI 開發環境，它使用了 Memory Bank 系統來維護完整的專案文檔，確保開發過程的連續性和可追蹤性。透過 Cline 的 Memory Bank，本專案保持了完整的開發歷程記錄和技術文檔，讓開發過程更加透明且易於維護。

## 功能特色

- 🎵 支援任何 YouTube 影片網址（包含一般 YouTube 和 YouTube Music）
- 🎼 使用先進的 AI 模型（htdemucs）進行人聲分離
- 🎹 同時提供伴奏和人聲音檔
- 💾 自動儲存轉換記錄，避免重複處理
- 📱 響應式設計，支援各種裝置
- 🌙 內建深色模式
- ⚡ 即時處理狀態更新

## 系統需求

### 使用 Docker 部署（推薦）
- Docker Engine
- Docker Compose

### 本地開發環境（可選）
- Node.js 18+ 
- Python 3.11（注意：必須使用 3.11 版本，與 demucs 相容）
- FFmpeg
- yt-dlp

### 建議規格
- CPU：建議 4 核心以上
- RAM：最少 8GB
- 硬碟空間：建議預留 10GB 以上的可用空間

## 安裝與部署

### Docker 部署（推薦）

1. 系統需求：
- Linux 伺服器（建議 Ubuntu 20.04 LTS 或更新版本）
- Docker Engine
- Docker Compose
- 至少 2GB RAM（建議 4GB 以上）
- 至少 20GB 可用硬碟空間

2. 安裝 Docker 環境：
```bash
# 安裝 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安裝 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

3. 下載並部署專案：
```bash
# 下載專案
git clone [你的專案 URL]
cd youtube-karaoke

# 首次啟動或需要重新建置時
docker-compose up --build -d

# 後續啟動（如果沒有修改 Dockerfile）
docker-compose up -d

# 停止服務
docker-compose down
```

### 本地開發環境（可選）

1. 安裝基礎依賴：
```bash
# 安裝前端依賴
npm install

# 安裝後端依賴
cd server
npm install
```

2. 設定 Python 環境：
使用 conda（建議）：
```bash
# 建立新的 Python 3.11 環境
conda create -n demucs python=3.11

# 啟動環境
conda activate demucs

# 安裝 demucs
pip install demucs
```

3. 啟動服務：
```bash
# 啟動前端開發伺服器（在專案根目錄執行）
conda activate demucs && npm run dev

# 啟動後端伺服器（在另一個終端機視窗中執行）
cd server
node server.js
```

## 使用說明

1. 開啟應用程式網頁（http://localhost:5176）
2. 將 YouTube 影片網址貼入輸入框
3. 點擊「開始處理」按鈕
4. 等待處理完成（可以看到即時進度更新）
5. 處理完成後可以：
   - 播放/下載伴奏版本
   - 播放/下載人聲版本
   - 查看歷史轉換記錄

## 使用限制

- 影片長度上限：10 分鐘
- 處理時間上限：10 分鐘
- 支援的 YouTube 網址格式：
  - 一般影片：youtube.com/watch?v=...
  - 短網址：youtu.be/...
  - YouTube Music：music.youtube.com/...

## 技術架構

### 前端技術
- React 18
- Material-UI v6
- React Router v7
- Wavesurfer.js（音訊視覺化）
- Axios（API 請求）

### 後端技術
- Express.js
- SQLite（儲存轉換記錄）
- youtube-dl-exec（影片下載）
- fluent-ffmpeg（音訊處理）
- demucs（AI 人聲分離）

### 音訊處理
- 使用 htdemucs 模型進行人聲分離
- 輸出格式：MP3
- 分離模式：two-stems（人聲/伴奏）

## 錯誤處理

應用程式會處理以下常見問題：
- 無效的 YouTube 網址
- 影片長度超過限制
- 下載失敗或網路問題
- 音訊處理失敗
- 系統資源不足

## 開發者說明

### 目錄結構
```
youtube-karaoke/
├── src/                # 前端源碼
│   ├── components/     # React 組件
│   └── assets/         # 靜態資源
├── server/             # 後端源碼
│   ├── db/            # SQLite 資料庫
│   └── output/        # 輸出音檔
└── public/            # 靜態檔案
```

### 資料庫結構
```sql
CREATE TABLE conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL UNIQUE,
  title TEXT,
  duration INTEGER,
  karaoke_path TEXT NOT NULL,
  vocals_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 授權說明

本專案僅供個人學習和研究使用。使用本工具時請遵守：
- YouTube 服務條款
- 音樂著作權法規
- 開源軟體授權規範


## 貢獻指南

歡迎提交 Issue 和 Pull Request 來改善專案。提交時請：
1. 清楚描述問題或改善建議
2. 提供重現問題的步驟（如果適用）
3. 確保程式碼符合專案的程式碼風格
4. 新增適當的測試（如果適用）
