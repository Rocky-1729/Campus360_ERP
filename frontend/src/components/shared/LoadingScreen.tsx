import React from 'react';
import { GraduationCap } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm text-center">
      <div className="relative flex items-center justify-center">
        {/* Outer pulsating ring */}
        <div className="absolute w-16 h-16 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
        {/* Brand symbol in center */}
        <div className="p-3 bg-primary-600 text-white rounded-2xl shadow-xl shadow-primary-950/40 relative z-10 flex items-center justify-center">
          <GraduationCap className="w-6 h-6 animate-pulse" />
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-400 mt-4 tracking-wider uppercase animate-pulse">
        Loading Campus360...
      </p>
    </div>
  );
};
