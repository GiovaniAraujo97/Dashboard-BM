import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  inviteCode: string;
  role: 'owner' | 'member';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    const url = (window as any).SUPABASE_URL || (window as any)._env_?.SUPABASE_URL || '';
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

  async signUp(email: string, password: string, fullName?: string) {
    if (!this.supabase) throw new Error('Supabase não configurado (SUPABASE_ANON_KEY ausente)');
    return await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: (fullName || '').trim()
        }
      }
    }) as any;
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

  async getCurrentTenantContext(): Promise<TenantContext | null> {
    if (!this.supabase) return null;

    const session = await this.getSession();
    const userId = session?.user?.id;
    if (!userId) return null;

    const { data: membership, error: membershipError } = await this.supabase
      .from('user_tenants')
      .select('tenant_id, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      console.warn('Erro ao carregar vínculo do tenant:', membershipError.message || membershipError);
      return null;
    }

    if (!membership || !(membership as any).tenant_id) return null;

    const tenantId = (membership as any).tenant_id as string;
    const role = ((membership as any).role || 'member') as 'owner' | 'member';

    // Read tenant metadata in a second query. If RLS blocks this read,
    // still return tenantId so approved users are not blocked from login.
    const { data: tenant, error: tenantError } = await this.supabase
      .from('tenants')
      .select('id, name, invite_code')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError) {
      console.warn('Erro ao carregar dados da empresa:', tenantError.message || tenantError);
      return {
        tenantId,
        tenantName: 'Empresa',
        inviteCode: '',
        role
      };
    }

    return {
      tenantId,
      tenantName: (tenant as any)?.name || 'Empresa',
      inviteCode: (tenant as any)?.invite_code || '',
      role
    };
  }

  async syncCurrentProfileFromSession(): Promise<void> {
    if (!this.supabase) return;

    const session = await this.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const fullName = (session?.user?.user_metadata?.full_name || '').trim();
    if (!fullName) return;

    const { error } = await this.supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        full_name: fullName,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.warn('Erro ao sincronizar perfil:', error.message || error);
    }
  }

  async ensureTenantForCurrentUser(input?: { companyName?: string; inviteCode?: string }): Promise<TenantContext> {
    if (!this.supabase) throw new Error('Supabase não configurado (SUPABASE_ANON_KEY ausente)');

    const session = await this.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    const existing = await this.getCurrentTenantContext();
    if (existing) return existing;

    const normalizedInvite = this.normalizeInviteCode(input?.inviteCode || '');

    if (normalizedInvite) {
      const { data, error } = await this.supabase
        .rpc('join_tenant_by_invite', { p_invite_code: normalizedInvite });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Código da empresa inválido');

      return {
        tenantId: (row as any).tenant_id,
        tenantName: (row as any).tenant_name,
        inviteCode: (row as any).invite_code,
        role: ((row as any).role || 'member') as 'owner' | 'member'
      };
    }

    const tenantName = (input?.companyName || '').trim() || `Empresa ${new Date().toLocaleDateString('pt-BR')}`;
    const { data: created, error: createError } = await this.supabase
      .rpc('create_tenant_for_owner', { p_name: tenantName });

    if (createError) throw createError;

    const createdRow = Array.isArray(created) ? created[0] : created;
    if (!createdRow) throw new Error('Falha ao criar empresa');

    return {
      tenantId: (createdRow as any).tenant_id,
      tenantName: (createdRow as any).tenant_name,
      inviteCode: (createdRow as any).invite_code,
      role: ((createdRow as any).role || 'owner') as 'owner' | 'member'
    };
  }

  private normalizeInviteCode(code: string): string {
    return (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
}
