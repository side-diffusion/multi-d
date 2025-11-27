// src/lib/stores/imageStore.svelte.ts
export const imagePromptState = $state({
  onWorking: false,
  userText: '',
  prompt: '',
  loading: false,
  generating: false,
  isImageGenerated: false,
  isVideoGenerated: false,
  isModelMeshGenerated: false,
  imageUrl: '',
  videoUrl: '',
  modelMeshUrl: '',
  success: false,
  error: '',
  dataCount: 0
});

export const modelUpdateState = $state({
  isUpdating: false,
  isUpdatingSuccess: false,
});


// 현재 스텝 0: 초기화
// 현재 스텝 1: PROMPT.svelte에서 유저가 인풋창 입력 후 전송
// 현재 스텝 2: TEXT.svelte에서 프롬프트 생성을 시작
// 현재 스텝 3: IMAGE.svelte에서 프롬프트 생성중
// 현재 스텝 4: TEXT.svelte 에서 ChatGPT 가 프롬프트 생성 완료 후, 이미지 생성 시작
// 현재 스텝 5: 이미지 생성 완료
// 현재 스텝 6: 모델 생성 완료  


export const stepState = $state({
  currentStep: 0,

});

export function resetImageResult() {
  imagePromptState.imageUrl = '';
  imagePromptState.videoUrl = '';
  imagePromptState.modelMeshUrl = '';
  imagePromptState.generating = false;
  imagePromptState.success = false;
  imagePromptState.error = '';
  imagePromptState.isImageGenerated = false;
  imagePromptState.isVideoGenerated = false;
  imagePromptState.isModelMeshGenerated = false;
  imagePromptState.loading = false;
  imagePromptState.prompt = '';
  imagePromptState.userText = '';
}


export function checkStoreState() {
  console.log('imagePromptState', imagePromptState);
}