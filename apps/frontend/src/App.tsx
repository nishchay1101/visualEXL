import { useState } from "react";
import CardList from "./component/CardList";
import Upload from "./component/Upload";

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ padding: "0 20px" }}>
      <h1 style={{ textAlign: "center", fontFamily: "sans-serif", color: "#2d3748" }}>Candidate Dashboard</h1>
      <Upload onUploadSuccess={() => setRefreshKey(prev => prev + 1)} />
      <hr style={{ borderTop: "1px solid #e2e8f0", margin: "20px 0" }} />
      <CardList refreshKey={refreshKey} />
    </div>
  );
}