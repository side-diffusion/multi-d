<script lang="ts">
    import { onMount } from "svelte";
    import { wsClient } from '../websocket/websocket-client';
    import { ImageParticle } from '$lib/imageParticle';
    import { imagePromptState } from '../stores/imageStore.svelte';

    let { prompt } = $props();
    let canvas: HTMLCanvasElement | null = null;
    let isConnected = $state(false);
    let concurrentImgGenNumber = $state(1);
    let imageUrl = $state('./image.jpg');
    let ctx: CanvasRenderingContext2D | null = null;
    let imageParticleSystem: ImageParticle | null = null;
    let numberOfParticles = $state(4000);
    let particlesArray = $state([]);
    let currentImage = $state(null);
    let offsetX = $state(0);
    let offsetY = $state(0);
    let drawWidth = $state(0);
    let drawHeight = $state(0);
    let mappedImage = $state([]);
    let animationFrameId: number | null = null;
    let isLoadingImage = false;

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
        if(imagePromptState.imageUrl && imagePromptState.isImageGenerated) {
            if (!isLoadingImage) {
                imageUrl = imagePromptState.imageUrl;
                setCanvasImage(imageUrl);
            }
        }
    });

    function resizeCanvas() {
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
        }
    }
    async function setCanvasImage(imageUrl: string) {
        if (isLoadingImage) return;
        isLoadingImage = true;
        if (canvas) {
            stopAnimation();
            resizeCanvas();
            if(!ctx) {
                ctx = canvas.getContext('2d');
            }

            const base64 = await imageURLToBase64(imageUrl);
            currentImage = new Image();
            currentImage.crossOrigin = "anonymous";
            currentImage.src = base64;
            currentImage.onload = () => {
                if (!ctx || !canvas) { isLoadingImage = false; return; }

                // 캔버스와 이미지의 비율 계산
                const canvasRatio = canvas.width / canvas.height;
                const imgRatio = currentImage.width / currentImage.height;

                if (imgRatio > canvasRatio) {
                    // 이미지가 더 넓음: 높이를 맞추고, 좌우를 잘라냄
                    drawHeight = canvas.height;
                    drawWidth = currentImage.width * (canvas.height / currentImage.height);
                    offsetX = (canvas.width - drawWidth) / 2;
                    offsetY = 0;
                } else {
                    // 이미지가 더 높음: 너비를 맞추고, 상하를 잘라냄
                    drawWidth = canvas.width;
                    drawHeight = currentImage.height * (canvas.width / currentImage.width);
                    offsetX = 0;
                    offsetY = (canvas.height - drawHeight) / 2;
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(currentImage, offsetX, offsetY, drawWidth, drawHeight);

                //이미지 데이터 가져오기
                const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                //이미지 분석
                mappedImage = [];
                for (let y=0; y<canvas.height; y++) {
                    let row = [];
                    for (let x=0; x<canvas.width; x++) {
                        const index = (y * (pixels.width * 4)) + (x * 4);
                        const red = pixels.data[index + 0];
                        const green = pixels.data[index + 1];
                        const blue = pixels.data[index + 2];
                        const brightness = calculateRelativeBrightness(red, green, blue);
                        const cell = { cellBrightness: brightness };
                        row.push(cell);
                    }
                    mappedImage.push(row);
                }
                        
                //파티클 실행
                initParticles(canvas, ctx, mappedImage);
                isLoadingImage = false;
            };
            currentImage.onerror = () => { isLoadingImage = false; };
        } else {
            isLoadingImage = false;
        }
    }

    function calculateRelativeBrightness(red: number, green: number, blue: number) {
        return Math.sqrt((red * red) * 0.299 + (green * green) * 0.587 + (blue * blue) * 0.114) / 100;
    }

    function stopAnimation() {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    function initParticles(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, mappedImage: any){
        if(!ctx || !canvas) return;
        //파티클 배열 초기화
        particlesArray = [];
        
        for(let i = 0; i < numberOfParticles; i++) {
            particlesArray.push(new ImageParticle(canvas, ctx, mappedImage));
        }
        //파티클 렌더링
        animateParticles();
    }

    function animateParticles(){
        if(!ctx || !canvas || mappedImage.length === 0) return;
        
ctx.globalAlpha = 0.1;
ctx.fillStyle = 'rgb(0, 0, 0)';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.globalAlpha = 0.5;
for(let i = 0; i < particlesArray.length; i++) {
    particlesArray[i].update();
    ctx.globalAlpha = particlesArray[i].speed * 0.1 + particlesArray[i].velocity *0.01;

    particlesArray[i].draw();
}
animationFrameId = requestAnimationFrame(animateParticles);
    }


    async function imageURLToBase64(imageUrl: string): Promise<string> {
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
    

    function handleResize() {
        if (!isLoadingImage) {
            stopAnimation();
            resizeCanvas();
            setCanvasImage(imageUrl);
        }
    }

   




    onMount(async () => {
        console.log("Image component mounted");
        setCanvasImage(imageUrl);
            window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    })
</script>

<div class="container">
    <header>
       
        <div class="connection-status" class:connected={isConnected}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
    </header>
        {#if imagePromptState.generating && !imagePromptState.isImageGenerated}
        <div class="image-loading">
            <p>Generating image...</p>
        </div>
    {/if}

  <!-- {#if imagePromptState.imageUrl && imagePromptState.isImageGenerated}
        <div class="image-container">
            <img src={imagePromptState.imageUrl} alt="Generated Image" />
        </div>
    {/if}
    {#if imagePromptState.loading}
        <div class="prompt-card loading">
            <h3>프롬프트 생성중...</h3>
            <div class="timestamp">{new Date().toLocaleTimeString()}</div>
        </div>
    {:else if imagePromptState.prompt && !imagePromptState.loading}
        <div class="prompt-card">
            <h3>Latest Generated Prompt</h3>
            <p>{imagePromptState.prompt}</p>
            <div class="timestamp">{new Date().toLocaleTimeString()}</div>
        </div>
    {/if}


  

    {#if !imagePromptState.loading && !imagePromptState.prompt}
        <div class="no-prompts">
            <p>Waiting for new prompts...</p>
        </div>
    {/if} -->


    <canvas id="canvas" bind:this={canvas}></canvas>



</div>

<style>
    .container {
        position: relative;
        box-sizing: border-box;
        width: 100vw;
        height: 100vh;
        margin: 0 auto;
        padding: 2rem;
        overflow: hidden;
  
    }

    .image-container {
        margin-top: 2rem;
        text-align: center;
    }

    .image-container img {
        max-width: 100%;
        height: auto;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    canvas {
        box-sizing: border-box;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;

    }


    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }

    h1 {
        color: #fff;
        font-size: 2.5rem;
        margin: 0;
    }

    .connection-status {
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-weight: 500;
        background-color: #eee;
        color: #222;
    }

    .connection-status.connected {
        background-color: #bbb;
        color: #111;
    }

    .prompts-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
    }

    .prompt-card {
        background: #222;
        border-radius: 10px;
        padding: 1.5rem;
        box-shadow: none;
        transition: transform 0.2s ease;
        animation: none;
        opacity: 1;
        color: #fff;
    }

    .prompt-card:hover {
        transform: translateY(-5px);
    }

    .prompt-card h3 {
        color: #eee;
        margin: 0 0 1rem 0;
        font-size: 1.2rem;
    }

    .prompt-card p {
        color: #ccc;
        line-height: 1.6;
        margin: 0 0 1rem 0;
    }

    .timestamp {
        color: #888;
        font-size: 0.875rem;
        text-align: right;
    }

    .no-prompts {
        text-align: center;
        padding: 4rem 2rem;
        background: #222;
        border-radius: 10px;
        box-shadow: none;
    }

    .no-prompts p {
        color: #eee;
        font-size: 1.5rem;
        margin: 0;
    }

    .no-prompts .subtitle {
        color: #888;
        font-size: 1rem;
        margin-top: 1rem;
    }

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .prompt-card.loading {
        text-align: center;
        font-style: italic;
        color: #888;
    }
</style>

