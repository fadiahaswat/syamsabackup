// File: auth-manager.js

// ==========================================
// MULTIDEVICE & MULTIROLE INTEGRATION
// ==========================================

// Service account credentials for Wali cloud operations
// Admin sets these in config.local.js
const WALI_SERVICE_EMAIL = window.WALI_SERVICE_EMAIL || 'wali-service@syamsa.app';
const WALI_SERVICE_PASSWORD = window.WALI_SERVICE_PASSWORD || null; // Set by admin

/**
 * Sync NIS from MASTER_SANTRI to Supabase wali_credentials table
 * This runs when Wali user logs in successfully
 */
window.syncWaliCredentialsToCloud = async function(nis, studentName, studentClass) {
  if (!window.isSupabaseEnabled || !window.supabaseClient) {
    console.log('[WaliSync] Supabase not enabled, skipping NIS sync');
    return;
  }

  // Check if service account is logged in
  const { data: sessionData } = await window.supabaseClient.auth.getSession();
  if (!sessionData?.session?.user) {
    console.log('[WaliSync] No active session, skipping NIS sync');
    return;
  }

  // Check if current user is service account
  const currentEmail = sessionData.session.user.email;
  if (currentEmail !== WALI_SERVICE_EMAIL) {
    console.log('[WaliSync] Not service account user, skipping NIS sync');
    return;
  }

  try {
    console.log('[WaliSync] Syncing Wali credentials to cloud...');

    // Prepare record
    const record = {
      nis: nis,
      nama: studentName || '',
      kelas: studentClass || '',
      // Password hash - empty for now, will be set when wali changes password
      password_hash: '',
      is_active: true,
    };

    // Upsert to Supabase
    const { data, error } = await window.supabaseClient
      .from('wali_credentials')
      .upsert(record, { onConflict: 'nis' })
      .select();

    if (error) {
      console.error('[WaliSync] Failed to sync Wali credentials:', error);
      return { success: false, error };
    }

    console.log('[WaliSync] Successfully synced Wali credentials:', nis);
    return { success: true };

  } catch (e) {
    console.error('[WaliSync] Error syncing Wali credentials:', e);
    return { success: false, error: e };
  }
};

/**
 * Sign in as Wali service account
 * Called when Wali user logs in with NIS
 */
window.signInAsWaliService = async function() {
  if (!window.isSupabaseEnabled || !window.supabaseClient) {
    console.warn('[WaliAuth] Cloud not enabled, skipping service account login');
    return { success: false, reason: 'cloud_disabled' };
  }

  // Get service account credentials from config (set by admin)
  const serviceEmail = WALI_SERVICE_EMAIL;
  const servicePassword = WALI_SERVICE_PASSWORD;

  if (!servicePassword) {
    console.warn('[WaliAuth] Service account password not configured. Add WALI_SERVICE_PASSWORD to config.local.js');
    return { success: false, reason: 'service_not_configured' };
  }

  try {
    console.log('[WaliAuth] Signing in as Wali service account...');

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: serviceEmail,
      password: servicePassword,
    });

    if (error) {
      console.error('[WaliAuth] Service account login failed:', error);
      return { success: false, error };
    }

    // Set cloud session ready
    window.cloudSessionReady = true;
    window.dispatchEvent(new CustomEvent('cloud:auth-state', {
      detail: { isAuthenticated: true }
    }));

    console.log('[WaliAuth] Service account logged in successfully');

    return { success: true, session: data.session };

  } catch (e) {
    console.error('[WaliAuth] Service account error:', e);
    return { success: false, error: e };
  }
};

/**
 * Change Wali password
 * Called when Wali wants to change their password
 *
 * SECURITY FIX: Passwords are now stored in Supabase ONLY.
 * No password hashes are stored in localStorage to prevent credential theft.
 */
window.changeWaliPassword = async function(nis, oldPassword, newPassword) {
  if (!window.isSupabaseEnabled || !window.supabaseClient) {
    return { success: false, error: 'Cloud not enabled' };
  }

  try {
    // SECURITY: Use cloud-only authentication
    // Verify old password first via Supabase Edge Function
    const verifyResult = await window.supabaseClient.functions.invoke('wali-auth', {
      body: { nis, password: oldPassword }
    });

    if (!verifyResult?.data?.success) {
      return { success: false, error: 'Password lama salah' };
    }

    // Hash new password for cloud storage
    const newHash = await window.sha256Hex(newPassword);

    // Update in cloud ONLY - no localStorage
    const { data, error } = await window.supabaseClient
      .from('wali_credentials')
      .upsert({
        nis: nis,
        password_hash: newHash,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('[WaliAuth] Failed to change password:', error);
      return { success: false, error };
    }

    // SECURITY FIX: Removed localStorage password hash storage
    // Passwords should only be verified via cloud (Supabase Edge Function)

    console.log('[WaliAuth] Password changed successfully via cloud');
    return { success: true };

  } catch (e) {
    console.error('[WaliAuth] Error changing password:', e);
    return { success: false, error: e };
  }
};

/**
 * Sync permit request to cloud
 * Called when Wali submits a permit request
 */
window.syncWaliPermitToCloud = async function(permitData) {
  if (!window.isSupabaseEnabled || !window.supabaseClient) {
    console.warn('[WaliSync] Cloud not enabled, skipping permit sync');
    return { success: false, reason: 'cloud_disabled' };
  }

  // Check if service account is logged in
  const { data: sessionData } = await window.supabaseClient.auth.getSession();
  if (!sessionData?.session?.user) {
    console.warn('[WaliSync] No active session, skipping permit sync');
    return { success: false, reason: 'no_session' };
  }

  // Transform to Supabase format
  const cloudPermit = {
    id: permitData.id,
    nis: permitData.nis,
    kelas: permitData.kelas,
    category: permitData.category || 'pulang',
    reason: permitData.reason,
    start_date: permitData.start_date,
    end_date: permitData.end_date || permitData.start_date,
    start_session: permitData.start_session || 'sekolah',
    end_session: permitData.end_session || 'isya',
    status: 'pending',
    is_active: true,
    document: null,
    audit_trail: permitData.audit_trail || [],
    _version: 1,
    metadata: {
      nama_santri: permitData.nama,
      nama_wali: permitData.nama_wali,
      alamat_wali: permitData.alamat_wali,
      destination: permitData.destination,
      requested_by: 'wali',
    }
  };

  try {
    console.log('[WaliSync] Syncing permit to cloud:', cloudPermit.id);

    const { data, error } = await window.supabaseClient
      .from('permits')
      .upsert(cloudPermit, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[WaliSync] Failed to sync permit:', error);
      return { success: false, error };
    }

    console.log('[WaliSync] Permit synced to cloud successfully:', data.id);
    return { success: true, data };

  } catch (e) {
    console.error('[WaliSync] Error syncing permit:', e);
    return { success: false, error: e };
  }
};

/**
 * Initialize multirole auth after successful login
 * @param {Object} profile - Google profile object
 * @param {string} targetClass - Selected class
 */
window.ensureSupabaseGoogleSession = async function(idToken) {
  console.log('[Auth] ensureSupabaseGoogleSession called, isSupabaseEnabled:', window.isSupabaseEnabled);

  if (!window.isSupabaseEnabled || !window.supabaseClient) {
    throw new Error('Cloud database is not configured');
  }
  if (!idToken) throw new Error('Google ID token is required');

  console.log('[Auth] Attempting Supabase signInWithIdToken...');
  const { data, error } = await window.supabaseClient.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  console.log('[Auth] Supabase signInWithIdToken result:', { error, hasData: !!data, hasSession: !!data?.session });

  if (error || !data?.session?.user) {
    console.error('[Auth] Supabase session creation failed:', error);
    throw error || new Error('Supabase session was not created');
  }

  console.log('[Auth] Supabase session created successfully:', data.session.user.email);

  // FIX: Set cloudSessionReady synchronously to prevent race condition
  // where Journal write fails because canWriteBusinessData() returns false
  // even though user just logged in successfully
  window.cloudSessionReady = true;
  window.dispatchEvent(new CustomEvent('cloud:auth-state', {
    detail: { isAuthenticated: true }
  }));

  return data.session;
};

/**
 * Auto-assign role based on Google Sheet data
 * @param {string} userEmail - User email from Google
 * @param {string} targetClass - Target class from login
 * @returns {Object|null} - { roleId, roleName, kelas } or null
 */
window.getCloudRoleFromSheet = function(userEmail, targetClass) {
  if (!userEmail || !targetClass) return null;

  const email = userEmail.toLowerCase().trim();
  const data = window.classData || window.MASTER_KELAS || {};

  // Special roles based on class name
  if (targetClass === 'Admin Musyrif') {
    return { roleId: 'role_admin', roleName: 'admin', kelas: null }; // Global access
  }
  if (targetClass === 'Koordinator Musyrif') {
    return { roleId: 'role_koordinator', roleName: 'koordinator', kelas: targetClass };
  }

  // Check if email exists in class data
  for (const [className, classInfo] of Object.entries(data)) {
    if (!className || className === 'Admin Musyrif' || className === 'Koordinator Musyrif') continue;

    const classEmails = String(classInfo.email || "")
      .split(/[;,]/)
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (classEmails.includes(email)) {
      return { roleId: 'role_musyrif', roleName: 'musyrif', kelas: className };
    }
  }

  return null;
};

window.initMultiRoleAuth = async function(profile, targetClass) {
  if (!window.authMultiRole || !window.supabaseClient) return;

  try {
    // Initialize authMultiRole with Supabase client
    await window.authMultiRole.init(window.supabaseClient);

    // Get or create user
    const user = await window.authMultiRole.getOrCreateUser(profile);
    console.log('[AuthMultiRole] User synced:', user?.email);

    // Get user roles
    let roles = await window.authMultiRole.getUserRoles();
    console.log('[AuthMultiRole] User roles:', roles);

    // Check if user has valid cloud role for target class
    const requestedAdmin = ['admin musyrif', 'koordinator musyrif'].includes(String(targetClass || '').toLowerCase());
    let hasCloudRole = roles.length > 0 && roles.some(item => {
      const roleName = item.roles?.name;
      if (['superadmin', 'admin'].includes(roleName)) return true;
      if (requestedAdmin) return roleName === 'koordinator';
      return ['koordinator', 'musyrif', 'ustadz'].includes(roleName) && (!item.kelas || item.kelas === targetClass);
    });

    // Auto-assign role based on Google Sheet data (if no cloud role found)
    if (!hasCloudRole && targetClass) {
      const userEmail = profile?.email || '';
      const roleInfo = window.getCloudRoleFromSheet(userEmail, targetClass);

      if (roleInfo) {
        console.log(`[AuthMultiRole] Auto-assigning ${roleInfo.roleName} role for ${targetClass}...`);

        // Upsert role assignment
        const { data: newRole, error: roleError } = await window.supabaseClient
          .from('user_roles')
          .upsert({
            id: `ur_${user?.id}_${targetClass}`.replace(/[^a-zA-Z0-9_]/g, '_'),
            user_id: user?.id,
            role_id: roleInfo.roleId,
            kelas: roleInfo.kelas,
            assigned_at: new Date().toISOString(),
            is_active: true,
          }, { onConflict: 'user_id,role_id,kelas' })
          .select()
          .single();

        if (!roleError && newRole) {
          console.log(`[AuthMultiRole] Successfully assigned ${roleInfo.roleName} role for kelas ${targetClass}`);

          // Refresh roles
          roles = await window.authMultiRole.getUserRoles();
          console.log('[AuthMultiRole] Updated roles:', roles);
          hasCloudRole = true;
        } else if (roleError) {
          console.warn('[AuthMultiRole] Failed to auto-assign role:', roleError);
        }
      } else {
        console.log(`[AuthMultiRole] Email ${userEmail} not found in Google Sheet data for class ${targetClass}`);
      }
    }

    // Final check - if still no role, allow local login
    if (!hasCloudRole) {
      console.warn('[AuthMultiRole] No cloud role found. Allowing local login without cloud sync.');
      sessionStorage.setItem('multirole_user_id', user?.id || '');
      sessionStorage.setItem('multirole_roles', JSON.stringify([]));
      sessionStorage.setItem('multirole_cloud_disabled', 'true');
      return { user, roles: [], cloudEnabled: false };
    }

    // User has valid cloud role - proceed with full cloud sync

    // Register current device
    await window.authMultiRole.registerDevice();
    console.log('[AuthMultiRole] Device registered');

    // Create session
    await window.authMultiRole.createSession();

    // Log activity
    await window.authMultiRole.logActivity('login', `Login sebagai ${targetClass}`, {
      kelas: targetClass,
      metadata: { email: profile?.email }
    });

    // Store session data
    sessionStorage.setItem('multirole_user_id', user?.id || '');
    sessionStorage.setItem('multirole_roles', JSON.stringify(roles));
    sessionStorage.removeItem('multirole_cloud_disabled');

    await window.cloudDomainStore?.init(window.supabaseClient, user?.id);

    return { user, roles, cloudEnabled: true };

  } catch (error) {
    console.error('[AuthMultiRole] Initialization failed:', error);
    throw error;
  }
};

/**
 * Get current user roles from multirole system
 */
window.getMultiRoleUser = function() {
  const userId = sessionStorage.getItem('multirole_user_id');
  const rolesJson = sessionStorage.getItem('multirole_roles');
  const roles = rolesJson ? JSON.parse(rolesJson) : [];
  return { userId, roles };
};

/**
 * Check if user has specific role
 */
window.hasMultiRole = function(roleName, kelas = null) {
  const { roles } = window.getMultiRoleUser();
  return roles.some(r => {
    if (r.roles?.name !== roleName) return false;
    if (kelas && r.kelas && r.kelas !== kelas) return false;
    return true;
  });
};

/**
 * Check if user is admin (any level)
 */
window.isMultiRoleAdmin = function() {
  return window.hasMultiRole('superadmin') ||
         window.hasMultiRole('admin') ||
         window.hasMultiRole('koordinator');
};

// ==========================================
// 2. LOGIN LOGIC
// ==========================================

// ==========================================
// PWA UPDATE CHECKER
// ==========================================
window.checkForPWAUpdate = async function() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;

    // Check if there's a waiting Service Worker
    if (registration.waiting) {
      console.log('[PWA Update] New version waiting');
      window.showToast('Update tersedia! Refresh untuk memperbarui.', 'info');

      // Auto-update after 3 seconds
      setTimeout(() => {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }, 3000);
      return;
    }

    // Check for updates
    await registration.update();
    console.log('[PWA Update] Checked for updates');
  } catch (error) {
    console.warn('[PWA Update] Check failed:', error);
  }
};

// Force update Service Worker
window.forceSWUpdate = async function() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    } else {
      await registration?.update();
      window.showToast('Service Worker diperbarui', 'success');
    }
  } catch (error) {
    console.error('[SW Update] Failed:', error);
  }
};

// ==========================================
// AUTH MODE HELPERS
// ==========================================

window.getAuthMode = function () {
  return "production";
};

window.getProfileDisplayName = function (profile) {
  if (!profile) return "Musyrif";
  return profile.given_name || profile.name || "Musyrif";
};

window.applyLoginModeUI = function () {
  const testingFields = document.getElementById("testing-credentials");
  const modeBadge = document.getElementById("login-mode-badge");
  const submitText = document.getElementById("login-submit-text");

  if (testingFields) testingFields.classList.add("hidden");
  if (modeBadge) modeBadge.classList.add("hidden");
  if (submitText) {
    submitText.textContent = "Masuk Dashboard";
  }
};

window.toggleLoginMode = function () {
  // Mode testing dihapus secara permanen
};

window.handleDevTap = function () {
  // Fitur dev tap dinonaktifkan
};

window.startAuthenticatedSession = async function (targetClass, profile) {
  // Check if admin (Admin Musyrif OR Koordinator Musyrif)
  const isAdminMusyrif = targetClass?.toLowerCase() === "admin musyrif";
  const isKoordinatorMusyrif = targetClass?.toLowerCase() === "koordinator musyrif";
  const isAdmin = isAdminMusyrif || isKoordinatorMusyrif;

  const authData = {
    kelas: targetClass,
    profile: profile,
    timestamp: new Date().toISOString(),
    isAdmin: isAdmin
  };

  appState.adminMode = isAdmin;
  appState.selectedClass = targetClass;
  appState.userProfile = profile;

  // Cache musyrif email untuk notifikasi dari Wali
  // Ini penting agar notifikasi bisa dikirim meskipun MASTER_KELAS belum loaded
  if (!isAdmin && profile?.email) {
    const kelasKey = String(targetClass).replace(/\s+/g, "").toLowerCase();
    window.AppStorage?.setItem(`musyrif_email_${kelasKey}`, String(profile.email).trim().toLowerCase());
    const _isDebugMode = localStorage.getItem("DEBUG_LOGS") === "true" || location.search.includes("debug=true");
    if (_isDebugMode) console.debug('[AuthManager] Musyrif email cached for class:', kelasKey);
  }

  if (isAdmin) {
    // Admin Musyrif - tampilkan semua student untuk monitoring
    appState.waliMode = false;
    appState.waliSantri = null;
    appState.waliKelas = null;
    authData.isAdmin = true;
    authData.adminRole = isKoordinatorMusyrif ? 'koordinator' : 'admin';
    FILTERED_SANTRI = [...MASTER_SANTRI].sort((a, b) => a.nama.localeCompare(b.nama));
  } else {
    appState.waliMode = (profile?.authProvider === "wali");
    if (!appState.waliMode) {
      appState.waliSantri = null;
      appState.waliKelas = null;

      // Cek apakah musyrif memegang beberapa kelas (berdasarkan email)
      const musyrifEmail = profile?.email?.toLowerCase().trim();
      const allClasses = Object.keys(MASTER_KELAS || {});

      // Cari semua kelas yang email musyrifnya sama
      const assignedClasses = musyrifEmail
        ? allClasses.filter(kelas => {
            const kelasInfo = MASTER_KELAS[kelas];
            return kelasInfo?.email?.toLowerCase().trim() === musyrifEmail;
          })
        : [];

      // Simpan daftar kelas yang ditangani musyrif
      appState.assignedClasses = assignedClasses;

      if (assignedClasses.length > 1) {
        // Musyrif memegang >1 kelas - tampilkan student dari semua kelasnya
        FILTERED_SANTRI = MASTER_SANTRI.filter((s) => {
          const sKelas = String(s.kelas || s.rombel || "").trim();
          return assignedClasses.includes(sKelas);
        }).sort((a, b) => a.nama.localeCompare(b.nama));
      } else {
        // Normal: tampilkan student dari kelas yang dipilih saja
        FILTERED_SANTRI = MASTER_SANTRI.filter((s) => {
          const sKelas = String(s.kelas || s.rombel || "").trim();
          return sKelas === targetClass;
        }).sort((a, b) => a.nama.localeCompare(b.nama));
      }
    }
  }

  // Establish role authorization and hydrate cloud data before the protected
  // application view becomes visible.
  if (profile?.authProvider !== 'wali') {
    await window.initMultiRoleAuth(profile, targetClass);
  }
  await window.initStorage?.(profile?.id || `class_${targetClass}`);
  window.AppStorage?.setJson(APP_CONFIG.googleAuthKey, authData);

  // ========== PWA UPDATE CHECK ==========
  // Skip PWA update check untuk bypass mode (supaya langsung masuk tanpa reload)
  if (!profile?.bypassMode) {
    window.checkForPWAUpdate();
  }

  // Show main view and switch to dashboard tab
  document.getElementById("view-login")?.classList.add("hidden");
  document.getElementById("view-main")?.classList.remove("hidden");
  document.getElementById("view-wali")?.classList.add("hidden");

  window.syncRoleModeUI();
  window.switchTab("home");
  window.updateDashboard();
  window.updateProfileInfo();
};

window.handleLogin = async function () {
  const kelas = document.getElementById("login-kelas").value;

  if (!kelas) {
    window.showToast("Pilih kelas dulu!", "warning");
    return;
  }

  if (!MASTER_KELAS[kelas]) {
    return window.showToast("Kelas tidak valid.", "error");
  }

  // Mode Production: Wajib Google OAuth
  appState.tempClass = kelas;

  const modal = document.getElementById("modal-google-auth");
  const classLbl = document.getElementById("lbl-google-class");
  if (classLbl) classLbl.textContent = kelas;

  if (modal) {
    window.openModal("modal-google-auth");

    // Render tombol login Google
    if (window.google) {
      google.accounts.id.initialize({
        client_id: window.APP_CREDENTIALS.googleClientId,
        callback: window.handleGoogleCallback,
      });
      google.accounts.id.renderButton(
        document.getElementById("google-btn-container"),
        { theme: "outline", size: "large", type: "standard" }
      );
    } else {
      window.showToast("Gagal memuat API Google. Pastikan Anda terhubung ke internet.", "error");
    }
  }
};

window.handleGoogleCallback = async function (response) {
  try {
    const profile = window.parseJwt(response.credential);
    // Debug only - remove in production
    const _isDebugMode = localStorage.getItem("DEBUG_LOGS") === "true" || location.search.includes("debug=true");
    if (_isDebugMode) console.debug('[AuthManager] Google callback received for:', profile.email);
    const userEmail = profile.email;
    if (!userEmail) {
      return window.showToast("Google tidak mengirim alamat email.", "error");
    }

    const normalizedUserEmail = String(userEmail || "")
      .trim()
      .toLowerCase();

    // Establish a real authenticated Supabase session. A decoded Google JWT
    // alone is never used as database authorization.
    await window.ensureSupabaseGoogleSession(response.credential);

    // Check if we are in Google bypass mode (testing)
    if (window.googleBypassActive) {
      const targetClass = appState.tempClass;
      localStorage.removeItem('app_session_id');
      await window.startAuthenticatedSession(targetClass, profile);
      window.closeModal("modal-google-auth");
      window.showToast("Login Berhasil!", "success");
      return;
    }

    // Get allowed classes for this email
    const allowedClasses = window.getUserAllowedClassesForEmail(normalizedUserEmail);

    if (allowedClasses.length === 0) {
      return window.showToast(
        "AKSES DITOLAK! Email Anda tidak terdaftar untuk kelas mana pun.",
        "error",
      );
    }

    if (allowedClasses.length === 1) {
      const targetClass = allowedClasses[0];
      localStorage.removeItem('app_session_id');
      await window.startAuthenticatedSession(targetClass, profile);
      window.closeModal("modal-google-auth");
      window.showToast("Login Berhasil!", "success");
    } else {
      // Terdaftar di lebih dari satu kelas, tampilkan list pemilihan
      window.tempGoogleProfile = profile;
      window.tempGoogleResponseCredential = response.credential;
      window.showLoginClassSelection(allowedClasses);
    }
  } catch (e) {
    console.error(e);
    window.showToast("Gagal memproses login Google.", "error");
  }
};

window.handleLogout = async function () {
  window.showConfirmModal(
    "Keluar dari Akun?",
    "Sesi saat ini akan ditutup dan Anda kembali ke layar login.",
    "Keluar",
    "Batal",
    async () => {
      try {
        await window.supabaseClient?.auth?.signOut();
        // Reset cloud session state on logout
        window.cloudSessionReady = false;
        window.authMultiRole?.clearLocalSession?.();
        if (clockInterval) {
          clearInterval(clockInterval);
          clockInterval = null;
        }

        window.AppStorage?.removeItem(APP_CONFIG.googleAuthKey);
        appState.selectedClass = null;
        appState.waliMode = false;
        appState.waliSantri = null;
        appState.waliKelas = null;

        // Hide all views and show login
        document.getElementById("view-main")?.classList.add("hidden");
        document.getElementById("view-wali")?.classList.add("hidden");
        document.getElementById("view-login")?.classList.remove("hidden");

        // Clear login fields
        const loginKelasEl = document.getElementById("login-kelas");
        const userEl = document.getElementById("login-username");
        const passEl = document.getElementById("login-password");
        if (loginKelasEl) loginKelasEl.value = "";
        if (userEl) userEl.value = "";
        if (passEl) passEl.value = "";
      } catch (error) {
        console.error('[Auth] Logout error:', error);
      } finally {
        // Always reload to ensure clean state
        location.reload();
      }
    },
  );
};

window.handleForcedLogout = async function () {
  await window.supabaseClient?.auth?.signOut();
  // FIX: Reset cloud session state on forced logout
  window.cloudSessionReady = false;
  window.authMultiRole?.clearLocalSession?.();
  localStorage.removeItem(APP_CONFIG.googleAuthKey);
  window.showToast?.('Sesi dicabut dari perangkat lain. Silakan masuk kembali.', 'warning');
  setTimeout(() => window.location.reload(), 800);
};
