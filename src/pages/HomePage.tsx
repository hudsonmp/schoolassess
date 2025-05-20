import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronRight, Shield, Calculator, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center mb-6"
          >
            <img src="/school-assess-logo.png" alt="SchoolAssess" className="h-16 w-auto" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl mb-6"
          >
            School Insurance Claims,
            <span className="block text-green-600">Simplified</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto mb-8"
          >
            Making insurance claims more secure, precise,
            and fast for schools affected by natural disasters.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button 
              size="lg"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => navigate('/login')}
            >
              Get Started
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => {
                const featuresSection = document.getElementById('features');
                if (featuresSection) {
                  featuresSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              Learn More
            </Button>
          </motion.div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-32"
        >
          <h2 className="text-3xl font-bold text-center mb-16">
            Why Choose SchoolAssess?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <Shield className="h-12 w-12 text-green-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Secure Assessment</h3>
                <p className="text-gray-600">
                  Protect school assets with detailed digital inventory and valuation.
                </p>
              </Card>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <Calculator className="h-12 w-12 text-green-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Precise Valuation</h3>
                <p className="text-gray-600">
                  AI-powered assessment provides accurate value estimates for all school assets.
                </p>
              </Card>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <Zap className="h-12 w-12 text-green-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Fast Processing</h3>
                <p className="text-gray-600">
                  Quick and efficient claims processing to get schools back on track.
                </p>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 