const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Health check support
    if (body?.health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "parse-document" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_content, file_name, file_type } = body;

    if (!file_content || !file_name) {
      return new Response(
        JSON.stringify({ error: "file_content and file_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 content
    const binaryContent = Uint8Array.from(atob(file_content), c => c.charCodeAt(0));

    let extractedText = "";

    // For PDF files, we'll use a simple text extraction approach
    // For production, you'd want a more robust PDF parsing library
    if (file_type === "application/pdf" || file_name.endsWith(".pdf")) {
      // Try to extract readable text from PDF
      // This is a basic approach - PDFs with complex layouts may not extract well
      const textDecoder = new TextDecoder("utf-8", { fatal: false });
      const rawText = textDecoder.decode(binaryContent);
      
      // Extract text between stream/endstream or BT/ET markers (basic PDF text extraction)
      const textMatches = rawText.match(/\(([^)]+)\)/g) || [];
      const streamMatches = rawText.match(/stream\s*([\s\S]*?)\s*endstream/g) || [];
      
      // Try to find readable text patterns
      const readableText = rawText
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')  // Keep only printable ASCII
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .trim();
      
      if (readableText.length > 100) {
        extractedText = readableText.substring(0, 50000); // Limit size
      } else {
        // Fallback: return a message asking to paste manually
        return new Response(
          JSON.stringify({ 
            error: "Could not extract text from this PDF. Please copy and paste the content manually.",
            text: ""
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (
      file_type === "application/msword" ||
      file_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file_name.endsWith(".doc") ||
      file_name.endsWith(".docx")
    ) {
      // For DOCX, try to extract text from XML content
      const textDecoder = new TextDecoder("utf-8", { fatal: false });
      const rawText = textDecoder.decode(binaryContent);
      
      // DOCX files are ZIP archives with XML content
      // Try to find text within <w:t> tags
      const textMatches = rawText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      
      if (textMatches.length > 0) {
        extractedText = textMatches
          .map(match => match.replace(/<[^>]+>/g, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        // Fallback for older .doc format
        const readableText = rawText
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (readableText.length > 100) {
          extractedText = readableText.substring(0, 50000);
        } else {
          return new Response(
            JSON.stringify({ 
              error: "Could not extract text from this document. Please copy and paste the content manually.",
              text: ""
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      // Plain text files
      const textDecoder = new TextDecoder("utf-8");
      extractedText = textDecoder.decode(binaryContent);
    }

    return new Response(
      JSON.stringify({ text: extractedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err as Error;
    console.error("Parse document error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to parse document",
        text: ""
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
