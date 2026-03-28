import { useState, useRef } from 'react';
import { uploadSessionPhoto } from '../firebase';
import { Camera, X, Loader2, Image as ImageIcon } from 'lucide-react';

/**
 * PhotoCapture — take or pick photos, upload to Firebase Storage.
 * Supports mobile camera capture and desktop file picker.
 *
 * Props:
 *  - userId, sessionId, stepKey: for building the storage path
 *  - photos: string[] of download URLs (controlled)
 *  - onPhotosChange: (urls: string[]) => void
 */
export default function PhotoCapture({ userId, sessionId, stepKey, photos = [], onPhotosChange }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !sessionId) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const url = await uploadSessionPhoto(userId, sessionId, stepKey, file);
        urls.push(url);
      }
      onPhotosChange([...photos, ...urls]);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = (index) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-stone-300 mb-1">
        📸 Photos
      </label>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-white/10">
              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capture / Pick buttons */}
      <div className="flex gap-2">
        {/* Camera capture (mobile) */}
        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer bg-white/5 border border-white/10 text-stone-300 hover:text-white hover:border-white/20 transition-all">
          <Camera className="w-4 h-4" />
          <span>{uploading ? 'Uploading…' : 'Take Photo'}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFiles}
            disabled={uploading}
          />
        </label>

        {/* Gallery pick */}
        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer bg-white/5 border border-white/10 text-stone-300 hover:text-white hover:border-white/20 transition-all">
          <ImageIcon className="w-4 h-4" />
          <span>Gallery</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFiles}
            disabled={uploading}
          />
        </label>
      </div>

      {uploading && (
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Uploading photo…</span>
        </div>
      )}
    </div>
  );
}
