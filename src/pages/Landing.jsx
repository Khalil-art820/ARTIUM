import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Globe2, Users } from 'lucide-react';
import { C, FONT_MONO, FONT_DISPLAY, FONT_BODY } from '../lib/constants';
import { SAMPLE_STUDENTS } from '../lib/constants';
import Logo from '../components/ui/Logo';
import Avatar from '../components/ui/Avatar';
import { PrimaryBtn, GhostBtn } from '../components/ui/Buttons';
import MusicBtn from '../components/ui/MusicBtn';
import WorldMap from '../components/map/WorldMap';
import { useAuth } from '../contexts/AuthContext';

export default function Landing({ musicOn, onMusicToggle, audioRef }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const handleApply = () => navigate('/signup');
  const handlePreview = () => navigate('/app');
  const handleProfile = () => navigate('/app/profile');

  // Compute mock student distribution for the world map preview
  const studentsByCons = SAMPLE_STUDENTS.reduce((a, s) => {
    (a[s.conservatoryId] = a[s.conservatoryId] || []).push(s);
    return a;
  }, {});

  return (
    <div style={{ color: C.ivory, minHeight: '100vh', background: C.ink }}>
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <Logo slogan />
        <div className="hidden sm:flex items-center gap-3">
          <MusicBtn playing={musicOn} onToggle={onMusicToggle} audioRef={audioRef} />
          {user ? (
            <>
              <GhostBtn onClick={handleProfile} icon={Users}>My profile</GhostBtn>
              <Avatar name={profile?.name || user.email} id={user.id} size={38} photoUrl={profile?.photoUrl} online />
            </>
          ) : (
             <GhostBtn onClick={() => navigate('/login')} icon={Users}>Log in</GhostBtn>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p style={{ fontFamily: FONT_MONO, color: C.brass, letterSpacing: 1.5, fontSize: 12 }}>FOR CONSERVATORY PIANISTS</p>
          <h1 className="mt-4" style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(38px,5.5vw,64px)", lineHeight: 1.05, fontWeight: 600 }}>
            Every conservatory.<br />One place.
          </h1>
          <p className="mt-6 max-w-md" style={{ color: C.ivoryDim, fontSize: 17, lineHeight: 1.6 }}>
            Artium connects piano students across the world's conservatories — share repertoire, technical language, interpretation traditions, exam culture, musical tastes and more. Message one another, conservatory to conservatory!
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {!user && <PrimaryBtn onClick={handleApply} icon={ArrowRight}>Sign up</PrimaryBtn>}
            <span className="text-xs" style={{ color: C.ivoryDim, fontFamily: FONT_MONO }}>
               {user ? "You're signed in." : "Free to join."}
            </span>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.inkLine}`, background: C.inkSoft }}>
          <div className="px-5 pt-4 pb-2">
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, color: C.ivory, letterSpacing: 0.2, lineHeight: 1.4 }}>
              The Artium Network <span style={{ color: C.ivoryDim, fontWeight: 400 }}>— Bridging Musicians Worldwide</span>
            </h3>
          </div>
          <WorldMap selectedId={null} onSelect={() => {}} studentsByCons={studentsByCons} height={300} />
          <div className="flex items-center justify-center py-4">
            <button
              onClick={handlePreview}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5"
              style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 15, color: C.ivory, border: `1px solid ${C.inkLine}`, background: "transparent" }}
            >
              <Globe2 size={15} /> Explore the map
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600 }}>How it works</h2>
        <div className="mt-8 grid sm:grid-cols-4 gap-8">
          {[
            { m: "I", t: "Submit your information", d: "Build your profile — conservatory, repertoire, preferences — and optionally link a performance video." },
            { m: "II", t: "Take your seat on the map", d: "Once accepted, you appear under your conservatory, alongside pianists studying there now." },
            { m: "III", t: "Connect across borders", d: "Message students at any conservatory in the world." },
            { m: "IV", t: "Earn while you teach", d: "Accept tutoring requests from amateur piano enthusiasts and start earning money." },
          ].map((s) => (
            <div key={s.m}>
              <p style={{ fontFamily: FONT_MONO, color: C.brass, fontSize: 13 }}>Step {s.m}</p>
              <h3 className="mt-2" style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 600 }}>{s.t}</h3>
              <p className="mt-2 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8 text-xs" style={{ color: C.ivoryDim, fontFamily: FONT_MONO }}>
        Prototype — for demonstration purposes only.
      </div>
    </div>
  );
}
