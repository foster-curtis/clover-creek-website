"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let client: SupabaseClient | null = null;

export function hasSupabaseClient(): boolean {
  return getSupabaseEnv() !== null;
}

export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    const env = getSupabaseEnv();
    if (!env) throw new Error("supabaseBrowser() called without checking hasSupabaseClient() first");
    client = createBrowserClient(env.url, env.anonKey);
  }
  return client;
}
