import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Play, Pause, SkipForward, Music, Plus, LogOut, User, FolderPlus, Trash2, ListMusic, Lock, Mail, Sparkles } from 'lucide-react';

const API_BASE = "https://rajtube-backend-lbap.onrender.com";

export default function RajtubeMusic() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  // Auth Form States
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // App Data States
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Song Input States
  const [songTitle, setSongTitle] = useState('');
  const [songUrl, setSongUrl] = useState('');
  const [artistName, setArtistName] = useState('');

  // Music Player States
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('rajtube_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
    }
  }, []);

  // YouTube IFrame Player API Setup for Background Audio
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('hidden-youtube-player', {
        height: '0',
        width: '0',
        videoId: '',
        playerVars: {
          playsinline: 1,
          controls: 0,
        },
        events: {
          'onStateChange': onPlayerStateChange
        }
      });
    };
  }, []);

  const onPlayerStateChange = (event) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      setupMediaSession();
    } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
      setIsPlaying(false);
    }
  };

  // Browser Media Session for Lock Screen / Background Play Controls
  const setupMediaSession = () => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist || 'Rajtube Music',
        album: 'My Playlist',
        artwork: [
          { src: `https://img.youtube.com/vi/${currentSong.youtube_id}/hqdefault.jpg`, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (playerRef.current) {
          playerRef.current.playVideo();
          setIsPlaying(true);
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (playerRef.current) {
          playerRef.current.pauseVideo();
          setIsPlaying(false);
        }
      });
    }
  };

  const getYoutubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // 🔐 Register / Login Handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (authMode === 'register') {
      try {
        const res = await fetch(`${API_BASE}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (res.ok) {
          const userData = { id: data.user_id, username };
          setUser(userData);
          localStorage.setItem('rajtube_user', JSON.stringify(userData));
        } else {
          setAuthError(data.detail || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে!');
        }
      } catch (err) {
        setAuthError('সার্ভারে কানেক্ট করা যাচ্ছে না!');
      }
    } else {
      // Login Logic (Demo Session)
      const userData = { id: 1, username: username || 'User' };
      setUser(userData);
      localStorage.setItem('rajtube_user', JSON.stringify(userData));
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('rajtube_user');
  };

  // 🎵 Playlists & Songs Handling
  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/playlists?user_id=${user.id}&name=${encodeURIComponent(newPlaylistName)}`, {
        method: 'POST'
      });
      const data = await res.json();
      const created = { id: data.playlist_id, name: data.name };
      setPlaylists([...playlists, created]);
      setActivePlaylist(created);
      setNewPlaylistName('');
    } catch (err) {
      alert('প্লেলিস্ট তৈরি করা যায়নি!');
    }
  };

  const fetchSongs = async (playlistId) => {
    try {
      const res = await fetch(`${API_BASE}/api/playlists/${playlistId}/songs`);
      const data = await res.json();
      setSongs(data.songs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!activePlaylist) return alert('প্রথমে একটি প্লেলিস্ট সিলেক্ট বা তৈরি করুন!');
    
    const ytId = getYoutubeId(songUrl);
    if (!ytId) return alert('সঠিক ইউটিউব লিংক দিন!');

    const payload = {
      playlist_id: activePlaylist.id,
      title: songTitle || 'Unknown Track',
      youtube_url: songUrl,
      youtube_id: ytId,
      artist: artistName || 'Unknown Artist'
    };

    try {
      const res = await fetch(`${API_BASE}/api/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchSongs(activePlaylist.id);
        setSongTitle('');
        setSongUrl('');
        setArtistName('');
      }
    } catch (err) {
      alert('গান যোগ করা সম্ভব হয়নি!');
    }
  };

  const playSong = (song) => {
    setCurrentSong(song);
    if (playerRef.current && playerRef.current.loadVideoById) {
      playerRef.current.loadVideoById(song.youtube_id);
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Head><title>Rajtube Music — Login</title></Head>
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center">
          <div className="w-16 h-16 bg-indigo-600/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/20 text-2xl">
            <Music className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-1 tracking-tight">Rajtube Music</h1>
          <p className="text-slate-400 text-xs mb-6">আপনার ব্যক্তিগত ব্যাকগ্রাউন্ড মিউজিক প্লেয়ার</p>

          <form onSubmit={handleAuth} className="space-y-3">
            <input
              type="text"
              placeholder="ইউজারনেম"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              required
            />
            {authMode === 'register' && (
              <input
                type="email"
                placeholder="ইমেইল"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                required
              />
            )}
            <input
              type="password"
              placeholder="পাসওয়ার্ড"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              required
            />

            {authError && <p className="text-rose-400 text-xs">{authError}</p>}

            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-medium rounded-xl text-xs transition shadow-lg shadow-indigo-600/25">
              {authMode === 'login' ? 'লগইন করুন' : 'সাইন আপ করুন'}
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-400">
            {authMode === 'login' ? 'অ্যাকাউন্ট নেই? ' : 'আগে থেকেই অ্যাকাউন্ট আছে? '}
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-indigo-400 underline font-medium">
              {authMode === 'login' ? 'সাইন আপ' : 'লগইন'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-24">
      <Head><title>Rajtube Music Player</title></Head>

      {/* Hidden YouTube Audio Engine */}
      <div id="hidden-youtube-player" className="hidden"></div>

      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-xl px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="font-bold text-base tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Rajtube Music
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {user.username}</span>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-400 rounded-xl transition bg-slate-900 border border-slate-800">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        {/* Sidebar: Playlists */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-md">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-indigo-400" /> নতুন প্লেলিস্ট
            </h2>
            <form onSubmit={handleCreatePlaylist} className="flex gap-2">
              <input
                type="text"
                placeholder="প্লেলিস্টের নাম..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium rounded-xl transition">যোগ</button>
            </form>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-pink-400" /> আপনার প্লেলিস্ট
            </h2>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => { setActivePlaylist(pl); fetchSongs(pl.id); }}
                  className={`w-full text-left p-3 rounded-xl text-xs flex items-center gap-2.5 transition ${
                    activePlaylist?.id === pl.id ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-950/40 text-slate-400 hover:text-white'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" /> {pl.name}
                </button>
              ))}
              {playlists.length === 0 && <p className="text-xs text-slate-500 py-4 text-center">কোনো প্লেলিস্ট পাওয়া যায়নি</p>}
            </div>
          </div>
        </div>

        {/* Songs & Add Song Area */}
        <div className="md:col-span-2 space-y-4">
          {activePlaylist ? (
            <>
              {/* Add Song Form */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" /> "{activePlaylist.name}" এ নতুন গান যোগ করুন
                </h3>
                <form onSubmit={handleAddSong} className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    placeholder="গান/ট্র্যাকের শিরোনাম"
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value)}
                    className="px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="শিল্পী/ব্যান্ডের নাম"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    className="px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white"
                  />
                  <input
                    type="url"
                    placeholder="ইউটিউব গান লিংক"
                    value={songUrl}
                    onChange={(e) => setSongUrl(e.target.value)}
                    className="px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white md:col-span-2"
                    required
                  />
                  <button type="submit" className="py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium rounded-xl transition">সেভ করুন</button>
                </form>
              </div>

              {/* Songs List */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-2">
                <h3 className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">গানের তালিকা</h3>
                <div className="space-y-2">
                  {songs.map((song) => (
                    <div
                      key={song.id}
                      onClick={() => playSong(song)}
                      className={`p-3 rounded-2xl cursor-pointer flex justify-between items-center transition ${
                        currentSong?.id === song.id ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300' : 'bg-slate-950/40 hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img src={`https://img.youtube.com/vi/${song.youtube_id}/hqdefault.jpg`} alt={song.title} className="w-10 h-10 rounded-xl object-cover" />
                        <div>
                          <p className="text-xs font-semibold">{song.title}</p>
                          <p className="text-[10px] text-slate-500">{song.artist}</p>
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
                        {currentSong?.id === song.id && isPlaying ? <Pause className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> : <Play className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  ))}
                  {songs.length === 0 && <p className="text-xs text-center text-slate-500 py-8">এই প্লেলিস্টে এখনো কোনো গান যোগ করা হয়নি</p>}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full bg-slate-900/40 border border-slate-800/80 rounded-3xl flex flex-col items-center justify-center text-slate-500 p-8 text-center">
              <Music className="w-12 h-12 opacity-30 mb-2" />
              <p className="text-xs">গান দেখতে বা যুক্ত করতে বামপাশ থেকে একটি প্লেলিস্ট সিলেক্ট অথবা তৈরি করুন</p>
            </div>
          )}
        </div>
      </main>

      {/* Persistent Bottom Background Audio Bar */}
      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800/90 backdrop-blur-2xl p-3 z-50 px-6 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <img src={`https://img.youtube.com/vi/${currentSong.youtube_id}/hqdefault.jpg`} alt={currentSong.title} className="w-11 h-11 rounded-xl object-cover border border-slate-700" />
            <div>
              <p className="text-xs font-bold text-white tracking-tight">{currentSong.title}</p>
              <p className="text-[10px] text-slate-400">{currentSong.artist}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={togglePlayPause} className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-600/30 transition">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}