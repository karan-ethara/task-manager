import React from 'react';

function HiveGlyph({ className = 'brand-glyph' }) {
  return (
    <svg className={className} viewBox="0 0 88 88" role="img" aria-label="WorkHive logo">
      <defs>
        <linearGradient id="workhiveGlow" x1="12%" y1="10%" x2="88%" y2="92%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="48%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="workhiveCore" x1="18%" y1="12%" x2="82%" y2="84%">
          <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.88" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="78" height="78" rx="24" fill="url(#workhiveGlow)" />
      <path d="M44 17 60.5 26.5v19L44 55 27.5 45.5v-19Z" fill="rgba(10, 15, 32, 0.22)" />
      <path d="M44 22 56 29v14L44 50 32 43V29Z" fill="url(#workhiveCore)" />
      <path d="M22 42.5 31 37v10l-9 5.5L13 47Z" fill="rgba(255,255,255,0.82)" />
      <path d="M66 37 75 42.5v4.5L66 52.5 57 47v-10Z" fill="rgba(255,255,255,0.82)" />
      <path d="M37.5 31.5 44 27l6.5 4.5v9L44 45l-6.5-4.5Z" fill="#0f172a" opacity="0.9" />
      <path d="M27 58.5 39 51.5l5 3 5-3 12 7-17 10Z" fill="rgba(15,23,42,0.28)" />
    </svg>
  );
}

export default function BrandLogo({ subtitle = 'Team workspace', className = '', showSubtitle = true, title = 'WorkHive' }) {
  return (
    <div className={`brand ${className}`.trim()}>
      <HiveGlyph />
      <div className="brand-copy">
        <strong>{title}</strong>
        {showSubtitle ? <span>{subtitle}</span> : null}
      </div>
    </div>
  );
}

