// Updated to use Supabase Edge Function for secure API calls
import { supabase } from './supabaseClient';

// VITE_GROQ_API_KEY should be set in .env for client-side calls.
// For production, consider proxying through a Supabase Edge Function to protect the key.
const VITE_GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

if (!VITE_GROQ_API_KEY) {
  console.warn("Groq API Key (VITE_GROQ_API_KEY) is missing for client-side use. Mock data will be used.");
} else {
  console.log("Groq API Key found:", VITE_GROQ_API_KEY ? `${VITE_GROQ_API_KEY.substring(0, 10)}...` : 'undefined');
}

interface GroqInferenceResult {
  itemName: string;
  estimatedValue: number;
  detectedObjects: Array<{
    name: string;
    estimatedValue: number;
    confidence: number;
  }>;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Performs image inference using Groq's Llava vision model via Supabase Edge Function.
 * This approach keeps API keys secure on the server-side and handles CORS properly.
 */
export const inferImageWithGroq = async (imageDataUrl: string): Promise<GroqInferenceResult> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay`);
        await sleep(delay);
      }

      console.log(`Calling Supabase Edge Function (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      
      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('groq-inference', {
        body: {
          imageDataUrl: imageDataUrl
        }
      });

      if (error) {
        console.error('Supabase Edge Function error:', error);
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from Edge Function');
      }

      // The Edge Function returns the result directly
      return data as GroqInferenceResult;

    } catch (error) {
      console.error(`Error during Groq inference (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
      lastError = error as Error;
      
      // On last attempt, throw the error
      if (attempt === MAX_RETRIES - 1) {
        throw new Error(`Failed to reach Groq API after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`);
      }
      // Otherwise, continue to next retry attempt
    }
  }

  // This should never be reached due to the throw in the last retry attempt
  throw new Error('Unexpected error in retry loop');
};

 