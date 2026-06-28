/**
 * FileUploadManager - Document Upload Handler
 *
 * Mengelola upload dokumen (surat dokter) dengan storage localStorage.
 * Menggunakan base64 encoding untuk menyimpan dokumen.
 */

class FileUploadManager {
  constructor() {
    // Configuration
    this.config = {
      maxSizeBytes: APP_STORAGE?.fileUpload?.maxSizeBytes || 5 * 1024 * 1024, // 5MB
      allowedTypes: APP_STORAGE?.fileUpload?.allowedTypes || ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      storageKey: 'local_document_uploads',
    };

    // State
    this.isUploading = false;
  }

  /**
   * Validate file before upload
   */
  validateFile(file) {
    const errors = [];

    // Check file exists
    if (!file) {
      errors.push('Tidak ada file dipilih');
      return { valid: false, errors };
    }

    // Check file size
    if (file.size > this.config.maxSizeBytes) {
      const maxMB = Math.round(this.config.maxSizeBytes / 1024 / 1024);
      errors.push(`File terlalu besar (max ${maxMB}MB)`);
    }

    // Check file type
    if (!this.config.allowedTypes.includes(file.type)) {
      errors.push(`Format file tidak didukung (${this.config.allowedTypes.join(', ')})`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert file to base64 (for local storage)
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compress image file using HTML5 canvas
   */
  compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.6) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions keeping aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Export as JPEG with given quality
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  /**
   * Save document to localStorage
   */
  async saveDocumentLocally(documentId, base64Data, metadata = {}) {
    try {
      const storageData = this.getStorageData();

      storageData[documentId] = {
        data: base64Data,
        metadata: {
          ...metadata,
          savedAt: new Date().toISOString(),
        }
      };

      localStorage.setItem(this.config.storageKey, JSON.stringify(storageData));
      return { success: true };
    } catch (error) {
      console.error('[FileUpload] Error saving document locally:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get document from localStorage
   */
  getDocument(documentId) {
    const storageData = this.getStorageData();
    return storageData[documentId] || null;
  }

  /**
   * Delete document from localStorage
   */
  deleteDocument(documentId) {
    const storageData = this.getStorageData();
    if (storageData[documentId]) {
      delete storageData[documentId];
      localStorage.setItem(this.config.storageKey, JSON.stringify(storageData));
      return { success: true };
    }
    return { success: false, error: 'Document not found' };
  }

  /**
   * Get all stored documents
   */
  getAllDocuments() {
    return this.getStorageData();
  }

  /**
   * Get storage data from localStorage
   */
  getStorageData() {
    try {
      const data = localStorage.getItem(this.config.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('[FileUpload] Error reading storage:', e);
      return {};
    }
  }

  /**
   * Upload document with local storage
   */
  async uploadDocument(userId, permitId, file) {
    // Validate first
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        localUrl: null,
      };
    }

    // Generate document ID
    const timestamp = Date.now();
    const documentId = `${userId}_${permitId}_${timestamp}`;

    // Convert to base64 for local storage (Compress if it is an image)
    let localUrl = null;
    try {
      if (file.type.startsWith('image/')) {
        localUrl = await this.compressImage(file);
      } else {
        localUrl = await this.fileToBase64(file);
      }
    } catch (base64Error) {
      console.error('[FileUpload] File processing failed:', base64Error);
      return {
        success: false,
        errors: ['Gagal mengkonversi file'],
        localUrl: null,
      };
    }

    // Save to localStorage
    const metadata = {
      userId,
      permitId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };

    const saveResult = await this.saveDocumentLocally(documentId, localUrl, metadata);

    if (!saveResult.success) {
      console.warn('[FileUpload] Document saved to base64 but not indexed:', saveResult.error);
    }

    return {
      success: true,
      errors: [],
      localUrl,
      documentId,
    };
  }

  /**
   * Delete document (local only)
   */
  async deleteDocumentById(documentId) {
    return this.deleteDocument(documentId);
  }

  /**
   * Get document URL (returns base64 data URL)
   */
  getDocumentUrl(documentId) {
    const doc = this.getDocument(documentId);
    if (!doc) return null;
    return doc.data;
  }

  /**
   * Check if URL is a data URL (base64)
   */
  isBase64Url(url) {
    return url?.startsWith('data:') || false;
  }

  /**
   * Check if URL is a remote URL (HTTP)
   */
  isRemoteUrl(url) {
    return url?.startsWith('http://') || url?.startsWith('https://') || false;
  }

  /**
   * Extract filename from URL or path
   */
  getFilenameFromUrl(url) {
    if (!url) return 'document';

    // Handle data URLs
    if (url.startsWith('data:')) {
      const match = url.match(/data:([^;]+);/);
      const ext = match ? match[1].split('/')[1] : 'bin';
      return `document.${ext === 'jpeg' ? 'jpg' : ext}`;
    }

    // Handle paths/URLs
    const parts = url.split('/');
    return parts[parts.length - 1] || 'document';
  }

  /**
   * Open document in new tab (for viewing)
   */
  openDocument(url, filename = 'document.pdf') {
    if (!url) {
      window.showToast?.('Dokumen tidak tersedia', 'error');
      return;
    }

    if (url.startsWith('data:')) {
      // For base64, create blob and open
      const byteString = atob(url.split(',')[1]);
      const mimeType = url.match(/data:([^;]+);/)?.[1] || 'application/pdf';
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } else {
      window.open(url, '_blank');
    }
  }

  /**
   * Download document
   */
  downloadDocument(url, filename = 'document.pdf') {
    if (!url) {
      window.showToast?.('Dokumen tidak tersedia', 'error');
      return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Calculate total storage used by documents
   */
  getStorageUsage() {
    let totalBytes = 0;
    const storageData = this.getStorageData();

    Object.values(storageData).forEach(doc => {
      if (doc.data) {
        // Estimate size of base64 string
        totalBytes += doc.data.length * 0.75; // base64 is ~33% larger than binary
      }
    });

    return {
      bytes: totalBytes,
      KB: (totalBytes / 1024).toFixed(2),
      MB: (totalBytes / (1024 * 1024)).toFixed(2),
    };
  }

  /**
   * Clean old documents (older than specified days)
   */
  cleanOldDocuments(daysOld = 30) {
    const storageData = this.getStorageData();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    let cleanedCount = 0;

    Object.keys(storageData).forEach(docId => {
      const doc = storageData[docId];
      if (doc.metadata?.savedAt) {
        const savedDate = new Date(doc.metadata.savedAt);
        if (savedDate < cutoffDate) {
          delete storageData[docId];
          cleanedCount++;
        }
      }
    });

    if (cleanedCount > 0) {
      localStorage.setItem(this.config.storageKey, JSON.stringify(storageData));
    }

    return { cleanedCount };
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const fileUploadManager = new FileUploadManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileUploadManager;
}

window.FileUploadManager = FileUploadManager;
window.fileUploadManager = fileUploadManager;
