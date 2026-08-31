import { Cloudinary } from '@cloudinary/url-gen';

const cloudinary = new Cloudinary({
  cloud: {
    cloudName: 'dglkp24ki'
  }
});

export const uploadToCloudinary = async (file, folder = 'madarassa') => {
  if (!file) {
    throw new Error('No file provided for upload');
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file (JPEG, PNG, GIF, WebP)');
  }

  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File size should be less than 10MB');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'dkjuerp');
  formData.append('folder', folder);
  formData.append('resource_type', 'image');

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/dglkp24ki/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      let errorText;
      try {
        const errorData = await response.json();
        errorText = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorText = await response.text() || `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(`Upload failed: ${errorText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Cloudinary error: ${data.error.message || 'Unknown error'}`);
    }

    if (!data.secure_url || typeof data.secure_url !== 'string') {
      throw new Error('Invalid response from upload service');
    }

    return data;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

export default cloudinary;