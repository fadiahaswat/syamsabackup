/**
 * FileUploadManager - Document Upload Handler
 *
 * Mengelola upload dokumen (surat dokter) ke bucket private Supabase.
 */

class FileUploadManager {
  constructor() {
    // Configuration
    this.config = {
      maxSizeBytes: APP_STORAGE?.fileUpload?.maxSizeBytes || 5 * 1024 * 1024, // 5MB
      allowedTypes: APP_STORAGE?.fileUpload?.allowedTypes || ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
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

    if (!window.canWriteBusinessData?.() || !window.supabaseClient) {
      return { success: false, errors: ['Upload memerlukan koneksi dan sesi cloud'], localUrl: null };
    }

    const safeName = String(file.name || 'document')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-120);
    const path = `${userId}/${permitId}/${documentId}-${safeName}`;
    const { error: uploadError } = await window.supabaseClient.storage
      .from('permit-documents')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error('[FileUpload] Cloud upload failed:', uploadError);
      return { success: false, errors: ['Gagal mengunggah dokumen ke cloud'], localUrl: null };
    }

    const record = {
      id: `doc_${documentId}`,
      entity_type: 'permit_document',
      kelas: typeof appState !== 'undefined' ? appState.selectedClass : null,
      nis: null,
      owner_user_id: userId,
      data: {
        bucket: 'permit-documents', path, permitId, fileName: file.name,
        fileType: file.type, fileSize: file.size,
      },
      _version: 1,
      deleted_at: null,
    };
    try {
      await window.supabaseSync._writeCloudRecord('app_records', record, 0);
    } catch (metadataError) {
      await window.supabaseClient.storage.from('permit-documents').remove([path]);
      throw metadataError;
    }

    return {
      success: true,
      errors: [],
      localUrl: `storage://permit-documents/${path}`,
      documentId,
      path,
    };
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
    return url?.startsWith('http://') || url?.startsWith('https://') || url?.startsWith('storage://') || false;
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
  async openDocument(url, filename = 'document.pdf') {
    if (!url) {
      window.showToast?.('Dokumen tidak tersedia', 'error');
      return;
    }

    if (url.startsWith('storage://')) {
      const storagePath = url.replace('storage://permit-documents/', '');
      const { data, error } = await window.supabaseClient.storage
        .from('permit-documents')
        .createSignedUrl(storagePath, 300);
      if (error || !data?.signedUrl) {
        window.showToast?.('Gagal membuka dokumen cloud', 'error');
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } else if (url.startsWith('data:')) {
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
  async downloadDocument(url, filename = 'document.pdf') {
    if (!url) {
      window.showToast?.('Dokumen tidak tersedia', 'error');
      return;
    }

    let downloadUrl = url;
    if (url.startsWith('storage://')) {
      const storagePath = url.replace('storage://permit-documents/', '');
      const { data, error } = await window.supabaseClient.storage
        .from('permit-documents')
        .createSignedUrl(storagePath, 300, { download: filename });
      if (error || !data?.signedUrl) {
        window.showToast?.('Gagal mengunduh dokumen cloud', 'error');
        return;
      }
      downloadUrl = data.signedUrl;
    }
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
