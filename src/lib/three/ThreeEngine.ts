import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { DRACOLoader } from 'three-stdlib';
import { OrbitControls } from 'three-stdlib';
import ProjectedMaterial from 'three-projected-material'
import gsap from 'gsap';
import GPGPU from './GPGPU';

export default class ThreeEngine {
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private renderer: THREE.WebGLRenderer;
	private animationId: number | null = null;
	private canvas: HTMLCanvasElement;
	public mainObject: THREE.Object3D | null = null;
	private controls: OrbitControls;
	private targetObject: THREE.Object3D | null = null;
	private mainSpotLight: THREE.SpotLight | null = null;
	private leftSpotLight: THREE.SpotLight | null = null;
	private backRightSpotLight: THREE.SpotLight | null = null;
	private scatterIndex: number = 0;
	private scatterPositions: { pos: THREE.Vector3; normal: THREE.Vector3 }[] | null = null;
	private scatterOccupied: boolean[] | null = null;
	private scatterFloors: { pos: THREE.Vector3; normal: THREE.Vector3 }[][] | null = null;
	private scatterOccupiedFloors: boolean[][] | null = null;
	private floorHeight: number = 12.0; // 층 높이 간격(원하는 값으로 조정)
	public instancePositions: THREE.Vector3[] = [];
	public instanceNormals: THREE.Vector3[] = [];
	private towerGroup: THREE.Group | null = null;
	private blackMaterial: THREE.MeshPhysicalMaterial | null = null;
	private heightMap: THREE.Texture | null = null;
	private lightGroup: THREE.Group | null = null;
	private displacementMap: THREE.Texture | null = null;
	private diffuseMap: THREE.Texture | null = null;
	private projectedMaterial: ProjectedMaterial | null = null;
	private projectedMesh: THREE.Mesh | null = null;
	private isProjecting: boolean = false;
	private pointObject: THREE.Points | null = null;
	private objectLoading: boolean = false;
	private directionalLight: THREE.DirectionalLight | null = null;
	constructor(canvas: HTMLCanvasElement) {
		this.objectLoading = false;
		this.canvas = canvas;
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(
			60,
			window.innerWidth / window.innerHeight,
			0.1,
			1000
		);
		this.camera.position.z = 20;
		this.camera.position.y =1.6;
		this.camera.rotation.x = 40 * Math.PI / 180; // 30도 위로 회전

		this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
		this.renderer.setSize(window.innerWidth, window.innerHeight, false);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.isProjecting = false;

		// OrbitControls 추가
		// this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		// this.controls.enableDamping = true;
		// this.controls.dampingFactor = 0.08;
		// this.controls.minDistance = 20;
		// this.controls.maxDistance = 120;
		// this.controls.update();

		window.addEventListener('resize', this.handleResize);
		this.handleResize = this.handleResize.bind(this);
		this.animate();

		// 박물 관 느낌의 어두운 배경
		this.targetObject = new THREE.Mesh(
			new THREE.BoxGeometry(3, 3, 3),
			new THREE.MeshBasicMaterial({ color: 0x000000 })
		);
		this.targetObject.position.set(0, 2, 0);
		this.targetObject.visible = false;

		this.scene.add(this.targetObject);
		this.scene.background = new THREE.Color(0x000000);


		this.blackMaterial = new THREE.MeshPhysicalMaterial({
			color: 0xffffff,
			roughness: 0.4,
			metalness: 1.0,
			opacity: 1,
			transparent: true,
			displacementMap: this.heightMap || new THREE.Texture(),
			displacementScale: 0.7,
			displacementBias: 0.01,
		});

		this.projectedMaterial = new ProjectedMaterial(
			{
				camera: this.camera,
				texture: this.diffuseMap || new THREE.Texture(),
				textureScale: 1,
				textureOffset: new THREE.Vector2(0, 0),
				cover: true,
				color: 0xffffff,
				roughness: 0.2,
			}
		);
	
		this.lightGroup = new THREE.Group();
		this.scene.add(this.lightGroup);
		// 메인 오브젝트를 비추는 3방향 스포트라이트 (박물관 유물 전시 느낌)
		// 좌측에서 비추는 스포트라이트
		this.mainSpotLight = new THREE.SpotLight(0xffffff, 4.0);
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
		this.backRightSpotLight = new THREE.SpotLight(0xffffff, 32.8);
		this.backRightSpotLight.position.set(25, 45, -30);
		this.backRightSpotLight.angle = Math.PI / 20;
		this.backRightSpotLight.penumbra = 0.5;
		this.backRightSpotLight.decay = 0.02;
		this.backRightSpotLight.distance = 70;
		this.backRightSpotLight.castShadow = false;
		this.backRightSpotLight.target = this.targetObject;
		this.lightGroup.add(this.backRightSpotLight);
		this.lightGroup.add(this.backRightSpotLight.target);

		this.directionalLight = new THREE.DirectionalLight(0xffffff, 6.0);
		this.directionalLight.position.set(0, 10, 0);
		this.directionalLight.target = this.targetObject;
		this.lightGroup.add(this.directionalLight);
		this.lightGroup.add(this.directionalLight.target);
		// Helper
		const backRightSpotHelper = new THREE.SpotLightHelper(this.backRightSpotLight);
		// this.scene.add(backRightSpotHelper);

		// 약간의 부드러운 환경광
		const ambient = new THREE.AmbientLight(0xffffff, 0.2);
		this.scene.add(ambient);

		// mainObject가 로드된 후에 scatter
		this.loadGLB('/tower.glb', 'https://www.gstatic.com/draco/v1/decoders/').then((object) => {
			if (object) {
				this.mainObject = object;
				// this.mainObject.visible = false;
				this.scene.add(this.mainObject);
				this.fitCameraToObject(this.mainObject);
				// 모든 스포트라이트 타겟을 mainObject로
				// 메인 오브젝트에 그림자 받기/생성 옵션 적용
				this.mainObject.traverse((child: any) => {
					if (child.isMesh) {
						child.castShadow = true;
						child.receiveShadow = true;
						child.material = this.blackMaterial;
					}
				});
				// vertex 층 정보 초기화
				this.initScatterFloors(this.mainObject);
			
			}
		});

		this.towerGroup = new THREE.Group();
		this.scene.add(this.towerGroup);


		// this.createTowerMesh(8, 6, 5, 18);
	}

	/**
	 * GLB 파일을 로드해서 THREE.Object3D로 반환 (draco 압축 지원)
	 * @param url GLB 파일 경로
	 * @param dracoPath draco decoder 경로 (예: '/draco/')
	 */
	public async loadGLB(url: string, dracoPath: string): Promise<THREE.Object3D | null> {
		return new Promise((resolve, reject) => {
			const loader = new GLTFLoader();
			const dracoLoader = new DRACOLoader();
			dracoLoader.setDecoderPath(dracoPath);
			loader.setDRACOLoader(dracoLoader);
			loader.load(
				url,
				(gltf) => {
					resolve(gltf.scene);
				},
				undefined,
				(error) => {
					console.error('GLB 로드 실패:', error);
					resolve(null);
				}
			);
		});
	}

	private animate() {
		this.animationId = requestAnimationFrame(() => this.animate());
		// 메인 오브젝트가 있으면 천천히 회전
		if (this.mainObject) {
			this.mainObject.rotation.y += 0.005;
		}

		if(this.isProjecting){
		this.mainObject?.traverse((child: any) => {
		if (child.isMesh) {
			this.projectedMaterial?.project(child);
			
			}
			
	});
		}

		if(this.pointObject){
			this.pointObject.rotation.y += 0.0005;
		}
		// if(this.towerGroup){
		// 	this.towerGroup.rotation.y += 0.0005;
		// }
		// OrbitControls 업데이트
		if(this.lightGroup){
			this.lightGroup.rotation.y += 0.005;
		}
		if(this.controls){
			this.controls.update();
		}
		// SpotLightHelper 업데이트
		if ((this as any).mainSpotHelper) (this as any).mainSpotHelper.update();
		if ((this as any).leftSpotHelper) (this as any).leftSpotHelper.update();
		if ((this as any).backRightSpotHelper) (this as any).backRightSpotHelper.update();

	
		


		this.renderer.render(this.scene, this.camera);
	}

	private handleResize = () => {
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(window.innerWidth, window.innerHeight, false);
	};

	public dispose() {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
		}
		window.removeEventListener('resize', this.handleResize);
		this.renderer.dispose();
	}

	/**
	 * mainObject의 표면에 scatterObject를 grid 단위로 겹치지 않게, normal 방향으로 회전시켜 붙임
	 * @param scatterObject 붙일 오브젝트(복제됨)
	 * @param mainObject 표면 대상 오브젝트
	 * @param options.gridSize 그리드 크기(기본 3)
	 * @param options.floorHeight 층 높이 간격(기본: floorHeight)
	 */
	public async scatterOnSurface(
		scatterObject: THREE.Object3D,
		mainObject: THREE.Object3D
	): Promise<void> {
		// 1. vertex 층 정보가 없으면 리턴
		if (!this.scatterFloors || !this.scatterOccupiedFloors) return;
		// 2. 각 층별로 최대 붙일 수 있는 개수 계산 (vertex 개수 / 200, 정수)
		for (let f = 0; f < this.scatterFloors.length; f++) {
			const floor = this.scatterFloors[f];
			const occupied = this.scatterOccupiedFloors[f];
			const maxAttach = Math.floor(floor.length / 100);
			const attachedCount = occupied.filter((v) => v).length;
			if (attachedCount >= maxAttach) continue;
			for (let i = 0; i < floor.length; i++) {
				if (!occupied[i]) {
					const { pos, normal } = floor[i];
					const clone = scatterObject.clone();
					clone.position.copy(mainObject.worldToLocal(pos.clone()));

					const objectForward = new THREE.Vector3(0, 1, 0);
					const q = new THREE.Quaternion().setFromUnitVectors(objectForward, normal);
					clone.quaternion.copy(q);
					mainObject.add(clone);
					occupied[i] = true;
					return;
				}
			}
		}
	}

	// 층별 vertex 정보와 점유 상태를 초기화 (mainObject가 로드될 때 1회만 호출)
	private initScatterFloors(mainObject: THREE.Object3D) {
		let mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> | null = null;
		mainObject.traverse((child: any) => {
			if (child.isMesh && !mesh)
				mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
		});
		if (!mesh) return;

		const meshObj = mesh as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
		const geometry = meshObj.geometry;
		const posAttr = geometry.getAttribute('position');
		const normalAttr = geometry.getAttribute('normal');
		if (!posAttr || !normalAttr) return;

		const positions: { pos: THREE.Vector3; normal: THREE.Vector3 }[] = [];
		let minY = Infinity,
			maxY = -Infinity;
		for (let i = 0; i < posAttr.count; i++) {
			const pos = new THREE.Vector3()
				.fromBufferAttribute(posAttr, i)
				.applyMatrix4(meshObj.matrixWorld);
			const normal = new THREE.Vector3()
				.fromBufferAttribute(normalAttr, i)
				.transformDirection(meshObj.matrixWorld)
				.normalize();
			positions.push({ pos, normal });
			if (pos.y < minY) minY = pos.y;
			if (pos.y > maxY) maxY = pos.y;
		}
		// 층 개수 계산 (y값을 정수로)
		const floorCount = Math.floor(maxY) - Math.floor(minY) + 1;
		this.scatterFloors = Array.from({ length: floorCount }, () => []);
		this.scatterOccupiedFloors = Array.from({ length: floorCount }, () => []);
		// 각 vertex를 층에 배정
		for (const v of positions) {
			const floorIdx = Math.round(v.pos.y - minY); // y값을 정수로 층 인덱스화
			this.scatterFloors[floorIdx].push(v);
			this.scatterOccupiedFloors[floorIdx].push(false);
		}
		// 층별 정보 출력
		console.log(`총 층 수: ${floorCount}`);
		this.scatterFloors.forEach((floor, idx) => {
			console.log(`${idx + 1}층: ${floor.length}개 vertex`);
		});
	}

	public createTowerMesh(
		bottomRadius: number,
		topRadius: number,
		floorHeight: number,
		floorCount: number
	) {
		if (!this.scene || !this.renderer) {
			return;
		}
		this.instancePositions = [];
		this.instanceNormals = [];
		let shrinkRadiusValue = (bottomRadius - topRadius) / floorCount;
		let dummyMaterial = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			wireframe: true,
			transparent: true,
			opacity: 0.0,
		
		});

		for (let i = 0; i < floorCount; i++) {
			let radius = bottomRadius - shrinkRadiusValue * i;
			if (radius < topRadius) {
				radius = topRadius;
			}
			let segment = 48 - i * i;
			if (segment < 16) {
				segment = 16;
			}
			const dummyfloorGeometery = new THREE.CylinderGeometry(
				radius,
				radius,
				floorHeight,
				segment,
				3
			);
			const dummyfloorMesh = new THREE.Mesh(dummyfloorGeometery, dummyMaterial);
			this.towerGroup.add(dummyfloorMesh);
			dummyfloorMesh.position.set(0, floorHeight / 2 + floorHeight * i, 0);
			dummyfloorMesh.updateMatrixWorld();

			const positionAttr = dummyfloorGeometery.attributes.position;
			const normalAttr = dummyfloorGeometery.attributes.normal;

			// 1. 모든 y값을 모아 고유값 집합 생성
			const ySet = new Set<number>();
			for (let j = 0; j < positionAttr.count; j++) {
				ySet.add(Number(positionAttr.getY(j).toFixed(6))); // float 오차 방지
			}
			const yValues = Array.from(ySet).sort((a, b) => a - b);

			// 2. min, max를 제외한 중간 y값만 추출 (오름차순)
			if (yValues.length <= 2) continue; // 중간값 없음
			const midYValues = yValues.slice(1, yValues.length - 1);

			// 3. 중간 y값을 가진 vertex를 y값 오름차순으로 저장
			for (const midY of midYValues) {
				for (let j = 0; j < positionAttr.count; j++) {
					const y = Number(positionAttr.getY(j).toFixed(6));
					if (y === midY) {
						// world position
						const position = new THREE.Vector3().fromBufferAttribute(positionAttr, j);
						position.applyMatrix4(dummyfloorMesh.matrixWorld);
						this.instancePositions.push(position);

						// local normal direction
						const normal = new THREE.Vector3().fromBufferAttribute(normalAttr, j);
						this.instanceNormals.push(normal.clone());
					}
				}
			}
		}
		console.log('instancePositions', this.instancePositions);
		console.log('instanceNormals', this.instanceNormals);
	}



/**
 * Adjusts the camera to fit the target object in the center of the screen
 * @param target The object to focus on and fit to screen
 */
private fitCameraToObject(target: THREE.Object3D): void {
    if (!target) return;

    // Get bounding box of the target
    const boundingBox = new THREE.Box3().setFromObject(target);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    // Get the max side of the bounding box
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

    // Add 10% padding
    cameraZ *= 1.3;

    // Update camera position and look at center
    this.camera.position.z = cameraZ;
    this.camera.position.x = center.x;
    this.camera.position.y = center.y-0.8;
    
    // Look at center of target
    this.camera.lookAt(center);
    
    // Update the near and far planes to encompass the object
    const minZ = boundingBox.min.z;
    const cameraToFarEdge = Math.abs(minZ - cameraZ);
    
    this.camera.near = cameraZ / 100;
    this.camera.far = cameraToFarEdge * 3;
    
    this.camera.updateProjectionMatrix();
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
	
	async updateDisplacementMap(imageUrl: string) {
		if (!this.blackMaterial) return;
		this.diffuseMap = new THREE.TextureLoader().load(imageUrl);
		this.diffuseMap.mapping = THREE.UVMapping;
		this.diffuseMap.wrapS = THREE.RepeatWrapping;
		this.diffuseMap.wrapT = THREE.RepeatWrapping;
		this.heightMap = await this.convertToDisplacementMap(imageUrl);
		this.heightMap.mapping = THREE.UVMapping;
		this.heightMap.wrapS = THREE.RepeatWrapping;
		this.heightMap.wrapT = THREE.RepeatWrapping;
		this.blackMaterial.map = this.diffuseMap;
		this.blackMaterial.displacementMap = this.heightMap;
		this.blackMaterial.needsUpdate = true;
		this.renderer.render(this.scene, this.camera);
		console.log('updateDisplacementMap', this.heightMap);
	}

	async createProjectedMesh(imageUrl: string) {
		if (!this.mainObject) return;
		this.diffuseMap = new THREE.TextureLoader().load(imageUrl);
		this.heightMap = await this.convertToDisplacementMap(imageUrl);

		this.projectedMaterial.camera = this.camera;
		this.projectedMaterial.texture = this.diffuseMap;
		this.projectedMaterial.displacementMap = this.heightMap;
		this.projectedMaterial.displacementScale = 2.0;
		this.projectedMaterial.displacementBias = 0.001;
		this.projectedMaterial.texture.needsUpdate = true;
	this.mainObject.traverse((child: any) => {
		if (child.isMesh) {
			child.material = this.projectedMaterial;
			child.material.needsUpdate = true;
		
			
		}
	});
		
		this.isProjecting = true;
	}

	public async updateTowerMesh(imageUrl: string, modelUrl: string) {
		this.isProjecting = false;
		if (this.mainObject) {
			this.scene.remove(this.mainObject);
		}
		if(this.pointObject){
			this.scene.remove(this.pointObject);
		}
		try {
			this.loadGLB(modelUrl, 'https://www.gstatic.com/draco/v1/decoders/').then(async (object) => {
				if (object) {
					this.mainObject = object;
					this.scene.add(this.mainObject);
					this.fitCameraToObject(this.mainObject);

					// **여기서 ProjectedMaterial로 교체**
					this.diffuseMap = new THREE.TextureLoader().load(imageUrl);
					this.heightMap = await this.convertToDisplacementMap(imageUrl);

					this.projectedMaterial.camera = this.camera;
					this.projectedMaterial.texture = this.diffuseMap;
					this.projectedMaterial.displacementMap = this.heightMap;
					this.projectedMaterial.displacementScale = 0.0;
					this.projectedMaterial.displacementBias = 0.001;
					this.projectedMaterial.texture.needsUpdate = true;

					this.mainObject.traverse((child: any) => {
						if (child.isMesh) {
							child.material = this.projectedMaterial;
							child.material.needsUpdate = true;
						}
					});

					this.isProjecting = true;


				}
			});
		} catch (error) {
			console.error('updateTowerMesh', error);
		}
	}



}