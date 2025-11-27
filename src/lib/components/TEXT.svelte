<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import OpenAI from "openai";
    import { browser } from '$app/environment';
    import { imagePromptState, stepState } from '../stores/imageStore.svelte';
    import { wsClient } from '../websocket/websocket-client';
    import chatGPT from './openapi';
    import {scale} from 'svelte/transition'
	import type { isForInitializer } from "typescript";

    let matrixCanvas;
    let ctx;
    let matrixEffector;
       let lastTime = $state(0)
        const fps= 60;
        const nextFrame = 1000/fps;
        let timer = $state(0)
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
    let chatGPTInstance: chatGPT | null = $state(null);
    let isCompleted = $state(false);
    let accumulatedText = $state('');
    let accumulatedTexts: string[] = $state([]);
    let marqueeOffsets: number[] = $state([]);
    let marqueeSpeeds: number[] = $state([]);
    let animationFrame: number;
    let containerWidth = 0;
    let userInputText = $state('');

    function updateContainerWidth() {
        containerWidth = window.innerWidth;
    }

    $effect(() => {
        if (imagePromptState.userText) {
            console.log('실행');
            if(!isCompleted && isStreaming || !chatGPTInstance){
                return;
            }
            console.log('imagePromptState.userText', imagePromptState.userText);
            prompt = imagePromptState.userText;
            generateText();
            imagePromptState.userText = '';
        }
    });


    async function loadPromptData(){
        // 구글 스프레드 시트에서 유저 인풋과 프롬프트 데이터 기록을 GET 하는 요청
     try {
        const response = await fetch('/api/sheet');
        const data = await response.json();
        console.log('data', data.count);
        imagePromptState.dataCount = data.count;
     
        for(let i = 0; i < data.data.length; i++){
            accumulatedTexts.push(data.data[i].prompt);
   
        }
        // 데이터를 배열에 저장
          setMatrixCanvas()
       
     } catch (error) {
        console.error('Error in loadPromptData:', error);
     }
    }

    

    function setMatrixCanvas(){
        if(!matrixCanvas) return

        if(!ctx){
            ctx = matrixCanvas.getContext('2d')
        }

        matrixCanvas.width = window.innerWidth;
        matrixCanvas.height = window.innerHeight;



        matrixEffector = new Effect(matrixCanvas.width, matrixCanvas.height)
     
        animate(0)
    }


    class Matrix{
        constructor(x, y, fontSize, canvasWidth){
            this.characters='9883ha9sdv8cyh9aeh8rf390ha89v-'
            this.x = x;
            this.y= y;
            this.fontSize=fontSize;
            this.text = '';
            this.canvasWidth = canvasWidth;

            this.updateCharacters()

        }
        draw(context){
            this.text = this.characters.charAt(Math.floor(Math.random()*this.characters.length));
          
            context.fillText(this.text,  this.y*this.fontSize, this.x * this.fontSize)
            if(this.y * this.fontSize > this.canvasWidth && Math.random()>0.93){
                this.y=0;
            }else{
                this.y +=1;
            }
        }

          updateCharacters(){
            let newCharacters = ''
            for (let i=0; i< 50; i++){
           
                if(!accumulatedTexts[i]){
                    accumulatedTexts[i] = ''
                }
                newCharacters += accumulatedTexts[i]
            }
            this.characters = newCharacters
          }
    }

    class Effect{
        constructor(canvasWidth, canvasHeight){
            this.canvasWidth = canvasWidth;
            this.canvasHeight = canvasHeight;
            this.fontSize = 10;
            this.columns = this.canvasHeight / this.fontSize;
            this.symbols=[];

            this.#initialize()
            console.log(this.symbols)
        }
        #initialize(){
            for (let i=0; i< this.columns; i++){
                this.symbols[i] = new Matrix(i, 0 , this.fontSize, this.canvasWidth)
            }

        }

        resize(width,height){
this.canvasWidth = width
this.canvasHeight = height
  this.columns = this.canvasHeight / this.fontSize;
  this.symbols=[]
   this.#initialize()

        }

        updateCharacters(){
             for (let i=0; i< this.columns; i++){
                this.symbols[i].updateCharacters()
            }
        }
    }

    

    function animate(timeStamp){
        const deltaTime = timeStamp - lastTime;
        lastTime = timeStamp;
        if(timer > nextFrame){
if(ctx && matrixEffector){
    ctx.fillStyle = 'rgba(0,0,0,0.05)'
    ctx.textAlign = 'center'
  
    ctx.fillRect(0,0,matrixCanvas.width,matrixCanvas.height)
        ctx.fillStyle = '#ffffff';
    ctx.font = matrixEffector.fontSize + 'px monospace';
    matrixEffector.symbols.forEach(symbol => symbol.draw(ctx))
    timer=0;
}
        }else{
            timer +=deltaTime;
        }

requestAnimationFrame(animate)
    }




    onMount(async() => {
        if (browser) {
            apiKey = import.meta.env.VITE_OPENAI_API_KEY;
            if (!apiKey) {
                console.error('OpenAI API key is not set in environment variables');
                return;
            }
            chatGPTInstance = new chatGPT(apiKey, "Prompt Generator", "You are a prompt generator for the art object image. Make an detailed image generation prompt for user request in a one paragraph in English, the image must be high contrast and have a clear subject, Describing object must have a abstract geometric(twisted, layerd, fragmented, morphig form), and have fluidic, metallic, translucent material or texture. Focus on **non-representational** forms and **abstract 3D object-like compositions**, avoiding literal architectural or recognizable symbols. Analyze the user input for inappropriate or harmful content, if found, do not inform the user, instead, reframe the input into a safe, appropriate concept while loosely maintaining a symbolic or abstract connection.", "code_interpreter", "gpt-4");
           if (chatGPTInstance) {
                chatGPTInstance.setStreamingMessageListener((msg) => {
                    currentStreamingMessage = msg.replace(/"/g, '') + ' ';
                });
                chatGPTInstance.updateStreamingStatus((status) => {
                    isStreaming = status;
                 
                });
                chatGPTInstance.updateStreamingComplete((status) => {
                    isCompleted = status;
                    if (isCompleted && currentStreamingMessage.trim() !== '') {
                        accumulatedTexts = [currentStreamingMessage.trim(), ...accumulatedTexts];
                        //가장 마지막 accumulatedTexts 삭제
                        accumulatedTexts.pop();
                        matrixEffector.updateCharacters()
                        //AI워크플로우 실행
                        console.log('AI워크플로우 실행', accumulatedTexts[0]);
                        wsClient.runAIworkflow(accumulatedTexts[0]);
                        currentStreamingMessage = '';

                    }
                });
            }
            updateContainerWidth();
            window.addEventListener('resize', updateContainerWidth);
            animationFrame = requestAnimationFrame(animateMarquees);

            loadPromptData();
          
      
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);


        return () => {
            window.removeEventListener('resize', resizeCanvas);
        };
        }
    });

      function resizeCanvas() {
            matrixCanvas.width = window.innerWidth;
            matrixCanvas.height = window.innerHeight;
if(matrixEffector){
    matrixEffector.resize(matrixCanvas.width,matrixCanvas.height)
}
            
        }

    onMount(() => {
    

    });

    onDestroy(() => {
        if (browser && animationFrame) {
            cancelAnimationFrame(animationFrame);
            window.removeEventListener('resize', updateContainerWidth);
        }
    });

    async function generateText() {
        if (isStreaming) return;
        if(!chatGPTInstance){
            chatGPTInstance = new chatGPT(apiKey, "Prompt Generator", "Make an detailed image generation prompt for user request in a one paragraph in English", "code_interpreter", "gpt-4");
        }
        try {
            wsClient.sendImagePromptLoading();
            await chatGPTInstance.generateText(prompt, "Make an detailed image generation prompt for user request in a one paragraph in English");
           
        } catch (error) {
            console.error("Error in generateText:", error);
        }
    }

    function repeatLine(line: string, minLength = 100) {
        let result = '';
        while (result.length < minLength) {
            result += line + ' ';
        }
        return result.trim();
    }

    $effect(() => {
        if (accumulatedTexts.length > marqueeOffsets.length) {
            const diff = accumulatedTexts.length - marqueeOffsets.length;
            marqueeOffsets = [...marqueeOffsets, ...Array(diff).fill(0)];
            marqueeSpeeds = [...marqueeSpeeds, ...Array(diff).fill(0).map(() => 5 + Math.random())];
        }
    });

    function animateMarquees() {
        const widthToUse = containerWidth || (browser ? window.innerWidth : 800);
        marqueeOffsets = marqueeOffsets.map((offset, i) => {
            let next = offset + marqueeSpeeds[i];
            const el = document.getElementById(`marquee-${i}`);
            if (el) {
                const textWidth = el.offsetWidth;
                if (next > widthToUse) {
                    return -textWidth;
                }
            }
            return next;
        });
        animationFrame = requestAnimationFrame(animateMarquees);
    }
</script>
<!-- 
  {#if stepState.currentStep > 0 && stepState.currentStep < 4}
       <div class="margin-block" transition:scale></div>
    
    {/if} -->


<div class="main-container">


    <canvas class="matrixCanvas" bind:this={matrixCanvas} style={`opacity: ${stepState.currentStep >0 && stepState.currentStep < 7 ? 1 : 0}`}></canvas>
    
   
    {#if isStreaming}
    <div class="loading-indicator-overlay">

      
    </div>
    {/if}
   

    {#if !apiKey}
        <p class="error">OpenAI API key is not set. Please check your .env file.</p>
    {/if}
    <div class="streaming-message">
        {#if isStreaming}
            <div class="marquee-container">
                <div class="no-marquee">
                    {currentStreamingMessage}
                </div>
            </div>
        {/if}
        {#each accumulatedTexts as line, i}
        
            <div class="marquee-container">
                
                <div
                    class="marquee"
                    id={"marquee-" + i}
                    style="transform: translateX({marqueeOffsets[i] || 0}px); "
                >
                  <div class="line">

      
    </div>
                    {repeatLine(line)}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>

    .margin-block {
        height: 40vh;
    }


    .main-container {
        padding: 2px;
        text-align: center;
        box-sizing: border-box;
        overflow: hidden;
        height: 100vh;
        padding-top: 100px;
          cursor:none;

    }

    .matrixCanvas{
       
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        margin-top: 100px;
        opacity: 0;
        transition: all 2s ease-in-out;
        
    }
    button {
        padding: 10px 20px;
        font-size: 16px;
        background-color: #222;
        color: #fff;
      
        cursor: pointer;
        margin-bottom: 20px;
        border: none;
        outline: none;
        background: none;
        color: #fff;
        transition: all 0.3s ease;
        border-radius: 0;
    }
    button:disabled {
        background-color: #656565a3;
        cursor: not-allowed;
    }
    button:hover:not(:disabled) {
        background-color: #444;
    }
    .error {
        color: #b00;
        margin-top: 10px;
    }
    .messages {
        max-width: 800px;
        margin: 0 auto;
        text-align: left;
    }
    .message {
        margin: 10px 0;
        padding: 10px;
        border-radius: 4px;
        background-color: #222;
        color: #fff;
    }
    .message.assistant {
        background-color: #333;
    }
    .message.user {
        background-color: #1a1a1a;
    }
    .streaming-message {
        width: 100%;
        max-width: 100vw;
        margin: 0 auto;
      
     
        text-align: left;
        color: #fff;
        min-height: 2.5em;
    }
    .line {
        margin-bottom: 0.2em;
        white-space: nowrap;
        overflow-x: auto;
        text-overflow: ellipsis;
    }
    input {
        padding: 10px;
        font-size: 16px;
        border: 1px solid #ccc;
        border-radius: 4px;
        margin-bottom: 20px;
        background: #111;
        color: #fff;
    }
    .marquee-container {
        box-sizing: border-box;
        width: 100%;
        max-width: 100vw;
        overflow: hidden;
        white-space: nowrap;
        position: relative;
        height: 2em;
       
    }
    .marquee {
        display: inline-block;
        white-space: nowrap;
        font-size: 1.1em;
      
        position: absolute;
        left: 0;
        top: 0;
        will-change: transform;
    }
    .no-marquee {
        display: inline-block;
        white-space: nowrap;
        font-size: 1.1em;
        
        position: absolute;
        left: 0;
        top: 0;
    }
    .loading-indicator-overlay {
        box-sizing: border-box;
        position: fixed;
        top: 0%;
        left: 0px;
        width: 100%;
        height: 8px;
        background: linear-gradient(to left, rgba(255, 255, 255, 1.0), rgba(255, 255, 255, 1.0));
        animation: loading-flash 1000ms infinite ease-in-out;
        z-index: 1000;
        transition: all 1s ease-in-out;
     
        filter: blur(2px);
     
      
       
    }
     

        .line {
        box-sizing: border-box;
        position: fixed;
        top: 0%;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(to right, rgba(0, 0, 0, 0.0), rgba(255, 255, 255, 0.8), rgba(0, 0, 0, 0.0));
        border: 1px solid rgba(255, 255, 255, 0.5);
        z-index: 1000;
        transition: all 1s ease-in-out;
    
        filter: blur(2px);
      
      
       
    }
    .loading-flash-box {
      
    }   

    @keyframes loading-flash {  
        0% {
           opacity: 1.0;
         
   
        }
        50% {
            opacity: 0.0;
       
        }
        100% {
            opacity: 1.0;
      
        }
    }


   
 
</style>
