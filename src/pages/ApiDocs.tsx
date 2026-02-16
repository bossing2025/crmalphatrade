import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import html2pdf from "html2pdf.js";

const BASE_URL = "https://api.megatroncrm.online/functions/v1";

export default function ApiDocs() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;
    
    setIsGenerating(true);
    
    try {
      const element = contentRef.current;
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: 'MegaTronCRM-API-Documentation.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: { 
          unit: 'mm' as const, 
          format: 'a4' as const, 
          orientation: 'portrait' as const 
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as ('avoid-all' | 'css' | 'legacy')[] }
      };
      
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8" ref={contentRef}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Affiliate API Documentation</h1>
            <p className="text-muted-foreground text-lg">
              Complete guide to integrate with our lead management system
            </p>
          </div>
          <Button 
            onClick={handleDownloadPDF} 
            disabled={isGenerating}
            className="self-start print:hidden"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle>🔐 Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>All API requests require an <code className="bg-muted px-2 py-1 rounded">Api-Key</code> header with your unique affiliate API key.</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm">
              <span className="text-muted-foreground">Header:</span> Api-Key: your_api_key_here
            </div>
            <p className="text-sm text-muted-foreground">
              Contact your account manager to receive your API key.
            </p>
          </CardContent>
        </Card>

        {/* Base URL */}
        <Card>
          <CardHeader>
            <CardTitle>🌐 Base URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm break-all">
              {BASE_URL}
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Endpoints</h2>

          {/* Submit Lead */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Badge className="bg-green-500">POST</Badge>
                <CardTitle className="font-mono">/submit-lead</CardTitle>
              </div>
              <p className="text-muted-foreground">Submit a new lead to the system</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Parameters</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">Parameter</th>
                        <th className="text-left py-2 pr-4">Type</th>
                        <th className="text-left py-2 pr-4">Required</th>
                        <th className="text-left py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">firstname</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td>
                        <td className="py-2">Lead's first name</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">lastname</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td>
                        <td className="py-2">Lead's last name</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">email</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td>
                        <td className="py-2">Lead's email address</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">mobile</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td>
                        <td className="py-2">Lead's phone number</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">country_code</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td>
                        <td className="py-2">2-letter ISO country code (e.g., US, GB, CA)</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">country</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Full country name</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">ip_address</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Lead's IP address</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">offer_name</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Offer/campaign name</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">custom1</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Custom tracking parameter 1</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">custom2</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Custom tracking parameter 2</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">custom3</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Custom tracking parameter 3</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 font-mono">comment</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Additional notes</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Example Request</TabsTrigger>
                  <TabsTrigger value="success">Success Response</TabsTrigger>
                  <TabsTrigger value="error">Error Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`POST ${BASE_URL}/submit-lead
Headers:
  Api-Key: your_api_key_here
  Content-Type: application/json

Body:
{
  "firstname": "John",
  "lastname": "Doe",
  "email": "john.doe@example.com",
  "mobile": "+14165551234",
  "country_code": "CA",
  "country": "Canada",
  "offer_name": "Summer Promo",
  "custom1": "tracking123"
}`}</pre>
                  </div>
                </TabsContent>
                <TabsContent value="success">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "success": true,
  "message": "Lead submitted successfully",
  "data": {
    "lead_id": "9783cddc-ea4a-4a36-b207-52360b6634fc",
    "request_id": "fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d",
    "autologin_url": "https://broker.com/autologin?token=abc123"
  }
}`}</pre>
                  </div>
                  <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                    <p className="text-sm">
                      <strong>🔗 Autologin URL:</strong> When available, the <code className="bg-muted px-1 rounded">autologin_url</code> field contains a URL that allows the lead to be instantly logged into the advertiser's platform. Redirect the user to this URL immediately after submission for seamless onboarding. This field is optional and only returned when the advertiser provides it.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="error">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`// Validation Error (422)
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": "Invalid email format"
  }
}

// Duplicate Email (409)
{
  "success": false,
  "message": "DUPLICATE"
}

// Caps Full (503)
{
  "success": false,
  "message": "CAPS_FULL"
}`}</pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Get Leads */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-500">GET</Badge>
                <CardTitle className="font-mono">/get-leads</CardTitle>
              </div>
              <p className="text-muted-foreground">Retrieve leads with status and FTD updates</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Query Parameters</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">Parameter</th>
                        <th className="text-left py-2 pr-4">Type</th>
                        <th className="text-left py-2 pr-4">Required</th>
                        <th className="text-left py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">fromDate</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td>
                        <td className="py-2">Start date (MM/DD/YY)</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">toDate</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td>
                        <td className="py-2">End date (MM/DD/YY)</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">hasFTD</td>
                        <td className="py-2 pr-4">integer</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Filter by FTD status (0 or 1)</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">status</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Filter by sale status (returned from advertiser CRM)</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">email</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Filter by email</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 font-mono">lead_id</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td>
                        <td className="py-2">Filter by specific lead ID</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                <p className="text-sm">
                  <strong>Note:</strong> Date range filters by <code>updated_at</code> — returns only leads that had status/FTD changes in that period. The <code>status</code> field reflects the sale status reported by the advertiser's CRM. Rejected leads are excluded by default.
                </p>
              </div>

              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Example Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`GET ${BASE_URL}/get-leads?fromDate=01/01/26&toDate=01/31/26&hasFTD=1
Headers:
  Api-Key: your_api_key_here`}</pre>
                  </div>
                </TabsContent>
                <TabsContent value="response">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "success": true,
  "message": "Leads fetched successfully",
  "count": 2,
  "data": [
    {
      "id": "9783cddc-ea4a-4a36-b207-52360b6634fc",
      "lead_code": "fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d",
      "firstname": "John",
      "lastname": "Doe",
      "email": "john.doe@example.com",
      "country_code": "CA",
      "mobile": "14165551234",
      "status": "Depositor",
      "is_ftd": 1,
      "ftd_date": "2026-01-15T10:30:00Z"
    }
  ]
}`}</pre>
                  </div>
                  <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                    <p className="text-sm">
                      <strong>ℹ️ Status Field:</strong> The <code className="bg-muted px-1 rounded">status</code> field contains the sale status as reported by the advertiser's CRM system (e.g., "New", "Callback", "Depositor", "No Answer"). Values vary by advertiser.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Lead Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-500">GET</Badge>
                <CardTitle className="font-mono">/lead-status</CardTitle>
              </div>
              <p className="text-muted-foreground">Check status of a specific lead</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Query Parameters (one required)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">Parameter</th>
                        <th className="text-left py-2 pr-4">Type</th>
                        <th className="text-left py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">lead_id</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2">The lead UUID</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 pr-4 font-mono">request_id</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2">The request ID returned from submission</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 font-mono">email</td>
                        <td className="py-2 pr-4">string</td>
                        <td className="py-2">The lead's email address</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Example Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`GET ${BASE_URL}/lead-status?request_id=fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d
Headers:
  Api-Key: your_api_key_here`}</pre>
                  </div>
                </TabsContent>
                <TabsContent value="response">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`{
  "success": true,
  "lead_id": "9783cddc-ea4a-4a36-b207-52360b6634fc",
  "request_id": "fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d",
  "status": "Callback",
  "is_ftd": 0
}`}</pre>
                  </div>
                  <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                    <p className="text-sm">
                      <strong>ℹ️ Status Field:</strong> The <code className="bg-muted px-1 rounded">status</code> field contains the sale status as reported by the advertiser's CRM system.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Status Codes */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Status Values</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The <code className="bg-muted px-1 rounded">status</code> field in API responses contains the sale status as reported by the advertiser's CRM system. Values vary by advertiser but common examples include:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800">New</Badge>
                <span className="text-sm">Lead received</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-100 text-yellow-800">Callback</Badge>
                <span className="text-sm">Scheduled callback</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-orange-100 text-orange-800">No Answer</Badge>
                <span className="text-sm">No response</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">Depositor</Badge>
                <span className="text-sm">Made deposit</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-800">Interested</Badge>
                <span className="text-sm">Shows interest</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-800">Not Interested</Badge>
                <span className="text-sm">Declined</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: Exact status values depend on the advertiser's CRM configuration and may differ from the examples above.
            </p>
          </CardContent>
        </Card>

        {/* HTTP Status Codes */}
        <Card>
          <CardHeader>
            <CardTitle>⚠️ HTTP Status Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Code</th>
                    <th className="text-left py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge className="bg-green-500">200</Badge></td>
                    <td className="py-2">Success</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge className="bg-green-500">201</Badge></td>
                    <td className="py-2">Lead created successfully</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge className="bg-yellow-500">400</Badge></td>
                    <td className="py-2">Bad request - missing required parameters</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge className="bg-red-500">401</Badge></td>
                    <td className="py-2">Unauthorized - invalid or missing API key</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge className="bg-red-500">404</Badge></td>
                    <td className="py-2">Lead not found</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge className="bg-orange-500">409</Badge></td>
                    <td className="py-2">Duplicate - email already exists</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge className="bg-orange-500">422</Badge></td>
                    <td className="py-2">Validation error</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><Badge className="bg-red-500">503</Badge></td>
                    <td className="py-2">Caps full - try again later</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <Card>
          <CardHeader>
            <CardTitle>💬 Support</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              For API access, technical support, or questions, contact your account manager.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
