"use client";

import { useEffect, useState } from "react";

const PARTICLES = [
  { top: "12%",  left: "8%",   size: 3, delay: "0.4s",  duration: "4s"  },
  { top: "20%",  left: "88%",  size: 2, delay: "0.9s",  duration: "5s"  },
  { top: "75%",  left: "6%",   size: 2, delay: "1.2s",  duration: "4.5s"},
  { top: "80%",  left: "91%",  size: 3, delay: "0.6s",  duration: "6s"  },
  { top: "45%",  left: "4%",   size: 2, delay: "1.5s",  duration: "5.5s"},
  { top: "50%",  left: "94%",  size: 2, delay: "0.3s",  duration: "4.2s"},
  { top: "8%",   left: "50%",  size: 2, delay: "1.0s",  duration: "5.2s"},
  { top: "92%",  left: "46%",  size: 2, delay: "0.7s",  duration: "4.8s"},
];

export default function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "exit" | "gone">("show");

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem("scentopia_splash_done")
    ) {
      setPhase("gone");
      return;
    }

    const exitTimer = setTimeout(() => setPhase("exit"), 3000);
    const goneTimer = setTimeout(() => {
      setPhase("gone");
      sessionStorage.setItem("scentopia_splash_done", "1");
    }, 3750);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at 40% 40%, #1e1508 0%, #110e06 45%, #080604 100%)",
        opacity: phase === "exit" ? 0 : 1,
        transition:
          phase === "exit"
            ? "opacity 0.75s cubic-bezier(0.4, 0, 1, 1)"
            : "none",
        pointerEvents: phase === "exit" ? "none" : "all",
        animation: "splash-bg-in 0.3s ease forwards",
        overflow: "hidden",
      }}
    >
      {/* Ambient corner glows */}
      <div
        style={{
          position: "absolute",
          top: -80,
          left: -80,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)",
          animation: "splash-glow-pulse 4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -80,
          right: -80,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%)",
          animation: "splash-glow-pulse 5s ease-in-out 1s infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      {/* Floating gold particles */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "#D4AF37",
            animation: `splash-particle ${p.duration} ease-in-out ${p.delay} infinite`,
            opacity: 0.15,
          }}
        />
      ))}

      {/* Corner bracket — top left */}
      <div
        style={{
          position: "absolute",
          top: 32,
          left: 32,
          width: 40,
          height: 40,
          borderTop: "1px solid rgba(212,175,55,0.35)",
          borderLeft: "1px solid rgba(212,175,55,0.35)",
          animation: "splash-ornament-in 0.6s ease 0.2s both",
        }}
      />
      {/* Corner bracket — top right */}
      <div
        style={{
          position: "absolute",
          top: 32,
          right: 32,
          width: 40,
          height: 40,
          borderTop: "1px solid rgba(212,175,55,0.35)",
          borderRight: "1px solid rgba(212,175,55,0.35)",
          animation: "splash-ornament-in 0.6s ease 0.2s both",
        }}
      />
      {/* Corner bracket — bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: 32,
          width: 40,
          height: 40,
          borderBottom: "1px solid rgba(212,175,55,0.35)",
          borderLeft: "1px solid rgba(212,175,55,0.35)",
          animation: "splash-ornament-in 0.6s ease 0.2s both",
        }}
      />
      {/* Corner bracket — bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          right: 32,
          width: 40,
          height: 40,
          borderBottom: "1px solid rgba(212,175,55,0.35)",
          borderRight: "1px solid rgba(212,175,55,0.35)",
          animation: "splash-ornament-in 0.6s ease 0.2s both",
        }}
      />

      {/* Center content */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
          padding: "0 24px",
        }}
      >
        {/* Top ornament row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 28,
            animation: "splash-ornament-in 0.7s cubic-bezier(0.25,1,0.5,1) 0.35s both",
            transformOrigin: "center",
          }}
        >
          <div
            style={{
              height: 1,
              width: 64,
              background:
                "linear-gradient(to right, transparent, rgba(212,175,55,0.8))",
            }}
          />
          <div
            style={{
              width: 6,
              height: 6,
              border: "1px solid rgba(212,175,55,0.9)",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              width: 6,
              height: 6,
              border: "1px solid rgba(212,175,55,0.5)",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              width: 6,
              height: 6,
              border: "1px solid rgba(212,175,55,0.9)",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              height: 1,
              width: 64,
              background:
                "linear-gradient(to left, transparent, rgba(212,175,55,0.8))",
            }}
          />
        </div>

        {/* Main title */}
        <h1
          style={{
            fontSize: "clamp(2.2rem, 9vw, 5.8rem)",
            fontWeight: 200,
            letterSpacing: "0.55em",
            textIndent: "0.55em",
            color: "#f2ede3",
            margin: 0,
            lineHeight: 1,
            animation:
              "splash-title-in 1s cubic-bezier(0.25,1,0.5,1) 0.55s both",
          }}
        >
          SCENTOPIA
        </h1>

        {/* Expanding gold divider */}
        <div
          style={{
            height: 1,
            background:
              "linear-gradient(to right, transparent, #D4AF37, transparent)",
            margin: "22px 0 18px",
            animation: "splash-divider-expand 0.9s cubic-bezier(0.25,1,0.5,1) 1.1s both",
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            fontSize: "clamp(0.55rem, 1.8vw, 0.72rem)",
            letterSpacing: "0.38em",
            textIndent: "0.38em",
            color: "rgba(212,175,55,0.65)",
            textTransform: "uppercase",
            margin: 0,
            fontWeight: 300,
            animation: "splash-subtitle-in 0.8s ease 1.5s both",
          }}
        >
          by MBT Perfume Boutique
        </p>

        {/* Bottom ornament row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 28,
            animation: "splash-ornament-in 0.7s cubic-bezier(0.25,1,0.5,1) 1.7s both",
            transformOrigin: "center",
          }}
        >
          <div
            style={{
              height: 1,
              width: 64,
              background:
                "linear-gradient(to right, transparent, rgba(212,175,55,0.5))",
            }}
          />
          <div
            style={{
              width: 4,
              height: 4,
              background: "rgba(212,175,55,0.7)",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              height: 1,
              width: 64,
              background:
                "linear-gradient(to left, transparent, rgba(212,175,55,0.5))",
            }}
          />
        </div>
      </div>
    </div>
  );
}
