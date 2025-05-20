// VITE_GROQ_API_KEY should be set in .env for client-side calls.
// For production, consider proxying through a Supabase Edge Function to protect the key.
const VITE_GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

if (!VITE_GROQ_API_KEY) {
  console.warn("Groq API Key (VITE_GROQ_API_KEY) is missing for client-side use. Mock data will be used.");
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

const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Performs image inference using Groq's Llama-4-Maverick model which directly supports vision capabilities.
 * Sends the image data to Groq API and processes the response.
 */
export const inferImageWithGroq = async (imageDataUrl: string): Promise<GroqInferenceResult> => {
  if (!VITE_GROQ_API_KEY) {
    console.warn("VITE_GROQ_API_KEY not found, returning mock data.");
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          itemName: "Sample Item (Mocked)",
          estimatedValue: Math.floor(Math.random() * 1000) + 50,
          detectedObjects: []
        });
      }, 1000);
    });
  }

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay`);
        await sleep(delay);
      }

      // Prepare the prompt for object detection and valuation
      const systemPrompt = `You are an expert in identifying and valuing school assets. 
      When shown an image, identify the main item and estimate its value based on current market prices. 
      Also detect any other relevant items in the image. 
      Format your response as a JSON object with the following structure:
      {
        "mainItem": {
          "name": "item name",
          "estimatedValue": numeric value in USD
        },
        "otherObjects": [
          {
            "name": "object name",
            "estimatedValue": numeric value in USD,
            "confidence": confidence score between 0 and 1
          }
        ]
      }`;

      console.log(`Calling Groq API (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      const response = await fetch(GROQ_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VITE_GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-maverick-17b-128e-instruct",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Please identify and value the main item in this image, along with any other relevant items you can detect."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl
                  }
                }
              ]
            }
          ],
          temperature: 0.2, // Lower temperature for more consistent valuations
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Groq API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });

        // If it's a 503 error or other server error, throw to trigger retry
        if (response.status >= 500) {
          throw new Error(`Groq API server error (${response.status}): ${errorData.error?.message || 'Service temporarily unavailable'}`);
        }

        // For other errors (400s), throw without retry
        throw new Error(`Groq API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('Groq API response:', data);
      
      const content = data.choices[0].message.content;
      
      // Parse the JSON response from the model
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse model response:", e);
        throw new Error("Invalid response format from model");
      }

      return {
        itemName: parsedContent.mainItem.name,
        estimatedValue: parsedContent.mainItem.estimatedValue,
        detectedObjects: parsedContent.otherObjects || []
      };

    } catch (error) {
      console.error(`Error during Groq inference (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
      lastError = error as Error;
      
      // If it's not a server error (not 5xx), don't retry
      if (error instanceof Error && !error.message.includes('server error')) {
        throw error;
      }
      
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

 