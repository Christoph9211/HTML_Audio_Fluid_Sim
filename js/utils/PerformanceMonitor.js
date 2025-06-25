export class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 0;
        this.frameTime = 0;
        this.frameTimes = [];
        this.maxFrameHistory = 60;
        
        this.gpuMemory = 0;
        this.audioLatency = 0;
        this.cpuUsage = 0;
        
        this.isRunning = false;
        this.startTime = 0;
        
        // Performance thresholds
        this.thresholds = {
            targetFPS: 60,
            maxFrameTime: 16.67, // 60fps = 16.67ms per frame
            criticalFrameTime: 33.33, // 30fps = 33.33ms per frame
            memoryWarning: 100, // MB
            memoryCritical: 200 // MB
        };
        
        this.callbacks = {
            onPerformanceDrop: null,
            onMemoryWarning: null,
            onCriticalPerformance: null
        };
    }
    
    start() {
        this.isRunning = true;
        this.startTime = performance.now();
        this.lastTime = this.startTime;
        
        // Start monitoring system resources
        this.startResourceMonitoring();
    }
    
    stop() {
        this.isRunning = false;
    }
    
    recordFrame(currentTime) {
        if (!this.isRunning) return;
        
        this.frameCount++;
        const deltaTime = currentTime - this.lastTime;
        
        // Calculate FPS
        if (deltaTime >= 1000) { // Update every second
            this.fps = (this.frameCount * 1000) / deltaTime;
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
        
        // Record frame time
        this.frameTime = deltaTime;
        this.frameTimes.push(deltaTime);
        
        if (this.frameTimes.length > this.maxFrameHistory) {
            this.frameTimes.shift();
        }
        
        // Check performance thresholds
        this.checkPerformanceThresholds();
    }
    
    checkPerformanceThresholds() {
        // Check frame time performance
        if (this.frameTime > this.thresholds.criticalFrameTime) {
            this.triggerCallback('onCriticalPerformance', {
                type: 'frameTime',
                value: this.frameTime,
                threshold: this.thresholds.criticalFrameTime
            });
        } else if (this.frameTime > this.thresholds.maxFrameTime) {
            this.triggerCallback('onPerformanceDrop', {
                type: 'frameTime',
                value: this.frameTime,
                threshold: this.thresholds.maxFrameTime
            });
        }
        
        // Check memory usage
        if (this.gpuMemory > this.thresholds.memoryCritical) {
            this.triggerCallback('onCriticalPerformance', {
                type: 'memory',
                value: this.gpuMemory,
                threshold: this.thresholds.memoryCritical
            });
        } else if (this.gpuMemory > this.thresholds.memoryWarning) {
            this.triggerCallback('onMemoryWarning', {
                type: 'memory',
                value: this.gpuMemory,
                threshold: this.thresholds.memoryWarning
            });
        }
    }
    
    triggerCallback(callbackName, data) {
        if (this.callbacks[callbackName]) {
            this.callbacks[callbackName](data);
        }
    }
    
    startResourceMonitoring() {
        // Monitor GPU memory (approximation)
        if ('memory' in performance) {
            setInterval(() => {
                const memInfo = performance.memory;
                this.gpuMemory = (memInfo.usedJSHeapSize / 1024 / 1024); // Convert to MB
            }, 1000);
        }
        
        // Monitor CPU usage (approximation using frame timing)
        setInterval(() => {
            if (this.frameTimes.length > 0) {
                const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
                this.cpuUsage = Math.min(100, (avgFrameTime / this.thresholds.maxFrameTime) * 100);
            }
        }, 1000);
        
        // Monitor audio latency (if Web Audio API is available)
        if (window.AudioContext || window.webkitAudioContext) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioLatency = audioContext.baseLatency * 1000; // Convert to ms
        }
    }
    
    getMetrics() {
        return {
            fps: this.fps,
            frameTime: this.frameTime,
            avgFrameTime: this.frameTimes.length > 0 ? 
                this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length : 0,
            gpuMemory: this.gpuMemory,
            audioLatency: this.audioLatency,
            cpuUsage: this.cpuUsage,
            uptime: this.isRunning ? (performance.now() - this.startTime) / 1000 : 0
        };
    }
    
    getCurrentFPS() {
        return this.fps;
    }
    
    getAverageFrameTime() {
        if (this.frameTimes.length === 0) return 0;
        return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    }
    
    isPerformanceGood() {
        return this.fps >= this.thresholds.targetFPS * 0.9 && 
               this.frameTime <= this.thresholds.maxFrameTime;
    }
    
    getPerformanceGrade() {
        if (this.fps >= this.thresholds.targetFPS && this.frameTime <= this.thresholds.maxFrameTime) {
            return 'A'; // Excellent
        } else if (this.fps >= this.thresholds.targetFPS * 0.8) {
            return 'B'; // Good
        } else if (this.fps >= this.thresholds.targetFPS * 0.6) {
            return 'C'; // Fair
        } else if (this.fps >= this.thresholds.targetFPS * 0.4) {
            return 'D'; // Poor
        } else {
            return 'F'; // Critical
        }
    }
    
    // Callback registration
    onPerformanceDrop(callback) {
        this.callbacks.onPerformanceDrop = callback;
    }
    
    onMemoryWarning(callback) {
        this.callbacks.onMemoryWarning = callback;
    }
    
    onCriticalPerformance(callback) {
        this.callbacks.onCriticalPerformance = callback;
    }
    
    // Performance recommendations
    getOptimizationRecommendations() {
        const recommendations = [];
        
        if (this.fps < this.thresholds.targetFPS * 0.8) {
            recommendations.push({
                type: 'fps',
                message: 'Consider reducing particle count or visual quality',
                priority: 'high'
            });
        }
        
        if (this.gpuMemory > this.thresholds.memoryWarning) {
            recommendations.push({
                type: 'memory',
                message: 'High memory usage detected. Consider reducing texture quality',
                priority: 'medium'
            });
        }
        
        if (this.frameTime > this.thresholds.maxFrameTime) {
            recommendations.push({
                type: 'frameTime',
                message: 'Frame time is high. Enable adaptive quality or reduce effects',
                priority: 'high'
            });
        }
        
        return recommendations;
    }
}