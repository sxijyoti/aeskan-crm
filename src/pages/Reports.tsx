import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const Reports = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Reports</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics & Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Reporting and analytics features will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
