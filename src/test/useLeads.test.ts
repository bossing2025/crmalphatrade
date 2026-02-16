import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        neq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: mockLeads, error: null })),
        })),
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: mockLeads[0], error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockLeads[0], error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockLeads[0], error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn() })),
    })),
    removeChannel: vi.fn(),
  },
}));

const mockLeads = [
  {
    id: "lead-1",
    request_id: "req-123",
    firstname: "John",
    lastname: "Doe",
    email: "john@example.com",
    mobile: "+1234567890",
    country_code: "US",
    status: "new",
    is_ftd: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "lead-2",
    request_id: "req-456",
    firstname: "Jane",
    lastname: "Smith",
    email: "jane@example.com",
    mobile: "+0987654321",
    country_code: "GB",
    status: "converted",
    is_ftd: true,
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
  },
];

describe("Lead Data Structure", () => {
  it("should have required lead fields", () => {
    const lead = mockLeads[0];
    
    expect(lead).toHaveProperty("id");
    expect(lead).toHaveProperty("firstname");
    expect(lead).toHaveProperty("lastname");
    expect(lead).toHaveProperty("email");
    expect(lead).toHaveProperty("mobile");
    expect(lead).toHaveProperty("country_code");
    expect(lead).toHaveProperty("status");
    expect(lead).toHaveProperty("is_ftd");
  });

  it("should have valid status values", () => {
    const validStatuses = ["new", "contacted", "qualified", "converted", "lost", "rejected"];
    
    mockLeads.forEach((lead) => {
      expect(validStatuses).toContain(lead.status);
    });
  });

  it("should have valid email format", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    mockLeads.forEach((lead) => {
      expect(lead.email).toMatch(emailRegex);
    });
  });

  it("should have boolean is_ftd field", () => {
    mockLeads.forEach((lead) => {
      expect(typeof lead.is_ftd).toBe("boolean");
    });
  });
});

describe("Lead Filtering Logic", () => {
  it("should filter leads by search term", () => {
    const searchTerm = "john";
    const filtered = mockLeads.filter(
      (lead) =>
        lead.firstname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.lastname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].firstname).toBe("John");
  });

  it("should filter leads by status", () => {
    const filtered = mockLeads.filter((lead) => lead.status === "converted");
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].is_ftd).toBe(true);
  });

  it("should filter leads by country", () => {
    const filtered = mockLeads.filter((lead) => lead.country_code === "GB");
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].lastname).toBe("Smith");
  });

  it("should filter leads by date range", () => {
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-01T23:59:59");
    
    const filtered = mockLeads.filter((lead) => {
      const leadDate = new Date(lead.created_at);
      return leadDate >= startDate && leadDate <= endDate;
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].firstname).toBe("John");
  });
});

describe("Lead Sorting Logic", () => {
  it("should sort leads by firstname ascending", () => {
    const sorted = [...mockLeads].sort((a, b) => a.firstname.localeCompare(b.firstname));
    
    expect(sorted[0].firstname).toBe("Jane");
    expect(sorted[1].firstname).toBe("John");
  });

  it("should sort leads by created_at descending", () => {
    const sorted = [...mockLeads].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    expect(sorted[0].firstname).toBe("Jane");
    expect(sorted[1].firstname).toBe("John");
  });

  it("should sort leads by status", () => {
    const sorted = [...mockLeads].sort((a, b) => a.status.localeCompare(b.status));
    
    expect(sorted[0].status).toBe("converted");
    expect(sorted[1].status).toBe("new");
  });
});

describe("Pagination Logic", () => {
  const allLeads = Array.from({ length: 50 }, (_, i) => ({
    ...mockLeads[0],
    id: `lead-${i}`,
    firstname: `User${i}`,
  }));

  it("should paginate correctly with page size 10", () => {
    const pageSize = 10;
    const currentPage = 1;
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = allLeads.slice(startIndex, startIndex + pageSize);
    
    expect(paginated).toHaveLength(10);
    expect(paginated[0].firstname).toBe("User0");
    expect(paginated[9].firstname).toBe("User9");
  });

  it("should return correct items for page 3", () => {
    const pageSize = 10;
    const currentPage = 3;
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = allLeads.slice(startIndex, startIndex + pageSize);
    
    expect(paginated).toHaveLength(10);
    expect(paginated[0].firstname).toBe("User20");
  });

  it("should calculate total pages correctly", () => {
    const pageSize = 10;
    const totalPages = Math.ceil(allLeads.length / pageSize);
    
    expect(totalPages).toBe(5);
  });

  it("should handle last page with fewer items", () => {
    const pageSize = 15;
    const totalPages = Math.ceil(allLeads.length / pageSize);
    const lastPageItems = allLeads.slice((totalPages - 1) * pageSize);
    
    expect(totalPages).toBe(4);
    expect(lastPageItems).toHaveLength(5); // 50 - (3 * 15) = 5
  });
});
