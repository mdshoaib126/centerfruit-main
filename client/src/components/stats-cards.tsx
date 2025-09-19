import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsData {
  totalSubmissions: number;
  pendingCount: number;
  passRate: number;
  avgScore: number;
}

interface StatsCardsProps {
  stats?: StatsData;
  isLoading: boolean;
}

export default function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-4" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Submissions</p>
              <p className="text-2xl font-bold text-foreground" data-testid="stat-total-submissions">
                {stats?.totalSubmissions || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <i className="fas fa-microphone text-primary text-lg"></i>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-success font-medium">+12.5%</span>
            <span className="text-sm text-muted-foreground ml-2">from last week</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-bold text-foreground" data-testid="stat-pending-count">
                {stats?.pendingCount || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-clock text-yellow-600 text-lg"></i>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-yellow-600 font-medium">Needs attention</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pass Rate</p>
              <p className="text-2xl font-bold text-foreground" data-testid="stat-pass-rate">
                {stats?.passRate || 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <i className="fas fa-check text-success text-lg"></i>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-success font-medium">Good performance</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Score</p>
              <p className="text-2xl font-bold text-foreground" data-testid="stat-avg-score">
                {stats?.avgScore || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-star text-blue-600 text-lg"></i>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-success font-medium">+2.1 points</span>
            <span className="text-sm text-muted-foreground ml-2">this month</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
