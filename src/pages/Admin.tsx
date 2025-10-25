import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Admin = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Admin Dashboard</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Admin features and controls will be implemented here. Admins can view all contacts and manage users.
          </p>
          <div className="mt-4">
            <Button onClick={() => navigate('/admin/voucher-rules')}>Voucher Rules</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;
