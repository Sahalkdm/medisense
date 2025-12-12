import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, FileText, Video as VideoIcon } from 'lucide-react';
import { MediaFile } from '../types';

interface MediaUploadProps {
  selectedFile: MediaFile | null;
  onFileSelect: (file: MediaFile | null) => void;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ selectedFile, onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getFileType = (mime: string): 'image' | 'video' | 'pdf' => {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime === 'application/pdf') return 'pdf';
    return 'image'; // fallback
  };

  const processFile = (file: File) => {
    const validTypes = ['image/', 'video/', 'application/pdf'];
    if (!validTypes.some(type => file.type.startsWith(type) || file.type === type)) {
      alert('Please upload an Image, Video, or PDF file.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File size too large. Please upload files smaller than 50MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      
      onFileSelect({
        file,
        preview: result,
        base64: base64,
        mimeType: file.type,
        type: getFileType(file.type)
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const renderPreview = () => {
    if (!selectedFile) return null;

    if (selectedFile.type === 'video') {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center relative">
          <video 
            src={selectedFile.preview} 
            controls 
            className="w-full h-full object-contain" 
          />
        </div>
      );
    }

    if (selectedFile.type === 'pdf') {
      return (
        <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-4">
          <FileText className="w-16 h-16 text-red-500 mb-2" />
          <p className="text-sm font-medium text-slate-700 text-center truncate max-w-full px-4">
            {selectedFile.file.name}
          </p>
          <p className="text-xs text-slate-500 uppercase mt-1 tracking-wider font-semibold">PDF Document</p>
        </div>
      );
    }

    // Default Image
    return (
      <img 
        src={selectedFile.preview} 
        alt="Preview" 
        className="w-full h-full object-contain"
      />
    );
  };

  if (selectedFile) {
    return (
      <div className="relative w-full h-64 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm group">
        {renderPreview()}
        <button
          onClick={() => {
            onFileSelect(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          className="absolute top-2 right-2 p-2 bg-white/90 rounded-full hover:bg-red-50 text-slate-600 hover:text-red-500 transition-all shadow-sm z-10 backdrop-blur-sm"
        >
          <X size={20} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        w-full h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group
        ${isDragging 
          ? 'border-blue-500 bg-blue-50 scale-[0.99]' 
          : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
        }
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleChange}
        accept="image/*,video/*,application/pdf"
        className="hidden"
      />
      <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform duration-200 border border-slate-100">
        <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'}`} />
      </div>
      <p className="text-slate-600 font-medium group-hover:text-slate-800 transition-colors">Click to upload or drag & drop</p>
      <div className="flex items-center space-x-3 mt-3 text-slate-400 text-xs font-medium">
         <span className="flex items-center"><ImageIcon size={12} className="mr-1" /> Images</span>
         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
         <span className="flex items-center"><VideoIcon size={12} className="mr-1" /> Videos</span>
         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
         <span className="flex items-center"><FileText size={12} className="mr-1" /> PDFs</span>
      </div>
    </div>
  );
};