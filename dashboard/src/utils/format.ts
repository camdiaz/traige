export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export const fmtShortDate = (ts: number) =>
  new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

export async function compressImage(src: string, maxW = 480, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = src;
  });
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
