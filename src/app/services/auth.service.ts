import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    const url = (window as any).SUPABASE_URL || (window as any)._env_?.SUPABASE_URL || 'https://pjdvovmfrcvcddqgbdps.supabase.co';
    const key = (window as any).SUPABASE_ANON_KEY || (window as any)._env_?.SUPABASE_ANON_KEY || '';

    // Treat only clearly invalid/placeholder keys as missing. Real publishable
    // keys start with `sb_publishable_...` and should be accepted. We consider
    // the key invalid when it's empty, very short, or contains obvious
    // placeholder markers like 'YOUR_REAL_KEY'.
    const isMissingOrPlaceholder = !key || key.trim().length < 20 || key.includes('YOUR_REAL_KEY') || key.includes('XYOUR_REAL_KEYX');

    // Basic validation for URL to avoid unhandled exceptions from Supabase client
    let urlLooksValid = true;
    try {
      // Use the URL constructor to validate structure and disallow angle brackets
      const u = new URL(url);
      urlLooksValid = (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname && !url.includes('<') && !url.includes('>');
    } catch (err) {
      urlLooksValid = false;
    }

    if (!urlLooksValid) {
      console.warn('SUPABASE_URL ausente ou inválida — o Supabase client não será inicializado.');
      this.supabase = null;
    } else if (isMissingOrPlaceholder) {
      console.warn('SUPABASE_ANON_KEY ausente ou inválida — o Supabase client não será inicializado.');
      this.supabase = null;
    } else {
      // Use a simple custom storage wrapper that uses localStorage but exposes
      // async methods. This avoids the Supabase SDK attempting to acquire a
      // Navigator LockManager lock in some environments which can timeout and
      // cause `NavigatorLockAcquireTimeoutError`.
      const localAsyncStorage = {
        getItem: async (k: string) => {
          try { return localStorage.getItem(k); } catch { return null; }
        },
        setItem: async (k: string, v: string) => {
          try { localStorage.setItem(k, v); } catch { /* ignore */ }
        },
        removeItem: async (k: string) => {
          try { localStorage.removeItem(k); } catch { /* ignore */ }
        }
      } as any;

      this.supabase = createClient(url, key, {
        auth: {
          storage: localAsyncStorage,
          detectSessionInUrl: false
        }
      });
      // Log only the presence and partial key for safety
      const keyPreview = key ? (key.length > 8 ? key.substring(0, 8) + '...' : 'present') : 'absent';
      console.debug('AuthService: Supabase client inicializado', { url, keyPreview });
    }
  }

  getClient(): SupabaseClient | null {
    return this.supabase;
  }

  async signUp(email: string, password: string) {
    if (!this.supabase) throw new Error('Supabase não configurado (SUPABASE_ANON_KEY ausente)');
    return await this.supabase.auth.signUp({ email, password }) as any;
  }

  async signIn(email: string, password: string) {
    if (!this.supabase) throw new Error('Supabase não configurado (SUPABASE_ANON_KEY ausente)');
    return await this.supabase.auth.signInWithPassword({ email, password }) as any;
  }

  async signOut() {
    if (!this.supabase) return;
    return await this.supabase.auth.signOut();
  }

  // returns the session object (or null) for compatibility with callers
  async getSession(): Promise<any> {
    if (!this.supabase) return null;
    const result = await this.supabase.auth.getSession();
    return result?.data?.session ?? null;
  }

  // subscribe to auth state changes; returns the underlying subscription object
  onAuthStateChange(cb: (event: string, session: any) => void) {
    if (!this.supabase) return { subscription: null } as any;
    const { data } = this.supabase.auth.onAuthStateChange((event, session) => cb(event, session));
    return data;
  }
}
