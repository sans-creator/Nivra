import React from "react";

export default function BackgroundFX() {
  return (
    <div className="fixed inset-0 -z-10 bg-app-gradient bg-noise">
      {/* Soft brand blobs */}
      <div className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full blur-3xl opacity-20"
           style={{ background: "radial-gradient(closest-side, rgba(74,155,142,.35), transparent 70%)" }}/>
      <div className="absolute -bottom-16 right-[-10%] w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
           style={{ background: "radial-gradient(closest-side, rgba(74,155,142,.28), transparent 70%)" }}/>
    </div>
  );
}
