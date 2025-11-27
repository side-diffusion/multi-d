import { imagePromptState, resetImageResult, checkStoreState, stepState } from '../stores/imageStore.svelte';
import { runAI } from '$lib/components/POST/falworkflow';
import { browser } from '$app/environment';
import { v4 as uuidv4 } from 'uuid';
import { get } from 'svelte/store';
import { updateTowerModel } from '$lib/stores/towerStore';

// If using TypeScript, you may also need: import type { v4 as uuidv4 } from 'uuid';

class WebSocketClient {
    private ws: WebSocket | null = null;
    private static instance: WebSocketClient;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 5000; // 5 seconds
    private clientId: string = uuidv4();

    private constructor() {
        if (browser) {
            this.connect();
        }
    }

    public static getInstance(): WebSocketClient {
        if (!WebSocketClient.instance) {
            WebSocketClient.instance = new WebSocketClient();
        }
        return WebSocketClient.instance;
    }

    private connect() {
        if (!browser) return;

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const isLocalhost = host === 'localhost' || host.includes('192.168.') || host.includes('127.0.0.1');
            const wsUrl = isLocalhost 
                ? `${protocol}//${host}:3000` 
                : `${protocol}//${host}/ws`;

            console.log('Attempting to connect to:', wsUrl);
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('Connected to WebSocket server');
                this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
            };

            this.ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('데이터', data);
                    if (data.type === 'USER_TEXT') {
                        resetImageResult();
                        imagePromptState.onWorking = true;

                        imagePromptState.userText = data.text;
                        stepState.currentStep = 2;
                        console.log('텍스트 결과', data.text);
                        console.log('현재 스텝', stepState.currentStep);
                        checkStoreState();
                    } else if (data.type === 'IMAGE_PROMPT_LOADING') {
                        imagePromptState.loading = true;
                        console.log('로딩중', 'loading set to true');
                        stepState.currentStep = 3;
                        console.log('현재 스텝', stepState.currentStep);
                    } else if (data.type === 'IMAGE_RESULT') {
                        console.log('이미지 결과', data.imageUrl);
                        imagePromptState.loading = false;
                        imagePromptState.isImageGenerated = true;
                        imagePromptState.imageUrl = data.imageUrl;
                        stepState.currentStep = 5;
                        checkStoreState();
                        console.log('현재 스텝', stepState.currentStep);
                    } else if (data.type === 'VIDEO_RESULT') {
                        console.log('비디오 결과', data.videoUrl);
                        imagePromptState.loading = false;
                        imagePromptState.isVideoGenerated = true;
                        imagePromptState.videoUrl = data.videoUrl;
                        checkStoreState();
                        console.log('현재 스텝', stepState.currentStep);
                    } else if (data.type === 'MODEL_RESULT') {
                        console.log('모델 결과 전체 데이터:', data);
                        console.log('모델 URL:', data.modelUrl);

                        imagePromptState.loading = false;
                        imagePromptState.isModelMeshGenerated = true;
                        imagePromptState.modelMeshUrl = data.modelUrl;

                        // Use the existing imageUrl from imagePromptState if not provided in the response
                        const imageUrl = data.imageUrl || imagePromptState.imageUrl;

                        if (!data.modelUrl || !imageUrl) {
                            console.error('모델 또는 이미지 URL이 없습니다:', {
                                modelUrl: data.modelUrl,
                                imageUrl: imageUrl,
                                state: imagePromptState.imageUrl
                            });

                            return;
                        }

                        updateTowerModel(imageUrl, data.modelUrl);
                        checkStoreState();
                        stepState.currentStep = 6;
                        console.log('현재 스텝', stepState.currentStep);
                    } else if (data.type === 'WORKFLOW_FINISHED') {
                        console.log('워크플로우 끝');
                        imagePromptState.onWorking = false;
                        imagePromptState.generating = false;
                        imagePromptState.success = data.success;
                        imagePromptState.error = data.success ? '' : data.msg;
                        stepState.currentStep = 0;
                        console.log('현재 스텝', stepState.currentStep);
                        checkStoreState();
                    } else if (data.type === 'PROMPT_GENERATED') {
                        imagePromptState.loading = false;
                        imagePromptState.prompt = data.prompt;
                        imagePromptState.generating = true;
                        console.log('프롬프트 생성끝');
                        stepState.currentStep = 4;
                        console.log('현재 스텝', stepState.currentStep);
                        checkStoreState();
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                    stepState.currentStep = 0;

                }
            };

            this.ws.onclose = () => {
                console.log('Disconnected from WebSocket server');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            this.attemptReconnect();
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), this.reconnectDelay);
        } else {
            console.error('Max reconnection attempts reached. Please refresh the page.');
        }
    }

    public sendText(prompt: string) {

        if (!browser) return;
        
        if (this.ws?.readyState === WebSocket.OPEN) {
            stepState.currentStep = 1;
            console.log('현재 스텝', stepState.currentStep);
            this.ws.send(JSON.stringify({
                type: 'SEND_TEXT',
                prompt: prompt, 
                senderId: this.clientId
            }));
        }
    }
 

    public sendImagePromptLoading() {
        if (!browser) return;
        if (this.ws?.readyState === WebSocket.OPEN) {

            try {
                imagePromptState.loading = true;
                imagePromptState.prompt = '';
                console.log('로딩중', 'loading set to true');
                this.ws.send(JSON.stringify({
                    type: 'IMAGE_PROMPT_LOADING'
                }));
            } catch (error) {
                console.error('Error sending loading message:', error);
            }
        } else {
            console.warn('WebSocket is not connected. Loading message not sent.');
        }
    }

    public runAIworkflow(prompt: string) {
        if (!browser) return;

        if (this.ws?.readyState === WebSocket.OPEN) {

            if (imagePromptState.generating) {
                return;
            }
            console.log('중복 실행되는지 검사', prompt);
            this.ws.send(JSON.stringify({
                type: 'RUN_AI_WORKFLOW',
                prompt: prompt,
                senderId: this.clientId
            }));
        }
    }

    
}

export const wsClient = WebSocketClient.getInstance(); 