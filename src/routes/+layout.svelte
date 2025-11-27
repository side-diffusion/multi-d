<script>
    import '../global.css';
    import { onMount } from "svelte";
    import { imagePromptState,resetImageResult } from '$lib/stores/imageStore.svelte';
    import { wsClient } from '$lib/websocket/websocket-client';


    let isConnected = $state(false);

    $effect(() => {
        const checkConnection = setInterval(() => {
            const ws = wsClient.ws;
            isConnected = ws?.readyState === WebSocket.OPEN;
        }, 1000);
        return () => {
            clearInterval(checkConnection);
        };
    });


    async function logToGoogleSheets(){
        console.log('imagePromptState', imagePromptState)
        let input = imagePromptState.userText;
        let prompt = imagePromptState.prompt;
        let imageURL = imagePromptState.imageUrl;
        console.log('input', input)
        console.log('prompt', prompt)
        console.log('imageURL', imageURL)

        try {
            const res = await fetch('/api/sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input, prompt, imageURL }),
            });
        if (!res.ok) throw new Error('Google Sheets 로깅 실패');
        const data = await res.json();
        console.log('Google Sheets 로깅 성공:', data);
        } catch (error) {
            console.error('Google Sheets 로깅 실패:', error);
        }
    }



    onMount(()=>{
        console.log('layout loaded')
        console.log('imagePromptState', imagePromptState)
    })
</script>
{#if imagePromptState.onWorking}
 <div class="loading-indicator-overlay"></div>
{/if}
<header>
    
        <img src="/header1.png" alt="logo" class="logo" />
        <img src="/header2.png" alt="logo2" class="logo2" />
    
</header>
<slot></slot>



<style>
      header {
        padding: 20px;
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
        pointer-events: none;
        z-index: 100;
        

    }
    .logo {
        height: 50%;
      
        margin-bottom: 10px;
    }
    .logo2 {
      
        height: 50%;
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