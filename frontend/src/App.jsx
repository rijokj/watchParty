import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CustomPlayer } from './components/CustomPlayer';
import { Chat } from './components/Chat';
import { useVideoSync } from './hooks/useVideoSync';
import { mockSocket } from './services/mockSocket';
import { io } from 'socket.io-client';
import { 
  Film, User, Hash, Share2, LogOut, Copy, Check, Info, HelpCircle, 
  Heart, Star, List, Mic, MicOff, Video, VideoOff, Users, Settings, 
  MessageSquare, Plus, Activity, ChevronDown, Play, Pause 
} from 'lucide-react';

function App() {
  const [isInRoom, setIsInRoom] = useState(false);
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'join'
  const [hasFile, setHasFile] = useState(false);
  const [fileName, setFileName] = useState('');
  const [copied, setCopied] = useState(false);

  // Real or Mock Socket state
  const [socket, setSocket] = useState(null);
  const [isRealServer, setIsRealServer] = useState(true);
  const [backendUrl, setBackendUrl] = useState(() => {
    return localStorage.getItem('custom_backend_url') || 
      import.meta.env.VITE_BACKEND_URL || 
      (window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : window.location.origin);
  });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [showBackendSettings, setShowBackendSettings] = useState(false);
  const [tempBackendUrl, setTempBackendUrl] = useState('');
  const [activeUsers, setActiveUsers] = useState(['You']);
  const [messages, setMessages] = useState([]);
  
  // Room metadata states (CafeSync)
  const [roomName, setRoomName] = useState('LoveNest 💕');
  const [roomCreator, setRoomCreator] = useState('');
  const [roomCreatedAt, setRoomCreatedAt] = useState('');

  // Mic and video active states for the bottom bar controls
  const [micActive, setMicActive] = useState(false);
  const [videoActive, setVideoActive] = useState(false);

  // Sync Action Notification State (In-player overlays)
  const [syncNotification, setSyncNotification] = useState(null);
  const syncTimeoutRef = useRef(null);

  // Media playing state for the bottom control bar
  const [isCinemaPlaying, setIsCinemaPlaying] = useState(false);

  const videoRef = useRef(null);

  // Automatically check URL parameters for pre-filling Room ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam.toUpperCase());
      setActiveTab('join');
    }
  }, []);

  // Set up socket connection (defaults to mock, can connect to real server)
  useEffect(() => {
    if (isRealServer) {
      setConnectionStatus('connecting');
      console.log('Connecting to server:', backendUrl);
      
      const realSocket = io(backendUrl, {
        reconnectionAttempts: 5,
        timeout: 10000
      });
      setSocket(realSocket);

      realSocket.on('connect', () => {
        console.log('Connected to real sync server:', backendUrl);
        setConnectionStatus('connected');
      });

      realSocket.on('disconnect', () => {
        console.log('Disconnected from real sync server');
        setConnectionStatus('disconnected');
      });

      realSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnectionStatus('disconnected');
      });

      realSocket.on('chat-message', (msg) => {
        console.log('[Socket Debug] received chat-message event from server:', msg);
        const newMsg = {
          id: Date.now() + Math.random(),
          user: msg.user,
          text: msg.text,
          time: msg.time || formatMsgTime(),
          type: 'user'
        };
        setMessages((prev) => [...prev, newMsg]);
      });

      realSocket.on('user-joined', (data) => {
        setActiveUsers(data.users);
        if (data.roomName) setRoomName(data.roomName);
        if (data.creator) setRoomCreator(data.creator);
        if (data.createdAt) setRoomCreatedAt(data.createdAt);
        addSystemMessage(`${data.userName} has entered the room`);
      });

      realSocket.on('user-left', (data) => {
        setActiveUsers(data.users);
        addSystemMessage(`${data.userName} has left the room`);
      });

      return () => {
        realSocket.disconnect();
      };
    } else {
      setSocket(mockSocket);
      setConnectionStatus('connected');
      
      const onSystemMsg = (data) => {
        addSystemMessage(data.text);
      };

      const onUserConnected = (data) => {
        setActiveUsers(['You', data.userName]);
        addSystemMessage(`${data.userName} has joined the watch party`);
      };

      mockSocket.on('system-message', onSystemMsg);
      mockSocket.on('user-connected', onUserConnected);

      return () => {
        mockSocket.off('system-message', onSystemMsg);
        mockSocket.off('user-connected', onUserConnected);
      };
    }
  }, [isRealServer, backendUrl]);

  // Memoized sync notification callback to prevent hooks useEffect from constantly rebuilding
  const handleSyncEvent = useCallback((text, sender, type) => {
    if (sender) {
      triggerSyncNotification(text, sender);
    }
  }, []);

  // Hook up video synchronization event emitters & receivers
  useVideoSync(
    videoRef, 
    socket, 
    isInRoom ? roomId : null, 
    handleSyncEvent,
    userName,
    hasFile
  );

  // Automatically join the room socket channel when connected and in-room
  useEffect(() => {
    if (isInRoom && socket) {
      console.log('[Socket Session] Sending join-room to current socket:', socket.id);
      socket.emit('join-room', { roomId, userName, roomName });
    }
  }, [socket, isInRoom]);

  // Handle automatic room rejoining on socket connection drops and reconnects
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log('[Socket Session] Connected / Reconnected. ID:', socket.id);
      if (isInRoom && roomId) {
        console.log('[Socket Session] Auto-rejoining room:', roomId);
        socket.emit('join-room', { roomId, userName, roomName });
      }
    };

    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, isInRoom, roomId, userName, roomName]);

  // Monitor play/pause state of the video ref for the footer play button
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsCinemaPlaying(true);
    const handlePause = () => setIsCinemaPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [isInRoom, hasFile]);

  const formatMsgTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const triggerSyncNotification = useCallback((text, sender) => {
    const timeString = formatMsgTime();
    setSyncNotification({ text, userName: sender, time: timeString });
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      setSyncNotification(null);
    }, 4000);
  }, []);

  const addSystemMessage = (text) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        text,
        time: formatMsgTime(),
        type: 'system'
      }
    ]);
  };

  const handleGenerateRoomId = () => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(`WP-${randomCode}`);
  };

  const handleJoinLobby = (e) => {
    e.preventDefault();
    if (!userName.trim() || !roomId.trim()) return;

    setIsInRoom(true);
    addSystemMessage(`Welcome ${userName}! Joined room ${roomId}`);
    
    // If using mock socket, set dummy details locally
    if (!isRealServer) {
      setRoomCreator(userName);
      setRoomCreatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  };

  const handleSendMessage = (text) => {
    const timeString = formatMsgTime();
    const newMsg = {
      id: Date.now() + Math.random(),
      user: userName,
      text,
      time: timeString,
      type: 'user'
    };
    setMessages((prev) => [...prev, newMsg]);

    if (socket) {
      socket.emit('chat-message', { roomId, user: userName, text, time: timeString });
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('leave-room', { roomId, userName });
    }
    setIsInRoom(false);
    setHasFile(false);
    setFileName('');
    setMessages([]);
    setActiveUsers(['You']);
  };

  const toggleFooterPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(e => console.log(e));
    } else {
      videoRef.current.pause();
    }
  };

  const handleTriggerSimulation = (type) => {
    if (!videoRef.current || !socket) return;
    
    switch (type) {
      case 'peer-play':
        mockSocket.trigger('play', { time: videoRef.current.currentTime, userName: 'Priya' });
        break;
      case 'peer-pause':
        mockSocket.trigger('pause', { time: videoRef.current.currentTime, userName: 'Priya' });
        break;
      case 'peer-seek':
        const randomTime = Math.floor(Math.random() * (videoRef.current.duration || 120));
        mockSocket.trigger('seek', { time: randomTime, userName: 'Priya' });
        break;
      case 'peer-msg':
        const timeString = formatMsgTime();
        const mockMsg = {
          id: Date.now() + Math.random(),
          user: 'Priya',
          text: "This movie is just 😍",
          time: timeString,
          type: 'user'
        };
        mockSocket.trigger('chat-message', mockMsg);
        setMessages((prev) => [...prev, mockMsg]);
        break;
      default:
        break;
    }
  };

  // Profile Avatar helper styles
  const getAvatarStyle = (name) => {
    const cleanName = name?.trim().toLowerCase() || '';
    if (cleanName.includes('priya')) {
      return { background: 'linear-gradient(135deg, #ff4b91, #a855f7)', border: '1px solid rgba(255, 75, 145, 0.3)' };
    }
    return { background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: '1px solid rgba(59, 130, 246, 0.3)' };
  };

  return (
    <div className="app-container">
      {/* Universal Header - Styled like CafeSync */}
      <header className="app-header">
        <div className="logo">
          <Heart size={26} fill="var(--primary)" style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 6px var(--primary-glow))' }} />
          <div>
            <span>CafeSync</span>
            <div className="logo-tagline">Watch Together, Anywhere</div>
          </div>
        </div>
            {isInRoom ? (
          <>
            {/* Center Room code and copy invite link button */}
            <div className="header-room-badge">
              <span className="header-room-name">
                Room: <span>LoveNest 💕</span>
              </span>
              <button className="btn-invite-copy" onClick={handleCopyLink}>
                <Share2 size={12} />
                <span>{copied ? 'Copied!' : 'Copy Invite Link'}</span>
              </button>
            </div>

            {/* Right quick profiles dashboard */}
            <div className="header-profile-section">
              {/* Toggle sandbox / server */}
              <div 
                className="badge" 
                style={{ 
                  cursor: 'pointer', 
                  background: isRealServer 
                    ? (connectionStatus === 'connected' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)')
                    : 'rgba(255, 75, 145, 0.12)', 
                  borderColor: isRealServer 
                    ? (connectionStatus === 'connected' ? 'var(--success)' : 'var(--danger)')
                    : 'var(--primary)' 
                }} 
                onClick={() => setIsRealServer(!isRealServer)}
                title={isRealServer ? `Connected to ${backendUrl}` : "Mock sandbox"}
              >
                <span style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: isRealServer 
                    ? (connectionStatus === 'connected' ? 'var(--success)' : 'var(--danger)')
                    : 'var(--primary)', 
                  display: 'inline-block' 
                }}></span>
                <span style={{ fontSize: '0.8rem' }}>
                  {isRealServer 
                    ? (connectionStatus === 'connected' ? 'Live Server' : 'Offline / Reconnecting') 
                    : 'Sandbox Mock'}
                </span>
              </div>

              <button className="icon-circle-btn" title="Participants list"><Users size={18} /></button>
              <button 
                className="icon-circle-btn" 
                title="Server Settings"
                onClick={() => {
                  setTempBackendUrl(backendUrl);
                  setShowBackendSettings(true);
                }}
              >
                <Settings size={18} />
              </button>
              
              <div className="avatar-wrapper">
                <div className="avatar" style={getAvatarStyle(userName)}>
                  {userName.charAt(0).toUpperCase() || 'A'}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{userName}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
              </div>
            </div>
          </>
        ) : (
          /* Lobby header connection status indicator */
          <div className="header-profile-section">
            <div 
              className="badge" 
              style={{ 
                cursor: 'pointer', 
                background: connectionStatus === 'connected' 
                  ? 'rgba(16, 185, 129, 0.12)' 
                  : connectionStatus === 'connecting'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)', 
                borderColor: connectionStatus === 'connected' 
                  ? 'var(--success)' 
                  : connectionStatus === 'connecting'
                    ? '#f59e0b'
                    : 'var(--danger)' 
              }}
              onClick={() => {
                setTempBackendUrl(backendUrl);
                setShowBackendSettings(true);
              }}
              title={`Click to configure backend URL (Current: ${backendUrl})`}
            >
              <span style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                background: connectionStatus === 'connected' 
                  ? 'var(--success)' 
                  : connectionStatus === 'connecting'
                    ? '#f59e0b'
                    : 'var(--danger)', 
                display: 'inline-block' 
              }}></span>
              <span style={{ fontSize: '0.8rem' }}>
                {connectionStatus === 'connected' 
                  ? 'Server Connected' 
                  : connectionStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Server Disconnected'}
              </span>
            </div>
            
            <button 
              className="icon-circle-btn" 
              title="Server Settings"
              onClick={() => {
                setTempBackendUrl(backendUrl);
                setShowBackendSettings(true);
              }}
            >
              <Settings size={18} />
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      {!isInRoom ? (
        /* LOBBY VIEW */
        <div className="lobby-wrapper">
          <div className="lobby-container fade-in">
            {/* Left side information & steps panels */}
            <div className="lobby-info">
              <h2>Watch Movies Together in <span>Perfect Sync</span>.</h2>
              <p>
                A high-fidelity realtime couple's movie theater. Play local high-definition files instantly without high server bandwidth or video transcoding buffering.
              </p>
              
              <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(255, 75, 145, 0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.2rem', color: 'var(--primary)' }}>
                  <Info size={18} />
                  <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>How Local Playback Works</h4>
                </div>
                
                <div className="steps-list">
                  <div className="step-item">
                    <div className="step-num">1</div>
                    <div className="step-content">
                      <h4>Pick the Same Movie File</h4>
                      <p>Both users must select the same video file from their local machines. We support MP4, WebM, MKV, and other HTML5 videos.</p>
                    </div>
                  </div>
                  <div className="step-item">
                    <div className="step-num">2</div>
                    <div className="step-content">
                      <h4>Join the Room</h4>
                      <p>Create a room and copy the link, or paste a room link shared by your partner to join their existing cinema lounge.</p>
                    </div>
                  </div>
                  <div className="step-item">
                    <div className="step-num">3</div>
                    <div className="step-content">
                      <h4>Synced Playback Controls</h4>
                      <p>Play, pause, or seek timeline. Playback events instantly broadcast to ensure you both stay perfectly in sync.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side login/room selector card */}
            <div className="lobby-card glass-panel">
              <h3>Enter Cinema Lounge</h3>
              
              <div className="tab-selector">
                <button 
                  className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('create'); handleGenerateRoomId(); }}
                >
                  Create Watch Room
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'join' ? 'active' : ''}`}
                  onClick={() => setActiveTab('join')}
                >
                  Join Watch Room
                </button>
              </div>

              <form onSubmit={handleJoinLobby}>
                <div className="input-group">
                  <label className="input-label">Your Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Aditya" 
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="text-input"
                      style={{ paddingLeft: '42px', width: '100%' }}
                    />
                  </div>
                </div>

                {activeTab === 'create' && (
                  <div className="input-group">
                    <label className="input-label">Room Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. LoveNest 💕" 
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      className="text-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label">Room ID Code</label>
                  <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Hash size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input 
                        type="text" 
                        required
                        disabled={activeTab === 'create'}
                        placeholder="e.g. WP-A3B9X2" 
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                        className="text-input"
                        style={{ paddingLeft: '42px', width: '100%' }}
                      />
                    </div>
                    
                    {activeTab === 'create' && (
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={handleGenerateRoomId}
                        style={{ padding: '0 16px' }}
                      >
                        Generate
                      </button>
                    )}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary card-action-btn">
                  {activeTab === 'create' ? 'Create Theater Room' : 'Join Theater Room'}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* CINEMA LOUNGE VIEW */
        <>
          <div className="cinema-container">
            <main className="cinema-main">
              {/* Custom Video Player area */}
              <CustomPlayer 
                videoRef={videoRef}
                onFileLoaded={(name) => {
                  setHasFile(true);
                  setFileName(name);
                  addSystemMessage(`Loaded local file: ${name}`);
                  if (socket) {
                    socket.emit('file-loaded', { roomId, userName, fileName: name });
                  }
                }}
                hasFile={hasFile}
                syncNotification={syncNotification}
                messages={messages}
                onSendMessage={handleSendMessage}
              />

              {/* Cards Grid below player (Up Next, Room Info, People) */}
              <div className="cinema-cards-grid">
                {/* Column 1: Up Next */}
                <div className="info-card glass-panel">
                  <div className="info-card-header">
                    <Film size={16} />
                    <h4>Up Next</h4>
                  </div>
                  <div className="up-next-movie">
                    <div className="up-next-poster">
                      <Film size={24} />
                    </div>
                    <div className="up-next-details">
                      <span className="up-next-title">The Dark Knight (2008)</span>
                      <span className="up-next-meta">Action, Drama • 2h 32m</span>
                    </div>
                  </div>
                  <button className="btn btn-secondary" style={{ marginTop: '14px', width: '100%', fontSize: '0.8rem', padding: '8px 12px' }}>
                    <Plus size={14} />
                    Add to Queue
                  </button>
                </div>

                {/* Column 2: Room Info */}
                <div className="info-card glass-panel">
                  <div className="info-card-header">
                    <Info size={16} />
                    <h4>Room Info</h4>
                  </div>
                  <div className="room-details-table">
                    <div className="room-details-row">
                      <span className="room-details-label">Room Name</span>
                      <span className="room-details-value">{roomName}</span>
                    </div>
                    <div className="room-details-row">
                      <span className="room-details-label">Created by</span>
                      <span className="room-details-value">{roomCreator || userName || 'Aditya'}</span>
                    </div>
                    <div className="room-details-row">
                      <span className="room-details-label">Created at</span>
                      <span className="room-details-value">{roomCreatedAt || 'Today, 10:30 PM'}</span>
                    </div>
                    <div className="room-details-row">
                      <span className="room-details-label">Room ID</span>
                      <span className="room-details-value room-id">#{roomId}</span>
                    </div>
                  </div>
                  <button className="btn btn-danger" style={{ marginTop: '14px', width: '100%', fontSize: '0.8rem', padding: '8px 12px' }} onClick={handleLeaveRoom}>
                    Leave Room
                  </button>
                </div>

                {/* Column 3: People */}
                <div className="info-card glass-panel">
                  <div className="info-card-header">
                    <Users size={16} />
                    <h4>People ({activeUsers.length})</h4>
                  </div>
                  <div className="people-list">
                    {activeUsers.map((user, idx) => {
                      const isSelf = user === 'You' || user === userName;
                      const displayName = isSelf ? `${userName} (You)` : user;
                      return (
                        <div className="person-item" key={idx}>
                          <div className="person-left">
                            <div className="avatar" style={getAvatarStyle(isSelf ? userName : user)}>
                              {(isSelf ? userName : user).charAt(0).toUpperCase() || 'U'}
                            </div>
                            <span className="person-name">
                              {displayName}
                              {isSelf && <span style={{ color: '#fbbf24', fontSize: '10px' }}>👑</span>}
                            </span>
                          </div>
                          <div className="person-status">
                            <span className="person-status-dot"></span>
                            <span>Online</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </main>

            {/* Interactive Chat Pane */}
            <Chat 
              messages={messages}
              userName={userName}
              onSendMessage={handleSendMessage}
              activeUsers={activeUsers}
              isSimulationMode={!isRealServer}
              onTriggerSimulation={handleTriggerSimulation}
            />
          </div>

          {/* Glowing bottom footer bar */}
          <footer className="app-footer">
            <div className="footer-left">
              <Heart size={20} fill="var(--primary)" style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 4px var(--primary-glow))' }} />
              <div>
                <h4>You're watching together</h4>
                <p>Enjoy the moment ❤️</p>
              </div>
            </div>
            
            <div className="footer-center">
              <button 
                className={`footer-center-btn ${micActive ? '' : 'active'}`} 
                onClick={() => setMicActive(!micActive)}
                title={micActive ? "Mute Microphone" : "Unmute Microphone"}
              >
                {micActive ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              
              <button 
                className="footer-center-play-btn" 
                onClick={toggleFooterPlay} 
                aria-label="Toggle Play"
                title={isCinemaPlaying ? "Pause Video" : "Play Video"}
              >
                {isCinemaPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
              </button>
              
              <button 
                className={`footer-center-btn ${videoActive ? '' : 'active'}`} 
                onClick={() => setVideoActive(!videoActive)}
                title={videoActive ? "Disable Camera" : "Enable Camera"}
              >
                {videoActive ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
            </div>
            
            <div className="footer-right">
              <button className="icon-circle-btn" title="Add to favorites"><Heart size={16} /></button>
              <button className="icon-circle-btn" title="Highlight cinema"><Star size={16} /></button>
              <button className="icon-circle-btn" title="Watchlist Queue"><List size={16} /></button>
            </div>
          </footer>
        </>
      )}

      {showBackendSettings && (
        <div className="modal-backdrop fade-in" onClick={() => setShowBackendSettings(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <Settings size={20} className="modal-icon" />
              <h3>Server Connection Settings</h3>
            </div>
            <div className="modal-body">
              <p>Configure the URL of your hosted backend server. The app will attempt to connect immediately.</p>
              
              <div className="input-group">
                <label className="input-label">Backend Socket URL</label>
                <input 
                  type="text" 
                  value={tempBackendUrl}
                  onChange={(e) => setTempBackendUrl(e.target.value)}
                  placeholder="e.g. https://my-backend-server.onrender.com"
                  className="text-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="connection-status-panel">
                <span>Current Status:</span>
                <span className={`status-text ${connectionStatus}`}>
                  {connectionStatus === 'connected' ? 'CONNECTED 🟢' : connectionStatus === 'connecting' ? 'CONNECTING 🟡' : 'DISCONNECTED 🔴'}
                </span>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowBackendSettings(false);
                }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  let url = tempBackendUrl.trim();
                  if (url.endsWith('/')) {
                    url = url.slice(0, -1);
                  }
                  localStorage.setItem('custom_backend_url', url);
                  setBackendUrl(url);
                  setShowBackendSettings(false);
                }}
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
