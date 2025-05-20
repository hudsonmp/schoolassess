import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { NavigationMenu, NavigationMenuItem, NavigationMenuList } from '@/components/ui/navigation-menu';

export function NavigationBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"
    >
      <div className="container flex h-14 items-center">
        <img 
          src="/school-assess-logo.png" 
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
          {location.pathname !== '/auth' && (
            <Button 
              variant="default" 
              onClick={() => navigate('/auth')}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
} 