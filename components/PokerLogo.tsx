import React from 'react';

interface PokerLogoProps {
  className?: string;
  size?: number;
}

export const PokerLogo: React.FC<PokerLogoProps> = ({ className = "", size = 48 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* Container Glow */}
      <div className="absolute inset-0 bg-poker-red/20 blur-xl rounded-full" />
      
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-2xl"
      >
        {/* Background Circle */}
        <circle cx="50" cy="50" r="48" fill="#111" stroke="#333" strokeWidth="1" />
        
        {/* The Spade Shape */}
        <path 
          d="M50 12 C50 12 90 52 90 70 C90 85 75 88 50 62 C25 88 10 85 10 70 C10 52 50 12 50 12 Z" 
          fill="#d0021b"
        />
        
        {/* The Stem */}
        <path 
          d="M44 65 Q50 60 56 65 L62 88 L38 88 L44 65 Z" 
          fill="#d0021b" 
        />

        {/* The Star */}
        <path 
          d="M50 38 L54 50 L66 50 L57 58 L60 70 L50 63 L40 70 L43 58 L34 50 L46 50 Z" 
          fill="white" 
        />
        
        {/* The decorative bar below the star */}
        <rect x="42" y="76" width="16" height="3" rx="1.5" fill="white" />
      </svg>
    </div>
  );
};