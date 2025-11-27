import * as THREE from 'three';
import GPGPUUtils from './GPGPUUtils';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

export default class GPGPU {
    /**
     * @param {{ size: number, camera: any, renderer: any, scene: any, model: any, sizes: any }} params
     */
    constructor({ size, camera, renderer, scene, model, sizes }) {
        this.camera = camera; // Camera
        this.renderer = renderer; // Renderer
        this.scene = scene; // Global scene
        this.sizes = sizes; // Sizes of the scene, canvas, pixel ratio
        this.size = size; // Amount of GPGPU particles
        this.model = model; // Mesh from which we will sample the particles

        console.log(this.model);
        this.init();
    }

    init() {
        this.utils = new GPGPUUtils(this.model, this.size); // Setup GPGPUUtils

        this.simFragmentPositionShader = `
        uniform sampler2D uOriginalPosition;
        uniform float uTime;
        uniform float uLifespan;
        void main() {
            vec2 vUv = gl_FragCoord.xy / resolution.xy;
            vec3 original = texture2D(uOriginalPosition, vUv).xyz;
            float phase = fract(vUv.x + vUv.y);
            float startTime = phase * uLifespan;
            float localTime = mod(uTime - startTime, uLifespan);
            vec3 position = original;
            float alpha = 1.0;
            if (localTime < uLifespan) {
                float t = localTime / uLifespan;
                position.y += t * 0.1;
				
                alpha = 1.0 - t;
            } else {
                position = original;
                alpha = 0.0;
            }
		
            gl_FragColor = vec4(position, alpha);
        }
        `;
        this.simFragmentVelocityShader = `
		uniform sampler2D uOriginalPosition;
        uniform float uNoise;
        uniform float uTime;

		void main() {
			vec2 vUv = gl_FragCoord.xy / resolution.xy;

			vec3 position = texture2D( uCurrentPosition, vUv ).xyz;
			vec3 original = texture2D( uOriginalPosition, vUv ).xyz;
			vec3 velocity = texture2D( uCurrentVelocity, vUv ).xyz;

            // --- 각 포인트마다 속도 오프셋 부여 ---
            float baseSpeed = 0.01;
            float offset = fract(sin(dot(vUv, vec2(12.9898,78.233))) * 43758.5453)/1.0; // 0~1 해시
            float speed = baseSpeed + offset * 0.04; // 0.03~0.07
            // velocity.x = 0.0;
            // velocity.z = 0.0;
			// velocity.y= 0.001 *speed;
            // ----------------------------------
		
		
			gl_FragColor = vec4(velocity, 1.);
		}
		`;
        this.vertexShader = `
		varying vec2 vUv;
		varying vec3 vPosition;
		varying float vAlpha;
		uniform float uParticleSize;
		uniform sampler2D uPositionTexture;
		uniform float uTime;

		void main() {
			vUv = uv;

			vec3 newpos = position;

			vec4 color = texture2D( uPositionTexture, vUv );
			newpos.xyz = color.xyz;
			vAlpha = color.w;

		

			vPosition = newpos;

			vec4 mvPosition = modelViewMatrix * vec4( newpos, 1.0 );
			gl_PointSize = ( uParticleSize / -mvPosition.z );
			gl_Position = projectionMatrix * mvPosition;
		}
		`;

        this.fragmentShader = `
		varying vec2 vUv;
		varying float vAlpha;
		uniform sampler2D uVelocityTexture;

		void main() {
			float center = length(gl_PointCoord - 0.5);

			if (center > 0.5) { discard; }

			gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha);
		}
		`;

        this.initGPGPU();
        this.createParticles();
    }

    initGPGPU() {
        this.gpgpuCompute = new GPUComputationRenderer(
            this.sizes.width,
            this.sizes.width,
            this.renderer
        );

        const positionTexture = this.utils.getPositionTexture();
        const velocityTexture = this.utils.getVelocityTexture();

        this.positionVariable = this.gpgpuCompute.addVariable(
            'uCurrentPosition',
            this.simFragmentPositionShader,
            positionTexture
        );

        this.velocityVariable = this.gpgpuCompute.addVariable(
            'uCurrentVelocity',
            this.simFragmentVelocityShader,
            velocityTexture
        );

        if (this.positionVariable && this.velocityVariable) {
            this.gpgpuCompute.setVariableDependencies(this.positionVariable, [
                this.positionVariable,
                this.velocityVariable
            ]);
            this.gpgpuCompute.setVariableDependencies(this.velocityVariable, [
                this.positionVariable,
                this.velocityVariable
            ]);
        }

        this.uniforms = {
            positionUniforms: this.positionVariable.material.uniforms,
            velocityUniforms: this.velocityVariable.material.uniforms
        };

        if (this.uniforms.velocityUniforms) {
            this.uniforms.velocityUniforms.uNoise = { value: 0 };
            this.uniforms.velocityUniforms.uOriginalPosition = { value: positionTexture };
            this.uniforms.velocityUniforms.uTime = { value: 0 };
        }
        if (this.uniforms.positionUniforms) {
            this.uniforms.positionUniforms.uOriginalPosition = { value: positionTexture };
            this.uniforms.positionUniforms.uTime = { value: 0 };
            this.uniforms.positionUniforms.uLifespan = { value: 1.0 };
        }

        this.gpgpuCompute.init();
    }

    createParticles() {
        // Setup Particles Material
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uPositionTexture: {
                    value: this.gpgpuCompute.getCurrentRenderTarget(this.positionVariable).texture
                },
                uVelocityTexture: {
                    value: this.gpgpuCompute.getCurrentRenderTarget(this.velocityVariable).texture
                },
                uResolution: { value: new THREE.Vector2(this.sizes.width, this.sizes.height) },
                uParticleSize: { value: 5.0 },
                uTime: { value: 0 }
            },
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader,
            depthWrite: true,
            depthTest: true,
            transparent: true
        });

        // Setup Particles Geometry
        const geometry = new THREE.BufferGeometry();

        // Get positions, uvs data for geometry attributes
        const positions = this.utils.getPositions();
        const uvs = this.utils.getUVs();

        // Set geometry attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        this.mesh = new THREE.Points(geometry, this.material);

        this.scene.add(this.mesh);
    }

    // Smoothly morph points to new mesh, then fully reset GPGPU
    async animateToNewMesh(newMesh, duration = 1.0) {
        // 1. Save old positions
        const oldPositions = this.utils.getPositions().slice(); // Float32Array copy
        // 2. Sample new positions from new mesh
        const tempUtils = new GPGPUUtils(newMesh, this.size);
        const newPositions = tempUtils.getPositions();
        // 3. Animate geometry positions
        const geometry = this.mesh.geometry;
        const posAttr = geometry.getAttribute('position');
        let start = null;
        // Optionally pause GPGPU compute during morph
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const t = Math.min((timestamp - start) / (duration * 1000), 1.0);
            for (let i = 0; i < oldPositions.length; i++) {
                posAttr.array[i] = oldPositions[i] * (1 - t) + newPositions[i] * t;
            }
            posAttr.needsUpdate = true;
            if (t < 1.0) {
                requestAnimationFrame(animate);
            } else {
                // After morph, fully reset GPGPU to new mesh
                this.updateMesh(newMesh, true);
            }
        };
        requestAnimationFrame(animate);
    }

    updateMesh(newMesh, fullReset = true) {
        console.log('updateMesh', newMesh);
        this.utils = new GPGPUUtils(newMesh, this.size);

        const positions = this.utils.getPositions();
        const uvs = this.utils.getUVs();
        console.log('positions', positions && positions.length, positions);
        console.log('uvs', uvs && uvs.length, uvs);
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
        }

        if (fullReset) {
            if (positions && uvs && positions.length > 0 && uvs.length > 0) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                if (this.mesh && this.scene) this.scene.remove(this.mesh);
                this.mesh = new THREE.Points(geometry, this.material);
                console.log('this.mesh', this.mesh);
                if (this.scene) this.scene.add(this.mesh);
                console.log(
                    'New Points added to scene',
                    this.mesh,
                    this.scene && this.scene.children.includes(this.mesh)
                );
            } else {
                console.warn('Positions or UVs are invalid, Points not created');
            }
        }
    }

    compute(time) {
        if (this.gpgpuCompute) {
            if (this.uniforms && this.uniforms.positionUniforms && this.uniforms.positionUniforms.uTime) {
                this.uniforms.positionUniforms.uTime.value = time * 0.001;
            }
            this.gpgpuCompute.compute();
        }
    }

    // Completely reset GPGPU system with a new mesh
    resetWithNewMesh(newMesh) {
        // Remove and dispose old Points
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.mesh = null;
        }
        // Optionally dispose GPGPUCompute, etc. if needed
        // Update model and re-init
        this.model = newMesh;

        this.init(); // Recreate utils, gpgpuCompute, material, mesh, and add mesh to scene
    }

    animatePoints(time) {
        if (this.uniforms && this.uniforms.velocityUniforms && this.uniforms.velocityUniforms.uTime) {
            this.uniforms.velocityUniforms.uTime.value = time * 0.001;
        }

        if (this.mesh) {
            // this.mesh.rotation.x = time * 0.0001;
            // this.mesh.rotation.y += 0.005;
            // this.mesh.rotation.z = time * 0.0001;
        }
    }
}