import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  Box,
  Typography
} from '@mui/material';
import { usePlaylist } from '../contexts/PlaylistContext';

export default function PlaylistDialog({ open, onClose, onSelect, song }) {
  const { playlists, addPlaylist, addSongToPlaylist } = usePlaylist();
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      const newPlaylist = addPlaylist(newPlaylistName.trim());
      if (song) {
        addSongToPlaylist(newPlaylist.id, song);
      }
      setNewPlaylistName('');
      onClose();
    }
  };

  const handleSelectPlaylist = (playlist) => {
    if (song) {
      addSongToPlaylist(playlist.id, song);
    }
    if (onSelect) {
      onSelect(playlist);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add to Playlist</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Create New Playlist
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Enter playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
            />
            <Button 
              variant="contained" 
              onClick={handleCreatePlaylist}
              disabled={!newPlaylistName.trim()}
            >
              Create
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>
          Or Select Existing Playlist
        </Typography>
        <List sx={{ width: '100%' }}>
          {playlists.map((playlist) => (
            <ListItem key={playlist.id} disablePadding>
              <ListItemButton onClick={() => handleSelectPlaylist(playlist)}>
                <ListItemText 
                  primary={playlist.name}
                  secondary={`${playlist.songs.length} songs`}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {playlists.length === 0 && (
            <ListItem>
              <ListItemText 
                secondary="No playlists created yet"
                sx={{ textAlign: 'center', color: 'text.secondary' }}
              />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
