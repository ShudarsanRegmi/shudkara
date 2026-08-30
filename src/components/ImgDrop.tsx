import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Camera, Upload, Copy, Check, Download, Trash2, X, RefreshCw, Clock } from 'lucide-react';

interface SharedImage {
  id: string;
  filename: string;
  createdAt: number;
}

interface ImageDetail {
  id: string;
  filename: string;
  dataUrl: string;
  createdAt: number;
}

export const ImgDrop: React.FC = () => {
  const [images, setImages] = useState<SharedImage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection/Detail State
  const [selectedImg, setSelectedImg] = useState<ImageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // File Inputs
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/imgdrop');
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch (err) {
      console.error('Failed to fetch image drop list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
    // Auto-refresh image list every 30 seconds
    const interval = setInterval(fetchImages, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle file select and convert to Base64
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > 8 * 1024 * 1024) {
      alert('File size exceeds 8MB limit.');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/imgdrop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl: reader.result as string,
            filename: file.name
          })
        });

        if (res.ok) {
          await fetchImages();
        } else {
          const errData = await res.json();
          alert(errData.error || 'Failed to upload image.');
        }
      } catch (err) {
        alert('Error uploading image.');
      } finally {
        setUploading(false);
        // Clear inputs
        if (uploadInputRef.current) uploadInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  // View image detail
  const handleViewDetail = async (id: string) => {
    setLoadingDetail(true);
    setSelectedImg(null);
    try {
      const res = await fetch(`/api/imgdrop/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedImg(data);
      } else {
        alert('Image may have expired.');
        await fetchImages();
      }
    } catch (err) {
      alert('Error fetching image details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Copy Image to Clipboard
  const handleCopyImage = async (id: string, dataUrl: string) => {
    try {
      // Split base64 header from content
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        // Fallback: Copy URL of the API endpoint to clipboard
        const shareUrl = `${window.location.origin}/api/imgdrop/${id}`;
        await navigator.clipboard.writeText(shareUrl);
        alert('Clipboard API not fully supported. Image URL copied instead!');
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback text copy
      try {
        const shareUrl = `${window.location.origin}/api/imgdrop/${id}`;
        await navigator.clipboard.writeText(shareUrl);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        alert('Failed to copy link.');
      }
    }
  };

  // Delete Image
  const handleDeleteImage = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this image from temporary memory?')) return;

    try {
      const res = await fetch(`/api/imgdrop/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSelectedImg(null);
        await fetchImages();
      }
    } catch (err) {
      alert('Failed to delete image.');
    }
  };

  // Helper: Calculate remaining minutes of 30-min lifespan
  const getExpiryText = (createdAt: number) => {
    const elapsed = Date.now() - createdAt;
    const remaining = Math.max(0, 30 - Math.floor(elapsed / 60000));
    if (remaining <= 0) return 'Expiring now';
    return `Expires in ${remaining}m`;
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800">
      
      {/* Header Block */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-750 text-xs font-semibold border border-blue-100">
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Ephemeral Media Sharing</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
            ImgDrop Box
          </h1>
          <p className="text-sm md:text-base text-slate-600 max-w-xl leading-relaxed">
            Capture photos or upload images to temporary server memory. Share them instantly with other devices; files expire automatically after 30 minutes.
          </p>
        </div>

        {/* Capture/Upload Buttons */}
        <div className="flex gap-2 shrink-0">
          <input
            type="file"
            accept="image/*"
            ref={uploadInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-xs transition shadow-md shadow-blue-500/10 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            Camera Capture
          </button>
          
          <button
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
        </div>
      </div>

      {/* Uploading progress indicator */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3 justify-center text-blue-700 text-xs font-bold animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Uploading image payload to temp memory...</span>
        </div>
      )}

      {/* Grid of Images */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
        {loading ? (
          <div className="text-center py-10">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <span className="text-xs text-slate-500">Retrieving shared images...</span>
          </div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {images.map(img => (
              <div
                key={img.id}
                onClick={() => handleViewDetail(img.id)}
                className="group relative bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition duration-200 aspect-square flex flex-col justify-end"
              >
                {/* Thumbnail Preview */}
                <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                  <img 
                    src={`/api/imgdrop/${img.id}`} 
                    alt={img.filename} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>

                {/* Expiry / Title overlay */}
                <div className="relative z-10 bg-slate-900/75 text-white p-3 text-[10px] space-y-0.5">
                  <span className="font-bold block truncate">{img.filename}</span>
                  <div className="flex items-center gap-1 font-medium text-slate-350">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>{getExpiryText(img.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-700">Empty Drop Box</h3>
            <p className="text-xs text-slate-550 max-w-xs mx-auto leading-relaxed">
              No temporary files are currently shared. Capture or upload a photo to make it instantly downloadable from other devices.
            </p>
          </div>
        )}
      </div>

      {/* Loading detail indicator spinner */}
      {loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-xs font-bold">Downloading image details...</span>
          </div>
        </div>
      )}

      {/* Image Preview Modal Detail Overlay */}
      {selectedImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4 relative animate-fade-in">
            <button
              onClick={() => setSelectedImg(null)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-650 rounded-lg transition"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="space-y-1 pr-8">
              <h2 className="text-xl font-bold text-slate-900 truncate">
                {selectedImg.filename}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>{getExpiryText(selectedImg.createdAt)}</span>
              </div>
            </div>

            {/* High-res Image Preview */}
            <div className="bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-96 flex items-center justify-center">
              <img 
                src={selectedImg.dataUrl} 
                alt={selectedImg.filename}
                className="max-h-96 object-contain w-full"
              />
            </div>

            {/* Toolbar Buttons */}
            <div className="flex flex-wrap gap-2.5 justify-end">
              <button
                onClick={() => handleDeleteImage(selectedImg.id)}
                className="px-4 py-2 border border-slate-200 text-slate-450 hover:text-red-650 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition mr-auto"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>

              <button
                onClick={() => handleCopyImage(selectedImg.id, selectedImg.dataUrl)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  copiedId === selectedImg.id
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-blue-600 text-white hover:bg-blue-750'
                }`}
              >
                {copiedId === selectedImg.id ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Image
                  </>
                )}
              </button>

              <a
                href={selectedImg.dataUrl}
                download={selectedImg.filename}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
