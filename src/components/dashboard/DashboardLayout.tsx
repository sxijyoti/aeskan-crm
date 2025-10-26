import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";


interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

const DashboardLayout = ({ children, title }: DashboardLayoutProps) => {
  const { signOut, profile, isAdmin, loading } = useAuth();

    return (
      <div className="min-h-screen">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
          <aside className="flex flex-col justify-between h-screen bg-[#003A6B] text-white p-4 shadow-lg">
              <div>
                {loading ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-md" />
                      <div className="space-y-2">
                        <Skeleton className="w-28 h-4" />
                        <Skeleton className="w-20 h-3" />
                      </div>
                    </div>

                    <nav className="flex flex-col gap-3 pt-4">
                      <Skeleton className="w-full h-10" />
                      <Skeleton className="w-full h-10" />
                      <Skeleton className="w-full h-10" />
                      <Skeleton className="w-full h-10" />
                    </nav>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/10 rounded-md">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-white">Aeskan CRM</div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-blue-100/90">{profile?.full_name}</div>
                          {isAdmin && (
                            <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <nav className="flex flex-col gap-2 pt-6">
                      <Link to="/contacts">
                        <Button variant="ghost" className="justify-start text-white hover:bg-white/10 rounded-md px-3 py-2">Customer Contacts</Button>
                      </Link>
                      <Link to="/purchases">
                        <Button variant="ghost" className="justify-start text-white hover:bg-white/10 rounded-md px-3 py-2">Purchases</Button>
                      </Link>
                      {/* Record Purchase moved into Purchases page; link removed to avoid duplication */}
                      {isAdmin && (
                        <>
                          <Link to="/vouchers">
                            <Button variant="ghost" className="justify-start text-white hover:bg-white/10 rounded-md px-3 py-2">Voucher Rules</Button>
                          </Link>
                          <Link to="/company/users">
                            <Button variant="ghost" className="justify-start text-white hover:bg-white/10 rounded-md px-3 py-2">Company Users</Button>
                          </Link>
                        </>
                      )}
                      <Link to="/reports">
                        <Button variant="ghost" className="justify-start text-white hover:bg-white/10 rounded-md px-3 py-2">Reports</Button>
                      </Link>
                    </nav>
                  </>
                )}
              </div>

              <div>
                <Button variant="ghost" className="w-full border border-white text-white bg-transparent hover:bg-white/10" onClick={signOut}>
                  Sign Out
                </Button>
              </div>
            </aside>

            <main className="container mx-auto px-4 py-8">
              <div className="mb-6">
                <h2 className="text-3xl font-bold">{title}</h2>
              </div>

              {children}
            </main>
        </div>
      </div>
  );
};

export default DashboardLayout;
