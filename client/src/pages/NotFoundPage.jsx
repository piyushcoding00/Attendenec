import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';

export const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md space-y-5 animate-fade-in">
        {/* Large 404 Gradient */}
        <h1 className="text-8xl sm:text-9xl font-black tracking-tighter bg-gradient-to-r from-primary-500 via-cyan-400 to-indigo-400 bg-clip-text text-transparent leading-none">
          404
        </h1>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Page Not Found
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            The page you are looking for doesn't exist, has been relocated, or is temporarily unavailable.
          </p>
        </div>

        <div className="pt-4 flex justify-center space-x-3">
          <Link to="/">
            <Button variant="primary" icon={Home} className="shadow-glow px-6">
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
