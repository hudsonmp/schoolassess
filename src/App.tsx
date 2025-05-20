import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import { NavigationMenu, NavigationMenuItem, NavigationMenuList } from '@/components/ui/navigation-menu';

import HomePage from '@/pages/HomePage';
import AuthPage from '@/pages/AuthPage';
import DashboardPage from '@/pages/DashboardPage';
import AdminPage from '@/pages/AdminPage';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

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
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const Header = () => (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"
    >
      <div className="container flex h-14 items-center">
        <img 
          src="/image copy.png" 
          alt="SchoolAssess" 
          className="h-8 w-auto cursor-pointer mr-8" 
          onClick={() => navigate('/')}
        />
        
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Button 
                variant={location.pathname === '/' ? 'default' : 'ghost'}
                onClick={() => navigate('/')}
              >
                Home
              </Button>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Button 
                variant={location.pathname === '/dashboard' ? 'default' : 'ghost'}
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </Button>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="ml-auto">
          {session ? (
            <Button variant="default" onClick={handleSignOut}>Sign Out</Button>
          ) : (
            location.pathname !== '/login' && (
              <Button variant="default" onClick={() => navigate('/login')}>Sign In</Button>
            )
          )}
        </div>
      </div>
    </motion.div>
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