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

    if (!key) {
      console.warn('SUPABASE_ANON_KEY não definido — funcionando em modo local (sem sincronização).');
      this.supabase = null;
    } else {
      this.supabase = createClient(url, key);
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
