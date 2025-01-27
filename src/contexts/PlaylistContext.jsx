import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:3006';

const PlaylistContext = createContext();

export function PlaylistProvider({ children }) {
  const [playlists, setPlaylists] = useState([]);
  // 從 localStorage 初始化狀態
  const [currentPlaylist, setCurrentPlaylist] = useState(() => {
    const saved = localStorage.getItem('currentPlaylist');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentSongIndex, setCurrentSongIndex] = useState(() => {
    const saved = localStorage.getItem('currentSongIndex');
    return saved ? parseInt(saved) : -1;
  });

  // 當歌單狀態改變時保存到 localStorage
  useEffect(() => {
    if (currentPlaylist) {
      localStorage.setItem('currentPlaylist', JSON.stringify(currentPlaylist));
    } else {
      localStorage.removeItem('currentPlaylist');
    }
  }, [currentPlaylist]);

  useEffect(() => {
    localStorage.setItem('currentSongIndex', currentSongIndex.toString());
  }, [currentSongIndex]);

  // 載入歌單
  const fetchPlaylists = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/playlists`);
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data);
      }
    } catch (error) {
      console.error('載入歌單失敗:', error);
    }
  }, []);

  // 初始載入歌單
  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // 新增歌單
  const addPlaylist = async (name) => {
    try {
      const response = await fetch(`${API_BASE_URL}/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        const newPlaylist = await response.json();
        setPlaylists(prevPlaylists => [...prevPlaylists, { ...newPlaylist, songs: [] }]);
        return newPlaylist;
      }
    } catch (error) {
      console.error('新增歌單失敗:', error);
    }
    return null;
  };

  // 加入歌曲到歌單
  const addSongToPlaylist = async (playlistId, song) => {
    try {
      const response = await fetch(`${API_BASE_URL}/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ songId: song.id }),
      });

      if (response.ok) {
        await fetchPlaylists(); // 重新載入歌單以獲取最新狀態
      }
    } catch (error) {
      console.error('加入歌曲失敗:', error);
    }
  };

  // 從歌單移除歌曲
  const removeSongFromPlaylist = async (playlistId, songId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/playlists/${playlistId}/songs/${songId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchPlaylists(); // 重新載入歌單以獲取最新狀態
      }
    } catch (error) {
      console.error('移除歌曲失敗:', error);
    }
  };

  // 重新排序歌單中的歌曲
  const reorderPlaylistSongs = async (playlistId, startIndex, endIndex) => {
    try {
      const response = await fetch(`${API_BASE_URL}/playlists/${playlistId}/songs/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromPosition: startIndex + 1, // 資料庫中的 position 從 1 開始
          toPosition: endIndex + 1,
        }),
      });

      if (response.ok) {
        await fetchPlaylists(); // 重新載入歌單以獲取最新狀態
      }
    } catch (error) {
      console.error('重新排序失敗:', error);
    }
  };

  // 開始播放歌單
  const startPlaylist = (playlistId, startIndex = 0) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist && playlist.songs.length > 0) {
      setCurrentPlaylist(playlist);
      setCurrentSongIndex(startIndex);
    }
  };

  // 播放下一首歌
  const playNextSong = () => {
    if (!currentPlaylist) return null;
    
    const nextIndex = currentSongIndex + 1;
    if (nextIndex < currentPlaylist.songs.length) {
      setCurrentSongIndex(nextIndex);
      return currentPlaylist.songs[nextIndex];
    } else {
      // 播放完畢，重置狀態
      setCurrentPlaylist(null);
      setCurrentSongIndex(-1);
      return null;
    }
  };

  // 取得目前播放的歌曲
  const getCurrentSong = () => {
    if (!currentPlaylist || currentSongIndex === -1) return null;
    return currentPlaylist.songs[currentSongIndex];
  };

  // 更新歌單名稱
  const updatePlaylistName = async (playlistId, newName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/playlists/${playlistId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        await fetchPlaylists(); // 重新載入歌單以獲取最新狀態
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新歌單名稱失敗:', error);
      return false;
    }
  };

  return (
    <PlaylistContext.Provider value={{
      playlists,
      addPlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      reorderPlaylistSongs,
      startPlaylist,
      playNextSong,
      getCurrentSong,
      currentPlaylist,
      currentSongIndex,
      updatePlaylistName
    }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylist() {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error('usePlaylist must be used within a PlaylistProvider');
  }
  return context;
}
