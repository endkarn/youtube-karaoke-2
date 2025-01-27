import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Typography, IconButton, Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { usePlaylist } from '../contexts/PlaylistContext';
import VideoList from './VideoList';

export default function PlaylistSongsPage() {
  const { id: playlistId } = useParams();
  const navigate = useNavigate();
  const { playlists } = usePlaylist();
  const [playlist, setPlaylist] = useState(null);

  useEffect(() => {
    const currentPlaylist = playlists.find(p => p.id.toString() === playlistId);
    if (!currentPlaylist) {
      navigate('/');
      return;
    }
    setPlaylist(currentPlaylist);
  }, [playlistId, playlists, navigate]);

  if (!playlist) {
    return null;
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
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center',
        mb: 3
      }}>
        <IconButton 
          onClick={() => navigate('/')}
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {playlist.name}
        </Typography>
      </Box>

      <Box sx={{ mt: -4 }}>
          <VideoList 
            songs={playlist.songs}
            showPlaylistActions={false}
            title={`${playlist.songs.length} 首歌曲`}
            playlistId={playlistId}
          />
      </Box>
    </Container>
  );
}
