import { auth } from './firebase';

export async function uploadAdminImage(file: File): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Administrator sign-in is required to upload images.');
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('Please choose a JPG, PNG, or WebP image file.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be 5 MB or smaller.');
  }

  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });

  const token = await user.getIdToken();
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mimeType: file.type,
      dataBase64,
    }),
  });

  const result = (await response.json()) as { ok?: boolean; url?: string; error?: string };
  if (!response.ok || !result.ok || !result.url) {
    throw new Error(result.error || 'Image upload failed.');
  }

  return result.url;
}
