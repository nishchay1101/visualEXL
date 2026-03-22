import { useState } from "react";
import CardList from "./component/CardList";
import Upload from "./component/Upload";

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Sticky gradient header */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4f46e5 100%)",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        height: "60px",
        boxShadow: "0 4px 20px rgba(79,70,229,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>📊</span>
          <span style={{
            fontSize: "20px",
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.5px",
          }}>
            visual<span style={{ color: "#a5b4fc" }}>EXL</span>
          </span>
        </div>
        <span style={{
          marginLeft: "16px",
          fontSize: "13px",
          color: "#c7d2fe",
          fontWeight: 500,
          borderLeft: "1px solid rgba(165,180,252,0.3)",
          paddingLeft: "16px",
        }}>
          Recruitment Dashboard
        </span>
      </header>

      {/* Upload strip */}
      <div style={{
        backgroundColor: "#fff",
        borderBottom: "1px solid #e2e8f0",
        padding: "20px 32px",
      }}>
        <Upload onUploadSuccess={() => setRefreshKey(prev => prev + 1)} />
      </div>

      {/* Card list */}
      <main style={{ padding: "24px 12px" }}>
        <CardList refreshKey={refreshKey} />
      </main>
    </div>
  );
}
