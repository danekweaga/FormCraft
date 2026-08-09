import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-8 paper-shadow">
          <p className="text-sm text-secondary">Loading sign in…</p>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
