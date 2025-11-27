import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { DRACOLoader } from 'three-stdlib';
import { OrbitControls } from 'three-stdlib';


//이미지를 받아 plane 메쉬 생성하고 해당 이미지를
// 텍스쳐로 사용하며 해당 이미지의 명암 정보로 그레이스케일 이미지를 만들어 
// displacement map으로 사용


export default class AttachObj {
    public object: THREE.Object3D;
    public heightMap: THREE.Texture;
    public diffuseMap: THREE.Texture;

    constructor(
        public imageUrl: string,
        public displacementScale: number,
        public segmentX: number,
        public segmentY: number
    ) {
        this.imageUrl = imageUrl;
        this.displacementScale = displacementScale;
        this.segmentX = segmentX;
        this.segmentY = segmentY;
        this.object = new THREE.Object3D();
        this.heightMap = new THREE.Texture();
        this.diffuseMap = new THREE.Texture();
    }

    async init() {
			//베이스 오브젝트 생성, 플레인 메쉬 생성

			const baseGeometry = new THREE.PlaneGeometry(0.9 * 2.5, 1.6 * 2.5, this.segmentX, this.segmentY);
			//sphereGeometry 생성
			// const baseGeometry = new THREE.SphereGeometry(2, 32, 32);

			//이미지 텍스쳐 준비

			this.diffuseMap = new THREE.TextureLoader().load(this.imageUrl);
			this.heightMap = await this.convertToDisplacementMap(this.imageUrl);

			console.log('heightMap', this.heightMap);
			console.log('diffuseMap', this.diffuseMap);

			const baseMaterial = new THREE.ShaderMaterial({
				uniforms: {
					map: { value: this.heightMap },
					displacementMap: { value: this.heightMap },
					displacementScale: { value: this.displacementScale },
					time: { value: 0.0 }
				},
				vertexShader: `
                uniform sampler2D displacementMap;
                uniform float displacementScale;
                uniform float time;
                varying vec2 vUv;
                varying vec3 vNormal;
                
                void main() {
                    vUv = uv;
                    vNormal = normal;
                    
                    // Add some animation to UV coordinates
                    vec2 animatedUV = vUv + vec2(time * 0.1);
                    
                    // Sample displacement map
                    vec4 noise = texture2D(displacementMap, animatedUV);
                    
                    // Create organic displacement using noise
                    float displacement = noise.r * displacementScale;
                    vec3 newPosition = position + normal * displacement;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                }
            `,
				fragmentShader: `
                uniform sampler2D map;
                varying vec2 vUv;
                varying vec3 vNormal;
                
                void main() {
                    vec4 texColor = texture2D(map, vUv);
                    gl_FragColor = texColor;
                }
            `
			});
			const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
			this.object.add(baseMesh);
			console.log('baseMesh', baseMesh);

			this.returnObject();
		}

    returnObject() {
        return this.object;
    }

    convertToDisplacementMap(imageUrl: string) {
        return new Promise<THREE.Texture>((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw original image
                ctx.drawImage(img, 0, 0);
                
                // Get image data
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // Convert to grayscale based on pixel brightness
                for (let i = 0; i < data.length; i += 4) {
                    // Calculate brightness using luminance formula
                    const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    
                    // Set RGB values to the brightness value
                    data[i] = brightness;     // R
                    data[i + 1] = brightness; // G 
                    data[i + 2] = brightness; // B
                    // Alpha channel (data[i + 3]) remains unchanged
                }
                
                // Put the modified image data back
                ctx.putImageData(imageData, 0, 0);
                
                // Create and return a Three.js texture from the canvas
                const texture = new THREE.Texture(canvas);
                texture.needsUpdate = true;
                resolve(texture);
            };
            
            img.src = imageUrl;
        });
    }

        async imageURLToBase64(imageUrl: string): Promise<string> {
        try {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onerror = () => reject(new Error('Failed to load image'));
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            throw new Error('Failed to get canvas context');
                        }

                        canvas.width = img.width;
                        canvas.height = img.height;

                        ctx.drawImage(img, 0, 0);
                        
                        const base64 = canvas.toDataURL('image/png');
                        resolve(base64);
                    } catch (err) {
                        reject(err);
                    }
                };
                img.src = imageUrl;
            });
        } catch (err) {
            throw new Error(`Failed to convert image to base64: ${err.message}`);
        }
    }
    
    
}

