import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, BarChart3, Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Aeskan CRM
          </h1>
          <p className="text-2xl text-muted-foreground">
            Professional Customer Relationship Management Platform
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Manage your contacts, track purchases, and gain insights with our powerful CRM solution.
          </p>
          
          <div className="flex gap-4 justify-center pt-8">
            <Button size="lg" onClick={() => navigate("/auth")} className="group">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 pt-16">
            <div className="p-6 rounded-lg bg-card shadow-md hover:shadow-lg transition-shadow">
              <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Contact Management</h3>
              <p className="text-muted-foreground">
                Organize and manage all your contacts in one place with full CRUD capabilities.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-card shadow-md hover:shadow-lg transition-shadow">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Analytics & Reports</h3>
              <p className="text-muted-foreground">
                Track performance and gain insights with comprehensive reporting tools.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-card shadow-md hover:shadow-lg transition-shadow">
              <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Secure & Role-Based</h3>
              <p className="text-muted-foreground">
                Enterprise-grade security with role-based access control for your team.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
