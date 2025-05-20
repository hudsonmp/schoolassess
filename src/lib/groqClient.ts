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

/**
 * Performs image inference using Groq's Llama-4-Maverick model.
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

  try {
    // Convert base64 image to text description for Llama model
    const imageDescription = await getImageDescription(imageDataUrl);

    // Prepare the prompt for object detection and valuation
    const systemPrompt = `You are an expert in identifying and valuing school assets. 
    When given a description of an image, identify the main item and estimate its value based on current market prices. 
    Also identify any other relevant items in the image. 
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

    const response = await fetch(GROQ_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VITE_GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-maverick-17b-128e-instruct",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Please identify and value the main item in this image, along with any other relevant items you can detect. Here's the image description: ${imageDescription}`
          }
        ],
        temperature: 0.2, // Lower temperature for more consistent valuations
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const data = await response.json();
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
    console.error("Error during Groq inference:", error);
    throw error;
  }
};

// Helper function to get image description using a separate API call
// You'll need to implement this using a vision model API of your choice
// For example: Azure Computer Vision, Google Cloud Vision, or similar
async function getImageDescription(imageDataUrl: string): Promise<string> {
  // TODO: Implement image description using a vision API
  // For now, return a basic description
  return "A photograph showing a school asset";
} 