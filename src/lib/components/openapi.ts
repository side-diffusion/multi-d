import { wsClient } from '$lib/websocket/websocket-client';
import { imagePromptState, resetImageResult } from '../stores/imageStore.svelte';
import OpenAI from "openai";



export default class chatGPT {
    private client: OpenAI;
    private thread: any;
    private name: string;
    private instrunction: string;
    private type: "function" | "code_interpreter" | "file_search";
    private model: string;
    private assistant: any;
    private messages: any[];
    private onStreamingMessgaeUpdate: ((msg: string) => void) | null;
    private onStreamingStatusUpdate: ((status: boolean) => void) | null;
    private onStreamingCompleteUpdate: ((status: boolean) => void) | null;
    public setStreamingMessageListener(callback: (msg: string) => void) {
        this.onStreamingMessgaeUpdate = callback;
    }
    public updateStreamingStatus(callback: (status: boolean) => void) {
        this.onStreamingStatusUpdate = callback;
    }
    public updateStreamingComplete(callback: (status: boolean) => void) {
        this.onStreamingCompleteUpdate = callback;
    }



    public currentStreamingMessage: string;
    public isStreaming: boolean;
    public isCompleted: boolean;
    constructor(apikey: string, name: string, instrunction: string, type: "function" | "code_interpreter" | "file_search", model: string) {
        this.client = new OpenAI({
            apiKey: apikey,
            dangerouslyAllowBrowser: true
        });
        this.name = name;
        this.instrunction = instrunction;
        this.type = type;
        this.model = model;
        this.messages = [];
        this.currentStreamingMessage = '';
        this.isStreaming = false;
        this.isCompleted = false;
        this.onStreamingMessgaeUpdate = null;
        this.onStreamingStatusUpdate = null;
        this.onStreamingCompleteUpdate = null;
        this.init();
    }

    async init() {
        await this.createChatGPT();

    }



    async createChatGPT() {
        //쓰레드 생성
        console.log('createChatGPT', this.instrunction);
        this.thread = await this.client.beta.threads.create();

        //어시스턴트 생성
        let tool;
        if (this.type === "code_interpreter" || this.type === "file_search") {
            tool = { type: this.type };
        } else if (this.type === "function") {
            tool = {
                type: "function",
                function: {
                    name: "my_function",
                    description: "A sample function",
                    parameters: {
                        type: "object",
                        properties: {},
                        required: []
                    }
                }
            };
        }
        const tools = tool ? [tool] : [];


        const instructions = `
You are a prompt generator that converts user ideas into abstract, symbolic sculptural art.

Every generated prompt should describe:
- A futuristic sculpture made from dark matte metal.
- Complex forms inspired by organic structures and brutalist architecture.
- Visually symbolic reinterpretation of the user’s input.
- Highly detailed descriptions of the sculpture’s **shape**, **surface texture**, and **symbolic components**.
- A floating presentation in a soft-lit, beige-toned studio.
- A digital surrealist, cinematic rendering style (Octane style).
- Avoid literal representations; instead, extract metaphors, emotions, or sensations from the user's text and embed them into the physical form of the sculpture.

Always provide vivid visual details about the object's **structure**, **spatial composition**, and **thematic significance**.
`;

        this.assistant = await this.client.beta.assistants.create({
            name: this.name,
            instructions: this.instrunction + instructions,
            tools: tools,
            model: this.model
        });
        console.log('Assistant created:', this.assistant);
    }

    async generateText(prompt: string, instrunction: string) {
        if (!this.client || !this.thread) {
            console.error('OpenAI client or thread is not initialized');
            return;
        }
        this.isStreaming = true;
        if (this.onStreamingStatusUpdate) {
            this.onStreamingStatusUpdate(this.isStreaming);
        }
        this.isCompleted = false;
        if (this.onStreamingCompleteUpdate) {
            this.onStreamingCompleteUpdate(this.isCompleted);
        }


        try {
            const message = await this.client.beta.threads.messages.create(
                this.thread.id,
                {
                    role: "user",
                    content: prompt
                }
            );
            this.messages = [...this.messages, message];


            const runInstructions = `Reinterpret the user input as a symbolic sculpture concept. futuristic sculpture made from dark matte metal. Ths shape must be abstract, surreal, and complex. Focus on **non-representational** forms and **abstract 3D object-like compositions**, avoiding literal architectural or recognizable symbols (such as towers or buildings). The composition should be complex and textured, drawing inspiration from organic forms and brutalist architecture.  Emphasize the how it looks, physical shape and symbolic representation. Just return the detail image prompt explaining the object appearance in English, no other text or explanation. Less than 7 sentences.`



            //스트리밍
            const stream = await this.client.beta.threads.runs.stream(
                this.thread.id,
                {
                    assistant_id: this.assistant.id,
                    instructions: `
Reinterpret the user input as a symbolic sculpture concept.
DO NOT use any literal or recognizable imagery related to food, animals, or objects mentioned by the user.
Avoid depicting literal chickens, birds, wings, bones, or any realistic anatomical features.

Instead, imagine a futuristic sculpture made from dark matte metal, with surreal and complex abstract forms.
Use organic curves, fragmented geometry, layered surfaces, or other symbolic compositions to evoke the **essence or emotion** of the user’s input (e.g., crispness, energy, chaos, indulgence).

Describe only the sculpture's **abstract physical shape**, **surface texture**, and **symbolic spatial design**.
The sculpture floats in a soft-lit beige studio and is rendered in a cinematic, Octane style.
Return only the final image prompt in English (under 7 sentences), with no introductions or explanations.
`

                }
            );

            //스트리밍 이벤트
            stream.on('textCreated', (text) => {
                console.log('textCreated', text);
                this.currentStreamingMessage = '';

            });

            stream.on('textDelta', (delta, snapshot) => {
                this.currentStreamingMessage += delta.value;
                if (this.onStreamingMessgaeUpdate) {
                    this.onStreamingMessgaeUpdate(this.currentStreamingMessage);

                }
            });

            stream.on('toolCallCreated', (toolCall) => {
                this.currentStreamingMessage += `\n\nRunning code:\n`;
            });

            stream.on('toolCallDelta', (delta, snapshot) => {
                if (delta.type === 'code_interpreter' && delta.code_interpreter) {
                    if (delta.code_interpreter.input) {
                        this.currentStreamingMessage += delta.code_interpreter.input;
                    }
                    if (delta.code_interpreter.outputs) {
                        this.currentStreamingMessage += "\n\nOutput:\n";
                        delta.code_interpreter.outputs.forEach(output => {
                            if (output.type === "logs") {
                                this.currentStreamingMessage += `\n${output.logs}\n`;
                            }
                        });
                    }

                }
            });


            stream.on('end', async () => {
                this.isCompleted = true;

                console.log('[DEBUG] stream.on(end) fired');
                if (this.client) {
                    const threadMessages = await this.client.beta.threads.messages.list(
                        this.thread.id
                    );
                    this.messages = threadMessages.data.reverse();
                    console.log('messages', this.messages);
                    this.isStreaming = false;


                    if (this.onStreamingStatusUpdate) {
                        this.onStreamingStatusUpdate(this.isStreaming);
                    }
                    if (this.onStreamingCompleteUpdate) {
                        this.onStreamingCompleteUpdate(this.isCompleted);
                    }

                }

            });



        } catch (error) {
            console.error('Error creating message:', error);
            this.isStreaming = false;
            this.isCompleted = true;
            if (this.onStreamingStatusUpdate) {
                this.onStreamingStatusUpdate(this.isStreaming);
            }
            if (this.onStreamingCompleteUpdate) {
                this.onStreamingCompleteUpdate(this.isCompleted);
            }
            return;
        }
    }





}