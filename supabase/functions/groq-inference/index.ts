import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// TypeScript declaration for Deno global
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Groq inference function started');
    
    // Get the Groq API key from environment variables (server-side)
    const groqApiKey = Deno.env.get('GROQ_API_KEY') || Deno.env.get('VITE_GROQ_API_KEY');
    if (!groqApiKey) {
      console.error('GROQ_API_KEY or VITE_GROQ_API_KEY environment variable is not set');
      console.error('Available env vars:', Object.keys(Deno.env.toObject()));
      throw new Error('GROQ_API_KEY or VITE_GROQ_API_KEY environment variable is not set');
    }
    console.log('Groq API key found:', groqApiKey.substring(0, 10) + '...');

    // Parse the request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      console.error('Failed to parse request body:', e);
      throw new Error('Invalid JSON in request body');
    }

    const { imageDataUrl } = requestBody;
    if (!imageDataUrl) {
      console.error('Missing imageDataUrl in request body');
      throw new Error('Missing imageDataUrl in request body');
    }
    console.log('Image data URL received, length:', imageDataUrl.length);

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

    // Make the request to Groq API with llama-4 model
    console.log('Making request to Groq API with llama-4 model');
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
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
        temperature: 0.2,
        max_tokens: 500
      })
    });

    console.log('Groq API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error response:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      throw new Error(`Groq API error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('Groq API response received successfully');
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    const content = data.choices[0].message.content;
    
    // Parse the JSON response from the model
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse model response:", e);
      console.error("Raw content:", content);
      throw new Error("Invalid response format from model");
    }

    const result = {
      itemName: parsedContent.mainItem.name,
      estimatedValue: parsedContent.mainItem.estimatedValue,
      detectedObjects: parsedContent.otherObjects || []
    };

    console.log('Successfully processed request, result:', JSON.stringify(result, null, 2));
    return new Response(JSON.stringify(result), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    console.error('Error in groq-inference function:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack || 'No stack trace available'
      }), 
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      }
    );
  }
}); 