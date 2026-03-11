import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Settings, Shield } from "lucide-react";
import { toast } from "sonner";
import AttendanceCapture from "@/components/AttendanceCapture"; // updated
import AttendanceTable from "@/components/AttendanceTable";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { KeyrusLogo } from "@/components/KeyrusLogo";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return;
    }

    setProfile(data);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast.error("Error signing out");
      return;
    }

    toast.success("Logged out successfully");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Clock className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyrusLogo size="md" />
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Attendance</h1>
              <p className="text-xs text-muted-foreground">
                {profile?.full_name || user.email}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="h-8">
                <Shield className="w-3 h-3 mr-1.5" />
                Admin
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")} className="h-8">
              <Settings className="w-3 h-3 mr-1.5" />
              My Settings
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="h-8">
              <LogOut className="w-3 h-3 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 space-y-4">
        <AttendanceCapture userId={user.id} onAttendanceChange={() => setRefreshTrigger(prev => prev + 1)} />
        <AttendanceTable userId={user.id} refreshTrigger={refreshTrigger} />
      </main>
    </div>
  );
};

export default Dashboard;
