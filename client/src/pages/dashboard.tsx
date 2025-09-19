import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import StatsCards from "@/components/stats-cards";
import FilterControls from "@/components/filter-controls";
import SubmissionsTable from "@/components/submissions-table";
import AudioPlayerModal from "@/components/audio-player-modal";
import SubmissionDetailsModal from "@/components/submission-details-modal";
import { useAuth } from "@/hooks/use-auth";
import type { Submission } from "@shared/schema";

interface DashboardFilters {
  status?: string;
  fromDate?: string;
  toDate?: string;
  searchPhone?: string;
  limit?: number;
  offset?: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>({
    limit: 10,
    offset: 0,
  });
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const { data: submissionsData, isLoading: isLoadingSubmissions } = useQuery({
    queryKey: ["/api/submissions", filters],
    enabled: !!user,
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/stats"],
    enabled: !!user,
  });

  const handleFilterChange = (newFilters: DashboardFilters) => {
    setFilters({ ...newFilters, offset: 0 });
  };

  const handlePlayRecording = (submission: Submission) => {
    setSelectedSubmission(submission);
    setIsAudioModalOpen(true);
  };

  const handleViewDetails = (submission: Submission) => {
    setSelectedSubmission(submission);
    setIsDetailsModalOpen(true);
  };

  const handlePageChange = (newOffset: number) => {
    setFilters(prev => ({ ...prev, offset: newOffset }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="pl-64">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-dashboard-title">
                Submissions Dashboard
              </h1>
              <p className="text-muted-foreground">Manage Durga Puja contest recordings</p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
                <i className="fas fa-bell text-lg"></i>
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                  {stats?.pendingCount || 0}
                </span>
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <i className="fas fa-user text-sm text-primary-foreground"></i>
                </div>
                <span className="text-sm font-medium text-foreground" data-testid="text-username">
                  {user?.username || "Admin User"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-6 space-y-6">
          <StatsCards stats={stats} isLoading={isLoadingStats} />
          
          <FilterControls 
            filters={filters} 
            onFiltersChange={handleFilterChange} 
          />
          
          <SubmissionsTable
            data={submissionsData}
            isLoading={isLoadingSubmissions}
            onPlayRecording={handlePlayRecording}
            onViewDetails={handleViewDetails}
            onPageChange={handlePageChange}
            currentOffset={filters.offset || 0}
            pageSize={filters.limit || 10}
          />
        </div>
      </div>

      <AudioPlayerModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        submission={selectedSubmission}
      />

      <SubmissionDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        submission={selectedSubmission}
      />
    </div>
  );
}
