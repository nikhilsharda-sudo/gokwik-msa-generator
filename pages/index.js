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
  title: { margin: "6p
