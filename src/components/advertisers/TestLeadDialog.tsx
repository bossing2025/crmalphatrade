import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, RefreshCw, CheckCircle2, XCircle, Copy } from "lucide-react";
import { countryData, generateTestData } from "./countryData";

interface TestLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advertiserId: string;
  advertiserName: string;
}

interface TestResult {
  success: boolean;
  message?: string;
  response?: any;
}

export function TestLeadDialog({ open, onOpenChange, advertiserId, advertiserName }: TestLeadDialogProps) {
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState(() => generateTestData("US"));
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  // Additional fields
  const [offerName, setOfferName] = useState("");
  const [custom1, setCustom1] = useState("");
  const [custom2, setCustom2] = useState("");
  const [custom3, setCustom3] = useState("");

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setGeneratedData(generateTestData(country));
  };

  const regenerateData = () => {
    setGeneratedData(generateTestData(selectedCountry));
  };

  const resetDialog = () => {
    setTestResult(null);
    setGeneratedData(generateTestData(selectedCountry));
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setTestResult(null);
    }
    onOpenChange(open);
  };

  const copyResponse = () => {
    if (testResult?.response) {
      navigator.clipboard.writeText(JSON.stringify(testResult.response, null, 2));
      toast.success("Response copied to clipboard");
    }
  };

  const handleSendTestLead = async () => {
    // Basic client-side validation (still validated server-side in the backend function)
    const ip = String(generatedData.ip_address || "").trim();
    const ipV4Regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    const phoneDigits = String(generatedData.mobile || "").replace(/\D/g, "");

    if (!ip || !ipV4Regex.test(ip)) {
      toast.error("Please enter a valid IPv4 address (e.g., 99.248.165.193)");
      return;
    }
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      toast.error("Please enter a valid phone number (7–15 digits)");
      return;
    }

    setIsLoading(true);
    setTestResult(null);
    try {
      // Get current user for logging
      const { data: { user } } = await supabase.auth.getUser();
      
      // Prepare test lead data with additional fields
      const testLeadData = {
        ...generatedData,
        offer_name: offerName || undefined,
        custom1: custom1 || undefined,
        custom2: custom2 || undefined,
        custom3: custom3 || undefined,
      };
      
      // Use test mode - sends directly to advertiser and logs the result
      const { data: funcData, error: funcError } = await supabase.functions.invoke('distribute-lead', {
        body: { 
          test_mode: true,
          advertiser_id: advertiserId,
          test_lead_data: testLeadData,
          user_id: user?.id,
        },
      });

      if (funcError) throw funcError;

      // Set the test result with full response
      setTestResult({
        success: !!funcData?.success,
        message: funcData?.message || (funcData?.success ? "Test lead sent successfully" : "Test failed"),
        response: funcData,
      });

      if (funcData?.success) {
        toast.success(`Test lead sent to ${advertiserName}`);
      } else {
        toast.warning("Test lead was rejected by advertiser");
      }
    } catch (error) {
      console.error('Error sending test lead:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        response: { error: error instanceof Error ? error.message : error },
      });
      toast.error("Failed to send test lead");
    } finally {
      setIsLoading(false);
    }
  };

  // Sort countries alphabetically by name
  const sortedCountries = Object.entries(countryData).sort(([, a], [, b]) => 
    a.name.localeCompare(b.name)
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Send Test Lead to {advertiserName}</DialogTitle>
          <DialogDescription>
            {testResult ? "View the advertiser's response below" : "Auto-generate test lead data based on selected country"}
          </DialogDescription>
        </DialogHeader>

        {testResult ? (
          // Show result view
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className={`flex items-center gap-2 p-3 rounded-lg ${testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span className="font-medium">{testResult.message}</span>
            </div>

            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Test Mode:</span> No lead was created in the database
            </div>

            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center">
                <Label>Advertiser Response</Label>
                <Button variant="ghost" size="sm" onClick={copyResponse}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <ScrollArea className="flex-1 border rounded-lg bg-muted/50">
                <pre className="p-3 text-xs whitespace-pre-wrap break-all">
                  {JSON.stringify(testResult.response, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          </div>
        ) : (
          // Show form view
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Country/Geo</Label>
                <Select value={selectedCountry} onValueChange={handleCountryChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] z-[100] bg-popover">
                    {sortedCountries.map(([code, data]) => (
                      <SelectItem key={code} value={code}>
                        {data.name} ({code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Country Code</Label>
                <Input
                  value={generatedData.country_code}
                  onChange={(e) => {
                    const code = e.target.value.toUpperCase();
                    setGeneratedData({ ...generatedData, country_code: code });
                    // If the code matches a known country, select it and regenerate data
                    if (countryData[code]) {
                      setSelectedCountry(code);
                      setGeneratedData(generateTestData(code));
                    }
                  }}
                  placeholder="US"
                  maxLength={3}
                />
              </div>
            </div>

            {/* Phone + IP overrides (required by some advertiser validations) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone (editable)</Label>
                <Input
                  value={generatedData.mobile}
                  onChange={(e) => setGeneratedData({ ...generatedData, mobile: e.target.value })}
                  placeholder="e.g., +19058304680 or 9058304680"
                />
              </div>
              <div className="space-y-2">
                <Label>IP Address (editable)</Label>
                <Input
                  value={generatedData.ip_address}
                  onChange={(e) => setGeneratedData({ ...generatedData, ip_address: e.target.value })}
                  placeholder="e.g., 99.248.165.193"
                />
              </div>
            </div>

            {/* Offer Name */}
            <div className="space-y-2">
              <Label>Offer Name (optional)</Label>
              <Input
                value={offerName}
                onChange={(e) => setOfferName(e.target.value)}
                placeholder="e.g., Summer Promo 2025"
              />
            </div>

            {/* Custom Fields */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Custom Parameters (optional)</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={custom1}
                  onChange={(e) => setCustom1(e.target.value)}
                  placeholder="custom1"
                />
                <Input
                  value={custom2}
                  onChange={(e) => setCustom2(e.target.value)}
                  placeholder="custom2"
                />
                <Input
                  value={custom3}
                  onChange={(e) => setCustom3(e.target.value)}
                  placeholder="custom3"
                />
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center mb-3">
                <Label className="text-sm font-medium">Generated Lead Data</Label>
                <Button variant="outline" size="sm" onClick={regenerateData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">First Name:</span>
                  <p className="font-medium">{generatedData.firstname}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Name:</span>
                  <p className="font-medium">{generatedData.lastname}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium text-xs break-all">{generatedData.email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">{generatedData.mobile}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Country:</span>
                  <p className="font-medium">{generatedData.country_code}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">IP Address:</span>
                  <p className="font-medium">{generatedData.ip_address}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {testResult ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Close
              </Button>
              <Button onClick={resetDialog}>
                <Send className="h-4 w-4 mr-2" />
                Send Another
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendTestLead} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Lead
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
