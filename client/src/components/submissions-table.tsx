import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Submission } from "@shared/schema";
import { format } from "date-fns";

interface SubmissionsTableProps {
  data?: {
    submissions: Submission[];
    total: number;
  };
  isLoading: boolean;
  onPlayRecording: (submission: Submission) => void;
  onViewDetails: (submission: Submission) => void;
  onPageChange: (offset: number) => void;
  currentOffset: number;
  pageSize: number;
}

export default function SubmissionsTable({
  data,
  isLoading,
  onPlayRecording,
  onViewDetails,
  onPageChange,
  currentOffset,
  pageSize,
}: SubmissionsTableProps) {
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "PASS" | "FAIL" }) => {
      const res = await apiRequest("PUT", `/api/submission/${id}/status`, { status });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Status updated",
        description: "Submission status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApprove = (submission: Submission) => {
    updateStatusMutation.mutate({ id: submission.id, status: "PASS" });
  };

  const handleReject = (submission: Submission) => {
    updateStatusMutation.mutate({ id: submission.id, status: "FAIL" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PASS":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <i className="fas fa-check mr-1 text-xs"></i>
            PASS
          </Badge>
        );
      case "FAIL":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <i className="fas fa-times mr-1 text-xs"></i>
            FAIL
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <i className="fas fa-clock mr-1 text-xs"></i>
            PENDING
          </Badge>
        );
    }
  };

  const getScoreBar = (score: number | null) => {
    if (score === null) return null;
    
    const color = score >= 70 ? "bg-success" : "bg-destructive";
    return (
      <div className="w-12 h-2 bg-muted rounded-full">
        <div className={`h-2 ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
    );
  };

  const currentPage = Math.floor(currentOffset / pageSize) + 1;
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Submissions</CardTitle>
        <p className="text-muted-foreground">
          Showing {currentOffset + 1}-{Math.min(currentOffset + pageSize, data?.total || 0)} of{" "}
          {data?.total || 0} submissions
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Transcript Preview</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.submissions.map((submission) => (
                <TableRow key={submission.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm" data-testid={`submission-id-${submission.id}`}>
                    #{submission.id.slice(-6)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <i className="fas fa-phone text-muted-foreground mr-2 text-xs"></i>
                      <span className="text-sm font-medium" data-testid={`phone-${submission.id}`}>
                        {submission.callerNumber}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" data-testid={`transcript-${submission.id}`}>
                      {submission.transcript || (
                        <span className="text-muted-foreground italic">Processing transcript...</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium" data-testid={`score-${submission.id}`}>
                        {submission.score !== null ? `${submission.score}%` : "-"}
                      </span>
                      {getScoreBar(submission.score)}
                    </div>
                  </TableCell>
                  <TableCell data-testid={`status-${submission.id}`}>
                    {getStatusBadge(submission.status)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" data-testid={`date-${submission.id}`}>
                    {format(new Date(submission.createdAt), "MMM dd, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPlayRecording(submission)}
                        className="p-2 text-primary hover:bg-primary/10"
                        title="Play Recording"
                        data-testid={`button-play-${submission.id}`}
                      >
                        <i className="fas fa-play text-xs"></i>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(submission)}
                        className="p-2 text-muted-foreground hover:bg-accent"
                        title="View Details"
                        data-testid={`button-details-${submission.id}`}
                      >
                        <i className="fas fa-eye text-xs"></i>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleApprove(submission)}
                        disabled={updateStatusMutation.isPending}
                        className="p-2 text-success hover:bg-success/10"
                        title="Approve"
                        data-testid={`button-approve-${submission.id}`}
                      >
                        <i className="fas fa-check text-xs"></i>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(submission)}
                        disabled={updateStatusMutation.isPending}
                        className="p-2 text-destructive hover:bg-destructive/10"
                        title="Reject"
                        data-testid={`button-reject-${submission.id}`}
                      >
                        <i className="fas fa-times text-xs"></i>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted-foreground">
            Showing {currentOffset + 1} to {Math.min(currentOffset + pageSize, data?.total || 0)} of{" "}
            {data?.total || 0} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(0, currentOffset - pageSize))}
              disabled={currentOffset === 0}
              data-testid="button-previous-page"
            >
              Previous
            </Button>
            <span className="text-sm" data-testid="text-current-page">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentOffset + pageSize)}
              disabled={currentOffset + pageSize >= (data?.total || 0)}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
