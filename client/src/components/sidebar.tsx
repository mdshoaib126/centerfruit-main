import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";

export default function Sidebar() {
  const { logoutMutation } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border">
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-trophy text-lg text-primary-foreground"></i>
            </div>
            <div>
              <h2 className="font-bold text-foreground" data-testid="text-app-name">Centerfruit</h2>
              <p className="text-sm text-muted-foreground">Contest Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <Link href="/">
                <a className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                  location === "/" 
                    ? "bg-primary text-primary-foreground font-medium" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`} data-testid="link-dashboard">
                  <i className="fas fa-chart-bar w-5 h-5"></i>
                  <span>Dashboard</span>
                </a>
              </Link>
            </li>
            <li>
              <Link href="/">
                <a className="flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors" data-testid="link-submissions">
                  <i className="fas fa-microphone w-5 h-5"></i>
                  <span>Submissions</span>
                </a>
              </Link>
            </li>
            <li>
              <Link href="/">
                <a className="flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors" data-testid="link-participants">
                  <i className="fas fa-users w-5 h-5"></i>
                  <span>Participants</span>
                </a>
              </Link>
            </li>
            <li>
              <Link href="/">
                <a className="flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors" data-testid="link-settings">
                  <i className="fas fa-cog w-5 h-5"></i>
                  <span>Settings</span>
                </a>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-border">
          <button 
            className="flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors w-full text-left"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <i className="fas fa-sign-out-alt w-5 h-5"></i>
            <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
