import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface ConversionChartsProps {
  fromDate: Date;
  toDate: Date;
}

const COLORS = ['hsl(var(--primary))', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function ConversionCharts({ fromDate, toDate }: ConversionChartsProps) {
  // Fetch conversion by country
  const { data: countryData, isLoading: countryLoading } = useQuery({
    queryKey: ['conversion-by-country', fromDate, toDate],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from('leads')
        .select('country_code, is_ftd')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString())
        .neq('status', 'rejected');

      if (!leads) return [];

      const grouped: Record<string, { leads: number; ftd: number }> = {};
      leads.forEach((lead) => {
        const country = lead.country_code || 'Unknown';
        if (!grouped[country]) {
          grouped[country] = { leads: 0, ftd: 0 };
        }
        grouped[country].leads++;
        if (lead.is_ftd) {
          grouped[country].ftd++;
        }
      });

      return Object.entries(grouped)
        .map(([country, data]) => ({
          country,
          leads: data.leads,
          ftd: data.ftd,
          cr: data.leads > 0 ? ((data.ftd / data.leads) * 100).toFixed(1) : '0',
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10);
    },
  });

  // Fetch conversion by advertiser
  const { data: advertiserData, isLoading: advertiserLoading } = useQuery({
    queryKey: ['conversion-by-advertiser', fromDate, toDate],
    queryFn: async () => {
      const { data: distributions } = await supabase
        .from('lead_distributions')
        .select(`
          status,
          advertiser_id,
          advertisers(name),
          leads!inner(is_ftd, created_at)
        `)
        .eq('status', 'sent')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (!distributions) return [];

      const grouped: Record<string, { name: string; leads: number; ftd: number }> = {};
      distributions.forEach((dist: any) => {
        const advId = dist.advertiser_id;
        const advName = dist.advertisers?.name || 'Unknown';
        if (!grouped[advId]) {
          grouped[advId] = { name: advName, leads: 0, ftd: 0 };
        }
        grouped[advId].leads++;
        if (dist.leads?.is_ftd) {
          grouped[advId].ftd++;
        }
      });

      return Object.values(grouped)
        .map((data) => ({
          name: data.name,
          leads: data.leads,
          ftd: data.ftd,
          cr: data.leads > 0 ? ((data.ftd / data.leads) * 100).toFixed(1) : '0',
        }))
        .sort((a, b) => b.leads - a.leads);
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Conversion by Country */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads by Country</CardTitle>
        </CardHeader>
        <CardContent>
          {countryLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : countryData && countryData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis 
                    dataKey="country" 
                    type="category" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: any, name: string) => [value, name === 'leads' ? 'Leads' : 'FTD']}
                  />
                  <Legend />
                  <Bar dataKey="leads" fill="hsl(var(--primary))" name="Leads" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="ftd" fill="#22c55e" name="FTD" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversion by Advertiser */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance by Advertiser</CardTitle>
        </CardHeader>
        <CardContent>
          {advertiserLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : advertiserData && advertiserData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={advertiserData}
                    dataKey="leads"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {advertiserData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: any, name: string, props: any) => [
                      `${value} leads, ${props.payload.ftd} FTD (${props.payload.cr}% CR)`,
                      props.payload.name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
