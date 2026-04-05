import { AuthProvider } from "@refinedev/core";
import { supabaseClient } from "./utils";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: {
          message: error.message,
          name: error.name,
        },
      };
    }

    return {
      success: true,
      redirectTo: "/",
    };
  },
  register: async ({ email, password, name }) => {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: name,
          shop_name: "My Shop",
        },
      },
    });

    if (error) {
      return {
        success: false,
        error: {
          message: error.message,
          name: error.name,
        },
      };
    }

    return {
      success: true,
      redirectTo: "/",
    };
  },
  logout: async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      return {
        success: false,
        error: {
          message: error.message,
          name: error.name,
        },
      };
    }
    return {
      success: true,
      redirectTo: "/login",
    };
  },
  check: async () => {
    const { data } = await supabaseClient.auth.getSession();
    const { session } = data;

    if (session) {
      return {
        authenticated: true,
      };
    }

    return {
      authenticated: false,
      error: {
        message: "Check failed",
        name: "Not authenticated",
      },
      logout: true,
      redirectTo: "/login",
    };
  },
  getPermissions: async () => {
    const user = await supabaseClient.auth.getUser();
    if (user) {
      return user.data.user?.role;
    }
    return null;
  },
  getIdentity: async () => {
    const { data } = await supabaseClient.auth.getUser();

    if (data?.user) {
      const { data: userData, error } = await supabaseClient
        .from("users")
        .select("first_name, last_name, email")
        .eq("id", data.user.id)
        .single();

      if (error) {
        return {
          id: data.user.id,
          name: data.user.user_metadata?.first_name || data.user.email,
          email: data.user.email,
        };
      }

      return {
        id: data.user.id,
        name: userData?.first_name 
          ? `${userData.first_name} ${userData.last_name || ""}`.trim()
          : data.user.user_metadata?.first_name || data.user.email,
        email: data.user.email,
      };
    }
    return null;
  },
  onError: async (error) => {
    console.error(error);
    return { error };
  },
};