import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";

type SortKey = "name" | "beScore" | "fsdScore" | "feScore" | "dbmsScore";
type GroupKey = "none" | "cohort" | "prStatus" | "resumeStatus";

export default function CardList({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
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

  // Unique options for filter dropdowns
  const uniqueVals = useMemo(() => ({
    cohort: [...new Set(data.map(c => c.cohort).filter(Boolean))].sort(),
    prStatus: [...new Set(data.map(c => c.prStatus).filter(Boolean))].sort(),
    resumeStatus: [...new Set(data.map(c => c.resumeStatus).filter(Boolean))].sort(),
  }), [data]);

  // Apply AND-logic filters + sort
  const processed = useMemo(() => {
    let result = [...data];

    // AND logic: all active filters must match
    if (filters.cohort) result = result.filter(c => c.cohort === filters.cohort);
    if (filters.prStatus) result = result.filter(c => c.prStatus === filters.prStatus);
    if (filters.resumeStatus) result = result.filter(c => c.resumeStatus === filters.resumeStatus);

    // Sort
    result.sort((a, b) => {
      let av = a[sortKey] ?? "";
      let bv = b[sortKey] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, filters, sortKey, sortDir]);

  // Group the processed list
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const getBadgeColor = (prStatus: string) => {
    const lower = (prStatus || "").toLowerCase();
    if (lower.includes("ready") && !lower.includes("not")) return { bg: "#dcfce7", text: "#16a34a" };
    if (lower.includes("not")) return { bg: "#fee2e2", text: "#dc2626" };
    return { bg: "#fef9c3", text: "#ca8a04" };
  };

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        {/* Search */}
        <input
          style={styles.searchInput}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search by name or email..."
        />

        {/* Sort */}
        <div style={styles.controlGroup}>
          <label style={styles.controlLabel}>Sort by</label>
          <div style={styles.sortButtons}>
            {(["name", "beScore", "fsdScore", "feScore", "dbmsScore"] as SortKey[]).map(key => (
              <button
                key={key}
                style={{ ...styles.sortBtn, ...(sortKey === key ? styles.sortBtnActive : {}) }}
                onClick={() => toggleSort(key)}
              >
                {key === "name" ? "Name" : key.replace("Score", "").toUpperCase()}
                {sortKey === key && <span style={{ marginLeft: "4px" }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Group By */}
        <div style={styles.controlGroup}>
          <label style={styles.controlLabel}>Group by</label>
          <select
            style={styles.select}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupKey)}
          >
            <option value="none">No Grouping</option>
            <option value="cohort">Cohort</option>
            <option value="prStatus">Placement Status</option>
            <option value="resumeStatus">Resume Status</option>
          </select>
        </div>

        {/* Filters (AND logic) */}
        <div style={styles.controlGroup}>
          <label style={styles.controlLabel}>
            Filter
            {activeFiltersCount > 0 && (
              <span style={styles.filterCount}>{activeFiltersCount} active</span>
            )}
          </label>
          <div style={styles.filterRow}>
            <select
              style={styles.select}
              value={filters.cohort}
              onChange={e => setFilters(f => ({ ...f, cohort: e.target.value }))}
            >
              <option value="">All Cohorts</option>
              {uniqueVals.cohort.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select
              style={styles.select}
              value={filters.prStatus}
              onChange={e => setFilters(f => ({ ...f, prStatus: e.target.value }))}
            >
              <option value="">All PR Status</option>
              {uniqueVals.prStatus.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select
              style={styles.select}
              value={filters.resumeStatus}
              onChange={e => setFilters(f => ({ ...f, resumeStatus: e.target.value }))}
            >
              <option value="">All Resume Status</option>
              {uniqueVals.resumeStatus.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            {activeFiltersCount > 0 && (
              <button style={styles.clearBtn} onClick={clearFilters}>✕ Clear</button>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
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
                const isExpanded = expandedCard === cardId;
                const prBadge = getBadgeColor(c.prStatus);
                const raw: Record<string, any> = c.rawData || {};
                const rawEntries = Object.entries(raw).filter(([, v]) => v !== "" && v !== null && v !== undefined);

                return (
                  <div
                    key={cardId}
                    style={{
                      ...styles.card,
                      boxShadow: isExpanded ? "0 20px 40px rgba(79,70,229,0.15)" : "0 4px 16px rgba(0,0,0,0.06)",
                      border: isExpanded ? "1.5px solid #c7d2fe" : "1.5px solid #f1f5f9",
                    }}
                    onClick={() => setExpandedCard(isExpanded ? null : cardId)}
                  >
                    {/* Header */}
                    <div style={styles.cardHeader}>
                      <div style={styles.avatar}>{(c.name || "?")[0].toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={styles.cardTitle}>{c.name}</h3>
                        <p style={styles.cardEmail}>{c.email || "—"}</p>
                      </div>
                      <span style={{ ...styles.prBadge, backgroundColor: prBadge.bg, color: prBadge.text }}>
                        {c.prStatus || "Unknown"}
                      </span>
                    </div>

                    {/* Summary */}
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

                    {/* Score chips */}
                    <div style={styles.scoreRow}>
                      {[
                        { label: "BE", val: c.beScore },
                        { label: "FSD", val: c.fsdScore },
                        { label: "FE", val: c.feScore },
                        { label: "DBMS", val: c.dbmsScore },
                      ].map(({ label, val }) => (
                        <div key={label} style={styles.scoreChip}>
                          <span style={styles.scoreChipLabel}>{label}</span>
                          <span style={styles.scoreChipVal}>{val ? Number(val).toFixed(1) : "—"}</span>
                        </div>
                      ))}
                    </div>

                    <div style={styles.expandToggle}>
                      {isExpanded ? "▲ Hide Details" : "▼ Show All Details"}
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div style={styles.expandedSection}>
                        <hr style={styles.divider} />
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
                        <h4 style={styles.sectionHeading}>All Excel Columns</h4>
                        <div style={styles.detailsGrid}>
                          {rawEntries.map(([key, value]) => {
                            const isLink = typeof value === "string" && value.startsWith("http");
                            return (
                              <div key={key} style={styles.detailRow}>
                                <span style={styles.detailKey}>{key}</span>
                                {isLink ? (
                                  <a href={value} target="_blank" rel="noreferrer" style={styles.detailLink} onClick={e => e.stopPropagation()}>View ↗</a>
                                ) : (
                                  <span style={styles.detailVal}>
                                    {typeof value === "number" ? Number(value).toFixed(2).replace(/\.00$/, "") : String(value)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
  card: { backgroundColor: "#fff", borderRadius: "16px", padding: "20px", cursor: "pointer", transition: "box-shadow 0.25s, border-color 0.25s", display: "flex", flexDirection: "column", gap: "14px" },
  cardHeader: { display: "flex", gap: "12px", alignItems: "flex-start" },
  avatar: { width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#4f46e5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700, flexShrink: 0 },
  cardTitle: { margin: "0 0 4px", fontSize: "17px", color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cardEmail: { margin: 0, fontSize: "13px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  prBadge: { flexShrink: 0, padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" },
  summaryRow: { display: "flex", gap: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", padding: "10px 14px" },
  summaryItem: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
  summaryLabel: { fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" },
  summaryValue: { fontSize: "13px", fontWeight: 600, color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  scoreRow: { display: "flex", gap: "10px" },
  scoreChip: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#eef2ff", borderRadius: "10px", padding: "8px 4px" },
  scoreChipLabel: { fontSize: "10px", color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 },
  scoreChipVal: { fontSize: "16px", color: "#1e293b", fontWeight: 700, marginTop: "2px" },
  expandToggle: { textAlign: "center", fontSize: "12px", color: "#6366f1", fontWeight: 600, paddingTop: "4px" },
  expandedSection: { display: "flex", flexDirection: "column", gap: "12px" },
  divider: { border: "none", borderTop: "1px dashed #e2e8f0", margin: 0 },
  resumeBtn: { display: "inline-block", padding: "8px 16px", backgroundColor: "#4f46e5", color: "#fff", borderRadius: "8px", textDecoration: "none", fontSize: "13px", fontWeight: 600, alignSelf: "flex-start" },
  sectionHeading: { margin: 0, fontSize: "12px", color: "#334155", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" },
  detailsGrid: { display: "flex", flexDirection: "column", gap: "6px" },
  detailRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", padding: "6px 10px", borderRadius: "8px", backgroundColor: "#f8fafc" },
  detailKey: { fontSize: "12px", color: "#64748b", fontWeight: 600, flexShrink: 0, maxWidth: "50%" },
  detailVal: { fontSize: "13px", color: "#0f172a", textAlign: "right", wordBreak: "break-word" },
  detailLink: { color: "#4f46e5", textDecoration: "none", fontWeight: 600, fontSize: "13px" },
};
