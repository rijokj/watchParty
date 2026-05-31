import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, FileVideo, RotateCcw, RotateCw, Activity, Tv, Cast, MessageSquare, Send, Plus } from 'lucide-react';

export const CustomPlayer = ({ videoRef, onFileLoaded, hasFile, syncNotification, messages, onSendMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fileName, setFileName] = useState('');
  const [videoSrc, setVideoSrc] = useState('');
  
  // Custom & Inbuilt subtitle states and active menu triggers
  const [activePopover, setActivePopover] = useState(null); // 'speed' | 'subtitles' | null
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [customTracks, setCustomTracks] = useState([]);
  const [inbuiltTracks, setInbuiltTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState('off');

  const speedPopoverRef = useRef(null);
  const subtitlePopoverRef = useRef(null);
  
  const [danmakus, setDanmakus] = useState([]);
  const [floatingInputText, setFloatingInputText] = useState('');
  const [showFloatingChatInput, setShowFloatingChatInput] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState(null); // 'rewind' or 'forward'
  const lastTapRef = useRef(0);

  // Auto-hide controls on mouse idle helper
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  };

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  // Sync controls visibility state with playing/paused state changes
  useEffect(() => {
    if (isPlaying) {
      resetControlsTimeout();
    } else {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // Clean up Blob URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  // Reset subtitles and speed when video source changes
  useEffect(() => {
    setCustomTracks([]);
    setSelectedTrackId('off');
    setInbuiltTracks([]);
    setPlaybackSpeed(1);
    if (videoRef.current) {
      videoRef.current.playbackRate = 1;
    }
  }, [videoSrc, videoRef]);

  // Manage track modes based on selectedTrackId
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const trackId = t.id || t.label ? `track-${t.label}` : `track-idx-${i}`;
      if (selectedTrackId === trackId) {
        t.mode = 'showing';
      } else {
        t.mode = 'disabled';
      }
    }
  }, [selectedTrackId, customTracks, inbuiltTracks, videoRef]);

  // Scan and register inbuilt and custom tracks
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTrackChange = () => {
      const tracksList = Array.from(video.textTracks || []).map((t, idx) => ({
        id: t.id || t.label ? `track-${t.label}` : `track-idx-${idx}`,
        label: t.label || `Track ${idx + 1} (${t.language || 'unknown'})`,
        language: t.language,
        kind: t.kind,
        inbuilt: !customTracks.some(ct => ct.label === t.label)
      }));
      setInbuiltTracks(tracksList.filter(t => t.inbuilt));
    };

    if (video.textTracks) {
      video.textTracks.addEventListener('addtrack', handleTrackChange);
      video.textTracks.addEventListener('removetrack', handleTrackChange);
    }

    video.addEventListener('loadedmetadata', handleTrackChange);
    handleTrackChange();

    return () => {
      if (video.textTracks) {
        video.textTracks.removeEventListener('addtrack', handleTrackChange);
        video.textTracks.removeEventListener('removetrack', handleTrackChange);
      }
      video.removeEventListener('loadedmetadata', handleTrackChange);
    };
  }, [videoRef, customTracks, hasFile]);

  // Sync state with ratechange event
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleRateChange = () => {
      setPlaybackSpeed(video.playbackRate);
    };

    video.addEventListener('ratechange', handleRateChange);
    return () => {
      video.removeEventListener('ratechange', handleRateChange);
    };
  }, [videoRef, hasFile]);

  // Handle click outside popovers
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        (speedPopoverRef.current && !speedPopoverRef.current.contains(e.target)) &&
        (subtitlePopoverRef.current && !subtitlePopoverRef.current.contains(e.target))
      ) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Convert SRT subtitles to WebVTT format
  const convertSrtToVtt = (srtText) => {
    let vttText = 'WEBVTT\n\n';
    let normalized = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const timestampRegex = /(\d{2}:\d{2}:\d{2}),(\d{3})/g;
    normalized = normalized.replace(timestampRegex, '$1.$2');
    vttText += normalized;
    return vttText;
  };

  // Upload and register custom subtitles file
  const handleSubtitleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target.result;
      
      if (file.name.endsWith('.srt')) {
        text = convertSrtToVtt(text);
      }
      
      const blob = new Blob([text], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);
      
      const newTrack = {
        id: `track-${file.name}`,
        label: file.name,
        src: url,
        kind: 'subtitles',
        srclang: 'custom',
        default: true
      };
      
      setCustomTracks(prev => [...prev, newTrack]);
      setSelectedTrackId(newTrack.id);
      setActivePopover(null);
    };
    reader.readAsText(file);
  };

  // Video element event listeners for updating internal control UI state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlayState = () => setIsPlaying(true);
    const handlePauseState = () => setIsPlaying(false);
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
    };

    video.addEventListener('play', handlePlayState);
    video.addEventListener('pause', handlePauseState);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);

    return () => {
      video.removeEventListener('play', handlePlayState);
      video.removeEventListener('pause', handlePauseState);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
    };
  }, [videoRef, hasFile]);

  // Sync state with browser fullscreen event
  useEffect(() => {
    const handleFullscreenChange = () => {
      const currentFullscreen = document.fullscreenElement === containerRef.current;
      setIsFullscreen(currentFullscreen);
      if (!currentFullscreen) {
        setShowFloatingChatInput(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Listen for incoming messages to spawn flying text (Danmaku)
  useEffect(() => {
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      console.log('[Socket Debug] CustomPlayer evaluated last message from array:', lastMsg);
      if (lastMsg && lastMsg.type === 'user') {
        const id = lastMsg.id;
        setDanmakus((prev) => {
          if (prev.some((d) => d.id === id)) return prev;
          return [
            ...prev,
            {
              id,
              user: lastMsg.user,
              text: lastMsg.text,
              top: 8 + Math.random() * 65, // distribute top position between 8% and 73%
              duration: 8 + Math.random() * 4 // speed between 8s and 12s
            }
          ];
        });
      }
    }
  }, [messages]);

  const removeDanmaku = (id) => {
    setDanmakus((prev) => prev.filter((d) => d.id !== id));
  };

  const handleFloatingSubmit = (e) => {
    e.preventDefault();
    if (!floatingInputText.trim()) {
      setShowFloatingChatInput(false);
      return;
    }
    onSendMessage(floatingInputText);
    setFloatingInputText('');
  };

  const handleFloatingKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowFloatingChatInput(false);
      if (containerRef.current) containerRef.current.focus();
    }
  };

  // Handle local file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      loadVideoFile(file);
    }
  };

  const loadVideoFile = (file) => {
    setFileName(file.name);
    const blobUrl = URL.createObjectURL(file);
    setVideoSrc(blobUrl);
    onFileLoaded(file.name);
  };

  const triggerDoubleTapFeedback = (type) => {
    setDoubleTapFeedback(type);
    setTimeout(() => setDoubleTapFeedback(null), 600);
  };

  // Handle tap/click on video element
  const handleVideoClick = (e) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    const timeDiff = now - lastTapRef.current;

    if (timeDiff < DOUBLE_TAP_DELAY) {
      // Double tap detected!
      if (videoRef.current) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;

        if (x < width / 2) {
          // Left side double tap: rewind 10s
          skipTime(-10);
          triggerDoubleTapFeedback('rewind');
        } else {
          // Right side double tap: forward 10s
          skipTime(10);
          triggerDoubleTapFeedback('forward');
        }
      }
    } else {
      // Single tap detected!
      if (window.innerWidth < 768) {
        // On touch screens, a tap should always reveal/reset the controls UI overlay
        resetControlsTimeout();
      } else {
        togglePlay();
      }
    }
    lastTapRef.current = now;
  };

  // Play/Pause Action
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(e => console.log('Autoplay block:', e));
    }
  };

  // Skip Forward/Backward 10 seconds
  const skipTime = (amount) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + amount));
  };

  // Seek Timeline Action
  const handleTimelineChange = (e) => {
    if (!videoRef.current || !duration) return;
    const clickPercent = e.target.value / 100;
    videoRef.current.currentTime = clickPercent * duration;
    setCurrentTime(clickPercent * duration);
  };

  // Volume Action
  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      videoRef.current.muted = vol === 0;
    }
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    videoRef.current.muted = newMuteState;
    if (videoRef.current) {
      videoRef.current.volume = newMuteState ? 0 : volume || 0.5;
    }
  };

  // Fullscreen Action
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Drag and Drop files
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      loadVideoFile(file);
    }
  };

  // Time Formatter
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '0:00';
    const hours = Math.floor(timeInSeconds / 3600);
    const mins = Math.floor((timeInSeconds % 3600) / 60);
    const secs = Math.floor(timeInSeconds % 60);

    const formattedSecs = secs < 10 ? `0${secs}` : secs;
    if (hours > 0) {
      const formattedMins = mins < 10 ? `0${mins}` : mins;
      return `${hours}:${formattedMins}:${formattedSecs}`;
    }
    return `${mins}:${formattedSecs}`;
  };

  const getAvatarStyle = (name) => {
    const cleanName = name?.trim().toLowerCase() || '';
    if (cleanName.includes('priya')) {
      return { background: 'linear-gradient(135deg, #ff4b91, #a855f7)', border: '1px solid rgba(255, 75, 145, 0.3)' };
    }
    return { background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: '1px solid rgba(59, 130, 246, 0.3)' };
  };

  const percentProgress = duration ? (currentTime / duration) * 100 : 0;

  if (!hasFile) {
    return (
      <div 
        className={`file-upload-zone glass-panel fade-in ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          minHeight: '300px', 
          width: '100%', 
          aspectRatio: '16/9',
          border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--border-color)',
          background: isDragging ? 'rgba(255, 75, 145, 0.03)' : 'rgba(255, 255, 255, 0.005)'
        }}
      >
        <input 
          type="file" 
          accept="video/*" 
          onChange={handleFileChange}
          id="file-selector"
          style={{ display: 'none' }}
        />
        <label htmlFor="file-selector" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <FileVideo size={64} className="file-upload-icon" />
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Choose a Local Movie File</h3>
            <p style={{ marginTop: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Drag & drop a video file here, or click to browse
            </p>
          </div>
          <span className="btn btn-primary" style={{ marginTop: '12px' }}>
            Select File
          </span>
        </label>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`player-wrapper ${showControls ? 'show-controls' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video 
        ref={videoRef}
        src={videoSrc}
        className="player-video"
        onClick={handleVideoClick}
        playsInline
      >
        {customTracks.map((track) => (
          <track
            key={track.id}
            id={track.id}
            label={track.label}
            src={track.src}
            kind={track.kind}
            srcLang={track.srclang}
            default={selectedTrackId === track.id}
          />
        ))}
      </video>

      {/* Double Tap Skip Feedback overlay */}
      {doubleTapFeedback && (
        <div className="double-tap-feedback">
          {doubleTapFeedback === 'rewind' ? (
            <div className="feedback-content">
              <RotateCcw size={36} />
              <span>-10s</span>
            </div>
          ) : (
            <div className="feedback-content">
              <RotateCw size={36} />
              <span>+10s</span>
            </div>
          )}
        </div>
      )}

      {/* Danmaku reactions container */}
      <div className="danmaku-container">
        {danmakus.map((d) => (
          <div
            key={d.id}
            className="danmaku-text"
            style={{
              top: `${d.top}%`,
              animationDuration: `${d.duration}s`
            }}
            onAnimationEnd={() => removeDanmaku(d.id)}
          >
            <span className="danmaku-user">{d.user}:</span>
            {d.text}
          </div>
        ))}
      </div>

      {/* Floating fullscreen chat input overlay */}
      {isFullscreen && showFloatingChatInput && (
        <form onSubmit={handleFloatingSubmit} className="player-floating-chat-input-form">
          <input
            type="text"
            value={floatingInputText}
            onChange={(e) => setFloatingInputText(e.target.value)}
            onKeyDown={handleFloatingKeyDown}
            placeholder="Type a reaction... (Press Esc to close)"
            className="player-floating-chat-input"
            autoFocus
          />
          <button type="submit" className="player-floating-chat-send-btn">
            <Send size={14} />
          </button>
        </form>
      )}
      
      {/* Floating Sync Action Announcement inside Player */}
      {syncNotification && (
        <div className="player-sync-toast">
          <div className="player-sync-toast-avatar" style={getAvatarStyle(syncNotification.userName)}>
            {syncNotification.userName?.charAt(0).toUpperCase() || 'P'}
          </div>
          <span className="player-sync-toast-text">{syncNotification.text}</span>
          <span className="player-sync-toast-time">{syncNotification.time}</span>
        </div>
      )}

      {/* Sleek Custom Controls Overlay */}
      <div className="player-overlay">
        {/* Top bar with UI icons (No movie filename title overlay) */}
        <div className="player-overlay-top" style={{ justifyContent: 'flex-end' }}>
          <div className="player-overlay-top-actions">
            <button className="player-btn" title="Cast Screen"><Cast size={18} /></button>
            <button 
              className={`player-btn ${showFloatingChatInput ? 'active' : ''}`}
              onClick={() => isFullscreen && setShowFloatingChatInput(prev => !prev)}
              title={isFullscreen ? "React to movie" : "Chat reactions only in fullscreen"}
              style={{ 
                opacity: isFullscreen ? 1 : 0.4, 
                cursor: isFullscreen ? 'pointer' : 'not-allowed',
                background: showFloatingChatInput ? 'var(--primary)' : 'transparent',
                color: showFloatingChatInput ? 'white' : 'var(--text-primary)'
              }}
            >
              <MessageSquare size={18} />
            </button>
            <button className="player-btn" onClick={toggleFullscreen} title="Toggle Fullscreen"><Maximize2 size={18} /></button>
          </div>
        </div>

        {/* Bottom controls panel */}
        <div className="player-overlay-bottom" style={{ position: 'relative' }}>
          {/* Custom Timeline slider */}
          <div className="player-timeline-container">
            <input 
              type="range"
              min="0"
              max="100"
              value={percentProgress}
              onChange={handleTimelineChange}
              className="player-timeline-slider"
              style={{
                background: `linear-gradient(to right, var(--primary) ${percentProgress}%, rgba(255,255,255,0.15) ${percentProgress}%)`
              }}
            />
          </div>

          <div className="player-controls">
            <div className="player-controls-left">
              <button className="player-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>

              <button className="player-btn" onClick={() => skipTime(-10)} title="Rewind 10s">
                <RotateCcw size={18} />
              </button>

              <button className="player-btn" onClick={() => skipTime(10)} title="Forward 10s">
                <RotateCw size={18} />
              </button>

              <div className="player-volume-container">
                <button className="player-btn" onClick={toggleMute} aria-label="Mute">
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="player-volume-slider"
                />
              </div>

              <div className="player-time">
                {formatTime(currentTime)}
              </div>
            </div>

            <div className="player-controls-right">
              <div className="player-time" style={{ marginRight: '10px' }}>
                {formatTime(duration)}
              </div>

              {/* CC indicator */}
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover(prev => prev === 'subtitles' ? null : 'subtitles');
                }}
                style={{
                  color: selectedTrackId !== 'off' || activePopover === 'subtitles' ? 'var(--primary)' : 'var(--text-primary)',
                  border: `1.5px solid ${selectedTrackId !== 'off' || activePopover === 'subtitles' ? 'var(--primary)' : 'currentColor'}`,
                  borderRadius: '4px',
                  padding: '2px 5px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  lineHeight: 1,
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }} 
                title="Closed Captions"
              >
                CC
              </div>

              {/* Speed select */}
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover(prev => prev === 'speed' ? null : 'speed');
                }}
                style={{ 
                  fontSize: '13px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  color: playbackSpeed !== 1 || activePopover === 'speed' ? 'var(--primary)' : 'var(--text-secondary)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                {playbackSpeed === 1 ? '1.0x' : `${playbackSpeed}x`}
              </span>

              <button className="player-btn" onClick={toggleFullscreen} aria-label="Toggle Fullscreen">
                <Maximize2 size={18} />
              </button>
            </div>
          </div>

          {/* Subtitles Popover Menu */}
          {activePopover === 'subtitles' && (
            <div ref={subtitlePopoverRef} className="player-popover player-popover-right" style={{ bottom: '75px', right: '90px', width: '250px' }}>
              <div className="popover-header">Subtitles</div>
              
              <button
                className={`popover-item ${selectedTrackId === 'off' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedTrackId('off');
                  setActivePopover(null);
                }}
              >
                Off
              </button>
              
              {inbuiltTracks.length > 0 && (
                <>
                  <div className="popover-divider" />
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', padding: '4px 10px', textTransform: 'uppercase' }}>Inbuilt Subtitles</div>
                  {inbuiltTracks.map((track) => (
                    <button
                      key={track.id}
                      className={`popover-item ${selectedTrackId === track.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedTrackId(track.id);
                        setActivePopover(null);
                      }}
                    >
                      {track.label}
                    </button>
                  ))}
                </>
              )}
              
              {customTracks.length > 0 && (
                <>
                  <div className="popover-divider" />
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', padding: '4px 10px', textTransform: 'uppercase' }}>Custom Subtitles</div>
                  {customTracks.map((track) => (
                    <button
                      key={track.id}
                      className={`popover-item ${selectedTrackId === track.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedTrackId(track.id);
                        setActivePopover(null);
                      }}
                    >
                      {track.label.length > 20 ? `${track.label.substring(0, 17)}...` : track.label}
                    </button>
                  ))}
                </>
              )}
              
              <div className="popover-divider" />
              
              <input 
                type="file" 
                accept=".srt,.vtt" 
                onChange={handleSubtitleUpload}
                id="subtitle-file-selector"
                style={{ display: 'none' }}
              />
              <label htmlFor="subtitle-file-selector" className="subtitle-upload-btn">
                <Plus size={14} />
                <span>Upload Subtitle (.srt, .vtt)</span>
              </label>
            </div>
          )}

          {/* Speed Popover Menu */}
          {activePopover === 'speed' && (
            <div ref={speedPopoverRef} className="player-popover player-popover-right" style={{ bottom: '75px', right: '40px' }}>
              <div className="popover-header">Playback Speed</div>
              {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((speed) => (
                <button
                  key={speed}
                  className={`popover-item ${playbackSpeed === speed ? 'active' : ''}`}
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.playbackRate = speed;
                    }
                    setActivePopover(null);
                  }}
                >
                  {speed === 1.0 ? 'Normal (1.0x)' : `${speed}x`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
