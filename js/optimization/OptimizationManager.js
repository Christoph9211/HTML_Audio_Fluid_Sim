export class OptimizationManager {
    constructor() {
        this.adaptiveQuality = true;
        this.gpuAcceleration = true;
        this.multiThreading = true;
        
        this.qualitySettings = {
            particles: 1000,
            resolution: 1.0,
            effects: true,
            shadows: true,
            antialiasing: true
        };
        
        this.performanceHistory = [];
        this.maxHistoryLength = 60; // 1 second at 60fps
        
        this.optimizationThresholds = {
            fpsTarget: 60,
            fpsMin: 45,
            fpsMax: 120,
            memoryMax: 150, // MB
            frameTimeMax: 16.67 // ms
        };
        
        this.deviceCapabilities = this.detectDeviceCapabilities();
        this.currentQualityLevel = 'medium';
    }
    
    detectDeviceCapabilities() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        
        const capabilities = {
            cores: navigator.hardwareConcurrency || 4,
            memory: navigator.deviceMemory || 4,
            webgl2: !!canvas.getContext('webgl2'),
            webgl: !!gl,
            maxTextureSize: gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 2048,
            maxRenderbufferSize: gl ? gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) : 2048,
            isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            isLowEnd: false
        };
        
        // Detect low-end devices
        capabilities.isLowEnd = capabilities.cores <= 2 || 
                               capabilities.memory <= 2 || 
                               capabilities.isMobile;
        
        console.log('Device capabilities detected:', capabilities);
        return capabilities;
    }
    
    getOptimalCanvasSize() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        
        let width = screenWidth;
        let height = screenHeight;
        
        // Adjust for device capabilities
        if (this.deviceCapabilities.isLowEnd) {
            width = Math.min(width, 1280);
            height = Math.min(height, 720);
        } else if (this.deviceCapabilities.isMobile) {
            width = Math.min(width, 1920);
            height = Math.min(height, 1080);
        }
        
        // Apply resolution scaling
        width *= this.qualitySettings.resolution;
        height *= this.qualitySettings.resolution;
        
        return { width: Math.floor(width), height: Math.floor(height) };
    }
    
    getFluidParams() {
        const baseParams = {
            particleCount: this.qualitySettings.particles,
            viscosity: 0.0001,
            density: 1.0,
            speed: 1.0,
            resolution: this.qualitySettings.resolution
        };
        
        // Adjust for device capabilities
        if (this.deviceCapabilities.isLowEnd) {
            baseParams.particleCount = Math.min(baseParams.particleCount, 500);
            baseParams.resolution = Math.min(baseParams.resolution, 0.75);
        }
        
        return baseParams;
    }
    
    adjustQuality(currentFPS, targetFPS) {
        if (!this.adaptiveQuality) return;
        
        this.performanceHistory.push(currentFPS);
        if (this.performanceHistory.length > this.maxHistoryLength) {
            this.performanceHistory.shift();
        }
        
        const avgFPS = this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length;
        
        // Quality adjustment logic
        if (avgFPS < this.optimizationThresholds.fpsMin) {
            this.decreaseQuality();
        } else if (avgFPS > this.optimizationThresholds.fpsMax && this.currentQualityLevel !== 'ultra') {
            this.increaseQuality();
        }
    }
    
    decreaseQuality() {
        const qualityLevels = ['ultra', 'high', 'medium', 'low'];
        const currentIndex = qualityLevels.indexOf(this.currentQualityLevel);
        
        if (currentIndex < qualityLevels.length - 1) {
            this.currentQualityLevel = qualityLevels[currentIndex + 1];
            this.applyQualitySettings(this.currentQualityLevel);
            console.log(`Quality decreased to: ${this.currentQualityLevel}`);
        }
    }
    
    increaseQuality() {
        const qualityLevels = ['low', 'medium', 'high', 'ultra'];
        const currentIndex = qualityLevels.indexOf(this.currentQualityLevel);
        
        if (currentIndex < qualityLevels.length - 1) {
            this.currentQualityLevel = qualityLevels[currentIndex + 1];
            this.applyQualitySettings(this.currentQualityLevel);
            console.log(`Quality increased to: ${this.currentQualityLevel}`);
        }
    }
    
    applyQualitySettings(quality) {
        const settings = {
            low: {
                particles: 300,
                resolution: 0.5,
                effects: false,
                shadows: false,
                antialiasing: false
            },
            medium: {
                particles: 800,
                resolution: 0.75,
                effects: true,
                shadows: false,
                antialiasing: false
            },
            high: {
                particles: 1500,
                resolution: 1.0,
                effects: true,
                shadows: true,
                antialiasing: false
            },
            ultra: {
                particles: 3000,
                resolution: 1.0,
                effects: true,
                shadows: true,
                antialiasing: true
            }
        };
        
        this.qualitySettings = { ...this.qualitySettings, ...settings[quality] };
        
        // Trigger quality update event
        window.dispatchEvent(new CustomEvent('qualityChanged', {
            detail: { quality, settings: this.qualitySettings }
        }));
    }
    
    updateQualitySettings(settings) {
        this.qualitySettings = { ...this.qualitySettings, ...settings };
    }
    
    setAdaptiveQuality(enabled) {
        this.adaptiveQuality = enabled;
        console.log(`Adaptive quality ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    setGPUAcceleration(enabled) {
        this.gpuAcceleration = enabled;
        console.log(`GPU acceleration ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    setMultiThreading(enabled) {
        this.multiThreading = enabled;
        console.log(`Multi-threading ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    isAdaptiveQualityEnabled() {
        return this.adaptiveQuality;
    }
    
    isGPUAccelerationEnabled() {
        return this.gpuAcceleration;
    }
    
    isMultiThreadingEnabled() {
        return this.multiThreading;
    }
    
    getOptimizationRecommendations() {
        const recommendations = [];
        
        if (this.deviceCapabilities.isLowEnd) {
            recommendations.push({
                type: 'device',
                message: 'Low-end device detected. Consider using lower quality settings.',
                action: 'setQuality',
                value: 'low'
            });
        }
        
        if (!this.deviceCapabilities.webgl2) {
            recommendations.push({
                type: 'webgl',
                message: 'WebGL2 not supported. Some optimizations may not be available.',
                action: 'disableAdvancedEffects'
            });
        }
        
        if (this.deviceCapabilities.cores <= 2) {
            recommendations.push({
                type: 'cpu',
                message: 'Limited CPU cores detected. Consider disabling multi-threading.',
                action: 'setMultiThreading',
                value: false
            });
        }
        
        return recommendations;
    }
    
    // Memory management
    optimizeMemoryUsage() {
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
        
        // Clear performance history to free memory
        if (this.performanceHistory.length > this.maxHistoryLength) {
            this.performanceHistory = this.performanceHistory.slice(-this.maxHistoryLength / 2);
        }
    }
    
    // Performance profiling
    startProfiling() {
        if (performance.mark) {
            performance.mark('optimization-start');
        }
    }
    
    endProfiling(label) {
        if (performance.mark && performance.measure) {
            performance.mark('optimization-end');
            performance.measure(label, 'optimization-start', 'optimization-end');
        }
    }
    
    getPerformanceMetrics() {
        const entries = performance.getEntriesByType('measure');
        return entries.map(entry => ({
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime
        }));
    }
}