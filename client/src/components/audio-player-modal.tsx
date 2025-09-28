import { useEffect, useRef, useState } from "react";
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
  console.log('AudioPlayerModal render', { isOpen, hasSubmission: !!submission });
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Handle modal close with cleanup
  const handleClose = () => {
    console.log('handleClose called');
    if (audioRef.current) {
      const audio = audioRef.current;
      // Pause and reset audio
      audio.pause();
      audio.currentTime = 0;
      
      // Clean up blob URL
      if (audio.dataset.blobUrl) {
        console.log('Cleaning up blob URL on close:', audio.dataset.blobUrl);
        URL.revokeObjectURL(audio.dataset.blobUrl);
        delete audio.dataset.blobUrl;
      }
      
      // Reset source
      audio.src = '';
    }
    
    // Reset state
    setAudioError(null);
    setIsLoading(false);
    
    onClose();
  };

  useEffect(() => {
    console.log('AudioPlayerModal useEffect triggered', { isOpen, submission: !!submission });
    
    if (!isOpen || !submission) {
      console.log('Modal not open or no submission', { isOpen, hasSubmission: !!submission });
      // Reset state when modal is closed
      setAudioError(null);
      setIsLoading(false);
      return;
    }
    
    console.log('Processing submission:', { 
      id: submission.id, 
      recordingUrl: submission.recordingUrl,
      callerNumber: submission.callerNumber 
    });

    if (!submission.recordingUrl || submission.recordingUrl.trim() === '') {
      console.log('No recording URL available');
      setAudioError('No recording URL available');
      setIsLoading(false);
      return;
    }

    // Wait for audio element to be ready
    const loadAudio = () => {
      console.log('Checking audioRef.current:', !!audioRef.current);
      if (audioRef.current) {
      console.log('audioRef.current exists, proceeding with audio loading');
      setAudioError(null);
      setIsLoading(true);
      
      // Use audio proxy for authenticated access to Exotel recordings
      const proxyUrl = `/api/audio-proxy?url=${encodeURIComponent(submission.recordingUrl)}`;
      console.log('Loading audio from proxy:', proxyUrl);
      console.log('Original recording URL:', submission.recordingUrl);
      
      // Validate proxy URL is not empty
      if (!proxyUrl || proxyUrl.includes('undefined') || proxyUrl.includes('null')) {
        console.error('Invalid proxy URL generated:', proxyUrl);
        setAudioError('Invalid audio URL');
        setIsLoading(false);
        return;
      }
      
      const audio = audioRef.current;
      
      // Add event listeners for debugging
      const handleLoadStart = () => {
        console.log('Audio load started');
        setIsLoading(true);
      };
      
      const handleCanPlay = () => {
        console.log('Audio can play');
        setIsLoading(false);
        setAudioError(null);
      };
      
      const handleError = (e: Event) => {
        console.error('Audio loading error:', e);
        console.error('Audio element error:', (e.target as HTMLAudioElement)?.error);
        setIsLoading(false);
        setAudioError('Failed to load audio. Please check server logs for details.');
      };
      
      const handleLoadedMetadata = () => {
        console.log('Audio metadata loaded, duration:', audio.duration);
      };

      // Add event listeners first
      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('error', handleError);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      // Clean up any existing blob URL first
      if (audio.dataset.blobUrl) {
        console.log('Cleaning up existing blob URL:', audio.dataset.blobUrl);
        URL.revokeObjectURL(audio.dataset.blobUrl);
        delete audio.dataset.blobUrl;
      }
      
      // Try using blob URL approach for better compatibility
      const cacheBuster = Date.now();
      const proxyUrlWithCache = `${proxyUrl}&t=${cacheBuster}`;
      console.log('Fetching audio data for blob URL:', proxyUrlWithCache);
      
      fetch(proxyUrlWithCache, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
        .then(response => {
          console.log('Audio fetch response:', response.status, response.statusText);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          console.log('Audio blob received, size:', blob.size, 'type:', blob.type);
          const blobUrl = URL.createObjectURL(blob);
          console.log('Setting audio src to blob URL:', blobUrl);
          audio.src = blobUrl;
          audio.load();
          
          // Store blob URL for cleanup
          audio.dataset.blobUrl = blobUrl;
        })
        .catch(error => {
          console.error('Audio fetch error:', error);
          setIsLoading(false);
          setAudioError(`Failed to load audio: ${error.message}`);
        });
      
        // Cleanup function
        return () => {
          audio.removeEventListener('loadstart', handleLoadStart);
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
          
          // Clean up blob URL if it exists
          if (audio.dataset.blobUrl) {
            URL.revokeObjectURL(audio.dataset.blobUrl);
            delete audio.dataset.blobUrl;
          }
        };
      } else {
        console.log('audioRef.current is null, retrying in 100ms');
        // Retry after a short delay to allow DOM to render
        setTimeout(loadAudio, 100);
      }
    };

    // Start loading audio
    loadAudio();
  }, [isOpen, submission]);

  // Cleanup when component unmounts or modal closes
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        const audio = audioRef.current;
        // Clean up blob URL if it exists
        if (audio.dataset.blobUrl) {
          console.log('Cleaning up blob URL on unmount:', audio.dataset.blobUrl);
          URL.revokeObjectURL(audio.dataset.blobUrl);
          delete audio.dataset.blobUrl;
        }
        // Reset audio source
        audio.src = '';
        audio.load();
      }
    };
  }, []);

  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log('Dialog onOpenChange called with:', open);
      if (!open) {
        handleClose();
      }
    }}>
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
            {isLoading && (
              <div className="text-center text-sm text-muted-foreground mb-2">
                Loading audio...
              </div>
            )}
            
            {audioError && (
              <div className="text-center text-sm text-red-500 mb-2">
                {audioError}
              </div>
            )}
            
            <audio 
              ref={audioRef}
              controls 
              className="w-full" 
              data-testid="audio-player"
              preload="metadata"
              crossOrigin="anonymous"
              controlsList="nodownload"
            >
              Your browser does not support the audio element.
            </audio>
            
            {submission?.recordingUrl && (
              <div className="text-xs text-muted-foreground mt-2">
                <div className="truncate">Source: {submission.recordingUrl}</div>
                <div className="mt-1">
                  <a 
                    href={`/api/audio-proxy?url=${encodeURIComponent(submission.recordingUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 underline"
                  >
                    Test Direct Link
                  </a>
                </div>
              </div>
            )}
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
            <Button variant="outline" onClick={handleClose} data-testid="button-close-audio-modal">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
