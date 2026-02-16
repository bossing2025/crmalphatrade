import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Upload, Database, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAffiliates } from "@/hooks/useAffiliates";
import { useAddLeadsToPool } from "@/hooks/useInjectionPools";
import { countryData } from "@/components/advertisers/countryData";

interface LeadSourceSelectorProps {
  poolId: string;
}

interface CSVLead {
  firstname: string;
  lastname: string;
  email: string;
  mobile: string;
  country_code: string;
  country?: string;
  ip_address?: string;
  offer_name?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
  comment?: string;
}

export function LeadSourceSelector({ poolId }: LeadSourceSelectorProps) {
  const { data: affiliates } = useAffiliates();
  const addLeads = useAddLeadsToPool();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Database filter state
  const [selectedAffiliates, setSelectedAffiliates] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  // CSV import state
  const [csvLeads, setCsvLeads] = useState<CSVLead[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvFilterCountries, setCsvFilterCountries] = useState<string[]>([]);

  // Get distinct countries from leads table
  const { data: availableCountries } = useQuery({
    queryKey: ['leads-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('country_code, country')
        .neq('status', 'rejected');
      
      if (error) throw error;
      
      const countryMap = new Map<string, string>();
      data?.forEach(lead => {
        if (lead.country_code && !countryMap.has(lead.country_code)) {
          countryMap.set(lead.country_code, lead.country || lead.country_code);
        }
      });
      
      return Array.from(countryMap.entries()).map(([code, name]) => ({
        code,
        name
      })).sort((a, b) => a.code.localeCompare(b.code));
    },
  });

  // Preview query for database leads
  const { data: previewLeads, isLoading: previewLoading } = useQuery({
    queryKey: ['lead-source-preview', selectedAffiliates, fromDate, toDate, selectedCountries],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('id, firstname, lastname, email, mobile, country_code, country, ip_address, offer_name, custom1, custom2, custom3, comment')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (selectedAffiliates.length > 0) {
        query = query.in('affiliate_id', selectedAffiliates);
      }
      if (fromDate) {
        query = query.gte('created_at', fromDate);
      }
      if (toDate) {
        query = query.lte('created_at', toDate + 'T23:59:59');
      }
      if (selectedCountries.length > 0) {
        query = query.in('country_code', selectedCountries);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data;
    },
    enabled: selectedAffiliates.length > 0 || !!fromDate || !!toDate,
  });

  const toggleAffiliate = (id: string) => {
    setSelectedAffiliates(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const toggleCountry = (code: string) => {
    setSelectedCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleCsvCountry = (code: string) => {
    setCsvFilterCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Parse CSV file
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setCsvErrors([]);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setCsvErrors(['File is empty or has no data rows']);
          return;
        }

        // Parse header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const requiredFields = ['firstname', 'lastname', 'email', 'mobile', 'country_code'];
        const missingFields = requiredFields.filter(f => !header.includes(f));
        
        if (missingFields.length > 0) {
          setCsvErrors([`Missing required columns: ${missingFields.join(', ')}`]);
          return;
        }

        // Parse rows
        const leads: CSVLead[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length !== header.length) {
            errors.push(`Row ${i + 1}: Column count mismatch`);
            continue;
          }

          const row: Record<string, string> = {};
          header.forEach((h, idx) => {
            row[h] = values[idx]?.trim().replace(/^["']|["']$/g, '') || '';
          });

          // Validate required fields
          if (!row.firstname || !row.lastname || !row.email || !row.mobile || !row.country_code) {
            errors.push(`Row ${i + 1}: Missing required field(s)`);
            continue;
          }

          // Validate country code
          const countryCode = row.country_code.toUpperCase();
          if (!countryData[countryCode]) {
            errors.push(`Row ${i + 1}: Invalid country code "${countryCode}"`);
            continue;
          }

          leads.push({
            firstname: row.firstname,
            lastname: row.lastname,
            email: row.email,
            mobile: row.mobile,
            country_code: countryCode,
            country: countryData[countryCode]?.name || countryCode,
            ip_address: row.ip_address || row.ip || '',
            offer_name: row.offer_name || row.offer || '',
            custom1: row.custom1 || '',
            custom2: row.custom2 || '',
            custom3: row.custom3 || '',
            comment: row.comment || row.notes || '',
          });
        }

        setCsvLeads(leads);
        if (errors.length > 0) {
          setCsvErrors(errors.slice(0, 10)); // Show first 10 errors
        }

        if (leads.length > 0) {
          toast.success(`Parsed ${leads.length} valid leads from CSV`);
        }
      } catch (err) {
        setCsvErrors(['Failed to parse CSV file']);
      }
    };
    reader.readAsText(file);
  };

  // Parse CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  // Get unique countries from CSV
  const csvCountries = csvLeads.reduce((acc, lead) => {
    if (!acc.find(c => c.code === lead.country_code)) {
      acc.push({ code: lead.country_code, name: lead.country || lead.country_code });
    }
    return acc;
  }, [] as { code: string; name: string }[]).sort((a, b) => a.code.localeCompare(b.code));

  // Filter CSV leads by selected countries
  const filteredCsvLeads = csvFilterCountries.length > 0
    ? csvLeads.filter(lead => csvFilterCountries.includes(lead.country_code))
    : csvLeads;

  const handleAddDatabaseLeads = async () => {
    if (!previewLeads?.length) {
      toast.error("No leads to add");
      return;
    }

    const leadsToAdd = previewLeads.map(lead => ({
      firstname: lead.firstname,
      lastname: lead.lastname,
      email: lead.email,
      mobile: lead.mobile,
      country_code: lead.country_code,
      country: lead.country,
      ip_address: lead.ip_address,
      offer_name: lead.offer_name,
      custom1: lead.custom1,
      custom2: lead.custom2,
      custom3: lead.custom3,
      comment: lead.comment,
      scheduled_at: null,
      sent_at: null,
      autologin_url: null,
      external_lead_id: null,
      response: null,
      error_message: null,
    }));

    await addLeads.mutateAsync({ poolId, leads: leadsToAdd });
  };

  const handleAddCsvLeads = async () => {
    if (!filteredCsvLeads.length) {
      toast.error("No leads to add");
      return;
    }

    const leadsToAdd = filteredCsvLeads.map(lead => ({
      firstname: lead.firstname,
      lastname: lead.lastname,
      email: lead.email,
      mobile: lead.mobile,
      country_code: lead.country_code,
      country: lead.country,
      ip_address: lead.ip_address || null,
      offer_name: lead.offer_name || null,
      custom1: lead.custom1 || null,
      custom2: lead.custom2 || null,
      custom3: lead.custom3 || null,
      comment: lead.comment || null,
      scheduled_at: null,
      sent_at: null,
      autologin_url: null,
      external_lead_id: null,
      response: null,
      error_message: null,
    }));

    await addLeads.mutateAsync({ poolId, leads: leadsToAdd });
    
    // Clear CSV state after successful add
    setCsvLeads([]);
    setCsvFileName("");
    setCsvFilterCountries([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Tabs defaultValue="database" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="database" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          From Database
        </TabsTrigger>
        <TabsTrigger value="csv" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Import CSV
        </TabsTrigger>
      </TabsList>

      {/* DATABASE TAB */}
      <TabsContent value="database" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filter Leads from Database</CardTitle>
            <CardDescription>
              Select existing leads by affiliate, date range, and country
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Affiliate Selection */}
            <div className="space-y-3">
              <Label>Source Affiliates</Label>
              <div className="flex flex-wrap gap-2">
                {affiliates?.map((aff) => (
                  <Button
                    key={aff.id}
                    variant={selectedAffiliates.includes(aff.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAffiliate(aff.id)}
                  >
                    {aff.name}
                  </Button>
                ))}
                {(!affiliates || affiliates.length === 0) && (
                  <p className="text-sm text-muted-foreground">No affiliates found</p>
                )}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            {/* Country Filter - PROMINENT */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <Label className="text-base font-semibold flex items-center gap-2">
                🌍 Filter by Country (GEO)
                <Badge variant="secondary">{availableCountries?.length || 0} available</Badge>
              </Label>
              <p className="text-sm text-muted-foreground">
                Select specific countries to include in this injection
              </p>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-background rounded border">
                {availableCountries?.map((country) => (
                  <Button
                    key={country.code}
                    variant={selectedCountries.includes(country.code) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleCountry(country.code)}
                  >
                    {country.code}
                  </Button>
                ))}
                {(!availableCountries || availableCountries.length === 0) && (
                  <p className="text-sm text-muted-foreground p-2">No leads with country codes found</p>
                )}
              </div>
              {selectedCountries.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  <span className="text-sm text-muted-foreground mr-2">Selected:</span>
                  {selectedCountries.map(code => (
                    <Badge key={code} variant="default" className="text-xs">
                      {code}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => toggleCountry(code)}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Database Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Preview ({previewLeads?.length || 0} leads)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !previewLeads?.length ? (
              <p className="text-center py-8 text-muted-foreground">
                Select filters to preview leads
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    previewLeads.reduce((acc, lead) => {
                      acc[lead.country_code] = (acc[lead.country_code] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([code, count]) => (
                    <Badge key={code} variant="outline">
                      {code}: {count}
                    </Badge>
                  ))}
                </div>

                <div className="max-h-64 overflow-y-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Phone</th>
                        <th className="text-left p-2">Country</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewLeads.slice(0, 50).map((lead) => (
                        <tr key={lead.id} className="border-t">
                          <td className="p-2">{lead.firstname} {lead.lastname}</td>
                          <td className="p-2">{lead.email}</td>
                          <td className="p-2">{lead.mobile}</td>
                          <td className="p-2">{lead.country_code}</td>
                        </tr>
                      ))}
                      {previewLeads.length > 50 && (
                        <tr className="border-t">
                          <td colSpan={4} className="p-2 text-center text-muted-foreground">
                            ... and {previewLeads.length - 50} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Button
                  className="w-full"
                  onClick={handleAddDatabaseLeads}
                  disabled={addLeads.isPending}
                >
                  {addLeads.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add {previewLeads.length} Leads to Pool
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* CSV IMPORT TAB */}
      <TabsContent value="csv" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Import Leads from CSV</CardTitle>
            <CardDescription>
              Upload a CSV file with leads. Required columns: firstname, lastname, email, mobile, country_code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div className="space-y-3">
              <Label>CSV File</Label>
              <div className="flex items-center gap-4">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="max-w-md"
                />
                {csvFileName && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {csvFileName}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Optional columns: ip_address, offer_name, custom1, custom2, custom3, comment
              </p>
            </div>

            {/* CSV Errors */}
            {csvErrors.length > 0 && (
              <div className="p-3 bg-destructive/10 rounded-lg space-y-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Import Warnings
                </p>
                {csvErrors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">{err}</p>
                ))}
              </div>
            )}

            {/* CSV Country Filter - PROMINENT */}
            {csvLeads.length > 0 && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <Label className="text-base font-semibold flex items-center gap-2">
                  🌍 Filter by Country (GEO)
                  <Badge variant="secondary">{csvCountries.length} countries in file</Badge>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Select which countries to import (leave empty for all)
                </p>
                <div className="flex flex-wrap gap-2 p-2 bg-background rounded border">
                  {csvCountries.map((country) => {
                    const count = csvLeads.filter(l => l.country_code === country.code).length;
                    return (
                      <Button
                        key={country.code}
                        variant={csvFilterCountries.includes(country.code) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleCsvCountry(country.code)}
                      >
                        {country.code} ({count})
                      </Button>
                    );
                  })}
                </div>
                {csvFilterCountries.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    <span className="text-sm text-muted-foreground mr-2">Selected:</span>
                    {csvFilterCountries.map(code => (
                      <Badge key={code} variant="default" className="text-xs">
                        {code}
                        <button
                          className="ml-1 hover:text-destructive"
                          onClick={() => toggleCsvCountry(code)}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-5"
                      onClick={() => setCsvFilterCountries([])}
                    >
                      Clear all
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* CSV Preview */}
        {csvLeads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                CSV Preview ({filteredCsvLeads.length} of {csvLeads.length} leads)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    filteredCsvLeads.reduce((acc, lead) => {
                      acc[lead.country_code] = (acc[lead.country_code] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([code, count]) => (
                    <Badge key={code} variant="outline">
                      {code}: {count}
                    </Badge>
                  ))}
                </div>

                <div className="max-h-64 overflow-y-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Phone</th>
                        <th className="text-left p-2">Country</th>
                        <th className="text-left p-2">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCsvLeads.slice(0, 50).map((lead, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{lead.firstname} {lead.lastname}</td>
                          <td className="p-2">{lead.email}</td>
                          <td className="p-2">{lead.mobile}</td>
                          <td className="p-2">{lead.country_code}</td>
                          <td className="p-2 text-muted-foreground">
                            {lead.ip_address || <span className="italic">auto-gen</span>}
                          </td>
                        </tr>
                      ))}
                      {filteredCsvLeads.length > 50 && (
                        <tr className="border-t">
                          <td colSpan={5} className="p-2 text-center text-muted-foreground">
                            ... and {filteredCsvLeads.length - 50} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Button
                  className="w-full"
                  onClick={handleAddCsvLeads}
                  disabled={addLeads.isPending || filteredCsvLeads.length === 0}
                >
                  {addLeads.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add {filteredCsvLeads.length} Leads to Pool
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CSV Template Info */}
        {csvLeads.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                CSV Format Example
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const csvContent = `firstname,lastname,email,mobile,country_code,ip_address,offer_name,custom1,custom2,custom3,comment
John,Smith,john@example.com,+447123456789,GB,77.96.142.85,Premium Offer,value1,value2,value3,Sample lead
Jane,Doe,jane@example.com,+4915712345678,DE,,Basic Offer,,,,"No IP - will be generated"
Ahmed,Hassan,ahmed@example.com,+971501234567,AE,185.176.43.22,Gold Package,,,,
Maria,Garcia,maria@example.com,+34612345678,ES,,Standard,custom_a,custom_b,,Spanish lead`;
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'injection_leads_template.csv';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    toast.success('Template downloaded!');
                  }}
                >
                  <Upload className="h-4 w-4 mr-2 rotate-180" />
                  Download Template
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`firstname,lastname,email,mobile,country_code,ip_address,offer_name,custom1,custom2,custom3,comment
John,Smith,john@example.com,+447123456789,GB,77.96.142.85,Premium Offer,value1,value2,value3,Sample lead
Jane,Doe,jane@example.com,+4915712345678,DE,,Basic Offer,,,,"No IP - will be generated"`}
              </pre>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p><strong>Required:</strong> firstname, lastname, email, mobile, country_code</p>
                <p><strong>Optional:</strong> ip_address, offer_name, custom1, custom2, custom3, comment</p>
                <p>💡 If IP address is empty, it will be auto-generated based on the country code.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
