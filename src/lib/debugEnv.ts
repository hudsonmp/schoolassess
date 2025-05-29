/**
 * Debug utility to check environment variables in production
 * This helps identify if the API key is properly loaded in Vercel
 */
export const debugEnvironment = () => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  
  console.log('=== Environment Debug Info ===');
  console.log('NODE_ENV:', import.meta.env.MODE);
  console.log('VITE_GROQ_API_KEY exists:', !!apiKey);
  console.log('VITE_GROQ_API_KEY length:', apiKey?.length || 0);
  console.log('VITE_GROQ_API_KEY starts with gsk_:', apiKey?.startsWith('gsk_') || false);
  console.log('VITE_GROQ_API_KEY preview:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined');
  
  // Check all VITE_ environment variables
  const viteEnvVars = Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'));
  console.log('All VITE_ env vars:', viteEnvVars);
  
  return {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    isValidFormat: apiKey?.startsWith('gsk_') || false,
    preview: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined'
  };
}; 