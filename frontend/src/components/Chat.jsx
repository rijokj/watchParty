import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Users, Sparkles, Smile, Image, Minimize2 } from 'lucide-react';

export const Chat = ({ messages, onSendMessage, userName, activeUsers, isSimulationMode, onTriggerSimulation, className }) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesContainerRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const emojis = ['😊', '😍', '😂', '❤️', '💕', '😘', '👍', '🎉', '🔥', '😭', '😮', '🙄', '🤫', '😴', '🥳', '🥺', '🎬', '🍿', '🌸', '✨'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  // Close emoji picker if clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleEmojiSelect = (emoji) => {
    setInputText(prev => prev + emoji);
    // Keep focus on the text input after choosing an emoji
    const inputEl = document.querySelector('.chat-text-input');
    if (inputEl) inputEl.focus();
  };

  // Scroll to bottom of the chat container only whenever messages array changes
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Helper to determine avatar color gradient
  const getAvatarStyle = (name) => {
    const cleanName = name?.trim().toLowerCase() || '';
    if (cleanName.includes('priya')) {
      return { background: 'linear-gradient(135deg, #ff4b91, #a855f7)', border: '1px solid rgba(255, 75, 145, 0.3)' };
    }
    if (cleanName.includes('aditya') || cleanName.includes('sarah') || cleanName === 'you') {
      return { background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: '1px solid rgba(59, 130, 246, 0.3)' };
    }
    return { background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: '1px solid rgba(139, 92, 246, 0.3)' };
  };

  return (
    <aside className={`chat-sidebar ${className || ''}`}>
      <div className="chat-header">
        <h3>
          <MessageSquare size={18} style={{ color: 'var(--primary)' }} />
          Chat
        </h3>
        <div className="badge">
          <Users size={12} />
          <span>{activeUsers?.length || 2} Online</span>
        </div>
      </div>

      <div className="chat-messages" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Sparkles size={24} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
            <p style={{ fontSize: '0.85rem' }}>No messages yet. Send a message to start conversing!</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="system-message">
                  {msg.text}
                </div>
              );
            }

            const isOutgoing = msg.user === userName || msg.user === 'You';
            return (
              <div 
                key={msg.id} 
                className={`message-bubble-row ${isOutgoing ? 'outgoing' : 'incoming'}`}
              >
                {/* Rounded Avatar with initial letter */}
                <div className="avatar" style={getAvatarStyle(msg.user)}>
                  {msg.user?.charAt(0).toUpperCase() || 'U'}
                </div>

                <div className="message-bubble">
                  <div className="message-user-info">
                    <span className="message-user-name">{msg.user}</span>
                    <span className="message-time">{msg.time || '10:42 PM'}</span>
                  </div>
                  <div className="message-text-bubble">
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Simulator Dashboard (Visible in Phase 2 for client-sync demonstration) */}
      {isSimulationMode && (
        <div className="simulation-panel" style={{ borderTop: '1px solid var(--border-color)', background: 'rgba(255, 75, 145, 0.02)' }}>
          <h4 style={{ color: 'var(--primary)' }}>Simulator Sandbox Controls</h4>
          <div className="simulation-actions">
            <button className="btn-sim" onClick={() => onTriggerSimulation('peer-play')}>
              Simulate Peer Play
            </button>
            <button className="btn-sim" onClick={() => onTriggerSimulation('peer-pause')}>
              Simulate Peer Pause
            </button>
            <button className="btn-sim" onClick={() => onTriggerSimulation('peer-seek')}>
              Simulate Peer Seek
            </button>
            <button className="btn-sim" onClick={() => onTriggerSimulation('peer-msg')}>
              Simulate Peer Message
            </button>
          </div>
        </div>
      )}

      {/* Beautiful overhauled input wrapper with emojis/attachment buttons */}
      <form onSubmit={handleSubmit} className="chat-input-form-wrapper">
        <div className="chat-input-card" style={{ position: 'relative' }}>
          {showEmojiPicker && (
            <div className="emoji-picker-popover" ref={emojiPickerRef}>
              {emojis.map((emoji, idx) => (
                <button 
                  type="button" 
                  key={idx} 
                  className="emoji-btn" 
                  onClick={() => handleEmojiSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="chat-text-input"
          />
          <div className="chat-input-footer-row">
            <div className="chat-attachment-actions">
              <button 
                type="button" 
                className={`chat-action-icon-btn ${showEmojiPicker ? 'active' : ''}`} 
                title="Add Emoji"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile size={18} />
              </button>
              <button type="button" className="chat-action-icon-btn" title="Attach Image">
                <Image size={18} />
              </button>
            </div>
            <button type="submit" className="chat-send-btn" aria-label="Send Message">
              <Send size={16} />
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
};
