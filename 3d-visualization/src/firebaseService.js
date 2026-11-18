/**
 * firebaseService.js
 * Firebase Integration Adapter for NICU 3D Visualization.
 *
 * Requirements (Section 14):
 * - Direct connection to Firebase Realtime Database or Firestore.
 * - Decoupled from Flutter: receives monitoring updates directly.
 * - Feeds validated packets to dataManager.js.
 * - Handles connection errors and exponential backoff reconnection.
 * - Zero hardcoded credentials: reads from env vars / window configuration.
 * - Safe mock-mode fallback when no credentials are provided.
 */

export class FirebaseService {
  constructor(dataManager, config = {}) {
    this.dataManager = dataManager;

    // Load configuration from window, vite env, or passed config
    this.config = this._loadConfiguration(config);

    // Connection states: 'mock' | 'connecting' | 'connected' | 'reconnecting' | 'error'
    this.status = 'mock';
    this.statusMessage = 'Running in Mock Mode (Zero credentials configured)';

    // Telemetry path to listen to (default: 'nicu/live_monitoring')
    this.dbPath = this.config.dbPath || 'nicu/live_monitoring';

    // Firebase instances
    this.app = null;
    this.db = null;
    this.unsubscribeListener = null;

    // Reconnection parameters
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelayMs = 2000;
    this.reconnectTimer = null;

    // Status change listener for UI badge updates
    this.onStatusChange = null;
  }

  /**
   * Safely load Firebase credentials from environment or runtime globals.
   * Does NOT invent API keys or project IDs.
   */
  _loadConfiguration(userConfig) {
    // 1. Runtime window configuration
    const runtimeConfig = (typeof window !== 'undefined' && window.NICU_FIREBASE_CONFIG) || {};

    // 2. Vite environment variables if available
    let viteEnv = {};
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        viteEnv = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
          dbPath: import.meta.env.VITE_FIREBASE_DB_PATH
        };
      }
    } catch (_) {
      // Ignored outside Vite bundler
    }

    return {
      apiKey: userConfig.apiKey || runtimeConfig.apiKey || viteEnv.apiKey || null,
      authDomain: userConfig.authDomain || runtimeConfig.authDomain || viteEnv.authDomain || null,
      databaseURL: userConfig.databaseURL || runtimeConfig.databaseURL || viteEnv.databaseURL || null,
      projectId: userConfig.projectId || runtimeConfig.projectId || viteEnv.projectId || null,
      storageBucket: userConfig.storageBucket || runtimeConfig.storageBucket || viteEnv.storageBucket || null,
      messagingSenderId: userConfig.messagingSenderId || runtimeConfig.messagingSenderId || viteEnv.messagingSenderId || null,
      appId: userConfig.appId || runtimeConfig.appId || viteEnv.appId || null,
      dbPath: userConfig.dbPath || runtimeConfig.dbPath || viteEnv.dbPath || 'nicu/live_monitoring'
    };
  }

  /**
   * Checks whether valid Firebase credentials have been configured
   */
  isConfigured() {
    return Boolean(this.config.apiKey && (this.config.databaseURL || this.config.projectId));
  }

  /**
   * Initialize and connect to Firebase Realtime Database
   */
  async connect() {
    if (!this.isConfigured()) {
      this._setStatus('mock', 'Mock Mode: No Firebase credentials supplied. Telemetry powered by local mock data.');
      console.info('FirebaseService: Running in Mock Mode. Set credentials in .env to connect to live Firebase.');
      return false;
    }

    this._setStatus('connecting', `Connecting to Firebase [${this.config.projectId || 'Database'}]...`);

    try {
      // Dynamically import Firebase App and Database SDKs (ES Modules)
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      const { getDatabase, ref, onValue, off } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');

      // Initialize App
      this.app = initializeApp({
        apiKey: this.config.apiKey,
        authDomain: this.config.authDomain,
        databaseURL: this.config.databaseURL,
        projectId: this.config.projectId,
        storageBucket: this.config.storageBucket,
        messagingSenderId: this.config.messagingSenderId,
        appId: this.config.appId
      });

      this.db = getDatabase(this.app);
      const telemetryRef = ref(this.db, this.dbPath);

      // Listen for incoming telemetry
      this.unsubscribeListener = onValue(
        telemetryRef,
        (snapshot) => {
          const val = snapshot.val();
          if (val) {
            this._setStatus('connected', `Live Telemetry Stream Active (${this.dbPath})`);
            this.reconnectAttempts = 0;
            // Feed packet directly into DataManager
            this.dataManager.processIncomingData(val);
          } else {
            console.log(`FirebaseService: Path '${this.dbPath}' is currently empty. Awaiting packets.`);
          }
        },
        (error) => {
          console.error('FirebaseService: Subscription error:', error);
          this._handleConnectionError(error);
        }
      );

      this._setStatus('connected', `Subscribed to path: ${this.dbPath}`);
      return true;
    } catch (err) {
      console.error('FirebaseService: Failed to connect:', err);
      this._handleConnectionError(err);
      return false;
    }
  }

  /**
   * Handle connection failure and trigger exponential backoff reconnection
   */
  _handleConnectionError(err) {
    this._setStatus('error', `Connection error: ${err.message}`);

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelayMs * Math.pow(1.5, this.reconnectAttempts - 1);
      this._setStatus('reconnecting', `Reconnecting in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      this._setStatus('mock', 'Reconnection limit reached. Falling back to Mock Telemetry mode.');
    }
  }

  /**
   * Disconnect from Firebase listener
   */
  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.unsubscribeListener) {
      try {
        this.unsubscribeListener();
      } catch (_) {}
      this.unsubscribeListener = null;
    }
    this._setStatus('mock', 'Disconnected. Running in Standby Mock Mode.');
  }

  /**
   * Update and notify connection status
   */
  _setStatus(status, message) {
    this.status = status;
    this.statusMessage = message;
    if (this.onStatusChange) {
      this.onStatusChange(status, message);
    }
  }

  /**
   * Get current connection status object
   */
  getStatus() {
    return {
      status: this.status,
      message: this.statusMessage,
      isConfigured: this.isConfigured(),
      dbPath: this.dbPath
    };
  }
}
