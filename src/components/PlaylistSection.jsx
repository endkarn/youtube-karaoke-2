import { Box, Typography, Paper, Grid, Card, CardActionArea, Fade } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { usePlaylist } from '../contexts/PlaylistContext';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';

export default function PlaylistSection() {
  const { playlists } = usePlaylist();
  const navigate = useNavigate();

  if (playlists.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Typography 
        variant="h5" 
        sx={{ 
          mb: 2,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <QueueMusicIcon />
        我的歌單
      </Typography>
      
      <Grid container spacing={2}>
        {playlists.map((playlist) => (
          <Grid item xs={12} sm={6} md={4} key={playlist.id}>
            <Card 
              sx={{ 
                borderRadius: 2,
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)'
                }
              }}
            >
              <CardActionArea
                onClick={() => navigate(`/playlists/${playlist.id.toString()}`)}
                sx={{ p: 2 }}
              >
                <Typography variant="h6" gutterBottom>
                  {playlist.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {playlist.songs.length} 首歌曲
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
