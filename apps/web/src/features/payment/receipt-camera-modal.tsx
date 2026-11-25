"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  Loader2,
  RefreshCw,
  RotateCcw,
  SwitchCamera,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ReceiptCameraModalProps {
  open: boolean;
  onClose: () => void;
  onCaptureAccepted: (file: File) => void;
  onFallbackUpload: () => void;
}

type CameraStatus = "initializing" | "streaming" | "captured" | "error";

function mapCameraError(err: unknown): { title: string; message: string } {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      title: "Camera Not Supported",
      message:
        "This browser or connection does not support live camera capture. Please upload an existing receipt image from your device instead.",
    };
  }

  const domErr = err as { name?: string; message?: string };
  const name = domErr?.name || "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      title: "Camera Permission Denied",
      message:
        "Camera access was blocked. Allow camera permissions in your browser settings and click Retry, or upload your receipt image from your device.",
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      title: "No Camera Detected",
      message:
        "We could not find an available camera on this device. Please select or drag-and-drop a saved receipt image instead.",
    };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      title: "Camera In Use",
      message:
        "Your camera appears to be used by another app or tab. Close other camera apps and retry, or upload a saved receipt image.",
    };
  }

  return {
    title: "Camera Unavailable",
    message:
      domErr?.message ||
      "Could not start the camera stream. You can upload an existing receipt photo from your device.",
  };
}

function ReceiptCameraModalContent({
  onClose,
  onCaptureAccepted,
  onFallbackUpload,
}: Omit<ReceiptCameraModalProps, "open">) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);

  const [status, setStatus] = React.useState<CameraStatus>("initializing");
  const [facingMode, setFacingMode] = React.useState<"environment" | "user">("environment");
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [activeDeviceIndex, setActiveDeviceIndex] = React.useState<number>(0);
  const [capturedBlob, setCapturedBlob] = React.useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = React.useState<string | null>(null);
  const [errorState, setErrorState] = React.useState<{ title: string; message: string } | null>(
    null,
  );
  const [isSwitching, setIsSwitching] = React.useState(false);

  const stopCameraStream = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track stop error
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const clearCapturedPreview = React.useCallback(() => {
    setCapturedBlob(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setCapturedPreviewUrl(null);
  }, []);

  const connectCameraStream = React.useCallback(
    async (
      targetFacing: "environment" | "user",
      explicitDeviceId?: string,
      isCancelled?: () => boolean,
    ) => {
      stopCameraStream();

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        await Promise.resolve();
        if (isCancelled?.()) return;
        setStatus("error");
        setErrorState(mapCameraError(null));
        return;
      }

      try {
        const videoConstraints: MediaTrackConstraints = explicitDeviceId
          ? {
              deviceId: { exact: explicitDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          : {
              facingMode: { ideal: targetFacing },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        if (isCancelled?.()) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
          if (!isCancelled?.()) {
            const cameras = devices.filter((d) => d.kind === "videoinput");
            setVideoDevices(cameras);
          }
        }

        if (!isCancelled?.()) {
          setErrorState(null);
          setStatus("streaming");
        }
      } catch (err) {
        stopCameraStream();
        if (!isCancelled?.()) {
          setStatus("error");
          setErrorState(mapCameraError(err));
        }
      }
    },
    [stopCameraStream],
  );

  React.useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void connectCameraStream("environment", undefined, () => cancelled);
      }
    });

    return () => {
      cancelled = true;
      stopCameraStream();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [connectCameraStream, stopCameraStream]);

  const handleClose = () => {
    stopCameraStream();
    clearCapturedPreview();
    onClose();
  };

  const handleRetryCamera = () => {
    setErrorState(null);
    setStatus("initializing");
    connectCameraStream(facingMode);
  };

  const handleSwitchCamera = async () => {
    if (isSwitching) return;
    setIsSwitching(true);
    setErrorState(null);
    setStatus("initializing");
    try {
      const nextFacing = facingMode === "environment" ? "user" : "environment";
      setFacingMode(nextFacing);

      if (videoDevices.length > 1) {
        const nextIdx = (activeDeviceIndex + 1) % videoDevices.length;
        setActiveDeviceIndex(nextIdx);
        const nextDevice = videoDevices[nextIdx];
        if (nextDevice?.deviceId) {
          await connectCameraStream(nextFacing, nextDevice.deviceId);
          return;
        }
      }

      await connectCameraStream(nextFacing);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw natural un-mirrored image so receipt text and numbers remain readable
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        clearCapturedPreview();
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setCapturedBlob(blob);
        setCapturedPreviewUrl(url);
        setStatus("captured");
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleRetake = () => {
    clearCapturedPreview();
    setStatus("streaming");
    if (!streamRef.current) {
      setStatus("initializing");
      connectCameraStream(facingMode);
    } else if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleAcceptCaptured = () => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `receipt-camera-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    stopCameraStream();
    clearCapturedPreview();
    onCaptureAccepted(file);
    onClose();
  };

  const handleUseUploadFallback = () => {
    stopCameraStream();
    clearCapturedPreview();
    onClose();
    onFallbackUpload();
  };

  return (
    <ModalDialog
      open
      onClose={handleClose}
      title="Capture Payment Receipt"
      description="Center your bank slip, Telebirr screenshot, or paper receipt clearly inside the frame."
      className="max-w-xl"
    >
      <div className="space-y-4">
        {status === "error" && errorState ? (
          <div className="space-y-4 rounded-xl border border-amber-500/40 bg-amber-50 p-5 text-center dark:bg-amber-950/30">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <AlertTriangle className="size-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display text-sm font-bold text-foreground">{errorState.title}</h4>
              <p className="text-xs leading-relaxed text-muted-foreground">{errorState.message}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <Button type="button" variant="cta" size="sm" onClick={handleUseUploadFallback}>
                <Upload className="size-4" />
                Upload Receipt Image Instead
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleRetryCamera}>
                <RefreshCw className="size-3.5" />
                Retry Camera
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Camera Viewport / Captured Photo Preview */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-black">
              {status === "initializing" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/80 text-white">
                  <Loader2 className="size-7 animate-spin text-banner-accent" />
                  <p className="text-xs font-medium">Requesting camera permission...</p>
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "size-full object-cover",
                  facingMode === "user" && "scale-x-[-1]",
                  status === "captured" && "hidden",
                )}
              />

              {/* Subtle Receipt Alignment Guides during live preview */}
              {status === "streaming" && (
                <div className="pointer-events-none absolute inset-4 rounded-lg border-2 border-dashed border-white/50">
                  <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 font-label text-[10px] font-bold text-white">
                    {facingMode === "environment" ? "Rear Camera" : "Front Camera"}
                  </span>
                  <span className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white/90">
                    Keep transaction ID &amp; amount legible
                  </span>
                </div>
              )}

              {status === "captured" && capturedPreviewUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={capturedPreviewUrl}
                  alt="Captured payment receipt preview"
                  className="size-full object-contain bg-black"
                />
              )}
            </div>

            {/* Camera Controls */}
            {status === "captured" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={handleRetake}>
                  <RotateCcw className="size-4" />
                  Retake Photo
                </Button>
                <Button type="button" variant="cta" onClick={handleAcceptCaptured}>
                  <Check className="size-4" />
                  Use This Receipt
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {(videoDevices.length > 1 || status === "streaming") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={status !== "streaming" || isSwitching}
                      onClick={handleSwitchCamera}
                      title="Switch between front and rear camera"
                    >
                      <SwitchCamera className="size-4" />
                      <span>Switch Camera</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleUseUploadFallback}
                  >
                    <Upload className="size-3.5" />
                    <span>Upload File Instead</span>
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="cta"
                  disabled={status !== "streaming"}
                  onClick={handleCapturePhoto}
                >
                  <Camera className="size-4" />
                  <span>Capture Receipt</span>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ModalDialog>
  );
}

export function ReceiptCameraModal(props: ReceiptCameraModalProps) {
  if (!props.open) return null;
  return <ReceiptCameraModalContent {...props} />;
}
