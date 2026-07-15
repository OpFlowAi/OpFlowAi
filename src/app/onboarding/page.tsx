export default function OnboardingPlaceholderPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-xl font-semibold gradient-brand-text mb-2">No locations yet</h1>
        <p className="text-sm text-muted">
          Your account doesn&apos;t have any locations assigned yet. Contact your OpsFlow AI
          administrator to get set up.
        </p>
      </div>
    </div>
  );
}
