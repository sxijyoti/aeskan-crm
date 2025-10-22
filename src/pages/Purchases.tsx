import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

const Purchases = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Purchases</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Purchase tracking and management features will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Purchases;
