import React from "react";
import { Users, Shield, TrendingUp } from "lucide-react";

const BENEFITS = [
  {
    title: "Trusted Community",
    desc: "Verified conservatory students & musicians",
    icon: Users,
  },
  {
    title: "Safe & Secure",
    desc: "Private, secure and reliable platform",
    icon: Shield,
  },
  {
    title: "Grow Together",
    desc: "Opportunities, collaborations and real connections",
    icon: TrendingUp,
  },
];

/**
 * One white container, three columns, hairlines between rather than around
 * — the same "one card, quiet dividers" shape the reference uses instead of
 * three separate cards, which would repeat the hub's card material a second
 * time on the same page.
 */
export default function BenefitsSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-16">
      <div className="flex flex-col divide-y divide-border rounded-[28px] border border-border bg-white shadow-[0_12px_35px_rgba(25,30,35,0.06)] md:flex-row md:divide-x md:divide-y-0">
        {BENEFITS.map(({ title, desc, icon: Icon }) => (
          <div key={title} className="flex flex-1 items-start gap-4 px-8 py-8 md:py-10">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-warm-white text-gold">
              <Icon size={20} strokeWidth={1.6} />
            </span>
            <span>
              <p className="text-[16px] text-ink" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>
                {title}
              </p>
              <p className="mt-1 max-w-[210px] text-[13px] leading-relaxed text-muted" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {desc}
              </p>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
