<script lang="ts">
    import { onMount } from 'svelte';
    let videoRef: HTMLVideoElement;
    let canvasRef: HTMLCanvasElement;

    // Svelte 5 rune state
    let pixelSize = 8;
    let frameRate = 30;
    let animationId: number | null = null;
    let lastFrameTime = 0;
    let videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    let isBW = false; // 흑백 토글
    let pixelShape = "rect"; // 픽셀 모양: rect | circle | triangle | hexagon
    let useParticle = true; // 파티클 효과 토글

    interface Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        life: number;
        color: string;
        size: number;
        alpha: number;
    }
    let particles: Particle[] = [];

    // 업로드 버튼 클릭
    function handleUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.onchange = (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                videoUrl = URL.createObjectURL(file);
            }
        };
        input.click();
    }

    // 캔버스 크기 조정
    function resizeCanvas() {
        if (!videoRef || !canvasRef) return;
        const aspectRatio = videoRef.videoWidth / videoRef.videoHeight;
        const canvasWidth = 400;
        const canvasHeight = canvasWidth / aspectRatio;
        canvasRef.width = canvasWidth;
        canvasRef.height = canvasHeight;
    }

    // 픽셀화 렌더링
    function renderPixelatedFrame() {
        if (!videoRef || !canvasRef) return;
        const ctx = canvasRef.getContext('2d');
        if (!ctx) return;
        const canvasWidth = canvasRef.width;
        const canvasHeight = canvasRef.height;
        const smallWidth = Math.floor(canvasWidth / pixelSize);
        const smallHeight = Math.floor(canvasHeight / pixelSize);

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(videoRef, 0, 0, smallWidth, smallHeight);
        const imageData = ctx.getImageData(0, 0, smallWidth, smallHeight);
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        for (let y = 0; y < smallHeight; y++) {
            for (let x = 0; x < smallWidth; x++) {
                const index = (y * smallWidth + x) * 4;
                let red = imageData.data[index];
                let green = imageData.data[index + 1];
                let blue = imageData.data[index + 2];

                if (isBW) {
                    // 그레이스케일 변환
                    const gray = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
                    red = green = blue = gray;
                }

                ctx.fillStyle = `rgb(${red},${green},${blue})`;

                if (isBW && (pixelShape === "rect" || pixelShape === "circle")) {
                    // 밝기에 따라 도형 다르게: 밝은 부분(>=128)은 원, 어두운 부분(<128)은 사각형
                    const gray = red; // 이미 gray로 변환됨
                    if (gray >= 128) {
                        ctx.beginPath();
                        ctx.arc(
                            x * pixelSize + pixelSize / 2,
                            y * pixelSize + pixelSize / 2,
                            pixelSize / 2,
                            0, 2 * Math.PI
                        );
                        ctx.fill();
                    } else {
                        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                    }
                } else if (pixelShape === "rect") {
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                } else if (pixelShape === "circle") {
                    ctx.beginPath();
                    ctx.arc(
                        x * pixelSize + pixelSize / 2,
                        y * pixelSize + pixelSize / 2,
                        pixelSize / 2,
                        0, 2 * Math.PI
                    );
                    ctx.fill();
                } else if (pixelShape === "triangle") {
                    const cx = x * pixelSize + pixelSize / 2;
                    const cy = y * pixelSize + pixelSize / 2;
                    const r = pixelSize / 2;
                    ctx.beginPath();
                    for (let i = 0; i < 3; i++) {
                        const angle = (Math.PI / 2) + (i * 2 * Math.PI / 3);
                        const px = cx + r * Math.cos(angle);
                        const py = cy - r * Math.sin(angle);
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                } else if (pixelShape === "hexagon") {
                    const cx = x * pixelSize + pixelSize / 2;
                    const cy = y * pixelSize + pixelSize / 2;
                    const r = pixelSize / 2;
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = Math.PI / 6 + (i * 2 * Math.PI / 6);
                        const px = cx + r * Math.cos(angle);
                        const py = cy + r * Math.sin(angle);
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                }

                // 파티클 생성: 밝은 픽셀에서만
                if (useParticle) {
                    const brightness = (red + green + blue) / 3;
                    if (brightness > 220 && Math.random() < 0.05) { // 밝고, 랜덤하게
                        particles.push({
                            x: x * pixelSize + pixelSize / 2,
                            y: y * pixelSize + pixelSize / 2,
                            vx: (Math.random() - 0.5) * 2,
                            vy: -Math.random() * 2 - 1,
                            life: 40 + Math.random() * 20,
                            color: `rgb(${red},${green},${blue})`,
                            size: 2 + Math.random() * 2,
                            alpha: 1
                        });
                    }
                }
            }
        }

        // 파티클 업데이트 및 그리기
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08; // 중력
            p.life--;
            p.alpha *= 0.97; // 점점 사라짐

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.restore();

            if (p.life < 0 || p.alpha < 0.05) {
                particles.splice(i, 1);
            }
        }
    }

    // 애니메이션 루프
    function animatePixelation(timestamp: number) {
        if (!lastFrameTime) lastFrameTime = timestamp;
        const elapsed = timestamp - lastFrameTime;
        const frameInterval = 1000 / frameRate;
        if (elapsed >= frameInterval) {
            renderPixelatedFrame();
            lastFrameTime = timestamp;
        }
        animationId = requestAnimationFrame(animatePixelation);
    }

    function stopAnimation() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    // Svelte 5 rune effect
    $: if (videoRef) {
        videoRef.onplay = () => {
            stopAnimation();
            lastFrameTime = 0;
            animationId = requestAnimationFrame(animatePixelation);
        };
        videoRef.onpause = stopAnimation;
        videoRef.onended = stopAnimation;
        videoRef.onloadedmetadata = resizeCanvas;
    }

    // 캔버스 크기 동기화
    $: if (videoRef && canvasRef) {
        resizeCanvas();
    }
</script>

<h1>비디오 픽셀화 효과</h1>
<div class="container">
    <div class="video-container">
        <h3>원본 비디오</h3>
        <video
            bind:this={videoRef}
            src={videoUrl}
            controls
            width="400"
            crossorigin="anonymous"
        >
            브라우저가 비디오 태그를 지원하지 않습니다.
        </video>
    </div>
    <div class="canvas-container">
        <h3>픽셀화된 비디오</h3>
        <canvas bind:this={canvasRef} width="400" height="225"></canvas>
    </div>
</div>

<div class="controls">
    <div class="slider-container">
        <label for="pixelSize">픽셀 크기:</label>
        <input
            id="pixelSize"
            type="range"
            min="1"
            max="40"
            bind:value={pixelSize}
        />
        <span class="value">{pixelSize}</span>
    </div>
    <div class="slider-container">
        <label for="frameRate">프레임 레이트:</label>
        <input
            id="frameRate"
            type="range"
            min="1"
            max="60"
            bind:value={frameRate}
        />
        <span class="value">{frameRate}</span>
    </div>
    <div class="slider-container">
        <label>
            <input type="checkbox" bind:checked={isBW} />
            블랙앤화이트(흑백) 효과
        </label>
    </div>
    <div class="slider-container">
        <label for="pixelShape">픽셀 모양:</label>
        <select id="pixelShape" bind:value={pixelShape}>
            <option value="rect">사각형</option>
            <option value="circle">원</option>
            <option value="triangle">삼각형</option>
            <option value="hexagon">육각형</option>
        </select>
    </div>
    <div class="slider-container">
        <label>
            <input type="checkbox" bind:checked={useParticle} />
            파티클 효과
        </label>
    </div>
    <button on:click={handleUpload}>자신의 비디오 업로드</button>
</div>

<style>
    h1 {
        color: #333;
    }
    .container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 20px;
        margin-bottom: 20px;
    }
    .video-container, .canvas-container {
        border: 1px solid #ccc;
        padding: 10px;
        background: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    video, canvas {
        display: block;
        max-width: 100%;
    }
    .controls {
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 15px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 5px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .slider-container {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
    }
    label {
        min-width: 150px;
    }
    input[type="range"] {
        flex: 1;
    }
    .value {
        min-width: 40px;
        text-align: right;
    }
    button {
        padding: 8px 16px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }
    button:hover {
        background-color: #45a049;
    }
</style>

