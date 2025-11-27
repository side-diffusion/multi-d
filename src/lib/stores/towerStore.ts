import { writable } from 'svelte/store';

// Create a store to hold the latest model data
export const towerModelData = writable<{
    imageUrl: string;
    modelUrl: string;
} | null>(null);

// Function to update the model data
export const updateTowerModel = (imageUrl: string, modelUrl: string) => {
    console.log('towerStore - updateTowerModel called with:', { imageUrl, modelUrl });
    if (!imageUrl || !modelUrl) {
        console.error('towerStore - Invalid URLs received:', { imageUrl, modelUrl });
        return;
    }
    towerModelData.set({ imageUrl, modelUrl });
    console.log('towerStore - Model data updated successfully');
}; 