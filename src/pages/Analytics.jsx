import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import NavHeader from "../components/NavHeader";
import { supabase } from "../lib/supabaseClient";

function CategoryBarChart({ data }) {
  const maxValue = Math.max(1, ...data.flatMap((d) => [d.rentCount, d.buyCount]));

  if (data.length === 0) {
    return <p className="owner-section-empty">No completed transactions yet.</p>;
  }

  return (
    <div className="analytics-chart">
      <div className="analytics-chart-legend">
        <span className="legend-item">
          <span className="legend-dot legend-dot-rent" /> Rentals
        </span>
        <span className="legend-item">
          <span className="legend-dot legend-dot-buy" /> Purchases
        </span>
      </div>
      <div className="analytics-chart-bars">
        {data.map((d) => (
          <div className="analytics-chart-group" key={d.category}>
            <div className="analytics-chart-bar-pair">
              <div
                className="analytics-bar analytics-bar-rent"
                style={{ height: `${(d.rentCount / maxValue) * 100}%` }}
                title={`${d.rentCount} rentals`}
              />
              <div
                className="analytics-bar analytics-bar-buy"
                style={{ height: `${(d.buyCount / maxValue) * 100}%` }}
                title={`${d.buyCount} purchases`}
              />
            </div>
            <span className="analytics-chart-total">{d.rentCount + d.buyCount}</span>
            <span className="analytics-chart-label">{d.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [categoryStats, setCategoryStats] = useState([]);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [exportRows, setExportRows] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!myProfile?.is_admin) {
        navigate("/dashboard");
        return;
      }

      if (active) setAuthorized(true);
      await loadAnalytics();
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAnalytics = async () => {
    const { data: equipmentRows } = await supabase
      .from("equipment")
      .select("id, name, category");

    const { data: allTx } = await supabase
      .from("transactions")
      .select("equipment_id, transaction_type, status, start_date, end_date, price, created_at");

    const equipmentMap = Object.fromEntries((equipmentRows || []).map((e) => [e.id, e]));

    // Research Question 1: category demand — completed (approved) transactions only
    const approvedTx = (allTx || []).filter((t) => t.status === "approved");

    const statsMap = {};
    (equipmentRows || []).forEach((e) => {
      statsMap[e.category] = statsMap[e.category] || { category: e.category, rentCount: 0, buyCount: 0 };
    });

    approvedTx.forEach((t) => {
      const category = equipmentMap[t.equipment_id]?.category;
      if (!category || !statsMap[category]) return;
      if (t.transaction_type === "rent") statsMap[category].rentCount += 1;
      else statsMap[category].buyCount += 1;
    });

    const stats = Object.values(statsMap)
      .filter((s) => s.rentCount + s.buyCount > 0)
      .sort((a, b) => b.rentCount + b.buyCount - (a.rentCount + a.buyCount));

    setCategoryStats(stats);
    setTotalCompleted(approvedTx.length);

    // Full export set for Q2/Q3 — analyzed in Colab, not computed here
    const rows = (allTx || []).map((t) => {
      const eq = equipmentMap[t.equipment_id] || {};
      return {
        equipment_name: eq.name || "",
        category: eq.category || "",
        transaction_type: t.transaction_type,
        status: t.status,
        start_date: t.start_date || "",
        end_date: t.end_date || "",
        price: t.price,
        created_at: t.created_at,
      };
    });
    setExportRows(rows);
  };

  const handleExportCSV = () => {
    setExporting(true);

    const headers = [
      "equipment_name",
      "category",
      "transaction_type",
      "status",
      "start_date",
      "end_date",
      "price",
      "created_at",
    ];

    const csvLines = [
      headers.join(","),
      ...exportRows.map((row) =>
        headers
          .map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geargrid-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading || !authorized) {
    return (
      <div className="page-loading">
        <div className="loading-orb" />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="app-page">
      <NavHeader
        onLogout={handleLogout}
        rightSlot={<span className="admin-badge">Admin</span>}
        showRequests={false}
        homePath="/admin"
      />

      <main className="admin-main">
                <div className="dashboard-welcome">
          <div>
            <span className="eyebrow">Admin</span>
            <h1 className="admin-welcome-title">Analytics</h1>
            <p className="dashboard-sub">Marketplace demand and transaction data for research analysis.</p>
          </div>
        </div>

        <section className="dashboard-section owner-section">
          <div className="dashboard-section-header">
            <div>
              <span className="section-kicker">Research Question 1</span>
              <h2 className="dashboard-section-title">Category demand</h2>
            </div>
            <span className="results-count">{totalCompleted} completed transactions</span>
          </div>
          <CategoryBarChart data={categoryStats} />
        </section>

        <section className="dashboard-section owner-section">
          <div className="dashboard-section-header">
            <div>
              <span className="section-kicker">Research Questions 2 & 3</span>
              <h2 className="dashboard-section-title">Raw data export</h2>
            </div>
          </div>
          <p className="owner-section-empty" style={{ marginBottom: 16 }}>
            Average rental duration and price comparisons are best computed with proper statistical
            tools. Export the full transaction dataset below to analyze in your Colab notebook.
          </p>
          <button className="btn btn-primary" onClick={handleExportCSV} disabled={exporting || exportRows.length === 0}>
            {exporting ? "Preparing…" : `Export ${exportRows.length} transactions as CSV`}
          </button>
        </section>
      </main>
    </div>
  );
}