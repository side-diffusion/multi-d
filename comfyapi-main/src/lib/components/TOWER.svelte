<script lang="ts">
	import { onMount } from 'svelte';
	import ThreeEngine from '$lib/three/ThreeEngine';
	import AttachObj from '$lib/three/attachObj';
	import { wsClient } from '../websocket/websocket-client';
	import { imagePromptState, modelUpdateState } from '../stores/imageStore.svelte';
	import { ParticleEngine } from '$lib/three/ParticleEngine';
	import { towerModelData } from '$lib/stores/towerStore';
	import { convertToTransparentPNG } from '$lib/utils/imageUtils';
	import { fade } from 'svelte/transition';
	import QRCode from 'qrcode';

	import * as THREE from 'three';
	let canvasEl: HTMLCanvasElement;
	let engine: ThreeEngine;
	let attachIndex = $state(0);
	let maxCount = $state(100);
	let heightScale = $state(1);
	let endDisplaying = $state(false);
	let imageUrl = $state('');
	let imageList = $state<string[]>([]);
	let convertedImage = $state<string | null>(null);
	let isConnected = $state(false);
	let bgmAudio: HTMLAudioElement;
	let bgmInitialized = $state(false);
	let qrCodeUrl = $state('');

	let imageUrlArray = [
		'https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/1747052885219.jpg',
		'https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/1746897930377.jpg',
		'https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/1747053367357.jpg',
		'https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/1747010255622.jpg'
	];

	let testModelUrl = $state(
		'https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/1747553806463.glb'
	);
	let latestModelNo = $state(0);

	// Subscribe to tower model data changes
	$effect(() => {
		console.log('TOWER.svelte - Current tower model data:', $towerModelData);
		if ($towerModelData) {
			const { imageUrl, modelUrl } = $towerModelData;
			console.log('TOWER.svelte - Updating tower mesh with:', { imageUrl, modelUrl });
			engine?.updateTowerMesh(imageUrl, modelUrl);

			// Start image conversion
			handleImageConversion(imageUrl);
			handleARUrl(modelUrl);
		}
	});

	const MAX_IMAGES = 10; // Maximum number of images to keep

	const handleARUrl = (url: string) => {
		// let qrCodeCanvas = document.getElementById('qrCodeCanvas');
		// let width = qrCodeCanvas.style.width;
		// let height = qrCodeCanvas.style.height;
		console.log('TOWER.svelte - Updating tower mesh with:', { url });
		let modelID = '';
		if (url.includes('https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/')) {
			modelID = url.split('/').pop()?.replace('.glb', '');
		}
		let arUrl = `https://ai.oomg.world/results/${modelID}`;
		console.log('TOWER.svelte - AR URL:', arUrl);
		// QRCode.toCanvas(qrCodeCanvas, arUrl, {errorCorrectionLevel: 'medium', width: width, margin: 0},(err)=>{
		//     if(err){
		//         console.error('Failed to generate QR code:', err);
		//     }else{

		//         console.log('QR code generated successfully');
		//     }
		// })
		QRCode.toDataURL(arUrl, { errorCorrectionLevel: 'medium', margin: 0 }, (err, url) => {
			if (err) {
				console.error('Failed to generate QR code:', err);
			} else {
				console.log('QR code generated successfully', url);
				handleQRConversion(url);
			}
		});
	};

	const handleQRConversion = async (url: string) => {
		try {
			console.log('Converting image:', url);
			const converted = await convertToTransparentPNG(url);
			convertedImage = converted;

			if (converted) {
				qrCodeUrl = converted;
			}

			console.log('Image converted successfully');
		} catch (error) {
			console.error('Failed to convert image:', error);
			convertedImage = null;
		}
	};

	const handleImageConversion = async (url: string) => {
		try {
			console.log('Converting image:', url);
			const converted = await convertToTransparentPNG(url);
			convertedImage = converted;

			// Add to image list if not already present
			if (converted && !imageList.includes(converted)) {
				// Remove oldest image if we've reached the maximum
				if (imageList.length >= MAX_IMAGES) {
					imageList = [...imageList.slice(1), converted];
				} else {
					imageList = [...imageList, converted];
				}
				console.log('Added to image list. Total images:', imageList.length);
			}

			console.log('Image converted successfully');
		} catch (error) {
			console.error('Failed to convert image:', error);
			convertedImage = null;
		}
	};

	// Register the component
	onMount(async () => {
		engine = new ParticleEngine(canvasEl);

		// Initialize background music
		bgmAudio = new Audio('/bgm.mp3');
		bgmAudio.loop = true;
		bgmAudio.volume = 1.0;
		bgmAudio.muted = true; // Start muted
		bgmAudio.setAttribute('playsinline', ''); // Add playsinline attribute
		bgmAudio.setAttribute('webkit-playsinline', ''); // For Safari

		try {
			// Try to autoplay muted
			await bgmAudio.play();
			// If successful, unmute after a short delay
			setTimeout(() => {
				bgmAudio.muted = false;
			}, 1000);
		} catch (error) {
			console.log('Autoplay failed, waiting for user interaction');
			// Fallback to click interaction if autoplay fails
			document.addEventListener('click', initAndPlayBGM);
		}

		return () => {
			engine?.dispose?.();
			if (bgmAudio) {
				bgmAudio.pause();
				bgmAudio.currentTime = 0;
			}
			document.removeEventListener('click', initAndPlayBGM);
		};
	});

	// Fallback function for click interaction
	const initAndPlayBGM = async () => {
		if (!bgmInitialized && bgmAudio) {
			try {
				bgmAudio.muted = false;
				await bgmAudio.play();
				bgmInitialized = true;
				document.removeEventListener('click', initAndPlayBGM);
			} catch (error) {
				console.error('Failed to play audio:', error);
			}
		}
	};

	const applyDisplacementMap = () => {
		let randomIndex = Math.floor(Math.random() * imageUrlArray.length);
		let imageUrl = imageUrlArray[randomIndex];
		engine?.updateDisplacementMap(imageUrl);
	};

	const createProjectedMesh = () => {
		let randomIndex = Math.floor(Math.random() * imageUrlArray.length);
		let imageUrl = imageUrlArray[randomIndex];
		engine?.createProjectedMesh(imageUrl);
	};
</script>

<div class="tower-container">
<canvas bind:this={canvasEl} class="fullscreen-canvas"></canvas>

<div class="debug-container">
	<!-- <div class="debug-container-wrapper">

    <button class="debug-button" onclick={()=>{updateTowerMesh(imageUrlArray[0], testModelUrl,false)}}>update tower mesh</button>

</div> -->
</div>
<div class="model-info-container">
	{#if imagePromptState.onWorking}
		<p transition:fade>
			새로운 파편 ** {imagePromptState.userText} ** 이 형성되는 중...
		</p>
		<p transition:fade>
			New Fragment: ** {imagePromptState.userText} ** is being formed...
		</p>
	{/if}
	{#if !imagePromptState.onWorking && modelUpdateState.isUpdating && !modelUpdateState.isUpdatingSuccess}
		<p transition:fade>
			새로운 파편 ** {imagePromptState.userText} ** 이(가) 발견되었습니다!
		</p>
		<p transition:fade>
			New Fragment: ** {imagePromptState.userText} ** is found!
		</p>
	{:else if !imagePromptState.onWorking && !modelUpdateState.isUpdating && modelUpdateState.isUpdatingSuccess}
	
    <p transition:fade>
		
			파편(Fragment): {imagePromptState.userText} 
		</p>
	{:else}
		<p transition:fade></p>
	{/if}
</div>
{#if !imagePromptState.onWorking && modelUpdateState.isUpdating && !modelUpdateState.isUpdatingSuccess}
	<div class="loading-indicator-overlay"></div>
{/if}
	{#if qrCodeUrl}
    <div class="qr-code-container-wrapper" transition:fade>

				<div class="qr-code-container" transition:fade>
                   
					<img src={qrCodeUrl} alt="QR Code" />
				</div>
                 <p>&gt; AR VIEW</p>
			</div>
			{/if}	
<div class="image-list-container">
	{#each imageList as image, i}
		<div class="image-item">
			<img src={image} alt={`Converted image ${i + 1}`} transition:fade />
		</div>
	{/each}
</div>
</div>
<style>

    .tower-container{
        cursor:none;
    }
    .qr-code-container-wrapper{
        position: fixed;
		top: 80px;
		
		left: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        z-index: 100;
    }
    .qr-code-container-wrapper p{
           font-family: 'Pretendard-Regular';
    font-weight: 400;
    font-style: normal;
        width: 100%;
        text-align: left;
        font-size: 12px;
        color: #fff;
        margin: 0px;
    }
	.qr-code-container {
		width: 80px;
		height: 80px;


		background: none;
	}

	.qr-code-container img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.model-info-container {
        line-height: 1.3;
		position: fixed;
		width: 100%;
		bottom: 30px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		color: #fff;
	}
	.model-info-container p {
		font-size: 14px;
        margin: 0px;
        padding: 0px;
		text-align: center;
		font-family: 'Pretendard-Regular';
    font-weight: 400;
    font-style: normal;
	}

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

	.button-container-wrapper {
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
	.range-input-label {
		font-size: 12px;
		color: #fff;
	}
	.range-input {
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
	.loading-indicator-overlay {
		box-sizing: border-box;
		position: fixed;
		bottom: 0%;
		left: 0px;
		width: 100%;
		height: 8px;
		background: linear-gradient(to left, rgba(255, 255, 255, 1), rgba(255, 255, 255, 1));
		animation: loading-flash 1000ms infinite ease-in-out;
		z-index: 1000;
		transition: all 1s ease-in-out;

		filter: blur(2px);
	}

	@keyframes loading-flash {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
		100% {
			opacity: 1;
		}
	}

	.image-list-container {
		position: fixed;
		right: 10px;
		bottom: 40px;
		display: flex;
		flex-direction: column;

		gap: 0px;

		overflow-y: auto;
		z-index: 100;
	}

	.image-item {
		width: 80px;
		height: 80px;
		overflow: hidden;
	}

	.image-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
