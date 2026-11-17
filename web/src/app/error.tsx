"use client";

// Root error boundary — catches render/runtime errors in route segments
// below the root layout and offers a retry.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h1>Something went wrong</h1>
      <p className="error">{error.message || "Unexpected error"}</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
