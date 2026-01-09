import React, { useRef, useEffect, useState } from 'react';
import { X, Upload, PenTool } from 'lucide-react';

const SignaturePad = ({ value, onChange, disabled = false, requestorName = '' }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState(value || '');
  const [signatureCenter, setSignatureCenter] = useState(null);
  const [signatureOffset, setSignatureOffset] = useState(0); // Store horizontal offset for centering

  useEffect(() => {
    if (value !== signatureData) {
      setSignatureData(value || '');
      if (value && canvasRef.current) {
        // Preserve existing center state when loading, don't reset it
        loadSignatureToCanvas(value);
      } else if (!value && canvasRef.current) {
        clearCanvas();
      }
    }
  }, [value]);

  useEffect(() => {
    if (signatureData && canvasRef.current) {
      loadSignatureToCanvas(signatureData);
    }
  }, []);

  const loadSignatureToCanvas = (base64Data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const imgWidth = Math.min(img.width, canvas.width);
      const imgHeight = Math.min(img.height, canvas.height);
      
      // Detect if signature should be centered based on its width
      // Wide signatures (> 40% of canvas) that are reasonably sized suggest center alignment
      // Narrow signatures are likely left-aligned
      const shouldBeCentered = imgWidth > canvas.width * 0.4 && imgWidth < canvas.width * 0.9;
      
      // Position signature: preserve existing center state if set, otherwise detect
      const currentCenter = signatureCenter || (shouldBeCentered ? 'center' : 'left');
      const x = currentCenter === 'center' ? (canvas.width - imgWidth) / 2 : 0;
      const y = (canvas.height - imgHeight) / 2;
      ctx.drawImage(img, x, y, imgWidth, imgHeight);
      
      // Only update center state if not already set (preserve during re-renders)
      if (signatureCenter === null) {
        setSignatureCenter(currentCenter);
      }
    };
    img.src = base64Data;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
    setSignatureCenter(null);
    setSignatureOffset(0);
    onChange('');
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Account for canvas scaling (canvas.width/height vs displayed size)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const coords = getCoordinates(e);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const coords = getCoordinates(e);
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    
    // Auto-save signature while drawing for preview (with cropping)
    // Use requestAnimationFrame to debounce and ensure state updates properly
    requestAnimationFrame(() => {
      const croppedDataURL = cropSignature(canvas);
      setSignatureData(croppedDataURL);
      onChange(croppedDataURL);
    });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveSignature();
  };

  const cropSignature = (canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    
    // Find bounding box of non-transparent pixels
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // Add small padding
    const padding = 5;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    if (width <= 0 || height <= 0) {
      setSignatureCenter(null);
      return canvas.toDataURL('image/png');
    }
    
    // Calculate center of signature relative to canvas center
    const signatureCenterX = (minX + maxX) / 2;
    const signatureStartX = minX;
    const signatureEndX = maxX;
    const canvasCenterX = canvas.width / 2;
    const canvasCenterStart = canvasCenterX - canvas.width * 0.3; // 30% left of center
    const canvasCenterEnd = canvasCenterX + canvas.width * 0.3; // 30% right of center
    
    // Check if signature overlaps the center area (middle 60% of canvas)
    // Signature is centered if its bounding box overlaps with the center area
    const overlapsCenter = (signatureStartX <= canvasCenterEnd && signatureEndX >= canvasCenterStart) ||
                           (signatureCenterX >= canvasCenterStart && signatureCenterX <= canvasCenterEnd);
    
    const isCentered = overlapsCenter;
    
    setSignatureCenter(isCentered ? 'center' : 'left');
    setSignatureOffset(0); // Reset offset
    
    // Create new canvas with cropped image
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    const croppedCtx = croppedCanvas.getContext('2d');
    
    croppedCtx.drawImage(
      canvas,
      minX, minY, width, height,
      0, 0, width, height
    );
    
    return croppedCanvas.toDataURL('image/png');
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Ensure center detection is preserved
    const croppedDataURL = cropSignature(canvas);
    // Use the current signatureCenter state that was set by cropSignature
    setSignatureData(croppedDataURL);
    onChange(croppedDataURL);
  };

  const handleFileUpload = (e) => {
    if (disabled) return;
    const file = e.target.files[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setSignatureData(base64);
      setSignatureCenter('left'); // Uploaded signatures default to left
      onChange(base64);
      loadSignatureToCanvas(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="w-full">
      <div className="border-2 border-gray-400 rounded p-4 bg-white">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-gray-700">
            Requestor Signature
          </label>
          {!disabled && (
            <div className="flex items-center space-x-2">
              <label className="flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
                <Upload className="h-3 w-3 mr-1" />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {signatureData && (
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="border border-gray-300 rounded bg-gray-50 p-2">
          <canvas
            ref={canvasRef}
            width={600}
            height={150}
            className={`w-full border border-gray-300 rounded bg-white cursor-${disabled ? 'default' : 'crosshair'}`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        
        {!disabled && !signatureData && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            <PenTool className="h-3 w-3 inline mr-1" />
            Draw your signature above or upload an image
          </p>
        )}
      </div>
      
      {/* Preview: Signature overlapping name */}
      {signatureData && requestorName && (
        <div className="mt-4 border-2 border-gray-400 rounded p-4 bg-white">
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Preview (How it will appear)
          </label>
          <div className="relative border-b-2 border-gray-400 pb-2 pt-4 min-h-[100px]">
            {/* Name as base layer - always visible, left-aligned */}
            <div className="relative inline-block" id="signature-name-container">
              <p className="text-sm font-semibold text-gray-900 mb-1 relative z-0 text-left">
                {requestorName}
              </p>
              {/* Signature overlapping the name area - ALWAYS centered over the name */}
              {signatureData && (
                <div 
                  className="absolute top-0 z-10 pointer-events-none"
                  style={{ 
                    left: '50%',
                    transform: 'translate(-50%, -8px)'
                  }}
                >
                  <img 
                    src={signatureData} 
                    alt="Signature Preview" 
                    className="h-auto opacity-90"
                    style={{ height: '20px', maxWidth: '400px', objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignaturePad;

