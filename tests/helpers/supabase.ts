import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const testUrl = process.env.TEST_SUPABASE_URL;
const testServiceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const testAnonKey = process.env.TEST_SUPABASE_ANON_KEY;

export const getTestAdmin = () => {
  if (!testUrl || !testServiceKey) {
    throw new Error(
      "TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY must be set for integration tests.",
    );
  }
  return createClient<Database>(testUrl, testServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export const getTestAnonClient = () => {
  if (!testUrl || !testAnonKey) {
    throw new Error(
      "TEST_SUPABASE_URL and TEST_SUPABASE_ANON_KEY must be set for integration tests.",
    );
  }
  return createClient<Database>(testUrl, testAnonKey);
};

export const createTestUser = async (email: string, password: string) => {
  const admin = getTestAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  return data.user;
};

export const deleteTestUser = async (userId: string) => {
  const admin = getTestAdmin();
  await admin.auth.admin.deleteUser(userId);
};

export const signInTestUser = async (email: string, password: string) => {
  const client = getTestAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Failed to sign in test user: ${error.message}`);
  return data;
};

export const cleanupTestTenants = async (slugPrefix: string) => {
  const admin = getTestAdmin();
  await admin.from("tenants").delete().like("slug", `${slugPrefix}%`);
};
