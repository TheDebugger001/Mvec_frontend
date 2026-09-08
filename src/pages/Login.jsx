import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import GoogleButton from "../components/GoogleButton";
import FormField from "../components/FormField";
import { extractErrorMessage } from "../API/client";
import { useAuth } from "../context/AuthContext";
export default function Login() {
  const navigate = useNavigate(),
    location = useLocation();
  const [form, setForm] = useState({ identity: "", password: "" });
  const { login } = useAuth();
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.identity.trim(), form.password);
      navigate(
        user.role === "vendor"
          ? "/vendor"
          : user.role === "supplier"
            ? "/supplier"
            : user.role === "affiliate"
              ? "/affiliate"
              : user.role === "delivery"
                ? "/delivery"
                : user.role === "super_admin"
                  ? "/admin"
                  : location.state?.from || "/",
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue shopping or managing your store."
    >
      <GoogleButton />
      <div className="or-divider">
        <span>OR</span>
      </div>
      {error && <div className="form-alert error">{error}</div>}
      <form onSubmit={handleSubmit} className="auth-form" method="POST">
        <FormField
          label="Email or telephone"
          name="identity"
          placeholder="Enter your email or telephone"
          value={form.identity}
          onChange={update}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          placeholder="Enter your password"
          value={form.password}
          onChange={update}
        />
        <div className="form-row">
          <label className="remember">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password" className="text-btn">
            Forgot password?
          </Link>
        </div>
        <button className="submit-btn" type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="switch-text">
        Don't have an account? <Link to="/signup">Create one</Link>
      </p>
      <button className="back-home" onClick={() => navigate("/")}>
        ← Back to home
      </button>
    </AuthLayout>
  );
}
