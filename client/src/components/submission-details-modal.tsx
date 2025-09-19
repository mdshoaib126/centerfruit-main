import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Submission } from "@shared/schema";
import { format } from "date-fns";

interface SubmissionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: Submission | null;
}

export default function SubmissionDetailsModal({ 
  isOpen, 
  onClose, 
  submission 
}: SubmissionDetailsModalProps) {
  const { toast } = useToast();

  const { data: expectedTwister } = useQuery({
    queryKey: ["/api/expected-twister"],
    enabled: isOpen,
  });

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
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApprove = () => {
    if (submission) {
      updateStatusMutation.mutate({ id: submission.id, status: "PASS" });
    }
  };

  const handleReject = () => {
    if (submission) {
      updateStatusMutation.mutate({ id: submission.id, status: "FAIL" });
    }
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

  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-submission-details">
        <DialogHeader>
          <DialogTitle>Submission Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Submission ID</label>
              <p className="text-foreground font-mono" data-testid="text-details-id">#{submission.id.slice(-6)}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Phone Number</label>
              <p className="text-foreground" data-testid="text-details-phone">{submission.callerNumber}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Score</label>
              <div className="flex items-center space-x-2">
                <span className="text-foreground font-semibold" data-testid="text-details-score">
                  {submission.score !== null ? `${submission.score}%` : "Processing..."}
                </span>
                {submission.score !== null && (
                  <div className="flex-1 h-2 bg-muted rounded-full max-w-24">
                    <div 
                      className={`h-2 rounded-full ${submission.score >= 70 ? 'bg-success' : 'bg-destructive'}`}
                      style={{ width: `${submission.score}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Status</label>
              <div data-testid="badge-details-status">
                {getStatusBadge(submission.status)}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Submitted At</label>
              <p className="text-muted-foreground" data-testid="text-details-date">
                {format(new Date(submission.createdAt), "MMMM dd, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>

          {submission.transcript && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Full Transcript</label>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-foreground" data-testid="text-details-transcript">
                  "{submission.transcript}"
                </p>
              </div>
            </div>
          )}

          {expectedTwister && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Expected Tongue Twister</label>
              <div className="bg-accent/30 rounded-lg p-4">
                <p className="text-foreground" data-testid="text-expected-twister">
                  "{expectedTwister.text}"
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              data-testid="button-close-details"
            >
              Close
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={updateStatusMutation.isPending}
              className="bg-success hover:bg-success/90 text-success-foreground"
              data-testid="button-approve-details"
            >
              <i className="fas fa-check mr-2"></i>
              {updateStatusMutation.isPending ? "Approving..." : "Approve"}
            </Button>
            <Button 
              onClick={handleReject}
              disabled={updateStatusMutation.isPending}
              variant="destructive"
              data-testid="button-reject-details"
            >
              <i className="fas fa-times mr-2"></i>
              {updateStatusMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
