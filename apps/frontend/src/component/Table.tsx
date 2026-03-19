import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function Table({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/candidates", { params: { search } })
      .then(res => setData(res.data));
  }, [search, refreshKey]);

  return (
    <div>
      <input onChange={(e) => setSearch(e.target.value)} placeholder="Search" />

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>College</th>
            <th>Score</th>
          </tr>
        </thead>

        <tbody>
          {data.map((c, i) => (
            <tr key={i}>
              <td>{c.name}</td>
              <td>{c.college}</td>
              <td>{c.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}