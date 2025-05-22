import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  ExternalLink,
  Copy,
  Trash2,
  Eye
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";

interface School {
  id: string;
  name: string;
  city: string;
  admin_access_key: string;
  total_estimated_value?: number;
  item_count?: number;
}

interface Item {
  id: string;
  name: string;
  estimated_value: number;
  quantity: number;
  school_id: string;
}

export default function DashboardPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolItems, setSelectedSchoolItems] = useState<Item[]>([]);
  const [selectedSchoolForItems, setSelectedSchoolForItems] = useState<School | null>(null);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolCity, setNewSchoolCity] = useState('');
  const [addingSchool, setAddingSchool] = useState(false);

  useEffect(() => {
    fetchSchoolsAndItems();
  }, []);

  const ensureUserProfileExists = async (userId: string, userEmail?: string) => {
    try {
      const { error: profileError } = await supabase
        .from('profiles') // Assuming 'profiles' table
        .select('id')
        .eq('id', userId)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') { // PGRST116: "Searched item was not found"
          // Profile does not exist, create it
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([{ id: userId, email: userEmail }]) // Add other necessary default fields if any
            .select();
          
          if (insertError) {
            console.error("Error creating profile:", insertError);
            toast.error("Failed to automatically create user profile: " + insertError.message);
            throw insertError; 
          } else {
            toast.info("User profile created automatically.");
          }
        } else {
          // Another error occurred while fetching profile
          console.error("Error checking profile:", profileError);
          toast.error("Failed to check user profile: " + profileError.message);
          throw profileError;
        }
      }
      // Profile exists or was successfully created
    } catch (error) {
      // Rethrow or handle as appropriate for your app's error handling strategy
      console.error("EnsureUserProfileExists failed:", error);
      throw error;
    }
  };

  const fetchSchoolsAndItems = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      console.error("User not authenticated", sessionError);
      toast.error("Authentication error. Please sign in again.");
      // Potentially redirect to login or handle appropriately
      return;
    }
    const userId = sessionData.session.user.id;
    const userEmail = sessionData.session.user.email;

    try {
      // Ensure user profile exists before proceeding
      await ensureUserProfileExists(userId, userEmail);
    } catch (profileError) {
      // If profile check/creation fails, stop further execution
      // The error is already toasted by ensureUserProfileExists
      return;
    }

    // Fetch schools
    const { data: schoolsData, error: schoolsError } = await supabase
      .from('schools')
      .select('id, name, city, admin_access_key')
      .eq('insurance_company_id', userId);

    if (schoolsError) {
      console.error("Error fetching schools:", schoolsError);
      toast.error("Failed to fetch schools: " + schoolsError.message);
    } else if (schoolsData) {
      // Fetch items for each school to calculate total value and count
      const schoolsWithAggregates = await Promise.all(schoolsData.map(async (school) => {
        const { data: itemsData, count } = await supabase
          .from('items')
          .select('estimated_value, quantity', { count: 'exact' })
          .eq('school_id', school.id);
        
        let totalValue = 0;
        if (itemsData) {
          totalValue = itemsData.reduce((sum, item) => sum + (item.estimated_value * item.quantity), 0);
        }
        return { ...school, total_estimated_value: totalValue, item_count: count || 0 };
      }));
      setSchools(schoolsWithAggregates);
    }
  };

  const handleAddSchool = async () => {
    if (!newSchoolName.trim() || !newSchoolCity.trim()) {
      toast.error("School name and city cannot be empty.");
      return;
    }
    setAddingSchool(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast.error("Not authenticated.");
      setAddingSchool(false);
      return;
    }

    const adminKey = uuidv4();
    const { data, error } = await supabase
      .from('schools')
      .insert([{ 
        name: newSchoolName,
        city: newSchoolCity,
        admin_access_key: adminKey,
        insurance_company_id: sessionData.session.user.id
      }])
      .select();

    if (error) {
      console.error("Error adding school:", error);
      toast.error("Failed to add school: " + error.message);
    } else if (data) {
      toast.success(`School '${newSchoolName}' added successfully!`);
      const newSchoolEntry: School = { ...data[0], total_estimated_value: 0, item_count: 0 };
      setSchools([...schools, newSchoolEntry]);
      setNewSchoolName('');
      setNewSchoolCity('');
      document.getElementById('close-add-school-dialog')?.click();
    }
    setAddingSchool(false);
  };

  const handleCopyLink = (adminKey: string) => {
    const link = `${window.location.origin}/admin/${adminKey}`;
    navigator.clipboard.writeText(link)
      .then(() => toast.success("Admin link copied to clipboard!"))
      .catch(() => toast.error("Failed to copy link."));
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${schoolName} and all its associated items? This action cannot be undone.`)) {
      return;
    }
    const { error } = await supabase.from('schools').delete().match({ id: schoolId });
    if (error) {
      toast.error(`Failed to delete school: ${error.message}`);
    } else {
      toast.success(`School ${schoolName} deleted successfully.`);
      fetchSchoolsAndItems();
    }
  };

  const fetchItemsForSchool = async (school: School) => {
    setSelectedSchoolForItems(school);
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('school_id', school.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Failed to fetch items for ${school.name}: ${error.message}`);
      setSelectedSchoolItems([]);
    } else {
      setSelectedSchoolItems(data || []);
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`)) {
      return;
    }
    const { error } = await supabase.from('items').delete().match({ id: itemId });
    if (error) {
      toast.error(`Failed to delete item: ${error.message}`);
    } else {
      toast.success(`Item "${itemName}" deleted successfully.`);
      setSelectedSchoolItems(prev => prev.filter(item => item.id !== itemId));
      fetchSchoolsAndItems();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Schools Dashboard</h1>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Add School
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New School</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">School Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter school name"
                      value={newSchoolName}
                      onChange={(e) => setNewSchoolName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="Enter city"
                      value={newSchoolCity}
                      onChange={(e) => setNewSchoolCity(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    onClick={handleAddSchool}
                    disabled={addingSchool}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {addingSchool ? 'Adding...' : 'Add School'}
                  </Button>
                  <DialogClose id="close-add-school-dialog" />
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schools.map((school) => (
              <motion.div
                key={school.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center">
                        <Building2 className="h-5 w-5 text-green-600 mr-2" />
                        {school.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyLink(school.admin_access_key)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSchool(school.id, school.name)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>{school.city}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total Value</span>
                        <span className="font-semibold">
                          ${school.total_estimated_value?.toLocaleString() || '0'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Items</span>
                        <span className="font-semibold">{school.item_count || 0}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-2">
                        <a
                          href={`${window.location.origin}/admin/${school.admin_access_key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Admin Link
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyLink(school.admin_access_key)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={() => fetchItemsForSchool(school)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Items
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {selectedSchoolForItems && (
            <Dialog open={!!selectedSchoolForItems} onOpenChange={() => setSelectedSchoolForItems(null)}>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>
                    Items for {selectedSchoolForItems.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  {selectedSchoolItems.length > 0 ? (
                    <div className="space-y-4">
                      {selectedSchoolItems.map((item) => (
                        <Card key={item.id}>
                          <CardContent className="flex justify-between items-center p-4">
                            <div>
                              <h4 className="font-semibold">{item.name}</h4>
                              <p className="text-sm text-gray-500">
                                Quantity: {item.quantity} | Value: ${item.estimated_value.toLocaleString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item.id, item.name)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">
                      No items found for this school.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>
      </div>
    </div>
  );
} 