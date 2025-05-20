import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

import HomePage from '@/pages/HomePage';
import AuthPage from '@/pages/AuthPage';
import DashboardPage from '@/pages/DashboardPage';
import AdminPage from '@/pages/AdminPage';
import { Button } from '@/components/ui/button'; // Assuming shadcn button is available
import { Toaster } from '@/components/ui/sonner'; // Assuming shadcn sonner for notifications

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_IN' && location.pathname === '/login') {
        navigate('/dashboard');
      } else if (_event === 'SIGNED_OUT') {
        navigate('/');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error);
    // Navigation is handled by onAuthStateChange
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>; // Replace with a nice spinner
  }

  // Basic header for navigation and sign out
  const Header = () => (
    <header className="p-4 bg-primary text-primary-foreground flex justify-between items-center sticky top-0 z-50">
      <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate('/')}>SchoolAssess</h1>
      <div>
        {session ? (
          <Button variant="secondary" onClick={handleSignOut}>Sign Out</Button>
        ) : (
          location.pathname !== '/login' && (
            <Button variant="secondary" onClick={() => navigate('/login')}>Sign In</Button>
          )
        )}
      </div>
    </header>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={!session ? <AuthPage /> : <Navigate to="/dashboard" />} />
          <Route 
            path="/dashboard" 
            element={session ? <DashboardPage /> : <Navigate to="/login" />} 
          />
          <Route path="/admin/:adminAccessKey" element={<AdminPage />} /> 
          {/* Add a 404 page later */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <Toaster />
      <footer className="p-4 text-center text-muted-foreground text-sm border-t">
        © {new Date().getFullYear()} SchoolAssess. Secure, Precise, Fast.
      </footer>
    </div>
  );
}

export default App; 