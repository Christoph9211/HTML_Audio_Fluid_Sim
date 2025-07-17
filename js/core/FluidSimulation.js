export class FluidSimulation {
    constructor(width, height, params = {}) {
        this.width = width;
        this.height = height;
        
        // Optimized default parameters
        this.params = {
            viscosity: params.viscosity || 0.0001,
            density: params.density || 1.0,
            speed: params.speed || 1.0,
            particleCount: params.particleCount || 1000,
            resolution: params.resolution || 1.0,
            ...params
        };
        
        this.particles = [];
        this.velocityField = [];
        this.pressureField = [];
        
        // Optimization flags
        this.useGPU = true;
        this.useWorkers = true;
        this.useSpatialHashing = true;
        
        // Spatial hashing for collision detection optimization
        this.spatialHash = new Map();
        this.cellSize = 20;
        
        // Pre-allocated arrays for performance
        this.forces = new Float32Array(this.params.particleCount * 2);
        this.positions = new Float32Array(this.params.particleCount * 2);
        this.velocities = new Float32Array(this.params.particleCount * 2);
        
        this.currentScene = 'default';
        this.audioInfluence = 0;
        
        this.initializeParticles();
        this.initializeFields();
    }
    
    initializeParticles() {
        this.particles = [];
        
        for (let i = 0; i < this.params.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 1.0,
                color: this.getParticleColor(i),
                size: Math.random() * 3 + 1
            });
            
            // Pre-fill typed arrays
            this.positions[i * 2] = this.particles[i].x;
            this.positions[i * 2 + 1] = this.particles[i].y;
            this.velocities[i * 2] = this.particles[i].vx;
            this.velocities[i * 2 + 1] = this.particles[i].vy;
        }
    }
    
    initializeFields() {
        const fieldWidth = Math.floor(this.width / 10);
        const fieldHeight = Math.floor(this.height / 10);
        
        this.velocityField = new Array(fieldWidth * fieldHeight).fill(null).map(() => ({
            vx: 0, vy: 0
        }));
        
        this.pressureField = new Float32Array(fieldWidth * fieldHeight);
    }
    
    getParticleColor(index) {
        const hue = (index * 137.508) % 360; // Golden angle for color distribution
        return `hsl(${hue}, 70%, 60%)`;
    }
    
    update(deltaTime, audioData = null) {
        const dt = Math.min(deltaTime / 1000, 0.016); // Cap at 60fps equivalent
        
        // Update audio influence
        if (audioData) {
            this.updateAudioInfluence(audioData);
        }
        
        // Clear spatial hash
        if (this.useSpatialHashing) {
            this.spatialHash.clear();
        }
        
        // Update particles in batches for better cache performance
        const batchSize = 100;
        for (let i = 0; i < this.particles.length; i += batchSize) {
            const end = Math.min(i + batchSize, this.particles.length);
            this.updateParticleBatch(i, end, dt);
        }
        
        // Apply scene-specific forces
        this.applySceneForces(dt);
        
        // Update velocity field
        this.updateVelocityField(dt);
    }
    
    updateParticleBatch(start, end, dt) {
        for (let i = start; i < end; i++) {
            const particle = this.particles[i];
            
            // Apply forces based on current scene
            this.applyParticleForces(particle, i, dt);
            
            // Integrate velocity
            particle.vx += this.forces[i * 2] * dt;
            particle.vy += this.forces[i * 2 + 1] * dt;
            
            // Apply damping
            particle.vx *= 0.99;
            particle.vy *= 0.99;
            
            // Integrate position
            particle.x += particle.vx * dt * this.params.speed;
            particle.y += particle.vy * dt * this.params.speed;
            
            // Boundary conditions with energy conservation
            this.handleBoundaries(particle);
            
            // Update spatial hash
            if (this.useSpatialHashing) {
                this.updateSpatialHash(particle, i);
            }
            
            // Update typed arrays
            this.positions[i * 2] = particle.x;
            this.positions[i * 2 + 1] = particle.y;
            this.velocities[i * 2] = particle.vx;
            this.velocities[i * 2 + 1] = particle.vy;
        }
    }
    
    applyParticleForces(particle, index, dt) {
        let fx = 0, fy = 0;
        
        // Scene-specific forces
        switch (this.currentScene) {
            case 'vortex':
                const centerX = this.width / 2;
                const centerY = this.height / 2;
                const dx = particle.x - centerX;
                const dy = particle.y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    const strength = 100 / (distance + 1);
                    fx = -dy * strength * this.audioInfluence;
                    fy = dx * strength * this.audioInfluence;
                }
                break;
                
            case 'wave':
                const waveForce = Math.sin(particle.x * 0.01 + Date.now() * 0.001) * 50;
                fy = waveForce * this.audioInfluence;
                break;
                
            case 'spiral':
                const spiralAngle = Math.atan2(particle.y - this.height/2, particle.x - this.width/2);
                const spiralRadius = Math.sqrt(Math.pow(particle.x - this.width/2, 2) + Math.pow(particle.y - this.height/2, 2));
                fx = Math.cos(spiralAngle + spiralRadius * 0.01) * 30 * this.audioInfluence;
                fy = Math.sin(spiralAngle + spiralRadius * 0.01) * 30 * this.audioInfluence;
                break;
        }
        
        // Apply viscosity
        fx -= particle.vx * this.params.viscosity;
        fy -= particle.vy * this.params.viscosity;
        
        this.forces[index * 2] = fx;
        this.forces[index * 2 + 1] = fy;
    }
    
    handleBoundaries(particle) {
        const damping = 0.8;
        
        if (particle.x < 0) {
            particle.x = 0;
            particle.vx = -particle.vx * damping;
        } else if (particle.x > this.width) {
            particle.x = this.width;
            particle.vx = -particle.vx * damping;
        }
        
        if (particle.y < 0) {
            particle.y = 0;
            particle.vy = -particle.vy * damping;
        } else if (particle.y > this.height) {
            particle.y = this.height;
            particle.vy = -particle.vy * damping;
        }
    }
    
    updateSpatialHash(particle, index) {
        const cellX = Math.floor(particle.x / this.cellSize);
        const cellY = Math.floor(particle.y / this.cellSize);
        const key = `${cellX},${cellY}`;
        
        if (!this.spatialHash.has(key)) {
            this.spatialHash.set(key, []);
        }
        this.spatialHash.get(key).push(index);
    }
    
    updateAudioInfluence(audioData) {
        // Calculate average frequency intensity
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i];
        }
        this.audioInfluence = (sum / audioData.length) / 255;
    }
    
    applySceneForces(dt) {
        // Additional scene-specific global forces can be applied here
    }
    
    updateVelocityField(dt) {
        // Simplified velocity field update for performance
        const fieldWidth = Math.floor(this.width / 10);
        const fieldHeight = Math.floor(this.height / 10);
        
        for (let i = 0; i < this.velocityField.length; i++) {
            this.velocityField[i].vx *= 0.95; // Decay
            this.velocityField[i].vy *= 0.95;
        }
    }
    
    addForce(x, y, strength = 1.0) {
        // Add interactive force at position
        const radius = 50;
        const radiusSquared = radius * radius;
        
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const dx = particle.x - x;
            const dy = particle.y - y;
            const distanceSquared = dx * dx + dy * dy;
            
            if (distanceSquared < radiusSquared && distanceSquared > 0) {
                const distance = Math.sqrt(distanceSquared);
                const force = (radius - distance) / radius * strength * 100;
                
                particle.vx += (dx / distance) * force;
                particle.vy += (dy / distance) * force;
            }
        }
    }
    
    render(ctx) {
        // Optimized rendering with batching
        ctx.save();
        
        // Set composite operation for better performance
        ctx.globalCompositeOperation = 'lighter';
        
        // Render particles in batches
        const batchSize = 50;
        for (let i = 0; i < this.particles.length; i += batchSize) {
            ctx.beginPath();
            
            for (let j = i; j < Math.min(i + batchSize, this.particles.length); j++) {
                const particle = this.particles[j];
                
                // Skip particles outside viewport
                if (particle.x < -10 || particle.x > this.width + 10 ||
                    particle.y < -10 || particle.y > this.height + 10) {
                    continue;
                }
                
                ctx.moveTo(particle.x + particle.size, particle.y);
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            }
            
            ctx.fillStyle = `rgba(100, 150, 255, 0.6)`;
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    // Configuration methods
    setScene(sceneName) {
        this.currentScene = sceneName;
    }
    
    setViscosity(value) {
        this.params.viscosity = value * 0.001;
    }
    
    setDensity(value) {
        this.params.density = value;
    }
    
    setSpeed(value) {
        this.params.speed = value * 2;
    }
    
    setParticleCount(count) {
        if (count !== this.params.particleCount) {
            this.params.particleCount = count;
            this.forces = new Float32Array(count * 2);
            this.positions = new Float32Array(count * 2);
            this.velocities = new Float32Array(count * 2);
            this.initializeParticles();
        }
    }
    
    setResolution(resolution) {
        this.params.resolution = resolution;
    }
    
    getParticleCount() {
        return this.particles.length;
    }
    
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.initializeFields();
    }
}