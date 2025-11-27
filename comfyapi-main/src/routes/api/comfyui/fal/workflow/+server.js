import { json } from '@sveltejs/kit';
import { fal } from "@fal-ai/client";


fal.config({
  credentials: import.meta.env.VITE_FAL_API_KEY,
});

export async function POST({ request }) {
        console.log('스트림 시작 체크1');
  try {
     console.log('스트림 시작 체크2');
    const { prompt } = await request.json();
    
    const stream = await fal.stream("workflows/mingeunoh6/babel", {
      input: {
        prompt: prompt
      }
    });
    console.log('스트림 시작 체크3');

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
