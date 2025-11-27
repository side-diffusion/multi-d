<script lang="ts">
	import { onMount } from 'svelte';
	import OpenAI from 'openai';
	import { browser } from '$app/environment';
	import { imagePromptState, stepState } from '../stores/imageStore.svelte';
	import { wsClient } from '../websocket/websocket-client';

	let apiKey = $state('');
	let client: OpenAI | null = $state(null);
	let myAssistant: any = $state(null);
	let myThread: any = $state(null);
	let messages: any[] = $state([]);
	let run: any = $state(null);
	let streamingText = $state('');
	let isStreaming = $state(false);
	let currentStreamingMessage = $state('');
	let prompt = $state('');
	let imagePrompt = $state('');
	let errorMessage = $state('');
	let inputElement: HTMLInputElement;

	$effect(() => {
		// WORKFLOW_FINISHED가 오면 imagePromptState.generating이 false로 바뀜
		if (!imagePromptState.generating) {
			prompt = '';
			errorMessage = '';
		}
	});

	$effect(() => {
		if (
			!imagePromptState.success &&
			imagePromptState.error !== '' &&
			imagePromptState.generating === false
		) {
			errorMessage = imagePromptState.error;
		}
	});

	function sendText() {
		if (errorMessage !== '') {
			errorMessage = '';
		}
		console.log('sendText', prompt);
		wsClient.sendText(prompt);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			sendText();
		}
	}

	function maintainFocus() {
		if (inputElement && document.activeElement !== inputElement) {
			inputElement.focus();
		}
	}

	onMount(() => {
		// Focus input on mount
		if (inputElement) {
			inputElement.focus();
		}
		
		// Add click event listener to document
		document.addEventListener('click', maintainFocus);
		
		return () => {
			document.removeEventListener('click', maintainFocus);
		};
	});
</script>

<main>
	<div class="logo-container">
		<img src="/1.png" alt="logo" class="logo" />
		<img src="/2.png" alt="logo2" class="logo2" />
	</div>

	<div class="input-container">
		<input
			bind:this={inputElement}
			type="text"
			bind:value={prompt}
			placeholder="지금 떠오르는 생각을 입력하세요"
			onkeydown={handleKeydown}
			disabled={imagePromptState.loading || imagePromptState.generating}
			autofocus
		/>
		<button
			onclick={sendText}
			disabled={imagePromptState.loading ||
				imagePromptState.generating ||
				prompt === '' ||
				prompt.length < 1}
		>
			{imagePromptState.loading || imagePromptState.generating ? '/' : '>'}
		</button>
	</div>



</main>
	<div class="terminal">
		<div class="terminal-body">
            	{#if errorMessage !== ''}
	
        <div class="terminal-body-container">
					<p class="terminal-body-header">&gt;</p>
					<div class="terminal-body-text">
						<strong><p class="terminal-title error-msg">Error</p></strong>

						<p class="error-msg">'다시 시도해보시겠어요?' : <br>- {errorMessage}</p>
					</div>
				</div>
	{/if}
			{#if stepState.currentStep === 1}
				<div class="terminal-body-container">
					<p class="terminal-body-header">&gt;</p>
					<div class="terminal-body-text">
						<strong><p class="terminal-title">Display 1 - Input</p></strong>
<p>Input text '{prompt}' has been passed.</p>
						<p>텍스트 '{prompt}'이(가) 전달되었습니다.</p>
					</div>
				</div>
			{:else if stepState.currentStep === 2}
				<div class="terminal-body-container">
					<p class="terminal-body-header">&gt;</p>
					<div class="terminal-body-text">
						<strong><p class="terminal-title">Display 2 - Re-interpreting to Prompt</p></strong>
<p>Generating Fragments prompt based on the input text…</p>
						<p>'{prompt}'을(를) 재해석합니다.</p>
					</div>
				</div>
			{:else if stepState.currentStep === 3}
				<div class="terminal-body-container">
					<p class="terminal-body-header">&gt;</p>
					<div class="terminal-body-text">
						<strong><p class="terminal-title">Display 2 - Generating Prompt</p></strong>
   <p>Generating Fragments prompt based on the input text…</p>
						<p>'{prompt}'을(를) 기반으로 파편들 프롬프트 생성 중..</p>
					</div>
				</div>
			{:else if stepState.currentStep === 4}
				<div class="terminal-body-container">
					<p class="terminal-body-header">&gt;</p>
					<div class="terminal-body-text">
						<strong><p class="terminal-title">System Message - Generating Image</p></strong>
                         <p>Transforming the input text into an image across dimensions.</p>
						<p>'{prompt}'을(를) 이미지로 차원 변환 중..</p>
					</div>
				</div>
			{:else if stepState.currentStep === 5}
				<div class="terminal-body-container">
					<p class="terminal-body-header">&gt;</p>
					<div class="terminal-body-text">
						<strong><p class="terminal-title">Check Display 3 - Generating 3D</p></strong>
                               <p>Transforming the image into a 3D object across dimensions…</p>
						<p>이미지를 3D로 차원 변환 중... 조금만 기다려주세요.</p>
					</div>
				</div>
			{:else if stepState.currentStep === 6}
				<div class="terminal-body-container">
					<p class="terminal-body-header">&gt;</p>
					<div class="terminal-body-text">
						<strong><p class="terminal-title">Check Display 3 - Complete 3D</p></strong>
                        <p>Fragments 3D model generation is complete.</p>
						<p>바벨의 파편 생성이 완료되었습니다.</p>
					</div>
				</div>
			{:else if stepState.currentStep === 0}
				<div class="terminal-body-container">
					<p class="terminal-body-header">&gt;</p>
					<div class="terminal-body-text">
						<strong><p class="terminal-title">INSTRUCTION</p></strong>
                          <p>Please enter your thoughts in the input box below and press Enter.</p>
						<p>지금 생각을 입력하고 Enter키를 누르거나 <br>'&gt;' 버튼을 눌러주세요.</p>
                      
					</div>
				</div>
			{/if}

			{#if stepState.currentStep > 0}
				<div class="terminal-loader">
					<div class="terminal-loader-container"></div>
					<p>{stepState.currentStep}/6</p>
				</div>
			{/if}
		</div>
	</div>
<style>
	header {
		box-sizing: border-box;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 90px;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
    cursor:none;
		z-index: 100;
	}
	main {
           font-family: 'Pretendard-Regular';
    font-weight: 400;
    font-style: normal;
		box-sizing: border-box;
		width: 100vw;
		height: 100vh;
		padding: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 20px;
		text-align: left;
		overflow: hidden;
        cursor:none;
		gap: 6px;
	}

	.logo-container {
		box-sizing: border-box;
		padding: 10px;

		position: relative;
		width: 20%;
		min-width: 350px;
		height: 80%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
        margin-bottom: 30px;
	}

	.logo {
		height: 50%;

		margin-bottom: 10px;
	}

	.logo2 {
		height: 44%;
	}
	.input-container {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		border: 1px solid #ccc;
	}
	button {
		width: 50px;

		border: none;
		outline: none;
		background: none;
		color: #fff;
		transition: all 0.3s ease;
		border-radius: 0;
		box-sizing: border-box;
		cursor: pointer;
		padding: 10px;
	}
	button:disabled {
		opacity: 0.2;
		cursor: not-allowed;
	}

    strong{
        font-family: 'Pretendard-Bold';
    font-weight: 700;
    font-style: normal;
    }

	input {
		box-sizing: border-box;
		padding: 10px;
		font-size: 14px;
		border: none;
		outline: none;
		background: none;
		color: #fff;
		transition: all 0.3s ease;
		border-radius: 0;
		width: 320px;
		border-right: 0.5px solid #ffffff;
                   font-family: 'Pretendard-Regular';
    font-weight: 400;
    font-style: normal;
	}

	input:disabled {
		opacity: 0.2;
		cursor: not-allowed;
		background: #515151;
	}
	.error-msg {
		color: red !important;
	}

	.terminal {
		max-width: 360px;
		position: fixed;
		top: 70px;
		left: 10px;
           font-family: 'Pretendard-Regular';
    font-weight: 300;
    font-size: 14px;
    font-style: normal;
    line-height: 1.4;

		background: #000000ad;
		box-sizing: border-box;
	    cursor:none;
		overflow: hidden;
	}

	.terminal-header {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		width: 100%;
		height: 24px;
		background: #515151;
		padding: 2px 10px;
		box-sizing: border-box;
	}
	.terminal-header p {
		font-size: 14px;
		color: #fff;
	}
	.terminal-body {
		width: 100%;
		height: 100%;

		padding: 10px;
		box-sizing: border-box;
	}



	.terminal-body-container {
		position: relative;
		display: flex;
		width: 100%;
		box-sizing: border-box;
        margin-bottom: 10px;
		flex-direction: row;
		justify-content: space-between;
		gap: 5px;
	}
	.terminal-body-header {
		box-sizing: border-box;
		height: 100%;
		text-align: left;
		text-wrap: nowrap;
		font-size: 14px;
		color: #fff;

		margin-right: 6px;

		margin: 0;
		padding: 0;
	}

	.terminal-body-text {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        gap: 6px;
		width: 100%;
		font-size: 14px;
		color: #fff;
	}
	.terminal-body-text p {
		width: 100%;
		text-align: left;
		box-sizing: border-box;
		text-wrap: wrap;
		margin: 0;
		padding: 0;
	}

	.terminal-loader {
		width: 100%;
		height: 20px;
		display: flex;
		align-items: center;
		
		box-sizing: border-box;
        margin-top: 10px;
	}   

    .terminal-loader p{
        font-size: 14px;
        font-family: 'Pretendard-Regular';
        font-weight: 400;
        font-style: normal;
        margin: 0;
        padding: 0;
        color: #fff;
    }

	.terminal-loader-container {
		width: 12px;
		height: 12px;
		position: relative;
		animation: rotate 800ms linear infinite;
		margin-right: 10px;
	}

	.terminal-loader-container::before {
		content: '/';
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		color: #ffffff;
		font-family: monospace;
		font-size: 14px;
	}


    
        .terminal-title {
        font-size: 14px;
        color: #fff;
        margin-bottom: 6px !important;
    }
	@keyframes rotate {
		0% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(90deg);
		}
		50% {
			transform: rotate(180deg);
		}
		75% {
			transform: rotate(270deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
