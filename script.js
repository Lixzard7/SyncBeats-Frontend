// ===== BACKEND CONFIG =====
// Change this to your actual Render backend URL
const BACKEND_URL = "https://my-backend-a27e.onrender.com";

class SyncBeatsApp {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.roomCode = null;
        this.isHost = false;
        this.audioPlayer = document.getElementById('audioPlayer');
        this.isPlaying = false;
        this.currentTrack = null;
        this.users = new Map();
        this.seeking = false;
        this.syncTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.heartbeatInterval = null;
        this.roomStartTime = null;
        
        this.initializeElements();
        this.bindEvents();
        this.showLoadingScreen();
        this.connectToServer();
    }

    initializeElements() {
        this.elements = {
            loadingScreen: document.getElementById('loadingScreen'),
            mainApp: document.getElementById('mainApp'),
            connectionStatus: document.getElementById('connectionStatus'),
            roomCodeInput: document.getElementById('roomCode'),
            joinBtn: document.getElementById('joinBtn'),
            createRoomBtn: document.getElementById('createRoomBtn'),
            leaveRoomBtn: document.getElementById('leaveRoomBtn'),
            userList: document.getElementById('userList'),
            userCount: document.getElementById('userCount'),
            audioFile: document.getElementById('audioFile'),
            uploadBtn: document.getElementById('uploadBtn'),
            urlBtn: document.getElementById('urlBtn'),
            uploadArea: document.getElementById('uploadArea'),
            playerSection: document.getElementById('playerSection'),
            nowPlaying: document.getElementById('nowPlaying'),
            trackMeta: document.getElementById('trackMeta'),
            playBtn: document.getElementById('playBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            progressHandle: document.getElementById('progressHandle'),
            currentTime: document.getElementById('currentTime'),
            totalTime: document.getElementById('totalTime'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue'),
            notificationContainer: document.getElementById('notificationContainer'),
            helpFab: document.getElementById('helpFab'),
            helpModal: document.getElementById('helpModal'),
            closeHelpModal: document.getElementById('closeHelpModal'),
            connectionToast: document.getElementById('connectionToast'),
            roomInfo: document.getElementById('roomInfo'),
            currentRoomCode: document.getElementById('currentRoomCode'),
            roomUserCount: document.getElementById('roomUserCount'),
            roomUptime: document.getElementById('roomUptime')
        };
    }

    bindEvents() {
        // Connection events
        this.elements.joinBtn.addEventListener('click', () => this.joinRoom());
        this.elements.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.elements.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        
        // Upload events
        this.elements.uploadBtn.addEventListener('click', () => this.elements.audioFile.click());
        this.elements.urlBtn.addEventListener('click', () => this.handleStreamURL());
        this.elements.audioFile.addEventListener('change', (e) => this.handleFileUpload(e));
        this.elements.uploadArea.addEventListener('click', () => this.elements.audioFile.click());
        
        // Player controls
        this.elements.playBtn.addEventListener('click', () => this.togglePlay());
        this.elements.prevBtn.addEventListener('click', () => this.previousTrack());
        this.elements.nextBtn.addEventListener('click', () => this.nextTrack());
        this.elements.progressBar.addEventListener('click', (e) => this.seek(e));
        this.elements.volumeSlider.addEventListener('input', (e) => this.updateVolume(e));
        
        // Audio player events
        this.audioPlayer.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer.addEventListener('ended', () => this.onTrackEnd());
        this.audioPlayer.addEventListener('canplay', () => this.onCanPlay());
        this.audioPlayer.addEventListener('error', (e) => this.onAudioError(e));
        this.audioPlayer.addEventListener('loadstart', () => this.onLoadStart());
        this.audioPlayer.addEventListener('waiting', () => this.onWaiting());
        this.audioPlayer.addEventListener('playing', () => this.onPlaying());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Room code input
        this.elements.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });

        // Help modal
        this.elements.helpFab.addEventListener('click', () => this.showHelpModal());
        this.elements.closeHelpModal.addEventListener('click', () => this.hideHelpModal());
        this.elements.helpModal.addEventListener('click', (e) => {
            if (e.target === this.elements.helpModal) {
                this.hideHelpModal();
            }
        });

        // Drag and drop
        this.setupDragAndDrop();
        
        // Window events
        window.addEventListener('beforeunload', () => this.handleBeforeUnload());
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Visibility change
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }

    showLoadingScreen() {
        this.elements.loadingScreen.style.display = 'flex';
        this.elements.mainApp.style.display = 'none';
    }

   hideLoadingScreen() {
    this.elements.loadingScreen.style.display = 'none';
    this.elements.mainApp.style.display = 'block';
    this.elements.mainApp.classList.add('animate-fadeIn');
    console.log('✅ Loading screen hidden, main app shown');
}
    // Move setupDragAndDrop inside the class
    setupDragAndDrop() {
        const uploadArea = this.elements.uploadArea;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('drag-over');
            });
        });

        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('audio/')) {
                this.handleFileUpload({ target: { files: files } });
            } else {
                this.showNotification('Please drop a valid audio file! 🎵', 'error');
            }
        });
}

connectToServer() {
    try {
        console.log('🔌 Connecting to SyncBeats server...');
            
            this.socket = io((BACKEND_URL, {
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 10000
            });
            
            this.setupSocketEvents();
            
        } catch (error) {
            console.error('❌ Socket connection error:', error);
            this.showNotification('Failed to initialize connection 😞', 'error');
            this.hideLoadingScreen();
        }
    }

    setupSocketEvents() {
        // Connection events
       this.socket.on('connect', () => {
    console.log('✅ Connected to server');
    this.elements.connectionStatus.classList.add('connected');
    this.reconnectAttempts = 0;
    this.hideConnectionToast();
    this.startHeartbeat();
    this.hideLoadingScreen(); // ← This will now work immediately
});

        this.socket.on('connected', (data) => {
            this.userId = data.userId;
            console.log('📋 Received user ID:', this.userId);
            this.showNotification(`Connected! Welcome to SyncBeats ${data.version} 🎉`, 'success');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from server:', reason);
            this.elements.connectionStatus.classList.remove('connected');
            this.showConnectionToast('Disconnected from server');
            this.stopHeartbeat();
            
            if (reason === 'io server disconnect') {
                this.socket.connect();
            }
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconnected after', attemptNumber, 'attempts');
            this.showNotification('Reconnected successfully! 🎉', 'success');
            this.hideConnectionToast();
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('🔄 Reconnect attempt', attemptNumber);
            this.showConnectionToast(`Reconnecting... (${attemptNumber}/${this.maxReconnectAttempts})`);
        });

        this.socket.on('reconnect_failed', () => {
            console.log('💀 Reconnection failed');
            this.showNotification('Failed to reconnect. Please refresh the page. 😞', 'error');
            this.hideConnectionToast();
        });

        // Room events
        this.socket.on('user-joined', (data) => {
            console.log('👋 User joined:', data.userId);
            this.showNotification('Someone joined the room! 👋', 'info');
            this.updateRoomState(data.roomState);
        });

        this.socket.on('user-left', (data) => {
            console.log('👋 User left:', data.userId);
            this.showNotification('Someone left the room 👋', 'info');
            this.updateRoomState(data.roomState);
        });

        this.socket.on('host-changed', (data) => {
            const wasHost = this.isHost;
            this.isHost = data.newHostId === this.userId;
            
            if (this.isHost && !wasHost) {
                this.showNotification('🎉 You are now the host! You can control the music 👑', 'success');
            } else if (!this.isHost && wasHost) {
                this.showNotification('👑 Host privileges transferred to another user', 'info');
            }
            
            this.updateRoomState(data.roomState);
            this.updateControlsState();
        });

        // Music events
        this.socket.on('track-changed', (data) => {
            console.log('🎵 Track changed:', data.track.title);
            this.loadTrackFromData(data.track);
            this.updateRoomState(data.roomState);
            this.showNotification(`Track loaded: ${data.track.title} 🎵`, 'info');
        });

        this.socket.on('sync-play', (data) => {
            console.log('▶️ Sync play command received');
            this.syncPlay(data.startTime, data.syncTime);
            this.updateRoomState(data.roomState);
        });

        this.socket.on('sync-pause', (data) => {
            console.log('⏸️ Sync pause command received');
            this.syncPause(data.currentTime);
            this.updateRoomState(data.roomState);
        });

        this.socket.on('sync-seek', (data) => {
            console.log('⏭️ Sync seek command received');
            this.syncSeek(data.time, data.syncTime, data.isPlaying);
            this.updateRoomState(data.roomState);
        });

        // Server events
        this.socket.on('server-shutdown', (data) => {
            this.showNotification('Server is shutting down. Please refresh the page later. 🔄', 'warning');
        });

        // Error handling
        this.socket.on('error', (data) => {
            console.error('🚨 Server error:', data.message);
            this.showNotification(data.message, 'error');
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            this.showNotification('Connection failed. Retrying... 🔄', 'error');
            this.showConnectionToast('Connection failed');
        });
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('ping', (response) => {
                    if (response) {
                        console.log('💓 Heartbeat OK, latency:', Date.now() - response.timestamp, 'ms');
                    }
                });
            }
        }, 30000); // 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    createRoom() {
        if (!this.socket || !this.socket.connected) {
            this.showNotification('Not connected to server! Please wait... 🔄', 'error');
            return;
        }

        this.setButtonLoading(this.elements.createRoomBtn, true);

        this.socket.emit('create-room', (response) => {
            this.setButtonLoading(this.elements.createRoomBtn, false);

            if (response.success) {
                this.roomCode = response.roomCode;
                this.isHost = response.isHost;
                this.roomStartTime = Date.now();
                this.elements.roomCodeInput.value = response.roomCode;
                this.showNotification(`Room created: ${response.roomCode} 🏠`, 'success');
                this.updateRoomState(response.roomState);
                this.updateControlsState();
                this.showRoomInfo();
                this.startRoomTimer();
            } else {
                this.showNotification(`Failed to create room: ${response.error}`, 'error');
            }
        });
    }

   // Replace the joinRoom() method in your script.js with this fixed version:

joinRoom() {
  const code = this.elements.roomCodeInput.value.trim().toUpperCase();
  
  // Better validation
  if (!code) {
    this.showNotification('Please enter a room code! 📝', 'error');
    this.elements.roomCodeInput.focus();
    return;
  }

  if (code.length < 3 || code.length > 20) {
    this.showNotification('Room code must be 3-20 characters long! 📝', 'error');
    return;
  }

  if (!this.socket || !this.socket.connected) {
    this.showNotification('Not connected to server! Please wait... 🔄', 'error');
    return;
  }

  console.log('Attempting to join room:', code); // Debug log

  this.setButtonLoading(this.elements.joinBtn, true);

  // Add timeout to prevent hanging
  const timeoutId = setTimeout(() => {
    this.setButtonLoading(this.elements.joinBtn, false);
    this.showNotification('Join room request timed out. Please try again.', 'error');
  }, 10000);

  this.socket.emit('join-room', code, (response) => {
    clearTimeout(timeoutId);
    this.setButtonLoading(this.elements.joinBtn, false);

    console.log('Join room response:', response); // Debug log

    if (response && response.success) {
      this.roomCode = response.roomCode;
      this.isHost = response.isHost;
      this.roomStartTime = response.roomState.createdAt;
      this.showNotification(`Joined room: ${response.roomCode} 🚀`, 'success');
      this.updateRoomState(response.roomState);
      this.updateControlsState();
      this.showRoomInfo();
      this.startRoomTimer();

      // If there's a current track, load it
      if (response.roomState.currentTrack) {
        this.loadTrackFromData(response.roomState.currentTrack);
        
        // Sync with current playback state
        if (response.roomState.isPlaying) {
          const currentTime = response.roomState.currentTime;
          setTimeout(() => {
            this.syncPlay(currentTime, Date.now());
          }, 100);
        }
      }
    } else {
      const errorMsg = response ? response.error : 'Unknown error occurred';
      this.showNotification(`Failed to join room: ${errorMsg}`, 'error');
      console.error('Join room failed:', response);
    }
  });
}

    showRoomInfo() {
        this.elements.roomInfo.style.display = 'block';
        this.elements.currentRoomCode.textContent = this.roomCode;
        this.elements.leaveRoomBtn.style.display = 'inline-block';
    }

    hideRoomInfo() {
        this.elements.roomInfo.style.display = 'none';
        this.elements.leaveRoomBtn.style.display = 'none';
    }

    startRoomTimer() {
        if (this.roomTimerInterval) {
            clearInterval(this.roomTimerInterval);
        }
        
        this.roomTimerInterval = setInterval(() => {
            if (this.roomStartTime) {
                const uptime = Date.now() - this.roomStartTime;
                this.elements.roomUptime.textContent = this.formatDuration(uptime);
            }
        }, 1000);
    }

    stopRoomTimer() {
        if (this.roomTimerInterval) {
            clearInterval(this.roomTimerInterval);
            this.roomTimerInterval = null;
        }
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('audio/')) {
            this.showNotification('Please select a valid audio file! 🎵', 'error');
            return;
        }

        if (!this.isHost) {
            this.showNotification('Only the host can upload tracks! 👑', 'error');
            return;
        }

        if (file.size > 100 * 1024 * 1024) { // 100MB
            this.showNotification('File too large! Maximum size is 100MB. 📁', 'error');
            return;
        }

        await this.uploadFile(file);
    }

    async uploadFile(file) {
        try {
            this.setButtonLoading(this.elements.uploadBtn, true);
            this.elements.uploadBtn.textContent = 'Uploading...';

            const formData = new FormData();
            formData.append('audio', file);

            const response = await fetch(`${BACKEND_URL}/api/upload' , {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                const trackData = {
                    title: result.file.originalName,
                    url: result.file.url,
                    type: 'upload',
                    size: result.file.size,
                    uploadedAt: Date.now()
                };

                this.socket.emit('set-track', trackData, (response) => {
                    if (response && response.success) {
                        this.showNotification(`Track uploaded: ${trackData.title} 🎵`, 'success');
                    } else {
                        this.showNotification('Failed to set track on server', 'error');
                    }
                });
            } else {
                this.showNotification(`Upload failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('❌ Upload error:', error);
            this.showNotification('Upload failed! Please try again. 😞', 'error');
        } finally {
            this.setButtonLoading(this.elements.uploadBtn, false);
            this.elements.uploadBtn.textContent = '📁 Upload Track';
            // Reset file input
            this.elements.audioFile.value = '';
        }
    }

    handleStreamURL() {
        if (!this.isHost) {
            this.showNotification('Only the host can set tracks! 👑', 'error');
            return;
        }

        const url = prompt('Enter streaming URL (HTTP/HTTPS):');
        if (url && url.trim()) {
            try {
                const validUrl = new URL(url.trim());
                if (validUrl.protocol === 'http:' || validUrl.protocol === 'https:') {
                    const trackData = {
                        title: this.extractTitleFromUrl(url) || 'Streamed Track',
                        url: url.trim(),
                        type: 'stream'
                    };

                    this.socket.emit('set-track', trackData, (response) => {
                        if (response && response.success) {
                            this.showNotification(`Stream URL set: ${trackData.title} 🌐`, 'success');
                        } else {
                            this.showNotification('Failed to set stream URL', 'error');
                        }
                    });
                } else {
                    this.showNotification('Please enter a valid HTTP/HTTPS URL', 'error');
                }
            } catch (error) {
                this.showNotification('Invalid URL format', 'error');
            }
        }
    }

    extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            return filename.split('.')[0] || 'Streamed Track';
        } catch {
            return 'Streamed Track';
        }
    }

    loadTrackFromData(trackData) {
        this.currentTrack = trackData;
        this.audioPlayer.src = trackData.url;
        this.elements.nowPlaying.textContent = trackData.title;
        
        // Update track metadata
        let metaText = `${trackData.type === 'upload' ? '📁' : '🌐'} ${trackData.type}`;
        if (trackData.size) {
            metaText += ` • ${this.formatFileSize(trackData.size)}`;
        }
        this.elements.trackMeta.textContent = metaText;
        
        this.elements.playerSection.style.display = 'block';
        this.updateControlsState();
    }

    togglePlay() {
        if (!this.currentTrack) {
            this.showNotification('No track loaded! Please upload or stream a track first. 🎵', 'error');
            return;
        }

        if (!this.isHost) {
            this.showNotification('Only the host can control playback! 👑', 'error');
            return;
        }

        if (this.isPlaying) {
            this.socket.emit('pause', (response) => {
                if (response && !response.success) {
                    this.showNotification('Failed to pause track', 'error');
                }
            });
        } else {
            this.socket.emit('play', this.audioPlayer.currentTime, (response) => {
                if (response && !response.success) {
                    this.showNotification('Failed to play track', 'error');
                }
            });
        }
    }

    syncPlay(startTime, syncTime) {
        if (!this.currentTrack) return;

        const now = Date.now();
        const delay = Math.max(0, syncTime - now);
        
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        this.syncTimeout = setTimeout(async () => {
            try {
                this.audioPlayer.currentTime = startTime;
                await this.audioPlayer.play();
                this.isPlaying = true;
                this.elements.playBtn.textContent = '⏸️';
                this.elements.playBtn.title = 'Pause';
                console.log('✅ Synced play at:', startTime);
            } catch (error) {
                console.error('❌ Play error:', error);
                this.showNotification('Playback failed! Check audio format. 😞', 'error');
            }
        }, delay);
    }

    syncPause(currentTime) {
        if (!this.currentTrack) return;

        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        this.audioPlayer.pause();
        if (currentTime !== undefined) {
            this.audioPlayer.currentTime = currentTime;
        }
        this.isPlaying = false;
        this.elements.playBtn.textContent = '▶️';
        this.elements.playBtn.title = 'Play';
        console.log('✅ Synced pause at:', currentTime);
    }

    syncSeek(time, syncTime, isPlaying) {
        if (!this.currentTrack) return;

        const now = Date.now();
        const delay = Math.max(0, syncTime - now);

        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        this.syncTimeout = setTimeout(async () => {
            try {
                this.audioPlayer.currentTime = time;
                
                if (isPlaying) {
                    await this.audioPlayer.play();
                    this.isPlaying = true;
                    this.elements.playBtn.textContent = '⏸️';
                    this.elements.playBtn.title = 'Pause';
                } else {
                    this.audioPlayer.pause();
                    this.isPlaying = false;
                    this.elements.playBtn.textContent = '▶️';
                    this.elements.playBtn.title = 'Play';
                }
                
                console.log('✅ Synced seek to:', time);
            } catch (error) {
                console.error('❌ Seek error:', error);
            }
        }, delay);
    }

    seek(event) {
        if (!this.currentTrack || !this.isHost) {
            if (!this.isHost) {
                this.showNotification('Only the host can seek! 👑', 'error');
            }
            return;
        }

        if (!this.audioPlayer.duration) {
            this.showNotification('Audio not ready for seeking', 'error');
            return;
        }

        const rect = this.elements.progressBar.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const width = rect.width;
        const percentage = Math.max(0, Math.min(1, clickX / width));
        const newTime = percentage * this.audioPlayer.duration;

        this.socket.emit('seek', newTime, (response) => {
            if (response && !response.success) {
                this.showNotification('Failed to seek', 'error');
            }
        });
    }

    updateVolume(event) {
        const volume = event.target.value / 100;
        this.audioPlayer.volume = volume;
        this.elements.volumeValue.textContent = `${event.target.value}%`;
        
        // Update volume icon
        const volumeIcon = this.elements.volumeSlider.previousElementSibling;
        if (volume === 0) {
            volumeIcon.textContent = '🔇';
        } else if (volume < 0.5) {
            volumeIcon.textContent = '🔉';
        } else {
            volumeIcon.textContent = '🔊';
        }
    }

    previousTrack() {
        if (!this.isHost) {
            this.showNotification('Only the host can change tracks! 👑', 'error');
            return;
        }
        this.showNotification('Previous track - Coming soon! ⏮️', 'info');
    }

    nextTrack() {
        if (!this.isHost) {
            this.showNotification('Only the host can change tracks! 👑', 'error');
            return;
        }
        this.showNotification('Next track - Coming soon! ⏭️', 'info');
    }

    updateProgress() {
        if (!this.audioPlayer.duration || this.seeking) return;

        const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
        this.elements.progressFill.style.width = `${progress}%`;
        this.elements.progressHandle.style.left = `${progress}%`;
        this.elements.currentTime.textContent = this.formatTime(this.audioPlayer.currentTime);
    }

    updateDuration() {
        if (this.audioPlayer.duration) {
            this.elements.totalTime.textContent = this.formatTime(this.audioPlayer.duration);
        }
    }

    onLoadStart() {
        console.log('🔄 Audio loading started');
    }

    onWaiting() {
        console.log('⏳ Audio buffering');
    }

    onPlaying() {
        console.log('▶️ Audio playing');
    }

    onCanPlay() {
        console.log('✅ Audio can play');
    }

    onAudioError(event) {
        console.error('❌ Audio error:', event);
        const error = this.audioPlayer.error;
        let message = 'Audio playback error! 😞';
        
        if (error) {
            switch (error.code) {
                case error.MEDIA_ERR_ABORTED:
                    message = 'Audio playback aborted';
                    break;
                case error.MEDIA_ERR_NETWORK:
                    message = 'Network error while loading audio';
                    break;
                case error.MEDIA_ERR_DECODE:
                    message = 'Audio format not supported';
                    break;
                case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    message = 'Audio source not supported';
                    break;
            }
        }
        
        this.showNotification(message, 'error');
    }

    onTrackEnd() {
        this.isPlaying = false;
        this.elements.playBtn.textContent = '▶️';
        this.elements.playBtn.title = 'Play';
        
        if (this.isHost) {
            this.socket.emit('pause');
        }
        
        this.showNotification('Track ended! 🎵', 'info');
    }

    updateRoomState(roomState) {
        if (!roomState) return;

        // Update user count
        this.elements.userCount.textContent = `${roomState.userCount} user${roomState.userCount !== 1 ? 's' : ''}`;
        this.elements.roomUserCount.textContent = `${roomState.userCount} user${roomState.userCount !== 1 ? 's' : ''}`;

        // Update user list
        this.updateUserList(roomState.users, roomState.hostId);
    }

    updateUserList(users, hostId) {
        this.elements.userList.innerHTML = '';
        
        if (!users || users.length === 0) {
            const emptyTag = document.createElement('div');
            emptyTag.className = 'user-tag connecting';
            emptyTag.textContent = 'No users connected';
            this.elements.userList.appendChild(emptyTag);
            return;
        }
        
        users.forEach(user => {
            const userTag = document.createElement('div');
            userTag.className = 'user-tag';
            
            const userId = user.id || user;
            const isCurrentUser = userId === this.userId;
            const isHost = userId === hostId;
            
            if (isCurrentUser) {
                userTag.textContent = 'You';
                userTag.classList.add('you');
            } else {
                userTag.textContent = userId.substring(5, 13) + '...';
            }
            
            if (isHost) {
                userTag.classList.add('host');
                userTag.textContent += ' 👑';
            }
            
            userTag.classList.add('animate-slideInRight');
            this.elements.userList.appendChild(userTag);
        });
    }

    updateControlsState() {
        const hasTrack = !!this.currentTrack;
        const isConnected = this.socket && this.socket.connected;
        const inRoom = !!this.roomCode;

        // Enable/disable upload controls
        this.elements.uploadBtn.disabled = !this.isHost || !inRoom || !isConnected;
        this.elements.urlBtn.disabled = !this.isHost || !inRoom || !isConnected;

        // Enable/disable player controls
        this.elements.playBtn.disabled = !hasTrack || !this.isHost || !inRoom || !isConnected;
        this.elements.prevBtn.disabled = !hasTrack || !this.isHost || !inRoom || !isConnected;
        this.elements.nextBtn.disabled = !hasTrack || !this.isHost || !inRoom || !isConnected;

        // Update button text for non-hosts
        if (!this.isHost && inRoom) {
            this.elements.uploadBtn.textContent = '🚫 Host Only';
            this.elements.urlBtn.textContent = '🚫 Host Only';
        } else {
            this.elements.uploadBtn.textContent = '📁 Upload Track';
            this.elements.urlBtn.textContent = '🌐 Stream URL';
        }

        // Update room join/leave buttons
        this.elements.createRoomBtn.disabled = inRoom;
        this.elements.joinBtn.disabled = inRoom;
        this.elements.roomCodeInput.disabled = inRoom;
    }

    handleKeyboard(e) {
        // Don't interfere with typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                if (this.currentTrack) {
                    this.togglePlay();
                }
                break;
            case 'KeyH':
                if (e.shiftKey && e.key === '?') {
                    e.preventDefault();
                    this.showHelpModal();
                }
                break;
            case 'Escape':
                if (this.elements.helpModal.style.display !== 'none') {
                    this.hideHelpModal();
                }
                break;
        }
    }

    showHelpModal() {
        this.elements.helpModal.style.display = 'flex';
        this.elements.helpModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideHelpModal() {
        this.elements.helpModal.classList.remove('show');
        setTimeout(() => {
            this.elements.helpModal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    showConnectionToast(message) {
        const toast = this.elements.connectionToast;
        toast.querySelector('.toast-text').textContent = message;
        toast.style.display = 'block';
        setTimeout(() => toast.classList.add('show'), 100);
    }

    hideConnectionToast() {
        const toast = this.elements.connectionToast;
        toast.classList.remove('show');
        setTimeout(() => toast.style.display = 'none', 300);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = this.getNotificationIcon(type);
        notification.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <span>${message}</span>
        `;
        
        this.elements.notificationContainer.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);

        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    handleBeforeUnload() {
        if (this.socket && this.socket.connected) {
            this.socket.disconnect();
        }
    }

    handleOnline() {
        this.showNotification('Back online! 🌐', 'success');
        if (this.socket && !this.socket.connected) {
            this.socket.connect();
        }
    }

    handleOffline() {
        this.showNotification('You are offline 📵', 'warning');
    }

    handleVisibilityChange() {
        if (document.hidden) {
            console.log('📵 Tab hidden');
        } else {
            console.log('👁️ Tab visible');
            // Sync time when tab becomes visible
            if (this.socket && this.socket.connected && this.roomCode) {
                this.socket.emit('get-room-state', (response) => {
                    if (response.success) {
                        this.updateRoomState(response.roomState);
                    }
                });
            }
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 SyncBeats v2.0 initializing...');
    
    // Check for modern browser features
    if (!window.WebSocket || !window.fetch || !window.AudioContext) {
        alert('Your browser is not supported. Please use a modern browser like Chrome, Firefox, or Safari.');
        return;
    }
    
    window.syncBeatsApp = new SyncBeatsApp();
    
    // Add logo click easter egg
    let clickCount = 0;
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', () => {
            clickCount++;
            if (clickCount === 7) {
                window.syncBeatsApp.showNotification('🥚 Secret unlocked! You\'re a true music lover! Keep the beat alive! 🎵✨', 'success');
                document.body.style.animation = 'bounce 1s ease';
                clickCount = 0;
                
                // Add some celebration effects
                for (let i = 0; i < 20; i++) {
                    setTimeout(() => {
                        const celebration = document.createElement('div');
                        celebration.style.cssText = `
                            position: fixed;
                            top: ${Math.random() * 100}vh;
                            left: ${Math.random() * 100}vw;
                            font-size: 2rem;
                            z-index: 9999;
                            pointer-events: none;
                            animation: bounce 2s ease forwards;
                        `;
                        celebration.textContent = ['🎵', '🎶', '🎤', '🎧', '🔥'][Math.floor(Math.random() * 5)];
                        document.body.appendChild(celebration);
                        
                        setTimeout(() => {
                            if (celebration.parentNode) {
                                celebration.parentNode.removeChild(celebration);
                            }
                        }, 2000);
                    }, i * 100);
                }
            }
        });
    }
    
    console.log('✅ SyncBeats v2.0 ready to rock!');
    console.log('💡 Tips:');
    console.log('   - Press SPACE to play/pause');
    console.log('   - Press Shift+? for help');
    console.log('   - Click the logo 7 times for a surprise! 🥚');
});

// Service Worker Registration (for PWA features)
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('🔧 SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('🚫 SW registration failed: ', registrationError);
            });
    });
}

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncBeatsApp;
}











