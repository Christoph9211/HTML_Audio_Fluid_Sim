import { FluidSimulation } from './core/FluidSimulation.js';
import { PerformanceMonitor } from './utils/PerformanceMonitor.js';
import { AudioProcessor } from './audio/AudioProcessor.js';
import { OptimizationManager } from './optimization/OptimizationManager.js';
import { WorkerPool } from './workers/WorkerPool.js';

class OptimizedFluidApp {
    constructor() {
        this.canvas = document.getElementById('fluidCanvas');
        this.ctx = this.canvas.getContext('2d', { 
            alpha: false,
            desynchronized: true,
            powerPreference: 'high-performance'
        });
        
        this.performanceMonitor = new PerformanceMonitor();
        this.optimizationManager = new OptimizationManager();
        this.workerPool = new WorkerPool(navigator.hardwareConcurrency || 4);
        
        this.fluidSim = null;
        this.audioProcessor = null;
        
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.targetFPS = 120;
        this.frameInterval = 1000 / this.targetFPS;
        
        this.init();
    }
    
    async init() {
        try {
            await this.setupCanvas();
            await this.initializeComponents();
            this.setupEventListeners();
            this.setupUI();
            
            // Start the optimized render loop
            this.startRenderLoop();
            
            document.getElementById('loadingIndicator').style.display = 'none';
            console.log('Optimized Fluid Simulation initialized successfully');
        } catch (error) {
            console.error('Failed to initialize simulation:', error);
        }
    }
    
    async setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        // Optimize canvas size based on device capabilities
        const optimalSize = this.optimizationManager.getOptimalCanvasSize();
        
        this.canvas.width = optimalSize.width * dpr;
        this.canvas.height = optimalSize.height * dpr;
        this.canvas.style.width = optimalSize.width + 'px';
        this.canvas.style.height = optimalSize.height + 'px';
        
        this.ctx.scale(dpr, dpr);
        
        // Enable hardware acceleration hints
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.globalCompositeOperation = 'source-over';
    }
    
    async initializeComponents() {
        // Initialize fluid simulation with optimized parameters
        this.fluidSim = new FluidSimulation(
            this.canvas.width,
            this.canvas.height,
            this.optimizationManager.getFluidParams()
        );
        
        // Initialize audio processor with low-latency settings
        this.audioProcessor = new AudioProcessor({
            bufferSize: 256, // Reduced for lower latency
            sampleRate: 44100,
            channels: 2
        });
        
        await this.audioProcessor.initialize();
        
        // Setup performance monitoring
        this.performanceMonitor.start();
    }
    
    setupEventListeners() {
        // Mouse/touch interaction with throttling
        let lastInteractionTime = 0;
        const interactionThrottle = 16; // ~60fps for interactions
        
        const handleInteraction = (e) => {
            const now = performance.now();
            if (now - lastInteractionTime < interactionThrottle) return;
            lastInteractionTime = now;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX || e.touches[0].clientX) - rect.left;
            const y = (e.clientY || e.touches[0].clientY) - rect.top;
            
            this.fluidSim.addForce(x, y, e.type === 'mousemove' ? 0.5 : 1.0);
        };
        
        this.canvas.addEventListener('mousemove', handleInteraction, { passive: true });
        this.canvas.addEventListener('touchmove', handleInteraction, { passive: true });
        this.canvas.addEventListener('click', handleInteraction, { passive: true });
        
        // Optimization controls
        document.getElementById('qualitySelect').addEventListener('change', (e) => {
            this.setQuality(e.target.value);
        });
        
        document.getElementById('adaptiveQuality').addEventListener('change', (e) => {
            this.optimizationManager.setAdaptiveQuality(e.target.checked);
        });
        
        document.getElementById('gpuAcceleration').addEventListener('change', (e) => {
            this.optimizationManager.setGPUAcceleration(e.target.checked);
        });
        
        document.getElementById('multiThreading').addEventListener('change', (e) => {
            this.optimizationManager.setMultiThreading(e.target.checked);
        });
        
        // Window resize with debouncing
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.handleResize(), 250);
        });
        
        // Visibility API for performance optimization
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.targetFPS = 30; // Reduce FPS when tab is hidden
            } else {
                this.setQuality(document.getElementById('qualitySelect').value);
            }
        });
    }
    
    setupUI() {
        // Controls toggle
        const controlsToggle = document.getElementById('controlsToggle');
        const controlsPanel = document.getElementById('controlsPanel');
        let controlsVisible = true;
        
        controlsToggle.addEventListener('click', () => {
            controlsVisible = !controlsVisible;
            controlsPanel.style.display = controlsVisible ? 'block' : 'none';
            controlsToggle.textContent = controlsVisible ? '⚙' : '👁';
        });
        
        // Fluid parameter controls
        document.getElementById('viscositySlider').addEventListener('input', (e) => {
            this.fluidSim.setViscosity(parseFloat(e.target.value) / 100);
        });
        
        document.getElementById('densitySlider').addEventListener('input', (e) => {
            this.fluidSim.setDensity(parseFloat(e.target.value) / 100);
        });
        
        document.getElementById('speedSlider').addEventListener('input', (e) => {
            this.fluidSim.setSpeed(parseFloat(e.target.value) / 100);
        });
        
        // Audio toggle
        document.getElementById('audioToggle').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.audioProcessor.start();
            } else {
                this.audioProcessor.stop();
            }
        });
    }
    
    setQuality(quality) {
        const qualitySettings = {
            low: { fps: 60, particles: 500, resolution: 0.5 },
            medium: { fps: 120, particles: 1000, resolution: 0.75 },
            high: { fps: 144, particles: 2000, resolution: 1.0 },
            ultra: { fps: 240, particles: 4000, resolution: 1.0 }
        };
        
        const settings = qualitySettings[quality];
        this.targetFPS = settings.fps;
        this.frameInterval = 1000 / this.targetFPS;
        
        this.fluidSim.setParticleCount(settings.particles);
        this.fluidSim.setResolution(settings.resolution);
        
        this.optimizationManager.updateQualitySettings(settings);
    }
    
    startRenderLoop() {
        this.isRunning = true;
        this.renderLoop();
    }
    
    renderLoop() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        
        // Frame rate limiting with adaptive timing
        if (deltaTime >= this.frameInterval) {
            this.update(deltaTime);
            this.render();
            
            this.lastFrameTime = currentTime - (deltaTime % this.frameInterval);
            this.performanceMonitor.recordFrame(currentTime);
        }
        
        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => this.renderLoop());
    }
    
    update(deltaTime) {
        // Update audio analysis
        const audioData = this.audioProcessor.getFrequencyData();
        
        // Update fluid simulation with audio data
        this.fluidSim.update(deltaTime, audioData);
        
        // Adaptive quality adjustment
        if (this.optimizationManager.isAdaptiveQualityEnabled()) {
            const currentFPS = this.performanceMonitor.getCurrentFPS();
            this.optimizationManager.adjustQuality(currentFPS, this.targetFPS);
        }
        
        // Update performance metrics
        this.updatePerformanceDisplay();
    }
    
    render() {
        // Clear canvas efficiently
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render fluid simulation
        this.fluidSim.render(this.ctx);
        
        // Update audio indicator
        this.updateAudioIndicator();
    }
    
    updatePerformanceDisplay() {
        const metrics = this.performanceMonitor.getMetrics();
        
        document.getElementById('fps').textContent = Math.round(metrics.fps);
        document.getElementById('frameTime').textContent = metrics.frameTime.toFixed(2);
        document.getElementById('gpuMemory').textContent = Math.round(metrics.gpuMemory);
        document.getElementById('particleCount').textContent = this.fluidSim.getParticleCount();
        document.getElementById('audioLatency').textContent = Math.round(metrics.audioLatency);
        document.getElementById('cpuUsage').textContent = Math.round(metrics.cpuUsage);
    }
    
    updateAudioIndicator() {
        const audioLevel = this.audioProcessor.getAudioLevel();
        const indicator = document.getElementById('audioIndicator');
        
        if (audioLevel > 0.1) {
            indicator.style.transform = `scale(${1 + audioLevel * 0.5})`;
            indicator.querySelector('.wave').style.animation = 'wave 0.5s ease-out';
        } else {
            indicator.style.transform = 'scale(1)';
        }
    }
    
    handleResize() {
        this.setupCanvas();
        this.fluidSim.resize(this.canvas.width, this.canvas.height);
    }
    
    // Public API for scene management
    setScene(sceneName) {
        this.fluidSim.setScene(sceneName);
    }
    
    destroy() {
        this.isRunning = false;
        this.performanceMonitor.stop();
        this.audioProcessor.destroy();
        this.workerPool.terminate();
    }
}

// Initialize the application
const app = new OptimizedFluidApp();

// Export for global access
window.fluidSim = {
    setScene: (scene) => app.setScene(scene)
};

// Handle page unload
window.addEventListener('beforeunload', () => {
    app.destroy();
});