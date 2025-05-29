import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    // Get the Groq API key from environment variables (server-side)
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }

    // Parse the request body
    const { imageDataUrl } = await req.json();
    if (!imageDataUrl) {
      throw new Error('Missing imageDataUrl in request body');
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

    // Make the request to Groq API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
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
        temperature: 0.2,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Groq API error:', errorData);
      throw new Error(`Groq API error: ${errorData.error?.message || response.statusText}`);
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

    const result = {
      itemName: parsedContent.mainItem.name,
      estimatedValue: parsedContent.mainItem.estimatedValue,
      detectedObjects: parsedContent.otherObjects || []
    };

    return new Response(JSON.stringify(result), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    console.error('Error in groq-inference function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
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