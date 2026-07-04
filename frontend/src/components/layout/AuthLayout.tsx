import React from 'react';
import { Outlet } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="relative flex items-center justify-center w-full min-h-screen bg-slate-950 px-4 overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-650/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card box */}
      <div className="relative w-full max-w-[440px] p-8 md:p-10 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-md">
        {/* Branding header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3 bg-primary-600 text-white rounded-2xl shadow-xl shadow-primary-950/40 mb-4 flex items-center justify-center">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            CAMPUS360 <span className="text-primary-400">ERP</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            CSE Department Academic Management System
          </p>
        </div>

        <Outlet />
      </div>
    </div>
  );
};
