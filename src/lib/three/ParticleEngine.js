import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { DRACOLoader } from 'three-stdlib';
import GPGPU from './GPGPU';
import gsap from 'gsap';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { modelUpdateState } from '../stores/imageStore.svelte';

export class ParticleEngine {
    /**
     * @type {{ modelUrl: string, imageUrl: string, position: { x: number, y: number, z: number }, mesh: THREE.Mesh }[]}
     */
    models;
    cameraTarget;
    orbitAngle;
    orbitRadius;
    isOrbiting;
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 10);
        this.camera.position.z = 15;
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.rangeX = 7.0;
        this.rangeY = 0.0;
        this.rangeZ = 7.0;
        this.objectLoading = false;
        /**
         * @type {{ modelUrl: string, imageUrl: string, position: { x: number, y: number, z: number } }[]}
         */
        this.models = [];
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        // 박물 관 느낌의 어두운 배경
        this.targetObject = new THREE.Mesh(
            new THREE.BoxGeometry(3, 3, 3),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        this.targetObject.position.set(0, 2, 0);
        this.targetObject.visible = false;

        this.scene.add(this.targetObject);
        this.scene.background = new THREE.Color(0x000000);

        this.blackMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.3,
            metalness: 0.8,
          
            opacity: 1
        });
        this.lightGroup = new THREE.Group();
        this.scene.add(this.lightGroup);
        // 메인 오브젝트를 비추는 3방향 스포트라이트 (박물관 유물 전시 느낌)
        // 좌측에서 비추는 스포트라이트
        this.mainSpotLight = new THREE.SpotLight(0xffffff, 24.0);
        this.mainSpotLight.position.set(0, 15, 40);
        this.mainSpotLight.angle = Math.PI / 4;
        this.mainSpotLight.penumbra = 0.1;
        this.mainSpotLight.decay = 0.2;
        this.mainSpotLight.distance = 50;
        this.mainSpotLight.castShadow = false;
        this.mainSpotLight.target = this.targetObject;
        this.lightGroup.add(this.mainSpotLight);
        this.lightGroup.add(this.mainSpotLight.target);

        // Helper
        const mainSpotHelper = new THREE.SpotLightHelper(this.mainSpotLight);
        // this.scene.add(mainSpotHelper);

        // 좌측에서 비추는 스포트라이트
        this.leftSpotLight = new THREE.SpotLight(0xffffff, 12.0);
        this.leftSpotLight.position.set(-35, 60, 0);
        this.leftSpotLight.angle = Math.PI / 10;
        this.leftSpotLight.penumbra = 0.5;
        this.leftSpotLight.decay = 0.01;
        this.leftSpotLight.distance = 80;
        this.leftSpotLight.castShadow = false;
        this.lightGroup.add(this.leftSpotLight);
        this.lightGroup.add(this.leftSpotLight.target);
        // Helper
        const leftSpotHelper = new THREE.SpotLightHelper(this.leftSpotLight);
        // this.scene.add(leftSpotHelper);

        // 우측 뒤에서 비추는 스포트라이트
        this.backRightSpotLight = new THREE.SpotLight(0xffffff, 10.8);
        this.backRightSpotLight.position.set(25, 45, -30);
        this.backRightSpotLight.angle = Math.PI / 20;
        this.backRightSpotLight.penumbra = 0.5;
        this.backRightSpotLight.decay = 0.02;
        this.backRightSpotLight.distance = 70;
        this.backRightSpotLight.castShadow = false;
        this.backRightSpotLight.target = this.targetObject;
        this.lightGroup.add(this.backRightSpotLight);
        this.lightGroup.add(this.backRightSpotLight.target);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 16.0);
        this.directionalLight.position.set(4, 10, 0);
        this.directionalLight.target = this.targetObject;
        this.lightGroup.add(this.directionalLight);
        this.lightGroup.add(this.directionalLight.target);


        // Helper
        const backRightSpotHelper = new THREE.SpotLightHelper(this.backRightSpotLight);
        // this.scene.add(backRightSpotHelper);

        // 약간의 부드러운 환경광
        const ambient = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(ambient);

        this.orbitAngle = 0;
        this.orbitRadius = 3;
        this.isOrbiting = false;

        window.addEventListener('resize', this.handleResize);
        this.handleResize = this.handleResize.bind(this);

        // --- POSTPROCESSING SETUP ---
        const renderScene = new RenderPass(this.scene, this.camera);
        const bloomParams = {
            strength: 0.5, // bloom intensity
            threshold: 0.6,
            radius: 0.1
        };
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            bloomParams.strength,
            bloomParams.radius,
            bloomParams.threshold
        );
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(bloomPass);
        // --- END POSTPROCESSING SETUP ---

        this.init();
        this.animate();
        this.startOrbitCamera();
   
    }

    init() {
       
     

             this.updateInitScene();

       
    }

    async loadGLB(url) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
            loader.setDRACOLoader(dracoLoader);
            loader.load(
                url,
                (gltf) => {
                    console.log(gltf);
                    let mesh;
                    gltf.scene.traverse((child) => {
                        if (child.isMesh) {
                            console.log(child);
                            child.material = this.blackMaterial;
                            mesh = child;
                        }
                    });
                    resolve(mesh);
                },
                undefined,
                (error) => {
                    console.error('GLB 로드 실패:', error);
                    resolve(null);
                }
            );
        });
    }

    updateTowerMesh(imageUrl, modelUrl) {
        modelUpdateState.isUpdatingSuccess = false;
        modelUpdateState.isUpdating = true;
        this.objectLoading = true;
        this.stopOrbitCamera();
        let randomPositionX = (2 * Math.random() - 1) * this.rangeX;
        let randomPositionY = 0;
        let randomPositionZ = (2 * Math.random() - 1) * this.rangeZ;

        try {
            this.loadGLB(modelUrl).then(async(object) => {
                if (object) {
                   
                    object.traverse((child) => {
                        if (child.isMesh) {
                            child.position.set(randomPositionX, 0, randomPositionZ);
                            this.scene.add(child);
                            child.material.transparent = true;
                            child.material.opacity = 0;
                            gsap.to(child.material, {
                                opacity: 1,
                                duration: 2.0,
                                ease: 'linear'
                            });

                            //만약 모델이 10개가 넘으면 가장 처음 모델을 삭제
                            if(this.models.length >= 10){
                                console.log('10개 이상 모델 삭제');
                                // 배열의 첫 번째 요소(가장 오래된 모델)를 제거합니다
                                //배열의 첫번째 요소 모델을 씬에서도 삭제
                                this.scene.remove(this.models[0].mesh);
                                this.models.shift();
                           
                            }


                            this.models.push({
                                modelUrl: modelUrl,
                                imageUrl: imageUrl,
                                position: { x: randomPositionX, y: 0, z: randomPositionZ },
                                mesh: child
                            });
                            this.mainObject = child;
                            child.updateMatrixWorld(true);
                            this.fitCameraToObject(child);
                            // --- geometry merge & GPGPU update ---
                            // 1. 모든 models의 mesh에서 geometry 복사 (world transform 적용)
                            const geometries = this.models.map((m) => {
                                const geom = m.mesh.geometry.clone();
                                m.mesh.updateMatrixWorld(true);
                                geom.applyMatrix4(m.mesh.matrixWorld);
                                return geom;
                            });
                            // 2. merge
                            const mergedGeometry = mergeGeometries(geometries, false);
                            // 3. 새로운 mesh로 만들어 GPGPU에 넘김
                            const mergedMesh = new THREE.Mesh(mergedGeometry, child.material);
                            if (this.gpgpu) {
                                this.gpgpu.resetWithNewMesh(mergedMesh);
                            }
                           
                                this.updateModelListDB(modelUrl,imageUrl, { x: randomPositionX, y: 0, z: randomPositionZ });
                            
                        }
                    });
                }
            });
        } catch (error) {
            console.error('updateTowerMesh', error);
        }
    }

    /**
     * @param {{ x: number, y?: number, z: number }} newPos
     */
    moveLighting(newPos) {
        // targetObject의 position만 리니어하게 이동
        gsap.to(this.targetObject.position, {
            x: newPos.x,
            z: newPos.z,
            duration: 1.2,
            ease: 'linear',
            // y는 고정(원래 targetObject.position.y)
            onUpdate: () => {
                // 필요시, 조명 helper 업데이트 등 추가 가능
            },
            onComplete: () => {
                // lightGroup 전체를 이동하고 싶다면 아래 코드 유지
                gsap.to(this.lightGroup.position, {
                    x: newPos.x,
                    z: newPos.z,
                    duration: 1.2,
                    ease: 'linear'
                });
            }
        });
    }

    convertToDisplacementMap(imageUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

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
                    data[i] = brightness; // R
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

    fitCameraToObject(target) {
        if (!target) return;
        target.updateMatrixWorld(true);

        const boundingBox = new THREE.Box3().setFromObject(target);
        const center = boundingBox.getCenter(new THREE.Vector3());
        const fixedDistance = 3;

        const cameraDir = new THREE.Vector3().subVectors(this.camera.position, center).normalize();
        const newCameraPos = {
            x: center.x + cameraDir.x * fixedDistance,
            y: center.y + cameraDir.y * fixedDistance,
            z: center.z + cameraDir.z * fixedDistance
        };

        // 1. lookAt 타겟(cameraTarget)을 부드럽게 center로 이동
        gsap.to(this.cameraTarget, {
            x: center.x,
            y: center.y,
            z: center.z,
            duration: 3.2,
            ease: 'linear',
            onComplete: () => {
                // 2. lookAt 완료 후, position을 그 방향으로 이동
                gsap.to(this.camera.position, {
                    x: newCameraPos.x,
                    y: newCameraPos.y,
                    z: newCameraPos.z,
                    duration: 2.2,
                    ease: 'linear',
                    onComplete: () => {
                        this.objectLoading = false;
                        this.startOrbitCamera();
                        modelUpdateState.isUpdating = false;
                        modelUpdateState.isUpdatingSuccess = true;
                    }
                });
            }
        });

        this.camera.near = 1.0;
        this.camera.far = 5.0;
        this.camera.updateProjectionMatrix();

        this.moveLighting(target.position);
        console.log(this.models);
    }

    handleResize = () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    };

    animate = () => {
        this.time = performance.now();
        requestAnimationFrame(this.animate);

        // 카메라 궤도 회전
        if (this.isOrbiting && this.mainObject && !this.objectLoading) {
            this.orbitAngle += 0.005; // 회전 속도 조절
            const center = this.mainObject.position;
            const targetY = center.y;
            // y값을 부드럽게 보간
            this.camera.position.y += (targetY - this.camera.position.y) * 0.05;
            this.camera.position.x = center.x + this.orbitRadius * Math.cos(this.orbitAngle);
            this.camera.position.z = center.z + this.orbitRadius * Math.sin(this.orbitAngle);
            this.camera.lookAt(center);
        } else {
            this.camera.lookAt(this.cameraTarget);
        }

        this.camera.updateProjectionMatrix();
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        if (this.mainObject) {}
        if (this.gpgpu) {
            this.gpgpu.compute(this.time);
            this.gpgpu.animatePoints(this.time);
        }
        if (this.lightGroup) {
            this.lightGroup.rotation.y += 0.005;
        }
    };

    // 카메라 궤도 회전 시작
    startOrbitCamera() {
        if (this.mainObject) {
            const center = this.mainObject.position;
            const dx = this.camera.position.x - center.x;
            const dz = this.camera.position.z - center.z;
            this.orbitAngle = Math.atan2(dz, dx);
            this.orbitRadius = Math.sqrt(dx * dx + dz * dz);
        }
        this.isOrbiting = true;
    }

    // 카메라 궤도 회전 중지
    stopOrbitCamera() {
        this.isOrbiting = false;
    }


    async updateModelListDB(modelUrl, imageUrl, position){
        let postUrl = '/api/sheet?action=updateModelList';
        let postData = {
            modelUrl: modelUrl,
            imageUrl: imageUrl,
            position: position
        };
        try {
            const response = await fetch(postUrl, {
                method: 'POST',
                body: JSON.stringify(postData)
            });
            const data = await response.json();
            console.log(data);
            if(data.success){
                console.log('Successfully updated Models Sheets:', { modelUrl, position });
            }else{
                console.error('Failed to update Models Sheets:', data);
            }
        } catch (error) {
            console.error('updateModelListDB', error);
        }
    }


    async getModelListDB(){
        let getUrl = '/api/sheet?action=getModelList';
        try {
            const response = await fetch(getUrl);
            const data = await response.json();
            console.log('getModelListDB', data);
         return data;
        } catch (error) {
            console.error('getModelListDB', error);
        }
    }

    async updateInitScene(){
        modelUpdateState.isUpdating = false;
        modelUpdateState.isUpdatingSuccess = false;
        let modelList = await this.getModelListDB();    
        console.log('updateInitScene', modelList);
   
   
            if(modelList.length === 0){
                          const object = await this.loadGLB('./tower.glb');
            if (object) {
                this.mainObject = object;
                this.scene.add(this.mainObject);
                this.fitCameraToObject(this.mainObject);
                console.log(this.mainObject);
            }

            }else{
                   for(let i = 0; i < modelList.length; i++){
            let model = modelList[i];
            let modelUrl = model.modelUrl;
            let imageUrl = model.imageUrl;
            let position = model.position;
            await this.addModelToScene(modelUrl,imageUrl,position);
        }


        

            }


     console.log('sss',this.models);

let geometries = [];
     for(let i = 0; i < this.models.length; i++){
        let model = this.models[i].mesh;
        model.updateMatrixWorld(true);
      let geometry = model.geometry.clone();
      geometry.applyMatrix4(model.matrixWorld);
      console.log('geometry',geometry);
      geometries.push(geometry);
     }


   

        const mergedGeometry = mergeGeometries(geometries, false);
        const mergedMesh = new THREE.Mesh(mergedGeometry,this.blackMaterial);

        this.gpgpu = new GPGPU({
            size: 1000,
            camera: this.camera,
            renderer: this.renderer,
            scene: this.scene,
            model: mergedMesh,
            sizes: { width: window.innerWidth, height: window.innerHeight }
        });

        if (this.gpgpu) {
            this.gpgpu.resetWithNewMesh(mergedMesh);
        }
        console.log('asdfsfd2sdafasdfs');
        //가장 마지막 모델
        this.mainObject = this.models[this.models.length - 1].mesh;
        this.mainObject.updateMatrixWorld(true);
        console.log('mainObject',this.mainObject);
        this.cameraTarget.set(this.mainObject.position.x,this.mainObject.position.y,this.mainObject.position.z);
 
        

    }

    async addModelToScene(modelUrl, imageUrl, position) {
        this.objectLoading = true;
        this.stopOrbitCamera();
        try {
            const object = await this.loadGLB(modelUrl);
            if (object) {
               
                object.traverse((child) => {
                    if (child.isMesh) {
                        console.log('child', child);
                        child.position.set(position.x, 0, position.z);
                        this.scene.add(child);
                        child.material.transparent = true;
                        this.models.push({
                            modelUrl: modelUrl,
                            imageUrl: imageUrl,
                            position: position,
                            mesh: child
                        });
                        child.updateMatrixWorld(true);
                    }
                });
            }
        } catch (error) {
            console.error('addModelToScene', error);
        }
    }

    
}