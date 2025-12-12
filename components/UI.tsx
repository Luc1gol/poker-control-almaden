import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { title?: string; noPadding?: boolean; action?: React.ReactNode }> = ({ children, className = "", title, noPadding = false, action, ...props }) => (
  <div className={`bg-poker-surface border border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col ${className}`} {...props}>
    {title && (
      <div className="bg-black/40 px-4 py-3 border-b border-white/5 shrink-0 flex justify-between items-center">
        <h3 className="text-white font-bold uppercase tracking-wider text-sm">{title}</h3>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className={`flex-1 min-h-0 ${noPadding ? '' : 'p-4'}`}>{children}</div>
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'outline' }> = ({ 
  children, variant = 'primary', className = "", ...props 
}) => {
  const base = "px-4 py-2 rounded-lg font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-gradient-to-b from-poker-red to-poker-redDark text-white shadow-lg shadow-red-900/50 hover:brightness-110",
    secondary: "bg-white text-poker-black hover:bg-gray-100",
    danger: "bg-red-900/50 border border-red-500/50 text-red-200 hover:bg-red-900",
    outline: "border border-white/20 text-white hover:bg-white/5"
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = "", ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-xs uppercase text-gray-400 font-bold tracking-wide">{label}</label>}
    <input 
      className={`bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-poker-red transition-colors placeholder-gray-600 ${className}`}
      {...props}
    />
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode; type?: 'success' | 'warning' | 'neutral' }> = ({ children, type = 'neutral' }) => {
  const colors = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    neutral: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[type]}`}>
      {children}
    </span>
  );
};