import React, { useState, useMemo, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/hooks/useAuth";
import {
  USER_MANUAL_SECTIONS,
  MANUAL_CATEGORIES,
  filterManualContent,
} from "@/lib/userManualData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Search,
  Filter,
  Printer,
  BookOpen,
  ChevronRight,
  X,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface HelpCentreContentProps {
  embedded?: boolean;
}

export default function HelpCentreContent({ embedded }: HelpCentreContentProps) {
  const { roles, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [adminViewRole, setAdminViewRole] = useState<string>("all-access");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredSections = useMemo(() => {
    let sections = filterManualContent(
      USER_MANUAL_SECTIONS,
      isAdmin && adminViewRole !== "all-access"
        ? [adminViewRole as any]
        : roles,
      isAdmin && adminViewRole === "all-access",
      activeCategory !== "all" ? activeCategory : undefined
    );

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      sections = sections.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.content.toLowerCase().includes(q)
      );
    }
    return sections;
  }, [roles, isAdmin, adminViewRole, searchQuery, activeCategory]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = useCallback(async () => {
    if (!contentRef.current) return;
    const toastId = toast.loading("Generating PDF manual…");
    try {
      const element = contentRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1200,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10; // mm each side
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;

      // scale canvas width to usableW
      const ratio = usableW / canvas.width;
      const scaledH = canvas.height * ratio;
      const stripHeightPx = usableH / ratio; // canvas px per page

      let y = 0;
      let pageNum = 0;
      while (y < canvas.height) {
        if (pageNum > 0) pdf.addPage();
        const sliceH = Math.min(stripHeightPx, canvas.height - y);

        // create a temp canvas for this strip
        const strip = document.createElement("canvas");
        strip.width = canvas.width;
        strip.height = sliceH;
        const ctx = strip.getContext("2d");
        if (ctx) {
          ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        }
        const stripData = strip.toDataURL("image/jpeg", 0.92);
        const imgH = sliceH * ratio;
        pdf.addImage(stripData, "JPEG", margin, margin, usableW, imgH);
        y += sliceH;
        pageNum++;
      }

      pdf.save(`Vybrel_User_Manual_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.dismiss(toastId);
      toast.success("Manual downloaded successfully.");
    } catch {
      toast.dismiss(toastId);
      toast.error("PDF generation failed. Try printing to PDF instead.");
    }
  }, []);

  const categoriesWithCounts = useMemo(() => {
    const allSections = filterManualContent(
      USER_MANUAL_SECTIONS,
      isAdmin && adminViewRole !== "all-access"
        ? [adminViewRole as any]
        : roles,
      isAdmin && adminViewRole === "all-access"
    );
    return MANUAL_CATEGORIES.map((cat) => ({
      ...cat,
      count: allSections.filter((s) => s.category === cat.id).length,
    }));
  }, [roles, isAdmin, adminViewRole]);

  return (
    <div className="flex flex-col h-full" id="help-center-root">
      {/* Top Bar */}
      <div className="flex-shrink-0 border-b border-border/40 bg-background/80 backdrop-blur-sm px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
              <BookOpen className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h1
                className="text-xl font-light tracking-tight text-foreground"
                style={{ fontFamily: "'Source Serif 4', serif" }}
              >
                Vybrel <span className="text-primary font-medium">Knowledge Base</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                {filteredSections.length} article{filteredSections.length !== 1 ? "s" : ""} available
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            {isAdmin && (
              <Select value={adminViewRole} onValueChange={setAdminViewRole}>
                <SelectTrigger className="w-[170px] h-9 text-xs bg-background border-border/60">
                  <Filter className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  <SelectValue placeholder="View as role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-access">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="originator_admin">Originator</SelectItem>
                  <SelectItem value="borrower">Borrower</SelectItem>
                  <SelectItem value="funder">Funder</SelectItem>
                  <SelectItem value="operations_manager">Operations</SelectItem>
                  <SelectItem value="credit_committee_member">Committee</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
            </Button>
            {isAdmin && (
              <Button size="sm" className="h-9 text-xs shadow-md shadow-primary/15" onClick={handleDownloadPDF}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export PDF
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4 max-w-xl no-print">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            placeholder="Search articles, topics, or keywords..."
            className="h-10 pl-9 bg-background/60 border-border/40 text-sm placeholder:text-muted-foreground/40"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Category Sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-border/30 bg-muted/20 no-print hidden md:block">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-1">
              <button
                onClick={() => { setActiveCategory("all"); setActiveSection(null); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === "all"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                All Articles
                <Badge variant="secondary" className="ml-auto float-right text-[10px] h-5">
                  {USER_MANUAL_SECTIONS.length}
                </Badge>
              </button>

              {categoriesWithCounts
                .filter((c) => c.count > 0)
                .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setActiveSection(null); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      activeCategory === cat.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {cat.label}
                    <Badge variant="secondary" className="ml-auto float-right text-[10px] h-5">
                      {cat.count}
                    </Badge>
                  </button>
                ))}

              {/* Article list under active category */}
              <div className="pt-3 mt-3 border-t border-border/30">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
                  Articles
                </p>
                {filteredSections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={() => setActiveSection(s.id)}
                    className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] transition-colors ${
                      activeSection === s.id
                        ? "text-primary bg-primary/5"
                        : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <FileText className="w-3 h-3 flex-shrink-0 opacity-40" />
                    <span className="truncate">{s.title}</span>
                  </a>
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto px-6 md:px-10 py-8 pb-24" ref={contentRef}>
            <style>
              {`
                @media print {
                  .no-print { display: none !important; }
                  body { background: white !important; }
                  #help-center-root { max-width: 100% !important; padding: 0 !important; }
                  .prose { max-width: none !important; }
                  img { page-break-inside: avoid; }
                  article { page-break-after: always; }
                }
              `}
            </style>

            {filteredSections.length === 0 ? (
              <div className="py-24 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
                  <Search className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-medium mb-1">No articles found</h3>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or category filter.
                </p>
              </div>
            ) : (
              filteredSections.map((section) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 mb-16 group"
                >
                  <div className="transition-all duration-300 border-l-2 border-transparent group-hover:border-primary/20 pl-6 md:pl-8">
                    <Badge variant="outline" className="mb-3 text-[10px] uppercase tracking-wider">
                      {MANUAL_CATEGORIES.find((c) => c.id === section.category)?.label || section.category}
                    </Badge>
                    <div
                      className="prose prose-slate dark:prose-invert prose-sm max-w-none
                        prose-headings:font-light prose-headings:tracking-tight
                        prose-h1:text-2xl prose-h1:mb-6 prose-h1:font-serif prose-h1:border-b prose-h1:border-border/30 prose-h1:pb-4
                        prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h2:font-medium
                        prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-h3:font-medium
                        prose-p:text-muted-foreground/90 prose-p:leading-relaxed prose-p:text-sm
                        prose-li:text-muted-foreground/90 prose-li:text-sm
                        prose-table:text-sm prose-th:text-left prose-th:font-medium prose-th:text-foreground
                        prose-td:text-muted-foreground/90
                        prose-strong:text-foreground prose-strong:font-semibold
                        prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                        prose-blockquote:border-primary/30 prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                        prose-img:rounded-xl prose-img:border prose-img:border-border/40 prose-img:shadow-lg prose-img:shadow-black/5 prose-img:my-6
                      "
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {section.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
