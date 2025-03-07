import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

interface EditProfileFormProps {
  initialUsername: string;
  onSubmit: (username: string) => void;
  onCancel: () => void;
}

export function EditProfileForm({ initialUsername, onSubmit, onCancel }: EditProfileFormProps) {
  const [username, setUsername] = useState(initialUsername);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDefaultUsername = initialUsername.startsWith('user_');

  // If it's a default username, clear the input field for better UX
  useEffect(() => {
    if (isDefaultUsername) {
      setUsername('');
    }
  }, [isDefaultUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedUsername = username.trim();
    
    if (!trimmedUsername) {
      setError("Username cannot be empty");
      return;
    }
    
    if (trimmedUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      await onSubmit(trimmedUsername);
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Failed to update username. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError(null);
          }}
          placeholder={isDefaultUsername ? "Enter a custom username" : "Enter your username"}
          className="w-full"
          disabled={isSubmitting}
          autoFocus={isDefaultUsername}
        />
        {isDefaultUsername && (
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Choose a username to personalize your profile
          </p>
        )}
        {error && (
          <div className="text-sm text-red-500 flex items-center gap-1 mt-1">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
      
      <div className="flex justify-end gap-2">
        {!isDefaultUsername && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button 
          type="submit"
          disabled={isSubmitting || !username.trim()}
        >
          {isSubmitting ? "Saving..." : "Save Username"}
        </Button>
      </div>
    </form>
  );
} 