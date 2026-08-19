import React from "react";
import {
  ArrowUpRight,
  GraduationCap,
  Menu,
  Piano,
  ShieldCheck,
  Sparkles,
  Users,
  TrendingUp,
  Instagram,
  Facebook,
  UserRound,
} from "lucide-react";

/* =========================================================
   This file is the client's own implementation, integrated
   verbatim: the JSX and classes below are theirs. The only
   edits are wiring — the app navigates by state, not URLs,
   so each href hands off to the existing screen handlers;
   the placeholder "A" glyphs carry the real pin mark; the
   header count is live; login goes to the existing Supabase
   flow. Nothing visual was redesigned here on purpose.
========================================================= */

/** The real Artium mark — the same pin the rest of the app draws. */
function PinMark({ width = 18, height = 26 }) {
  return (
    <svg viewBox="0 0 28 40" aria-hidden="true" style={{ width, height, display: "block" }}>
      <path
        fillRule="evenodd"
        fill="#bd8d37"
        d="M14 0.9C6.82 0.9 1.4 6.28 1.4 13.2c0 3.35 1.3 6.36 3.2 9.36 1.6 2.53 3.63 5.02 5.53 7.62 1.35 1.85 2.6 3.72 3.28 5.98a.62.62 0 0 0 1.18 0c.68-2.26 1.93-4.13 3.28-5.98 1.9-2.6 3.93-5.09 5.53-7.62 1.9-3 3.2-6.01 3.2-9.36C26.6 6.28 21.18.9 14 .9zm0 7.68a5.04 5.04 0 1 0 0 10.08 5.04 5.04 0 0 0 0-10.08z"
      />
    </svg>
  );
}

/* =========================================================
   DATA
========================================================= */

const experiences = [
  {
    id: "01",
    title: "Find a Teacher",
    description:
      "Discover and connect with inspiring teachers and conservatory musicians.",
    icon: Users,
    href: "/teachers",
  },
  {
    id: "02",
    title: (
      <>
        I'm a Conservatory
        <br />
        Student | Graduate
      </>
    ),
    description:
      "Connect with peers, discover opportunities and grow your musical journey.",
    icon: GraduationCap,
    href: "/students",
  },
  {
    id: "03",
    title: (
      <>
        Find a Concert
        <br />
        Pianist
      </>
    ),
    description:
      "Discover talented pianists for concerts, events and special occasions.",
    icon: Piano,
    href: "/pianists",
  },
  {
    id: "04",
    title: (
      <>
        The Wall of
        <br />
        Composers
      </>
    ),
    description:
      "Explore the lives, works and legacies of the greatest composers.",
    icon: Sparkles,
    href: "/composers",
  },
];

const benefits = [
  {
    icon: Users,
    title: "Trusted Community",
    description: (
      <>
        Verified conservatory
        <br />
        students & musicians
      </>
    ),
  },
  {
    icon: ShieldCheck,
    title: "Safe & Secure",
    description: (
      <>
        Private, secure and
        <br />
        reliable platform
      </>
    ),
  },
  {
    icon: TrendingUp,
    title: "Grow Together",
    description: (
      <>
        Opportunities,
        <br />
        collaborations and real connections
      </>
    ),
  },
];

/* =========================================================
   MAIN PAGE
========================================================= */

export default function LandingPage({ onLearner, onStudent, onPianist, onComposers, onLogin, memberCount }) {
  // The app around this page is dark, and so is the body behind it. On iOS,
  // rubber-band overscroll shows the body — a black flash framing a white
  // editorial page. Own the body while mounted; put it back on the way out.
  React.useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#FFFFFF";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  // href -> the handler the rest of the app already uses for that door.
  const actionFor = {
    "01": onLearner,
    "02": onStudent,
    "03": onPianist,
    "04": onComposers,
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#111820]">

      <Header memberCount={memberCount} />

      <main>

        <Hero />

        <ExperienceSection actionFor={actionFor} />

        <Benefits />

        <LoginCTA onLogin={onLogin} />

      </main>

      <Footer />

    </div>
  );
}

/* =========================================================
   HEADER
========================================================= */

function Header({ memberCount }) {
  return (
    <header className="relative z-50 mx-auto flex w-full max-w-[1320px] items-center justify-between px-6 py-6 sm:px-8 lg:px-12">

      {/* Logo */}
      <a
        href="/"
        className="group flex items-center gap-3"
      >

        <div
          className="
            flex h-11 w-11 items-center justify-center
            rounded-full
            border border-[#d5ae61]
            bg-white
            shadow-[0_4px_16px_rgba(80,60,20,0.06)]
          "
        >
          <PinMark width={14} height={20} />
        </div>

        <span
          className="
            font-serif text-[29px]
            tracking-[-0.03em]
            text-[#17202a]
          "
        >
          artium
        </span>

      </a>

      {/* Right navigation */}
      <div className="flex items-center gap-3">

        <button
          aria-label="Menu"
          className="
            flex h-11 w-11 items-center justify-center
            rounded-full
            border border-[#ece6da]
            bg-white
            text-[#252c32]
            shadow-[0_5px_20px_rgba(30,30,20,0.04)]
            transition-all duration-300
            hover:-translate-y-0.5
            hover:border-[#d8b56e]
            hover:shadow-[0_8px_25px_rgba(30,30,20,0.08)]
          "
        >
          <Menu
            size={20}
            strokeWidth={1.6}
          />
        </button>

        <button
          aria-label="Profile"
          className="
            flex h-11 items-center gap-2
            rounded-full
            border border-[#ece6da]
            bg-white
            px-4
            text-[#252c32]
            shadow-[0_5px_20px_rgba(30,30,20,0.04)]
            transition-all duration-300
            hover:border-[#d8b56e]
          "
        >
          <UserRound
            size={17}
            strokeWidth={1.5}
          />

          <span className="text-sm font-medium">
            {memberCount ?? 40}
          </span>

        </button>

      </div>

    </header>
  );
}

/* =========================================================
   HERO
========================================================= */

function Hero() {
  return (
    <section className="mx-auto max-w-[1000px] px-6 pb-12 pt-14 text-center sm:pt-20">

      <div
        className="
          inline-flex items-center
          rounded-full
          border border-[#eee4d0]
          bg-[#fffdf9]
          px-4 py-2
          shadow-[0_4px_15px_rgba(60,40,10,0.03)]
        "
      >
        <span
          className="
            text-[10px]
            font-semibold
            tracking-[0.28em]
            text-[#b98935]
            sm:text-[11px]
          "
        >
          WELCOME TO ARTIUM
        </span>
      </div>

      <h1
        className="
          mx-auto mt-7
          max-w-[900px]
          font-serif
          text-[58px]
          leading-[0.94]
          tracking-[-0.045em]
          text-[#111820]
          sm:text-[72px]
          md:text-[88px]
          lg:text-[96px]
        "
      >
        Your Classical
        <br />
        Music World
      </h1>

      <p
        className="
          mt-7
          font-sans
          text-[18px]
          font-light
          tracking-[0.01em]
          text-[#70777d]
          sm:text-[20px]
        "
      >
        Connect. Learn. Elevate.
      </p>

      {/* Decorative line */}
      <div className="mt-8 flex items-center justify-center gap-4">

        <span className="h-px w-16 bg-[#eadcc2] sm:w-24" />

        <span
          className="
            text-[8px]
            text-[#c0933c]
          "
        >
          ◆
        </span>

        <span className="h-px w-16 bg-[#eadcc2] sm:w-24" />

      </div>

    </section>
  );
}

/* =========================================================
   EXPERIENCE SECTION
========================================================= */

function ExperienceSection({ actionFor }) {
  return (
    <section
      className="
        relative mx-auto
        max-w-[1160px]
        px-5
        pb-8
        sm:px-8
      "
    >

      {/* Desktop radial architecture */}
      <div
        className="
          pointer-events-none
          absolute left-1/2 top-1/2
          hidden
          h-[590px] w-[590px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          border border-[#eadfc9]
          lg:block
        "
      />

      <div
        className="
          pointer-events-none
          absolute left-1/2 top-1/2
          hidden
          h-[380px] w-[380px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          border border-[#f0e9dc]
          lg:block
        "
      />

      {/* Connecting lines */}
      <div
        className="
          pointer-events-none
          absolute left-1/2 top-1/2
          hidden
          h-[590px] w-px
          -translate-x-1/2
          -translate-y-1/2
          bg-[#eee5d5]
          lg:block
        "
      />

      <div
        className="
          pointer-events-none
          absolute left-1/2 top-1/2
          hidden
          h-px w-[590px]
          -translate-x-1/2
          -translate-y-1/2
          bg-[#eee5d5]
          lg:block
        "
      />

      {/* Cards */}
      <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:gap-7">

        {experiences.map((experience, index) => (
          <ExperienceCard
            key={experience.id}
            experience={experience}
            index={index}
            onSelect={actionFor[experience.id]}
          />
        ))}

        {/* Center */}
        <ArtiumCenter />

      </div>

    </section>
  );
}

/* =========================================================
   EXPERIENCE CARD
========================================================= */

function ExperienceCard({ experience, index, onSelect }) {

  const Icon = experience.icon;

  return (
    <a
      href={experience.href}
      onClick={(e) => { e.preventDefault(); onSelect && onSelect(); }}
      className="
        group relative
        min-h-[310px]
        overflow-hidden
        rounded-[30px]
        border border-[#ebe3d4]
        bg-white
        p-7
        shadow-[0_12px_38px_rgba(27,34,40,0.055)]
        transition-all
        duration-500
        ease-out
        hover:-translate-y-1.5
        hover:border-[#d7b56f]
        hover:shadow-[0_24px_55px_rgba(27,34,40,0.11)]
        sm:p-8
      "
    >

      {/* Top glossy highlight */}
      <div
        className="
          pointer-events-none
          absolute inset-x-0 top-0 h-[42%]
          bg-gradient-to-b
          from-white
          via-white/70
          to-transparent
        "
      />

      {/* Warm lower-edge shading */}
      <div
        className="
          pointer-events-none
          absolute inset-x-0 bottom-0 h-24
          bg-gradient-to-t
          from-[#fbf8f1]/80
          to-transparent
        "
      />

      {/* Subtle gold edge */}
      <div
        className="
          pointer-events-none
          absolute inset-0
          rounded-[30px]
          ring-1 ring-inset ring-[#c89b4d]/0
          transition-all duration-500
          group-hover:ring-[#c89b4d]/30
        "
      />

      <div className="relative z-10 flex h-full flex-col">

        {/* Top row */}
        <div className="flex items-center justify-between">

          <span
            className="
              text-[11px]
              font-medium
              tracking-[0.2em]
              text-[#b88832]
            "
          >
            {experience.id}
          </span>

          <div
            className="
              flex h-11 w-11
              items-center justify-center
              rounded-full
              border border-[#eee5d6]
              bg-[#fffdfa]
              text-[#bd8e3a]
              shadow-[0_4px_12px_rgba(50,40,20,0.03)]
              transition-all duration-500
              group-hover:border-[#d8b46b]
              group-hover:bg-[#fffaf0]
            "
          >
            <Icon
              size={20}
              strokeWidth={1.45}
            />
          </div>

        </div>

        {/* Main content */}
        <div className="mt-7">

          <Icon
            size={38}
            strokeWidth={1.25}
            className="
              text-[#c18e35]
              transition-transform
              duration-500
              group-hover:scale-[1.06]
            "
          />

          <h2
            className="
              mt-6
              max-w-[310px]
              font-serif
              text-[28px]
              leading-[1.06]
              tracking-[-0.025em]
              text-[#141d25]
              sm:text-[30px]
            "
          >
            {experience.title}
          </h2>

          <div
            className="
              mt-5 h-px w-8
              bg-[#c99a4b]
              transition-all duration-500
              group-hover:w-12
            "
          />

          <p
            className="
              mt-4
              max-w-[320px]
              font-sans
              text-[14px]
              leading-[1.65]
              text-[#737a80]
            "
          >
            {experience.description}
          </p>

        </div>

        {/* Arrow */}
        <div className="mt-auto flex justify-end pt-6">

          <span
            className="
              flex h-11 w-11
              items-center justify-center
              rounded-full
              border border-[#e9dfcb]
              bg-white
              text-[#b98631]
              shadow-[0_4px_12px_rgba(40,30,10,0.035)]
              transition-all
              duration-300
              group-hover:bg-[#c99a4b]
              group-hover:text-white
              group-hover:shadow-[0_7px_20px_rgba(170,120,30,0.2)]
            "
          >
            <ArrowUpRight
              size={18}
              strokeWidth={1.5}
            />
          </span>

        </div>

      </div>

    </a>
  );
}

/* =========================================================
   CENTER ARTIUM
========================================================= */

function ArtiumCenter() {
  return (
    <div
      className="
        pointer-events-none
        absolute left-1/2 top-1/2
        z-30
        hidden
        h-[170px] w-[170px]
        -translate-x-1/2
        -translate-y-1/2
        items-center justify-center
        lg:flex
      "
    >

      {/* Outer shadow */}
      <div
        className="
          absolute inset-0
          rounded-full
          bg-white
          shadow-[0_20px_55px_rgba(40,30,10,0.12)]
        "
      />

      {/* Gold outer ring */}
      <div
        className="
          absolute inset-0
          rounded-full
          border border-[#c99a4b]
        "
      />

      {/* Inner ring */}
      <div
        className="
          absolute inset-[9px]
          rounded-full
          border border-[#eee0c3]
        "
      />

      {/* Tiny architectural dots */}
      <span className="absolute top-[15px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#c99a4b]" />
      <span className="absolute bottom-[15px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#c99a4b]" />

      <div className="relative text-center">

        <div className="mx-auto mb-1 flex justify-center">
          <PinMark width={27} height={39} />
        </div>

        <div
          className="
            font-serif
            text-[25px]
            tracking-[-0.03em]
            text-[#b6812b]
          "
        >
          artium
        </div>

      </div>

    </div>
  );
}

/* =========================================================
   BENEFITS
========================================================= */

function Benefits() {
  return (
    <section className="mx-auto max-w-[1160px] px-5 pt-10 sm:px-8">

      <div
        className="
          grid
          overflow-hidden
          rounded-[28px]
          border border-[#eee7db]
          bg-white
          shadow-[0_14px_42px_rgba(25,32,38,0.05)]
          md:grid-cols-3
        "
      >

        {benefits.map((benefit, index) => (
          <Benefit
            key={benefit.title}
            benefit={benefit}
            index={index}
          />
        ))}

      </div>

    </section>
  );
}

function Benefit({ benefit, index }) {

  const Icon = benefit.icon;

  return (
    <div
      className={`
        flex items-center gap-5 p-7
        sm:p-8
        ${index !== 2 ? "border-b md:border-b-0 md:border-r border-[#eee7db]" : ""}
      `}
    >

      <div
        className="
          flex h-12 w-12 shrink-0
          items-center justify-center
          rounded-full
          border border-[#eee3d2]
          bg-[#fffdfa]
          text-[#bd8c35]
        "
      >
        <Icon
          size={21}
          strokeWidth={1.4}
        />
      </div>

      <div>

        <h3
          className="
            font-sans
            text-[15px]
            font-semibold
            text-[#1a2229]
          "
        >
          {benefit.title}
        </h3>

        <p
          className="
            mt-1
            text-[13px]
            leading-5
            text-[#7b8085]
          "
        >
          {benefit.description}
        </p>

      </div>

    </div>
  );
}

/* =========================================================
   LOGIN
========================================================= */

function LoginCTA({ onLogin }) {
  return (
    <section className="px-6 py-12 text-center sm:py-16">

      <p
        className="
          text-[14px]
          text-[#777e84]
        "
      >
        Already have an account?
      </p>

      <a
        href="/login"
        onClick={(e) => { e.preventDefault(); onLogin && onLogin(); }}
        className="
          group
          mt-5
          inline-flex
          min-w-[260px]
          items-center
          justify-center
          gap-5
          rounded-full
          bg-[#e5b85c]
          px-8 py-4
          font-sans
          text-[16px]
          font-medium
          text-[#151a1f]
          shadow-[0_12px_30px_rgba(185,135,45,0.18)]
          transition-all
          duration-300
          hover:-translate-y-1
          hover:bg-[#e8bc65]
          hover:shadow-[0_18px_38px_rgba(185,135,45,0.25)]
        "
      >
        Log in

        <ArrowUpRight
          size={18}
          strokeWidth={1.6}
          className="
            transition-transform
            duration-300
            group-hover:translate-x-0.5
            group-hover:-translate-y-0.5
          "
        />

      </a>

    </section>
  );
}

/* =========================================================
   FOOTER
========================================================= */

const ACT_INSTAGRAM = "https://www.instagram.com/aclassicaltone?igsh=MTZzdzk3bWo5OGdkbA==";

function Footer() {
  return (
    <footer
      className="
        mx-auto
        max-w-[1160px]
        border-t border-[#eee8dc]
        px-5 pb-8 pt-8
        sm:px-8
      "
    >

      <div
        className="
          flex flex-col gap-6
          md:flex-row
          md:items-center
          md:justify-between
        "
      >

        <div>

          <span className="text-[12px] text-[#8b8f93]">
            In partnership with
          </span>

          <span
            className="
              ml-3
              font-serif
              text-[19px]
              text-[#b98530]
            "
          >
            aclassicaltone
          </span>

        </div>

        <div className="flex gap-2">

          <SocialButton icon={Instagram} href={ACT_INSTAGRAM} label="aclassicaltone on Instagram" />
          <SocialButton icon={Facebook} href="#" label="Artium on Facebook" />

        </div>

      </div>

      <div
        className="
          mt-7
          flex flex-col
          gap-4
          border-t border-[#f0ece5]
          pt-5
          text-[12px]
          text-[#85898d]
          md:flex-row
          md:items-center
          md:justify-between
        "
      >

        <div className="flex gap-5">

          <a
            href="#about"
            className="transition-colors hover:text-[#b98530]"
          >
            About Us
          </a>

          <a
            href="#help"
            className="transition-colors hover:text-[#b98530]"
          >
            Help Center
          </a>

          <a
            href="#contact"
            className="transition-colors hover:text-[#b98530]"
          >
            Contact
          </a>

        </div>

        <span>
          © 2026 Artium. All rights reserved.
        </span>

      </div>

    </footer>
  );
}

function SocialButton({ icon: Icon, href, label }) {
  return (
    <a
      href={href}
      target={href && href !== "#" ? "_blank" : undefined}
      rel={href && href !== "#" ? "noreferrer" : undefined}
      aria-label={label}
      className="
        flex h-9 w-9
        items-center justify-center
        rounded-full
        border border-[#e9e1d2]
        text-[#b98731]
        transition-all
        hover:border-[#c99a4b]
        hover:bg-[#fffaf0]
      "
    >
      <Icon
        size={15}
        strokeWidth={1.5}
      />
    </a>
  );
}
