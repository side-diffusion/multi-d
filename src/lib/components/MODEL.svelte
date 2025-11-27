<script lang="ts">
	import { onMount } from 'svelte';
	import ThreeEngine from '$lib/three/ThreeEngine';
	import AttachObj from '$lib/three/attachObj';
	import { wsClient } from '../websocket/websocket-client';
	import { imagePromptState } from '../stores/imageStore.svelte';

	import * as THREE from 'three';
	let canvasEl: HTMLCanvasElement;
	let engine: ThreeEngine;
	let attachIndex =$state(0);
	let maxCount = $state(100);
    let heightScale = $state(1);
    let endDisplaying = $state(false);
    let imageUrl = $state('');
	let isConnected = $state(false);
	let latestModelNo = $state(0);


	let imageUrlArray = [
		'https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/1747052885219.jpg',
		'https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/1746897930377.jpg',
		'https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/1747053367357.jpg',
		'https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/1747010255622.jpg'
	];

	// WebSocket connection status
//    $effect(() => {
//         const checkConnection = setInterval(() => {
//             const ws = (wsClient as any).ws;
//             isConnected = ws?.readyState === WebSocket.OPEN;
//         }, 1000);
//         return () => {
//             clearInterval(checkConnection);
//         };
//     });


	$effect(() => {
		console.log('effect triggered', imagePromptState);
		if (imagePromptState.isImageGenerated && imagePromptState.imageUrl) {
			console.log('이미지 결과', imagePromptState.imageUrl);
			imageUrl = imagePromptState.imageUrl;
			addModelToInstancePosition(imageUrl);
			imagePromptState.isImageGenerated = false;
		}
	});

	$effect(() => {
	if(imagePromptState.dataCount > latestModelNo){
		latestModelNo = imagePromptState.dataCount;
		console.log('latestModelNo', latestModelNo);
	}
	});

	async function addModelToInstancePosition(imageUrl: string) {
		if (!engine || endDisplaying) return;
		// instancePositions, instanceNormals에서 차례로 꺼냄
		console.log('tower activate');
		const pos = engine.instancePositions[attachIndex];
		const normal = engine.instanceNormals[attachIndex];
		if (!pos || !normal) {
			endDisplaying = true;
            console.log('더 이상 배치할 위치가 없습니다.');

			return;
		}
		if(!imageUrl){
			imageUrl = imageUrlArray[Math.floor(Math.random() * imageUrlArray.length)];
		}
		// let imageUrl = imageUrlArray[Math.floor(Math.random() * imageUrlArray.length)];
		let displacementScale = Math.random() * 0.5 + heightScale;
		const model = await new AttachObj(imageUrl, displacementScale, 10, 19);
		await model.init();

		// 위치 지정
		model.object.position.copy(pos);

		// 방향 지정: (0,1,0) 벡터를 normal 방향으로 맞춤
		const objectForward = new THREE.Vector3(0, 0, 1);
		const q = new THREE.Quaternion().setFromUnitVectors(objectForward, normal);
		model.object.quaternion.copy(q);

		// 씬에 추가
		engine.towerGroup.add(model.object);

		attachIndex++;
	}

	async function testDummyDisplayLoop() {
		if (!engine) return;
		if (endDisplaying) return;
		let count = maxCount;

		for (let i = 0; i < count; i++) {
			await addModelToInstancePosition(imageUrl);
		}
	}

	onMount(() => {
		engine = new ThreeEngine(canvasEl);
		return () => engine?.dispose?.();
	});
</script>

<canvas bind:this={canvasEl} class="fullscreen-canvas"></canvas>

<div class="debug-container">
     <div class="button-container-wrapper">
	<div class="button-container">
		<button class="add-model-button" onclick={() => addModelToInstancePosition(imagePromptState.imageUrl)}>Add Single Model</button>
		
	</div>
     </div>
    <div class="button-container-wrapper">
	<button class="test-display-button" onclick={testDummyDisplayLoop}>Add Multiple Models</button>
  
    </div>
      <div class="button-container-wrapper">
	
    <div class="button-container">
        <input type="range" min="0" max="10" step="0.1" class="range-input" bind:value={heightScale} />
		<label class="range-input-label">heightScale: {heightScale}</label>
		
    </div>
    
    </div>
        <div class="button-container-wrapper">

      <div class="button-container">
        <input type="range" min="0" max="500" class="range-input" bind:value={maxCount} />
		<label class="range-input-label">Count: {maxCount}</label>
	
    </div>
    </div>
</div>

<style>
	.fullscreen-canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		display: block;
		z-index: 0;
	}
	.debug-container {
        width: 100%;
		position: fixed;
		top: 0;
		left: 0;
		z-index: 1;
		display: flex;
		flex-direction: column;
        justify-content: space-between;
		gap: 10px;
        padding: 10px;
        box-sizing: border-box;
	}

    .button-container-wrapper{
        display: flex;
        flex-direction: row;
        gap: 10px;
    }
	.button-container {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 10px;
	}
    .range-input-label{
        font-size: 12px;
        color: #fff;
    }
    .range-input{
        width: 100px;
    }
    .range-input {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        cursor: pointer;
    }

    .range-input::-webkit-slider-runnable-track {
        background: #ffffff33;
        height: 4px;
        border-radius: 2px;
    }

    .range-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        margin-top: -6px;
        background-color: #fff;
        height: 16px;
        width: 16px;
        border-radius: 50%;
    }

    .range-input::-moz-range-track {
        background: #ffffff33;
        height: 4px;
        border-radius: 2px;
    }

    .range-input::-moz-range-thumb {
        border: none;
        background-color: #fff;
        height: 16px;
        width: 16px;
        border-radius: 50%;
    }
    </style>
