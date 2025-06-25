export class WorkerPool {
    constructor(maxWorkers = navigator.hardwareConcurrency || 4) {
        this.maxWorkers = Math.min(maxWorkers, 8); // Cap at 8 workers
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
        this.isInitialized = false;
        
        this.workerScript = this.createWorkerScript();
    }
    
    createWorkerScript() {
        // Create worker script as blob for particle calculations
        const workerCode = `
            self.onmessage = function(e) {
                const { type, data, taskId } = e.data;
                
                switch(type) {
                    case 'updateParticles':
                        const result = updateParticlesBatch(data);
                        self.postMessage({ type: 'particlesUpdated', result, taskId });
                        break;
                    
                    case 'calculateForces':
                        const forces = calculateForcesBatch(data);
                        self.postMessage({ type: 'forcesCalculated', result: forces, taskId });
                        break;
                    
                    case 'spatialHash':
                        const hash = calculateSpatialHash(data);
                        self.postMessage({ type: 'spatialHashCalculated', result: hash, taskId });
                        break;
                }
            };
            
            function updateParticlesBatch(data) {
                const { particles, forces, deltaTime, params } = data;
                const updatedParticles = [];
                
                for (let i = 0; i < particles.length; i++) {
                    const particle = particles[i];
                    const fx = forces[i * 2] || 0;
                    const fy = forces[i * 2 + 1] || 0;
                    
                    // Update velocity
                    particle.vx += fx * deltaTime;
                    particle.vy += fy * deltaTime;
                    
                    // Apply damping
                    particle.vx *= 0.99;
                    particle.vy *= 0.99;
                    
                    // Update position
                    particle.x += particle.vx * deltaTime * params.speed;
                    particle.y += particle.vy * deltaTime * params.speed;
                    
                    updatedParticles.push(particle);
                }
                
                return updatedParticles;
            }
            
            function calculateForcesBatch(data) {
                const { particles, scene, audioInfluence, width, height } = data;
                const forces = new Float32Array(particles.length * 2);
                
                for (let i = 0; i < particles.length; i++) {
                    const particle = particles[i];
                    let fx = 0, fy = 0;
                    
                    switch(scene) {
                        case 'vortex':
                            const centerX = width / 2;
                            const centerY = height / 2;
                            const dx = particle.x - centerX;
                            const dy = particle.y - centerY;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            if (distance > 0) {
                                const strength = 100 / (distance + 1);
                                fx = -dy * strength * audioInfluence;
                                fy = dx * strength * audioInfluence;
                            }
                            break;
                            
                        case 'wave':
                            const waveForce = Math.sin(particle.x * 0.01 + Date.now() * 0.001) * 50;
                            fy = waveForce * audioInfluence;
                            break;
                    }
                    
                    forces[i * 2] = fx;
                    forces[i * 2 + 1] = fy;
                }
                
                return forces;
            }
            
            function calculateSpatialHash(data) {
                const { particles, cellSize } = data;
                const hash = {};
                
                for (let i = 0; i < particles.length; i++) {
                    const particle = particles[i];
                    const cellX = Math.floor(particle.x / cellSize);
                    const cellY = Math.floor(particle.y / cellSize);
                    const key = cellX + ',' + cellY;
                    
                    if (!hash[key]) {
                        hash[key] = [];
                    }
                    hash[key].push(i);
                }
                
                return hash;
            }
        `;
        
        return new Blob([workerCode], { type: 'application/javascript' });
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            for (let i = 0; i < this.maxWorkers; i++) {
                const worker = new Worker(URL.createObjectURL(this.workerScript));
                
                worker.onmessage = (e) => this.handleWorkerMessage(worker, e);
                worker.onerror = (error) => this.handleWorkerError(worker, error);
                
                this.workers.push(worker);
                this.availableWorkers.push(worker);
            }
            
            this.isInitialized = true;
            console.log(`Worker pool initialized with ${this.maxWorkers} workers`);
            
        } catch (error) {
            console.error('Failed to initialize worker pool:', error);
            throw error;
        }
    }
    
    handleWorkerMessage(worker, event) {
        const { type, result, taskId } = event.data;
        
        // Find and resolve the corresponding task
        const taskIndex = this.taskQueue.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            const task = this.taskQueue[taskIndex];
            this.taskQueue.splice(taskIndex, 1);
            
            if (task.resolve) {
                task.resolve(result);
            }
        }
        
        // Return worker to available pool
        if (!this.availableWorkers.includes(worker)) {
            this.availableWorkers.push(worker);
        }
        
        // Process next task in queue
        this.processNextTask();
    }
    
    handleWorkerError(worker, error) {
        console.error('Worker error:', error);
        
        // Find and reject corresponding tasks
        const workerTasks = this.taskQueue.filter(task => task.worker === worker);
        workerTasks.forEach(task => {
            if (task.reject) {
                task.reject(error);
            }
        });
        
        // Remove failed tasks from queue
        this.taskQueue = this.taskQueue.filter(task => task.worker !== worker);
        
        // Return worker to available pool (it might still be usable)
        if (!this.availableWorkers.includes(worker)) {
            this.availableWorkers.push(worker);
        }
    }
    
    async executeTask(type, data) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        return new Promise((resolve, reject) => {
            const taskId = this.generateTaskId();
            const task = {
                id: taskId,
                type,
                data,
                resolve,
                reject,
                timestamp: performance.now()
            };
            
            this.taskQueue.push(task);
            this.processNextTask();
        });
    }
    
    processNextTask() {
        if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
            return;
        }
        
        const worker = this.availableWorkers.pop();
        const task = this.taskQueue.find(t => !t.worker);
        
        if (task) {
            task.worker = worker;
            worker.postMessage({
                type: task.type,
                data: task.data,
                taskId: task.id
            });
        } else {
            // No available tasks, return worker to pool
            this.availableWorkers.push(worker);
        }
    }
    
    generateTaskId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
    
    // High-level API methods
    async updateParticles(particles, forces, deltaTime, params) {
        const batchSize = Math.ceil(particles.length / this.maxWorkers);
        const batches = [];
        
        for (let i = 0; i < particles.length; i += batchSize) {
            const batch = particles.slice(i, i + batchSize);
            const batchForces = forces.slice(i * 2, (i + batchSize) * 2);
            
            batches.push(this.executeTask('updateParticles', {
                particles: batch,
                forces: batchForces,
                deltaTime,
                params
            }));
        }
        
        const results = await Promise.all(batches);
        return results.flat();
    }
    
    async calculateForces(particles, scene, audioInfluence, width, height) {
        const batchSize = Math.ceil(particles.length / this.maxWorkers);
        const batches = [];
        
        for (let i = 0; i < particles.length; i += batchSize) {
            const batch = particles.slice(i, i + batchSize);
            
            batches.push(this.executeTask('calculateForces', {
                particles: batch,
                scene,
                audioInfluence,
                width,
                height
            }));
        }
        
        const results = await Promise.all(batches);
        
        // Combine results into single Float32Array
        const totalForces = new Float32Array(particles.length * 2);
        let offset = 0;
        
        results.forEach(batchForces => {
            totalForces.set(batchForces, offset);
            offset += batchForces.length;
        });
        
        return totalForces;
    }
    
    async calculateSpatialHash(particles, cellSize) {
        return this.executeTask('spatialHash', {
            particles,
            cellSize
        });
    }
    
    // Utility methods
    getWorkerCount() {
        return this.workers.length;
    }
    
    getAvailableWorkerCount() {
        return this.availableWorkers.length;
    }
    
    getQueueLength() {
        return this.taskQueue.length;
    }
    
    getWorkerUtilization() {
        const busyWorkers = this.workers.length - this.availableWorkers.length;
        return (busyWorkers / this.workers.length) * 100;
    }
    
    // Cleanup
    terminate() {
        this.workers.forEach(worker => {
            worker.terminate();
        });
        
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
        this.isInitialized = false;
        
        // Clean up blob URL
        URL.revokeObjectURL(this.workerScript);
        
        console.log('Worker pool terminated');
    }
    
    // Performance monitoring
    getPerformanceMetrics() {
        const now = performance.now();
        const queuedTasks = this.taskQueue.filter(task => !task.worker);
        const activeTasks = this.taskQueue.filter(task => task.worker);
        
        return {
            totalWorkers: this.workers.length,
            availableWorkers: this.availableWorkers.length,
            utilization: this.getWorkerUtilization(),
            queuedTasks: queuedTasks.length,
            activeTasks: activeTasks.length,
            averageTaskAge: activeTasks.length > 0 ? 
                activeTasks.reduce((sum, task) => sum + (now - task.timestamp), 0) / activeTasks.length : 0
        };
    }
}