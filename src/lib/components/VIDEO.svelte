<script lang="ts">
    import { onMount } from "svelte";
    import { imagePromptState } from '../stores/imageStore.svelte';
    import { wsClient } from '../websocket/websocket-client';

    let { prompt } = $props();
    let isConnected = $state(false);
    let concurrentVideoGenNumber = $state(1);

    // WebSocket connection status
    // $effect(() => {
    //     const checkConnection = setInterval(() => {
    //         const ws = (wsClient as any).ws;
    //         isConnected = ws?.readyState === WebSocket.OPEN;
    //     }, 1000);
    //     return () => {
    //         clearInterval(checkConnection);
    //     };
    // });

    onMount(async () => {
        console.log("Video component mounted");
    })
</script>

<div class="container">
    <header>
        <h1>Video</h1>
        <div class="connection-status" class:connected={isConnected}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
    </header>
  {#if imagePromptState.generating && !imagePromptState.isVideoGenerated}
        <div class="image-loading">
            <p>Generating Video...</p>
        </div>
    {/if}

    {#if imagePromptState.videoUrl && imagePromptState.isVideoGenerated}
        <div class="image-container">
           <video src={imagePromptState.videoUrl} autoplay loop muted></video>
        </div>
    {/if}
    {#if imagePromptState.loading}
        <div class="prompt-card loading">
            <h3>프롬프트 생성중...</h3>
            <div class="timestamp">{new Date().toLocaleTimeString()}</div>
        </div>
    {:else if !imagePromptState.loading && imagePromptState.prompt}
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
    {/if}
</div>

<style>
    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
  
    }

    .image-container {
        margin-top: 2rem;
        text-align: center;
    }

 .image-container video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 10px;
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

