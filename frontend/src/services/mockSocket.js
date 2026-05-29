class MockSocket {
  constructor() {
    this.listeners = {};
    this.connected = true;
    this.id = 'mock-user-123';
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    console.log(`[Mock Socket EMIT] ${event}`, data);
    
    // Simulate automatic responses to verify frontend logic
    if (event === 'join-room') {
      setTimeout(() => {
        this.trigger('user-connected', { userId: 'peer-456', userName: 'Partner' });
        this.trigger('system-message', { text: `Partner has joined room ${data.roomId}` });
      }, 1000);
    }
  }

  // Trigger local callbacks (simulating incoming server event)
  trigger(event, data) {
    console.log(`[Mock Socket RECEIVE] ${event}`, data);
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
}

export const mockSocket = new MockSocket();
