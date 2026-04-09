import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

export default function Home() {
  const { data: session } = useSession();
  const [brand, setBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!brand.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/create-msa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: brand.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.logo}>⚡ GoKwik</span>
          <h1 style={styles.title}>MSA Generator</h1>
          <p style={styles.subtitle}>Generate a pre-filled Merchant Service Agreement instantly</p>
        </div>

        {!session ? (
          <button style={styles.btnPrimary} onClick={() => signIn("google")}>
            🔐 Sign in with Google
          </button>
        ) : (
          <>
            <div style={styles.userBar}>
              <img src={session.user.image} style={styles.avatar} alt="" />
              <span style={styles.userName}>{session.user.name}</span>
              <span style={styles.signout} onClick={() => signOut()}>Sign out</span>
            </div>

            <label style={styles.label}>Brand / Merchant Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="e.g. Myntra, Boat, Mamaearth"
              value={brand}
              onChange={e => { setBrand(e.target.value); setResult(null); setError(null); }}
              onKeyDown={e => e.key === "Enter" && handleGenerate()}
            />

            <button
              style={{ ...styles.btnPrimary, opacity: (loading || !brand.trim()) ? 0.65 : 1 }}
              onClick={handleGenerate}
              disabled={loading || !brand.trim()}
            >
              {loading ? "⏳ Creating document..." : "📄 Generate MSA"}
            </button>

            {result && (
              <div style={styles.resultBox}>
                <div style={styles.resultTitle}>✅ MSA ready for <strong>{brand}</strong></div>
                <div style={styles.linkRow}>
                  <input
                    style={styles.linkInput}
                    value={result.url}
                    readOnly
                    onClick={e => e.target.select()}
                  />
                  <button style={styles.copyBtn} onClick={handleCopy}>
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
                <div style={styles.actions}>
                  <a href={result.url} target="_blank" rel="noreferrer" style={styles.openLink}>
                    Open in Google Docs →
                  </a>
                  <span style={styles.hint}>🔓 Anyone with the link can edit</span>
                </div>
              </div>
            )}

            {error && <div style={styles.errBox}>❌ {error}</div>}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)", fontFamily: "'Segoe UI', sans-serif", padding: 16 },
  card: { background: "#fff", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 460, boxShadow: "0 8px 32px rgba(67,97,238,0.10)" },
  header: { marginBottom: 28, textAlign: "center" },
  logo: { fontSize: 13, fontWeight: 700, color: "#4361ee", letterSpacing: 1, textTransform: "uppercase" },
  title: { margin: "6px 0 4px", fontSize: 24, fontWeight: 800, color: "#1a1a2e" },
  subtitle: { margin: 0, fontSize: 13, color: "#888" },
  userBar: { display: "flex", alignItems: "center", gap: 10, marginBottom: 22, padding: "10px 14px", background: "#f7f8ff", borderRadius: 10 },
  avatar: { width: 30, height: 30, borderRadius: "50%" },
  userName: { flex: 1, fontSize: 14, fontWeight: 600, color: "#333" },
  signout: { fontSize: 12, color: "#e63946", cursor: "pointer" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 8 },
  input: { width: "100%", padding: "13px 14px", borderRadius: 10, border: "1.5px solid #e0e0e0", fontSize: 15, marginBottom: 14, boxSizing: "border-box", outline: "none" },
  btnPrimary: { width: "100%", padding: "14px", background: "#4361ee", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  resultBox: { marginTop: 22, padding: "18px 16px", background: "#f0fff4", border: "1.5px solid #b7f5c8", borderRadius: 12 },
  resultTitle: { fontSize: 14, color: "#1a6b3c", marginBottom: 12 },
  linkRow: { display: "flex", gap: 8, marginBottom: 10 },
  linkInput: { flex: 1, padding: "10px 12px", borderRadius: 8, border: "1.5px solid #d0e8d8", fontSize: 12, color: "#333", background: "#fff" },
  copyBtn: { padding: "10px 16px", background: "#2a9d8f", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" },
  actions: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  openLink: { fontSize: 13, color: "#4361ee", fontWeight: 600, textDecoration: "none" },
  hint: { fontSize: 11, color: "#888" },
  errBox: { marginTop: 16, padding: 14, background: "#fff0f0", borderRadius: 10, color: "#c0392b", fontSize: 14 },
};
