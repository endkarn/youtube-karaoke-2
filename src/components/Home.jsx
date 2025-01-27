import { useState, useEffect } from 'react'
import {
  Container,
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  CircularProgress,
  LinearProgress,
  Alert,
  Fade,
  Grow,
  Stack
} from '@mui/material'
import { styled } from '@mui/material/styles'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import QueueMusicIcon from '@mui/icons-material/QueueMusic'
import SearchIcon from '@mui/icons-material/Search'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import VideoList from './VideoList'
import PlaylistSection from './PlaylistSection'
import { usePlaylist } from '../contexts/PlaylistContext'

const API_BASE_URL = 'http://localhost:3006'

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginBottom: theme.spacing(4),
  borderRadius: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  }
}))

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(1.5),
    transition: theme.transitions.create(['border-color', 'box-shadow']),
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
    '&.Mui-focused': {
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}25`,
    },
  },
}))

function Home() {
  const [url, setUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState({ message: '', progress: 0 })
  const [eventSource, setEventSource] = useState(null)
  const [conversionComplete, setConversionComplete] = useState(0)

  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [eventSource])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setStatus({ message: '', progress: 0 })
    
    if (eventSource) {
      eventSource.close()
    }

    const newEventSource = new EventSource(`${API_BASE_URL}/status`)
    setEventSource(newEventSource)

    newEventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setStatus(prevStatus => ({
        ...prevStatus,
        ...data
      }))
    }

    newEventSource.onerror = () => {
      newEventSource.close()
      setEventSource(null)
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '處理失敗')
      }

      setUrl('')
      // 轉換完成時更新 state，觸發重新載入
      setConversionComplete(prev => prev + 1)
    } catch (err) {
      setError('處理過程發生錯誤，請稍後再試')
      console.error('Error:', err)
    } finally {
      setLoading(false)
      if (newEventSource) {
        newEventSource.close()
        setEventSource(null)
      }
    }
  }

  return (
    <Container 
      maxWidth="lg" 
      disableGutters={false}
      sx={{
        px: { xs: 2, sm: 3, md: 4 }
      }}
    >
      <Fade in timeout={800}>
        <Box sx={{ my: { xs: 2, sm: 3, md: 4 } }}>
          <Typography 
            variant="h3" 
            component="h1" 
            gutterBottom 
            align="center"
            sx={{ 
              fontWeight: 700,
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              backgroundClip: 'text',
              textFillColor: 'transparent',
              mb: 4
            }}
          >
            YouTube 卡拉OK 轉換器
          </Typography>
          
          <Grow in timeout={1000}>
            <StyledPaper elevation={0}>
              <form onSubmit={handleSubmit}>
                <StyledTextField
                  fullWidth
                  label="輸入 YouTube 影片網址"
                  variant="outlined"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  placeholder="https://www.youtube.com/watch?v=..."
                  sx={{ mb: { xs: 2, sm: 3 } }}
                />
                
                <Button 
                  fullWidth 
                  variant="contained" 
                  type="submit"
                  disabled={loading || !url}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                  sx={{ 
                    py: { xs: 1.2, sm: 1.5 },
                    fontSize: { xs: '1rem', sm: '1.1rem' },
                    background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #1976D2 30%, #1CB5E0 90%)',
                    }
                  }}
                >
                  {loading ? '處理中...' : '開始轉換'}
                </Button>
              </form>

              {loading && (
                <Fade in timeout={500}>
                  <Box sx={{ mt: { xs: 2, sm: 3 } }}>
                    <Typography variant="body1" gutterBottom color="text.secondary">
                      {status.message}
                      {status.duration && ` - ${status.duration}`}
                    </Typography>
                    {status.progress > 0 && (
                      <Box sx={{ width: '100%', mt: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={status.progress}
                          sx={{
                            height: { xs: 6, sm: 8 },
                            borderRadius: 4,
                            backgroundColor: 'rgba(0,0,0,0.1)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 4,
                              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                            }
                          }}
                        />
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          align="right"
                          sx={{ mt: 0.5 }}
                        >
                          {status.progress}%
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Fade>
              )}

              {error && (
                <Fade in timeout={500}>
                  <Alert 
                    severity="error" 
                    sx={{ 
                      mt: { xs: 2, sm: 3 },
                      borderRadius: 2
                    }}
                  >
                    {error}
                  </Alert>
                </Fade>
              )}
            </StyledPaper>
          </Grow>

          <Fade in timeout={1200}>
            <Box>
              {/* 搜尋欄位 */}
              <Box sx={{ mb: 4 }}>
                <StyledTextField
                  fullWidth
                  placeholder="搜尋已轉換的影片..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                    ),
                  }}
                />
              </Box>

              {/* 歌單列表 */}
              <PlaylistSection />

              {/* 最新歌曲 */}
              <Box sx={{ mt: 4 }}>
                <VideoList 
                  conversionComplete={conversionComplete}
                  searchQuery={searchQuery}
                  title="最新歌曲"
                />
              </Box>
            </Box>
          </Fade>
        </Box>
      </Fade>
    </Container>
  )
}

export default Home
