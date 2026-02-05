import { toast } from "sonner";

export function handleError(error: unknown, fallback?: string): void {
  const message =
    error instanceof Error
      ? error.message
      : fallback || "An unexpected error occurred";
  console.error(message, error);
  toast.error(message);
}
