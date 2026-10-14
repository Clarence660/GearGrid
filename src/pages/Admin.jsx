import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavHeader from "../components/NavHeader";
import { supabase } from "../lib/supabaseClient";
import { rentalDays } from "../lib/rentalDays";

const peso2 = (n) =>
  n === null || n === undefined ? "—" : `₱${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

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

export default function Admin() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("verification");

  // Verification
  const [pending, setPending] = useState([]);
  const [stats, setStats] = useState({ pending: 0, verified: 0, total: 0 });
  const [signedUrls, setSignedUrls] = useState({});
  const [actionError, setActionError] = useState("");

  // Analytics
  const [categoryStats, setCategoryStats] = useState([]);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [exportRows, setExportRows] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [priceStats, setPriceStats] = useState({ rows: [], excludedConverted: 0 });
  const [demoCandidates, setDemoCandidates] = useState([]);
  const [groupCounts, setGroupCounts] = useState({ rent: 0, buy: 0, buyForPrice: 0 });
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [successMetrics, setSuccessMetrics] = useState(null);

  // Reports
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [reportActionError, setReportActionError] = useState("");
  const [pendingReportsCount, setPendingReportsCount] = useState(0);

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
      await Promise.all([loadPending(), loadStats(), loadReportsCount()]);
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "analytics" && !analyticsLoaded) {
      loadAnalytics().then(() => setAnalyticsLoaded(true));
    }
    if (activeTab === "reports" && !reportsLoaded) {
      loadReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadStats = async () => {
    const [{ count: total }, { count: pendingCount }, { count: verifiedCount }] =
      await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("verification_status", "pending"),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("verification_status", "verified"),
      ]);

    setStats({ total: total || 0, pending: pendingCount || 0, verified: verifiedCount || 0 });
  };

  const loadPending = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("verification_status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      setActionError(error.message);
      return;
    }

    setPending(data || []);

    const urls = {};
    for (const row of data || []) {
      if (row.id_file_path) {
        const { data: signed } = await supabase.storage
          .from("ids")
          .createSignedUrl(row.id_file_path, 60 * 5);
        if (signed) urls[row.id] = signed.signedUrl;
      }
    }
    setSignedUrls(urls);
  };

  const handleDecision = async (userId, decision) => {
    setActionError("");
    const { error } = await supabase
      .from("profiles")
      .update({ verification_status: decision })
      .eq("id", userId);

    if (error) {
      setActionError(error.message);
      return;
    }

    setPending((prev) => prev.filter((p) => p.id !== userId));
    setStats((s) => ({
      ...s,
      pending: s.pending - 1,
      verified: decision === "verified" ? s.verified + 1 : s.verified,
    }));
  };

  const computeSuccessMetrics = (equipmentRows, txRows) => {
    // "Completed" means the meetup actually happened — an approved request with no
    // confirmed meetup is still just a pending handoff, not a real transaction.
    const completedTx = txRows.filter((t) => t.status === "approved" && t.meetup_confirmed && !t.is_demo);
    const completedRentTx = completedTx.filter((t) => t.transaction_type === "rent");

    // Time-to-First-Rental
    const firstRentByEquipment = {};
    completedRentTx.forEach((t) => {
      const existing = firstRentByEquipment[t.equipment_id];
      if (!existing || new Date(t.created_at) < new Date(existing)) {
        firstRentByEquipment[t.equipment_id] = t.created_at;
      }
    });

    const listingTimes = Object.entries(firstRentByEquipment)
      .map(([eqId, firstRentedAt]) => {
        const eq = equipmentRows.find((e) => e.id === eqId);
        if (!eq) return null;
        const days = (new Date(firstRentedAt) - new Date(eq.created_at)) / (1000 * 60 * 60 * 24);
        return Math.max(0, days);
      })
      .filter((d) => d !== null);

    const avgTimeToFirstRental = listingTimes.length
      ? listingTimes.reduce((a, b) => a + b, 0) / listingTimes.length
      : null;

    // Owner Utilization Rate
    let totalRentedDays = 0;
    let totalAvailableDays = 0;
    const now = new Date();

    equipmentRows
      .filter((e) => e.rent_price_per_day)
      .forEach((e) => {
        const availableDays = Math.max(1, (now - new Date(e.created_at)) / (1000 * 60 * 60 * 24));
        totalAvailableDays += availableDays;

        const rentedDays = completedRentTx
          .filter((t) => t.equipment_id === e.id)
          .reduce((sum, t) => sum + rentalDays(t.start_date, t.end_date), 0);
        totalRentedDays += rentedDays;
      });

    const utilizationRate = totalAvailableDays > 0 ? (totalRentedDays / totalAvailableDays) * 100 : 0;

    // Try-to-Buy Conversion Rate
    const tryToBuyEquipmentIds = new Set(equipmentRows.filter((e) => e.try_to_buy).map((e) => e.id));
    const eligibleRentTx = completedRentTx.filter((t) => tryToBuyEquipmentIds.has(t.equipment_id));
    const convertedCount = eligibleRentTx.filter((t) =>
      txRows.some((other) => other.converts_transaction_id === t.id)
    ).length;
    const tryToBuyConversionRate = eligibleRentTx.length
      ? (convertedCount / eligibleRentTx.length) * 100
      : null;

    // Repeat User Rate
    const requesterCounts = {};
    txRows.forEach((t) => {
      requesterCounts[t.requester_id] = (requesterCounts[t.requester_id] || 0) + 1;
    });
    const activeUserCount = Object.keys(requesterCounts).length;
    const repeatUserRate = activeUserCount ? txRows.length / activeUserCount : null;

    return {
      avgTimeToFirstRental,
      utilizationRate,
      tryToBuyConversionRate,
      repeatUserRate,
      eligibleRentTxCount: eligibleRentTx.length,
    };
  };

  const loadAnalytics = async () => {
    const { data: equipmentRows } = await supabase
      .from("equipment")
      .select("id, name, category, created_at, rent_price_per_day, try_to_buy");

    const { data: allTx } = await supabase
      .from("transactions")
      .select("id, equipment_id, transaction_type, status, meetup_confirmed, start_date, end_date, price, created_at, requester_id, converts_transaction_id, is_demo, meetup_confirmed_at");

    const equipmentMap = Object.fromEntries((equipmentRows || []).map((e) => [e.id, e]));
    // "Completed" means the meetup actually happened, not just that the owner approved
    // the request — an approved-but-never-met-up transaction isn't a real data point.
    const completedTx = (allTx || []).filter((t) => t.status === "approved" && t.meetup_confirmed && !t.is_demo);

    const statsMap = {};
    (equipmentRows || []).forEach((e) => {
      statsMap[e.category] = statsMap[e.category] || { category: e.category, rentCount: 0, buyCount: 0 };
    });

    completedTx.forEach((t) => {
      const category = equipmentMap[t.equipment_id]?.category;
      if (!category || !statsMap[category]) return;
      if (t.transaction_type === "rent") statsMap[category].rentCount += 1;
      else statsMap[category].buyCount += 1;
    });

    const statsList = Object.values(statsMap)
      .filter((s) => s.rentCount + s.buyCount > 0)
      .sort((a, b) => b.rentCount + b.buyCount - (a.rentCount + a.buyCount));

    setCategoryStats(statsList);
    setTotalCompleted(completedTx.length);

    // Group sizes to report before RQ2 / RQ3 (Try-to-Buy purchases are left out of the price analysis).
    const validRent = completedTx.filter((t) => t.transaction_type === "rent").length;
    const validBuy = completedTx.filter((t) => t.transaction_type === "buy").length;
    const validBuyConverted = completedTx.filter(
      (t) => t.transaction_type === "buy" && t.converts_transaction_id
    ).length;
    setGroupCounts({ rent: validRent, buy: validBuy, buyForPrice: validBuy - validBuyConverted });

    // RQ2: average price per category by transaction type (valid, non-demo only).
    // Try-to-Buy purchases are excluded because their price is the sale price minus the rental fee.
    const avg = (arr) => arr.reduce((x, y) => x + y, 0) / arr.length;
    const median = (arr) => {
      const sorted = [...arr].sort((x, y) => x - y);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const groups = {};
    let excludedConverted = 0;
    completedTx.forEach((t) => {
      const category = equipmentMap[t.equipment_id]?.category;
      if (!category) return;
      if (t.transaction_type === "buy" && t.converts_transaction_id) {
        excludedConverted += 1;
        return;
      }
      const key = `${category}|${t.transaction_type}`;
      const g = (groups[key] = groups[key] || { category, type: t.transaction_type, prices: [], perDay: [] });
      const price = Number(t.price);
      g.prices.push(price);
      if (t.transaction_type === "rent" && t.start_date && t.end_date) {
        g.perDay.push(price / rentalDays(t.start_date, t.end_date));
      }
    });
    const priceRows = Object.values(groups)
      .map((g) => ({
        category: g.category,
        type: g.type,
        n: g.prices.length,
        mean: avg(g.prices),
        median: median(g.prices),
        min: Math.min(...g.prices),
        max: Math.max(...g.prices),
        perDayMean: g.perDay.length ? avg(g.perDay) : null,
      }))
      .sort((x, y) => x.category.localeCompare(y.category) || (x.type === "rent" ? -1 : 1) - (y.type === "rent" ? -1 : 1));
    setPriceStats({ rows: priceRows, excludedConverted });

    // Completed transactions the admin can flag as demo (most recent 50).
    setDemoCandidates(
      (allTx || [])
        .filter((t) => t.status === "approved" && t.meetup_confirmed)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 50)
        .map((t) => ({
          id: t.id,
          equipment_name: equipmentMap[t.equipment_id]?.name || "Unknown item",
          transaction_type: t.transaction_type,
          price: t.price,
          is_demo: Boolean(t.is_demo),
          created_at: t.created_at,
        }))
    );

    const rows = (allTx || []).map((t) => {
      const eq = equipmentMap[t.equipment_id] || {};
      const isRent = t.transaction_type === "rent";
      // Same rule the app uses to price a rental: the start and end dates both count.
      const rentalDuration =
        isRent && t.start_date && t.end_date
          ? rentalDays(t.start_date, t.end_date)
          : "";
      const rentalPricePerDay =
        rentalDuration !== "" ? Math.round((Number(t.price) / rentalDuration) * 100) / 100 : "";
      return {
        transaction_id: t.id,
        equipment: eq.name || "",
        equipment_category: eq.category || "",
        transaction_type: t.transaction_type,
        price: t.price,
        rental_duration: rentalDuration,
        rental_price_per_day: rentalPricePerDay,
        start_date: t.start_date || "",
        end_date: t.end_date || "",
        status: t.status,
        meetup_confirmed: t.meetup_confirmed,
        is_demo: Boolean(t.is_demo),
        is_try_to_buy_purchase: Boolean(t.converts_transaction_id),
        is_valid: t.status === "approved" && Boolean(t.meetup_confirmed) && !t.is_demo,
        created_at: t.created_at,
        completed_at: t.meetup_confirmed_at || "",
      };
    });
    setExportRows(rows);
    setSuccessMetrics(computeSuccessMetrics(equipmentRows || [], allTx || []));
  };

  const handleExportCSV = () => {
    setExporting(true);

    const headers = [
      "transaction_id",
      "equipment",
      "equipment_category",
      "transaction_type",
      "price",
      "rental_duration",
      "rental_price_per_day",
      "start_date",
      "end_date",
      "status",
      "meetup_confirmed",
      "is_demo",
      "is_try_to_buy_purchase",
      "is_valid",
      "created_at",
      "completed_at",
    ];

    const csvLines = [
      headers.join(","),
      ...exportRows.map((row) =>
        headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
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

  const handleToggleDemo = async (id, value) => {
    const { error } = await supabase.rpc("set_transaction_demo", {
      p_transaction_id: id,
      p_is_demo: value,
    });
    if (error) {
      window.alert(error.message);
      return;
    }
    await loadAnalytics();
  };

  const loadReportsCount = async () => {
    const { data } = await supabase.from("reports").select("id").eq("status", "pending");
    setPendingReportsCount((data || []).length);
  };

  const loadReports = async () => {
    setReportsLoading(true);

    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    const userIds = [...new Set((data || []).flatMap((r) => [r.reporter_id, r.reported_user_id]))];
    const { data: profileRows } = userIds.length
      ? await supabase.from("public_profiles").select("id, full_name").in("id", userIds)
      : { data: [] };
    const profileMap = Object.fromEntries((profileRows || []).map((p) => [p.id, p.full_name]));

    setReports(
      (data || []).map((r) => ({
        ...r,
        reporterName: profileMap[r.reporter_id] || "Unknown",
        reportedName: profileMap[r.reported_user_id] || "Unknown",
      }))
    );
    setReportsLoading(false);
    setReportsLoaded(true);
  };

  const handleReportStatus = async (reportId, status) => {
    setReportActionError("");
    const { error } = await supabase.from("reports").update({ status }).eq("id", reportId);

    if (error) {
      setReportActionError(error.message);
      return;
    }

    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
    setPendingReportsCount((prev) => Math.max(0, prev - 1));
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
        showMessages={false}
        homePath="/admin"
      />

      <main className="admin-main">
        <div className="dashboard-welcome admin-welcome">
          <div>
            <span className="eyebrow">Admin</span>
            <h1>Admin Dashboard</h1>
            <p className="dashboard-sub">Manage verification, view analytics, and handle reports.</p>
          </div>
        </div>

        <div className="profile-tabs">
          <button
            type="button"
            className={`profile-tab-btn${activeTab === "verification" ? " active" : ""}`}
            onClick={() => setActiveTab("verification")}
          >
            Verification
            {stats.pending > 0 && <span className="tab-count">{stats.pending}</span>}
          </button>
          <button
            type="button"
            className={`profile-tab-btn${activeTab === "analytics" ? " active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            Analytics
          </button>
          <button
            type="button"
            className={`profile-tab-btn${activeTab === "reports" ? " active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            Reports
            {pendingReportsCount > 0 && <span className="tab-count">{pendingReportsCount}</span>}
          </button>
        </div>

        {activeTab === "verification" && (
          <>
            <div className="stats-row">
              <div className="stat-card stat-card-total">
                <span className="stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">Total members</span>
              </div>
              <div className="stat-card stat-card-pending">
                <span className="stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3.5 2" />
                  </svg>
                </span>
                <span className="stat-value">{stats.pending}</span>
                <span className="stat-label">Pending review</span>
              </div>
              <div className="stat-card stat-card-verified">
                <span className="stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                    <path d="M9.5 12l1.8 1.8L15 10" />
                  </svg>
                </span>
                <span className="stat-value">{stats.verified}</span>
                <span className="stat-label">Verified</span>
              </div>
            </div>

            {actionError && <div className="form-banner error">{actionError}</div>}

            {pending.length === 0 ? (
              <p className="admin-empty">No pending verifications right now.</p>
            ) : (
              <div className="admin-list">
                {pending.map((row) => (
                  <div className="admin-row" key={row.id}>
                    <div className="admin-row-id">
                      {signedUrls[row.id] ? (
                        <a href={signedUrls[row.id]} target="_blank" rel="noreferrer">
                          <img src={signedUrls[row.id]} alt="Submitted ID" className="admin-id-preview" />
                        </a>
                      ) : (
                        <div className="admin-id-preview admin-id-preview-empty">No file</div>
                      )}
                    </div>

                    <div className="admin-row-details">
                      <p className="admin-row-name">{row.full_name}</p>
                      <p className="admin-row-meta">{row.email}</p>
                      <p className="admin-row-meta">
                        Role: <strong>{row.role}</strong> · ID type: {row.id_type || "—"}
                      </p>
                    </div>

                    <div className="admin-row-actions">
                      <button className="btn btn-primary" onClick={() => handleDecision(row.id, "verified")}>
                        Approve
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDecision(row.id, "rejected")}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "analytics" && (
          <>
            {successMetrics && (
              <section className="dashboard-section owner-section">
                <div className="dashboard-section-header">
                  <div>
                    <span className="section-kicker">Success Metrics</span>
                    <h2 className="dashboard-section-title">Marketplace health</h2>
                  </div>
                </div>
                <div className="stats-row metrics-row">
                  <div className="stat-card">
                    <span className="stat-value">
                      {successMetrics.avgTimeToFirstRental !== null
                        ? `${successMetrics.avgTimeToFirstRental.toFixed(1)}d`
                        : "—"}
                    </span>
                    <span className="stat-label">Avg. time-to-first-rental</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{successMetrics.utilizationRate.toFixed(1)}%</span>
                    <span className="stat-label">Owner utilization rate</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">
                      {successMetrics.tryToBuyConversionRate !== null
                        ? `${successMetrics.tryToBuyConversionRate.toFixed(1)}%`
                        : "—"}
                    </span>
                    <span className="stat-label">
                      Try-to-Buy conversion {successMetrics.eligibleRentTxCount > 0 && `(${successMetrics.eligibleRentTxCount} eligible)`}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">
                      {successMetrics.repeatUserRate !== null ? successMetrics.repeatUserRate.toFixed(2) : "—"}
                    </span>
                    <span className="stat-label">Transactions per active user</span>
                  </div>
                </div>
              </section>
            )}

            <section className="dashboard-section owner-section">
              <div className="dashboard-section-header">
                <div>
                  <span className="section-kicker">Research Question 1</span>
                  <h2 className="dashboard-section-title">Category demand</h2>
                </div>
                <span className="results-count">{totalCompleted} completed transactions</span>
              </div>
              <p className="owner-section-empty" style={{ marginBottom: 12 }}>
                Valid rentals: <strong>{groupCounts.rent}</strong> · Valid purchases: <strong>{groupCounts.buy}</strong>
                <br />
                Group sizes for the price analysis (RQ2, RQ3): n_rent = <strong>{groupCounts.rent}</strong>, n_buy ={" "}
                <strong>{groupCounts.buyForPrice}</strong> (Try-to-Buy purchases excluded)
              </p>
              <CategoryBarChart data={categoryStats} />
            </section>

            <section className="dashboard-section owner-section">
              <div className="dashboard-section-header">
                <div>
                  <span className="section-kicker">Research Question 2</span>
                  <h2 className="dashboard-section-title">Average price by category</h2>
                </div>
              </div>
              {priceStats.rows.length === 0 ? (
                <p className="owner-section-empty">No completed transactions yet.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th style={{ padding: "8px 6px" }}>Category</th>
                        <th style={{ padding: "8px 6px" }}>Type</th>
                        <th style={{ padding: "8px 6px" }}>n</th>
                        <th style={{ padding: "8px 6px" }}>Mean</th>
                        <th style={{ padding: "8px 6px" }}>Median</th>
                        <th style={{ padding: "8px 6px" }}>Min</th>
                        <th style={{ padding: "8px 6px" }}>Max</th>
                        <th style={{ padding: "8px 6px" }}>Mean / day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceStats.rows.map((r) => (
                        <tr key={`${r.category}-${r.type}`} style={{ borderTop: "1px solid var(--line)" }}>
                          <td style={{ padding: "8px 6px" }}>{r.category}</td>
                          <td style={{ padding: "8px 6px" }}>{r.type === "rent" ? "Rent" : "Buy"}</td>
                          <td style={{ padding: "8px 6px" }}>{r.n}</td>
                          <td style={{ padding: "8px 6px" }}>{peso2(r.mean)}</td>
                          <td style={{ padding: "8px 6px" }}>{peso2(r.median)}</td>
                          <td style={{ padding: "8px 6px" }}>{peso2(r.min)}</td>
                          <td style={{ padding: "8px 6px" }}>{peso2(r.max)}</td>
                          <td style={{ padding: "8px 6px" }}>{r.perDayMean === null ? "—" : peso2(r.perDayMean)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="owner-section-empty" style={{ marginTop: 12 }}>
                Rent price is the total for the whole rental. Mean / day is price ÷ rental days (rentals only). Valid, non-demo transactions only.
                {priceStats.excludedConverted > 0 &&
                  ` ${priceStats.excludedConverted} Try-to-Buy purchase(s) excluded because their price is discounted by the rental fee.`}
              </p>
            </section>

            <section className="dashboard-section owner-section">
              <div className="dashboard-section-header">
                <div>
                  <span className="section-kicker">Data quality</span>
                  <h2 className="dashboard-section-title">Demo transactions</h2>
                </div>
              </div>
              <p className="owner-section-empty" style={{ marginBottom: 12 }}>
                Flag test or demonstration transactions so they're left out of the charts and the export's
                valid set. Showing the latest completed transactions.
              </p>
              {demoCandidates.length === 0 ? (
                <p className="owner-section-empty">No completed transactions yet.</p>
              ) : (
                <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <tbody>
                      {demoCandidates.map((t) => (
                        <tr key={t.id} style={{ borderTop: "1px solid var(--line)" }}>
                          <td style={{ padding: "8px 6px" }}>{t.equipment_name}</td>
                          <td style={{ padding: "8px 6px" }}>{t.transaction_type}</td>
                          <td style={{ padding: "8px 6px" }}>{peso2(t.price)}</td>
                          <td style={{ padding: "8px 6px" }}>{new Date(t.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: "8px 6px" }}>
                            <button
                              type="button"
                              className="report-trigger"
                              onClick={() => handleToggleDemo(t.id, !t.is_demo)}
                            >
                              {t.is_demo ? "Demo ✓ (undo)" : "Mark as demo"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="dashboard-section owner-section">
              <div className="dashboard-section-header">
                <div>
                  <span className="section-kicker">Research Questions 2 & 3</span>
                  <h2 className="dashboard-section-title">Raw data export</h2>
                </div>
              </div>
              <p className="owner-section-empty" style={{ marginBottom: 16 }}>
                Export the full dataset and analyze it in Colab. Filter to is_valid = TRUE first. Use is_try_to_buy_purchase to exclude discounted purchases. rental_duration and rental_price_per_day are filled for rentals only. created_at is when the request was made, and completed_at is when the meetup was confirmed.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleExportCSV}
                disabled={exporting || exportRows.length === 0}
              >
                {exporting ? "Preparing…" : `Export ${exportRows.length} transactions as CSV`}
              </button>
            </section>
          </>
        )}

        {activeTab === "reports" && (
          <section className="dashboard-section owner-section">
            {reportActionError && <div className="form-banner error">{reportActionError}</div>}
            {reportsLoading ? (
              <div className="requests-panel-loading">
                <span className="loading-orb-inline" />
              </div>
            ) : reports.length === 0 ? (
              <p className="admin-empty">No reports submitted yet.</p>
            ) : (
              <div className="admin-list">
                {reports.map((r) => (
                  <div className="report-row" key={r.id}>
                    <div>
                      <p className="admin-row-name">{r.reason}</p>
                      <p className="admin-row-meta">
                        Reported: <strong>{r.reportedName}</strong> · By: {r.reporterName} ·{" "}
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                      {r.details && <p className="report-details">{r.details}</p>}
                    </div>
                    {r.status === "pending" ? (
                      <div className="admin-row-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleReportStatus(r.id, "resolved")}
                        >
                          Resolve
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleReportStatus(r.id, "dismissed")}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <span className={`status-badge status-${r.status === "resolved" ? "approved" : "declined"}`}>
                        {r.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}