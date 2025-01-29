import { Box, Container, Typography, Paper } from '@mui/material';
import { usePlaylist } from '../contexts/PlaylistContext';
import Playlist from './Playlist';

export default function PlaylistsPage() {
  const { playlists } = usePlaylist();

  return (
    <Container 
      maxWidth="lg" 
      disableGutters={false}
      sx={{ 
        mt: { xs: 2, sm: 3, md: 4 },
        px: { xs: 2, sm: 3, md: 4 }
      }}
    >
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          My Playlists
        </Typography>

        <Box sx={{ mt: 3 }}>
          {playlists.map(playlist => (
            <Playlist key={playlist.id} playlist={playlist} />
          ))}
          {playlists.length === 0 && (
            <Typography 
              variant="body1" 
              color="text.secondary"
              sx={{ textAlign: 'center', py: 4 }}
            >
              No playlists created yet
            </Typography>
          )}
        </Box>
      </Paper>
    </Container>
  );
}
