import { useEffect, useRef } from 'react';

export const useVideoSync = (videoRef, socket, roomId, onSystemMessage, userName, hasFile) => {
  const isProgrammaticPlay = useRef(false);
  const isProgrammaticPause = useRef(false);
  const isProgrammaticSeek = useRef(false);
  const isProgrammaticSpeed = useRef(false);

  useEffect(() => {
    if (!videoRef.current || !socket || !roomId) return;

    const video = videoRef.current;

    // Helpers to lock local emits during remote events
    const runProgrammaticPlay = (action) => {
      isProgrammaticPlay.current = true;
      action();
      setTimeout(() => {
        isProgrammaticPlay.current = false;
      }, 800); // 800ms safety window for native play event to fire
    };

    const runProgrammaticPause = (action) => {
      isProgrammaticPause.current = true;
      action();
      setTimeout(() => {
        isProgrammaticPause.current = false;
      }, 800); // 800ms safety window for native pause event to fire
    };

    const runProgrammaticSeek = (action) => {
      isProgrammaticSeek.current = true;
      action();
      setTimeout(() => {
        isProgrammaticSeek.current = false;
      }, 800); // 800ms safety window for native seeked event to fire
    };

    const runProgrammaticSpeed = (action) => {
      isProgrammaticSpeed.current = true;
      action();
      setTimeout(() => {
        isProgrammaticSpeed.current = false;
      }, 800); // 800ms safety window for native ratechange event to fire
    };

    // Video Event Handlers (Local user actions)
    const handlePlay = () => {
      if (isProgrammaticPlay.current) return;
      console.log('[Local Sync] Emitting play', video.currentTime);
      socket.emit('play', { roomId, time: video.currentTime, userName });
    };

    const handlePause = () => {
      if (isProgrammaticPause.current) return;
      console.log('[Local Sync] Emitting pause', video.currentTime);
      socket.emit('pause', { roomId, time: video.currentTime, userName });
    };

    const handleSeeked = () => {
      if (isProgrammaticSeek.current) return;
      console.log('[Local Sync] Emitting seek', video.currentTime);
      socket.emit('seek', { roomId, time: video.currentTime, userName });
    };

    const handleRateChange = () => {
      if (isProgrammaticSpeed.current) return;
      console.log('[Local Sync] Emitting speed-change', video.playbackRate);
      socket.emit('speed-change', { roomId, speed: video.playbackRate, userName });
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('ratechange', handleRateChange);

    // Socket Event Handlers (Remote peer actions)
    const handleRemotePlay = (data) => {
      console.log('[Remote Sync] Received play', data);
      
      const timeDrift = Math.abs(video.currentTime - data.time);

      if (!video.paused) {
        // If already playing, sync time if drift is significant
        if (timeDrift > 1.5) {
          runProgrammaticSeek(() => {
            video.currentTime = data.time;
          });
        }
        return;
      }

      // If paused, trigger play
      if (timeDrift > 1.5) {
        runProgrammaticSeek(() => {
          video.currentTime = data.time;
        });
      }
      
      runProgrammaticPlay(() => {
        video.play().catch(e => {
          console.log('Autoplay blocked:', e);
        });
      });

      if (onSystemMessage) {
        onSystemMessage(`${data.userName || 'Partner'} played the video`, data.userName || 'Partner', 'play');
      }
    };

    const handleRemotePause = (data) => {
      console.log('[Remote Sync] Received pause', data);
      
      const timeDrift = Math.abs(video.currentTime - data.time);

      if (video.paused) {
        // If already paused, sync time if drift is significant
        if (timeDrift > 1.5) {
          runProgrammaticSeek(() => {
            video.currentTime = data.time;
          });
        }
        return;
      }

      // If playing, trigger pause
      if (timeDrift > 1.5) {
        runProgrammaticSeek(() => {
          video.currentTime = data.time;
        });
      }
      
      runProgrammaticPause(() => {
        video.pause();
      });

      if (onSystemMessage) {
        onSystemMessage(`${data.userName || 'Partner'} paused the video`, data.userName || 'Partner', 'pause');
      }
    };

    const handleRemoteSeek = (data) => {
      console.log('[Remote Sync] Received seek', data);
      
      const timeDrift = Math.abs(video.currentTime - data.time);
      if (timeDrift < 0.5) return; // Ignore micro-seeks to prevent jitter

      runProgrammaticSeek(() => {
        video.currentTime = data.time;
      });

      if (onSystemMessage) {
        onSystemMessage(`${data.userName || 'Partner'} seeked to ${formatTime(data.time)}`, data.userName || 'Partner', 'seek');
      }
    };

    const handleRemoteSpeed = (data) => {
      console.log('[Remote Sync] Received speed-change', data);
      
      runProgrammaticSpeed(() => {
        video.playbackRate = data.speed;
      });

      if (onSystemMessage) {
        onSystemMessage(`${data.userName || 'Partner'} changed playback speed to ${data.speed}x`, data.userName || 'Partner', 'speed');
      }
    };

    socket.on('play', handleRemotePlay);
    socket.on('pause', handleRemotePause);
    socket.on('seek', handleRemoteSeek);
    socket.on('speed-change', handleRemoteSpeed);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('ratechange', handleRateChange);
      socket.off('play', handleRemotePlay);
      socket.off('pause', handleRemotePause);
      socket.off('seek', handleRemoteSeek);
      socket.off('speed-change', handleRemoteSpeed);
    };
  }, [videoRef, socket, roomId, onSystemMessage, userName, hasFile]);
};

// Helper utility to format time in ss or mm:ss
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
