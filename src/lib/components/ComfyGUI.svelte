<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { setupWebSocket, queuePrompt, getComfyUIImageUrl } from '$lib/components/comfyAPI';
  import { browser } from '$app/environment';

  // Initial states
  let wsState: any = null;
  let prompt = '';
  let negativePrompt = 'text, watermark';
  let generatedImage: string | null = null;
  let isLoading = false;
  let steps = 20;
  let width = 1024;
  let height = 1024;
  let cfg = 8;
  let seed = Math.floor(Math.random() * 1000000); // Smaller initial seed to avoid potential issues
  let connectionStatus = 'Waiting for browser...';
  let connectionError: string | null = null;
  let mounted = false;
  
  // Set up a timer to check WebSocket connection status
  let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;

  function getWorkflow() {
    return {
      "3": {
        "inputs": {
          "seed": seed,
          "steps": steps,
          "cfg": cfg,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1,
          "model": [
            "4",
            0
          ],
          "positive": [
            "6",
            0
          ],
          "negative": [
            "7",
            0
          ],
          "latent_image": [
            "5",
            0
          ]
        },
        "class_type": "KSampler",
        "_meta": {
          "title": "KSampler"
        }
      },
      "4": {
        "inputs": {
          "ckpt_name": "v1-5-pruned-emaonly-fp16.safetensors"
        },
        "class_type": "CheckpointLoaderSimple",
        "_meta": {
          "title": "Load Checkpoint"
        }
      },
      "5": {
        "inputs": {
          "width": width,
          "height": height,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage",
        "_meta": {
          "title": "Empty Latent Image"
        }
      },
      "6": {
        "inputs": {
          "text": prompt,
          "clip": [
            "4",
            1
          ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIP Text Encode (Prompt)"
        }
      },
      "7": {
        "inputs": {
          "text": negativePrompt,
          "clip": [
            "4",
            1
          ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIP Text Encode (Prompt)"
        }
      },
      "8": {
        "inputs": {
          "samples": [
            "3",
            0
          ],
          "vae": [
            "4",
            2
          ]
        },
        "class_type": "VAEDecode",
        "_meta": {
          "title": "VAE Decode"
        }
      },
      "9": {
        "inputs": {
          "filename_prefix": "ComfyUI",
          "images": [
            "8",
            0
          ]
        },
        "class_type": "SaveImage",
        "_meta": {
          "title": "Save Image"
        }
      }
    }
  }

  // Function to check and update connection status
  function checkConnectionStatus() {
    if (!wsState) return;
    
    // Check WebSocket connection
    const isConnected = wsState.connected && wsState.ws?.readyState === 1;
    
    if (isConnected) {
      connectionStatus = 'Connected to ComfyUI';
      connectionError = null;
    } else {
      // Only update if the status isn't already showing an error
      if (connectionStatus !== 'Failed to connect to ComfyUI') {
        connectionStatus = 'Failed to connect to ComfyUI';
        connectionError = 'Could not establish WebSocket connection to ComfyUI server.';
      }
    }
  }

  async function initWebSocket() {
    if (!browser || !mounted) return;
    
    connectionStatus = 'Connecting to ComfyUI...';
    connectionError = null;
    
    try {
      // Set up the WebSocket connection
      const wsConnection = setupWebSocket((message) => {
        if (!mounted) return;
        
        console.log("Received message:", message);
        if (message.type === "executed") {
          console.log("Executed message:", message)
          const imageData = message.data?.output?.images?.[0];
          if (imageData) {
            getComfyUIImageUrl(imageData.filename, imageData.subfolder || '').then(url => {
              generatedImage = url;
              console.log("Generated image:", generatedImage)
              isLoading = false;
            }).catch(error => {
              console.error("Error getting image URL:", error);
              isLoading = false;
            });
          }
        } else if(message.type === 'status') {
          // Use type guard for message.data.status
          const status = (message.data as any)?.status;
          let waitListCount = status?.exec_info?.queue_remaining;
          console.log(`Waiting for ${waitListCount} works in queue`)

        }else if(message.type === 'execution_start') {

        }else if(message.type === 'executing') {

        }else if(message.type === 'progress') {
          const max = (message.data as any)?.max;
          const current = (message.data as any)?.value;
          let percent = max ? Math.round(current / max * 100) : 0;
          console.log(`Progress: ${percent}%`)

        }else if(message.type === 'execution_success') {

        }

      });
      
      wsState = wsConnection;
      console.log("Initial WebSocket state:", wsState);
      
      // Start checking connection status periodically
      if (connectionCheckInterval) clearInterval(connectionCheckInterval as unknown as number);
      connectionCheckInterval = setInterval(checkConnectionStatus, 1000) as unknown as ReturnType<typeof setInterval>;
      
      // Initial check
      setTimeout(checkConnectionStatus, 100); 
    } catch (error: any) {
      console.error("WebSocket setup error:", error);
      connectionStatus = 'Connection error';
      connectionError = error.message || 'Could not connect to ComfyUI server.';
    }
  }

  // We need to delay any browser operations until the component is fully mounted
  onMount(() => {
    mounted = true;
    
    // Using setTimeout to ensure these operations happen in a separate tick
    // after the component is fully initialized
    setTimeout(() => {
      if (browser && mounted) {
        connectionStatus = 'Waiting for ComfyUI...';
        console.log("Component mounted, initializing WebSocket...");
        initWebSocket();
      }
    }, 100);
    
    return () => {
      mounted = false;
      clearInterval(connectionCheckInterval);
    };
  });

  onDestroy(() => {
    mounted = false;
    clearInterval(connectionCheckInterval);
    if (browser && wsState?.ws) {
      try {
        wsState.ws.close();
      } catch (e) {
        console.error("Error closing WebSocket:", e);
      }
    }
  });

  function generateRandomSeed() {
    seed = Math.floor(Math.random() * 1000000);
  }

  async function handleGenerateImage(e: Event) {
    e.preventDefault();

    if (!browser || !mounted) return;

    if (!wsState?.clientId) {
      connectionError = "No WebSocket connection to ComfyUI. Please try reloading the page.";
      return;
    }

    if (!prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    isLoading = true;
    generatedImage = null;
    connectionError = null;

    try {
      const workflow = getWorkflow();
      const result = await queuePrompt(workflow, wsState.clientId);
      console.log("Prompt queued:", result);
    } catch (error) {
      const err = error as Error;
      console.error("Error queuing prompt:", err);
      isLoading = false;
      connectionError = err.message || "Error queuing prompt to ComfyUI";
    }
  }

  function retryConnection() {
    if (browser && mounted) {
      console.log("Retrying connection...");
      initWebSocket();
    }
  }
</script>

<div class="container">
  <div class="connection-status {connectionError ? 'error' : ''}">
    <span>{connectionStatus}</span>
    {#if connectionError}
      <div class="error-message">
        <p>{connectionError}</p>
        <button class="retry-button" on:click={retryConnection}>
          Retry Connection
        </button>
      </div>
    {/if}
  </div>

  <form on:submit={handleGenerateImage} class="form">
    <div class="input-group">
      <label>Positive Prompt</label>
      <textarea 
        bind:value={prompt} 
        placeholder="Enter your prompt here"
        class="text-input"
      ></textarea>
    </div>

    <div class="input-group">
      <label>Negative Prompt</label>
      <textarea 
        bind:value={negativePrompt} 
        placeholder="Enter negative prompt here"
        class="text-input"
      ></textarea>
    </div>
    
    <div class="control-group">
      <div class="slider-container">
        <label>Steps: {steps}</label>
        <input 
          type="range" 
          min="1" 
          max="100" 
          bind:value={steps}
          class="slider"
        />
      </div>

      <div class="slider-container">
        <label>CFG Scale: {cfg}</label>
        <input 
          type="range" 
          min="1" 
          max="20" 
          step="0.5"
          bind:value={cfg}
          class="slider"
        />
      </div>
    </div>

    <div class="dimensions">
      <div class="input-group">
        <label>Width</label>
        <input 
          type="number" 
          bind:value={width} 
          step="8"
          min="64"
          max="2048"
          class="number-input"
        />
      </div>
      <div class="input-group">
        <label>Height</label>
        <input 
          type="number" 
          bind:value={height} 
          step="8"
          min="64"
          max="2048"
          class="number-input"
        />
      </div>
    </div>

    <div class="seed-container">
      <div class="input-group">
        <label>Seed</label>
        <input 
          type="number" 
          bind:value={seed}
          class="number-input"
        />
      </div>
      <button 
        type="button" 
        class="secondary-button"
        on:click={generateRandomSeed}
      >
        🎲 Random
      </button>
    </div>

    <button 
      type="submit" 
      disabled={isLoading || !mounted || (!wsState?.ws || !wsState?.connected) || connectionError}
      class="submit-button"
    >
      {isLoading ? 'Generating...' : 'Generate Image'}
    </button>
  </form>

  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
    </div>
  {/if}

  {#if generatedImage}
    <div class="image-container">
      <img 
        src={generatedImage} 
        alt="Generated artwork"
        class="generated-image"
      >
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  .connection-status {
    padding: 10px;
    margin-bottom: 20px;
    border-radius: 4px;
    background-color: #222;
    display: flex;
    flex-direction: column;
    color: #fff;
  }

  .connection-status.error {
    background-color: #333;
    color: #fff;
  }

  .error-message {
    margin-top: 10px;
    padding: 10px;
    border-radius: 4px;
    background-color: #444;
    color: #fff;
  }

  .retry-button {
    background-color: #222;
    color: #fff;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .input-group label {
    font-weight: bold;
    color: #fff;
  }

  .text-input {
    width: 100%;
    padding: 10px;
    border: 1px solid #444;
    border-radius: 4px;
    font-size: 16px;
    min-height: 80px;
    resize: vertical;
    background: #111;
    color: #fff;
  }

  .control-group {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }

  .slider-container {
    flex: 1;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .slider {
    width: 100%;
  }

  .dimensions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .number-input {
    width: 100%;
    padding: 10px;
    border: 1px solid #444;
    border-radius: 4px;
    background: #111;
    color: #fff;
  }

  .seed-container {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }

  .seed-container .input-group {
    flex: 1;
  }

  .submit-button, .secondary-button {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
  }

  .submit-button {
    background-color: #222;
    color: #fff;
  }

  .submit-button:disabled {
    background-color: #ccc;
    color: #888;
    cursor: not-allowed;
  }

  .secondary-button {
    background-color: #333;
    color: #fff;
  }

  .loading {
    display: flex;
    justify-content: center;
    margin: 20px 0;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #333;
    border-top: 4px solid #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .image-container {
    margin-top: 20px;
  }

  .generated-image {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    box-shadow: none;
  }
</style>