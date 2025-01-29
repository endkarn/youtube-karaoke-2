import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Skeleton,
  Fade,
  Grow,
  IconButton,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaylistDialog from './PlaylistDialog';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';

const API_BASE_URL = 'http://localhost:3006'

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
  },
  position: 'relative',
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
}))

const PlayButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%) scale(0)',
  backgroundColor: 'rgba(33, 150, 243, 0.9)',
  color: '#fff',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    backgroundColor: 'rgba(33, 150, 243, 1)',
    transform: 'translate(-50%, -50%) scale(1.1)',
  },
}))

const MediaOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.1)',
  transition: 'all 0.3s ease-in-out',
}))

const StyledCardActionArea = styled(CardActionArea)({
  '&:hover': {
    '& .play-button': {
      transform: 'translate(-50%, -50%) scale(1)',
    },
    '& .media-overlay': {
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
  },
})

function VideoList({ 
  conversionComplete, 
  searchQuery, 
  title = "Converted Videos Library",
  songs,
  showPlaylistActions = true,
  playlistId
}) {
  const [conversions, setConversions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (songs) {
        setConversions(songs);
        setLoading(false);
        return;
      }

      try {
        const url = new URL(`${API_BASE_URL}/conversions`);
        if (searchQuery) {
          url.searchParams.append('search', searchQuery);
        }
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setConversions(data)
        }
      } catch (error) {
        console.error('Failed to load records:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [conversionComplete, searchQuery, songs])

  const LoadingSkeleton = () => (
    <Grid container spacing={3}>
      {[1, 2, 3, 4].map((item) => (
        <Grid item xs={12} sm={6} key={item}>
          <StyledCard>
            <Box sx={{ position: 'relative', paddingTop: '56.25%' /* 16:9 aspect ratio */ }}>
              <Skeleton 
                variant="rectangular" 
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%'
                }}
              />
            </Box>
            <CardContent>
              <Skeleton variant="text" height={32} width="80%" />
              <Skeleton variant="text" height={24} width="40%" />
            </CardContent>
          </StyledCard>
        </Grid>
      ))}
    </Grid>
  )

  return (
    <Box sx={{ mt: 6 }}>
      <Fade in timeout={800}>
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3,
            borderRadius: 4,
            backgroundColor: 'background.paper',
          }}
        >
          <Typography 
            variant="h5" 
            gutterBottom 
            sx={{ 
              mb: 3,
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            {title}
          </Typography>

          {loading ? (
            <LoadingSkeleton />
          ) : (
            <Grid container spacing={3}>
              {conversions.map((conversion, index) => (
                <Grid item xs={12} sm={6} key={conversion.id}>
                  <Grow in timeout={500 + index * 100}>
                    <StyledCard>
                      <Box sx={{ position: 'relative' }}>
                        <StyledCardActionArea component={Link} to={`/video/${conversion.id}`}>
                          <Box sx={{ position: 'relative', paddingTop: '56.25%' /* 16:9 aspect ratio */ }}>
                            <CardMedia
                              component="img"
                              image={`https://img.youtube.com/vi/${conversion.video_id}/maxresdefault.jpg`}
                              alt={conversion.title || 'Unknown Title'}
                              onError={(e) => {
                                e.target.src = `https://img.youtube.com/vi/${conversion.video_id}/0.jpg`
                              }}
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          </Box>
                          <MediaOverlay className="media-overlay" />
                          <PlayButton className="play-button" size="large">
                            <PlayArrowIcon fontSize="large" />
                          </PlayButton>
                          <CardContent>
                          <Typography 
                            variant="h6" 
                            noWrap
                            sx={{ 
                              fontWeight: 500,
                              mb: 1
                            }}
                          >
                            {conversion.title || 'Unknown Title'}
                          </Typography>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            color: 'text.secondary'
                          }}>
                            <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5 }} />
                            <Typography variant="body2">
                              {Math.floor(conversion.duration / 60)}min{conversion.duration % 60}sec
                            </Typography>
                          </Box>
                          </CardContent>
                        </StyledCardActionArea>
                        <Box sx={{ 
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          display: 'flex',
                          gap: 1,
                          zIndex: 1
                        }}>
                          {showPlaylistActions && (
                            <>
                              <IconButton
                                sx={{
                                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                  color: 'white',
                                  '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                  },
                                }}
                                onClick={() => {
                                  setVideoToDelete(conversion);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                              <IconButton
                                sx={{
                                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                  color: 'white',
                                  '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                  },
                                }}
                                onClick={() => {
                                  setSelectedVideo(conversion);
                                  setPlaylistDialogOpen(true);
                                }}
                              >
                                <PlaylistAddIcon />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </Box>
                    </StyledCard>
                  </Grow>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Fade>
      <PlaylistDialog
        open={playlistDialogOpen}
        onClose={() => {
          setPlaylistDialogOpen(false);
          setSelectedVideo(null);
        }}
        song={selectedVideo}
      />
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setVideoToDelete(null);
        }}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{videoToDelete?.title || 'Unknown Title'}"? This action will permanently delete this song.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setDeleteDialogOpen(false);
              setVideoToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={async () => {
              if (videoToDelete) {
                try {
                  const response = await fetch(
                    `${API_BASE_URL}/conversions/${videoToDelete.id}`,
                    { method: 'DELETE' }
                  );
                  if (response.ok) {
                    // 重新載入歌曲列表
                    const url = new URL(`${API_BASE_URL}/conversions`);
                    if (searchQuery) {
                      url.searchParams.append('search', searchQuery);
                    }
                    const listResponse = await fetch(url);
                    if (listResponse.ok) {
                      const data = await listResponse.json();
                      setConversions(data);
                    }
                  }
                } catch (error) {
                  console.error('Failed to delete song:', error);
                }
              }
              setDeleteDialogOpen(false);
              setVideoToDelete(null);
            }}
            color="error"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default VideoList
