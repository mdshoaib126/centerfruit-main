import { useState } from "react";
import { useQuery } from "@tanstack/react-query"; 
import StatsCards from "@/components/stats-cards";
import FilterControls from "@/components/filter-controls";
import SubmissionsTable from "@/components/submissions-table";
import AudioPlayerModal from "@/components/audio-player-modal"; 
import { useAuth } from "@/hooks/use-auth";
import type { Submission } from "@shared/schema";
import { useLocation } from "wouter";

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
  const [error, setError] = useState<string | null>(null);

  const { data: submissionsData, isLoading: isLoadingSubmissions, error: submissionsError } = useQuery({
    queryKey: ["/api/submissions", filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters.status) searchParams.append('status', filters.status);
      if (filters.fromDate) searchParams.append('fromDate', filters.fromDate);
      if (filters.toDate) searchParams.append('toDate', filters.toDate);
      if (filters.searchPhone) searchParams.append('searchPhone', filters.searchPhone);
      if (filters.limit) searchParams.append('limit', filters.limit.toString());
      if (filters.offset) searchParams.append('offset', filters.offset.toString());

      const response = await fetch(`/api/submissions?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }
      return response.json();
    },
    enabled: !!user,
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const response = await fetch('/api/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      return response.json();
    },
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

  const { logoutMutation } = useAuth();
    const [location] = useLocation();
  
    const handleLogout = () => {
      logoutMutation.mutate();
    };
  

  const handlePageChange = (newOffset: number) => {
    setFilters(prev => ({ ...prev, offset: newOffset }));
  };

  return (
    <div className="min-h-screen bg-background">
       
      <div className="w-full">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-dashboard-title">
                Center Fruit - Submissions Dashboard
              </h1>
              <p className="text-muted-foreground">Manage Durga Puja contest recordings</p>
            </div>
            <div className="flex items-center space-x-4">
               
              <div className="flex items-center space-x-3">
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
        </header>

        {/* Main Content */}
        <div className="p-6 space-y-6">
          {submissionsError && (
            <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-md">
              {submissionsError instanceof Error ? submissionsError.message : 'An error occurred while fetching data'}
            </div>
          )}
          <StatsCards stats={stats} isLoading={isLoadingStats} />
          
          <FilterControls 
            filters={filters} 
            onFiltersChange={handleFilterChange} 
          />
          
          <SubmissionsTable
            data={submissionsData}
            isLoading={isLoadingSubmissions}
            onPlayRecording={handlePlayRecording} 
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

       
    </div>
  );
}
