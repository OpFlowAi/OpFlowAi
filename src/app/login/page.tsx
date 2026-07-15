import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-brand text-white font-bold text-xl shadow-lg shadow-indigo-950/40">
            O
          </div>
          <div>
            <h1 className="text-xl font-semibold gradient-brand-text">OpsFlow AI</h1>
            <p className="text-sm text-muted mt-1">Sign in to your operational hub</p>
          </div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-xs text-muted-2">
          Accounts are provisioned by your OpsFlow AI admin. Contact your account owner if you need access.
        </p>
      </div>
    </div>
  );
}
