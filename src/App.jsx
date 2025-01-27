import { Routes, Route } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Box } from '@mui/material'
import Home from './components/Home'
import VideoPage from './components/VideoPage'
import PlaylistsPage from './components/PlaylistsPage'
import PlaylistSongsPage from './components/PlaylistSongsPage'
import { PlaylistProvider } from './contexts/PlaylistContext'
import './App.css'

function App() {
  const theme = createTheme({
    palette: {
      mode: 'dark',
      background: {
        default: '#121212',
        paper: '#1e1e1e',
      },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            },
          },
        },
      },
    },
  })
  return (
    <PlaylistProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
      <Box sx={{ flexGrow: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box component="main" sx={{ flexGrow: 1, width: '100%', maxWidth: '1200px', px: 2 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/video/:id" element={<VideoPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlists/:id" element={<PlaylistSongsPage />} />
          </Routes>
        </Box>
      </Box>
      </ThemeProvider>
    </PlaylistProvider>
  )
}

export default App
