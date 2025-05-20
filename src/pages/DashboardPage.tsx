import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, ExternalLink, Copy, RefreshCw, Eye, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner"; // Assuming sonner is used for toasts via App.tsx

interface School {
  id: string;
  name: string;
  city: string;
  admin_access_key: string;
  total_estimated_value?: number; // Will be calculated
  item_count?: number; // Will be calculated
}

interface Item {
  id: string;
  name: string;
  estimated_value: number;
  quantity: number;
  school_id: string;
}

const DashboardPage = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [recentFires, setRecentFires] = useState<any[]>([]); // Placeholder for now
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [selectedSchoolItems, setSelectedSchoolItems] = useState<Item[]>([]);
  const [selectedSchoolForItems, setSelectedSchoolForItems] = useState<School | null>(null);

  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolCity, setNewSchoolCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingSchool, setAddingSchool] = useState(false);
  const [currentTab, setCurrentTab] = useState("schools");

  useEffect(() => {
    fetchSchoolsAndItems();
  }, []);

  const fetchSchoolsAndItems = async () => {
    setLoading(true);
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      console.error("User not authenticated", sessionError);
      toast.error("Authentication error. Please sign in again.");
      setLoading(false);
      return;
    }
    const userId = sessionData.session.user.id;

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
        const { data: itemsData, error: itemsError, count } = await supabase
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

    // Fetch all items for the "Assets" tab (could be paginated in a real app)
    // This fetches items only for schools managed by the current insurance company
    if (schoolsData && schoolsData.length > 0) {
      const schoolIds = schoolsData.map(s => s.id);
      const { data: allItemsData, error: allItemsError } = await supabase
        .from('items')
        .select('*')
        .in('school_id', schoolIds);

      if (allItemsError) {
        console.error("Error fetching all items:", allItemsError);
        toast.error("Failed to fetch all items: " + allItemsError.message);
      } else {
        setAllItems(allItemsData || []);
      }
    }
    setLoading(false);
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

    const adminKey = uuidv4(); // Generate a unique key for admin access
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
      // @ts-ignore
      const newSchoolEntry: School = { ...data[0], total_estimated_value: 0, item_count: 0 }; // Add with initial aggregates
      setSchools([...schools, newSchoolEntry]);
      setNewSchoolName('');
      setNewSchoolCity('');
      document.getElementById('close-add-school-dialog')?.click(); // Close dialog
    }
    setAddingSchool(false);
  };

  const handleCopyLink = (adminKey: string) => {
    const link = `${window.location.origin}/admin/${adminKey}`;
    navigator.clipboard.writeText(link)
      .then(() => toast.success("Admin link copied to clipboard!"))
      .catch(err => toast.error("Failed to copy link."));
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${schoolName} and all its associated items? This action cannot be undone.`)) {
      return;
    }
    setLoading(true);
    // Supabase is set to cascade delete items when a school is deleted.
    const { error } = await supabase.from('schools').delete().match({ id: schoolId });
    if (error) {
      toast.error(`Failed to delete school: ${error.message}`);
    } else {
      toast.success(`School ${schoolName} deleted successfully.`);
      fetchSchoolsAndItems(); // Refresh list
    }
    setLoading(false);
  };

  const fetchItemsForSchool = async (school: School) => {
    setSelectedSchoolForItems(school);
    setLoading(true);
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
    setLoading(false);
  };

  if (loading && schools.length === 0 && allItems.length === 0) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">Loading dashboard data...</div>;
  }

  return (
    <div className="p-2 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Insurance Dashboard</h1>
        <Button onClick={fetchSchoolsAndItems} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="schools" className="w-full" onValueChange={setCurrentTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 mb-4">
          <TabsTrigger value="schools">Schools</TabsTrigger>
          {/* <TabsTrigger value="recent_fires">Recent Fires</TabsTrigger> */}
          <TabsTrigger value="assets">All Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="schools">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Registered Schools</CardTitle>
                <CardDescription>Manage schools you insure and their assessment links.</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add School</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New School</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="school-name" className="text-right">Name</Label>
                      <Input id="school-name" value={newSchoolName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSchoolName(e.target.value)} className="col-span-3" placeholder="e.g., Springfield Elementary" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="school-city" className="text-right">City</Label>
                      <Input id="school-city" value={newSchoolCity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSchoolCity(e.target.value)} className="col-span-3" placeholder="e.g., Springfield" />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                       <Button type="button" variant="outline" id="close-add-school-dialog">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" onClick={handleAddSchool} disabled={addingSchool}>
                      {addingSchool ? 'Adding...' : 'Add School'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {schools.length === 0 && !loading && <p>No schools registered yet. Click "Add School" to begin.</p>}
              {loading && schools.length === 0 && <p>Loading schools...</p>}
              <div className="space-y-4">
                {schools.map((school) => (
                  <Card key={school.id} className="overflow-hidden">
                    <CardHeader className="flex flex-row items-start justify-between p-4 bg-muted/30">
                        <div>
                            <CardTitle className="text-lg">{school.name}</CardTitle>
                            <CardDescription>{school.city}</CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSchool(school.id, school.name)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Admin Link: 
                        <Button variant="link" size="sm" onClick={() => handleCopyLink(school.admin_access_key)} className="p-1 h-auto">
                           <Copy className="mr-1 h-3 w-3" /> Copy Link
                        </Button>
                        <a href={`/admin/${school.admin_access_key}`} target="_blank" rel="noopener noreferrer" className="ml-1">
                          <Button variant="link" size="sm" className="p-1 h-auto">
                            <ExternalLink className="mr-1 h-3 w-3" /> Open Link
                          </Button>
                        </a>
                      </p>
                      <p className="text-sm">Total Estimated Value: <span className="font-semibold">${school.total_estimated_value?.toLocaleString() || '0'}</span></p>
                      <p className="text-sm">Total Items Scanned: <span className="font-semibold">{school.item_count || 0}</span></p>
                       <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => fetchItemsForSchool(school)} className="mt-2">
                            <Eye className="mr-2 h-4 w-4" /> View Items ({school.item_count || 0})
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Items for {selectedSchoolForItems?.name}</DialogTitle>
                          </DialogHeader>
                          {selectedSchoolItems.length === 0 && <p className="py-4 text-muted-foreground">No items scanned for this school yet.</p>}
                          <ul className="divide-y divide-border mt-4">
                            {selectedSchoolItems.map(item => (
                              <li key={item.id} className="py-3 flex justify-between items-center">
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                                </div>
                                <p className="text-lg font-semibold text-primary">${item.estimated_value.toLocaleString()}</p>
                              </li>
                            ))}
                          </ul>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* <TabsContent value="recent_fires">
          <Card>
            <CardHeader>
              <CardTitle>Recent Fires / Claims</CardTitle>
              <CardDescription>Overview of recent incidents and claims status.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Feature coming soon. This section will display information about recent wildfire incidents affecting insured schools and the status of related claims.</p>
            </CardContent>
          </Card>
        </TabsContent> */}

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>All Scanned Assets</CardTitle>
              <CardDescription>An itemized list of all assets across all your insured schools.</CardDescription>
            </CardHeader>
            <CardContent>
              {allItems.length === 0 && !loading && <p>No assets found across your schools.</p>}
              {loading && allItems.length === 0 && <p>Loading assets...</p>}
              {allItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Item Name</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">School</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Est. Value</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="bg-background divide-y divide-border">
                      {allItems.map((item) => {
                        const school = schools.find(s => s.id === item.school_id);
                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">{item.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{school?.name || 'Unknown School'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{item.quantity}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">${item.estimated_value.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-primary">${(item.estimated_value * item.quantity).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardPage; 