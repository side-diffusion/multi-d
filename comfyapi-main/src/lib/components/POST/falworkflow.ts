export async function runAI(prompt: string) {
 try {
            console.log("Generating workflow for prompt:", prompt);
        

            const response = await fetch('/api/comfyui/fal/workflow', {
                method: 'POST',
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(data);

            return data;

        } catch (error) {
            console.error('Error generating workflow:', error);
           
            // You might want to add some error handling UI feedback here
        }
}



