import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Home, 
  Settings,
  CreditCard,
  ChevronLeft,
  Edit,
  Clock,
  User,
  Shield,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { getUserProfile, updateUserProfile, getRecentScans } from "@/services/supabaseClient";
import { ScanHistory, Product } from "@/services/productService";
import { EditProfileForm } from "@/components/EditProfileForm";
import { supabase } from "@/services/supabaseClient";

// Interface for user profile data
interface UserProfile {
  id: string;
  username: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at?: string;
}

const ProfilePage = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [isLoadingScans, setIsLoadingScans] = useState(true);
  const [scanPage, setScanPage] = useState(1);
  const [hasMoreScans, setHasMoreScans] = useState(true);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();
  const { subscription, isLoading: isLoadingSubscription } = useSubscription();

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!session?.user?.id) return;
      
      try {
        setIsLoading(true);
        const profileData = await getUserProfile(session.user.id);
        
        if (profileData) {
          setProfile(profileData as unknown as UserProfile);
          
          // If this is a newly created profile with default username, show edit form
          if (profileData.username && profileData.username.startsWith('user_')) {
            setIsEditingProfile(true);
            toast({
              title: "Welcome to Scani!",
              description: "Please customize your username to get started.",
            });
          }
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load profile data. Please try again later.",
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load profile data. Please try again later.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [session, toast]);

  // Fetch scan history
  useEffect(() => {
    const fetchScanHistory = async () => {
      if (!session?.user?.id) return;
      
      try {
        setIsLoadingScans(true);
        const scans = await getRecentScans(session.user.id, 10);
        
        if (scans && scans.length > 0) {
          setScanHistory(scans);
          setHasMoreScans(scans.length === 10);
        } else {
          setHasMoreScans(false);
        }
      } catch (error) {
        console.error("Error fetching scan history:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load scan history",
        });
      } finally {
        setIsLoadingScans(false);
      }
    };

    fetchScanHistory();
  }, [session, toast]);

  const handleUpdateProfile = async (username: string) => {
    if (!session?.user?.id) return;
    
    try {
      await updateUserProfile(session.user.id, { username });
      
      // Update local state
      setProfile(prev => prev ? { ...prev, username } : null);
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update profile",
      });
    }
  };

  const handleCancelEdit = () => {
    // If the user has a default username and tries to cancel, show a warning
    if (profile?.username && profile.username.startsWith('user_')) {
      toast({
        title: "Username Required",
        description: "Please set a username to continue using Scani.",
      });
      return;
    }
    
    setIsEditingProfile(false);
  };

  const handleLoadMoreScans = async () => {
    if (!session?.user?.id) return;
    
    try {
      setIsLoadingScans(true);
      const nextPage = scanPage + 1;
      const offset = (nextPage - 1) * 10;
      
      // Use a custom function to get scans with offset
      const moreScans = await getScansWithOffset(session.user.id, 10, offset);
      
      if (moreScans && moreScans.length > 0) {
        setScanHistory(prev => [...prev, ...moreScans]);
        setScanPage(nextPage);
        setHasMoreScans(moreScans.length === 10);
      } else {
        setHasMoreScans(false);
      }
    } catch (error) {
      console.error("Error loading more scans:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load more scan history",
      });
    } finally {
      setIsLoadingScans(false);
    }
  };

  // Helper function to get scans with offset
  const getScansWithOffset = async (userId: string, limit: number, offset: number): Promise<ScanHistory[]> => {
    const { data, error } = await supabase
      .from('scans')
      .select(`
        *,
        product:products(*)
      `)
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Error fetching scans with offset:', error);
      throw error;
    }
    
    return data as unknown as ScanHistory[];
  };

  const handleManageSubscription = () => {
    navigate('/subscription');
  };

  return (
    <div className="animate-fade-in">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glassmorphism border-b border-gray-200/80 dark:border-gray-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-display font-bold text-blue-600 dark:text-blue-400">Scani</div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="rounded-full"
            >
              <Home className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/settings')}
              className="rounded-full"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/subscription')}
              className="rounded-full"
            >
              <CreditCard className="h-5 w-5" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="gap-2 rounded-full bg-blue-500 hover:bg-blue-600"
            >
              <User className="h-4 w-4" />
              Profile
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 pb-16">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Home
        </Button>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold">Your Profile</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your account and view scan history
          </p>
        </div>

        {/* Profile Section */}
        <Card className="mb-8 ios-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Profile Information</span>
              {!isEditingProfile && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditingProfile(true)}
                  className="flex items-center gap-1"
                >
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            ) : isEditingProfile ? (
              <EditProfileForm 
                initialUsername={profile?.username || ''} 
                onSubmit={handleUpdateProfile}
                onCancel={handleCancelEdit}
              />
            ) : (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <Avatar className="h-24 w-24">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile?.username || 'User'} />
                  ) : (
                    <AvatarFallback className="text-2xl bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200">
                      {profile?.username ? profile.username[0].toUpperCase() : 'U'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="space-y-2 flex-1 text-center md:text-left">
                  <h3 className="text-xl font-semibold">
                    {profile?.username || 'Anonymous User'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                  </p>
                  
                  <div className="pt-2">
                    {isLoadingSubscription ? (
                      <Skeleton className="h-8 w-32 inline-block" />
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
                          <Badge className={`px-3 py-1 ${
                            subscription?.status === 'active' 
                              ? 'bg-green-500 dark:bg-green-600' 
                              : 'bg-gray-500 dark:bg-gray-600'
                          }`}>
                            <Shield className="h-3.5 w-3.5 mr-1 inline" />
                            {subscription?.status === 'active' ? 'Premium' : 'Free Tier'}
                          </Badge>
                          
                          <Button 
                            size="sm" 
                            onClick={handleManageSubscription}
                            className="rounded-full"
                          >
                            {subscription?.status === 'active' ? 'Manage Subscription' : 'Upgrade to Premium'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan History Section */}
        <Card className="ios-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Scan History</span>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Recent Scans
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingScans && scanHistory.length === 0 ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 border border-gray-100 dark:border-gray-800 rounded-lg">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : scanHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <Clock className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium mb-1">No Scans Yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Start scanning products to build your history
                </p>
                <Button onClick={() => navigate('/')}>
                  Scan a Product
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {scanHistory.map((scan) => (
                    <div 
                      key={scan.id} 
                      className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                        {scan.product?.name ? (
                          <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                            {scan.product.name.charAt(0)}
                          </span>
                        ) : (
                          <span className="text-lg font-semibold text-gray-400">?</span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm sm:text-base truncate">
                          {scan.product?.name || 'Unknown Product'}
                        </h4>
                        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm truncate">
                          {scan.product?.brand || 'Unknown Brand'} • {scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : 'Unknown Date'}
                        </p>
                      </div>
                      
                      {scan.product?.safety_score !== undefined && (
                        <Badge className={`${getSafetyScoreColor(scan.product.safety_score)} ml-auto`}>
                          {scan.product.safety_score}/10
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                
                {hasMoreScans && (
                  <div className="mt-6 text-center">
                    <Button 
                      variant="outline" 
                      onClick={handleLoadMoreScans}
                      disabled={isLoadingScans}
                      className="gap-1"
                    >
                      {isLoadingScans ? 'Loading...' : 'Load More'}
                      {!isLoadingScans && <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function getSafetyScoreColor(score: number): string {
  if (score >= 8) return 'bg-green-500 text-white';
  if (score >= 6) return 'bg-yellow-500 text-white';
  if (score >= 4) return 'bg-orange-500 text-white';
  return 'bg-red-500 text-white';
}

export default ProfilePage; 