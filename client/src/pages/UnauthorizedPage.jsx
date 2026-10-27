import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import Button from '../components/ui/Button';

export const UnauthorizedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md space-y-6 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-red-500/15 border-2 border-red-500/30 flex items-center justify-center text-red-400 mx-auto shadow-lg">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Access Denied
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            You do not possess the required administrative clearance or role permissions to view this protected resource.
          </p>
        </div>

        <div className="pt-2 flex justify-center space-x-3">
          <Button
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>

          <Button
            variant="primary"
            icon={Home}
            onClick={() => navigate('/')}
            className="shadow-glow"
          >
            Home Portal
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
