// src/pages/auth/SignInPage.jsx
import { SignIn } from "@clerk/clerk-react";
export default function SignInPage() {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/app"
        appearance={{
          elements: {
            formButtonPrimary: "bg-[#00897B] hover:bg-[#00796B] text-white rounded-lg focus:ring-4 focus:ring-[#00897B]/30",
            formFieldInput: "rounded-lg focus:ring-[#00897B] focus:border-[#00897B]",
          },
          variables: { colorPrimary: "#00897B", colorText: "#111827" },
        }}
      />
    </div>
  );
}
