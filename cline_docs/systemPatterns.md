# 系統架構與技術決策

## 整體架構
### 前端 (React 應用程式)
- 使用 React 18 構建單頁應用程式
- Material-UI v6 提供 UI 組件
- React Router v7 處理路由
- Wavesurfer.js 實現音訊視覺化
- Axios 處理 API 請求

### 後端 (Express.js 服務)
- Express.js 提供 RESTful API
- SQLite 儲存轉換記錄
- youtube-dl-exec 下載影片
- fluent-ffmpeg 處理音訊
- demucs 執行 AI 人聲分離

## 核心技術決策
1. 使用 React 18
   - 利用最新的並行渲染特性
   - 提供更好的效能和使用者體驗

2. 選擇 SQLite
   - 輕量級、無需額外服務
   - 適合單機部署場景
   - 簡化安裝和維護

3. 採用 htdemucs AI 模型
   - 提供高品質的人聲分離
   - 支援 CPU 和 GPU 處理
   - 開源且持續更新

4. 使用 Material-UI
   - 提供完整的 UI 組件庫
   - 支援響應式設計
   - 內建深色模式

## 系統流程
1. 影片處理流程
   - 驗證 YouTube 網址
   - 下載影片音訊
   - AI 分離人聲/伴奏
   - 儲存處理結果

2. 資料儲存流程
   - 使用 SQLite 儲存記錄
   - 檔案系統儲存音訊檔
   - 自動清理暫存檔案

3. 使用者介面流程
   - 響應式設計適應各種裝置
   - 即時顯示處理進度
   - 提供音訊預覽功能

## 資料庫設計
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

## 目錄結構
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

## 安全考量
1. 輸入驗證
   - 驗證 YouTube 網址格式
   - 檢查影片長度限制
   - 過濾不安全的檔案名稱

2. 資源限制
   - 設定處理時間上限
   - 限制同時處理數量
   - 自動清理暫存檔案

3. 錯誤處理
   - 完整的錯誤捕捉機制
   - 友善的錯誤提示
   - 系統狀態監控
