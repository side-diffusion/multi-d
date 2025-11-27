import 'dotenv/config';
import { WebSocket, WebSocketServer } from 'ws';

import { fal } from "@fal-ai/client";

let generateData = {
    inputText: '',
    prompt: '',
    imageUrl: '',
    modelUrl: '',
    videoUrl: ''
}

fal.config({
    credentials: process.env.VITE_FAL_API_KEY,
});

const wss = new WebSocketServer({ port: 3000 });

// Store connected clients
const clients: Set<WebSocket> = new Set();

wss.on('connection', (ws: WebSocket) => {
    // Add new client to the set
    clients.add(ws);
    console.log('New client connected');

    ws.on('message', async (message: Buffer) => {
        const data = JSON.parse(message.toString());
        if (data.type === 'IMAGE_PROMPT_LOADING' || data.type === 'WORKFLOW_FINISHED') {
            console.log('IMAGE_PROMPT_LOADING', data);
            broadcast(message.toString());

        } else if (data.type === 'RUN_AI_WORKFLOW') {
            // fal.ai API 직접 호출 및 스트리밍 결과 브로드캐스트
            generateData.prompt = data.prompt;
            broadcast(JSON.stringify({
                type: 'PROMPT_GENERATED',
                prompt: data.prompt
            }));


            try {
                console.log('fal 스트림 시작', data.prompt);
                const stream = await fal.stream("workflows/mingeunoh6/babel", {
                    input: { prompt: 'In the style of <s0><s1>, BABELOBJ with' + data.prompt }
                });
                for await (const event of stream) {
                    console.log(event);
                    if (event.type === 'completion') {
                        // 이미지 처리
                        if (event.output?.images?.[0]?.url) {
                            const image = event.output.images[0];
                            try {
                                const r2Url = await uploadToR2ViaApiUpload(
                                    image.url,
                                    '.' + (image.file_name?.split('.').pop() || 'jpg')
                                );
                                generateData.imageUrl = r2Url;
                                console.log('imageUrl', r2Url)
                                broadcast(JSON.stringify({
                                    type: 'IMAGE_RESULT',
                                    imageUrl: r2Url
                                }));
                            } catch (err) {
                                console.error('이미지 R2 업로드 실패:', err);
                            }
                        }
                        // 모델 처리
                        if (event.output?.model_mesh?.url) {
                            const model = event.output.model_mesh.url
                            try {
                                const r2Url = await uploadToR2ViaApiUpload(
                                    model,
                                    '.' + (model.split('.').pop() || 'glb')
                                );
                                generateData.modelUrl = r2Url;
                                console.log('modelUrl', r2Url)
                                broadcast(JSON.stringify({
                                    type: 'MODEL_RESULT',
                                    modelUrl: r2Url
                                }));
                            } catch (err) {
                                console.error('모델 R2 업로드 실패:', err);
                            }
                        }

                        // 비디오 처리
                        if (event.output?.video?.url) {
                            const video = event.output.video;
                            try {
                                const r2Url = await uploadToR2ViaApiUpload(
                                    video.url,
                                    '.' + (video.file_name?.split('.').pop() || 'mp4')
                                );
                                generateData.videoUrl = r2Url;
                                console.log('videoUrl', r2Url)
                                broadcast(JSON.stringify({
                                    type: 'VIDEO_RESULT',
                                    videoUrl: r2Url
                                }));
                            } catch (err) {
                                console.error('비디오 R2 업로드 실패:', err);
                            }
                        }
                    } else if (event.type === 'output') {
                        await logToGoogleSheets();
                        broadcast(JSON.stringify({
                            type: 'WORKFLOW_FINISHED',
                            msg: 'complete',
                            success: true

                        }));
                    }
                    else if (event.type === 'error') {
                        console.error('fal.ai API error event:', event);
                        broadcast(JSON.stringify({
                            type: 'WORKFLOW_FINISHED',
                            msg: event.error.body.detail,
                            success: false
                        }));
                        if (event.error) {
                            console.error('fal.ai error details:', event.error);
                        }
                    }
                }
            } catch (error) {
                console.error('Error in fal workflow:', error);
            }
        } else if (data.type === 'SEND_TEXT') {
            generateData.inputText = data.prompt;
            console.log('SEND_TEXT', data.prompt);
            broadcast(JSON.stringify({
                type: 'USER_TEXT',
                text: data.prompt,
                senderId: data.senderId
            }));
        }
    });

    ws.on('close', () => {
        // Remove client from the set when they disconnect
        clients.delete(ws);
        console.log('Client disconnected');
    });

    ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

function broadcast(message: string) {
    // Send message to all connected clients
    clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}


const API_UPLOAD_URL = process.env.API_UPLOAD_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://ai.oomg.world/api/upload'
        : 'http://192.168.0.230:5173/api/upload');

const GOOGLE_SHEET_POST_URL = process.env.GOOGLE_SHEET_POST_URL ||
    (process.env.NODE_ENV === 'production'
        ? 'https://ai.oomg.world/api/sheet'
        : 'http://192.168.0.230:5173/api/sheet');

async function uploadToR2ViaApiUpload(url: string, ext: string): Promise<string> {
    const res = await fetch(API_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ext }),
    });
    if (!res.ok) throw new Error('R2 업로드 실패');
    const data = await res.json();
    return data.url;
}


async function logToGoogleSheets() {
    try {
        const res = await fetch(GOOGLE_SHEET_POST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(generateData),
        });
        if (!res.ok) throw new Error('Google Sheets 로깅 실패');
        const data = await res.json();
        console.log('Google Sheets 로깅 성공:', data);
        //초기화

    } catch (error) {
        console.error('Google Sheets 로깅 실패:', error);
    } finally {
        console.log('generateData', generateData)
        generateData.inputText = '';
        generateData.prompt = '';
        generateData.imageUrl = '';
        generateData.modelUrl = '';
        generateData.videoUrl = '';
    }
}








console.log('WebSocket server is running on ws://localhost:3000'); 