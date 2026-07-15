export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Auth is disabled for public access
  return <>{children}</>;
}
