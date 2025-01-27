import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import WaveSurfer from 'wavesurfer.js'
import YouTube from 'react-youtube'
import {
  Container,
  Box,
  Typography,
  IconButton,
  Slider,
  Paper,
  Button,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import MicIcon from '@mui/icons-material/Mic'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import PlaylistDialog from './PlaylistDialog'
import PlaylistSidebar from './PlaylistSidebar'
import { usePlaylist } from '../contexts/PlaylistContext'

const API_BASE_URL = 'http://localhost:3006'

function VideoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [videoData, setVideoData] = useState(null)
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false)
  const [hasPlaylistParam, setHasPlaylistParam] = useState(false)
  const { currentPlaylist, currentSongIndex, playNextSong, startPlaylist } = usePlaylist()
  
  // 從 URL 讀取歌單 ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const playlistId = params.get('playlist')
    if (playlistId) {
      setHasPlaylistParam(true)
      startPlaylist(parseInt(playlistId))
    } else {
      setHasPlaylistParam(false)
    }
  }, [startPlaylist, window.location.search])
  
  const [audioStates, setAudioStates] = useState({
    isPlaying: false,
    vocalsVolume: 0.5,
    karaokeVolume: 1,
    vocalsMuted: false,
    karaokeMuted: false,
    currentTime: '0:00',
    duration: '0:00',
    currentSeconds: 0
  })
  
  const wavesurferRef = useRef({})
  const youtubePlayerRef = useRef(null)

  useEffect(() => {
    // 更新頁面標題
    if (videoData) {
      document.title = `${videoData.title} － YouTube 卡拉OK 轉換器`;
    }
  }, [videoData]);

  useEffect(() => {
    // 載入影片資料
    const fetchVideoData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/conversions`)
        if (response.ok) {
          const data = await response.json()
          const video = data.find(v => v.id === parseInt(id))
          if (video) {
            setVideoData(video)
          }
        }
      } catch (error) {
        console.error('載入影片資料失敗:', error)
      }
    }

    fetchVideoData()

    // 清理
    return () => {
      if (wavesurferRef.current.vocals) {
        wavesurferRef.current.vocals.destroy()
      }
      if (wavesurferRef.current.karaoke) {
        wavesurferRef.current.karaoke.destroy()
      }
    }
  }, [id])

  // 當 videoData 更新且 DOM 已渲染完成後，初始化 WaveSurfer
  useEffect(() => {
    if (!videoData) return;

    // 使用 requestAnimationFrame 確保 DOM 已更新
    const initTimer = requestAnimationFrame(async () => {
      console.log('開始初始化 WaveSurfer...');
      try {
        await initializeWaveSurfer(videoData);
        console.log('WaveSurfer 初始化完成');
      } catch (error) {
        console.error('WaveSurfer 初始化失敗:', error);
      }
    });

    return () => cancelAnimationFrame(initTimer);
  }, [videoData]);

  // 格式化時間
  const formatTime = (time) => {
    if (!time) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const initializeWaveSurfer = async (video) => {
    try {
      // 等待 DOM 元素準備好
      await new Promise(resolve => setTimeout(resolve, 100));

      // 檢查容器元素是否存在
      const vocalsContainer = document.querySelector('#vocals-waveform');
      const karaokeContainer = document.querySelector('#karaoke-waveform');
      
      if (!vocalsContainer || !karaokeContainer) {
        console.error('找不到波形圖容器元素');
        return;
      }

      // 創建人聲波形實例
      const vocalsWavesurfer = WaveSurfer.create({
        container: vocalsContainer,
        waveColor: '#9c27b0',
        progressColor: '#6a0080',
        barWidth: 3,
        barHeight: 0.8,
        barGap: 2,
        cursorWidth: 1,
        cursorColor: '#6a0080',
        interact: true,
        responsive: true,
        height: 100,
        normalize: true,
      })

      // 創建伴奏波形實例
      const karaokeWavesurfer = WaveSurfer.create({
        container: karaokeContainer,
        waveColor: '#2196f3',
        progressColor: '#0069c0',
        barWidth: 3,
        barHeight: 0.8,
        barGap: 2,
        cursorWidth: 1,
        cursorColor: '#0069c0',
        interact: true,
        responsive: true,
        height: 100,
        normalize: true,
      })

      // 載入音頻
      await Promise.all([
        vocalsWavesurfer.load(`${API_BASE_URL}${video.vocals_path}`),
        karaokeWavesurfer.load(`${API_BASE_URL}${video.karaoke_path}`)
      ]).catch(error => {
        console.error('載入音頻檔案失敗:', error);
        return;
      });

      // 保存實例
      wavesurferRef.current = {
        vocals: vocalsWavesurfer,
        karaoke: karaokeWavesurfer
      }

      // 設置音訊播放器的事件監聽
      const wavesurfers = [vocalsWavesurfer, karaokeWavesurfer]
      wavesurfers.forEach(wavesurfer => {
        wavesurfer.on('ready', () => {
          // 音訊載入完成後，設置初始音量和總時長
          wavesurfer.setVolume(wavesurfer === vocalsWavesurfer ? 0.5 : 1)
          const duration = wavesurfer.getDuration()
          setAudioStates(prev => ({
            ...prev,
            duration: formatTime(duration)
          }))
        })

        // 允許點擊波形來跳轉，同時更新所有播放進度
        wavesurfer.on('seek', () => {
          if (youtubePlayerRef.current) {
            const currentTime = wavesurfer.getCurrentTime()
            youtubePlayerRef.current.seekTo(currentTime, true)
            setAudioStates(prev => ({
              ...prev,
              currentSeconds: currentTime,
              currentTime: formatTime(currentTime)
            }))
          }
        })

        // 監聽播放進度變化
        wavesurfer.on('timeupdate', () => {
          const currentTime = wavesurfer.getCurrentTime()
          setAudioStates(prev => ({
            ...prev,
            currentSeconds: currentTime,
            currentTime: formatTime(currentTime)
          }))
        })
      })
    } catch (error) {
      console.error('初始化 WaveSurfer 失敗:', error)
    }
  }

  // YouTube 播放器控制
  const handleYouTubeStateChange = (event) => {
    const wavesurfers = wavesurferRef.current
    if (!wavesurfers.vocals || !wavesurfers.karaoke) return

    // YouTube 播放器狀態：
    // -1 (未開始) 0 (結束) 1 (播放中) 2 (暫停) 3 (緩衝中) 5 (已插入影片)
    switch (event.data) {
      case 1: // 播放中
        wavesurfers.vocals.play()
        wavesurfers.karaoke.play()
        setAudioStates(prev => ({ 
          ...prev, 
          isPlaying: true,
          currentTime: formatTime(event.target.getCurrentTime()),
          duration: formatTime(event.target.getDuration()),
          currentSeconds: event.target.getCurrentTime()
        }))
        break
      case 2: // 暫停
        wavesurfers.vocals.pause()
        wavesurfers.karaoke.pause()
        setAudioStates(prev => ({ 
          ...prev, 
          isPlaying: false,
          currentTime: formatTime(event.target.getCurrentTime()),
          currentSeconds: event.target.getCurrentTime()
        }))
        break
      case 3: // 緩衝中
        wavesurfers.vocals.pause()
        wavesurfers.karaoke.pause()
        break
      case 0: // 結束
        wavesurfers.vocals.pause()
        wavesurfers.karaoke.pause()
        setAudioStates(prev => ({ 
          ...prev, 
          isPlaying: false,
          currentTime: formatTime(event.target.getDuration()),
          currentSeconds: event.target.getDuration()
        }))
        
        // 如果正在播放歌單，自動播放下一首
        if (currentPlaylist) {
          const nextSong = playNextSong()
          if (nextSong) {
            navigate(`/video/${nextSong.id}?playlist=${currentPlaylist.id}`)
          }
        }
        break
    }
  }

  // 定期同步音訊與影片時間
  useEffect(() => {
    let animationFrameId
    let lastSyncTime = 0

    const updateProgress = () => {
      if (!youtubePlayerRef.current || !audioStates.isPlaying) {
        return
      }

      try {
        const youtubeTime = youtubePlayerRef.current.getCurrentTime()
        const duration = youtubePlayerRef.current.getDuration()

        // 更新進度條和時間顯示
        setAudioStates(prev => ({
          ...prev,
          currentTime: formatTime(youtubeTime),
          duration: formatTime(duration),
          currentSeconds: youtubeTime
        }))

        // 音訊同步邏輯
        const wavesurfers = wavesurferRef.current
        if (wavesurfers.vocals?.isReady && wavesurfers.karaoke?.isReady) {
          const now = Date.now()
          if (now - lastSyncTime > 100) {
            wavesurfers.vocals.setCurrentTime(youtubeTime)
            wavesurfers.karaoke.setCurrentTime(youtubeTime)
            lastSyncTime = now
          }
        }
      } catch (error) {
        console.warn('更新進度時發生錯誤:', error)
      }

      // 確保下一幀的更新
      animationFrameId = window.requestAnimationFrame(updateProgress)
    }

    // 開始更新循環
    animationFrameId = window.requestAnimationFrame(updateProgress)

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [audioStates.isPlaying])

  const togglePlayback = () => {
    if (!youtubePlayerRef.current) return
    
    if (audioStates.isPlaying) {
      youtubePlayerRef.current.pauseVideo()
    } else {
      youtubePlayerRef.current.playVideo()
    }
  }

  const handleVolumeChange = (track, value) => {
    const wavesurfers = wavesurferRef.current
    if (!wavesurfers.vocals || !wavesurfers.karaoke) return

    if (track === 'vocals') {
      wavesurfers.vocals.setVolume(value)
      setAudioStates(prev => ({ ...prev, vocalsVolume: value }))
    } else {
      wavesurfers.karaoke.setVolume(value)
      setAudioStates(prev => ({ ...prev, karaokeVolume: value }))
    }
  }

  const toggleMute = (track) => {
    const wavesurfers = wavesurferRef.current
    if (!wavesurfers.vocals || !wavesurfers.karaoke) return

    if (track === 'vocals') {
      const newVocalsMuted = !audioStates.vocalsMuted
      wavesurfers.vocals.setVolume(newVocalsMuted ? 0 : audioStates.vocalsVolume)
      setAudioStates(prev => ({
        ...prev,
        vocalsMuted: newVocalsMuted
      }))
    } else {
      const newKaraokeMuted = !audioStates.karaokeMuted
      wavesurfers.karaoke.setVolume(newKaraokeMuted ? 0 : audioStates.karaokeVolume)
      setAudioStates(prev => ({
        ...prev,
        karaokeMuted: newKaraokeMuted
      }))
    }
  }

  if (!videoData) {
    return (
      <Container 
      maxWidth="lg" 
      disableGutters={false}
      sx={{
        px: { xs: 2, sm: 3, md: 4 }
      }}
    >
        <Box sx={{ my: 4 }}>
          <Typography>載入中...</Typography>
        </Box>
      </Container>
    )
  }

  return (
    <Container 
      maxWidth="lg" 
      disableGutters={false}
      sx={{ 
        mt: { xs: 2, sm: 3, md: 4 },
        px: { xs: 2, sm: 3, md: 4 }
      }}
    >
      {/* 影片區域 */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h5">
                <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                  YouTube 卡拉OK
                </Link>
                {' － '}{videoData.title}
              </Typography>
            </Box>
            <Box>
              <Button
                variant="contained"
                startIcon={<PlaylistAddIcon />}
                onClick={() => setPlaylistDialogOpen(true)}
              >
                加入歌單
              </Button>
            </Box>
          </Box>
          
          <Box sx={{ 
            mt: { xs: 1, sm: 2 }, 
            mb: { xs: 2, sm: 3 }, 
            width: '100%',
            position: 'relative',
            paddingTop: '56.25%' // 16:9 比例
          }}>
            <YouTube
              videoId={videoData.video_id}
              opts={{
                height: '100%',
                width: '100%',
                playerVars: {
                  autoplay: 0,
                  controls: 0,
                  mute: 1,
                },
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'
              }}
              onReady={(event) => {
                youtubePlayerRef.current = event.target
                // 設置 YouTube 音量為 0（因為我們使用分離的音軌）
                event.target.setVolume(0)
                // 設置總時長
                const duration = event.target.getDuration()
                setAudioStates(prev => ({
                  ...prev,
                  duration: formatTime(duration)
                }))
              }}
              onStateChange={handleYouTubeStateChange}
            />
          </Box>

      </Paper>

      {/* 控制區域 */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3 
      }}>
        {/* 左側主欄：播放控制和音軌 */}
        <Paper elevation={3} sx={{ 
          p: 3, 
          flex: '1 1 auto',
          order: { xs: 1, md: 1 }
        }}>
          <Box>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              mb: { xs: 1, sm: 2 } 
            }}>
              <IconButton 
                size="large" 
                onClick={togglePlayback}
                sx={{ backgroundColor: 'primary.main', color: 'white', '&:hover': { backgroundColor: 'primary.dark' } }}
              >
                {audioStates.isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>
              <Box sx={{ flex: 1, mx: 2 }}>
                <Slider
                  value={audioStates.currentSeconds}
                  min={0}
                  max={youtubePlayerRef.current ? youtubePlayerRef.current.getDuration() : 100}
                  onChange={(_, value) => {
                    const wavesurfers = wavesurferRef.current;
                    if (wavesurfers.vocals && wavesurfers.karaoke) {
                      // 先更新 WaveSurfer 的進度
                      wavesurfers.vocals.seekTo(value / youtubePlayerRef.current.getDuration());
                      wavesurfers.karaoke.seekTo(value / youtubePlayerRef.current.getDuration());
                    }
                    // 再更新 YouTube 播放器的進度
                    if (youtubePlayerRef.current) {
                      youtubePlayerRef.current.seekTo(value, true);
                    }
                    // 更新進度條狀態
                    setAudioStates(prev => ({
                      ...prev,
                      currentSeconds: value,
                      currentTime: formatTime(value)
                    }));
                  }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100, textAlign: 'right' }}>
                {audioStates.currentTime} / {audioStates.duration}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mb: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" gutterBottom>
              伴奏音樂（無人聲）
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <MusicNoteIcon sx={{ mr: 1 }} />
              <IconButton 
                onClick={() => toggleMute('karaoke')}
                color={audioStates.karaokeMuted ? "primary" : "default"}
              >
                {audioStates.karaokeMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
              </IconButton>
              <Slider
                value={audioStates.karaokeVolume}
                onChange={(e, newValue) => handleVolumeChange('karaoke', newValue)}
                min={0}
                max={1}
                step={0.01}
                sx={{ width: '200px', mx: 2 }}
              />
            </Box>
            <Box>
              <Box 
                id="karaoke-waveform"
                sx={{ 
                  width: '100%', 
                  height: { xs: '80px', sm: '100px' }, 
                  backgroundColor: '#f5f5f5',
                  '& wave': { backgroundColor: '#f5f5f5' }
                }}
              />
            </Box>
          </Box>
          
          <Box sx={{ mb: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" gutterBottom>
              人聲音軌
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <MicIcon sx={{ mr: 1 }} />
              <IconButton 
                onClick={() => toggleMute('vocals')}
                color={audioStates.vocalsMuted ? "primary" : "default"}
              >
                {audioStates.vocalsMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
              </IconButton>
              <Slider
                value={audioStates.vocalsVolume}
                onChange={(e, newValue) => handleVolumeChange('vocals', newValue)}
                min={0}
                max={1}
                step={0.01}
                sx={{ width: '200px', mx: 2 }}
              />
            </Box>
            <Box>
              <Box 
                id="vocals-waveform"
                sx={{ 
                  width: '100%', 
                  height: { xs: '80px', sm: '100px' }, 
                  backgroundColor: '#f5f5f5',
                  '& wave': { backgroundColor: '#f5f5f5' }
                }}
              />
            </Box>
          </Box>

        </Paper>

        {/* 右側欄：歌單列表（只在有歌單參數時顯示） */}
        {hasPlaylistParam && currentPlaylist && (
          <Paper 
            elevation={3} 
            sx={{ 
              width: { xs: '100%', md: 360 },
              p: 2,
              order: { xs: 2, md: 2 }
            }}
          >
            <PlaylistSidebar 
              onSongSelect={(song) => {
                navigate(`/video/${song.id}?playlist=${currentPlaylist.id}`);
              }}
            />
          </Paper>
        )}
      </Box>
      <PlaylistDialog
        open={playlistDialogOpen}
        onClose={() => setPlaylistDialogOpen(false)}
        song={videoData}
      />
    </Container>
  )
}

export default VideoPage
