import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-2xl px-4">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center">
            <Building2 className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>
        
        <h1 className="text-5xl font-bold tracking-tight">
          Welcome to Aeskan CRM
        </h1>
        
        <p className="text-xl text-muted-foreground">
          A modern, professional Customer Relationship Management system designed to help you manage your contacts and grow your business.
        </p>
        
        <div className="flex gap-4 justify-center pt-4">
          <Button size="lg" onClick={() => navigate("/auth")}>
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
