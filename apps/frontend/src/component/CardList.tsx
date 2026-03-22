import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";

type GroupKey = "none" | "cohort" | "prStatus" | "resumeStatus";

// Detect columns where ≥60% of values are numeric — auto score chips + sort keys
function detectScoreColumns(data: any[]): string[] {
  if (!data.length) return [];
  const allKeys = new Set<string>();
  data.forEach(c => Object.keys(c.rawData || {}).forEach((k: string) => allKeys.add(k)));

  return [...allKeys].filter(key => {
    const vals = data.map(c => c.rawData?.[key]).filter(v => v !== undefined && v !== null && v !== "");
    if (!vals.length) return false;
    const numCount = vals.filter(v => !isNaN(Number(v)) && v !== "").length;
    return numCount / vals.length >= 0.6;
  });
}

export default function CardList({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState<GroupKey>("none");
  const [filters, setFilters] = useState<{ cohort: string; prStatus: string; resumeStatus: string }>({
    cohort: "",
    prStatus: "",
    resumeStatus: "",
  });

  useEffect(() => {
    api.get("/candidates", { params: { search } })
      .then(res => setData(res.data))
      .catch(err => console.error("Error fetching candidates:", err));
  }, [search, refreshKey]);

  useEffect(() => {
    const heartbeatTimer = setInterval(() => {
      api.post("/upload/heartbeat")
        .catch(err => console.error("Heartbeat failed", err));
    }, 120000);

    const handleClose = () => {
      api.post("/upload/close")
        .catch(err => console.error("Close failed", err));
    };

    window.addEventListener("beforeunload", handleClose);
    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener("beforeunload", handleClose);
    };
  }, []);

  // Auto-detect score columns from rawData
  const scoreColumns = useMemo(() => detectScoreColumns(data), [data]);

  // Unique options for filter dropdowns
  const uniqueVals = useMemo(() => ({
    cohort: [...new Set(data.map(c => c.cohort).filter(Boolean))].sort(),
    prStatus: [...new Set(data.map(c => c.prStatus).filter(Boolean))].sort(),
    resumeStatus: [...new Set(data.map(c => c.resumeStatus).filter(Boolean))].sort(),
  }), [data]);

  const processed = useMemo(() => {
    let result = [...data];
    if (filters.cohort) result = result.filter(c => c.cohort === filters.cohort);
    if (filters.prStatus) result = result.filter(c => c.prStatus === filters.prStatus);
    if (filters.resumeStatus) result = result.filter(c => c.resumeStatus === filters.resumeStatus);

    result.sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === "name") {
        av = (a.name || "").toLowerCase();
        bv = (b.name || "").toLowerCase();
      } else {
        av = Number(a.rawData?.[sortKey] ?? 0);
        bv = Number(b.rawData?.[sortKey] ?? 0);
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, filters, sortKey, sortDir]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return { "All Candidates": processed };
    const groups: Record<string, any[]> = {};
    for (const c of processed) {
      const key = c[groupBy] || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  }, [processed, groupBy]);

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => setFilters({ cohort: "", prStatus: "", resumeStatus: "" });

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const getBadgeColor = (prStatus: string) => {
    const lower = (prStatus || "").toLowerCase();
    if (lower.includes("ready") && !lower.includes("not")) return { bg: "#dcfce7", text: "#16a34a" };
    if (lower.includes("not")) return { bg: "#fee2e2", text: "#dc2626" };
    return { bg: "#fef9c3", text: "#ca8a04" };
  };

  const getScoreColor = (val: number, max: number) => {
    const pct = max > 0 ? (val / max) * 100 : 0;
    if (pct >= 80) return { chip: "#dcfce7", text: "#15803d", bar: "#22c55e" };
    if (pct >= 60) return { chip: "#fef9c3", text: "#b45309", bar: "#eab308" };
    return { chip: "#fee2e2", text: "#b91c1c", bar: "#ef4444" };
  };

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          style={styles.searchInput}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search by name or email..."
        />

        {/* Dynamic sort buttons */}
        <div style={styles.controlGroup}>
          <label style={styles.controlLabel}>Sort by</label>
          <div style={styles.sortButtons}>
            {(["name", ...scoreColumns] as string[]).map(key => (
              <button
                key={key}
                style={{ ...styles.sortBtn, ...(sortKey === key ? styles.sortBtnActive : {}) }}
                onClick={() => toggleSort(key)}
              >
                {key === "name" ? "Name" : key}
                {sortKey === key && <span style={{ marginLeft: "4px" }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Group By */}
        <div style={styles.controlGroup}>
          <label style={styles.controlLabel}>Group by</label>
          <select style={styles.select} value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupKey)}>
            <option value="none">No Grouping</option>
            <option value="cohort">Cohort</option>
            <option value="prStatus">Placement Status</option>
            <option value="resumeStatus">Resume Status</option>
          </select>
        </div>

        {/* Filters */}
        <div style={styles.controlGroup}>
          <label style={styles.controlLabel}>
            Filter
            {activeFiltersCount > 0 && <span style={styles.filterCount}>{activeFiltersCount} active</span>}
          </label>
          <div style={styles.filterRow}>
            <select style={styles.select} value={filters.cohort} onChange={e => setFilters(f => ({ ...f, cohort: e.target.value }))}>
              <option value="">All Cohorts</option>
              {uniqueVals.cohort.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select style={styles.select} value={filters.prStatus} onChange={e => setFilters(f => ({ ...f, prStatus: e.target.value }))}>
              <option value="">All PR Status</option>
              {uniqueVals.prStatus.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select style={styles.select} value={filters.resumeStatus} onChange={e => setFilters(f => ({ ...f, resumeStatus: e.target.value }))}>
              <option value="">All Resume Status</option>
              {uniqueVals.resumeStatus.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            {activeFiltersCount > 0 && (
              <button style={styles.clearBtn} onClick={clearFilters}>✕ Clear</button>
            )}
          </div>
        </div>
      </div>

      <p style={styles.countLabel}>
        {processed.length} of {data.length} candidate{data.length !== 1 ? "s" : ""}
        {activeFiltersCount > 0 && " (filtered)"}
      </p>

      {processed.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: "40px" }}>🔍</div>
          <p>No candidates match your filters.</p>
          <button style={styles.clearBtn} onClick={clearFilters}>Clear all filters</button>
        </div>
      ) : (
        Object.entries(grouped).map(([groupName, candidates]) => (
          <div key={groupName} style={styles.groupSection}>
            {groupBy !== "none" && (
              <div style={styles.groupHeader}>
                <span style={styles.groupLabel}>{groupName}</span>
                <span style={styles.groupCount}>{candidates.length}</span>
              </div>
            )}
            <div style={styles.grid}>
              {candidates.map((c) => {
                const cardId = c._id;
                const isHovered = hoveredCard === cardId;
                const prBadge = getBadgeColor(c.prStatus);
                const raw: Record<string, any> = c.rawData || {};

                const scoreEntries = scoreColumns
                  .map(col => ({ col, val: raw[col] }))
                  .filter(({ val }) => val !== undefined && val !== null && val !== "");

                const nonScoreEntries = Object.entries(raw).filter(
                  ([k, v]) => !scoreColumns.includes(k) && v !== "" && v !== null && v !== undefined
                );

                const maxScore = Math.max(...scoreEntries.map(({ val }) => Number(val) || 0), 100);

                return (
                  <div
                    key={cardId}
                    style={{
                      ...styles.card,
                      transform: isHovered ? "translateY(-6px)" : "translateY(0)",
                      boxShadow: isHovered
                        ? "0 20px 40px rgba(79,70,229,0.18)"
                        : "0 4px 16px rgba(0,0,0,0.06)",
                      border: isHovered ? "1.5px solid #c7d2fe" : "1.5px solid #f1f5f9",
                    }}
                    onMouseEnter={() => setHoveredCard(cardId)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    {/* Card Header */}
                    <div style={styles.cardHeader}>
                      <div style={{
                        ...styles.avatar,
                        background: isHovered
                          ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                          : "linear-gradient(135deg, #6366f1, #4f46e5)",
                      }}>
                        {(c.name || "?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={styles.cardTitle}>{c.name}</h3>
                        <p style={styles.cardEmail}>{c.email || "—"}</p>
                      </div>
                      <span style={{ ...styles.prBadge, backgroundColor: prBadge.bg, color: prBadge.text }}>
                        {c.prStatus || "Unknown"}
                      </span>
                    </div>

                    {/* Summary Row */}
                    <div style={styles.summaryRow}>
                      <div style={styles.summaryItem}>
                        <span style={styles.summaryLabel}>Phone</span>
                        <span style={styles.summaryValue}>{c.phone || "—"}</span>
                      </div>
                      <div style={styles.summaryItem}>
                        <span style={styles.summaryLabel}>Cohort</span>
                        <span style={styles.summaryValue}>{c.cohort || "—"}</span>
                      </div>
                      <div style={styles.summaryItem}>
                        <span style={styles.summaryLabel}>Resume</span>
                        <span style={{ ...styles.summaryValue, color: c.resumeStatus === "Approved" ? "#16a34a" : "#64748b" }}>
                          {c.resumeStatus || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Dynamic Score Chips */}
                    {scoreEntries.length > 0 && (
                      <div style={styles.scoreRow}>
                        {scoreEntries.map(({ col, val }) => {
                          const num = Number(val) || 0;
                          const colors = getScoreColor(num, maxScore);
                          return (
                            <div key={col} style={{ ...styles.scoreChip, backgroundColor: colors.chip }}>
                              <span style={{ ...styles.scoreChipLabel, color: colors.text }}>{col}</span>
                              <span style={{ ...styles.scoreChipVal, color: colors.text }}>
                                {Number.isInteger(num) ? num : num.toFixed(1)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Hover-expand section */}
                    <div style={{
                      maxHeight: isHovered ? "900px" : "0px",
                      opacity: isHovered ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}>
                      <hr style={styles.divider} />

                      {/* Score bars with fill animation */}
                      {scoreEntries.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <span style={styles.sectionHeading}>Score Breakdown</span>
                          {scoreEntries.map(({ col, val }) => {
                            const num = Number(val) || 0;
                            const pct = Math.min(maxScore > 0 ? (num / maxScore) * 100 : 0, 100);
                            const colors = getScoreColor(num, maxScore);
                            return (
                              <div key={col}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{col}</span>
                                  <span style={{ fontSize: "12px", fontWeight: 700, color: colors.text }}>
                                    {Number.isInteger(num) ? num : num.toFixed(1)}
                                  </span>
                                </div>
                                <div style={{ height: "6px", backgroundColor: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                                  <div style={{
                                    height: "100%",
                                    width: isHovered ? `${pct}%` : "0%",
                                    backgroundColor: colors.bar,
                                    borderRadius: "3px",
                                    transition: "width 0.6s cubic-bezier(0.4,0,0.2,1) 0.15s",
                                  }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Resume link */}
                      {c.resumeLink && (
                        <a
                          href={c.resumeLink}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.resumeBtn}
                          onClick={(e) => e.stopPropagation()}
                        >
                          📄 View Resume ↗
                        </a>
                      )}

                      {/* All Excel fields in 2-column grid */}
                      {nonScoreEntries.length > 0 && (
                        <>
                          <span style={styles.sectionHeading}>All Excel Fields</span>
                          <div style={styles.detailsGrid}>
                            {nonScoreEntries.map(([key, value]) => {
                              const isLink = typeof value === "string" && value.startsWith("http");
                              return (
                                <div key={key} style={styles.detailRow}>
                                  <span style={styles.detailKey}>{key}</span>
                                  {isLink ? (
                                    <a href={value} target="_blank" rel="noreferrer" style={styles.detailLink} onClick={e => e.stopPropagation()}>
                                      View ↗
                                    </a>
                                  ) : (
                                    <span style={styles.detailVal}>
                                      {typeof value === "number"
                                        ? Number(value).toFixed(2).replace(/\.00$/, "")
                                        : String(value)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Subtle hover hint when collapsed */}
                    <div style={{
                      textAlign: "center",
                      fontSize: "11px",
                      color: "#94a3b8",
                      fontStyle: "italic",
                      opacity: isHovered ? 0 : 1,
                      transition: "opacity 0.2s ease",
                      paddingTop: "2px",
                    }}>
                      Hover to expand details
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: "20px", maxWidth: "1300px", margin: "0 auto", fontFamily: "'Inter', system-ui, sans-serif" },
  toolbar: { display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: "20px", border: "1px solid #f1f5f9" },
  searchInput: { width: "100%", padding: "12px 20px", fontSize: "15px", borderRadius: "30px", border: "2px solid #e2e8f0", outline: "none", boxSizing: "border-box" },
  controlGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  controlLabel: { fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "8px" },
  filterCount: { backgroundColor: "#4f46e5", color: "#fff", padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 },
  sortButtons: { display: "flex", gap: "8px", flexWrap: "wrap" },
  sortBtn: { padding: "7px 14px", borderRadius: "20px", border: "1.5px solid #e2e8f0", backgroundColor: "#f8fafc", fontSize: "13px", fontWeight: 600, color: "#475569", cursor: "pointer", transition: "all 0.15s" },
  sortBtnActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5", color: "#fff" },
  filterRow: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" },
  select: { padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #e2e8f0", fontSize: "13px", backgroundColor: "#f8fafc", color: "#334155", cursor: "pointer", outline: "none" },
  clearBtn: { padding: "7px 14px", borderRadius: "8px", border: "1.5px solid #fca5a5", backgroundColor: "#fff1f2", color: "#dc2626", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  countLabel: { fontSize: "13px", color: "#64748b", margin: "0 0 16px 4px" },
  emptyState: { textAlign: "center", padding: "50px", backgroundColor: "#f8fafc", borderRadius: "16px", color: "#64748b", border: "2px dashed #cbd5e1", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" },
  groupSection: { marginBottom: "32px" },
  groupHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" },
  groupLabel: { fontSize: "16px", fontWeight: 700, color: "#0f172a" },
  groupCount: { backgroundColor: "#e0e7ff", color: "#4338ca", padding: "3px 10px", borderRadius: "20px", fontSize: "13px", fontWeight: 700 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px", alignItems: "start" },
  card: {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "20px",
    cursor: "default",
    transition: "box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s cubic-bezier(0.4,0,0.2,1)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  cardHeader: { display: "flex", gap: "12px", alignItems: "flex-start" },
  avatar: { width: "44px", height: "44px", borderRadius: "50%", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700, flexShrink: 0, transition: "background 0.3s ease" },
  cardTitle: { margin: "0 0 4px", fontSize: "17px", color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cardEmail: { margin: 0, fontSize: "13px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  prBadge: { flexShrink: 0, padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" },
  summaryRow: { display: "flex", gap: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", padding: "10px 14px" },
  summaryItem: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
  summaryLabel: { fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" },
  summaryValue: { fontSize: "13px", fontWeight: 600, color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  scoreRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
  scoreChip: { flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "10px", padding: "8px 6px", minWidth: "60px" },
  scoreChipLabel: { fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 },
  scoreChipVal: { fontSize: "16px", fontWeight: 700, marginTop: "2px" },
  divider: { border: "none", borderTop: "1px dashed #e2e8f0", margin: "0" },
  resumeBtn: { display: "inline-block", padding: "8px 16px", backgroundColor: "#4f46e5", color: "#fff", borderRadius: "8px", textDecoration: "none", fontSize: "13px", fontWeight: 600, alignSelf: "flex-start" },
  sectionHeading: { fontSize: "11px", color: "#334155", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" },
  detailsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" },
  detailRow: { display: "flex", flexDirection: "column", gap: "2px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "#f8fafc" },
  detailKey: { fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" },
  detailVal: { fontSize: "13px", color: "#0f172a", fontWeight: 500, wordBreak: "break-word" },
  detailLink: { color: "#4f46e5", textDecoration: "none", fontWeight: 600, fontSize: "13px" },
};
