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
  
  // Read playlist ID from URL
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
    vocalsVolume: 1,
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
    // Update page title
    if (videoData) {
      document.title = `${videoData.title} - YouTube Karaoke Converter`;
    }
  }, [videoData]);

  useEffect(() => {
    // Load video data
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
        console.error('Failed to load video data:', error)
      }
    }

    fetchVideoData()

    // Cleanup
    return () => {
      if (wavesurferRef.current.vocals) {
        wavesurferRef.current.vocals.destroy()
      }
      if (wavesurferRef.current.karaoke) {
        wavesurferRef.current.karaoke.destroy()
      }
    }
  }, [id])

  // Initialize WaveSurfer when videoData updates and DOM is rendered
  useEffect(() => {
    if (!videoData) return;

    // Use requestAnimationFrame to ensure DOM is updated
    const initTimer = requestAnimationFrame(async () => {
      console.log('Starting WaveSurfer initialization...');
      try {
        await initializeWaveSurfer(videoData);
        console.log('WaveSurfer initialization complete');
        
        // Add 1 second delay before auto-playing
        setTimeout(() => {
          if (youtubePlayerRef.current) {
            youtubePlayerRef.current.playVideo();
            toggleMute('vocals');
          }
        }, 1000);
        
      } catch (error) {
        console.error('WaveSurfer initialization failed:', error);
      }
    });

    return () => cancelAnimationFrame(initTimer);
  }, [videoData]);

  // Format time
  const formatTime = (time) => {
    if (!time) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const initializeWaveSurfer = async (video) => {
    try {
      // Wait for DOM elements to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if container elements exist
      const vocalsContainer = document.querySelector('#vocals-waveform');
      const karaokeContainer = document.querySelector('#karaoke-waveform');
      
      if (!vocalsContainer || !karaokeContainer) {
        console.error('Waveform container elements not found');
        return;
      }

      // Cleanup existing instances if they exist
      if (wavesurferRef.current.vocals) {
        wavesurferRef.current.vocals.destroy();
      }
      if (wavesurferRef.current.karaoke) {
        wavesurferRef.current.karaoke.destroy();
      }

      // Create vocals waveform instance
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

      // Create karaoke waveform instance
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

      // Save instances before loading audio
      wavesurferRef.current = {
        vocals: vocalsWavesurfer,
        karaoke: karaokeWavesurfer
      }

      // Load audio files
      await Promise.all([
        vocalsWavesurfer.load(`${API_BASE_URL}${video.vocals_path}`),
        karaokeWavesurfer.load(`${API_BASE_URL}${video.karaoke_path}`)
      ]).catch(error => {
        console.error('Failed to load audio files:', error);
        return;
      });

      // Set up event listeners for audio players
      const wavesurfers = [vocalsWavesurfer, karaokeWavesurfer]
      wavesurfers.forEach(wavesurfer => {
        wavesurfer.on('ready', () => {
          // Set initial volume - vocals will be muted (0)
          wavesurfer.setVolume(wavesurfer === vocalsWavesurfer ? 0 : 1)
          const duration = wavesurfer.getDuration()
          setAudioStates(prev => ({
            ...prev,
            duration: formatTime(duration)
          }))
        })

        // Allow clicking on waveform to seek, and update all playback progress
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

        // Listen for playback progress changes
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
      console.error('Failed to initialize WaveSurfer:', error)
    }
  }

  // YouTube player control
  const handleYouTubeStateChange = (event) => {
    const wavesurfers = wavesurferRef.current
    if (!wavesurfers.vocals || !wavesurfers.karaoke) return

    // YouTube player states:
    // -1 (unstarted) 0 (ended) 1 (playing) 2 (paused) 3 (buffering) 5 (video cued)
    switch (event.data) {
      case 1: // Playing
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
      case 2: // Paused
        wavesurfers.vocals.pause()
        wavesurfers.karaoke.pause()
        setAudioStates(prev => ({ 
          ...prev, 
          isPlaying: false,
          currentTime: formatTime(event.target.getCurrentTime()),
          currentSeconds: event.target.getCurrentTime()
        }))
        break
      case 3: // Buffering
        wavesurfers.vocals.pause()
        wavesurfers.karaoke.pause()
        break
      case 0: // Ended
        wavesurfers.vocals.pause()
        wavesurfers.karaoke.pause()
        setAudioStates(prev => ({ 
          ...prev, 
          isPlaying: false,
          currentTime: formatTime(event.target.getDuration()),
          currentSeconds: event.target.getDuration()
        }))
        
        // If playing a playlist, automatically play next song
        if (currentPlaylist) {
          const nextSong = playNextSong()
          if (nextSong) {
            navigate(`/video/${nextSong.id}?playlist=${currentPlaylist.id}`)
          }
        }
        break
    }
  }

  // Periodically sync audio with video time
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

        // Update progress bar and time display
        setAudioStates(prev => ({
          ...prev,
          currentTime: formatTime(youtubeTime),
          duration: formatTime(duration),
          currentSeconds: youtubeTime
        }))

        // Audio sync logic
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
        console.warn('Error updating progress:', error)
      }

      // Ensure next frame's update
      animationFrameId = window.requestAnimationFrame(updateProgress)
    }

    // Start update loop
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
          <Typography>Loading...</Typography>
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
      {/* Video area */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h5">
                <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                  YouTube Karaoke
                </Link>
                {' - '}{videoData.title}
              </Typography>
            </Box>
            <Box>
              <Button
                variant="contained"
                startIcon={<PlaylistAddIcon />}
                onClick={() => setPlaylistDialogOpen(true)}
              >
                Add to Playlist
              </Button>
            </Box>
          </Box>
          
          <Box sx={{ 
            mt: { xs: 1, sm: 2 }, 
            mb: { xs: 2, sm: 3 }, 
            width: '100%',
            position: 'relative',
            paddingTop: '56.25%' // 16:9 aspect ratio
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
                // Set YouTube volume to 0 (since we use separate tracks)
                event.target.setVolume(0)
                // Set total duration
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

      {/* Control area */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3 
      }}>
        {/* Left column: playback controls and audio tracks */}
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
                      // Update WaveSurfer progress first
                      wavesurfers.vocals.seekTo(value / youtubePlayerRef.current.getDuration());
                      wavesurfers.karaoke.seekTo(value / youtubePlayerRef.current.getDuration());
                    }
                    // Then update YouTube player progress
                    if (youtubePlayerRef.current) {
                      youtubePlayerRef.current.seekTo(value, true);
                    }
                    // Update progress bar state
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
              Karaoke Track (No Vocals)
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
              Vocals Track
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

        {/* Right column: playlist list (only shown when there is a playlist parameter) */}
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
