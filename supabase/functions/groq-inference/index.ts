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
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      console.error('GROQ_API_KEY environment variable is not set');
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
    console.log('Groq API key found');

    // Parse the request body
    const { imageDataUrl } = await req.json();
    if (!imageDataUrl) {
      console.error('Missing imageDataUrl in request body');
      throw new Error('Missing imageDataUrl in request body');
    }
    console.log('Image data URL received');

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

    // Make the request to Groq API with updated model
    console.log('Making request to Groq API');
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
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

    console.log('Successfully processed request');
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