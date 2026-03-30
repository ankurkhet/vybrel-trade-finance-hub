import React, { useState, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { USER_MANUAL_SECTIONS, filterManualContent } from "@/lib/userManualData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileText, Search, Filter, Printer, BookOpen, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function HelpCenter() {
  const { roles, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [adminViewRole, setAdminViewRole] = useState<string>("all-access");
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredSections = useMemo(() => {
    let sections = filterManualContent(
      USER_MANUAL_SECTIONS, 
      isAdmin && adminViewRole !== "all-access" ? [adminViewRole as any] : roles, 
      isAdmin && adminViewRole === "all-access"
    );

    if (searchQuery) {
      sections = sections.filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return sections;
  }, [roles, isAdmin, adminViewRole, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;
    
    const toastId = toast.loading("Preparing high-fidelity PDF manual...");
    
    try {
      const element = contentRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1200,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`Vybrel_User_Manual_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.dismiss(toastId);
      toast.success("Professional manual downloaded.");
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.dismiss(toastId);
      toast.error("Failed to generate PDF. Please try printing to PDF instead.");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="help-center-root">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b pb-8 border-border/40">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase">
              <BookOpen className="w-3.5 h-3.5" />
              Resources
            </div>
            <h1 className="text-4xl font-extralight tracking-tight text-foreground sm:text-5xl" style={{ fontFamily: "'Source Serif 4', serif" }}>
              Vybrel <span className="text-primary font-normal">Vault</span>
            </h1>
            <p className="text-lg text-muted-foreground/80 max-w-2xl font-light">
              Your comprehensive guide to the Vybrel Trade Finance ecosystem, SOPs, and role-based workflows.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 no-print">
            {isAdmin && (
              <Select value={adminViewRole} onValueChange={setAdminViewRole}>
                <SelectTrigger className="w-[200px] h-11 bg-background/50 backdrop-blur-sm border-border/60">
                  <Filter className="w-4 h-4 mr-2 text-primary" />
                  <SelectValue placeholder="View as role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-access">Comprehensive (All)</SelectItem>
                  <SelectItem value="admin">Platform Admin</SelectItem>
                  <SelectItem value="originator_admin">Originator Admin</SelectItem>
                  <SelectItem value="borrower">Borrower</SelectItem>
                  <SelectItem value="funder">Funder</SelectItem>
                </SelectContent>
              </Select>
            )}
            
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-11 px-5 border-border/60" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              {isAdmin && (
                <Button className="h-11 px-5 shadow-lg shadow-primary/20" onClick={handleDownloadPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-12 max-w-2xl no-print">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
          <Input 
            placeholder="Search the master manual for topics or keywords..." 
            className="h-14 pl-12 bg-background/40 backdrop-blur-md border-border/40 text-lg placeholder:text-muted-foreground/40 shadow-sm focus-visible:ring-primary/30"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Navigation Sidebar - no-print */}
          <div className="lg:col-span-3 no-print">
            <div className="sticky top-24 space-y-6">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/60 ml-3">Contents</h3>
              <nav className="flex flex-col space-y-1">
                {filteredSections.map(section => (
                  <a 
                    key={section.id} 
                    href={`#${section.id}`}
                    className="group flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-primary/5 transition-all duration-200"
                  >
                    <span className="text-sm font-medium text-foreground/70 group-hover:text-primary transition-colors">
                      {section.title}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-0.5 transition-all" />
                  </a>
                ))}
              </nav>
              
              <div className="p-6 rounded-2xl bg-secondary/30 border border-border/40 mt-8">
                <p className="text-sm font-medium mb-2">Need Support?</p>
                <p className="text-xs text-muted-foreground mb-4">Can't find what you're looking for? Reach out to our technical team.</p>
                <Button variant="link" className="p-0 h-auto text-xs text-primary underline-offset-4">
                  Contact Support
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9 space-y-16 pb-24" ref={contentRef}>
            <style>
              {`
                @media print {
                  .no-print { display: none !important; }
                  body { background: white !important; }
                  #help-center-root { max-width: 100% !important; padding: 0 !important; }
                  .lg\\:col-span-9 { grid-column: span 12 / span 12 !important; }
                  .prose { max-width: none !important; }
                  img { page-break-inside: avoid; }
                  article { page-break-after: always; }
                }
              `}
            </style>
            
            {filteredSections.length === 0 ? (
              <div className="py-24 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
                  <Search className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-xl font-medium mb-1">No results found</h3>
                <p className="text-muted-foreground">Try adjusting your search query or role filter.</p>
              </div>
            ) : (
              filteredSections.map(section => (
                <article 
                  key={section.id} 
                  id={section.id} 
                  className="scroll-mt-24 group animate-in fade-in slide-in-from-bottom-4 duration-700"
                >
                  <div className="transition-all duration-500 border-l-2 border-transparent group-hover:border-primary/20 pl-6 md:pl-10">
                    <div className="prose prose-slate dark:prose-invert prose-lg max-w-none 
                      prose-headings:font-light prose-headings:tracking-tight 
                      prose-h1:text-3xl prose-h1:mb-8 prose-h1:font-serif
                      prose-h2:text-xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:font-medium
                      prose-p:text-muted-foreground/90 prose-p:leading-relaxed
                      prose-img:rounded-2xl prose-img:shadow-2xl prose-img:border prose-img:border-border/40 prose-img:my-10
                      prose-strong:text-foreground prose-strong:font-semibold
                      prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {section.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
