import React from "react";
import { ArrowRight } from "lucide-react";
import ArtiumHeader from "../components/landing/ArtiumHeader";
import HeroSection from "../components/landing/HeroSection";
import ExperienceHub from "../components/landing/ExperienceHub";
import BenefitsSection from "../components/landing/BenefitsSection";
import LoginCTA from "../components/landing/LoginCTA";
import LandingFooter from "../components/landing/LandingFooter";

/**
 * The light rebuild of EntryGate. Same props, same four destinations, but
 * where the dark gate collapsed down to a single circle once someone had a
 * learner profile or was already signed in, this one keeps all four cards
 * on screen always — a returning visitor still sees the whole hub, just
 * with a banner above it offering to continue where they left off. That is
 * a deliberate change from the gate's own "reduced" behaviour, made because
 * hiding three of the four doors on a marketplace page reads as broken
 * rather than personalised once the page is trying to look like a hub
 * rather than a single funnel.
 */
export default function LandingPage({
  onLearner, onStudent, onPianist, onComposers, onLogin,
  learnerProfile, learnerLoggedOut, studentLoggedIn,
  musicOn, onMusicToggle, memberCount,
}) {
  // The app around this page is dark, and so is the body behind it. On iOS,
  // rubber-band overscroll shows the body — a black flash framing a white
  // editorial page. Own the body while mounted; put it back on the way out.
  React.useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#FFFFFF";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);
  // Mirrors EntryGate's own singleCard logic so "who is this visitor" reads
  // the same way it always has, even though what the page does with that
  // answer is different now.
  const returning = !!learnerProfile || learnerLoggedOut || studentLoggedIn;
  const firstName = learnerProfile?.name ? learnerProfile.name.split(" ")[0] : "";
  // The gate only ever swapped the login pill for a "logged in as…" note
  // once there was an actual identity to show — a bare logged-out learner
  // still got the login pill, because "logged out" isn't an account to
  // welcome someone back to. Kept identical here.
  const hideLogin = studentLoggedIn || !!learnerProfile;

  let continueLabel = "";
  let continueAction = onLearner;
  if (studentLoggedIn) {
    continueLabel = "Continue to your network";
    continueAction = onStudent;
  } else if (learnerProfile || learnerLoggedOut) {
    continueLabel = "Continue to your teachers";
    continueAction = onLearner;
  }

  return (
    <div className="min-h-screen bg-white" style={{ colorScheme: "light" }}>
      <ArtiumHeader musicOn={musicOn} onMusicToggle={onMusicToggle} memberCount={memberCount} />

      <HeroSection />

      {returning && (
        <div className="mx-auto mb-8 flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-border bg-warm-white px-6 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-[14px] text-ink" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Welcome back{firstName ? `, ${firstName}` : ""}
          </p>
          <button
            onClick={continueAction}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold text-ink"
            style={{ fontFamily: "'Manrope', sans-serif", background: "linear-gradient(180deg, #E5C47B 0%, #C49339 100%)" }}
          >
            {continueLabel} <ArrowRight size={14} strokeWidth={2.2} />
          </button>
        </div>
      )}

      <ExperienceHub onLearner={onLearner} onStudent={onStudent} onPianist={onPianist} onComposers={onComposers} />

      <BenefitsSection />

      {!hideLogin && <LoginCTA onLogin={onLogin} />}

      <LandingFooter />
    </div>
  );
}
