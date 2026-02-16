import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface AdvertiserConfig {
  [key: string]: string | undefined;
  username?: string;
  password?: string;
  ai?: string;
  ci?: string;
  gi?: string;
  api_key_post?: string;
  api_key_get?: string;
  pass?: string;
  campaign_id?: string;
  sender?: string;
  content_type?: string;
  auth_type?: string;
  auth_header_name?: string;
  gsi_id?: string;
  gsi_hash?: string;
  offer_website?: string;
  api_token?: string;
  link_id?: string;
  source?: string;
}

interface FormData {
  name: string;
  advertiser_type: string;
  url: string;
  api_key: string;
  daily_cap: number;
  hourly_cap: number | null;
  is_active: boolean;
  config: AdvertiserConfig;
}

interface AdvertiserType {
  value: string;
  label: string;
  description: string;
  fields: string[];
}

interface AdvertiserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditMode: boolean;
  formData: FormData;
  setFormData: (data: FormData) => void;
  updateConfig: (key: string, value: string) => void;
  advertiserTypes: AdvertiserType[];
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export function AdvertiserFormDialog({
  open,
  onOpenChange,
  isEditMode,
  formData,
  setFormData,
  updateConfig,
  advertiserTypes,
  onSubmit,
  onCancel,
  isPending,
}: AdvertiserFormDialogProps) {
  const currentType = advertiserTypes.find(t => t.value === formData.advertiser_type);

  const handleTypeChange = (type: string) => {
    const defaultUrls: Record<string, string> = {
      trackbox: "",
      drmailer: "https://tracker.doctor-mailer.com/repost.php?act=register",
      enigma: "",
      timelocal: "",
      elitecrm: "https://trade.egolitrading.online/api/leads",
      gsi: "https://www.gsimarkets.com/api_add2.php",
      elnopy: "https://tracking.mpowertraffic2.com/api/v3/integration",
      custom: "",
    };
    
    setFormData({
      ...formData,
      advertiser_type: type,
      url: defaultUrls[type] || formData.url,
      config: {},
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Advertiser" : "Add Advertiser"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update advertiser configuration" : "Configure a new advertiser for lead distribution"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label>Advertiser Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g., FTD Kitchen"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Type Selection */}
          <div className="space-y-2">
            <Label>CRM Type <span className="text-destructive">*</span></Label>
            <Select 
              value={formData.advertiser_type} 
              onValueChange={handleTypeChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {advertiserTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentType && (
              <p className="text-xs text-muted-foreground">{currentType.description}</p>
            )}
          </div>

          {/* API URL */}
          <div className="space-y-2">
            <Label>API URL <span className="text-destructive">*</span></Label>
            <Input
              placeholder="https://api.example.com/leads"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            />
          </div>

          {/* Caps */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Daily Cap</Label>
              <Input
                type="number"
                placeholder="100"
                value={formData.daily_cap}
                onChange={(e) => setFormData({ ...formData, daily_cap: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Hourly Cap</Label>
              <Input
                type="number"
                placeholder="No limit"
                value={formData.hourly_cap || ""}
                onChange={(e) => setFormData({ ...formData, hourly_cap: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
          </div>

          {/* === TIMELOCAL === */}
          {formData.advertiser_type === 'timelocal' && (
            <div className="space-y-2">
              <Label>API Key <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Your API key"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              />
            </div>
          )}

          {/* === TRACKBOX === */}
          {formData.advertiser_type === 'trackbox' && (
            <>
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-medium text-muted-foreground">TrackBox Configuration</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>API Key POST <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="For push/registration"
                    value={formData.config.api_key_post || ''}
                    onChange={(e) => updateConfig('api_key_post', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key GET</Label>
                  <Input
                    placeholder="For pull/status"
                    value={formData.config.api_key_get || ''}
                    onChange={(e) => updateConfig('api_key_get', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    placeholder="TrackBox username"
                    value={formData.config.username || ''}
                    onChange={(e) => updateConfig('username', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="TrackBox password"
                    value={formData.config.password || ''}
                    onChange={(e) => updateConfig('password', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>AI <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="AI value"
                    value={formData.config.ai || ''}
                    onChange={(e) => updateConfig('ai', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CI <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="CI value"
                    value={formData.config.ci || ''}
                    onChange={(e) => updateConfig('ci', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>GI <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="GI value"
                    value={formData.config.gi || ''}
                    onChange={(e) => updateConfig('gi', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* === DR TRACKER === */}
          {formData.advertiser_type === 'drmailer' && (
            <>
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-medium text-muted-foreground">Dr Tracker Configuration</Label>
              </div>
              <div className="space-y-2">
                <Label>API Key <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="API key from Dr Tracker"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Password <span className="text-destructive">*</span></Label>
                  <Input
                    type="password"
                    placeholder="API Password"
                    value={formData.config.pass || ''}
                    onChange={(e) => updateConfig('pass', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Campaign ID <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Campaign ID"
                    value={formData.config.campaign_id || ''}
                    onChange={(e) => updateConfig('campaign_id', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* === GETLINKED (enigma) === */}
          {formData.advertiser_type === 'enigma' && (
            <>
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-medium text-muted-foreground">Getlinked Configuration</Label>
              </div>
              <div className="space-y-2">
                <Label>API Key <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Api-Key header value"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Offer Website (Landing Page) <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="https://your-landing-page.com"
                  value={formData.config.offer_website || ''}
                  onChange={(e) => updateConfig('offer_website', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required: The landing page URL registered with GetLinked for this offer
                </p>
              </div>
            </>
          )}

          {/* === ELITECRM === */}
          {formData.advertiser_type === 'elitecrm' && (
            <>
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-medium text-muted-foreground">EliteCRM Configuration</Label>
              </div>
              <div className="space-y-2">
                <Label>API Key <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Api-Key header value"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Sender <span className="text-destructive">*</span></Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Your sender identifier provided by the advertiser</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  placeholder="e.g., megatron"
                  value={formData.config.sender || ''}
                  onChange={(e) => updateConfig('sender', e.target.value)}
                />
              </div>
            </>
          )}

          {/* === GSI MARKETS === */}
          {formData.advertiser_type === 'gsi' && (
            <>
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-medium text-muted-foreground">GSI Markets Configuration</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Advertiser ID <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g., 845161"
                    value={formData.config.gsi_id || ''}
                    onChange={(e) => updateConfig('gsi_id', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hash <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Authentication hash"
                    value={formData.config.gsi_hash || ''}
                    onChange={(e) => updateConfig('gsi_hash', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* === ELNOPY (Mpower Traffic) === */}
          {formData.advertiser_type === 'elnopy' && (
            <>
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-medium text-muted-foreground">ELNOPY (Mpower) Configuration</Label>
              </div>
              <div className="space-y-2">
                <Label>API Token <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Your ELNOPY API token"
                  value={formData.config.api_token || ''}
                  onChange={(e) => updateConfig('api_token', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Link ID <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g., 198"
                    value={formData.config.link_id || ''}
                    onChange={(e) => updateConfig('link_id', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Input
                    placeholder="Source name (optional)"
                    value={formData.config.source || ''}
                    onChange={(e) => updateConfig('source', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={!formData.name || !formData.url || isPending}
          >
            {isEditMode ? "Save Changes" : "Create Advertiser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
