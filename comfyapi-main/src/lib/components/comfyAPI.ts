// comfyAPI.ts - Fixed WebSocket Connection

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

// Base URL for our server-side proxy
const PROXY_BASE = '/api/comfy';

// For WebSocket, we'll try direct connection, but fallback to using location
// ComfyUI server configuration for direct WebSocket connection
const COMFY_SERVER = {
  host: '192.168.0.230',
  port: 8188
};
let COMFY_SERVER_URL = '';

const runpodURL = 'https://dx2un510t74uhv-8188.proxy.runpod.net/';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface WebSocketMessage {
  type: string;
  data?: {
    output?: {
      images?: Array<{
        filename: string;
        subfolder?: string;
      }>;
    };
  };
}

interface WebSocketConnection {
  ws: WebSocket | null;
  clientId: string;
  connected: boolean;
}

// Log connection attempt information
function logConnectionAttempt(url: string) {
  if (!isBrowser) return;
  console.log(`Attempting to connect to: ${url}`);
  console.log(`Current page location: ${window.location.href}`);
}

export const setupWebSocket = (
  onMessage: (message: WebSocketMessage) => void
): WebSocketConnection => {
  // Return a minimal object when not in browser
  if (!isBrowser) {
    return { ws: null, clientId: generateUUID(), connected: false };
  }

  const clientId = generateUUID();
  let retryCount = 0;
  const maxRetries = 3;
  let ws: WebSocket | null = null;
  // Initially assume not connected
  const connection: WebSocketConnection = { ws: null, clientId, connected: false };

   // Safely determine the protocol based on current page
  const protocol = isBrowser && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//dx2un510t74uhv-8188.proxy.runpod.net/ws?clientId=${clientId}`;

  // // Try different possible WebSocket URLs
  // const wsUrls = [
  //   // Try localhost connection first (works if ComfyUI is on same machine)
  //   `ws://dx2un510t74uhv-8188.proxy.runpod.net/ws?clientId=${clientId}`,
  //   // Try using the current hostname (might work in some cases)
  //   `ws://${window.location.hostname}:8188/ws?clientId=${clientId}`,
  //   // Try using IP address (if ComfyUI is on different machine)
  //   `ws://dx2un510t74uhv-8188.proxy.runpod.net/ws?clientId=${clientId}`
  // ];

  let currentUrlIndex = 0;

  const connect = () => {
     console.log(`Attempting to connect to WebSocket: ${wsUrl}`);



    try {
      logConnectionAttempt(wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message:', message);
          onMessage(message);
        } catch (error) {
          console.error('WebSocket parsing error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error with URL ${wsUrl}:`, error);
        ws?.close();
        
      if (retryCount < maxRetries) {
          retryCount++;

          console.log(`All URLs failed. Retry attempt ${retryCount} of ${maxRetries}`);
          setTimeout(connect, 2000);
        }
      };

      ws.onopen = () => {
        console.log(`WebSocket connected successfully to ${wsUrl} with clientId: ${clientId}`);
        retryCount = 0;
        // Update the connection object with our successful connection
        connection.ws = ws;
        connection.connected = true;
        COMFY_SERVER_URL = wsUrl
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed: ${wsUrl}`, event);
        // Mark as disconnected if this was our active connection
        if (connection.ws === ws) {
          connection.connected = false;
        }
        
        // Only retry if this was our last URL attempt
        if (retryCount < maxRetries) {
          retryCount++;
       
          console.log(`Connection closed. Retry attempt ${retryCount} of ${maxRetries}`);
          setTimeout(connect, 2000);
        }
      };
    } catch (error) {
      console.error(`Error creating WebSocket with URL ${wsUrl}:`, error);
      
      // Try next URL or retry after delay
     if (retryCount < maxRetries) {
        retryCount++;
   
        setTimeout(connect, 2000);
      }
    }
  };

  connect();
  return connection;
};

export const queuePrompt = async (
  workflow: Record<string, any>,
  clientId: string
): Promise<any> => {
  // Don't try to fetch if not in browser
  if (!isBrowser) {
    return Promise.resolve({ error: 'Not in browser environment' });
  }

  try {
     // Determine if we should use Vercel or local API endpoint
    const isProduction = window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1' && 
                         window.location.hostname !== '192.168.0.230';
    let apiUrl;
    // Use our server-side proxy for HTTP requests
       // When deployed on Vercel, use the direct RunPod URL
    if (isProduction) {
      apiUrl = 'https://dx2un510t74uhv-8188.proxy.runpod.net/prompt';
    } else {
      // In local development, use our server-side proxy
      apiUrl = '/api/comfyui';
    }
     
    console.log('Sending request to:', apiUrl);


      const requestBody = {
      prompt: workflow,
      client_id: clientId
    };
    
if (isProduction) {
      // Note: Vercel deployments may not support incoming webhooks
      // so this might need to be removed
      requestBody['webhook'] = {
        url: window.location.origin + '/api/comfyui/webhook',
        events: ['execution_start', 'execution_complete', 'execution_error']
      };
    }

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

   const response = await fetch('/api/comfyui', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });


    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

     try {
      return await response.json();
    } catch (error) {
      console.error('Error parsing JSON response:', error);
      throw new Error('Invalid JSON response');
    }
  } catch (error) {
    console.error('Queue prompt error:', error);
    throw error;
  }
};

// Helper function to get image URL through the proxy
// export const getComfyUIImageUrl = async (filename: string, subfolder: string = ''): Promise<string> => {
//   if (!isBrowser) return '';
//   // return `${COMFY_SERVER_URL}:${COMFY_SERVER.port}/view?filename=${filename}&subfolder=${subfolder || ''}`;

//   const url = `api/comfyui?filename=${filename}&subfolder=${subfolder || ''}`
//   try {
//     const response = await fetch(url)
//     const data = await response.json()

//     console.log(data)
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}, message: ${data.error}`);
//     }


//     return data
//   } catch (error) {
//     console.error('Error fetching image URL:', error)
//     return '' // Return empty string on error
//   }
// };

export const getComfyUIImageUrl = (filename: string, subfolder: string = ''): Promise<string> => {
  if (!isBrowser) return Promise.resolve('');
  
  // Determine protocol based on current page
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const runpotUrl = runpodURL + 'view?filename=' + filename + '&subfolder=' + subfolder;
  return Promise.resolve(runpotUrl);
};