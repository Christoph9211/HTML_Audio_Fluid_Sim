export class AudioProcessor {
    constructor(options = {}) {
        this.options = {
            bufferSize: options.bufferSize || 256,
            sampleRate: options.sampleRate || 44100,
            channels: options.channels || 2,
            fftSize: options.fftSize || 256,
            smoothingTimeConstant: options.smoothingTimeConstant || 0.8,
            ...options
        };
        
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.frequencyData = null;
        this.timeData = null;
        
        this.isInitialized = false;
        this.isRunning = false;
        
        // Audio processing optimization
        this.processingInterval = null;
        this.processingRate = 60; // Hz
        
        // Audio level tracking
        this.currentLevel = 0;
        this.peakLevel = 0;
        this.levelHistory = [];
        this.maxLevelHistory = 100;
        
        // Frequency band analysis
        this.frequencyBands = {
            bass: { start: 0, end: 4 },
            lowMid: { start: 4, end: 16 },
            mid: { start: 16, end: 64 },
            highMid: { start: 64, end: 128 },
            treble: { start: 128, end: 256 }
        };
        
        this.bandLevels = {};
    }
    
    async initialize() {
        try {
            // Create audio context with optimized settings
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext({
                latencyHint: 'interactive',
                sampleRate: this.options.sampleRate
            });
            
            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.options.fftSize;
            this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            
            // Initialize data arrays
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
            
            // Request microphone access
            await this.setupMicrophone();
            
            this.isInitialized = true;
            console.log('Audio processor initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize audio processor:', error);
            throw error;
        }
    }
    
    async setupMicrophone() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    latency: 0.01 // 10ms latency
                }
            });
            
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
        } catch (error) {
            console.warn('Microphone access denied, using silent audio:', error);
            // Create a silent audio source as fallback
            this.createSilentSource();
        }
    }
    
    createSilentSource() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.analyser);
        oscillator.start();
    }
    
    start() {
        if (!this.isInitialized) {
            console.warn('Audio processor not initialized');
            return;
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isRunning = true;
        this.startProcessing();
    }
    
    stop() {
        this.isRunning = false;
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }
    
    startProcessing() {
        // Process audio data at optimized rate
        this.processingInterval = setInterval(() => {
            this.processAudioData();
        }, 1000 / this.processingRate);
    }
    
    processAudioData() {
        if (!this.isRunning || !this.analyser) return;
        
        // Get frequency and time domain data
        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.timeData);
        
        // Calculate overall audio level
        this.calculateAudioLevel();
        
        // Analyze frequency bands
        this.analyzeFrequencyBands();
        
        // Update level history
        this.updateLevelHistory();
    }
    
    calculateAudioLevel() {
        let sum = 0;
        let peak = 0;
        
        for (let i = 0; i < this.frequencyData.length; i++) {
            const value = this.frequencyData[i];
            sum += value;
            if (value > peak) peak = value;
        }
        
        this.currentLevel = sum / this.frequencyData.length / 255;
        this.peakLevel = peak / 255;
    }
    
    analyzeFrequencyBands() {
        for (const [bandName, band] of Object.entries(this.frequencyBands)) {
            let sum = 0;
            const count = band.end - band.start;
            
            for (let i = band.start; i < band.end && i < this.frequencyData.length; i++) {
                sum += this.frequencyData[i];
            }
            
            this.bandLevels[bandName] = (sum / count) / 255;
        }
    }
    
    updateLevelHistory() {
        this.levelHistory.push(this.currentLevel);
        if (this.levelHistory.length > this.maxLevelHistory) {
            this.levelHistory.shift();
        }
    }
    
    // Public API methods
    getFrequencyData() {
        return this.frequencyData ? Array.from(this.frequencyData) : [];
    }
    
    getTimeData() {
        return this.timeData ? Array.from(this.timeData) : [];
    }
    
    getAudioLevel() {
        return this.currentLevel;
    }
    
    getPeakLevel() {
        return this.peakLevel;
    }
    
    getBandLevel(bandName) {
        return this.bandLevels[bandName] || 0;
    }
    
    getAllBandLevels() {
        return { ...this.bandLevels };
    }
    
    getAverageLevel() {
        if (this.levelHistory.length === 0) return 0;
        return this.levelHistory.reduce((a, b) => a + b, 0) / this.levelHistory.length;
    }
    
    // Advanced audio analysis
    detectBeat() {
        const bassLevel = this.getBandLevel('bass');
        const avgBass = this.getAverageBandLevel('bass');
        
        // Simple beat detection based on bass energy
        return bassLevel > avgBass * 1.5;
    }
    
    getAverageBandLevel(bandName) {
        // This would require storing band history, simplified for now
        return this.getBandLevel(bandName) * 0.7;
    }
    
    getSpectralCentroid() {
        let weightedSum = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < this.frequencyData.length; i++) {
            const magnitude = this.frequencyData[i];
            const frequency = (i * this.audioContext.sampleRate) / (2 * this.frequencyData.length);
            
            weightedSum += frequency * magnitude;
            magnitudeSum += magnitude;
        }
        
        return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }
    
    // Cleanup
    destroy() {
        this.stop();
        
        if (this.microphone) {
            this.microphone.disconnect();
        }
        
        if (this.analyser) {
            this.analyser.disconnect();
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}