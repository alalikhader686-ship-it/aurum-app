
/**
 * Image Utilities for AURUM LUXURY ⚜️
 */

export const handleImageUpload = (
  e: React.ChangeEvent<HTMLInputElement>, 
  callback: (url: string) => void,
  onStart?: () => void,
  onEnd?: () => void
) => {
  const file = e.target.files?.[0];
  if (!file) return;

  onStart?.();

  const reader = new FileReader();
  reader.onloadend = () => {
    const img = new Image();
    img.src = reader.result as string;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Export as compressed JPEG
      const compressedUrl = canvas.toDataURL('image/jpeg', 0.6);
      callback(compressedUrl);
      onEnd?.();
    };
  };
  reader.readAsDataURL(file);
};
