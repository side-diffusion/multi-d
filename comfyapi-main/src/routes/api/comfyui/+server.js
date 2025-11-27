import { json } from '@sveltejs/kit';

export async function POST({ request }) {
  try {
    console.log(request)
    const body = await request.json();
    
    // Forward the request to ComfyUI server
    const response = await fetch('https://dx2un510t74uhv-8188.proxy.runpod.net/prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`ComfyUI server responded with ${response.status}`);
    }

    const data = await response.json();
    console.log(data)
    return json(data);

  } catch (error) {
    console.error('Error in ComfyUI proxy:', error);
    return json({ error: error.message }, { status: 500 });
  }
}
