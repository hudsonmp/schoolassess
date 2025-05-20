import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { supabase } from '@/lib/supabaseClient';
import { inferImageWithGroq } from '@/lib/groqClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Camera, RefreshCcw, Send, CheckCircle, AlertTriangle, Plus, Minus, Loader2, ListChecks, UploadCloud } from 'lucide-react';
import { toast } from "sonner";

interface School {
  id: string;
  name: string;
  city: string;
}

interface ScannedItem {
  id?: string;
  name: string;
  estimated_value: number;
  quantity: number;
  image_url?: string;
  school_id: string;
}

interface DetectedObject {
  name: string;
  estimatedValue: number;
  confidence: number;
}

const AdminPage = () => {
  const { adminAccessKey } = useParams<{ adminAccessKey: string }>();
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [isValidKey, setIsValidKey] = useState<boolean | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [inferenceResult, setInferenceResult] = useState<{ itemName: string; estimatedValue: number } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isInferring, setIsInferring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [scannedItemsToday, setScannedItemsToday] = useState<ScannedItem[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [selectedObjectIndex, setSelectedObjectIndex] = useState<number>(0);

  // Request camera permission on mount
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        // stream.getTracks().forEach(track => track.stop()); // Stop immediately if not needed yet
        console.log("Camera permission granted");
      })
      .catch(err => {
        console.error("Camera permission denied:", err);
        toast.error("Camera permission is required to scan items. Please enable it in your browser settings.");
      });
  }, []);

  useEffect(() => {
    const fetchSchool = async () => {
      if (!adminAccessKey) {
        setIsValidKey(false);
        setLoadingSchool(false);
        return;
      }
      setLoadingSchool(true);
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, city')
        .eq('admin_access_key', adminAccessKey)
        .single();

      if (error || !data) {
        console.error("Error fetching school or invalid key:", error);
        setIsValidKey(false);
        setSchool(null);
        toast.error("Invalid admin access link or failed to load school details.");
      } else {
        setIsValidKey(true);
        setSchool(data as School);
        fetchScannedItemsToday(data.id);
      }
      setLoadingSchool(false);
    };
    fetchSchool();
  }, [adminAccessKey]);

  const fetchScannedItemsToday = async (schoolId: string) => {
    const {data, error} = await supabase
      .from('items')
      .select('id, name, estimated_value, quantity, image_url')
      .eq('school_id', schoolId)
      .order('created_at', {ascending: false}); 
    if (data) {
      setScannedItemsToday(data.map(d => ({ 
        id: d.id, 
        name: d.name, 
        estimated_value: d.estimated_value,
        quantity: d.quantity,
        image_url: d.image_url,
        school_id: schoolId 
      } as ScannedItem)));
    }
  };

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setInferenceResult(null); // Clear previous inference
      setQuantity(1); // Reset quantity
      if (imageSrc) {
        handleInference(imageSrc);
      }
    }
  }, [webcamRef]);

  const handleInference = async (imageDataUrl: string) => {
    setIsInferring(true);
    toast.info("Analyzing item... Please wait.", { icon: <Loader2 className="animate-spin" /> });
    try {
      const result = await inferImageWithGroq(imageDataUrl);
      setInferenceResult({
        itemName: result.itemName,
        estimatedValue: result.estimatedValue
      });
      setDetectedObjects([
        { 
          name: result.itemName, 
          estimatedValue: result.estimatedValue,
          confidence: 1 
        },
        ...result.detectedObjects
      ]);
      setSelectedObjectIndex(0);
      toast.success(`Items detected: ${result.itemName} and ${result.detectedObjects.length} other objects`, { icon: <CheckCircle /> });
    } catch (error) {
      console.error("Error during Groq inference:", error);
      toast.error("Could not identify item. Please try again.", { icon: <AlertTriangle /> });
      setInferenceResult(null);
      setDetectedObjects([]);
    } finally {
      setIsInferring(false);
    }
  };

  const handleObjectSelect = (index: number) => {
    setSelectedObjectIndex(index);
    const object = detectedObjects[index];
    setInferenceResult({
      itemName: object.name,
      estimatedValue: object.estimatedValue
    });
  };

  const handleSaveItem = async () => {
    if (!inferenceResult || !school || !capturedImage) {
      toast.error("No item data to save. Please capture and identify an item first.");
      return;
    }
    setIsSaving(true);
    toast.info("Saving item...", { icon: <Loader2 className="animate-spin" /> });

    try {
      // Convert the captured image to a more efficient format if needed
      const compressedImage = capturedImage; // You might want to add image compression here

      const newItem = {
        name: inferenceResult.itemName,
        estimated_value: inferenceResult.estimatedValue,
        quantity: quantity,
        image_url: compressedImage,
        school_id: school.id,
      };

      const { data, error } = await supabase
        .from('items')
        .insert(newItem)
        .select('id, name, estimated_value, quantity, image_url, school_id');

      if (error) {
        console.error("Error saving item:", error);
        toast.error(`Failed to save item: ${error.message}`);
      } else if (data) {
        toast.success(`${inferenceResult.itemName} (x${quantity}) saved successfully!`);
        setScannedItemsToday(prevItems => [data[0], ...prevItems]);
        handleNextItem(); // Clear for next scan
      }
    } catch (err) {
      console.error("Error in handleSaveItem:", err);
      toast.error("Failed to save item. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextItem = () => {
    setCapturedImage(null);
    setInferenceResult(null);
    setQuantity(1);
    setIsInferring(false);
    setIsSaving(false);
    if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.srcObject) {
        // Ensure camera stream is active
    } else {
        // Re-request or re-initialize camera if necessary, or guide user
        console.log("Camera stream not active for next item, might need re-init");
    }
  };

  if (loadingSchool) {
    return <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center"><Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p>Loading school details...</p></div>;
  }

  if (isValidKey === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Invalid Access Link</h1>
        <p className="text-muted-foreground mb-4">The admin access link is invalid or has expired.</p>
        <Button onClick={() => navigate('/')}>Go to Homepage</Button>
      </div>
    );
  }

  if (!school) {
    // Should be covered by isValidKey === false, but as a fallback
    return <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">Error loading school information.</div>;
  }
  
  if (showSummary) {
    const totalValue = scannedItemsToday.reduce((sum, item) => sum + item.estimated_value * item.quantity, 0);
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Scan Summary for {school.name}</CardTitle>
            <CardDescription>Items scanned in this session.</CardDescription>
          </CardHeader>
          <CardContent>
            {scannedItemsToday.length === 0 ? (
              <p className="text-muted-foreground">No items scanned yet in this session.</p>
            ) : (
              <ul className="divide-y divide-border">
                {scannedItemsToday.map((item, index) => (
                  <li key={item.id || index} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.name} (x{item.quantity})</p>
                      <p className="text-sm text-primary">Value: ${item.estimated_value.toLocaleString()} each</p>
                    </div>
                    <p className="text-lg font-semibold">Total: ${(item.estimated_value * item.quantity).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 pt-4 border-t">
                <p className="text-xl font-bold text-right">Session Total Value: ${totalValue.toLocaleString()}</p>
            </div>
            <Button onClick={() => setShowSummary(false)} className="w-full mt-6" variant="outline">
              Back to Camera Scanner
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-2 md:p-6 min-h-[calc(100vh-150px)]">
      <h1 className="text-2xl md:text-3xl font-bold mb-1 text-primary">Item Scanner</h1>
      <p className="text-sm text-muted-foreground mb-4">For: <span className="font-semibold">{school.name}, {school.city}</span></p>

      <Card className="w-full max-w-lg mb-4 relative overflow-hidden">
        {isInferring && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-20">
            <Loader2 className="h-10 w-10 animate-spin text-white"/>
            <p className="text-white mt-2">Identifying item...</p>
          </div>
        )}
        <CardContent className="p-2 md:p-4">
          <div className="relative">
            {!capturedImage ? (
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "environment" }}
                  className="w-full h-full object-cover rounded-md"
                  onUserMediaError={(error: string | DOMException) => {
                    console.error("Webcam error:", error);
                    const errorMessage = typeof error === 'string' ? error : error.message;
                    toast.error("Could not access camera. Please check permissions.", {description: errorMessage});
                  }}
                />
              </div>
            ) : (
              <div className="relative">
                <img src={capturedImage} alt="Captured item" className="w-full h-auto rounded-md aspect-video object-cover" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!capturedImage ? (
        <Button onClick={capture} size="lg" className="w-full max-w-lg mb-4" disabled={isInferring}>
          <Camera className="mr-2 h-5 w-5" /> Capture Item
        </Button>
      ) : (
        <div className="w-full max-w-lg space-y-3 mb-4">
          {detectedObjects.length > 0 && (
            <Card className="bg-accent/50">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-lg">Detected Items:</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-4">
                <div className="flex space-x-2 overflow-x-auto py-2 scrollbar-thin scrollbar-thumb-primary scrollbar-track-transparent">
                  {detectedObjects.map((object, index) => (
                    <Button
                      key={index}
                      variant={selectedObjectIndex === index ? "default" : "outline"}
                      className="flex-shrink-0"
                      onClick={() => handleObjectSelect(index)}
                    >
                      {object.name}
                      {object.confidence < 1 && (
                        <span className="ml-2 text-xs opacity-70">
                          {Math.round(object.confidence * 100)}%
                        </span>
                      )}
                    </Button>
                  ))}
                </div>

                <div className="space-y-1">
                  <p className="text-xl font-semibold text-primary">{inferenceResult?.itemName}</p>
                  <p className="text-md">Estimated Value: <span className="font-semibold">${inferenceResult?.estimatedValue.toLocaleString()}</span></p>
                  <div className="flex items-center space-x-2 pt-2">
                    <Label htmlFor="quantity" className="text-sm">Quantity:</Label>
                    <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4"/></Button>
                    <Input 
                      type="number" 
                      id="quantity" 
                      value={quantity} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} 
                      className="w-16 text-center h-9"
                    />
                    <Button variant="outline" size="icon" onClick={() => setQuantity(q => q + 1)}><Plus className="h-4 w-4"/></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => { 
              setCapturedImage(null); 
              setInferenceResult(null);
              setDetectedObjects([]);
            }} variant="outline" disabled={isSaving || isInferring}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Retake
            </Button>
            <Button onClick={handleSaveItem} disabled={!inferenceResult || isSaving || isInferring}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />}
              Save & Add to List
            </Button>
          </div>
          {scannedItemsToday.length > 0 && inferenceResult && (
            <Button onClick={handleNextItem} variant="default" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={isSaving || isInferring}>
              <Send className="mr-2 h-4 w-4" /> Scan Next Item
            </Button>
          )}
        </div>
      )}
      
      {scannedItemsToday.length > 0 && (
         <Button onClick={() => setShowSummary(true)} variant="ghost" className="w-full max-w-lg mt-2 text-primary">
            <ListChecks className="mr-2 h-4 w-4"/> View Scanned Items ({scannedItemsToday.length}) & Finish
        </Button>
      )}
    </div>
  );
};

export default AdminPage; 