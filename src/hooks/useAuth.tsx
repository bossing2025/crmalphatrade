import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type AppRole = 'super_admin' | 'manager' | 'agent' | 'affiliate';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  username: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithUsername: (usernameOrEmail: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isManager: boolean;
  isAgent: boolean;
  isAffiliate: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (rolesError) throw rolesError;
      setRoles((rolesData?.map(r => r.role) || []) as AppRole[]);

      // Fetch username from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) throw profileError;
      setUsername(profile?.username || null);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setRoles([]);
      setUsername(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setRoles([]);
          setUsername(null);
        }
        setLoading(false);
      }
    );

    // THEN check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    toast.success("Signed in successfully");
    navigate("/dashboard");
  };

  const toSafeAuthError = (error: unknown) => {
    const message =
      typeof error === "object" && error && "message" in error
        ? String((error as any).message)
        : "";

    // Only surface actionable, non-sensitive auth errors.
    const allowlist = [
      "Email not confirmed",
      "Invalid login credentials",
      "Email rate limit exceeded",
      "Too many requests",
    ];

    const allowed = allowlist.find((m) => message.toLowerCase().includes(m.toLowerCase()));
    return new Error(allowed ?? "Invalid username or password");
  };

  const signInWithUsername = async (usernameOrEmail: string, password: string) => {
    const identifier = usernameOrEmail.trim();
    if (!identifier) throw new Error("Invalid username or password");

    // If user typed an email, skip the username lookup.
    if (identifier.includes("@")) {
      const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
      if (error) throw toSafeAuthError(error);
      toast.success("Signed in successfully");
      navigate("/dashboard");
      return;
    }

    // Look up email by username using security definer function (bypasses RLS for anon)
    const { data: email, error: lookupError } = await supabase
      .rpc("get_email_by_username", { lookup_username: identifier });

    if (lookupError || !email) {
      throw new Error("Invalid username or password");
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw toSafeAuthError(error);
    toast.success("Signed in successfully");
    navigate("/dashboard");
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    toast.success("Account created successfully");
    navigate("/dashboard");
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setRoles([]);
    setUsername(null);
    toast.success("Signed out successfully");
    navigate("/login");
  };

  const isSuperAdmin = roles.includes('super_admin');
  const isManager = roles.includes('manager');
  const isAgent = roles.includes('agent');
  const isAffiliate = roles.includes('affiliate');

  return (
    <AuthContext.Provider value={{
      user,
      session,
      roles,
      username,
      loading,
      signIn,
      signInWithUsername,
      signUp,
      signOut,
      isSuperAdmin,
      isManager,
      isAgent,
      isAffiliate,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}