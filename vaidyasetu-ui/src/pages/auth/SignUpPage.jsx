// src/pages/auth/SignUpPage.jsx
import { SignUp } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

export default function SignUpPage() {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5">
      <button disabled className="w-full mb-3 rounded-lg border border-dashed px-3 py-2 text-sm text-gray-500">
        Sign in with ABHA (Coming soon)
      </button>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        afterSignUpUrl="/app"
        appearance={{
          elements: {
            formButtonPrimary: "bg-[#00897B] hover:bg-[#00796B] text-white rounded-lg focus:ring-4 focus:ring-[#00897B]/30",
            formFieldInput: "rounded-lg focus:ring-[#00897B] focus:border-[#00897B]",
            socialButtonsBlockButton: "rounded-lg border-gray-200 hover:bg-gray-50",
            headerTitle: "text-xl font-semibold",
            headerSubtitle: "text-gray-500",
          },
          variables: { colorPrimary: "#00897B", colorText: "#111827" },
        }}
      />
      <p className="mt-3 text-center text-sm text-gray-600">
        Already have an account? <Link to="/sign-in" className="text-[#00897B] hover:underline">Log in</Link>
      </p>
    </div>
  );
}
