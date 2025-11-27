export class ImageParticle {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    x: number;
    y: number;
    speed: number;
    velocity: number;
    size: number;
    mappedImage: any;
    position1: number;
    position2: number;
    constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, mappedImage: any) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.mappedImage = mappedImage;
        this.x = 0
        this.y = Math.random() * canvas.height;
        this.speed = 0;
        this.velocity = Math.random() * 1.65;
        this.size = Math.random() * 0.1 + 0.0;
        this.position1 = Math.floor(this.y);
        this.position2 = Math.floor(this.x);
        
    }

    update() {
			if (!this.ctx || !this.canvas || !this.mappedImage) return;
			const time = Date.now() * 0.001; // Convert to seconds for smoother effect
			this.size += (Math.sin(time * 0.25) + 1) * 0.025 + (this.x / this.canvas.width) * 0.25;

			this.position1 = Math.floor(this.y);
			this.position2 = Math.floor(this.x);
			// 방어 코드 추가
			if (!this.mappedImage[this.position1] || !this.mappedImage[this.position1][this.position2]) {
				// 좌표가 유효하지 않으면 파티클을 재초기화하거나, return
				this.x = 0;
				this.y = Math.random() * this.canvas.height;
				return;
			}
			this.speed = this.mappedImage[this.position1][this.position2].cellBrightness * 0.35;
			let movement = 5.5 - this.speed + this.velocity;
			this.x += movement;

			// y 위치에 따라 파도 진폭 증가
			const waveAmplitude = (this.x / this.canvas.width) * this.speed * 15.0; // y가 커질수록 진폭 증가
			this.y -= Math.tan(this.x * this.speed * 0.5) * waveAmplitude;

			// 캔버스 높이를 벗어났을 때 처리
			if (this.y > this.canvas.height) {
				this.y = this.canvas.height; // 캔버스 높이로 제한
				this.y -= Math.random() * 10; // 약간의 랜덤성 추가
			} else if (this.y < 0) {
				this.y = 0; // 0으로 제한
				this.y += Math.random() * 10; // 약간의 랜덤성 추가
			}

			if (this.x >= this.canvas.width) {
				this.y = Math.random() * this.canvas.height;
				this.x = 0;
				this.size = Math.random() * 0.1 + 1.0;
			}
		}

    updateCanvasSize(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }


    //파티클 모양
    draw() {
        this.ctx.beginPath();
        this.ctx.fillStyle = 'white';
        this.ctx.rect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        this.ctx.fill();


    }

    drawLine() {
        // 가로로 긴 막대 모양 그리기
        this.ctx.beginPath();
        this.ctx.fillStyle = 'white';
        // 가로 길이는 size의 3배, 세로 높이는 size의 절반으로 설정하여 가로로 긴 막대 형태 생성
        this.ctx.rect(
            this.x - this.size * 2,  // x 시작점 (중앙에서 왼쪽으로 size의 1.5배)
            this.y - this.size / 4,    // y 시작점 (중앙에서 위로 size의 1/4)
            this.size * 4,             // 너비 (size의 3배)
            this.size / 2              // 높이 (size의 절반)
        );
        this.ctx.fill();
    }
}


