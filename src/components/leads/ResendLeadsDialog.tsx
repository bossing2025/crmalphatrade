import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResendLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeads: Array<{
    id: string;
    email: string;
    firstname: string;
    lastname: string;
    mobile: string;
    country_code: string;
    lead_distributions?: Array<{ advertiser_id: string; advertisers?: { name: string } }>;
  }>;
  advertisers: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

export function ResendLeadsDialog({
  open,
  onOpenChange,
  selectedLeads,
  advertisers,
  onSuccess,
}: ResendLeadsDialogProps) {
  const [resendOption, setResendOption] = useState<"same" | "different">("same");
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current advertisers from selected leads
  const currentAdvertisers = selectedLeads.map(lead => {
    const dist = lead.lead_distributions?.find(d => d.advertisers?.name);
    return dist?.advertisers?.name || "Unknown";
  });
  const uniqueCurrentAdvertisers = [...new Set(currentAdvertisers)];

  const handleResend = async () => {
    if (resendOption === "different" && !selectedAdvertiserId) {
      toast.error("Please select an advertiser");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const lead of selectedLeads) {
        // Determine target advertiser
        let targetAdvertiserId: string | null = null;
        
        if (resendOption === "same") {
          // Get the original advertiser from distributions
          const dist = lead.lead_distributions?.find(d => d.advertiser_id);
          targetAdvertiserId = dist?.advertiser_id || null;
          
          if (!targetAdvertiserId) {
            errorCount++;
            continue;
          }
        } else {
          targetAdvertiserId = selectedAdvertiserId;
        }

        // Call distribute-lead edge function to resend
        const { error } = await supabase.functions.invoke('distribute-lead', {
          body: {
            lead_id: lead.id,
            force_advertiser_id: targetAdvertiserId,
            is_resend: true,
          },
        });

        if (error) {
          console.error(`Failed to resend lead ${lead.id}:`, error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully resent ${successCount} lead${successCount > 1 ? 's' : ''}`);
        onSuccess();
        onOpenChange(false);
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to resend ${errorCount} lead${errorCount > 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error("Resend error:", error);
      toast.error("Failed to resend leads");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resend Leads</DialogTitle>
          <DialogDescription>
            Resend {selectedLeads.length} selected lead{selectedLeads.length > 1 ? 's' : ''} to an advertiser.
            {uniqueCurrentAdvertisers.length > 0 && (
              <span className="block mt-1 text-xs">
                Current: {uniqueCurrentAdvertisers.join(", ")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={resendOption} onValueChange={(v) => setResendOption(v as "same" | "different")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="same" id="same" />
              <Label htmlFor="same" className="cursor-pointer">
                Resend to same advertiser
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="different" id="different" />
              <Label htmlFor="different" className="cursor-pointer">
                Send to different advertiser
              </Label>
            </div>
          </RadioGroup>

          {resendOption === "different" && (
            <div className="space-y-2">
              <Label>Select Advertiser</Label>
              <Select value={selectedAdvertiserId} onValueChange={setSelectedAdvertiserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose advertiser..." />
                </SelectTrigger>
                <SelectContent>
                  {advertisers.map((adv) => (
                    <SelectItem key={adv.id} value={adv.id}>
                      {adv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleResend} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Resend {selectedLeads.length} Lead{selectedLeads.length > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
