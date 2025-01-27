# 技術環境與開發設定

## 系統需求

### 必要軟體
- Docker Engine
- Docker Compose
- Node.js 18+ (本地開發用)
- Python 3.11（必須使用 3.11 版本，與 demucs 相容）(本地開發用)
- FFmpeg (本地開發用)
- yt-dlp (本地開發用)

### 建議規格
- CPU：建議 4 核心以上
- RAM：最少 8GB
- 硬碟空間：建議預留 10GB 以上

## 開發環境設定

### Docker 部署
```bash
# 建置並啟動所有服務
docker-compose up --build

# 僅啟動現有容器
docker-compose up

# 停止所有服務
docker-compose down

# 查看容器狀態
docker-compose ps
```

### 本地開發環境（可選）

#### 前端開發環境
```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev  # 預設在 http://localhost:5176
```

#### 後端開發環境
```bash
cd server
npm install
node server.js  # 預設在 http://localhost:3006
```

#### Python 環境設定
使用 conda（建議）：
```bash
conda create -n demucs python=3.11
conda activate demucs
pip install demucs
```

## 使用的技術與版本

### 前端技術
- React 18
- Material-UI v6
- React Router v7
- Wavesurfer.js
- Axios
- Vite (開發與建置工具)

### 後端技術
- Express.js
- SQLite
- youtube-dl-exec
- fluent-ffmpeg
- demucs (AI 模型)

## API 端點

### 影片處理
- POST /api/process
  - 輸入：YouTube URL
  - 輸出：處理狀態和結果

### 歷史記錄
- GET /api/history
  - 輸出：已處理的影片清單

### 音訊檔案
- GET /api/audio/:id
  - 輸出：處理後的音訊檔案

## 開發工具建議
- VSCode
- Chrome DevTools
- Postman/Insomnia (API 測試)
- SQLite Browser (資料庫管理)

## 部署相關

### Docker 容器配置
- 前端容器：
  - 基於 nginx:alpine
  - 監聽 80 埠
  - 使用多階段建置優化映像大小

- 後端容器：
  - 基於 node:18-slim
  - 監聽 3006 埠
  - 包含所有必要的系統依賴

### 持久化存儲
- audio-data：音訊檔案存儲
- db-data：SQLite 資料庫存儲

### 環境變數
- NODE_ENV：執行環境 (development/production)
- PORT：後端服務埠號
- FRONTEND_URL：前端網址 (CORS 設定用)

### 建置指令
```bash
# Docker 建置
docker-compose build

# 本地建置（可選）
# 前端建置
npm run build

# 後端建置
cd server && npm run build
```

## 錯誤處理機制

### 前端錯誤處理
- API 錯誤處理
- 使用者輸入驗證
- 狀態管理錯誤處理

### 後端錯誤處理
- 請求驗證
- 檔案系統錯誤處理
- 資料庫錯誤處理
- AI 模型錯誤處理

## 監控與日誌

### 系統監控
- Docker 容器狀態監控
- 系統資源使用率
- API 回應時間
- 錯誤率統計
- 容器健康檢查

### 日誌記錄
- 容器日誌
- 應用程式日誌
- 錯誤日誌
- 存取日誌
- Docker 事件日誌
