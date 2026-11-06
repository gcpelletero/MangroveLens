// Decorative coastal illustration from the approved interface concept.
// This is never a satellite map, computed classification, or scientific result.
export default function CoastalIllustration() {
  return (
    <svg viewBox="0 0 850 700" preserveAspectRatio="xMidYMid slice"
      aria-hidden="true" style={{position:'absolute', inset:0, width:'100%', height:'100%'}}>
      <defs>
        <pattern id="ml-water-grid" width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M44 0H0V44" fill="none" stroke="#a7ccc5" strokeWidth="1" opacity=".35" />
        </pattern>
        <linearGradient id="ml-land" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#ebf0d9" />
          <stop offset="1" stopColor="#c9ddbb" />
        </linearGradient>
        <pattern id="ml-hatch" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <path d="M0 0V28" stroke="#82ad8c" strokeOpacity=".22" strokeWidth="4"/>
        </pattern>
      </defs>
      <rect width="850" height="700" fill="#d6eae6"/>
      <rect width="850" height="700" fill="url(#ml-water-grid)"/>
      <path d="M-90-30C109 61 231-12 274 89c28 67-54 124 19 175 98 68 43 124-1 159-35 28-40 89-9 130 28 37 18 101 74 160H-90Z"
        fill="url(#ml-land)" stroke="#a4c5a7" strokeWidth="4"/>
      <path d="M680-30C581 48 645 132 599 185c-42 49-159 65-133 144 18 53 81 77 79 147-1 48-44 76-4 128 22 30 35 62 43 106h335V-30Z"
        fill="url(#ml-land)" stroke="#aac8ad" strokeWidth="4"/>
      <path d="M-90-30C109 61 231-12 274 89c28 67-54 124 19 175 98 68 43 124-1 159-35 28-40 89-9 130 28 37 18 101 74 160H-90Z" fill="url(#ml-hatch)"/>
      <path d="M680-30C581 48 645 132 599 185c-42 49-159 65-133 144 18 53 81 77 79 147-1 48-44 76-4 128 22 30 35 62 43 106h335V-30Z" fill="url(#ml-hatch)"/>
      <g fill="none" stroke="#9bbc9c" strokeWidth="2" opacity=".7">
        <path d="M-60 86c149 7 219-33 258 48 40 81-67 132-10 184 59 54 15 143 4 208"/>
        <path d="M-60 136c122 5 173-26 188 44 20 90-67 113-8 191 43 57 11 130 18 189"/>
        <path d="M758-30c-111 80-60 184-119 238-45 41-110 48-98 111 10 46 72 91 70 165-2 59-40 91 9 170"/>
        <path d="M815-30c-100 80-51 188-112 246-36 34-117 49-93 121 15 47 67 86 63 154-4 66-39 95 1 162"/>
      </g>
      <path d="M265 180c-15 39 25 65 22 100-2 26-38 30-40 61m240 41c-10 31 33 61 34 100"
        fill="none" stroke="#5aa58c" strokeOpacity=".65" strokeWidth="9" strokeLinecap="round"/>
      <g opacity=".9" fill="none" strokeLinecap="round">
        <path d="M283 168c19 26 9 51 22 69" stroke="#e7bf34" strokeWidth="7"/>
        <path d="M275 238c13 17-1 37 14 57" stroke="#eb8743" strokeWidth="7"/>
        <path d="M461 322c-4 32 32 48 36 76" stroke="#337fd3" strokeWidth="9"/>
        <path d="M528 480c-19-23-14-46-19-67" stroke="#ca4aa3" strokeWidth="8"/>
      </g>
    </svg>
  );
}
