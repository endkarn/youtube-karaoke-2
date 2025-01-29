import { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Collapse,
  Divider,
  Button,
  TextField
} from '@mui/material';
import {
  DragDropContext,
  Droppable,
  Draggable
} from '@hello-pangea/dnd';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { usePlaylist } from '../contexts/PlaylistContext';
import { useNavigate } from 'react-router-dom';

export default function Playlist({ playlist }) {
  const { removeSongFromPlaylist, reorderPlaylistSongs, startPlaylist, updatePlaylistName } = usePlaylist();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);
  const inputRef = useRef(null);

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    reorderPlaylistSongs(
      playlist.id,
      result.source.index,
      result.destination.index
    );
  };

  const handleRemoveSong = (songId) => {
    removeSongFromPlaylist(playlist.id, songId);
  };

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        mb: 2,
        overflow: 'hidden',
        borderRadius: 2
      }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' }
        }}
        onClick={() => setExpanded(!expanded)}
      >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isEditing ? (
              <TextField
                ref={inputRef}
                size="small"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => {
                  if (editName.trim() && editName !== playlist.name) {
                    updatePlaylistName(playlist.id, editName.trim());
                  }
                  setIsEditing(false);
                  setEditName(playlist.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editName.trim()) {
                    if (editName !== playlist.name) {
                      updatePlaylistName(playlist.id, editName.trim());
                    }
                    setIsEditing(false);
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditName(playlist.name);
                  }
                }}
                autoFocus
                sx={{ minWidth: 200 }}
              />
            ) : (
              <>
                <Typography variant="h6">
                  {playlist.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  sx={{ ml: 1 }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </>
            )}
            {playlist.songs.length > 0 && (
              <Button
                variant="contained"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  startPlaylist(playlist.id);
                  navigate(`/video/${playlist.songs[0].id}?playlist=${playlist.id}`);
                }}
                sx={{ ml: 2 }}
              >
                Play
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ mr: 1 }}
            >
              {playlist.songs.length} songs
            </Typography>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
      </Box>

      <Collapse in={expanded}>
        <Divider />
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`playlist-${playlist.id}`}>
            {(provided, snapshot) => (
              <List
                {...provided.droppableProps}
                ref={provided.innerRef}
                sx={{ 
                  py: 0,
                  '& .MuiListItem-root:last-child': {
                    borderBottom: 'none'
                  },
                  backgroundColor: snapshot.isDraggingOver ? 'action.hover' : 'inherit'
                }}
              >
                {playlist.songs.map((song, index) => (
                  <Draggable
                    key={song.id}
                    draggableId={`song-${song.id}`}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <ListItem
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        sx={{
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          bgcolor: snapshot.isDragging ? 'action.hover' : 'inherit',
                          '&:hover': {
                            '& .delete-button': {
                              opacity: 1
                            }
                          }
                        }}
                      >
                        <IconButton
                          size="small"
                          {...provided.dragHandleProps}
                          sx={{ mr: 1 }}
                        >
                          <DragHandleIcon />
                        </IconButton>
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            startPlaylist(playlist.id, index);
                            navigate(`/video/${song.id}?playlist=${playlist.id}`);
                          }}
                          sx={{ 
                            flex: 1,
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: 'action.hover'
                            }
                          }}
                        >
                          <ListItemText
                            primary={song.title}
                            secondary={`${Math.floor(song.duration / 60)}分${song.duration % 60}秒`}
                          />
                        </Box>
                        <IconButton
                          size="small"
                          className="delete-button"
                          onClick={() => handleRemoveSong(song.id)}
                          sx={{
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            '&:hover': {
                              color: 'error.main'
                            }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItem>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                {playlist.songs.length === 0 && (
                  <ListItem>
                    <ListItemText
                      secondary="No songs added yet"
                      sx={{ textAlign: 'center', color: 'text.secondary' }}
                    />
                  </ListItem>
                )}
              </List>
            )}
          </Droppable>
        </DragDropContext>
      </Collapse>
    </Paper>
  );
}
