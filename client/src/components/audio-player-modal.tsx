import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Submission } from "@shared/schema";
import { format } from "date-fns";

interface AudioPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: Submission | null;
}

export default function AudioPlayerModal({ isOpen, onClose, submission }: AudioPlayerModalProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (isOpen && submission && audioRef.current) {
      // Use audio proxy for authenticated access to Exotel recordings
      const proxyUrl = `/api/audio-proxy?url=${encodeURIComponent(submission.recordingUrl)}`;
      audioRef.current.src = proxyUrl;
      audioRef.current.load();
    }
  }, [isOpen, submission]);

  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="modal-audio-player">
        <DialogHeader>
          <DialogTitle>Contest Recording</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Participant:</strong> <span data-testid="text-participant-phone">{submission.callerNumber}</span></p>
            <p><strong>Submitted:</strong> <span data-testid="text-submission-date">{format(new Date(submission.createdAt), "MMM dd, yyyy h:mm a")}</span></p>
            <p><strong>Score:</strong> <span data-testid="text-submission-score">{submission.score !== null ? `${submission.score}%` : "Processing..."}</span></p>
          </div>
          
          <div className="bg-muted rounded-lg p-4">
            <audio 
              ref={audioRef}
              controls 
              className="w-full" 
              data-testid="audio-player"
              preload="metadata"
            >
              Your browser does not support the audio element.
            </audio>
          </div>
          
          {submission.transcript && (
            <div className="bg-accent/30 rounded-lg p-4">
              <h4 className="font-medium text-foreground mb-2">Transcript:</h4>
              <p className="text-sm text-foreground" data-testid="text-submission-transcript">
                "{submission.transcript}"
              </p>
            </div>
          )}
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose} data-testid="button-close-audio-modal">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
