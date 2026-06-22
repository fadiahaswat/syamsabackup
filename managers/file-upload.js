/**
 * FileUploadManager - Document Upload Handler
 *
 * Mengelola upload dokumen (surat dokter) ke Supabase Storage
 * dengan fallback ke base64 di LocalStorage.
 */

class FileUploadManager {
  constructor() {
    // Configuration
    this.config = {
      maxSizeBytes: APP_STORAGE?.fileUpload?.maxSizeBytes || 5 * 1024 * 1024, // 5MB
      allowedTypes: APP_STORAGE?.fileUpload?.allowedTypes || ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      bucket: APP_STORAGE?.fileUpload?.bucket || 'permit-documents',
    };

    // State
    this.isUploading = false;
    this.supabaseConfigured = !!(APP_STORAGE?.supabase?.url && APP_STORAGE?.supabase?.anonKey);
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
   * Convert file to base64 (for local fallback)
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
   * Upload document to Supabase Storage
   */
  async uploadToSupabase(path, file) {
    if (!window.supabaseClient?.client) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await window.supabaseClient.client.storage
      .from(this.config.bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = window.supabaseClient.client.storage
      .from(this.config.bucket)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  /**
   * Upload document with local fallback
   */
  async uploadDocument(userId, permitId, file) {
    // Validate first
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        storageUrl: null,
        localUrl: null,
      };
    }

    // Generate path for Supabase Storage
    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const path = `${userId}/${permitId}_${timestamp}.${ext}`;

    // Try upload to Supabase if configured and online
    let storageUrl = null;
    if (this.supabaseConfigured && navigator.onLine) {
      try {
        storageUrl = await this.uploadToSupabase(path, file);
        console.log('[FileUpload] Uploaded to Supabase:', storageUrl);
      } catch (uploadError) {
        console.warn('[FileUpload] Supabase upload failed, using local fallback:', uploadError);
      }
    }

    // Convert to base64 for local storage (always, as backup)
    let localUrl = null;
    try {
      localUrl = await this.fileToBase64(file);
    } catch (base64Error) {
      console.error('[FileUpload] Base64 conversion failed:', base64Error);
    }

    return {
      success: true,
      errors: [],
      storageUrl,
      localUrl,
      // Prefer Supabase URL if available, fallback to base64
      finalUrl: storageUrl || localUrl,
    };
  }

  /**
   * Delete document from Supabase Storage
   */
  async deleteDocument(path) {
    if (!this.supabaseConfigured || !navigator.onLine) {
      return { success: false, error: 'Offline or not configured' };
    }

    if (!window.supabaseClient?.client) {
      return { success: false, error: 'Supabase client not available' };
    }

    try {
      const { error } = await window.supabaseClient.client.storage
        .from(this.config.bucket)
        .remove([path]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('[FileUpload] Delete error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get document URL (prefers Supabase, falls back to local)
   */
  getDocumentUrl(url) {
    if (!url) return null;

    // If it's already a data URL (base64), return as-is
    if (url.startsWith('data:')) {
      return url;
    }

    // If it's a Supabase URL or external URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // If it's a path, try to get public URL
    if (this.supabaseConfigured && window.supabaseClient?.client) {
      try {
        const { data } = window.supabaseClient.client.storage
          .from(this.config.bucket)
          .getPublicUrl(url);
        return data.publicUrl;
      } catch (e) {
        console.warn('[FileUpload] Could not get public URL:', e);
      }
    }

    return url;
  }

  /**
   * Check if URL is a data URL (base64)
   */
  isBase64Url(url) {
    return url?.startsWith('data:') || false;
  }

  /**
   * Check if URL is a remote URL (Supabase/HTTP)
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
    const finalUrl = this.getDocumentUrl(url);
    if (!finalUrl) {
      window.showToast?.('Dokumen tidak tersedia', 'error');
      return;
    }

    if (finalUrl.startsWith('data:')) {
      // For base64, create blob and open
      const byteString = atob(finalUrl.split(',')[1]);
      const mimeType = finalUrl.match(/data:([^;]+);/)?.[1] || 'application/pdf';
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } else {
      window.open(finalUrl, '_blank');
    }
  }

  /**
   * Download document
   */
  downloadDocument(url, filename = 'document.pdf') {
    const finalUrl = this.getDocumentUrl(url);
    if (!finalUrl) {
      window.showToast?.('Dokumen tidak tersedia', 'error');
      return;
    }

    const link = document.createElement('a');
    link.href = finalUrl;
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

console.log('[FileUploadManager] Module loaded');
