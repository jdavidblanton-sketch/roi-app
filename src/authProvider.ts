import { AuthProvider } from "@refinedev/core";
import { supabaseClient } from "./utils";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    return {
      success: true,
      redirectTo: "/",
    };
  },
  register: async ({ email, password, name }) => {
    return {
      success: true,
      redirectTo: "/",
    };
  },
  logout: async () => {
    return {
      success: true,
      redirectTo: "/login",
    };
  },
  check: async () => {
    // TEMPORARY: Always return authenticated
    return {
      authenticated: true,
    };
  },
  getPermissions: async () => {
    return null;
  },
  getIdentity: async () => {
    // Return a mock user with an ID
    return {
      id: "mock-user-id-123",
      name: "Test User",
      email: "test@example.com",
    };
  },
  onError: async (error) => {
    console.error(error);
    return { error };
  },
};