import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Paper
} from '@mui/material';
import { usePlaylist } from '../contexts/PlaylistContext';

export default function PlaylistSidebar({ onSongSelect }) {
  const { currentPlaylist, currentSongIndex } = usePlaylist();

  if (!currentPlaylist) return null;

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight="medium">
          播放清單：{currentPlaylist.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {currentPlaylist.songs.length} 首歌曲
        </Typography>
      </Box>

      <List sx={{ 
        flex: 1, 
        overflow: 'auto',
        '& .MuiListItem-root': {
          px: 1
        }
      }}>
        {currentPlaylist.songs.map((song, index) => (
          <ListItem 
            key={song.id}
            disablePadding
            sx={{
              bgcolor: index === currentSongIndex ? 'action.selected' : 'inherit',
              '&:hover': {
                bgcolor: 'action.hover'
              }
            }}
          >
            <ListItemButton onClick={() => onSongSelect(song)}>
              <Typography
                sx={{
                  minWidth: 32,
                  color: index === currentSongIndex ? 'primary.main' : 'text.secondary',
                  fontWeight: index === currentSongIndex ? 'medium' : 'regular'
                }}
              >
                {(index + 1).toString().padStart(2, '0')}
              </Typography>
              <ListItemAvatar>
                <Avatar
                  variant="rounded"
                  src={`https://img.youtube.com/vi/${song.video_id}/default.jpg`}
                  alt={song.title}
                />
              </ListItemAvatar>
              <ListItemText 
                primary={song.title}
                primaryTypographyProps={{
                  color: index === currentSongIndex ? 'primary.main' : 'inherit',
                  fontWeight: index === currentSongIndex ? 'medium' : 'regular'
                }}
                secondary={`${Math.floor(song.duration / 60)}分${song.duration % 60}秒`}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
