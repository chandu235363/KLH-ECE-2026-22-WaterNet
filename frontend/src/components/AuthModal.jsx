import { useState } from "react";
import { login, register } from "../api";

export default function AuthModal({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [userid, setUserid] = useState("");
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        if (!userid || !name || !pwd) {
          setError("Please fill in User ID, Full Name, and Password");
          setLoading(false);
          return;
        }
        const res = await register(userid, name, pwd);
        onLoginSuccess(res.user);
      } else {
        if (!userid || !pwd) {
          setError("Please fill in User ID and Password");
          setLoading(false);
          return;
        }
        const res = await login(userid, pwd);
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin() {
    setUserid("admin");
    setPwd("password123");
    setError("");
    setLoading(true);
    login("admin", "password123")
      .then((res) => onLoginSuccess(res.user))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-badge">WaterNet PBL</div>
          <h2>{isRegister ? "Create Operator Account" : "Operator Sign In"}</h2>
          <p className="auth-subtitle">
            Authenticated via PostgreSQL database (React + Node.js + Express + PostgreSQL)
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="auth-userid">User ID (userid)</label>
            <input
              id="auth-userid"
              type="text"
              placeholder="e.g. operator1 or admin"
              value={userid}
              onChange={(e) => setUserid(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {isRegister && (
            <div className="form-group">
              <label htmlFor="auth-name">Full Name (name)</label>
              <input
                id="auth-name"
                type="text"
                placeholder="e.g. Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-pwd">Password (pwd)</label>
            <input
              id="auth-pwd"
              type="password"
              placeholder="••••••••"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? "Processing..." : isRegister ? "Create Account & Sign In" : "Sign In to WaterNet"}
          </button>
        </form>

        <div className="auth-actions">
          <button
            type="button"
            className="auth-toggle-btn"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister
              ? "Already have an account? Sign In"
              : "Need an account? Register here"}
          </button>

          {!isRegister && (
            <button
              type="button"
              className="demo-login-btn"
              onClick={handleDemoLogin}
              disabled={loading}
            >
              ⚡ Quick Demo Login (admin / password123)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
