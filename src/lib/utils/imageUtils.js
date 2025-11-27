/**
 * Converts an image to PNG with transparent background
 * @param {string} imageUrl - The URL of the image to convert
 * @returns {Promise<string>} - A promise that resolves to the data URL of the converted image
 */
async function convertToTransparentPNG(imageUrl) {
    // Create a new Image object
    const img = new Image();
    img.crossOrigin = "Anonymous";  // Enable CORS

    // Create a promise to handle image loading
    const imageLoaded = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

    // Start loading the image
    img.src = imageUrl;
    
    // Wait for image to load
    const loadedImg = await imageLoaded;

    // Create canvas and get context
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    
    // Set canvas dimensions to match image
    canvas.width = loadedImg.width;
    canvas.height = loadedImg.height;

    // Draw image on canvas
    ctx.drawImage(loadedImg, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Step 1: Convert to grayscale first
    for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale using luminance formula
        const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Set all RGB channels to the grayscale value
        data[i] = brightness;     // R
        data[i + 1] = brightness; // G
        data[i + 2] = brightness; // B
        // Keep alpha as is for now
        data[i + 3] = 255;
    }

    // Step 2: Convert grayscale values to alpha
    for (let i = 0; i < data.length; i += 4) {
        // Use the red channel (now grayscale) as reference
        const value = data[i];
        
        // If pixel is bright (above threshold), make it transparent
        if (value > 128) {
            data[i + 3] = 0; // Fully transparent
        } else {
            // For darker pixels, make them black and adjust opacity based on darkness
            data[i] = 0;       // R (black)
            data[i + 1] = 0;   // G (black)
            data[i + 2] = 0;   // B (black)
            // Invert and scale the brightness for alpha (darker = more opaque)
            data[i + 3] = 255 - value;
        }
    }

    // Step 3: Invert the colors (black to white)
    for (let i = 0; i < data.length; i += 4) {
        // Only invert if the pixel is visible (has some opacity)
        if (data[i + 3] > 0) {
            // Invert RGB values (0 becomes 255, and vice versa)
            data[i] = 255;     // R (white)
            data[i + 1] = 255; // G (white)
            data[i + 2] = 255; // B (white)
            // Alpha remains unchanged
        }
    }

    // Put processed image data back on canvas
    ctx.putImageData(imageData, 0, 0);

    // Convert canvas to PNG data URL
    return canvas.toDataURL('image/png');
}

export { convertToTransparentPNG };
