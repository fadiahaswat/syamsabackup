/**
 * Supabase Client Initializer
 *
 * Menginisialisasi koneksi ke layanan Supabase cloud jika
 * url dan anon key telah dikonfigurasi di config.local.js.
 */

(function () {
  const url = window.APP_CREDENTIALS?.supabaseUrl;
  const key = window.APP_CREDENTIALS?.supabaseAnonKey;

  window.supabaseClient = null;
  window.isSupabaseEnabled = false;
  window.cloudSessionReady = false;
  window.canWriteBusinessData = function () {
    return Boolean(
      window.isSupabaseEnabled &&
      window.cloudSessionReady &&
      navigator.onLine
    );
  };

  if (url && key) {
    try {
      if (typeof window.createClient !== 'undefined') {
        // createClient di-expose oleh supabase-js CDN
        window.supabaseClient = window.createClient(url, key);
        window.isSupabaseEnabled = true;
        console.log('[Supabase] Client successfully initialized');
      } else if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        window.supabaseClient = window.supabase.createClient(url, key);
        window.isSupabaseEnabled = true;
        console.log('[Supabase] Client successfully initialized (alternate CDN namespace)');
      } else {
        console.warn('[Supabase] SDK library not found in window. Please check script load order.');
      }
    } catch (e) {
      console.error('[Supabase] Failed to initialize Supabase client:', e);
    }
  } else {
    console.error('[Supabase] Credentials not set. Business data is read-only.');
  }

  if (window.supabaseClient) {
    window.supabaseClient.auth.getSession().then(({ data }) => {
      window.cloudSessionReady = Boolean(data?.session?.user);
    });
    window.supabaseClient.auth.onAuthStateChange((_event, session) => {
      window.cloudSessionReady = Boolean(session?.user);
      window.dispatchEvent(new CustomEvent('cloud:auth-state', {
        detail: { isAuthenticated: window.cloudSessionReady }
      }));
    });
  }
})();
