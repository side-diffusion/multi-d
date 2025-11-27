import { json } from '@sveltejs/kit';
import { fal } from "@fal-ai/client";


fal.config({
  credentials: import.meta.env.VITE_FAL_API_KEY,
});



export async function POST({ request }) {
  try {
    const { prompt } = await request.json();
    
    const stream = await fal.stream("workflows/mingeunoh6/image", {
      input: {
        prompt: prompt
      }
    });

    for await (const event of stream) {
      console.log(event);
    }

    const result = await stream.done();
    console.log(result);

    return json(result);

  } catch (error) {
    console.error('Error generating image:', error);
    return json({ 
      error: 'Failed to generate image',
      message: error.message 
    }, { status: 500 });
  }
}
